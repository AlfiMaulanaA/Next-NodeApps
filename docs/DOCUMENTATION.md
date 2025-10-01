# CONFIG_SYSTEM_DEVICE - Complete Documentation

## Overview
This documentation covers all functions and services in the CONFIG_SYSTEM_DEVICE middleware directory. Each service handles specific aspects of the IoT system including device configuration, automation, API endpoints, and data management.

---

## 1. ApiInfo.py - Device Information API Service

### Purpose
Provides REST API endpoints for device information, network scanning, and MQTT configuration management.

### **API Endpoints:**

#### **GET /api/info**
- **Description**: Get device information and system status
- **Response Format**:
```json
{
  "uptime_s": 60408,
  "build": "Built on Jan 23 2025 14:30:15 version main_c7f8b6c69dc0",
  "ip": "192.168.1.100",
  "mac": "aa:bb:cc:dd:ee:ff",
  "flags": "",
  "mqtthost": "broker.hivemq.com:1883",
  "chipset": "BK7231N",
  "manufacture": "GSPE IOT",
  "webapp": "https://www.gspe.co.id/",
  "shortName": "user",
  "startcmd": "",
  "supportsSSDP": 0,
  "supportsClientDeviceDB": true
}
```

#### **GET /api/scan**
- **Description**: Scan network for available IoT devices
- **Query Parameters**:
  - `range` (optional): IP range to scan (default: "192.168.0")
- **Response Format**:
```json
[
  {
    "uptime_s": 3600,
    "build": "Built on Jan 20 2025",
    "ip": "192.168.0.101",
    "mac": "11:22:33:44:55:66",
    "flags": "",
    "mqtthost": "localhost:1883",
    "chipset": "ESP32",
    "manufacture": "GSPE IOT",
    "webapp": "https://device.local",
    "shortName": "device1"
  }
]
```

#### **GET /api/ips**
- **Description**: Get current device IP addresses
- **Response Format**:
```json
{
  "wlan_ip": "192.168.1.100",
  "eth_ip": "192.168.0.50",
  "local_ip": "127.0.0.1"
}
```

#### **POST /api/update_mqtt_config**
- **Description**: Update MQTT broker configuration
- **Request Body**:
```json
{
  "broker_address": "new.broker.com",
  "broker_port": 1883,
  "username": "user",
  "password": "pass"
}
```
- **Response**:
```json
{
  "status": "success",
  "message": "MQTT configuration updated successfully."
}
```

### **MQTT Topics:**
- **Error Logging**: `subrack/error/log`
  - **Payload Format**:
  ```json
  {
    "data": "Error message",
    "type": "ERROR_TYPE",
    "Timestamp": "2025-01-23 14:30:15"
  }
  ```

---

## 2. ApiScan.py - Network Scanning Service

### Purpose
Dedicated service for network device discovery and scanning operations.

### **API Endpoints:**

#### **GET /api/scan**
- **Description**: Advanced network scanning with device validation
- **Query Parameters**:
  - `range`: IP range (e.g., "192.168.1")
- **Response**: Array of discovered devices with validation
- **Features**:
  - Multi-threaded scanning (20 threads)
  - Device validation
  - 2-second timeout per device

#### **GET /api/ips**
- **Description**: Get network interface IP addresses
- **Response**: Current device network configuration

---

## 3. AutoRestart.py - Service Auto-Restart Manager

### Purpose
Automatically restarts the main Multiprocesing.service every 6 hours to ensure system stability.

### **Features:**
- **Restart Interval**: 6 hours
- **Service Monitored**: `Multiprocesing.service`
- **Max Retry Attempts**: 3
- **Logging**: `/var/log/auto_restart.log`

### **Service Management:**
```bash
# Install as systemd service
python3 AutoRestart.py install

# Manual commands
sudo systemctl start auto-restart.service
sudo systemctl enable auto-restart.service
```

### **Configuration:**
```python
SERVICE_NAME = "Multiprocesing.service"
RESTART_INTERVAL_HOURS = 6
MAX_RESTART_ATTEMPTS = 3
```

---

## 4. AutomationLogic.py - Logic-Based Automation Service

### Purpose
Handles conditional automation based on device sensor values and logical conditions.

### **MQTT Topics:**

#### **CRUD Operations:**
- **Create**: `automation_logic/create`
- **Read**: `automation_logic/read`
- **Update**: `automation_logic/update`
- **Delete**: `automation_logic/delete`
- **Data**: `automation_logic/data`
- **Get**: `automation_logic/get`

