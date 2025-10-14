# Unified Automation Configuration Examples

File ini menyediakan contoh konfigurasi lengkap untuk sistem unified automation yang mendukung berbagai jenis trigger dan kombinasi kompleks.

## 📋 Daftar Examples

### 1. **Schedule-only Trigger** - Work Hours Lamp Control
- **Trigger**: Time range (08:00-17:00) pada hari kerja
- **Action**: Control relay untuk lampu kantor
- **Use case**: Otomasi jadwal kerja sederhana

### 2. **Numeric Sensor Trigger** - High Temperature Fan Control
- **Trigger**: Suhu > 35°C
- **Action**: Control fan pendinginan
- **Use case**: Kontrol suhu dengan hysteresis (delay on/off)

### 3. **Mixed Boolean + Schedule** - Security Alert System
- **Trigger Group 1**: Door sensor (boolean) + schedule (time_range)
- **Actions**: Alarm relay + WhatsApp alert
- **Use case**: Alert keamanan multi-condition

### 4. **Numeric Range Check (OR Logic)** - Power Quality Monitoring
- **Trigger**: Voltage < 200 V OR Voltage > 250 V
- **Action**: WhatsApp alert ke maintenance
- **Use case**: Monitoring safety ranges dengan logic OR

### 5. **Specific Time Schedule** - Maintenance Reminders
- **Trigger**: Exactly 08:00 pada hari kerja
- **Action**: WhatsApp checklist maintenance
- **Use case**: Scheduled notifications dengan toleransi waktu

### 6. **Complex Multi-Group AND Logic** - HVAC Optimization
- **Trigger Group 1**: Temperature > 26°C
- **Trigger Group 2**: Humidity > 65%
- **Trigger Group 3**: Schedule time_range
- **Action**: AC control
- **Use case**: Sistem HVAC dengan multiple sensor inputs

### 7. **Mixed Schedule + Boolean (OR Logic)** - Night Security Lighting
- **Trigger Group 1**: Schedule time_range (night hours) OR
- **Trigger Group 2**: Motion sensor (boolean)
- **Action**: Security lights relay
- **Use case**: Lighting dengan override motion sensor

### 8. **Daily Schedule** - Weekend Maintenance Mode
- **Trigger**: Daily schedule pada Saturday & Sunday
- **Actions**: Maintenance mode relay + WhatsApp notification
- **Use case**: Mode maintenance otomatis

### 9. **Complex OR Logic Emergency System** - Emergency Shutdown
- **Trigger**: Emergency button OR Pressure < 5 OR Smoke > 80
- **Actions**: Multiple relays (power breaker, siren) + WhatsApp alert
- **Use case**: Sistem emergency multi-input dengan responses kompleks

### 10. **Advanced Mixed Conditions** - Smart Irrigation
- **Trigger Group 1**: Soil moisture < 30%
- **Trigger Group 2**: Multiple schedule time_ranges OR logic
- **Action**: Irrigation valve control
- **Use case**: Irigasi pintar dengan multiple schedule options

## 🔧 Trigger Types Detail

### Schedule Triggers
```json
{
  "trigger_type": "schedule",
  "schedule_type": "time_range|specific_time|daily",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "specific_time": "HH:MM",
  "active_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "condition_operator": "time_range|specific_time|daily"
}
```

### Boolean/Drycontact Triggers
```json
{
  "trigger_type": "drycontact",
  "field_name": "contactSensor1",
  "condition_operator": "is",
  "target_value": true|false,
  "delay_on": 0,
  "delay_off": 5
}
```

### Numeric Triggers
```json
{
  "trigger_type": "numeric",
  "field_name": "temperature",
  "condition_operator": "greater_than|less_than|equals|between|etc",
  "target_value": 35,
  "delay_on": 60,
  "delay_off": 300
}
```

## ⚙️ Action Types

### Relay Control
```json
{
  "action_type": "control_relay",
  "target_device": "Device Name",
  "target_address": 1,
  "target_bus": 1,
  "relay_pin": 1,
  "target_value": true,
  "latching": false,
  "delay_on": 30,
  "delay_off": 0
}
```

### WhatsApp Message
```json
{
  "action_type": "send_message",
  "message_type": "whatsapp",
  "whatsapp_number": "6281234567890",
  "whatsapp_name": "Recipient Name",
  "message": "Alert message text",
  "message_template_id": "template_id",
  "channel_integration_id": "channel_id",
  "delay_on": 5
}
```

## 📝 Testing Instructions

1. Copy file `example_unified_config.json` ke `JSON/automationUnifiedConfig.json`
2. Jalankan automation service: `python AutomationUnified.py`
3. Test berbagai trigger kondisi menggunakan MQTT client atau device simulator
4. Monitor log untuk melihat trigger evaluation dan action execution

## 🔍 Key Features Demonstrated

- **Mixed trigger types**: Schedule + sensor dalam satu aturan
- **Complex logic**: AND/OR group combinations
- **Action delays**: Handling hysteresis dan timing
- **Latching relays**: Maintained state control
- **Multi-action rules**: Relay control + messaging
- **Error resilience**: Comprehensive logging dan error handling
- **Real-world scenarios**: Office, security, HVAC, emergency, agriculture

## 🎯 Best Practices from Examples

1. **Use appropriate delay_on/delay_off** untuk menghindari oscillation
2. **Combine schedule + sensor triggers** untuk kontrol yang lebih smart
3. **Use latching** untuk maintenance mode indicators
4. **Group related triggers** dengan logical operators
5. **Add descriptive messages** untuk debugging dan maintenance
6. **Set appropriate tolerances** pada numeric comparisons
7. **Use emergency OR logic** untuk multi-input safety systems
8. **Schedule templates** untuk regular maintenance tasks
