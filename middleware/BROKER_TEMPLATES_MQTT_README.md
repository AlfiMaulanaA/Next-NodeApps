# Broker Templates MQTT Implementation

## Overview
Broker Templates sekarang telah diimplementasikan dengan dukungan MQTT penuh, sama seperti fitur lainnya dalam sistem. Implementasi ini memungkinkan operasi CRUD (Create, Read, Update, Delete) untuk broker templates dilakukan melalui protokol MQTT secara real-time.

## Architecture

### Components Updated
1. **API Endpoints** (`app/api/broker-templates/`)
   - `POST /api/broker-templates` - Create template (dengan MQTT publish)
   - `PUT /api/broker-templates/[templateId]` - Update template (dengan MQTT publish)
   - `DELETE /api/broker-templates/[templateId]` - Delete template (dengan MQTT publish)

2. **Frontend Component** (`components/BrokerTemplatesEmbedded.tsx`)
   - MQTT client subscription untuk real-time updates
   - Auto-update UI ketika ada perubahan dari sumber lain

3. **Middleware Python** (`middleware/CONFIG_SYSTEM_DEVICE/BrokerTemplateManager.py`)
   - MQTT client untuk menerima dan memproses commands
   - Response publishing untuk feedback real-time

## MQTT Topics

### Command Topics (Subscribe)
- `broker-templates/create` - Create new template
- `broker-templates/update` - Update existing template
- `broker-templates/delete` - Delete template

### Response Topics (Publish)
- `broker-templates/response` - Success responses
- `broker-templates/error` - Error messages
- `broker-templates/create` - Create notifications (from API)
- `broker-templates/update` - Update notifications (from API)
- `broker-templates/delete` - Delete notifications (from API)

## Message Formats

### Create Template
```json
{
  "template": {
    "template_id": "my_template_001",
    "name": "My Template",
    "description": "Template description",
    "category": "development",
    "config": {
      "protocol": "mqtt",
      "host": "localhost",
      "port": 1883,
      "ssl": false,
      "qos": 1,
      "retain": false,
      "keepalive": 60
    },
    "metadata": {
      "created_by": "user",
      "version": "1.0"
    }
  },
  "timestamp": "2025-01-01T10:00:00.000Z"
}
```

### Update Template
```json
{
  "template_id": "my_template_001",
  "template": {
    "name": "Updated Template Name",
    "description": "Updated description"
  },
  "timestamp": "2025-01-01T10:00:00.000Z"
}
```

### Delete Template
```json
{
  "template_id": "my_template_001",
  "timestamp": "2025-01-01T10:00:00.000Z"
}
```

### Response Format
```json
{
  "action": "created|updated|deleted",
  "template_id": "my_template_001",
  "template": { /* full template object */ },
  "timestamp": "2025-01-01T10:00:00.000Z"
}
```

### Error Format
```json
{
  "action": "error",
  "operation": "create|update|delete",
  "error": "Error message",
  "timestamp": "2025-01-01T10:00:00.000Z"
}
```

## Usage Examples

### 1. Create Template via MQTT (Python)
```python
import paho.mqtt.client as mqtt
import json

client = mqtt.Client()
client.connect("localhost", 1883, 60)

template = {
    "template_id": "example_template",
    "name": "Example MQTT Template",
    "description": "Template for MQTT broker connection",
    "category": "development",
    "config": {
        "protocol": "mqtt",
        "host": "localhost",
        "port": 1883,
        "ssl": False,
        "qos": 1,
        "retain": False,
        "keepalive": 60
    }
}

payload = {"template": template}
client.publish("broker-templates/create", json.dumps(payload), qos=1)
```

### 2. Update Template via MQTT (Python)
```python
update_payload = {
    "template_id": "example_template",
    "template": {
        "name": "Updated Example Template",
        "config": {
            "qos": 2,
            "keepalive": 120
        }
    }
}

client.publish("broker-templates/update", json.dumps(update_payload), qos=1)
```

### 3. Delete Template via MQTT (Python)
```python
delete_payload = {"template_id": "example_template"}
client.publish("broker-templates/delete", json.dumps(delete_payload), qos=1)
```

### 4. Listen for Responses (Python)
```python
def on_message(client, userdata, msg):
    payload = json.loads(msg.payload.decode())
    print(f"Received: {payload}")

client.on_message = on_message
client.subscribe("broker-templates/response")
client.subscribe("broker-templates/error")
```

