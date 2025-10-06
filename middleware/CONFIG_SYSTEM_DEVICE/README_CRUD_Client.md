# MQTT CRUD Client untuk PayloadStatic Service

Client MQTT untuk melakukan operasi CRUD (Create, Read, Update, Delete) pada PayloadStatic service menggunakan protokol MQTT dengan pola Command/Response.

## Fitur

- **CREATE**: Menambah payload statis baru
- **READ**: Membaca semua payload yang tersimpan
- **UPDATE**: Mengupdate payload berdasarkan topik
- **DELETE**: Menghapus payload berdasarkan topik
- **METRICS**: Melihat data performa service
- **Mode Demo**: Demo otomatis semua operasi CRUD
- **Mode Interaktif**: Menu interaktif untuk testing manual

## Prerequisites

- Python 3.x
- Paho MQTT library: `pip install paho-mqtt`
- MQTT Broker (Mosquitto, HiveMQ, dll) running pada localhost:1883
- PayloadStatic service sedang berjalan

## Instalasi

1. Install dependencies:
```bash
pip install paho-mqtt
```

2. Pastikan MQTT broker dan PayloadStatic service sedang berjalan

## Cara Penggunaan

### Menjalankan Client

```bash
cd middleware/CONFIG_SYSTEM_DEVICE
python3 MQTT_CRUD_Client.py
```

### Mode yang Tersedia

1. **Demo Otomatis**: Menjalankan semua operasi CRUD secara otomatis untuk testing
2. **Mode Interaktif**: Menu interaktif untuk operasi manual

## Topik MQTT yang Digunakan

### Command Topics
- `command/data/payload` - Untuk operasi CRUD (getData, writeData, updateData, deleteData)
- `command/data/metrics` - Untuk request data performa

### Response Topics
- `response/data/payload` - Response untuk READ operations
- `response/data/write` - Response untuk CREATE operations
- `response/data/update` - Response untuk UPDATE operations
- `response/data/delete` - Response untuk DELETE operations
- `response/data/metrics` - Response untuk METRICS operations

## Format Payload

### CREATE (writeData)
```json
{
  "command": "writeData",
  "data": {
    "topic": "your/mqtt/topic",
    "data": {
      "key1": "value1",
      "key2": "value2"
    }
  },
  "interval": 10,
  "qos": 0,
  "lwt": true,
  "retain": false
}
```

### READ (getData)
```json
{
  "command": "getData"
}
```

### UPDATE (updateData)
```json
{
  "command": "updateData",
  "topic": "your/mqtt/topic",
  "data": [
    {"key": "key1", "value": "new_value1"},
    {"key": "key2", "value": "new_value2"}
  ],
  "interval": 15
}
```

### DELETE (deleteData)
```json
{
  "command": "deleteData",
  "topic": "your/mqtt/topic"
}
```

### METRICS
```json
{}
```
(Publish ke topik `command/data/metrics`)

## Contoh Response

### Success Response
```json
{
  "status": "success",
  "data": {...},
  "topic": "your/mqtt/topic"
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description"
}
```

### Metrics Response
```json
{
  "messages_processed": 150,
  "publish_operations": 145,
  "errors_encountered": 2,
  "average_processing_time": 0.023
}
```

## Testing

### 1. Jalankan PayloadStatic Service
```bash
cd middleware/CONFIG_SYSTEM_DEVICE
python3 PayloadStatic.py
```

### 2. Jalankan CRUD Client
```bash
python3 MQTT_CRUD_Client.py
```

### 3. Pilih Mode Demo
Pilih opsi 1 untuk menjalankan demo otomatis yang akan:
- Membuat payload baru
- Membaca semua payload
- Mengupdate payload
- Membaca lagi untuk verifikasi
- Melihat metrics
- Menghapus payload

## Troubleshooting

### Connection Refused
- Pastikan MQTT broker sedang berjalan
- Periksa konfigurasi broker address dan port
- Default: localhost:1883

### No Response
- Pastikan PayloadStatic service sedang berjalan
- Periksa log service untuk error
- Verifikasi topik MQTT yang digunakan

### JSON Decode Error
- Pastikan format JSON payload benar
- Periksa syntax JSON pada input

## Struktur Kode

- `MQTT_CRUD_Client` class: Main client class dengan semua operasi CRUD
- `demo_crud_operations()`: Fungsi demo otomatis
- `interactive_mode()`: Menu interaktif untuk testing manual
- Response handling dengan timeout mechanism
- Comprehensive logging untuk debugging

## Dependencies

- `paho-mqtt`: MQTT client library
- `json`: JSON handling
- `time`: Timing operations
- `logging`: Logging functionality

## Catatan

- Client menggunakan clean_session=True untuk testing
- Timeout default 5 detik untuk menunggu response
- Semua operasi thread-safe dengan proper error handling
- Logging lengkap untuk monitoring dan debugging
