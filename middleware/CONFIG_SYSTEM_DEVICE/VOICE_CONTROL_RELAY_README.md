# 🎤 Voice Control Relay System

Sistem kontrol relay menggunakan perintah suara (Speech-to-Text) untuk Next-NodeApps.

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Konfigurasi](#-konfigurasi)
- [MQTT Topics](#-mqtt-topics)
- [Voice Commands](#-voice-commands)
- [Setup & Installation](#-setup--installation)
- [Testing](#-testing)
- [API Reference](#-api-reference)

## 🎯 Fitur Utama

### ✅ Voice Command Processing
- **Speech Recognition**: Mengubah suara menjadi teks
- **Command Analysis**: Menganalisis perintah on/off dari teks
- **Object Recognition**: Mengenali objek yang akan dikontrol
- **Relay Control**: Mengirim perintah kontrol ke relay

### ✅ Device Management
- **Auto Device Discovery**: Mendeteksi device RELAYMINI dan RELAY
- **Dynamic Configuration**: Konfigurasi perangkat secara dinamis
- **Status Monitoring**: Monitoring status perangkat real-time

### ✅ CRUD Operations
- **Create**: Tambah konfigurasi voice control baru
- **Read**: Baca semua konfigurasi dengan filter
- **Update**: Update konfigurasi existing
- **Delete**: Hapus konfigurasi

## 🏗️ Arsitektur Sistem

```
┌─────────────────┐    MQTT    ┌──────────────────┐
│   Frontend UI   │◄─────────►│ AutomationVoice  │
│   (React/TS)    │            │   MQTT Service   │
└─────────────────┘            └──────────────────┘
                                   │
                                   ▼
┌─────────────────┐    MQTT    ┌──────────────────┐
│ Voice Command   │◄─────────►│  Relay Control   │
│   Processor     │            │   (modular)     │
└─────────────────┘            └──────────────────┘
```

### Komponen Utama:

1. **AutomationVoice.py**: Core service untuk CRUD operations
2. **VoiceCommandProcessor.py**: Processor untuk voice commands
3. **AutomationVoiceMQTT.py**: MQTT handler untuk semua komunikasi
4. **Frontend (React)**: UI untuk management dan control

## ⚙️ Konfigurasi

### File Konfigurasi: `automationVoiceConfig.json`

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "description": "Menyalakan lampu utama ruangan meeting",
    "object_name": "lampu utama ruangan meeting",
    "device_name": "RelayMini1",
    "part_number": "RELAYMINI",
    "pin": 1,
    "address": 37,
    "device_bus": 0,
    "mac": "70:f7:54:cb:7a:93",
    "created_at": "2025-09-30T10:00:00Z",
    "updated_at": "2025-09-30T10:00:00Z"
  }
]
```

### Device Support:

| Device Type | Pins | Description |
|-------------|------|-------------|
| RELAYMINI  | 1-6  | Mini relay dengan 6 pin |
| RELAY      | 1-8  | Standard relay dengan 8 pin |

## 📡 MQTT Topics

### Automation Voice CRUD Topics:
```
command/automation_voice/create
command/automation_voice/read
command/automation_voice/update
command/automation_voice/delete
command/automation_voice/discover
response/automation_voice/result
```

### Voice Command Topics:
```
voice/command/input      # Input voice commands
voice/command/test       # Test voice commands (no control)
voice/command/result     # Voice command results
```

### Device Topics:
```
MODULAR_DEVICE/AVAILABLES    # Available devices list
device/heartbeat/+          # Device heartbeat
device/announce/+           # Device announcements
device/status/+             # Device status updates
```

### Control Topics:
```
modular    # Relay control commands
```

## 🎤 Voice Commands

### Supported Commands:

#### Bahasa Indonesia:
- **Nyalakan/Matikan**: "nyalakan lampu", "matikan kipas"
- **Hidupkan/Padamkan**: "hidupkan ac", "padamkan lampu"
- **Aktifkan/Nonaktifkan**: "aktifkan mesin", "nonaktifkan speaker"

#### English:
- **On/Off**: "turn on light", "turn off fan"
- **Enable/Disable**: "enable device", "disable motor"

### Command Structure:
```
[Action Word] [Object Name]
```

**Examples:**
- ✅ "nyalakan lampu utama ruangan meeting"
- ✅ "matikan kipas angin"
- ✅ "turn on emergency light"
- ✅ "switch off fan"

## 🚀 Setup & Installation

### 1. Start Services

```bash
# Start Automation Voice Service
cd middleware/CONFIG_SYSTEM_DEVICE
python3 run_automation_voice.py

# Or start MQTT handler directly
python3 AutomationVoiceMQTT.py
```

### 2. Publish Device Data

```bash
# Publish available devices
cd middleware/CONFIG_SYSTEM_DEVICE
python3 publish_available_devices.py
```

### 3. Configure Voice Commands

Gunakan frontend UI atau MQTT commands untuk menambah konfigurasi:

```bash
# Create configuration via MQTT
mosquitto_pub -h localhost -t "command/automation_voice/create" -m '{
  "device_name": "RelayMini1",
  "desc": "Control main meeting room light",
  "object_name": "lampu utama ruangan meeting",
  "pin": 1,
  "address": 37,
  "bus": 0,
  "part_number": "RELAYMINI"
}'
```

## 🧪 Testing

### Test Voice Command Processing

```bash
cd middleware/CONFIG_SYSTEM_DEVICE
python3 test_voice_commands.py
```

### Test Automation Voice CRUD

```bash
cd middleware/CONFIG_SYSTEM_DEVICE
python3 test_automation_voice.py
```

### Manual MQTT Testing

```bash
# Test voice command (no actual control)
mosquitto_pub -h localhost -t "voice/command/test" -m '{"text": "nyalakan lampu utama ruangan meeting"}'

# Send actual control command
mosquitto_pub -h localhost -t "voice/command/input" -m '{"text": "nyalakan lampu utama ruangan meeting"}'

# Listen to results
mosquitto_sub -h localhost -t "voice/command/result"
```

## 📚 API Reference

### Voice Command Processor

#### `process_voice_command(voice_text: str) -> Dict`

Memproses voice command dan mengirim control ke relay.

**Parameters:**
- `voice_text`: Raw voice command text

**Returns:**
```json
{
  "success": true,
  "message": "Successfully on lampu utama ruangan meeting",
  "recognized_text": "nyalakan lampu utama ruangan meeting",
  "action": "on",
  "object_name": "lampu utama ruangan meeting",
  "device_name": "RelayMini1",
  "pin": 1,
  "control_payload": {
    "mac": "70:f7:54:cb:7a:93",
    "protocol_type": "Modular",
    "device": "RELAYMINI",
    "function": "write",
    "value": {"pin": 1, "data": 1},
    "address": 37,
    "device_bus": 0,
    "Timestamp": "2025-09-30 15:30:00"
  }
}
```

#### `test_voice_command(voice_text: str) -> Dict`

Test voice command processing tanpa actual control.

### Automation Voice Service

#### CRUD Operations

**Create Configuration:**
```python
automation_voice.create_configuration({
  "device_name": "RelayMini1",
  "desc": "Control light",
  "object_name": "main light",
  "pin": 1,
  "address": 37,
  "bus": 0,
  "part_number": "RELAYMINI"
})
```

**Read Configurations:**
```python
automation_voice.read_configurations()  # All configs
automation_voice.read_configurations({"device_name": "RelayMini1"})  # Filtered
```

**Update Configuration:**
```python
automation_voice.update_configuration(config_id, {
  "desc": "Updated description",
  "pin": 2
})
```

**Delete Configuration:**
```python
automation_voice.delete_configuration(config_id)
```

## 🔧 Troubleshooting

### Common Issues:

1. **Voice command not recognized**
   - Check if object_name exists in configuration
   - Verify voice command format
   - Check MQTT connection

2. **Relay not responding**
   - Verify device configuration (address, bus, pin)
   - Check device connectivity
   - Verify MAC address

3. **MQTT connection issues**
   - Ensure MQTT broker is running on localhost:1883
   - Check network connectivity
   - Verify topic subscriptions

### Debug Commands:

```bash
# Check MQTT broker status
ps aux | grep mosquitto

# Monitor MQTT topics
mosquitto_sub -h localhost -t "voice/command/#"
mosquitto_sub -h localhost -t "command/automation_voice/#"
mosquitto_sub -h localhost -t "response/automation_voice/#"
```

## 📈 Performance & Scalability

- **Concurrent Processing**: Thread-safe operations
- **Memory Efficient**: JSON file-based storage
- **Real-time**: MQTT-based communication
- **Fault Tolerant**: Error handling dan recovery

## 🔒 Security Considerations

- **Input Validation**: All inputs validated
- **Access Control**: MQTT topic-based security
- **Error Logging**: Comprehensive error tracking
- **Data Integrity**: Atomic file operations

## 📝 Changelog

### v1.0.0
- ✅ Initial release
- ✅ Voice command processing
- ✅ Relay control integration
- ✅ CRUD operations
- ✅ Device management
- ✅ Frontend UI integration

---

## 🎯 Next Steps

1. **Speech Recognition Integration**: Integrate dengan speech-to-text APIs
2. **Multi-language Support**: Tambah dukungan bahasa lain
3. **Voice Training**: Machine learning untuk voice recognition
4. **Advanced Commands**: Support untuk complex commands
5. **Group Control**: Control multiple devices simultaneously

---

**🎉 Voice Control Relay System siap digunakan untuk mengontrol relay menggunakan perintah suara!**
