# 🎤 Voice Control System - Next-NodeApps

Sistem kontrol relay berbasis suara yang terintegrasi dengan Next-NodeApps. Mendukung kontrol perangkat relay melalui perintah suara dalam bahasa Indonesia dan Inggris.

## ✨ Fitur Utama

- 🎙️ **Voice Recognition** - Speech-to-text dengan Google API
- 🌐 **Web Interface** - UI modern dengan Next.js dan React
- 🔄 **Real-time MQTT** - Komunikasi real-time antar komponen
- 📱 **Device Management** - Auto-discovery dan monitoring device
- 🎯 **Multi-language** - Support Indonesian & English commands
- 📊 **Live Monitoring** - Real-time status dan hasil recognition
- 🔧 **Template Integration** - Integration dengan BrokerTemplateManager

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- MQTT Broker (Mosquitto recommended)
- Speech Recognition library (optional, fallback ke demo mode)

### Installation

```bash
# Install Python dependencies (optional)
pip install paho-mqtt speechrecognition

# Install Node.js dependencies
npm install
```

### Jalankan Sistem Lengkap

```bash
# 1. Jalankan MQTT Broker (dalam terminal terpisah)
mosquitto -c ../mosquitto.conf

# 2. Jalankan Voice Control System (gunakan conda Python untuk microphone access)
cd middleware/CONFIG_SYSTEM_DEVICE
/Users/ikhsalabing/miniconda3/bin/python3 run_voice_control.py

# 3. Jalankan Frontend (dalam terminal terpisah)
npm run dev
```

> **⚠️ PENTING:** Gunakan conda Python (`/Users/ikhsalabing/miniconda3/bin/python3`) untuk microphone access. Jika menggunakan `python3` biasa, sistem akan fallback ke demo mode.

### Akses Aplikasi

Buka browser dan akses: `http://localhost:3000/control/voice`

## 🎯 Voice Commands

### Bahasa Indonesia
- "nyalakan lampu utama" - Menyalakan lampu utama
- "matikan lampu tamu" - Mematikan lampu tamu
- "hidupkan kipas angin" - Menyalakan kipas angin
- "padamkan lampu dapur" - Mematikan lampu dapur
- "nyalakan ac ruangan" - Menyalakan AC

### English
- "turn on main light" - Turn on main light
- "turn off guest light" - Turn off guest light
- "switch on fan" - Turn on fan
- "switch off kitchen light" - Turn off kitchen light

## 🏗️ Arsitektur Sistem

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │────│   Next.js App   │────│   MQTT Broker   │
│                 │    │   (Frontend)    │    │                 │
│ • Voice Control │    │ • React UI      │    │ • Real-time     │
│ • Live Results  │    │ • MQTT Client   │    │ • Commands      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ VoiceControl    │────│ VoiceControl    │────│ VoiceControl    │
│ Service (CRUD)  │    │ Service (Voice) │    │ Mock (Devices)  │
│                 │    │                 │    │                 │
│ • MQTT CRUD     │    │ • Speech Recog  │    │ • Mock Devices  │
│ • Config Mgmt   │    │ • Command Proc  │    │ • Heartbeat     │
│ • Device Status │    │ • Relay Control │    │ • Status Updates│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Relay Devices │
                       │   (Physical)    │
                       └─────────────────┘
```

## 📁 Struktur File

```
middleware/CONFIG_SYSTEM_DEVICE/
├── VoiceControlService.py      # Main backend service
├── voiceControlMock.py         # Mock data publisher
├── run_voice_control.py        # System launcher
├── JSON/
│   ├── voiceControlConfig.json # Voice commands config
│   └── availableDevicesMock.json # Mock device data
└── VOICE_CONTROL_README.md     # This file

app/control/voice/
├── page.tsx                    # Main UI page
├── types/
│   └── voice.ts                # TypeScript interfaces
└── components/                 # React components
```

## 🔧 Konfigurasi

### Environment Variables

```bash
# MQTT Configuration
MQTT_BROKER=localhost
MQTT_PORT=1883

