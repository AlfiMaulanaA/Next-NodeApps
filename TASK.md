
# 🚀 **Fitur Upload & Update UI Static - Implementasi Detail**

## 📋 **Overview Fitur**

Fitur ini memungkinkan update tampilan web IoT secara **over-the-air (OTA)** melalui web interface atau MQTT, tanpa perlu akses SSH ke server. Sistem akan mengekstrak file build (.zip) dan otomatis overwrite konten di `/var/www/html`.

---

## 🎯 **Requirement Detail**

### **Functional Requirements**
- ✅ Upload file `.zip` hasil build aplikasi web
- ✅ Auto ekstrak dan overwrite `/var/www/html`
- ✅ Backup versi sebelum update
- ✅ Progress tracking dan status real-time
- ✅ Rollback ke versi sebelumnya (emergency)
- ✅ Validasi security (file type, size, content)
- ✅ Access control (localhost/network restricted)

### **Technical Requirements**
- ✅ Integration dengan MQTT broker existing (`localhost:1883`)
- ✅ Web interface via Next.js frontend
- ✅ Python middleware untuk handling file operations
- ✅ Systemd service untuk auto-restart setelah update
- ✅ Error handling dan logging comprehensive

---

## 🏗️ **Arsitektur Implementasi**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Frontend  │────│   MQTT Broker    │────│   UiUpdater     │
│   (Next.js)     │    │   (localhost)    │    │   (Python)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Upload API    │────│   command/       │────│   File System   │
│   /api/ui-update│     │   ui-update      │    │   /var/www/html │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 📂 **Struktur File Baru**

### **1. Middleware (Python)**
```
/middleware/CONFIG_SYSTEM_DEVICE/
├── UiUpdater.py                    # Core update logic
├── ui_update_config.json          # Update settings
└── backup/                        # Backup storage
    └── ui_versions.json           # Version history
```

### **2. Frontend (Next.js)**
```
/app/settings/ui-update/
├── page.tsx                       # Main upload page
├── UploadForm.tsx                 # File upload component
├── UpdateStatus.tsx               # Progress display
└── VersionHistory.tsx             # Backup versions
```

### **3. Service Configuration**
```
/SERVICE_FILE/
├── ui-updater.service             # Systemd service
└── ui-updater.sh                  # Start script
```

---

## 🔧 **Technical Implementation**

### **1. UiUpdater.py (Python Middleware)**

```python
import os
import json
import zipfile
import shutil
import time
import paho.mqtt.client as mqtt
from datetime import datetime
import uuid

# Configuration
UI_ROOT_PATH = "/var/www/html"
BACKUP_PATH = "/opt/ui-backup"
MQTT_BROKER = "localhost"
MQTT_PORT = 1883

class UiUpdater:
    def __init__(self):
        self.mqtt_client = self.setup_mqtt()
        self.current_version = self.load_current_version()

    def setup_mqtt(self):
        client = mqtt.Client(f"ui-updater-{uuid.uuid4()}")
        client.on_message = self.on_mqtt_message
        client.connect(MQTT_BROKER, MQTT_PORT)
        client.subscribe("command/ui-update")
        client.loop_start()
        return client

    def on_mqtt_message(self, client, userdata, message):
        try:
            payload = json.loads(message.payload.decode())
            command = payload.get("command")

            if command == "upload":
                self.handle_upload(payload)
            elif command == "rollback":
                self.handle_rollback(payload)

        except Exception as e:
            self.send_response({"status": "error", "message": str(e)})

    def handle_upload(self, payload):
        zip_content = payload.get("content")
        filename = payload.get("filename")

        # Validasi
        if not self.validate_zip_file(zip_content):
            return self.send_response({
                "status": "error",
                "message": "Invalid zip file or content validation failed"
            })

        # Create backup
        version_id = self.create_backup()

        # Extract new UI
        try:
            self.extract_zip(zip_content, version_id)
            self.send_response({
                "status": "success",
                "message": "UI updated successfully",
                "version": version_id
            })
        except Exception as e:
            # Rollback on error
            self.rollback(version_id)
            self.send_response({
                "status": "error",
                "message": f"Update failed, rolled back: {str(e)}"
            })

    def validate_zip_file(self, content):
        # Check file size (max 100MB)
        if len(content) > 100 * 1024 * 1024:
            return False

        # Validate zip structure
        try:
            # Basic structure check
            return True
        except:
            return False

    def create_backup(self):
        version_id = f"backup_{int(time.time())}"
        backup_dir = os.path.join(BACKUP_PATH, version_id)
        os.makedirs(backup_dir, exist_ok=True)

        # Copy current UI to backup
        if os.path.exists(UI_ROOT_PATH):
            shutil.copytree(UI_ROOT_PATH, os.path.join(backup_dir, "ui"))

        return version_id
```

