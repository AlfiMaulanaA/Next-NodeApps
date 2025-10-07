# Testing Documentation - NewContainment IoT System

## Overview

Dokumen ini berisi panduan lengkap untuk testing semua fitur dan fungsionalitas sistem NewContainment IoT. Sistem ini terdiri dari frontend Next.js dan berbagai backend services untuk automation dan device management.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Dashboard Pages                        │   │
│  │  • / (Default Dashboard)                           │   │
│  │  • /control/* (Control Pages)                       │   │
│  │  • /devices/* (Device Management)                   │   │
│  │  • /network/* (Network Configuration)               │   │
│  │  • /settings/* (System Settings)                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼───────┐ ┌─────▼──────┐ ┌─────▼──────┐
        │   MQTT        │ │  Backend   │ │  Hardware  │
        │   Broker      │ │  Services  │ │  Devices   │
        │ (Mosquitto)   │ │ (Python)   │ │ (I2C/Modbus)│
        └───────────────┘ └────────────┘ └────────────┘
```

## 1. Environment Setup Testing

### 1.1 Prerequisites Check
```bash
# Check Node.js installation
node --version
npm --version

# Check Python installation
python3 --version

# Check MQTT Broker (Mosquitto)
mosquitto -v

# Check SQLite3
sqlite3 --version
```

### 1.2 Package Dependencies
```bash
# Install frontend dependencies
npm install

# Verify critical packages
npm list mqtt paho-mqtt better-sqlite3
npm list @types/mqtt @types/better-sqlite3
```

## 2. Frontend Testing

### 2.1 Development Server Testing
```bash
# Start development server
npm run dev

# Test URLs:
# http://localhost:3000 - Main Dashboard
# http://localhost:3000/control/manual - Manual Control
# http://localhost:3000/control/logic - Logic Control
# http://localhost:3000/control/schedule - Schedule Control
# http://localhost:3000/control/value - Value Control
# http://localhost:3000/control/voice - Voice Control
```

### 2.2 Build Testing
```bash
# Test production build
npm run build

# Test production start
npm start

# Test static export (if needed)
npm run export
```

### 2.3 Dashboard Pages Testing

#### 2.3.1 Default Dashboard (`/`)
**Test Items:**
- [ ] Sidebar navigation works
- [ ] Summary cards display device statistics
- [ ] Device status (online/offline) updates in real-time
- [ ] Tab switching between Modbus/SNMP and I2C devices
- [ ] Live data display shows parsed JSON data
- [ ] MQTT status indicator works
- [ ] Refresh button functionality
- [ ] Responsive design on mobile/tablet

**Expected Data Display:**
```json
{
  "relayMiniOutput1": false,  // Should show red badge
  "relayMiniOutput2": false,  // Should show red badge
  "relayMiniOutput3": false,  // Should show red badge
  "relayMiniOutput4": false,  // Should show red badge
  "relayMiniOutput5": false,  // Should show red badge
  "relayMiniOutput6": false   // Should show red badge
}
```

#### 2.3.2 Manual Control (`/control/manual`)
**Test Items:**
- [ ] Device discovery and listing
- [ ] Toggle switches for relay outputs
- [ ] Live data visibility toggle (eye icon)
- [ ] MQTT broker information display
- [ ] Search and filtering functionality
- [ ] Real-time MQTT communication
- [ ] Toast notifications for commands
- [ ] Device status indicators

**Control Commands Test:**
```bash
# Monitor MQTT messages for control commands
mosquitto_sub -h localhost -t "modular" -v

# Expected command format:
{
  "mac": "02:81:dd:6e:0f:11",
  "protocol_type": "Modular",
  "device": "RELAYMINI",
  "function": "write",
  "value": {
    "pin": 1,
    "data": 1
  },
  "address": 37,
  "device_bus": 1,
  "Timestamp": "2025-10-07 14:53:42"
}
```

### 2.4 Component Testing

#### 2.4.1 UI Components
**Test Files:**
- `components/ui/badge.tsx` - Badge variants (default, destructive)
- `components/ui/button.tsx` - Button variants and sizes
- `components/ui/card.tsx` - Card layouts
- `components/ui/table.tsx` - Table components
- `components/ui/sidebar.tsx` - Sidebar navigation

#### 2.4.2 Custom Components
- `components/mqtt-status.tsx` - MQTT connection status
- `components/realtime-clock.tsx` - Real-time clock display
- `components/refresh-button.tsx` - Refresh functionality

### 2.5 Responsive Design Testing
```bash
# Test different screen sizes
# Mobile: 375x667
# Tablet: 768x1024
# Desktop: 1920x1080

# Check CSS breakpoints
# sm: 640px
# md: 768px
# lg: 1024px
# xl: 1280px
```

## 3. Backend Services Testing

### 3.1 MQTT Broker Testing
```bash
# Check Mosquitto status
sudo systemctl status mosquitto

# Test MQTT publishing/subscribing
mosquitto_pub -h localhost -t "test/topic" -m "Hello World"
mosquitto_sub -h localhost -t "test/topic"

# Monitor all MQTT traffic
mosquitto_sub -h localhost -t "#" -v
```

### 3.2 Python Services Testing

#### 3.2.1 Network Manager Service
**File:** `middleware/CONFIG_SYSTEM_DEVICE/Network.py`

**Test Commands:**
```bash
# Start Network Manager
cd middleware/CONFIG_SYSTEM_DEVICE
python3 Network.py

# Test Topics:
# Subscribe to responses
mosquitto_sub -h localhost -t "mqtt_config/modbus/response" -v
mosquitto_sub -h localhost -t "mqtt_config/modular/response" -v
mosquitto_sub -h localhost -t "mqtt_config/response_mac" -v

# Send test commands
mosquitto_pub -h localhost -t "mqtt_config/modbus/command" -m '{"command": "get"}'
mosquitto_pub -h localhost -t "mqtt_config/modular/command" -m '{"command": "get"}'
mosquitto_pub -h localhost -t "mqtt_config/get_mac_address" -m '{}'
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "broker_address": "localhost",
    "broker_port": 1883,
    "username": "",
    "password": "",
    "mac_address": "02:81:dd:6e:0f:11"
  },
  "connection": {
    "status": "connected",
    "response_time": 4.25,
    "message": "Successfully connected to MQTT broker"
  },
  "timestamp": "2025-10-07T14:35:38.831681"
}
```

#### 3.2.2 Device Services Testing
**Test Device Discovery:**
```bash
# Test Modbus device discovery
mosquitto_sub -h localhost -t "response_device_modbus" -v

# Test I2C device discovery
mosquitto_sub -h localhost -t "response_device_i2c" -v

# Send discovery commands
mosquitto_pub -h localhost -t "command_device_modbus" -m '{"command": "getDataModbus"}'
mosquitto_pub -h localhost -t "command_device_i2c" -m '{"command": "getDataI2C"}'
```

**Expected Device Response:**
```json
[
  {
    "profile": {
      "name": "Device Name",
      "device_type": "RELAYMINI",
      "manufacturer": "Manufacturer",
      "part_number": "RELAYMINI",
      "topic": "Limbah/Modular/relay_mini/1"
    },
    "protocol_setting": {
      "protocol": "I2C",
      "address": 37,
      "device_bus": 1
    }
  }
]
```

### 3.3 Database Testing

#### 3.3.1 SQLite Database
**Test Database Operations:**
```bash
# Check database file
ls -la data/app.db

# Test database queries
sqlite3 data/app.db ".schema"
sqlite3 data/app.db "SELECT name FROM sqlite_master WHERE type='table';"
```

#### 3.3.2 Data Persistence
- [ ] Device configurations saved to database
- [ ] User settings persisted
- [ ] Automation rules stored
- [ ] Historical data maintained

## 4. Integration Testing

### 4.1 End-to-End Workflows

#### 4.1.1 Device Control Workflow
1. **Device Discovery**
   ```bash
   # Monitor device discovery
   mosquitto_sub -h localhost -t "response_device_i2c" -v
   ```

2. **Live Data Monitoring**
   ```bash
   # Monitor live device data
   mosquitto_sub -h localhost -t "Limbah/Modular/relay_mini/1" -v
   ```

3. **Control Commands**
   ```bash
   # Monitor control commands
   mosquitto_sub -h localhost -t "modular" -v

   # Send test control command
   mosquitto_pub -h localhost -t "modular" -m '{
     "mac": "02:81:dd:6e:0f:11",
     "protocol_type": "Modular",
     "device": "RELAYMINI",
     "function": "write",
     "value": {"pin": 1, "data": 1},
     "address": 37,
     "device_bus": 1,
     "Timestamp": "2025-10-07 14:53:42"
   }'
   ```

#### 4.1.2 Network Configuration Workflow
1. **WiFi Management**
   ```bash
   # Test WiFi scanning
   mosquitto_sub -h localhost -t "rpi/wifi/scan_response" -v
   mosquitto_pub -h localhost -t "rpi/wifi/scan" -m '{}'

   # Test WiFi connection
   mosquitto_sub -h localhost -t "rpi/wifi/connect_response" -v
   mosquitto_pub -h localhost -t "rpi/wifi/connect" -m '{
     "ssid": "YourWiFiNetwork",
     "password": "YourPassword"
   }'
   ```

2. **Network Settings**
   ```bash
   # Test network configuration
   mosquitto_sub -h localhost -t "rpi/network/response" -v
   mosquitto_pub -h localhost -t "rpi/network/set" -m '{
     "interface": "eth0",
     "method": "static",
     "static_ip": "192.168.1.100",
     "netmask": "255.255.255.0",
     "gateway": "192.168.1.1"
   }'
   ```

### 4.2 Real-time Features Testing

#### 4.2.1 MQTT Communication
**Test Topics:**
- Device discovery: `response_device_i2c`, `response_device_modbus`
- Live data: Dynamic device topics
- Status updates: `modbus_snmp_summ`, `modular_i2c_summ`
- Control commands: `modular`, `command_device_i2c`

#### 4.2.2 WebSocket/MQTT over WebSocket
- [ ] Real-time device status updates
- [ ] Live data streaming
- [ ] Command response handling
- [ ] Error message propagation

## 5. Performance Testing

### 5.1 Load Testing
```bash
# Test concurrent connections
# Test MQTT message throughput
# Test database query performance
# Test frontend rendering performance
```

### 5.2 Stress Testing
- [ ] Multiple device connections
- [ ] High-frequency data updates
- [ ] Large dataset handling
- [ ] Memory usage monitoring

### 5.3 Scalability Testing
- [ ] Multiple browser sessions
- [ ] Database connection pooling
- [ ] MQTT broker performance
- [ ] File system operations

## 6. Security Testing

### 6.1 Authentication & Authorization
- [ ] User login/logout functionality
- [ ] Session management
- [ ] Password encryption
- [ ] Access control validation

### 6.2 Data Security
- [ ] MQTT message encryption
- [ ] Database security
- [ ] File permissions
- [ ] Network security

### 6.3 Input Validation
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] Command injection prevention
- [ ] Data sanitization

## 7. Error Handling Testing

### 7.1 Network Errors
- [ ] MQTT broker disconnection
- [ ] Device communication failures
- [ ] Database connection errors
- [ ] API timeout handling

### 7.2 Data Errors
- [ ] Invalid JSON parsing
- [ ] Missing device data
- [ ] Corrupted database entries
- [ ] File system errors

### 7.3 User Input Errors
- [ ] Invalid form data
- [ ] Missing required fields
- [ ] Incorrect data formats
- [ ] Boundary condition testing

## 8. Deployment Testing

### 8.1 Docker Deployment (if applicable)
```bash
# Test Docker build
docker build -t newcontainment .

# Test Docker run
docker run -p 3000:3000 newcontainment

# Test Docker Compose
docker-compose up -d
```

### 8.2 Production Deployment
```bash
# Test production build
NODE_ENV=production npm run build

# Test PM2 deployment
pm2 start ecosystem.config.js

# Test Nginx reverse proxy
sudo nginx -t
sudo systemctl reload nginx
```

### 8.3 Backup and Recovery
- [ ] Database backup functionality
- [ ] Configuration backup
- [ ] Log file management
- [ ] System recovery procedures

## 9. Monitoring and Logging

### 9.1 System Monitoring
- [ ] PM2 process monitoring
- [ ] Nginx access logs
- [ ] MQTT broker logs
- [ ] Database performance

### 9.2 Error Logging
- [ ] Application error logs
- [ ] MQTT error messages
- [ ] Database error logs
- [ ] System error logs

### 9.3 Performance Monitoring
- [ ] Response time monitoring
- [ ] Memory usage tracking
- [ ] CPU utilization
- [ ] Network bandwidth

## 10. User Acceptance Testing

### 10.1 Functional Testing
- [ ] All menu navigation works
- [ ] Device control functions properly
- [ ] Data display is accurate
- [ ] User interface is intuitive

### 10.2 Usability Testing
- [ ] Interface responsiveness
- [ ] Error message clarity
- [ ] Loading state indicators
- [ ] Mobile compatibility

### 10.3 Compatibility Testing
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile device compatibility
- [ ] Screen resolution compatibility
- [ ] Network condition handling

## 11. API Testing

### 11.1 REST API Endpoints (if applicable)
```bash
# Test API health check
curl http://localhost:3000/api/health

# Test device endpoints
curl http://localhost:3000/api/devices

# Test configuration endpoints
curl http://localhost:3000/api/config
```

### 11.2 MQTT API Testing
**Test Commands:**
```bash
# Test device data retrieval
mosquitto_pub -h localhost -t "command_device_i2c" -m '{"command": "getDataI2C"}'

# Test control commands
mosquitto_pub -h localhost -t "modular" -m '{
  "mac": "02:81:dd:6e:0f:11",
  "protocol_type": "Modular",
  "device": "RELAYMINI",
  "function": "write",
  "value": {"pin": 1, "data": 1},
  "address": 37,
  "device_bus": 1,
  "Timestamp": "2025-10-07 14:53:42"
}'

# Test network configuration
mosquitto_pub -h localhost -t "rpi/network/set" -m '{
  "interface": "eth0",
  "method": "dhcp"
}'
```

## 12. Troubleshooting Guide

### 12.1 Common Issues

#### Issue: MQTT Connection Failed
**Symptoms:** MQTT status shows disconnected
**Solution:**
```bash
# Check MQTT broker status
sudo systemctl status mosquitto

# Check MQTT port
netstat -tuln | grep 1883

# Restart MQTT broker
sudo systemctl restart mosquitto
```

#### Issue: Device Data Not Updating
**Symptoms:** Live data section shows "Waiting..."
**Solution:**
```bash
# Check device discovery
mosquitto_sub -h localhost -t "response_device_i2c" -v

# Check live data topics
mosquitto_sub -h localhost -t "Limbah/Modular/relay_mini/1" -v

# Restart device services
pm2 restart all
```

#### Issue: Frontend Build Failed
**Symptoms:** `npm run build` fails
**Solution:**
```bash
# Clear build cache
rm -rf .next node_modules/.cache

# Reinstall dependencies
npm install

# Try build again
npm run build
```

#### Issue: Database Connection Failed
**Symptoms:** SQLite errors in logs
**Solution:**
```bash
# Check database file
ls -la data/app.db

# Check file permissions
chmod 666 data/app.db

# Verify database integrity
sqlite3 data/app.db "PRAGMA integrity_check;"
```

### 12.2 Debug Commands

#### MQTT Debugging
```bash
# Monitor all MQTT traffic
mosquitto_sub -h localhost -t "#" -v

# Monitor specific topics
mosquitto_sub -h localhost -t "response_device_i2c" -v
mosquitto_sub -h localhost -t "modular" -v
mosquitto_sub -h localhost -t "mqtt_config/#" -v
```

#### Application Debugging
```bash
# Check PM2 logs
pm2 logs

# Check system logs
sudo journalctl -u mosquitto -f

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### Network Debugging
```bash
# Check network interfaces
ip addr show

# Check routing table
ip route show

# Test MQTT broker connectivity
mosquitto_pub -h localhost -t "test" -m "test message"
```

## 13. Test Data and Mock Data

### 13.1 Sample Device Data
```json
{
  "mac": "02:81:dd:6e:0f:11",
  "protocol_type": "I2C MODULAR",
  "number_address": 37,
  "value": "{\"relayMiniOutput1\": false, \"relayMiniOutput2\": false, \"relayMiniOutput3\": false, \"relayMiniOutput4\": false, \"relayMiniOutput5\": false, \"relayMiniOutput6\": false}",
  "Timestamp": "2025-10-07 14:53:42"
}
```

### 13.2 Sample MQTT Topics
- `response_device_i2c` - Device discovery response
- `Limbah/Modular/relay_mini/1` - Live device data
- `modular` - Control commands
- `mqtt_config/modbus/response` - MQTT configuration
- `rpi/wifi/scan_response` - WiFi scan results

## 14. Test Environment Setup

### 14.1 Development Environment
```bash
# Install development dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### 14.2 Testing Environment
```bash
# Use testing environment
cp .env.testing .env.local

# Start with test configuration
NODE_ENV=test npm run dev
```

### 14.3 Production Environment
```bash
# Use production environment
cp .env.production .env.local

# Build for production
npm run build
npm start
```

## 15. Automated Testing

### 15.1 Unit Tests (if implemented)
```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage
```

### 15.2 Integration Tests (if implemented)
```bash
# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## 16. Performance Benchmarks

### 16.1 Response Time Testing
- [ ] Page load time < 2 seconds
- [ ] MQTT message latency < 100ms
- [ ] Database query time < 50ms
- [ ] API response time < 200ms

### 16.2 Resource Usage
- [ ] Memory usage < 512MB
- [ ] CPU usage < 50%
- [ ] Network bandwidth < 10MB/hour
- [ ] Storage growth < 1GB/month

## 17. Documentation Testing

### 17.1 Code Documentation
- [ ] README.md accuracy
- [ ] API documentation completeness
- [ ] Installation guide accuracy
- [ ] Troubleshooting guide effectiveness

### 17.2 User Documentation
- [ ] User manual completeness
- [ ] Video tutorials (if available)
- [ ] FAQ section adequacy
- [ ] Support contact information

## 18. Regression Testing

### 18.1 Version Upgrade Testing
- [ ] Node.js version compatibility
- [ ] Package dependency updates
- [ ] Database schema migrations
- [ ] Configuration file updates

### 18.2 Feature Addition Testing
- [ ] New features don't break existing functionality
- [ ] Backward compatibility maintained
- [ ] Performance impact assessed
- [ ] Security implications reviewed

## 19. Final Checklist

### Pre-Deployment Checklist
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] User acceptance testing completed

### Post-Deployment Checklist
- [ ] Application starts successfully
- [ ] All services are running
- [ ] Database connections working
- [ ] MQTT communication functional
- [ ] User interface accessible
- [ ] Monitoring and logging active

## 20. Support and Maintenance

### 20.1 Regular Maintenance Tasks
- [ ] Database backup scheduling
- [ ] Log rotation configuration
- [ ] Security updates monitoring
- [ ] Performance monitoring setup

### 20.2 Support Procedures
- [ ] Error reporting mechanism
- [ ] User feedback collection
- [ ] Issue tracking system
- [ ] Emergency response plan

---

**Last Updated:** October 7, 2025
**Version:** 1.0.0
**Author:** System Administrator

*This testing documentation should be updated regularly as new features are added and existing functionality is modified.*
