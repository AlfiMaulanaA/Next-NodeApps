from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import paho.mqtt.client as mqtt
import os

app = Flask(__name__)
CORS(app)

# Path ke file mqtt_config.json menggunakan path absolut yang benar
CONFIG_FILE_PATH = os.path.join('/home/npi/MODBUS_SNMP/JSON/Config', 'mqtt_config.json')

# Fungsi untuk membaca mqtt_config.json
def get_mqtt_config():
    try:
        with open(CONFIG_FILE_PATH, 'r') as file:
            data = json.load(file)
        return data
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Fungsi untuk menyimpan konfigurasi ke mqtt_config.json
def save_mqtt_config(config_data):
    try:
        with open(CONFIG_FILE_PATH, 'w') as file:
            json.dump(config_data, file, indent=4)
        return {"status": "success", "message": "Configuration saved successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Fungsi callback untuk menerima pesan dari MQTT
def on_message(client, userdata, message):
    print(f"Received message '{message.payload.decode()}' on topic '{message.topic}'")

# Setup MQTT client
mqtt_client = mqtt.Client()
mqtt_client.on_message = on_message

def connect_to_broker(broker_address, broker_port=1883):
    try:
        mqtt_client.connect(broker_address, broker_port, 60)
        mqtt_client.subscribe("command_device")
        mqtt_client.loop_start()
        return {"status": "success", "message": f"Connected to broker at {broker_address}:{broker_port}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.route('/api/get-mqtt-config', methods=['GET'])
def mqtt_config_endpoint():
    # Membaca file mqtt_config.json
    config_data = get_mqtt_config()
    mqtt_client.publish("command_device", json.dumps(config_data))
    return jsonify(config_data)

@app.route('/api/update-broker', methods=['POST'])
def update_broker():
    new_broker_address = request.json.get('broker_address')
    new_broker_port = request.json.get('broker_port')
    if not new_broker_address or not new_broker_port:
        return jsonify({"status": "error", "message": "Broker address and port are required"}), 400
    
    # Membaca konfigurasi yang ada
    config_data = get_mqtt_config()
    
    # Update broker_address dan broker_port di konfigurasi
    config_data['broker_address'] = new_broker_address
    config_data['broker_port'] = new_broker_port
    
    # Simpan konfigurasi yang diperbarui
    save_result = save_mqtt_config(config_data)
    
    if save_result['status'] == 'success':
        # Hubungkan ke broker baru
        connect_result = connect_to_broker(new_broker_address, int(new_broker_port))
        return jsonify(connect_result)
    else:
        return jsonify(save_result), 500

if __name__ == '__main__':
    # Baca konfigurasi awal dan hubungkan ke broker
    initial_config = get_mqtt_config()
    connect_to_broker(initial_config.get('broker_address', 'localhost'), initial_config.get('broker_port', 1883))
    app.run(host='0.0.0.0', port=5000)