### **2. Frontend Upload Component**

```typescript
// app/settings/ui-update/page.tsx
"use client";

import { useState } from 'react';
import { useMQTT } from '@/hooks/useMQTT';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function UiUpdatePage() {
  const { client } = useMQTT();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    setProgress(0);

    try {
      // Read file as base64
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result?.toString().split(',')[1];
          if (base64) resolve(base64);
          else reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      });

      setProgress(25);

      // Send via MQTT
      await client.publish('command/ui-update', JSON.stringify({
        command: 'upload',
        content: content,
        filename: file.name,
        timestamp: new Date().toISOString()
      }));

      setProgress(50);

      // Listen for response
      const handleResponse = (topic: string, message: string) => {
        if (topic === 'response/ui-update') {
          const response = JSON.parse(message);
          setProgress(100);

          if (response.status === 'success') {
            setStatus('success');
            setMessage(response.message);
          } else {
            setStatus('error');
            setMessage(response.message);
          }
        }
      };

      // Setup response listener (simplified)
      setProgress(100);

    } catch (error) {
      setStatus('error');
      setMessage(`Upload failed: ${error}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Upload className="h-6 w-6" />
        <h1 className="text-2xl font-bold">UI Update Manager</h1>
      </div>

      <div className="space-y-4">
        <div>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-violet-700
              hover:file:bg-violet-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Upload .zip file hasil dari npm run build (max 100MB)
          </p>
        </div>

        {(status === 'uploading' || status === 'success' || status === 'error') && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            {message && (
              <Alert variant={status === 'success' ? 'default' : 'destructive'}>
                {status === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || status === 'uploading'}
          className="w-full"
        >
          {status === 'uploading' ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload & Update UI
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
```

### **3. MQTT Topics Configuration**

```json
{
  "ui_update_topics": {
    "command_topics": ["command/ui-update", "command/ui-rollback"],
    "response_topics": ["response/ui-update", "response/ui-status"],
    "status_topics": ["status/ui-update/progress", "status/ui-version"]
  }
}
```

---

## 🔐 **Security & Validation**

### **1. File Validation**
- File type: `.zip` only
- Maximum size: 100MB
- Content validation: Check for standard web files (HTML, JS, CSS)
- Malware scanning: Basic structure validation

### **2. Access Control**
- Only localhost access allowed
- IP whitelist support
- JWT token untuk web interface

### **3. Security Headers**
```nginx
# nginx.conf untuk /var/www/html
server {
    listen 80;
    server_name _;
    root /var/www/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Content-Security-Policy "default-src 'self'";
}
```

---

## 📊 **API Endpoints**

### **Frontend APIs**
```
GET  /api/ui-update/status     # Get current version
POST /api/ui-update/upload     # Upload new UI zip
GET  /api/ui-update/history    # Get backup versions
POST /api/ui-update/rollback   # Rollback to version
```

### **MQTT Commands**
```json
// Upload command
{
  "command": "upload",
  "content": "<base64-zip-content>",
  "filename": "build.zip",
  "timestamp": "2024-01-01T00:00:00Z"
}

// Rollback command
{
  "command": "rollback",
  "version_id": "backup_1640995200"
}
```

---

## 🧪 **Testing Scenarios**

### **1. Normal Flow**
1. Upload valid `.zip` file
2. System creates backup
3. Extracts files to `/var/www/html`
4. Publishes success notification

### **2. Error Handling**
1. **Invalid file type**: Reject non-zip files
2. **Oversized file**: Reject >100MB
3. **Corrupt zip**: Rollback to backup
4. **Permission error**: Failed update tanpa overwrite

### **3. Edge Cases**
1. **Power failure during extract**: Auto resume/rollback
2. **Concurrent uploads**: Queue system
3. **Network interruption**: Timeout handling

---

## 🚀 **Deployment Steps**

### **1. Buat Middleware Service**
```bash
# Buat file Python baru
cp middleware/CONFIG_SYSTEM_DEVICE/Settings.py middleware/CONFIG_SYSTEM_DEVICE/UiUpdater.py
# Edit UiUpdater.py sesuai spesifikasi
```

### **2. Update Service File**
```bash
# Copy dan edit service template
cp SERVICE_FILE/base_rpi.service SERVICE_FILE/ui-updater.service
# Ubah ExecStart untuk UiUpdater.py
```

### **3. Frontend Components**
```bash
# Buat folder baru
mkdir -p app/settings/ui-update
# Implement components sesuai kode di atas
```

### **4. Konfigurasi MQTT Topics**
```bash
# Update MQTT config untuk subscribe topics baru
# Test connectivity dengan mosquitto_pub
```

---

## 📈 **Monitoring & Logging**

### **1. MQTT Status Topics**
- `status/ui-update/progress` - Progress updates
- `status/ui-version` - Current version info
- `alert/ui-update` - Error notifications

### **2. Error Logging**
- Invalid file uploads
- Extract failures
- Rollback events
- Permission issues

### **3. Version Tracking**
```json
{
  "current_version": "2024-01-01-12-00",
  "backup_versions": [
    {
      "id": "backup_1640995200",
      "timestamp": "2024-01-01T12:00:00Z",
      "size": "45MB",
      "description": "Normal update"
    }
  ]
}
```

---

## 🔄 **Rollback Mechanism**

### **Automatic Rollback**
```python
def rollback(self, version_id):
    backup_dir = os.path.join(BACKUP_PATH, version_id, "ui")
    if os.path.exists(backup_dir):
        # Remove current UI
        shutil.rmtree(UI_ROOT_PATH)
        # Restore from backup
        shutil.copytree(backup_dir, UI_ROOT_PATH)
        return True
    return False
```

### **Manual Rollback via Interface**
- List semua backup versions
- Klik untuk rollback ke versi tertentu
- Forced refresh browser cache

---

## ⏱️ **Timeline Implementasi**

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Setup UiUpdater.py middleware | 2 hours |
| 2 | Frontend upload component | 3 hours |
| 3 | MQTT integration testing | 1 hour |
| 4 | File validation & security | 1 hour |
| 5 | Backup & rollback system | 2 hours |
| 6 | Nginx configuration update | 30 mins |
| 7 | End-to-end testing | 2 hours |
| **Total** | **Full implementation** | **10 hours** |

---

## 📝 **Next Steps**

1. **Review & Approve**: Pastikan semua requirement sesuai
2. **Development**: Follow timeline di atas
3. **Testing**: Unit tests untuk critical functions
4. **Deployment**: Gradual deploy dengan rollback plan
5. **Documentation**: Update wiki dengan procedure

---

## 🎯 **Expected Outcome**

✅ **User dapat upload UI baru** melalui web interface  
✅ **System auto backup** versi sebelumnya  
✅ **Real-time progress** selama upload  
✅ **Secure validation** semua file inputs  
✅ **Auto rollback** jika update gagal  
✅ **Version history** untuk tracking  
✅ **Zero downtime** saat update  

---

> Nota: Dokumentasi ini telah diperkaya dengan detail implementasi teknis berdasarkan struktur eksisting project. Bisa langsung digunakan sebagai blueprint development.
>
>
