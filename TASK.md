modifikasi halaman /control/remapping dan middleware remappingt_payload

Ini data message paylad dari device "limbah/ph2"
{"device_name": "SeedStudio_PH_2", "protocol_type": "MODBUS RTU", "comport": "/dev/ttyUSB0", "modbus_address": 2, "value": "{\"temp\": 28.52, \"ph\": 8.46, \"PollingDuration\": 0.034754037857055664, \"Timestamp\": \"2025-10-02 10:00:45\"}", "Timestamp": "2025-10-02 10:00:45"}

sudo cat JSON/remappingConfig.json
[sudo] password for npi:
[
{
"id": "0d930f22-b6d8-4761-aea5-040455ab84e0",
"name": "PH2 REMAPED",
"description": "",
"enabled": true,
"created_at": "2025-10-02T07:05:36.917Z",
"updated_at": "2025-10-02 14:05:35",
"source_devices": [
{
"device_id": "226184b3-bda8-44ec-96f9-53cb7a1c39ee",
"device_name": "SeedStudio_PH_2",
"mqtt_topic": "limbah/ph2",
"key_mappings": [
{
"original_key": "temp",
"custom_key": "Temphe"
}
]
}
],
"mqtt_publish_config": {
"broker_url": "mqtt://localhost:1883",
"client_id": "remapper_client_f9839634",
"topic": "Remap/PH2",
"qos": 1,
"retain": false,
"lwt": true,
"publish_interval_seccond": 10
}
}
]

jadi tujuan dari fungsi ini dibuat adalah ingin menjadikan sebuah payload json dimapping ulang untuk keynya, contohnya seperti ini. diatas ada contoh device yang sudah memilki data dari device SeedStudio_PH_2, yang meirim data melalui topic "limbah/ph2". Llau user meremapping datanya tersebut dengan config yang ada, contoh :

untuk device SeedStudio_PH_2, memiliki key temp jadi user ingin mengubah semua key valuenya dari temp ke Temphe. Lalu di publish ulang ke settingan broker yang ada. Yitu mqtt://localhost:1883 ke topic "Remap/PH2".

Jadi setelah ada setingan tersebut apa yang seharusnya terjadi? jadi seharusnya nanti middleware, mensubscribe setiap device yang saya daftarkan diremaping config.
Dalam kasus ini
"device_name": "SeedStudio_PH_2",
"mqtt_topic": "limbah/ph2",

{"device_name": "SeedStudio_PH_2", "protocol_type": "MODBUS RTU", "comport": "/dev/ttyUSB0", "modbus_address": 2, "value": "{\"temp\": 28.52, \"ph\": 8.46, \"PollingDuration\": 0.034754037857055664, \"Timestamp\": \"2025-10-02 10:00:45\"}", "Timestamp": "2025-10-02 10:00:45"}

lalu merubah datanya

dan dikirim ulang melalui konfig mqtt
"mqtt_publish_config": {
"broker_url": "mqtt://localhost:1883",
"client_id": "remapper_client_f9839634",
"topic": "Remap/PH2",
"qos": 1,
"retain": false,
"lwt": true,
"publish_interval_seccond": 10
}

    nanti dikirim ke topic ini "Remap/PH2" dengan payload yang sudah diremap

    {name:PH2 REMAPED, Temphe:28.52, "Timestamp": "2025-10-02 10:00:45"}\

    menjadi seperti ini, ada nama yang kita buat, data yang kita mapping dan otomatis ada timestamp