#### **Response Topics:**
- **Response**: `response_automation_logic`
- **Get Data Response**: `response_get_data`

#### **Logic Rule Payload:**
```json
{
  "id": "logic_rule_001",
  "name": "Temperature Control",
  "enabled": true,
  "conditions": [
    {
      "device": "TEMP_SENSOR",
      "parameter": "temperature",
      "operator": ">=",
      "value": 30,
      "data_type": "float"
    }
  ],
  "logical_operator": "AND|OR",
  "actions": [
    {
      "device": "FAN_RELAY",
      "pin": 1,
      "action": "on",
      "delay": 0
    }
  ],
  "created_at": "2025-01-23T14:30:15.000Z"
}
```

#### **Supported Operators:**
- `>`, `<`, `>=`, `<=`, `==`, `!=`
- Logical: `AND`, `OR`

---

## 5. AutomationSchedule.py - Time-Based Automation Service

### Purpose
Handles time-based automation scheduling using cron-like scheduling.

### **MQTT Topics:**

#### **CRUD Operations:**
- **Create**: `automation_schedule/create`
- **Update**: `automation_schedule/update`
- **Delete**: `automation_schedule/delete`
- **Data**: `automation_schedule/data`

#### **Schedule Rule Payload:**
```json
{
  "id": "schedule_001",
  "name": "Daily Light Control",
  "enabled": true,
  "schedule_type": "daily|weekly|once",
  "time": "18:30",
  "days": ["monday", "tuesday", "wednesday"],
  "date": "2025-01-25",
  "actions": [
    {
      "device": "LIGHT_RELAY",
      "pin": 1,
      "action": "on",
      "delay": 0
    }
  ],
  "created_at": "2025-01-23T14:30:15.000Z"
}
```

#### **Schedule Types:**
- **daily**: Runs every day at specified time
- **weekly**: Runs on specified days of week
- **once**: Runs once on specified date and time

---

## 6. DeviceConfig.py - Device Configuration Management

### Purpose
Central device configuration management for both MODBUS and I2C devices.

### **MQTT Topics:**

#### **Device Commands:**
- **MODBUS Command**: `command_device_modbus`
- **MODBUS Response**: `response_device_modbus`
- **I2C Command**: `command_device_i2c`
- **I2C Response**: `response_device_i2c`

#### **Service Management:**
- **Restart Command**: `command_service_restart`
- **Restart Response**: `response_service_restart`

#### **Device Scanning:**
- **I2C Scan Command**: `command/i2c_scan`
- **I2C Scan Response**: `response/i2c_scan`

#### **Device Selection:**
- **MODBUS Selection**: `command_device_selection`
- **I2C Selection**: `command_i2c_device_selection`

#### **Available Devices:**
- **MODULAR Devices**: `MODULAR_DEVICE/AVAILABLES`
- **MODBUS Devices**: `MODBUS_DEVICE/AVAILABLES`

#### **Device Installation Payload:**
```json
{
  "action": "install|uninstall|configure",
  "device_type": "modbus|i2c",
  "device_info": {
    "name": "RELAY_8CH",
    "address": 8,
    "bus": 0,
    "profile": {
      "manufacturer": "GSPE",
      "model": "REL8",
      "pins": 8
    }
  }
}
```

#### **Ping Request/Response:**
- **Request Topic**: `request/ping`
- **Response Topic**: `response/ping`
- **Payload**:
```json
{
  "target": "192.168.1.100",
  "count": 4,
  "timestamp": "2025-01-23T14:30:15.000Z"
}
```

---

## 7. PayloadStatic.py - Static Data Publishing Service

### Purpose
Manages static payload publishing with configurable topics and data.

### **MQTT Topics:**

#### **Command Topic**: `command/data/payload`
**CRUD Operations:**
- **CREATE**: Add new static payload
- **READ**: Get all static payloads
- **UPDATE**: Update existing payload
- **DELETE**: Remove payload

#### **Payload Configuration:**
```json
{
  "id": "static_001",
  "topic": "sensor/temperature/static",
  "data": {
    "temperature": 25.5,
    "humidity": 60,
    "location": "Office"
  },
  "interval": 30,
  "lwt": true,
  "enabled": true
}
```

#### **Features:**
- **Last Will Testament (LWT)**: Automatic offline status
- **Periodic Publishing**: Configurable intervals
- **Online Status**: Automatic online/offline indication

---

## 8. PayloadDynamic.py - Dynamic Data Publishing Service

### Purpose
Manages dynamic payload publishing with calculated and variable data.

### **MQTT Topics:**

#### **Command Topic**: `command/data/payload/dynamic`

