Function :

Funsi ambil data device :

1. Ambil data device dari file MODULAR_I2C/JSON/Config/installed_devices.json ambil nama device, bus, address
2. Buatkan topic terpisah untuk mengirim data available devices MODULAR_DEVICE/AVAILABLES
3. Ambil data device dari file MODBUS_SNMP/JSON/Config/installed_devices.json ambil nama device, bus, address
4. Buatkan topic terpisah untuk mengirim data available devices MODBUS_DEVICE/AVAILABLES

Function to control Relay
Topic = "modular"

Payload = {
mac: mqttBrokerData.mac_address,
protocol_type: "Modular",
device: "RELAYMINI",
function: "write",
value: {
pin: pin,
data: newState ? 1 : 0
},
address: device.protocol_setting.address,
device_bus: device.protocol_setting.device_bus,
Timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
};

TASK :

Page : control/geofence

Middleware : CONFIG_SYSTEM_DEVICE/AutomationGeofencing.py

bagaimana sebuah logicnya jika saya ingin membuat sebuah fitur untuk auto control geofencing? menggunakan OSM

ERROR :
