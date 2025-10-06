# Payload Command Processor Service

Layanan pemrosesan payload canggih yang menangani payload berbasis perintah dengan manajemen konfigurasi tersimpan dalam format JSON.

## 🎯 Fitur Utama

- **Command-Based Processing**: Mendukung perintah `get`, `create`, `update`, `delete`
- **JSON Configuration Storage**: Konfigurasi disimpan di `./JSON/payloadStaticConfig.json`
- **Thread-Safe Operations**: Operasi aman untuk multi-threading
- **Automatic Backups**: Sistem backup otomatis dengan rotasi
- **Performance Monitoring**: Monitoring performa real-time
- **Comprehensive Logging**: Logging lengkap untuk debugging dan audit
- **Health Checks**: Sistem health check untuk monitoring
- **Data Validation**: Validasi ketat untuk semua input
- **Error Handling**: Penanganan error yang komprehensif

## 📋 Supported Commands

### 1. GET Command
Mengambil konfigurasi payload yang ada.

**Format:**
```json
{
  "command": "get",
  "id": "optional_config_id",
  "topic": "optional_topic_name"
}
```

**Examples:**
```json
// Get all configurations
{"command": "get"}

// Get by ID
{"command": "get", "id": "abc123"}

// Get by topic
{"command": "get", "topic": "sensor/temperature/001"}
```

### 2. CREATE Command
Membuat konfigurasi payload baru.

**Format:**
```json
{
  "command": "create",
  "data": {
    "topic": "mqtt/topic/name",
    "data": {"key": "value"},
    "interval": 10,
    "qos": 0,
    "lwt": true,
    "retain": false
  }
}
```

**Example:**
```json
{
  "command": "create",
  "data": {
    "topic": "home/sensor/001",
    "data": {
      "temperature": 25.5,
      "humidity": 60,
      "device_id": "sensor_001"
    },
    "interval": 30,
    "qos": 1,
    "lwt": true,
    "retain": false
  }
}
```

### 3. UPDATE Command
Mengupdate konfigurasi payload yang ada.

**Format:**
```json
{
  "command": "update",
  "id": "config_id_or_topic",
  "topic": "topic_name",
  "data": {
    "data": {"new_key": "new_value"},
    "interval": 15,
    "qos": 1
  }
}
```

**Example:**
```json
{
  "command": "update",
  "topic": "home/sensor/001",
  "data": {
    "data": {
      "temperature": 28.3,
      "humidity": 65,
      "pressure": 1013
    },
    "interval": 60
  }
}
```

### 4. DELETE Command
Menghapus konfigurasi payload.

**Format:**
```json
{
  "command": "delete",
  "id": "config_id_or_topic",
  "topic": "topic_name"
}
```

**Example:**
```json
{"command": "delete", "topic": "home/sensor/001"}
```

## 🏗️ Arsitektur Sistem

### Core Components

1. **PayloadCommandProcessor**: Kelas utama processor
2. **ConfigurationManager**: Manajer file konfigurasi thread-safe
3. **Command Validators**: Validasi input dan format
4. **Error Handlers**: Penanganan error yang komprehensif
5. **Performance Monitors**: Monitoring statistik

### Data Structures

#### PayloadConfig
```python
@dataclass
class PayloadConfig:
    id: str                    # Unique identifier
    topic: str                 # MQTT topic
    data: Dict[str, Any]       # Payload data
    interval: int = 10         # Publish interval (seconds)
    qos: int = 0              # MQTT QoS level
    lwt: bool = True          # Last Will and Testament
    retain: bool = False      # MQTT retain flag
    created_at: str = ""      # Creation timestamp
    updated_at: str = ""      # Last update timestamp
    version: int = 1          # Configuration version
```

#### CommandResult
```python
@dataclass
class CommandResult:
    success: bool
    command: str
    message: str
    data: Optional[Any] = None
    error_code: Optional[str] = None
    execution_time: float = 0.0
    timestamp: str = ""
```

## 🚀 Instalasi & Setup

### Prerequisites
- Python 3.7+
- Tidak ada dependencies external (hanya built-in modules)

### Setup
```bash
cd middleware/CONFIG_SYSTEM_DEVICE
# Service akan otomatis membuat direktori yang diperlukan
```

### File Structure
```
middleware/CONFIG_SYSTEM_DEVICE/
├── PayloadCommandProcessor.py    # Main service
├── JSON/
│   └── payloadStaticConfig.json  # Configuration storage
├── logs/
│   └── payload_processor.log     # Application logs
└── backups/                      # Automatic backups
    └── payloadStaticConfig_YYYYMMDD_HHMMSS.json
```

## 📖 Usage Examples

### Basic Usage
```python
from PayloadCommandProcessor import PayloadCommandProcessor

# Initialize processor
processor = PayloadCommandProcessor()

# Process commands
commands = [
    {"command": "get"},
    {
        "command": "create",
        "data": {
            "topic": "test/sensor",
            "data": {"value": 42}
        }
    }
]

for cmd in commands:
    result = processor.process_command(cmd)
    print(f"Command: {result.command}")
    print(f"Success: {result.success}")
    print(f"Message: {result.message}")
    if result.data:
        print(f"Data: {result.data}")
```

### Advanced Usage dengan MQTT Integration
```python
import paho.mqtt.client as mqtt
from PayloadCommandProcessor import PayloadCommandProcessor

processor = PayloadCommandProcessor()

def on_mqtt_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        result = processor.process_command(payload)

        # Publish result back
        response_topic = f"response/{msg.topic.replace('command/', '')}"
        client.publish(response_topic, json.dumps(result.to_dict()))

    except Exception as e:
        print(f"Error processing MQTT message: {e}")

# MQTT setup...
```

## 📊 Monitoring & Statistics

