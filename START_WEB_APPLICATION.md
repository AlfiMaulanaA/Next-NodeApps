# 🚀 Panduan Menjalankan Web Application Tanpa Error

Panduan lengkap untuk menjalankan aplikasi Next.js dengan semua dependencies dan services yang diperlukan.

---

## 📋 **Prerequisites**

### **1. Sistem Requirements**
- ✅ **Node.js**: v18+ (cek dengan `node --version`)
- ✅ **npm/yarn**: Latest version
- ✅ **Python 3**: v3.8+ (cek dengan `python3 --version`)
- ✅ **Mosquitto**: MQTT broker
- ✅ **WebSocket MQTT Broker**: Running di `192.168.0.193:9000`

### **2. Environment Check**
```bash
# Check Node.js
node --version
npm --version

# Check Python
python3 --version
pip3 list | grep paho-mqtt

# Check Mosquitto
brew services list | grep mosquitto

# Check network
ping 192.168.0.193
```

---

## 🎯 **Step-by-Step Setup**

### **Step 1: Install Dependencies**

#### **Frontend Dependencies:**
```bash
cd /Users/ikhsalabing/Desktop/Next-NodeApps

# Install all npm packages
npm install

# Verify installation
npm list --depth=0
```

#### **Python Dependencies:**
```bash
# Install paho-mqtt if not already installed
pip3 install paho-mqtt

# Verify installation
python3 -c "import paho.mqtt.client; print('✅ paho-mqtt installed')"
```

---

### **Step 2: Start MQTT Brokers**

#### **Terminal 1: Start Mosquitto (TCP Broker)**
```bash
# Kill any existing mosquitto processes
pkill -f mosquitto

# Start Mosquitto on port 1883
mosquitto -d -p 1883

# Verify running
ps aux | grep mosquitto
netstat -an | grep 1883
```

#### **Terminal 2: Verify WebSocket Broker**
```bash
# Check if WebSocket broker is running on 192.168.0.193:9000
curl -I http://192.168.0.193:9000

# Or check with netstat
netstat -an | grep 192.168.0.193 | grep 9000
```

---

### **Step 3: Start Python Services**

#### **Terminal 3: Start PayloadStatic Service**
```bash
cd middleware/CONFIG_SYSTEM_DEVICE

# Start the service
python3 PayloadStatic.py

# Expected output:
# 2025-09-29 XX:XX:XX - PayloadStaticService - INFO - CRUD client connecting to 192.168.0.193:1883
# 2025-09-29 XX:XX:XX - PayloadStaticService - INFO - CRUD client connected successfully to 192.168.0.193:1883
```

#### **Terminal 4: Start MQTTStaticPublisher Service**
```bash
cd middleware/CONFIG_SYSTEM_DEVICE

# Start the publisher
python3 MQTTStaticPublisher.py

# Expected output:
# == MQTT Static Payload Publisher Service ===
# Broker: 192.168.0.193:1883
# Config: ./JSON/payloadStaticConfig.json
# 2025-09-29 XX:XX:XX - root - INFO - Connected to MQTT broker 192.168.0.193:1883
# 2025-09-29 XX:XX:XX - root - INFO - Loaded 7 configurations
```

---

### **Step 4: Start Next.js Application**

#### **Terminal 5: Start Development Server**
```bash
cd /Users/ikhsalabing/Desktop/Next-NodeApps

# Start Next.js development server
npm run dev

# Expected output:
# ▲ Next.js 14.0.0
# - Local:        http://localhost:3000
# ✓ Ready in XXXXms
```

---

### **Step 5: Verify All Services**

#### **Check All Processes:**
```bash
# Check all running services
ps aux | grep -E "(node|python|mosquitto)" | grep -v grep

# Expected output should show:
# - mosquitto (port 1883)
# - python3 PayloadStatic.py
# - python3 MQTTStaticPublisher.py
# - node (Next.js server)
```

#### **Test MQTT Connectivity:**
```bash
# Test Python to Broker connection
python3 -c "
import paho.mqtt.client as mqtt
client = mqtt.Client()
client.connect('192.168.0.193', 1883, 5)
print('✅ Python can connect to broker')
"
```

---

## 🌐 **Access Web Application**

### **Step 1: Open Browser**
```
URL: http://localhost:3000
```

### **Step 2: Login**
- Use your existing login credentials
- Or create new account if first time

### **Step 3: Navigate to Payload Static**
1. **Sidebar** → **"Data Payload"**
2. **Click** → **"Static Payload"**
3. **Page should load** with summary cards

### **Step 4: Test Functionality**
1. **Click "Get Data"** → Should show 7 items in table
2. **Click "Create New Data"** → Should open form
3. **MQTT status** → Should show "Connected"

---

## 🔧 **Troubleshooting Common Errors**

### **Error 1: Next.js Build Errors**
```
❌ Problem: npm install fails
✅ Solution:
# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### **Error 2: MQTT Connection Failed**
```
❌ Problem: Services can't connect to broker
✅ Solution:
# Check broker status
ps aux | grep mosquitto
netstat -an | grep 1883

