# 🚀 MQTT X - Simple Setup & Testing Guide

Panduan sederhana untuk testing sistem MQTT Static Payload Publisher menggunakan MQTT X.

---

## 📋 **Step-by-Step Setup**

### **Step 1: Install MQTT Broker**
```bash
# Install Mosquitto
brew install mosquitto
```

### **Step 2: Start MQTT Broker (PERBAIKAN AGGREGATEERROR)**
```bash
# ❌ JANGAN gunakan brew services (bisa cause AggregateError)
# brew services start mosquitto

# ✅ Gunakan cara manual untuk menghindari error:
mosquitto -d -p 1883

# Verify broker is running:
ps aux | grep mosquitto
# Should show: mosquitto -d -p 1883
```

### **Step 2: Install MQTT X**
- Download dari: https://mqttx.app/
- Install dan buka aplikasi

### **Step 3: Configure MQTT X Connection**

#### **Buat New Connection:**
```
Name: Local MQTT Broker
Host: localhost
Port: 1883
Client ID: mqttx_test
Username: (kosong)
Password: (kosong)
SSL/TLS: Disabled
```

#### **Test Connection:**
- Klik **Connect**
- Status harus **Connected** (hijau)

---

## 🎯 **Step-by-Step Testing**

### **Test 1: Start Services**

#### **Terminal 1: Start Static Publisher**
```bash
cd middleware/CONFIG_SYSTEM_DEVICE
python3 MQTTStaticPublisher.py
```
*Expected: Service starts and shows publishing logs*

#### **Terminal 2: Start CRUD Service**
```bash
cd middleware/CONFIG_SYSTEM_DEVICE
python3 PayloadStatic.py
```
*Expected: Service starts and shows MQTT connection logs*

---

### **Test 2: Subscribe ke Topics**

Di MQTT X, buat subscriptions:

#### **Subscription 1: Response Monitoring**
```
Topic: response/data/#
QoS: 0
```

#### **Subscription 2: Publishing Monitoring**
```
Topic: home/sensor/#
QoS: 1
```

---

### **Test 3: Test CRUD Operations**

#### **A. Create Configuration**
Publish ke topic: `command/data/payload`
```json
{
  "command": "writeData",
  "data": {
    "topic": "test/sensor/001",
    "data": {
      "temperature": 25.5,
      "humidity": 60
    },
    "interval": 10,
    "qos": 1,
    "lwt": true,
    "retain": false
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "generated_id",
    "topic": "test/sensor/001",
    "data": {"temperature": 25.5, "humidity": 60},
    "interval": 10,
    "qos": 1,
    "lwt": true,
    "retain": false
  }
}
```

#### **B. Read All Configurations**
Publish ke topic: `command/data/payload`
```json
{
  "command": "getData"
}
```

**Expected Response:** Array semua konfigurasi

#### **C. Update Configuration**
Publish ke topic: `command/data/payload`
```json
{
  "command": "updateData",
  "topic": "test/sensor/001",
  "data": {
    "data": {
      "temperature": 28.3,
      "humidity": 65
    }
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "topic": "test/sensor/001",
  "data": [...]
}
```

#### **D. Delete Configuration**
Publish ke topic: `command/data/payload`
```json
{
  "command": "deleteData",
  "topic": "test/sensor/001"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "topic": "test/sensor/001"
}
```

---

### **Test 4: Monitor Static Publishing**

1. **Subscribe** ke `home/sensor/#`
2. **Observe** messages otomatis setiap interval
3. **Check** format JSON payload
4. **Verify** QoS levels

**Sample Message:**
```json
{
  "online": 1,
  "temperature": 25.5,
  "humidity": 60,
  "battery_level": 85
}
```

---

### **Test 5: Test LWT (Last Will and Testament)**

1. **Stop Static Publisher** dengan Ctrl+C
2. **Observe** LWT message di subscribed topics:
```json
{
  "online": 0,
  "temperature": 25.5,
  "humidity": 60,
  "battery_level": 85
}
```

---

## 🔧 **Troubleshooting**

### **Connection Failed**
```
❌ Problem: Cannot connect to localhost:1883
✅ Solution:
   - Check if Mosquitto is running: brew services list
   - Start broker: brew services start mosquitto
   - Verify port: netstat -an | grep 1883
```

### **No Response from Commands**
```
❌ Problem: No response on response/data/*
✅ Solution:
   - Check if PayloadStatic.py is running
   - Verify topic spelling
   - Check service logs
```

### **No Publishing Messages**
```
❌ Problem: No messages on home/sensor/*
✅ Solution:
   - Check if MQTTStaticPublisher.py is running
   - Verify configuration file exists
   - Check publisher logs
```

---

## 📊 **Expected Results Summary**

### **✅ Successful Test Indicators:**

1. **MQTT X Connection:** Status "Connected" (green)
2. **CRUD Responses:** JSON responses pada `response/data/*`
3. **Static Publishing:** Automatic messages setiap 15-60 detik
4. **LWT Messages:** Offline status saat service disconnect
5. **QoS Working:** Messages dengan QoS levels sesuai

### **📈 Performance Metrics:**
- Response time: < 100ms
- Publishing interval: Accurate ±1 second
- Memory usage: < 100MB
- CPU usage: < 5%

---

## 🎯 **Quick Reference**

### **Essential Topics:**
- `command/data/payload` - Send CRUD commands
- `response/data/#` - Receive responses
- `home/sensor/#` - Monitor publishing
- `command/data/metrics` - Get system stats

### **Essential Commands:**
```json
// Get all data
{"command": "getData"}

// Create new config
{
  "command": "writeData",
  "data": {
    "topic": "your/topic",
    "data": {"key": "value"},
    "interval": 30
  }
}

// Update existing
{
  "command": "updateData",
  "topic": "your/topic",
  "data": {"data": {"key": "new_value"}}
}

// Delete config
{"command": "deleteData", "topic": "your/topic"}
```

---

## 🚀 **Next Steps**

1. **Master Basic Operations** - Create, Read, Update, Delete
2. **Explore Advanced Features** - QoS, LWT, Retain
3. **Test Performance** - Load testing dengan multiple topics
4. **Monitor Logs** - Check application logs untuk debugging
5. **Customize Configurations** - Modify intervals, QoS, data payloads

---

**🎉 Selamat Testing! Sistem MQTT Static Payload Publisher siap digunakan!**
