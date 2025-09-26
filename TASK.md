[{"id": "e42c7da3-da91-48f6-a0de-55bade6cf0c8", "name": "RelayMini1", "address": 37, "device_bus": 0, "part_number": "RELAYMINI", "mac": "", "manufacturer": "IOT", "device_type": "Modular", "topic": "Limbah/Modular/relay_mini/1"}, {"id": "3d328d8b-d769-411a-b34b-165cd0e1d0fc", "name": "Drycontact1", "address": 35, "device_bus": 0, "part_number": "DRYCONTACT", "mac": "", "manufacturer": "IOT", "device_type": "Modular", "topic": "Limbah/Modular/drycontact/1"}]

ini data yang dikirim dari MODULAR_DEVICE/AVAILABLES

buat agar topic disimpan juga ke JSONnya saat create AutomationLogic secara otomatis, nantinya topic tersebut akan disubscribe untuk emlakukan pengecekan sebagai trigger oleh broker mqtt_config_file = '../MODULAR_I2C/JSON/Config/mqtt_config.json'

Limbah/Modular/drycontact/1

{"mac": "70:f7:54:cb:7a:93", "protocol_type": "I2C MODULAR", "number_address": 35, "value": "{\"drycontactInput1\": true, \"drycontactInput2\": false, \"drycontactInput3\": false, \"drycontactInput4\": false, \"drycontactInput5\": false, \"drycontactInput6\": false, \"drycontactInput7\": false, \"drycontactInput8\": false, \"drycontactInput9\": false, \"drycontactInput10\": false, \"drycontactInput11\": false, \"drycontactInput12\": false, \"drycontactInput13\": false, \"drycontactInput14\": false}", "Timestamp": "2025-09-26 06:20:31"}
