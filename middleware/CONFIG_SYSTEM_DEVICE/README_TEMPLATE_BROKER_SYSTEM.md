# 🚀 Template Broker System untuk Static Payload

## 📋 Overview

Sistem **Template Broker** memungkinkan setiap topic payload static untuk menggunakan **broker MQTT yang berbeda** berdasarkan template yang telah dikonfigurasi sebelumnya. Ini memberikan fleksibilitas maksimal dalam deployment dan scaling.

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────┐
│         Template Manager            │
├─────────────────────────────────────┤
│  📁 Template Storage               │
│  🔍 Template Discovery             │
│  ✅ Template Validation            │
│  🔄 Template Updates               │
└─────────────────┬───────────────────┘
                  │
        ┌─────────▼─────────┐
        │   Topic Config    │
        ├───────────────────┤
        │ • Template: prod  │
        │ • Template: edge  │
        │ • Template: dev   │
        └───────────────────┘
                  │
        ┌─────────▼─────────┐
        │  Broker Router    │
        ├───────────────────┤
        │ • Load Balance    │
        │ • Failover        │
        │ • Health Check    │
        └───────────────────┘
                  │
        ┌─────────▼─────────┐
        │   Broker Farm     │
        │ • broker1.cloud   │
        │ • broker2.edge    │
        │ • broker3.dev     │
        └───────────────────┘
```

## 📁 File Structure

```
middleware/CONFIG_SYSTEM_DEVICE/
├── JSON/
│   ├── payloadStaticConfig.json    # Main payload config dengan template
│   └── brokerTemplates.json        # Template definitions
├── BrokerTemplateManager.py        # Template management
├── BrokerResolver.py              # Broker resolution & health monitoring
├── PayloadStatic.py               # Enhanced dengan template support
└── README_TEMPLATE_BROKER_SYSTEM.md
```

## 🎯 Fitur Utama

### ✅ **1. Template Broker System**
- **4 Template Default**: Development, Production, Edge, Backup
- **Custom Template**: User dapat membuat template sendiri
- **Template Categories**: Organized by use case

### ✅ **2. Multi-Broker Support**
- **Per-Topic Broker**: Setiap topic bisa pakai broker berbeda
- **Load Balancing**: Distribution across multiple brokers
- **Failover Support**: Auto-switch jika broker down

### ✅ **3. Health Monitoring**
- **Connection Health**: Monitor status setiap broker
- **Performance Metrics**: Response time tracking
- **Auto Cleanup**: Remove unhealthy connections

### ✅ **4. Variable Resolution**
- **Environment Variables**: `${CLOUD_USERNAME}`, `${PASSWORD}`
- **Dynamic Values**: Runtime value injection
- **Template Inheritance**: Override specific settings

## 📊 Konfigurasi Template

### **Template Structure:**
```json
{
  "template_id": "cloud_prod_v1",
  "name": "Production Cloud Broker",
  "description": "Secure cloud MQTT broker untuk production",
  "category": "production",
  "config": {
    "protocol": "mqtt",
    "host": "mqtt.cloud.iot.com",
    "port": 8883,
    "ssl": true,
    "username": "${CLOUD_USERNAME}",
    "password": "${CLOUD_PASSWORD}",
    "qos": 2,
    "retain": true,
    "keepalive": 120
  },
  "metadata": {
    "created_by": "admin",
    "version": "1.0",
    "last_updated": "2025-01-01T00:00:00Z"
  }
}
```

### **Payload dengan Template:**
```json
{
  "topic": "factory/sensor/temperature",
  "data": {"temperature": 25.5, "unit": "celsius"},
  "template_id": "cloud_prod_v1",
  "broker_config": {
    "template_id": "cloud_prod_v1",
    "overrides": {
      "qos": 1,
      "interval": 30
    }
  },
  "interval": 60,
  "conditions": {
    "use_template": "cloud_prod_v1",
    "fallback_template": "edge_backup_v1"
  }
}
```

## 🔧 Cara Kerja

### **1. Template Selection**
User memilih template broker dari dropdown di UI:
- **Development**: Local broker untuk testing
- **Production**: Secure cloud broker
- **Edge**: Local edge computing broker
- **Backup**: Failover broker

### **2. Broker Resolution**
Sistem melakukan:
1. **Load template** berdasarkan `template_id`
2. **Resolve variables** (username, password, etc.)
3. **Apply overrides** dari payload config
4. **Establish connection** dengan health monitoring

### **3. Publishing Process**
```python
# Example publishing flow
broker = resolver.get_best_broker_for_topic("sensor/temp", payload_data)
if broker and broker.is_healthy():
    success = broker.publish(topic, json_payload, qos, retain)
