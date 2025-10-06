# 🚀 MQTT X Configurations untuk Testing Sistem

Konfigurasi lengkap MQTT X untuk testing semua komponen sistem MQTT Static Payload Publisher.

## 📋 **Prerequisites**

### 1. **Install MQTT Broker**
```bash
# Install Mosquitto (macOS dengan Homebrew)
brew install mosquitto

# Start broker
brew services start mosquitto

# Atau jalankan manual
mosquitto -c /opt/homebrew/etc/mosquitto/mosquitto.conf
```

### 2. **Install MQTT X**
- Download dari: https://mqttx.app/
- Install dan buka aplikasi

### 3. **Start Sistem Services**
```bash
cd middleware/CONFIG_SYSTEM_DEVICE

# Terminal 1: Start MQTT Static Publisher
python3 MQTTStaticPublisher.py

# Terminal 2: Start Payload Static CRUD Service (optional)
python3 PayloadStatic.py
```

---

## 🔧 **MQTT X CONNECTION CONFIGURATIONS**

### **Connection 1: Localhost Broker (Default)**
```
Name: Local MQTT Broker
Host: localhost
Port: 1883
Client ID: mqttx_test_client
Username: (empty)
Password: (empty)
SSL/TLS: Disabled
```

### **Connection 2: Localhost dengan Authentication**
```
Name: Local MQTT Broker (Auth)
Host: localhost
Port: 1883
Client ID: mqttx_auth_client
Username: testuser
Password: testpass123
SSL/TLS: Disabled
```

### **Connection 3: Remote Broker (Example)**
```
Name: Remote MQTT Broker
Host: broker.emqx.io
Port: 1883
Client ID: mqttx_remote_client
Username: (empty)
Password: (empty)
SSL/TLS: Disabled
```

---

## 📡 **SUBSCRIPTION CONFIGURATIONS**

### **Subscribe ke Semua Response Topics**
Buat subscriptions berikut di MQTT X:

```
Topic: response/data/#
QoS: 0
Color: #4CAF50 (Green)
```

### **Subscribe ke Publishing Topics**
```
Topic: home/sensor/#
QoS: 1
Color: #2196F3 (Blue)
```

```
Topic: home/device/#
QoS: 1
Color: #FF9800 (Orange)
```

```
Topic: home/energy/#
QoS: 1
Color: #9C27B0 (Purple)
```

---

## 📤 **PUBLISH CONFIGURATIONS**

### **1. CRUD Operations via MQTT**

#### **Create New Configuration**
```
Topic: command/data/payload
QoS: 1
Retain: false
Payload:
{
  "command": "writeData",
  "data": {
    "topic": "test/mqttx/sensor",
    "data": {
      "sensor_id": "MQTTX_TEST",
      "temperature": 25.5,
      "humidity": 65,
      "status": "online"
    }
  },
  "interval": 30,
  "qos": 1,
  "lwt": true,
  "retain": false
}
```

#### **Read All Configurations**
```
Topic: command/data/payload
QoS: 1
Retain: false
Payload:
{
  "command": "getData"
}
```

#### **Read Specific Configuration**
```
Topic: command/data/payload
QoS: 1
Retain: false
Payload:
{
  "command": "getData",
  "topic": "test/mqttx/sensor"
}
```

#### **Update Configuration**
```
Topic: command/data/payload
QoS: 1
Retain: false
Payload:
{
  "command": "updateData",
  "topic": "test/mqttx/sensor",
  "data": [
    {"key": "temperature", "value": 28.3},
    {"key": "humidity", "value": 70},
    {"key": "status", "value": "updated_via_mqttx"}
  ]
}
```

#### **Delete Configuration**
```
Topic: command/data/payload
QoS: 1
Retain: false
Payload:
{
  "command": "deleteData",
  "topic": "test/mqttx/sensor"
}
```

### **2. Metrics Request**
```
Topic: command/data/metrics
QoS: 1
Retain: false
Payload: {}
```

---

## 🎯 **TESTING SCENARIOS**

### **Scenario 1: Basic CRUD Testing**

1. **Subscribe** ke `response/data/#`
2. **Publish** Create command
3. **Verify** response di `response/data/write`
4. **Publish** Read command
5. **Verify** response di `response/data/payload`
6. **Publish** Update command
7. **Verify** response di `response/data/update`
8. **Publish** Delete command
9. **Verify** response di `response/data/delete`

### **Scenario 2: Static Publishing Testing**

1. **Subscribe** ke `home/sensor/#`
2. **Start** `MQTTStaticPublisher.py`
3. **Observe** automatic publishing setiap interval
4. **Check** QoS, retain flags
5. **Verify** LWT behavior (disconnect publisher)

### **Scenario 3: Load Testing**

1. **Create** multiple configurations via MQTT commands
2. **Monitor** publishing frequency
3. **Check** system performance
4. **Test** concurrent operations

---

## 🔄 **ADVANCED MQTT X FEATURES**

### **1. Scripts untuk Automated Testing**

