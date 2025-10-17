modiifkasi agar data yang dikirimkan 
{
   "name":"TEST_NODE_UPDATED",
   "ip_wlan":"N/A",
   "ip_eth":"N/A",
   "mac_address":"A0:D3:65:04:AF:AB",
   "mac_address_eth":"N/A",
   "mac_address_wlan":"N/A",
   "data"[
    modbus:
    [
  {
    "profile": {
      "name": "SeedStudio_PH_1",
      "device_type": "water",
      "manufacturer": "SeedStudio",
      "part_number": "S_pH_01",
      "topic": "limbah/ph1",
      "interval_publish": 1,
      "custom_by_customer": false,
      "customer": "",
      "custom_payload": false,
      "qos": 1
    },
    "protocol_setting": {
      "protocol": "Modbus RTU",
      "address": 1,
      "port": "/dev/ttyUSB0",
      "baudrate": 9600,
      "parity": "NONE",
      "bytesize": 8,
      "stop_bit": 1,
      "timeout": 1,
      "endianness": "Little Endian"
    }
  },
  {
    "profile": {
      "name": "SeedStudio_PH_2",
      "device_type": "water",
      "manufacturer": "SeedStudio",
      "part_number": "S_pH_01",
      "topic": "limbah/ph2",
      "interval_publish": 1,
      "custom_payload": false,
      "custom_by_customer": false,
      "customer": "",
      "qos": 1
    },
    "protocol_setting": {
      "protocol": "Modbus RTU",
      "address": 2,
      "port": "/dev/ttyUSB0",
      "baudrate": 9600,
      "parity": "NONE",
      "bytesize": 8,
      "stop_bit": 1,
      "timeout": 1,
      "endianness": "Little Endian"
    }
  }
]

  
,
    modular:
[
  {
    "profile": {
      "name": "GPIO1",
      "device_type": "Modular",
      "manufacturer": "IOT",
      "part_number" : "GPIO",
      "topic" : "IOT/Modular/gpio_5v/1"
      },
    "protocol_setting" : {
      "protocol": "Modular",
      "address": 32,
      "device_bus": 2
    }
  }
]
   ]
   "time_stamp":"2025-10-18T00:38:13.558065"
}

bukan hanya ini, tapi ada juga "data" yang dimana terbagi menjadi 2 array untuk modbus dan modular
data yg ada di modus merupakan fungsi untuk memunculkan data installed device /MODBUS_SNMP/JSON/Config/installed_devices.json
dan sama untuk modular merupaan fungsi untuk memunculkan data installed device /MODULAR_I2C/JSON/Config/installed_devices.json


