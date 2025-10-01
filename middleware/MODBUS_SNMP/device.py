import paho.mqtt.client as mqtt
import json
import subprocess

CONFIG_FILE_PATH = 'JSON/Config/installed_devices.json'

def load_installed_devices():
    with open(CONFIG_FILE_PATH, 'r') as file:
        return json.load(file)

def save_installed_devices(devices):
    with open(CONFIG_FILE_PATH, 'w') as file:
        json.dump(devices, file, indent=4)

def restart_service():
    try:
        subprocess.run(['sudo', 'systemctl', 'restart', 'device_config_snmp.service'], check=True)
        print("Service restarted successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Failed to restart service: {e}")

def on_message(client, userdata, message):
    print(f"Received message: {message.payload.decode('utf-8')} on topic {message.topic}")
    payload = message.payload.decode('utf-8')
    try:
        command = json.loads(payload)
        devices = load_installed_devices()

        if command.get('command') == 'getDataModbus':
            response = json.dumps(devices)
        elif command.get('command') == 'getDataByProtocol':
            protocol = command.get('protocol')
            response = json.dumps([device for device in devices if device['protocol_setting']['protocol'] == protocol])
        elif command.get('command') == 'addDevice':
            devices.append(command.get('device'))
            save_installed_devices(devices)
            restart_service()
            response = json.dumps({"status": "success", "message": "Device added successfully"})
        elif command.get('command') == 'updateDevice':
            device_index = next((index for (index, d) in enumerate(devices) if d['profile']['name'] == command.get('deviceName')), None)
            if device_index is not None:
                devices[device_index] = command.get('device')
                save_installed_devices(devices)
                restart_service()
                response = json.dumps({"status": "success", "message": "Device updated successfully"})
            else:
                response = json.dumps({"status": "error", "message": "Device not found"})
        elif command.get('command') == 'deleteDevice':
            devices = [d for d in devices if d['profile']['name'] != command.get('deviceName')]
            save_installed_devices(devices)
            restart_service()
            response = json.dumps({"status": "success", "message": "Device deleted successfully"})
        else:
            response = json.dumps({"status": "error", "message": "Unknown command"})
        
        print(f"Publishing response: {response}")
        client.publish("response_device_modbus", response)
    except Exception as e:
        error_msg = f"Error processing message: {e}"
        print(error_msg)
        client.publish("response_device_modbus", json.dumps({"status": "error", "message": error_msg}))

def main():
    client = mqtt.Client()
    client.on_message = on_message
    client.connect("localhost", 1883, 60)
    client.subscribe("command_device_modbus")
    client.loop_start()

    while True:
        pass

if __name__ == "__main__":
    main()