```

## 🎨 Template Categories

### **🔵 Development Templates**
- **Local MQTT Broker** (localhost:1883)
- **No SSL/TLS** untuk kemudahan development
- **QoS 0** untuk performance optimal
- **Auto-reconnect** untuk development workflow

### **🟢 Production Templates**
- **Cloud MQTT Services** (AWS IoT, Azure IoT Hub)
- **SSL/TLS encryption** enabled
- **QoS 1-2** untuk reliability
- **Authentication** required

### **🟣 Edge Templates**
- **Local Edge Gateways** (192.168.x.x)
- **Low latency** untuk real-time processing
- **Offline capability** untuk edge computing
- **Local data processing**

### **🟠 Backup Templates**
- **Failover brokers** untuk high availability
- **Geographic redundancy** (different regions)
- **Auto-failover** jika primary down
- **Data synchronization** support

## 📊 Monitoring & Analytics

### **Health Metrics:**
- **Connection Status**: Connected/Disconnected per broker
- **Response Times**: Average publish latency
- **Error Rates**: Failed publish attempts
- **Uptime**: Connection stability metrics

### **Performance Analytics:**
- **Throughput**: Messages per second per broker
- **Load Distribution**: Balance across broker farm
- **Resource Usage**: CPU/Memory per connection
- **Cost Optimization**: Broker usage efficiency

## 🚀 Advanced Features

### **1. Conditional Logic**
```json
{
  "conditions": {
    "time_range": "09:00-17:00",
    "network_status": "wifi_connected",
    "data_threshold": {"sensor.battery": ">20"},
    "custom_logic": "user_defined_function"
  }
}
```

### **2. Load Balancing**
- **Round Robin**: Distribute load evenly
- **Least Connections**: Route to least busy broker
- **Weighted Distribution**: Custom load balancing
- **Geographic Routing**: Route based on location

### **3. Failover Strategies**
- **Primary → Backup**: Simple failover
- **Cascading Failover**: Multiple backup levels
- **Smart Failover**: AI-based broker selection
- **Graceful Degradation**: Continue with reduced functionality

## 🔒 Security Features

### **Template-Based Security:**
- **Credential Management**: Secure storage of usernames/passwords
- **SSL/TLS Configuration**: Per-template encryption settings
- **Access Control**: Template-based permission management
- **Audit Trail**: Track template usage and changes

### **Runtime Security:**
- **Connection Validation**: Verify broker certificates
- **Payload Encryption**: Encrypt sensitive data
- **Access Logging**: Monitor broker access patterns
- **Intrusion Detection**: Detect suspicious activities

## 📈 Scaling Strategies

### **Horizontal Scaling:**
- **Broker Clusters**: Multiple broker instances
- **Load Balancers**: Distribute traffic efficiently
- **Auto-scaling**: Dynamic resource allocation
- **Geographic Distribution**: Multi-region deployment

### **Vertical Scaling:**
- **Connection Pooling**: Reuse existing connections
- **Resource Optimization**: Efficient memory/CPU usage
- **Performance Tuning**: Optimize for specific workloads
- **Caching**: Reduce redundant operations

## 🛠️ Development Guidelines

### **Creating New Templates:**
1. **Define Template Structure** dengan required fields
2. **Set Security Level** (SSL, auth requirements)
3. **Configure Performance** (QoS, keepalive, timeouts)
4. **Test Connection** sebelum deploy
5. **Document Usage** untuk team reference

### **Template Best Practices:**
- **Semantic Naming**: `cloud_prod_v2`, `edge_gateway_v1`
- **Version Management**: Increment version pada changes
- **Documentation**: Describe use case dan requirements
- **Validation**: Test template sebelum production

## 🎯 Use Cases

### **1. Multi-Environment Deployment**
- **Development**: Local broker untuk testing
- **Staging**: Cloud broker untuk integration testing
- **Production**: High-availability cluster

### **2. Geographic Distribution**
- **Local Edge**: Process data di lokasi
- **Regional Hub**: Aggregate data per region
- **Global Cloud**: Centralized data processing

### **3. Performance Optimization**
- **High Frequency**: Edge broker untuk real-time
- **Batch Processing**: Cloud broker untuk analytics
- **Backup Storage**: Redundant broker untuk reliability

## 📋 API Reference

### **BrokerTemplateManager Methods:**
- `create_template(template_data)`: Create new template
- `get_template(template_id)`: Get specific template
- `update_template(template_id, data)`: Update existing template
- `delete_template(template_id)`: Delete template
- `search_templates(query)`: Search templates

### **BrokerResolver Methods:**
- `resolve_broker_for_topic(topic)`: Get broker for topic
- `get_best_broker_for_topic(topic)`: Get best available broker
- `publish_to_topic(topic, payload)`: Publish with auto broker selection
- `get_broker_health_report()`: Get health status all brokers

## 🔧 Troubleshooting

### **Common Issues:**

#### **1. Template Not Found**
```
Error: Template not found: cloud_prod_v1
Solution: Check template_id di payloadStaticConfig.json
```

#### **2. Broker Connection Failed**
```
Error: Connection timeout after 10s
Solution: Check broker host/port availability
```

#### **3. Variable Resolution Failed**
```
Error: Invalid variable: ${UNDEFINED_VAR}
Solution: Define all required variables
```

### **Debug Commands:**
```bash
# Check broker connectivity
mosquitto_sub -h localhost -p 1883 -t "test"

# Check template configuration
python -c "from BrokerTemplateManager import BrokerTemplateManager; tm = BrokerTemplateManager(); print(tm.get_template_stats())"

# Monitor broker health
python -c "from BrokerResolver import BrokerResolver; br = BrokerResolver(); print(br.get_broker_health_report())"
```

## 🎉 Kesimpulan

**Template Broker System** memberikan:
- ✅ **Fleksibilitas maksimal** dalam broker selection
- ✅ **Scalability** untuk growth
- ✅ **Reliability** dengan failover support
- ✅ **Security** dengan template-based access control
- ✅ **Maintainability** dengan centralized management

Sistem ini siap untuk **enterprise deployment** dengan multi-broker support dan template management yang canggih! 🚀