#### **Dynamic Payload Configuration:**
```json
{
  "id": "dynamic_001",
  "topic": "sensor/calculated/power",
  "formula": "voltage * current",
  "variables": {
    "voltage": {
      "source": "sensor/voltage",
      "default": 220
    },
    "current": {
      "source": "sensor/current", 
      "default": 1.0
    }
  },
  "interval": 10,
  "enabled": true
}
```

---

## 10. automationVoice.py - Voice Command Automation

### Purpose
Voice-activated device control and automation.

### **MQTT Topics:**
- **Voice Command**: `voice/command`
- **Voice Response**: `voice/response`
- **Voice Config**: `automation_voice/config`

#### **Voice Command Payload:**
```json
{
  "command": "turn on lights",
  "confidence": 0.95,
  "user_id": "user123",
  "timestamp": "2025-01-23T14:30:15.000Z"
}
```

#### **Voice Configuration:**
```json
{
  "id": "voice_001",
  "trigger_phrase": "turn on lights",
  "actions": [
    {
      "device": "LIGHT_RELAY",
      "pin": 1,
      "action": "on"
    }
  ],
  "enabled": true
}
```

---

## 12. Button.py & RealButton.py - Physical Button Control

### Purpose
Physical button input handling and GPIO control.

### **MQTT Topics:**
- **Button Press**: `button/press`
- **Button Config**: `button/config`

#### **Button Event Payload:**
```json
{
  "button_id": "btn_001",
  "pin": 12,
  "state": "pressed|released",
  "duration": 150,
  "timestamp": "2025-01-23T14:30:15.000Z"
}
```

---

## 13. ErrorLog.py - Centralized Error Logging

### Purpose
Centralized error logging and monitoring system.

### **MQTT Topics:**
- **Error Log**: `subrack/error/log`

#### **Error Log Payload:**
```json
{
  "data": "Connection failed to device at 192.168.1.100",
  "type": "CRITICAL|MAJOR|MINOR|WARNING",
  "source": "DeviceConfig.py",
  "timestamp": "2025-01-23T14:30:15.000Z",
  "details": {
    "error_code": "CONN_001",
    "retry_count": 3,
    "last_success": "2025-01-23T14:25:10.000Z"
  }
}
```

---

## 14. LibraryConfig.py - Device Library Management

### Purpose
Manages device libraries and configurations for MODBUS and I2C devices.

### **Functions:**
- Device library loading
- Configuration validation  
- Device profile management
- Capability detection

---

## 15. Network.py - Network Management

### Purpose
Network configuration, monitoring, and connectivity management.

### **Features:**
- Network interface management
- IP configuration
- Connectivity monitoring
- Network diagnostics

---

## 16. Settings.py - System Settings Management

### Purpose
System-wide configuration and settings management.

### **Configuration Categories:**
- MQTT broker settings
- Device configurations
- Service parameters
- Security settings
- Logging preferences

---

## Error Handling & Logging

### **Error Types:**
- **CRITICAL**: System-breaking errors requiring immediate attention
- **MAJOR**: Significant errors affecting functionality
- **MINOR**: Minor issues that don't affect core functionality  
- **WARNING**: Potential issues or important notices

### **Error Logging Format:**
All services use standardized error logging to `subrack/error/log` topic with timestamp and classification.

---

## Service Dependencies

### **Required Files:**
- `../MODULAR_I2C/JSON/Config/mqtt_config.json`
- `../MODULAR_I2C/JSON/Config/installed_devices.json`
- `../MODBUS_SNMP/JSON/Config/installed_devices.json`
- `./JSON/*.json` (service-specific configurations)

### **Network Requirements:**
- MQTT Broker (localhost:1883 for local operations)
- External MQTT Broker (configurable for data publishing)
- Network connectivity for device scanning

### **System Requirements:**
- Python 3.7+
- Required packages: `paho-mqtt`, `schedule`, `netifaces`, `requests`
- Systemd (for service management)
- sudo access (for service restart operations)

---

## Quick Start Guide

1. **Install Dependencies:**
```bash
pip install -r requirements.txt
```

2. **Configure MQTT:**
   - Update `mqtt_config.json` with broker details
   - Ensure localhost MQTT broker is running

3. **Start Services:**
```bash
python3 Multiprocesing.py  # Main service coordinator
```

4. **Monitor Logs:**
```bash
tail -f /var/log/auto_restart.log
```

This documentation provides comprehensive coverage of all CONFIG_SYSTEM_DEVICE services, their MQTT topics, payload formats, and operational details for IoT system integration.