# Voice Recognition (Optional)
SPEECH_RECOGNITION=true  # false untuk demo mode
```

### Voice Commands Configuration

Edit file `JSON/voiceControlConfig.json`:

```json
[
  {
    "id": "uuid-string",
    "device_name": "RelayMini1",
    "part_number": "RELAYMINI",
    "pin": 3,
    "address": 37,
    "device_bus": 0,
    "mac": "70:f7:54:cb:7a:93",
    "voice_commands": ["nyalakan", "hidupkan", "turn on"],
    "object_name": "lampu utama",
    "description": "Lampu utama ruangan",
    "template_id": "default_local",
    "broker_config": {
      "template_id": "default_local",
      "overrides": {}
    },
    "status": "online",
    "created_at": "2025-10-08T11:00:00Z",
    "updated_at": "2025-10-08T11:00:00Z"
  }
]
```

## 🎯 MQTT Topics

### Command Topics (Frontend → Backend)
- `command/control/voice/create` - Create voice command
- `command/control/voice/read` - Read voice commands
- `command/control/voice/update` - Update voice command
- `command/control/voice/delete` - Delete voice command
- `command/control/voice/start` - Start voice recognition
- `command/control/voice/stop` - Stop voice recognition
- `command/control/voice/test` - Test voice command

### Response Topics (Backend → Frontend)
- `response/control/voice/result` - CRUD operation results
- `response/control/voice/status` - Voice recognition status
- `response/control/voice/voice_result` - Voice command results

### Device Topics
- `MODULAR_DEVICE/AVAILABLES` - Available devices list
- `device/heartbeat/{mac}` - Device heartbeat
- `device/status/{mac}` - Device status updates

## 🚀 Deployment

### Development Mode

```bash
# Terminal 1: MQTT Broker
mosquitto -c ../mosquitto.conf

# Terminal 2: Voice Control Backend
cd middleware/CONFIG_SYSTEM_DEVICE
python3 run_voice_control.py

# Terminal 3: Frontend
npm run dev
```

### Production Mode

```bash
# Build frontend
npm run build

# Start production server
npm start

# Run backend services
cd middleware/CONFIG_SYSTEM_DEVICE
python3 run_voice_control.py
```

## 📊 Monitoring & Testing

### Test Voice Commands

1. Buka `http://localhost:3000/control/voice`
2. Klik "Test" button
3. Masukkan command seperti "nyalakan lampu utama"
4. Klik "Test Command"

### Monitor Real-time Results

- **Voice Control Status Card** - Shows active/inactive status
- **Last Voice Recognition Card** - Shows latest recognition results
- **Statistics Cards** - Overview of commands and devices

### Backend Logs

```bash
# Voice Control Service logs
tail -f logs/voice_control_*.log

# MQTT Broker logs
tail -f /var/log/mosquitto/mosquitto.log
```

## 🔧 Troubleshooting

### Common Issues

#### 1. MQTT Connection Failed
```bash
# Check if MQTT broker is running
ps aux | grep mosquitto

# Start MQTT broker
mosquitto -c ../mosquitto.conf
```

#### 2. Speech Recognition Not Working
```bash
# Install speech recognition (optional)
pip install speechrecognition

# System will automatically fallback to demo mode
```

#### 3. Frontend Not Loading
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
npm install

# Restart development server
npm run dev
```

#### 4. Voice Commands Not Recognized
- Check device status in UI (should be "online")
- Verify voice command configuration
- Test with "Test Command" feature
- Check backend logs for errors

## 🎯 Voice Recognition Details

### Supported Languages
- **Indonesian (id-ID)** - Primary language
- **English (en-US)** - Secondary language

### Command Processing Flow
1. **Speech Recognition** - Convert audio to text
2. **Action Analysis** - Identify action (on/off/toggle)
3. **Object Extraction** - Extract device name
4. **Configuration Lookup** - Find matching voice command
5. **Relay Control** - Execute device control via MQTT

### Demo Mode
Jika speech recognition tidak tersedia, sistem akan berjalan dalam demo mode:
- ✅ All UI features work
- ✅ Command testing works
- ✅ Device management works
- ❌ Real speech recognition disabled
- ℹ️ Shows status messages instead

## 🤝 API Reference

### Voice Control Service Methods

#### CRUD Operations
- `create_voice_command(data)` - Create new voice command
- `read_voice_commands(filters)` - Read voice commands
- `update_voice_command(id, data)` - Update voice command
- `delete_voice_command(id)` - Delete voice command

#### Voice Operations
- `start_voice_control()` - Start speech recognition
- `stop_voice_control()` - Stop speech recognition
- `test_voice_command(text)` - Test voice command processing

#### Device Management
- `get_device_info(name)` - Get device information
- `update_device_status(mac, status)` - Update device status

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Google Speech Recognition API
- Paho MQTT Python Client
- Next.js & React Framework
- Tailwind CSS

## 📞 Support

Untuk bantuan atau pertanyaan:
- Check backend logs: `tail -f logs/voice_control_*.log`
- Check MQTT logs: `tail -f /var/log/mosquitto/mosquitto.log`
- Test with "Test Command" feature in UI
- Verify device status and configuration

---

**🎤 Voice Control System - Ready for Production! 🚀**