# Restart broker
pkill -f mosquitto
mosquitto -d -p 1883
```

### **Error 3: Python Service Errors**
```
❌ Problem: PayloadStatic.py crashes
✅ Solution:
# Check Python dependencies
pip3 install paho-mqtt

# Check broker connectivity
ping 192.168.0.193

# Restart service
cd middleware/CONFIG_SYSTEM_DEVICE
python3 PayloadStatic.py
```

### **Error 4: UI Shows Empty Table**
```
❌ Problem: "Get Data" shows no results
✅ Solution:
# Check MQTT communication
python3 -c "
import paho.mqtt.client as mqtt
import json
client = mqtt.Client()
client.connect('192.168.0.193', 1883, 5)
client.subscribe('response/data/#')
client.publish('command/data/payload', json.dumps({'command': 'getData'}))
print('Command sent')
"

# Check browser console (F12)
# Look for MQTT connection errors
```

### **Error 5: Port Already in Use**
```
❌ Problem: Port 3000 already in use
✅ Solution:
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

---

## 📊 **Monitoring & Health Checks**

### **1. Service Health Check**
```bash
# Check all services status
curl http://localhost:3000/api/health

# Check MQTT broker
mosquitto_sub -h 192.168.0.193 -p 1883 -t "test" -C 1

# Check WebSocket broker
curl http://192.168.0.193:9000
```

### **2. Log Monitoring**
```bash
# Monitor Next.js logs
tail -f /Users/ikhsalabing/Desktop/Next-NodeApps/.next/server.log

# Monitor Python service logs
tail -f middleware/CONFIG_SYSTEM_DEVICE/logs/mqtt_publisher.log
tail -f middleware/CONFIG_SYSTEM_DEVICE/logs/payload_processor.log
```

### **3. Performance Monitoring**
```bash
# Check memory usage
ps aux | grep -E "(node|python)" | grep -v grep | awk '{print $2, $4, $11}'

# Check network connections
netstat -an | grep 1883
netstat -an | grep 9000
```

---

## 🚀 **Production Deployment**

### **For Production Use:**
```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2
npm install -g pm2
pm2 start npm --name "next-app" -- start
```

---

## 🎯 **Quick Start Script**

### **Automated Startup (Recommended):**
```bash
#!/bin/bash
# start-all-services.sh

echo "🚀 Starting all services..."

# Start MQTT broker
echo "📡 Starting MQTT broker..."
mosquitto -d -p 1883

# Start Python services
echo "🐍 Starting Python services..."
cd middleware/CONFIG_SYSTEM_DEVICE
python3 PayloadStatic.py &
python3 MQTTStaticPublisher.py &

# Start Next.js
echo "⚛️ Starting Next.js..."
cd /Users/ikhsalabing/Desktop/Next-NodeApps
npm run dev &

echo "✅ All services started!"
echo "🌐 Access at: http://localhost:3000"
```

---

## 📋 **Service Status Summary**

### **✅ When Everything is Running Correctly:**

| Service | Port | Status | Check Command |
|---------|------|--------|---------------|
| Mosquitto (TCP) | 1883 | ✅ Running | `ps aux \| grep mosquitto` |
| WebSocket Broker | 9000 | ✅ Running | `netstat -an \| grep 9000` |
| PayloadStatic.py | - | ✅ Connected | Check logs for "connected successfully" |
| MQTTStaticPublisher.py | - | ✅ Publishing | Check logs for "Loaded X configurations" |
| Next.js | 3000 | ✅ Ready | `curl http://localhost:3000` |

### **🎯 Expected Results:**
- **Web App**: Accessible at http://localhost:3000
- **Payload Static Page**: Shows 7 data items
- **MQTT Communication**: Working bidirectionally
- **Real-time Updates**: Automatic data publishing
- **CRUD Operations**: Create, Read, Update, Delete working

---

## 🎉 **Final Checklist**

### **Pre-Launch Checklist:**
- [ ] Node.js installed and working
- [ ] Python 3 with paho-mqtt installed
- [ ] Mosquitto broker running on port 1883
- [ ] WebSocket broker accessible on 192.168.0.193:9000
- [ ] PayloadStatic.py connected successfully
- [ ] MQTTStaticPublisher.py loaded configurations
- [ ] Next.js development server running
- [ ] Web app accessible at localhost:3000
- [ ] Payload Static page shows data table
- [ ] MQTT X can connect and monitor

### **Post-Launch Verification:**
- [ ] Login works
- [ ] Navigation to Payload Static works
- [ ] "Get Data" button populates table
- [ ] Create/Update/Delete operations work
- [ ] Real-time publishing visible
- [ ] No console errors in browser
- [ ] MQTT communication stable

---

**🎯 Ikuti step-by-step guide ini dan aplikasi web Anda akan berjalan tanpa error!**