#### **Create Test Script**
```javascript
// MQTT X Script: Create Test Configuration
const payload = {
  "command": "writeData",
  "data": {
    "topic": "test/script/sensor",
    "data": {
      "sensor_id": "SCRIPT_TEST",
      "temperature": Math.random() * 30 + 10,
      "timestamp": new Date().toISOString()
    }
  },
  "interval": 10,
  "qos": 1,
  "lwt": true,
  "retain": false
}

return JSON.stringify(payload, null, 2)
```

#### **Update Test Script**
```javascript
// MQTT X Script: Update Temperature
const payload = {
  "command": "updateData",
  "topic": "test/script/sensor",
  "data": [
    {"key": "temperature", "value": Math.random() * 30 + 10},
    {"key": "timestamp", "value": new Date().toISOString()}
  ]
}

return JSON.stringify(payload, null, 2)
```

### **2. Timing Scripts**

#### **Scheduled Publishing**
```javascript
// Publish every 30 seconds
setInterval(() => {
  const payload = {
    "command": "getData"
  }
  // MQTT X will publish this automatically
}, 30000)

return JSON.stringify({"command": "getData"})
```

### **3. Response Validation Scripts**

#### **Validate CRUD Response**
```javascript
// MQTT X Response Handler
if (topic === 'response/data/write') {
  const response = JSON.parse(payload)
  if (response.status === 'success') {
    console.log('✅ Configuration created successfully')
  } else {
    console.error('❌ Failed to create configuration:', response.message)
  }
}
```

---

## 📊 **MONITORING & DEBUGGING**

### **1. Connection Monitoring**
- **Ping**: Test connection dengan empty publish
- **QoS Testing**: Test different QoS levels
- **Retain Testing**: Test retain flag behavior

### **2. Performance Monitoring**
```
Topic: command/data/metrics
Payload: {}
```
Monitor system performance statistics.

### **3. Log Monitoring**
```bash
# Monitor application logs
tail -f logs/mqtt_publisher.log
tail -f logs/payload_processor.log
```

---

## 🛠️ **TROUBLESHOOTING**

### **Connection Issues**
```
❌ Connection refused
✅ Check if Mosquitto is running: brew services list
✅ Verify port 1883 is not blocked
✅ Test with: mosquitto_sub -h localhost -t "test"
```

### **No Response from Commands**
```
❌ No response on response/data/*
✅ Check if PayloadStatic.py is running
✅ Verify topic spelling
✅ Check MQTT broker logs
```

### **Publishing Not Working**
```
❌ No messages on subscribed topics
✅ Check if MQTTStaticPublisher.py is running
✅ Verify configuration file exists
✅ Check publisher logs for errors
```

---

## 📋 **COMPLETE TEST CHECKLIST**

### **Pre-Test Setup**
- [ ] Mosquitto broker running
- [ ] MQTTStaticPublisher.py started
- [ ] PayloadStatic.py started (optional)
- [ ] MQTT X connected to localhost:1883

### **MQTT X Configuration**
- [ ] Connection established
- [ ] Subscriptions active: `response/data/#`, `home/sensor/#`
- [ ] Test publish ready

### **CRUD Testing**
- [ ] Create configuration ✅
- [ ] Read all configurations ✅
- [ ] Read specific configuration ✅
- [ ] Update configuration ✅
- [ ] Delete configuration ✅

### **Publishing Testing**
- [ ] Automatic publishing observed ✅
- [ ] Correct intervals maintained ✅
- [ ] QoS levels working ✅
- [ ] LWT functioning ✅

### **Advanced Testing**
- [ ] Concurrent operations ✅
- [ ] Load testing ✅
- [ ] Error scenarios ✅
- [ ] Recovery testing ✅

---

## 🎯 **QUICK START GUIDE**

### **1. One-Click Setup**
```bash
# Start everything
cd middleware/CONFIG_SYSTEM_DEVICE

# Terminal 1: Start broker
brew services start mosquitto

# Terminal 2: Start publisher
python3 MQTTStaticPublisher.py

# Terminal 3: Start CRUD service
python3 PayloadStatic.py
```

### **2. MQTT X Quick Test**
1. **Connect** to `localhost:1883`
2. **Subscribe** to `response/data/#`
3. **Publish** ke `command/data/payload`:
   ```json
   {"command": "getData"}
   ```
4. **Observe** response di subscription

### **3. Verify Static Publishing**
1. **Subscribe** to `home/sensor/#`
2. **Observe** automatic messages setiap 15-60 detik
3. **Check** JSON payload format
4. **Verify** QoS dan retain settings

---

## 📚 **ADDITIONAL RESOURCES**

### **MQTT X Documentation**
- Official Docs: https://mqttx.app/docs
- Scripting Guide: https://mqttx.app/docs/scripting

### **MQTT Protocol Reference**
- MQTT 3.1.1 Specification
- QoS Levels Explanation
- Best Practices Guide

### **System Documentation**
- `README_MQTTStaticPublisher.md`
- `README_PayloadCommandProcessor.md`
- `system_integration_analysis.md`

---

**🚀 Ready to Test!** Konfigurasi MQTT X ini akan memungkinkan Anda testing lengkap semua fitur sistem dengan mudah dan efisien.