## Testing

### Run MQTT Test Script
```bash
python test_broker_templates_mqtt.py
```

### Manual Testing with MQTT Client
```bash
# Subscribe to topics
mosquitto_sub -h localhost -p 1883 -t "broker-templates/#" -v

# Publish create command (in another terminal)
mosquitto_pub -h localhost -p 1883 -t "broker-templates/create" -m '{"template": {"template_id": "test", "name": "Test", "config": {"protocol": "mqtt", "host": "localhost", "port": 1883}}}'
```

## Integration Points

### With Existing Systems
- **Device Management**: Broker templates dapat digunakan untuk mengkonfigurasi MQTT connections pada devices
- **Network Configuration**: Templates dapat diintegrasikan dengan WiFi dan IP management
- **Monitoring**: Real-time updates memungkinkan monitoring template changes

### API Compatibility
- Semua existing REST API endpoints tetap berfungsi
- MQTT operations bersifat additive (tambahan), bukan replacement
- Frontend secara otomatis update ketika ada perubahan via MQTT

## Configuration

### MQTT Broker Settings
- **Host**: localhost (default)
- **Port**: 1883 (default)
- **QoS**: 1 (at least once delivery)
- **Retain**: false (messages tidak dipertahankan)

### Environment Variables
```bash
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
```

## Error Handling

### MQTT Connection Failures
- API endpoints akan tetap berfungsi meskipun MQTT gagal
- Errors akan dilog namun tidak menghentikan operasi utama
- Frontend akan fallback ke polling jika MQTT tidak tersedia

### Message Validation
- Invalid JSON payloads akan di-reject dengan error message
- Missing required fields akan dikembalikan sebagai error
- Template validation tetap dilakukan sebelum processing

## Performance Considerations

### Message Frequency
- QoS 1 digunakan untuk reliability tanpa overhead berlebih
- Messages tidak di-retain untuk menghindari storage bloat
- Rate limiting dapat ditambahkan jika diperlukan

### Scalability
- MQTT topics menggunakan hierarchical structure untuk easy filtering
- Multiple clients dapat subscribe ke topics yang sama
- Broker dapat handle multiple concurrent operations

## Monitoring & Debugging

### Logs
- MQTT connection events logged di console
- Message processing logged dengan detail
- Errors logged dengan stack traces

### Debug Mode
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### MQTT Client Monitoring
- Connection status dapat dimonitor via `mqtt-status` component
- Message throughput dapat di-track via logs
- Error rates dapat di-monitor untuk troubleshooting

## Future Enhancements

### Potential Improvements
1. **Message Persistence**: Implement retain untuk critical messages
2. **Authentication**: Add MQTT authentication/authorization
3. **Rate Limiting**: Implement rate limiting untuk high-frequency operations
4. **Batch Operations**: Support untuk bulk create/update/delete
5. **Template Validation**: Enhanced validation rules
6. **Audit Trail**: Complete audit logging untuk compliance

### Integration Opportunities
1. **IoT Devices**: Direct template deployment ke IoT devices
2. **Cloud Sync**: Synchronization dengan cloud-based templates
3. **Version Control**: Git-like versioning untuk templates
4. **Backup/Restore**: Automated backup dan restore capabilities

## Troubleshooting

### Common Issues

1. **MQTT Connection Failed**
   - Check if MQTT broker is running
   - Verify broker host/port configuration
   - Check network connectivity

2. **Messages Not Received**
   - Verify topic subscriptions
   - Check QoS settings
   - Ensure client is connected

3. **Template Validation Errors**
   - Check required fields are present
   - Verify JSON format
   - Check field types and constraints

### Debug Commands
```bash
# Check MQTT broker status
ps aux | grep mosquitto

# Monitor MQTT traffic
mosquitto_sub -h localhost -p 1883 -t "#" -v

# Test connection
mosquitto_pub -h localhost -p 1883 -t "test" -m "hello"
```

## Conclusion

Implementasi MQTT untuk Broker Templates telah berhasil menyamakan functionality dengan komponen sistem lainnya. Sistem sekarang mendukung:

- ✅ Real-time CRUD operations via MQTT
- ✅ REST API compatibility
- ✅ Automatic UI updates
- ✅ Error handling dan logging
- ✅ Comprehensive testing
- ✅ Documentation lengkap

Broker Templates sekarang fully integrated dengan MQTT infrastructure dan siap untuk production use.
