import paho.mqtt.client as mqtt
import json
import subprocess
import os

# File paths for configuration and installed devices
installed_devices_path = 'JSON/Config/installed_devices.json'
mqtt_config_path = 'JSON/Config/mqtt_config.json'

# Load installed_devices.json
with open(installed_devices_path, 'r') as f:
    installed_devices = json.load(f)

# Load mqtt_config.json
with open(mqtt_config_path, 'r') as f:
    mqtt_config = json.load(f)

# Save installed_devices.json
def save_installed_devices():
    with open(installed_devices_path, 'w') as f:
        json.dump(installed_devices, f, indent=4)

# MQTT Callback when a message is received
def on_message(client, userdata, message):
    payload = message.payload.decode('utf-8')
    try:
        command = json.loads(payload)
        response = {}

        if command.get('command') == 'getDataI2C':
            # Publish the installed devices data to the response topic
            response = installed_devices
        elif command.get('command') == 'addDevice':
            new_device = command.get('device')
            if new_device:
                installed_devices.append(new_device)
                save_installed_devices()
                response = {"status": "success", "message": "Device added successfully"}
            else:
                response = {"status": "error", "message": "No device data provided"}
        elif command.get('command') == 'updateDevice':
            device_id = command.get('id')
            updated_device = command.get('device')
            if device_id is not None and updated_device:
                for device in installed_devices:
                    if device.get('profile', {}).get('id') == device_id:
                        device.update(updated_device)
                        save_installed_devices()
                        response = {"status": "success", "message": "Device updated successfully"}
                        break
                else:
                    response = {"status": "error", "message": "Device not found"}
            else:
                response = {"status": "error", "message": "Invalid data provided"}
        elif command.get('command') == 'deleteDevice':
            device_id = command.get('id')
            if device_id is not None:
                installed_devices[:] = [device for device in installed_devices if device.get('profile', {}).get('id') != device_id]
                save_installed_devices()
                response = {"status": "success", "message": "Device deleted successfully"}
            else:
                response = {"status": "error", "message": "No device ID provided"}
        elif command.get('command') == 'getDeviceById':
            device_id = command.get('id')
            if device_id is not None:
                for device in installed_devices:
                    if device.get('profile', {}).get('id') == device_id:
                        response = device
                        break
                else:
                    response = {"status": "error", "message": "Device not found"}
            else:
                response = {"status": "error", "message": "No device ID provided"}
        elif command.get('command') == 'checkI2CAddresses':
            try:
                i2c_result = check_i2c_addresses()
                response = {"status": "success", "data": i2c_result}
            except Exception as e:
                response = {"status": "error", "message": str(e)}
        else:
            response = {"status": "error", "message": "Unknown command"}
        
        client.publish("response_device_i2c", json.dumps(response), qos=mqtt_config['qos'], retain=mqtt_config['retain'])
    except Exception as e:
        print(f"Error processing message: {e}")

def check_i2c_addresses():
    # Run the i2cdetect command
    try:
        result = subprocess.run(['sudo', 'i2cdetect', '-y', '0'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, text=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running i2cdetect command: {e}")
        return ""

# Setup MQTT client
client = mqtt.Client()
client.on_message = on_message

if mqtt_config.get('username') and mqtt_config.get('password'):
    client.username_pw_set(mqtt_config['username'], mqtt_config['password'])

client.connect(mqtt_config['broker_address'], mqtt_config['broker_port'])

client.subscribe("command_device_i2c", qos=mqtt_config['qos'])

# Start MQTT loop
client.loop_forever()