### Performance Statistics
```python
stats = processor.get_stats()
print(f"Processed: {stats['processed']}")
print(f"Successful: {stats['successful']}")
print(f"Failed: {stats['failed']}")
print(f"Avg Execution Time: {stats['avg_execution_time']:.4f}s")
```

### Health Check
```python
health = processor.health_check()
print(f"Status: {health['status']}")
print(f"Config Count: {health['config_count']}")
print(f"Backup Available: {health['last_backup'] is not None}")
```

## 🔧 Configuration

### Environment Variables
```bash
export PAYLOAD_CONFIG_PATH="./JSON/payloadStaticConfig.json"
export PAYLOAD_LOG_PATH="./logs/payload_processor.log"
export PAYLOAD_BACKUP_DIR="./backups"
```

### Runtime Configuration
```python
# Custom configuration paths
processor = PayloadCommandProcessor()
processor.config_manager.file_path = "/custom/path/config.json"
processor.logger.handlers[0].baseFilename = "/custom/path/log.log"
```

## 🛡️ Error Handling

### Error Codes
- `INVALID_COMMAND`: Perintah tidak valid
- `MISSING_DATA`: Data diperlukan tapi tidak ada
- `MISSING_IDENTIFIER`: ID atau topic diperlukan
- `NOT_FOUND`: Konfigurasi tidak ditemukan
- `DUPLICATE_TOPIC`: Topic sudah ada
- `SAVE_FAILED`: Gagal menyimpan konfigurasi
- `DELETE_FAILED`: Gagal menghapus konfigurasi
- `INTERNAL_ERROR`: Error internal sistem

### Exception Handling
```python
try:
    result = processor.process_command(command)
    if not result.success:
        print(f"Error: {result.error_code} - {result.message}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## 🧪 Testing

### Run Built-in Tests
```bash
cd middleware/CONFIG_SYSTEM_DEVICE
python3 PayloadCommandProcessor.py
```

### Manual Testing
```python
# Test individual commands
processor = PayloadCommandProcessor()

# Test CREATE
create_cmd = {
    "command": "create",
    "data": {
        "topic": "test/topic",
        "data": {"test": "data"}
    }
}
result = processor.process_command(create_cmd)
assert result.success == True

# Test GET
get_cmd = {"command": "get", "topic": "test/topic"}
result = processor.process_command(get_cmd)
assert result.success == True
assert result.data["topic"] == "test/topic"
```

## 📋 API Reference

### PayloadCommandProcessor Methods

#### `process_command(payload: Dict[str, Any]) -> CommandResult`
Memproses payload perintah dan mengembalikan hasil.

#### `get_stats() -> Dict[str, Any]`
Mengembalikan statistik performa.

#### `health_check() -> Dict[str, Any]`
Melakukan health check sistem.

### ConfigurationManager Methods

#### `load_config() -> List[PayloadConfig]`
Memuat semua konfigurasi dari file.

#### `save_config(configs: List[PayloadConfig]) -> bool`
Menyimpan konfigurasi ke file.

#### `get_config_by_id(id: str) -> Optional[PayloadConfig]`
Mendapatkan konfigurasi berdasarkan ID.

#### `get_config_by_topic(topic: str) -> Optional[PayloadConfig]`
Mendapatkan konfigurasi berdasarkan topic.

## 🔄 Backup System

### Automatic Backups
- Backup otomatis sebelum setiap penyimpanan
- Rotasi backup (maksimal 5 backup terakhir)
- Format: `payloadStaticConfig_YYYYMMDD_HHMMSS.json`

### Manual Backup
```python
# Force backup
processor.config_manager._create_backup()
```

## 📝 Logging

### Log Levels
- `INFO`: Operasi normal dan hasil command
- `WARNING`: Peringatan non-kritis
- `ERROR`: Error dalam pemrosesan

### Log Format
```
2025-09-29 16:23:42,649 - PayloadCommandProcessor - INFO - Processing command: create
```

### Custom Logging
```python
import logging
processor.logger.setLevel(logging.DEBUG)
```

## 🚀 Production Deployment

### Best Practices
1. **Monitoring**: Monitor statistik performa secara berkala
2. **Backup**: Pastikan backup directory dapat diakses
3. **Logging**: Konfigurasi log rotation untuk file besar
4. **Security**: Validasi input dari sumber eksternal
5. **Performance**: Monitor execution time untuk bottleneck

### Docker Deployment
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY PayloadCommandProcessor.py .

CMD ["python3", "PayloadCommandProcessor.py"]
```

### Systemd Service
```ini
[Unit]
Description=Payload Command Processor
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/payload-processor
ExecStart=/usr/bin/python3 PayloadCommandProcessor.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## 🤝 Contributing

### Code Standards
- Gunakan type hints untuk semua function parameters
- Implementasi comprehensive error handling
- Tulis docstrings untuk semua public methods
- Ikuti PEP 8 style guidelines

### Testing Guidelines
- Test semua command types
- Test error conditions
- Test concurrent operations
- Validate JSON serialization/deserialization

## 📄 License

This project is part of the Next-NodeApps system.

## 🆘 Troubleshooting

### Common Issues

1. **File Permission Errors**
   ```
   Solution: Ensure write permissions on JSON/, logs/, backups/ directories
   ```

2. **Memory Issues**
   ```
   Solution: Monitor execution_times list size, implement cleanup if needed
   ```

3. **JSON Decode Errors**
   ```
   Solution: Validate JSON format before processing
   ```

### Debug Mode
```python
import logging
logging.basicConfig(level=logging.DEBUG)
processor = PayloadCommandProcessor()
```

---

**Version**: 2.0
**Last Updated**: 2025-09-29
**Compatibility**: Python 3.7+
