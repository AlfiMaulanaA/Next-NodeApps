import json
import time
import paho.mqtt.client as mqtt

# Konfigurasi MQTT
BROKER = "localhost"
PORT = 1883
TOPIC = "modbus/battery/data"

# Data yang akan dikirim
battery_data = {
   "device_name": "shoto_sda10_48100_battery",
   "protocol_type": "MODBUS RTU",
   "comport": "/dev/ttyUSB0",
   "modbus_address": 1,
   "value": "{\"Current\": 0.0, \"Pack Voltage\": 49.11, \"Remaining capacity\": 32.51, \"Total Capacity\": 104.9, \"Total Discharge Capacity\": 0, \"SOC\": 31.0, \"SOH\": 100.0, \"Cycle\": 1, \"Averag of Cell Votage\": 3.274, \"Averag of Cell Temperature\": 29.9, \"Max Cell Voltage\": 3.276, \"Min Cell Voltage\": 3.273, \"Max Cell Temperature\": 30.0, \"Min Cell Temperature\": 29.9, \"System Event\": {\"Over Voltage Protect\": 0, \"Under Voltage Protect\": 0, \"Charge over current Protect\": 0, \"Discharge over current Protect\": 0, \"Short/Reverse circuit Protect\": 0, \"High temperature Protect\": 0, \"SOC Low alarm\": 0, \"Discharging\": 0, \"Chargeing\": 0, \"Charge Online\": 0, \"High temperature Prtect\": 0}, \"Cell1 Voltage\": 3.276, \"Cell2 Voltage\": 3.274, \"Cell3 Voltage\": 3.274, \"Cell4 Voltage\": 3.275, \"Cell5 Voltage\": 3.273, \"Cell6 Voltage\": 3.275, \"Cell7 Voltage\": 3.275, \"Cell8 Voltage\": 3.276, \"Cell9 Voltage\": 3.276, \"Cell10 Voltage\": 3.275, \"Cell11 Voltage\": 3.275, \"Cell12 Voltage\": 3.274, \"Cell13 Voltage\": 3.274, \"Cell14 Voltage\": 3.274, \"Cell15 Voltage\": 3.273, \"Cell temperature 1\": 29.9, \"Cell temperature 2\": 29.9, \"Cell temperature 3\": 30.0, \"Cell temperature 4\": 30.0, \"Environment Temperature\": 30.3, \"MOSFET temperature\": 30.0, \"PollingDuration\": 2.3243114948272705}"
}

# Inisialisasi client MQTT
client = mqtt.Client()
client.connect(BROKER, PORT, 60)

print(f"📡 Publish ke broker MQTT {BROKER}:{PORT} setiap 3 detik di topik '{TOPIC}'...")
try:
    while True:
        # Konversi dict ke JSON string
        payload = json.dumps(battery_data)
        client.publish(TOPIC, payload)
        print(payload)
        time.sleep(3)
except KeyboardInterrupt:
    print("\n🛑 Dihentikan oleh pengguna.")
    client.disconnect()
