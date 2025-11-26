import paho.mqtt.client as mqtt
import json
import subprocess
import os
import sys
import time
import threading
import getpass
import netifaces as ni
from getmac import get_mac_address
from datetime import datetime
import uuid
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("========== Device Config ==========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("========== Device Config ==========")
    print("Success To Running")
    print("")

def print_broker_status(local_status=False, data_status=False):
    """Print MQTT broker connection status"""
    if local_status:
        print("MQTT Broker Local is Running")
    else:
        print("MQTT Broker Local connection failed")
    
    if data_status:
        print("MQTT Broker Data is Running")
    else:
        print("MQTT Broker Data connection failed")
    
    print("\n" + "="*34)
    print("Log print Data")
    print("")

def log_simple(message, level="INFO"):
    """Simple logging without timestamp for cleaner output"""
    if level == "ERROR":
        print(f"[ERROR] {message}")
    elif level == "SUCCESS":
        print(f"[OK] {message}")
    elif level == "WARNING":
        print(f"[WARN] {message}")
    else:
        print(f"[INFO] {message}")

# --- Connection Status Tracking ---
local_broker_connected = False
data_broker_connected = False

# Configuration paths
MODBUS_SNMP_CONFIG_PATH = '../MODBUS_SNMP/JSON/Config/installed_devices.json'
I2C_CONFIG_PATH = '../MODULAR_I2C/JSON/Config/installed_devices.json'
DEVICES_SUMMARY_PATH = '../MODBUS_SNMP/JSON/Config/Library/devices_summary.json'
DEVICE_MODBUS_LIBRARY = '../MODBUS_SNMP/JSON/Config/Library/devices.json'
DEVICE_I2C_LIBRARY = '../MODULAR_I2C/JSON/Config/Library/devices.json'
MQTT_CONFIG_PATH = '../MODULAR_I2C/JSON/Config/mqtt_config.json'
MQTT_BROKER = "18.143.215.113"  # Ubah ke broker yang Anda gunakan
MQTT_PORT = 1883
MQTT_PING_TOPIC = "request/ping"  # Topik untuk menerima permintaan ping
MQTT_RESULT_TOPIC = "response/ping"  # Topik untuk mengirim hasil ping

# MQTT Topics for 18.143.215.113 brokerS
MODBUS_SNMP_COMMAND_TOPIC = "command_device_modbus"
MODBUS_SNMP_RESPONSE_TOPIC = "response_device_modbus"
I2C_COMMAND_TOPIC = "command_device_i2c"
I2C_RESPONSE_TOPIC = "response_device_i2c"
SERVICE_RESTART_COMMAND_TOPIC = "command_service_restart"
SERVICE_RESTART_RESPONSE_TOPIC = "response_service_restart"
SCAN_I2C_COMMAND_TOPIC = "command/i2c_scan"  # Tambahan untuk topik scan I2C
SCAN_I2C_RESPONSE_TOPIC = "response/i2c_scan"  # Tambahan untuk respon scan I2C
DEVICE_SELECTION_COMMAND_TOPIC = "command_device_selection"  # Topic untuk dynamic device selection
I2C_DEVICE_SELECTION_COMMAND_TOPIC = "command_i2c_device_selection"  # Topic untuk I2C dynamic device selection

# MQTT Topic for centralized error logging
ERROR_LOG_TOPIC = "subrack/error/log"
QOS = 1

# MQTT Topics for data publishing broker
MODBUS_SNMP_DATA_TOPIC = "data_device_modbus_node"
I2C_DATA_TOPIC = "data_device_i2c_node"
REQUEST_DATA_TOPIC = "request_data"

# MQTT Topics for available devices (centralized)
MODULAR_DEVICE_AVAILABLES_TOPIC = "MODULAR_DEVICE/AVAILABLES"
MODBUS_DEVICE_AVAILABLES_TOPIC = "MODBUS_DEVICE/AVAILABLES"


# Load default devices from file
def load_default_devices():
    try:
        with open(MODBUS_SNMP_CONFIG_PATH, 'r') as file:
            content = file.read()
            if not content:
                return []
            return json.loads(content)
    except FileNotFoundError as e:
        error_msg = f"File {MODBUS_SNMP_CONFIG_PATH} not found"
        send_error_log("load_default_devices", error_msg, ERROR_TYPE_MAJOR, {"file_path": MODBUS_SNMP_CONFIG_PATH})
        return []
    except json.JSONDecodeError as e:
        error_msg = f"Error decoding JSON from {MODBUS_SNMP_CONFIG_PATH}: {e}"
        send_error_log("load_default_devices", error_msg, ERROR_TYPE_MAJOR, {"file_path": MODBUS_SNMP_CONFIG_PATH})
        return []

# Load MQTT configuration
def load_mqtt_config():
    default_config = {
        "enable": True,
        "broker_address": "18.143.215.113",
        "broker_port": 1883,
        "username": "",
        "password": "",
        "qos": 1,
        "retain": True,
        "mac_address": "00:00:00:00:00:00"
    }

    while True:
        try:
            with open(MQTT_CONFIG_PATH, 'r') as file:
                content = file.read().strip()
                if not content:
                    send_error_log("load_mqtt_config", "MQTT config file is empty. Retrying...", ERROR_TYPE_WARNING, {"file_path": MQTT_CONFIG_PATH})
                    time.sleep(5)
                    continue
                return json.loads(content)
        except FileNotFoundError as e:
            error_msg = "MQTT config file not found. Creating default config and retrying..."
            send_error_log("load_mqtt_config", error_msg, ERROR_TYPE_WARNING, {"file_path": MQTT_CONFIG_PATH})
            try:
                os.makedirs(os.path.dirname(MQTT_CONFIG_PATH), exist_ok=True)
                with open(MQTT_CONFIG_PATH, 'w') as file:
                    json.dump(default_config, file, indent=4)
                log_simple(f"Created default MQTT config file: {MQTT_CONFIG_PATH}", "INFO")
            except Exception as create_error:
                send_error_log("load_mqtt_config", f"Failed to create config file: {create_error}", ERROR_TYPE_WARNING, {"file_path": MQTT_CONFIG_PATH})
                time.sleep(5)
                continue
        except json.JSONDecodeError as e:
            error_msg = f"Error decoding MQTT config: {e}"
            send_error_log("load_mqtt_config", error_msg, ERROR_TYPE_MAJOR, {"file_path": MQTT_CONFIG_PATH})
            return default_config
        except Exception as e:
            error_msg = f"Unexpected error loading MQTT config: {e}. Retrying..."
            send_error_log("load_mqtt_config", error_msg, ERROR_TYPE_WARNING, {"file_path": MQTT_CONFIG_PATH})
            time.sleep(5)
            continue

# Load installed devices from file
def load_installed_devices(config_path):
    try:
        with open(config_path, 'r') as file:
            content = file.read()
            if not content:
                return []
            return json.loads(content)
    except FileNotFoundError as e:
        error_msg = f"File {config_path} not found"
        send_error_log("load_installed_devices", error_msg, ERROR_TYPE_MAJOR, {"file_path": config_path})
        return []
    except json.JSONDecodeError as e:
        error_msg = f"Error decoding JSON from {config_path}: {e}"
        send_error_log("load_installed_devices", error_msg, ERROR_TYPE_MAJOR, {"file_path": config_path})
        return []

# Save installed devices to file
def save_installed_devices(config_path, devices):
    try:
        with open(config_path, 'w') as file:
            json.dump(devices, file, indent=4)
    except IOError as e:
        error_msg = f"Error saving devices: {e}"
        send_error_log("save_installed_devices", error_msg, ERROR_TYPE_MAJOR, {"file_path": config_path})

# Load device summary from devices_summary.json
def load_devices_summary():
    try:
        with open(DEVICES_SUMMARY_PATH, 'r') as file:
            return json.load(file)
    except FileNotFoundError as e:
        error_msg = f"File {DEVICES_SUMMARY_PATH} not found"
        send_error_log("load_devices_summary", error_msg, ERROR_TYPE_MAJOR, {"file_path": DEVICES_SUMMARY_PATH})
        return {}
    except json.JSONDecodeError as e:
        error_msg = f"Error decoding JSON from {DEVICES_SUMMARY_PATH}: {e}"
        send_error_log("load_devices_summary", error_msg, ERROR_TYPE_MAJOR, {"file_path": DEVICES_SUMMARY_PATH})
        return {}

# Restart a service
def restart_service(service_name):
    try:
        subprocess.run(['sudo', 'systemctl', 'restart', service_name], check=True)
        print(f"Service {service_name} restarted successfully.")
        return {"status": "success", "message": f"Service {service_name} restarted successfully."}
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to restart service: {e}"
        send_error_log("restart_service", error_msg, ERROR_TYPE_MAJOR, {"service_name": service_name})
        return {"status": "error", "message": error_msg}

# Handle incoming MQTT messages for Modbus SNMP
def handle_modbus_snmp_message(client, userdata, message):
    print(f"Received Modbus SNMP message: {message.payload.decode('utf-8')} on topic {message.topic}")
    payload = message.payload.decode('utf-8')
    try:
        command = json.loads(payload)
        devices = load_installed_devices(MODBUS_SNMP_CONFIG_PATH)
        response = {}

        if command.get('command') == 'getDataModbus':
            response = devices

        elif command.get('command') == 'getDataByProtocol':
            protocol = command.get('protocol')
            filtered_devices = [device for device in devices if device['protocol_setting']['protocol'] == protocol]
            response = filtered_devices

        elif command.get('command') == 'addDevice':
            new_device = command.get('device')

            devices.append(new_device)
            save_installed_devices(MODBUS_SNMP_CONFIG_PATH, devices)
            response = {"status": "success", "message": "Device added successfully"}
        elif command.get('command') == 'updateDevice':
            old_name = command.get('old_name')
            updated_device = command.get('device')

            if old_name is not None and updated_device:
                for device in devices:
                    if device['profile']['name'] == old_name:
                        device['profile'] = updated_device['profile']
                        device['protocol_setting'] = updated_device['protocol_setting']
                        save_installed_devices(MODBUS_SNMP_CONFIG_PATH, devices)
                        response = {"status": "success", "message": "Device updated successfully"}
                        break
                else:
                    response = {"status": "error", "message": "Device not found"}
            else:
                response = {"status": "error", "message": "Invalid data provided"}

        elif command.get('command') == 'deleteDevice':
            device_name = command.get('name')
            devices = [device for device in devices if device['profile']['name'] != device_name]
            save_installed_devices(MODBUS_SNMP_CONFIG_PATH, devices)
            response = {"status": "success", "message": "Device deleted successfully"}

        elif command.get('command') == 'getDataSummaryByProtocol':
            protocol = command.get('protocol')
            devices_summary = load_devices_summary()

            if protocol in devices_summary:
                filtered_data = devices_summary[protocol]
                response = filtered_data
            else:
                response = {"status": "error", "message": f"No data found for protocol: {protocol}"}

        else:
            response = {"status": "error", "message": "Unknown command"}

        print(f"Publishing response: {response}")
        client.publish(MODBUS_SNMP_RESPONSE_TOPIC, json.dumps(response))

    except Exception as e:
        error_msg = f"Error processing Modbus SNMP message: {e}"
        send_error_log("handle_modbus_snmp_message", error_msg, ERROR_TYPE_MAJOR, {"payload": payload})
        client.publish(MODBUS_SNMP_RESPONSE_TOPIC, json.dumps({"status": "error", "message": str(e)}))

# Handle incoming MQTT messages for I2C
def handle_i2c_message(client, userdata, message):
    print(f"Received I2C message: {message.payload.decode('utf-8')} on topic {message.topic}")
    payload = message.payload.decode('utf-8')
    print(f"Raw payload: {payload}")
    installed_devices = load_installed_devices(I2C_CONFIG_PATH)
    response = {}

    try:
        command = json.loads(payload)

        if command.get('command') == 'getDataI2C':
            print("Processing getDataI2C command")
            print(f"Installed devices found: {len(installed_devices)}")
            print(f"Device data: {installed_devices}")
            response = installed_devices

        elif command.get('command') == 'addDevice':
            new_device = command.get('device')

            for device in installed_devices:
                if device['profile']['name'] == new_device['profile']['name'] or device['protocol_setting']['address'] == new_device['protocol_setting']['address']:
                    response = {"status": "error", "message": "Device with the same name or address already exists."}
                    client.publish(I2C_RESPONSE_TOPIC, json.dumps(response), qos=1, retain=False)
                    return

            installed_devices.append(new_device)
            save_installed_devices(I2C_CONFIG_PATH, installed_devices)
            response = {"status": "success", "message": "Device added successfully"}
            # Don't publish here, will be handled at the end

        elif command.get('command') == 'updateDevice':
            old_name = command.get('old_name')
            updated_device = command.get('device')

            if old_name is not None and updated_device:
                for device in installed_devices:
                    if device['profile']['name'] == old_name:
                        device['profile'] = updated_device['profile']
                        device['protocol_setting'] = updated_device['protocol_setting']
                        save_installed_devices(I2C_CONFIG_PATH, installed_devices)
                        response = {"status": "success", "message": "Device updated successfully"}
                        break
                else:
                    response = {"status": "error", "message": "Device not found"}
            else:
                response = {"status": "error", "message": "Invalid data provided"}

        elif command.get('command') == 'deleteDevice':
            device_name = command.get('name')
            installed_devices = [device for device in installed_devices if device.get('profile', {}).get('name') != device_name]
            save_installed_devices(I2C_CONFIG_PATH, installed_devices)
            response = {"status": "success", "message": "Device deleted successfully"}

        elif command.get('command') == 'checkI2CAddresses':
            print("Processing checkI2CAddresses command")
            try:
                i2c_result = check_i2c_addresses()
                response = {"status": "success", "data": i2c_result}
            except Exception as e:
                print(f"Error checking I2C addresses: {e}")
                response = {"status": "error", "message": str(e)}

        else:
            response = {"status": "error", "message": "Unknown command"}

        # Send response
        print(f"Sending I2C response: {response}")
        client.publish(I2C_RESPONSE_TOPIC, json.dumps(response), qos=0, retain=False)

    except json.JSONDecodeError as e:
        error_msg = f"Error decoding I2C message payload: {e}"
        send_error_log("handle_i2c_message", error_msg, ERROR_TYPE_MAJOR, {"payload": payload})
    except Exception as e:
        error_msg = f"Error processing I2C message: {e}"
        send_error_log("handle_i2c_message", error_msg, ERROR_TYPE_MAJOR, {"payload": payload})

# Handle incoming MQTT messages for service restart
def handle_service_restart_message(client, userdata, message):
    print(f"Received Service Restart message: {message.payload.decode('utf-8')} on topic {message.topic}")
    payload = message.payload.decode('utf-8')
    try:
        command = json.loads(payload)

        if command.get('command') == 'restartService':
            service_name = command.get('service')
            response = restart_service(service_name)
        else:
            response = {"status": "error", "message": "Unknown command"}

        client.publish(SERVICE_RESTART_RESPONSE_TOPIC, json.dumps(response), qos=0, retain=False)

    except json.JSONDecodeError as e:
        error_msg = f"Error decoding Service Restart message payload: {e}"
        send_error_log("handle_service_restart_message", error_msg, ERROR_TYPE_MAJOR, {"payload": payload})
    except Exception as e:
        error_msg = f"Error processing Service Restart message: {e}"
        send_error_log("handle_service_restart_message", error_msg, ERROR_TYPE_MAJOR, {"payload": payload})

# Handle I2C scan command and publish result
def handle_i2c_scan_message(client, userdata, message):
    print(f"Received I2C scan command on topic {message.topic}")
    payload = message.payload.decode()
    print(f"Payload: {payload}")

    try:
        command = json.loads(payload)
        if command.get("command") == "scan_i2c":
            print("Executing I2C scan...")
            result = check_i2c_addresses()
            response = {"status": "success", "data": result}
            print(f"Publishing I2C scan result: {response}")
            client.publish(SCAN_I2C_RESPONSE_TOPIC, json.dumps(response))
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON format for I2C scan: {e}"
        send_error_log("handle_i2c_scan_message", error_msg, ERROR_TYPE_MAJOR, {"payload": payload})
    except Exception as e:
        error_msg = f"Error processing I2C scan command: {e}"
        send_error_log("handle_i2c_scan_message", error_msg, ERROR_TYPE_MAJOR, {"payload": payload})

# Check I2C addresses using the i2cdetect command
def check_i2c_addresses():
    try:
        result = subprocess.run(['sudo', 'i2cdetect', '-y', '0'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        error_msg = f"Error running i2cdetect command: {e}"
        send_error_log("check_i2c_addresses", error_msg, ERROR_TYPE_MAJOR, {"command": "i2cdetect -y 0"})
        return ""

# Get local MAC, IP, and username (shortName)
def get_local_mac_ip_username():
    mac_address = "Unknown"
    ip_address = "Unknown"
    username = getpass.getuser()

    try:
        interfaces = ni.interfaces()

        for iface in interfaces:
            if iface == 'lo':
                continue

            current_mac = get_mac_address(interface=iface)
            if current_mac:
                mac_address = current_mac

            if ni.AF_INET in ni.ifaddresses(iface):
                ip_address = ni.ifaddresses(iface)[ni.AF_INET][0]['addr']
                if mac_address != "Unknown" and ip_address != "Unknown":
                    break

        if ip_address == "Unknown":
            print("Error: No active network interface found with an IPv4 address.")

    except Exception as e:
        error_msg = f"Error getting local MAC/IP/username: {e}"
        send_error_log("get_local_mac_ip_username", error_msg, ERROR_TYPE_MAJOR)

    return mac_address, ip_address, username

# Send device data
def send_device_data(client, device_type, data):
    try:
        mac, ip, username = get_local_mac_ip_username()
        payload = {
            "mac": mac,
            "ip": ip,
            "shortName": username,
            "type": device_type,
            "devices": data
        }
        topic = MODBUS_SNMP_DATA_TOPIC if device_type == "modbus" else I2C_DATA_TOPIC
        client.publish(topic, json.dumps(payload))
    except Exception as e:
        error_msg = f"Error sending device data: {e}"
        send_error_log("send_device_data", error_msg, ERROR_TYPE_MAJOR, {"device_type": device_type})

# Callback ketika pesan diterima
def on_message(client, userdata, message):
    try:
        if message.topic == MQTT_PING_TOPIC:
            print(f"Pesan diterima dari topik {MQTT_PING_TOPIC}")

        payload = message.payload.decode("utf-8")
        print(f"Payload diterima: {payload}")

        try:
            parsed_payload = json.loads(payload)
            command = parsed_payload.get("command")
            print(f"Command ditemukan: {command}")

            if command == "device_modbus":
                print("Menangani perintah device_modbus")
                devices = load_installed_devices(MODBUS_SNMP_CONFIG_PATH)
                send_device_data(client, "modbus", devices)
            elif command == "device_i2c":
                print("Menangani perintah device_i2c")
                devices = load_installed_devices(I2C_CONFIG_PATH)
                send_device_data(client, "i2c", devices)
            else:
                print(f"Perintah tidak dikenal: {command}")
        except json.JSONDecodeError:
            ip_address = payload.strip()
            print(f"Permintaan ping untuk IP: {ip_address}")

            result = os.system(f"ping -c 2 {ip_address}")

            if result == 0:
                client.publish(MQTT_RESULT_TOPIC, f"Ping to {ip_address} successful")
                print(f"Ping ke {ip_address} berhasil.")
            else:
                client.publish(MQTT_RESULT_TOPIC, f"Ping to {ip_address} failed")
                print(f"Ping ke {ip_address} gagal.")

    except Exception as e:
        error_msg = f"Error during message handling: {e}"
        send_error_log("on_message", error_msg, ERROR_TYPE_MAJOR, {"topic": message.topic})

# Periodic sending function with performance optimization
def periodic_publish(client):
    # Performance optimization: Configurable intervals and caching
    PUBLISH_INTERVAL = 60  # Increased from 10s to 60s for better performance
    ERROR_RETRY_INTERVAL = 30  # Wait longer on errors

    last_modbus_devices = None
    last_i2c_devices = None
    last_modbus_mod_time = 0
    last_i2c_mod_time = 0

    while True:
        try:
            # Performance: Only reload devices if config files have changed
            modbus_changed = False
            i2c_changed = False

            try:
                modbus_mod_time = os.path.getmtime(MODBUS_SNMP_CONFIG_PATH)
                if modbus_mod_time != last_modbus_mod_time:
                    modbus_changed = True
                    last_modbus_mod_time = modbus_mod_time
            except OSError:
                modbus_changed = True  # Force reload if file stat fails

            try:
                i2c_mod_time = os.path.getmtime(I2C_CONFIG_PATH)
                if i2c_mod_time != last_i2c_mod_time:
                    i2c_changed = True
                    last_i2c_mod_time = i2c_mod_time
            except OSError:
                i2c_changed = True  # Force reload if file stat fails

            # Load devices only if configs changed or first time
            if modbus_changed or last_modbus_devices is None:
                modbus_devices = load_installed_devices(MODBUS_SNMP_CONFIG_PATH)
                last_modbus_devices = modbus_devices
            else:
                modbus_devices = last_modbus_devices

            if i2c_changed or last_i2c_devices is None:
                i2c_devices = load_installed_devices(I2C_CONFIG_PATH)
                last_i2c_devices = i2c_devices
            else:
                i2c_devices = last_i2c_devices

            # Publish device data
            send_device_data(client, "modbus", modbus_devices)
            send_device_data(client, "i2c", i2c_devices)

            log_simple(f"Periodic publish completed. Modbus: {len(modbus_devices) if modbus_devices else 0}, I2C: {len(i2c_devices) if i2c_devices else 0} devices", "INFO")

        except Exception as e:
            error_msg = f"Error during periodic publishing: {e}"
            send_error_log("periodic_publish", error_msg, ERROR_TYPE_MAJOR)
            time.sleep(ERROR_RETRY_INTERVAL)
            continue

        time.sleep(PUBLISH_INTERVAL)

def on_connect_operations(client, userdata, flags, rc):
    global local_broker_connected
    if rc == 0:
        local_broker_connected = True
        log_simple("Local MQTT broker connected", "SUCCESS")
        client.subscribe(MQTT_PING_TOPIC)
        client.subscribe(MODBUS_SNMP_COMMAND_TOPIC)
        client.subscribe(I2C_COMMAND_TOPIC)
        client.subscribe(SERVICE_RESTART_COMMAND_TOPIC)
        client.subscribe(SCAN_I2C_COMMAND_TOPIC)
        client.subscribe(DEVICE_SELECTION_COMMAND_TOPIC)
        client.subscribe(I2C_DEVICE_SELECTION_COMMAND_TOPIC)
        client.subscribe("command_available_devices")  # New centralized topic
        
        # Send available devices on connect
        send_all_available_devices(client)
    else:
        local_broker_connected = False
        log_simple(f"Local MQTT broker connection failed (code {rc})", "ERROR")

def on_connect_publishing(client, userdata, flags, rc):
    global data_broker_connected
    if rc == 0:
        data_broker_connected = True
        log_simple("Data MQTT broker connected", "SUCCESS")
        client.subscribe(REQUEST_DATA_TOPIC)
    else:
        data_broker_connected = False
        log_simple(f"Data MQTT broker connection failed (code {rc})", "ERROR")

def on_disconnect(client, userdata, rc):
    global local_broker_connected, data_broker_connected
    if rc != 0:
        local_broker_connected = False
        data_broker_connected = False
        log_simple("MQTT broker disconnected", "WARNING")
        while True:
            try:
                client.reconnect()
                print("Reconnected to MQTT broker.")
                break
            except Exception as e:
                print(f"Reconnection failed: {e}")
                time.sleep(5)

# --- Fungsi baru untuk mencoba koneksi ---
def try_connect_mqtt(client, broker_address, broker_port):
    while True:
        try:
            print(f"Mencoba menyambungkan ke broker MQTT di {broker_address}:{broker_port}...")
            client.connect(broker_address, broker_port)
            print(f"Koneksi ke broker MQTT di {broker_address}:{broker_port} BERHASIL.")
            return True
        except Exception as e:
            print(f"Error: Koneksi ke broker MQTT di {broker_address}:{broker_port} GAGAL: {e}. Retrying in 5 seconds...")
            time.sleep(5)
            continue
# --- Akhir fungsi baru ---

# Setup MQTT client for 18.143.215.113 broker (operations)
def setup_mqtt_client_operations():
    client = mqtt.Client()

    client.on_connect = on_connect_operations
    client.on_disconnect = on_disconnect

    client.message_callback_add(MODBUS_SNMP_COMMAND_TOPIC, handle_modbus_snmp_message)
    client.message_callback_add(I2C_COMMAND_TOPIC, handle_i2c_message)
    client.message_callback_add(SERVICE_RESTART_COMMAND_TOPIC, handle_service_restart_message)
    client.message_callback_add(SCAN_I2C_COMMAND_TOPIC, handle_i2c_scan_message)
    client.message_callback_add(DEVICE_SELECTION_COMMAND_TOPIC, handle_device_selection_message)
    client.message_callback_add(I2C_DEVICE_SELECTION_COMMAND_TOPIC, handle_i2c_device_selection_message)
    client.message_callback_add("command_available_devices", handle_available_devices_command)

    # Menggunakan fungsi try_connect_mqtt
    if not try_connect_mqtt(client, '18.143.215.113', 1883):
        # Jika koneksi gagal, Anda bisa menambahkan penanganan error lebih lanjut di sini
        # Misalnya, keluar dari program atau mencoba lagi setelah beberapa saat
        pass # Untuk saat ini, kita hanya akan mencetak error

    return client

# Setup MQTT client for data publishing broker
def setup_mqtt_client_publishing():
    client = mqtt.Client()

    mqtt_config = load_mqtt_config()
    username = mqtt_config.get('username', None)
    password = mqtt_config.get('password', None)

    if username and password:
        client.username_pw_set(username, password)

    client.on_connect = on_connect_publishing
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    broker_address = mqtt_config.get("broker_address", MQTT_BROKER)
    broker_port = int(mqtt_config.get("broker_port", MQTT_PORT))

    # Menggunakan fungsi try_connect_mqtt
    if not try_connect_mqtt(client, broker_address, broker_port):
        # Jika koneksi gagal, Anda bisa menambahkan penanganan error lebih lanjut di sini
        # Misalnya, keluar dari program atau mencoba lagi setelah beberapa saat
        pass # Untuk saat ini, kita hanya akan mencetak error

    return client

# --- Dynamic Device Selection Functions ---
def load_device_library(library_type="modbus"):
    """Load device library from devices.json"""
    library_path = DEVICE_MODBUS_LIBRARY if library_type == "modbus" else DEVICE_I2C_LIBRARY
    
    try:
        if os.path.exists(library_path):
            with open(library_path, 'r') as file:
                return json.load(file)
        else:
            log_simple(f"Device library not found: {library_path}", "WARNING")
            return {}
    except Exception as e:
        error_msg = f"Error loading {library_type} device library: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log("load_device_library", error_msg, ERROR_TYPE_MAJOR, {"file_path": library_path, "library_type": library_type})
        return {}

def get_device_types(library_type="modbus"):
    """Get all available device types"""
    library = load_device_library(library_type)
    device_types = list(library.keys())
    log_simple(f"Found {len(device_types)} {library_type} device types: {device_types}", "INFO")
    return device_types

def get_manufacturers_by_type(device_type, library_type="modbus"):
    """Get all manufacturers for a specific device type"""
    library = load_device_library(library_type)
    if device_type not in library:
        return []
    
    manufacturers = []
    for device in library[device_type]:
        if 'manufacturer' in device and device['manufacturer'] not in manufacturers:
            manufacturers.append(device['manufacturer'])
    
    log_simple(f"Found {len(manufacturers)} manufacturers for {library_type} {device_type}: {manufacturers}", "INFO")
    return manufacturers

def get_part_numbers_by_manufacturer(device_type, manufacturer, library_type="modbus"):
    """Get all part numbers for a specific device type and manufacturer"""
    library = load_device_library(library_type)
    if device_type not in library:
        return []
    
    part_numbers = []
    for device in library[device_type]:
        if (device.get('manufacturer') == manufacturer and 
            'part_number' in device and 
            device['part_number'] not in part_numbers):
            part_numbers.append(device['part_number'])
    
    log_simple(f"Found {len(part_numbers)} part numbers for {library_type} {device_type}/{manufacturer}: {part_numbers}", "INFO")
    return part_numbers

def get_device_summary(library_type="modbus"):
    """Get summary of all devices organized by type"""
    library = load_device_library(library_type)
    summary = {}
    
    for device_type, devices in library.items():
        summary[device_type] = {
            'count': len(devices),
            'manufacturers': list(set([d.get('manufacturer', 'Unknown') for d in devices])),
            'protocols': list(set([d.get('protocol', 'Unknown') for d in devices]))
        }
    
    log_simple(f"Generated {library_type} device summary for {len(summary)} device types", "INFO")
    return summary

# Handle incoming MQTT messages for dynamic device selection
def handle_device_selection_message(client, userdata, message):
    """Handle MQTT messages for dynamic device selection"""
    print(f"Received device selection message: {message.payload.decode('utf-8')} on topic {message.topic}")
    payload = message.payload.decode('utf-8')
    
    try:
        command = json.loads(payload)
        response = {}

        if command.get('command') == 'getDeviceTypes':
            device_types = get_device_types("modbus")
            response = {
                "status": "success",
                "message": "Device types retrieved successfully",
                "data": device_types
            }

        elif command.get('command') == 'getManufacturers':
            device_type = command.get('device_type')
            if device_type:
                manufacturers = get_manufacturers_by_type(device_type, "modbus")
                response = {
                    "status": "success",
                    "message": f"Manufacturers for {device_type} retrieved successfully",
                    "data": manufacturers
                }
            else:
                response = {"status": "error", "message": "device_type is required"}

        elif command.get('command') == 'getPartNumbers':
            device_type = command.get('device_type')
            manufacturer = command.get('manufacturer')
            if device_type and manufacturer:
                part_numbers = get_part_numbers_by_manufacturer(device_type, manufacturer, "modbus")
                response = {
                    "status": "success",
                    "message": f"Part numbers for {device_type}/{manufacturer} retrieved successfully",
                    "data": part_numbers
                }
            else:
                response = {"status": "error", "message": "device_type and manufacturer are required"}

        elif command.get('command') == 'getDeviceSummary':
            summary = get_device_summary("modbus")
            response = {
                "status": "success",
                "message": "Device summary retrieved successfully",
                "data": summary
            }

        else:
            response = {"status": "error", "message": "Unknown command"}

        # Publish response
        response_topic = "response_device_selection"
        client.publish(response_topic, json.dumps(response))
        log_simple(f"Published response to {response_topic}: {response['status']}", "INFO")

    except json.JSONDecodeError as e:
        error_response = {"status": "error", "message": f"Invalid JSON: {e}"}
        client.publish("response_device_selection", json.dumps(error_response))
        log_simple(f"JSON decode error: {e}", "ERROR")
    except Exception as e:
        error_response = {"status": "error", "message": f"Internal error: {e}"}
        client.publish("response_device_selection", json.dumps(error_response))
        error_msg = f"Error in device selection handler: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log("handle_device_selection_message", error_msg, ERROR_TYPE_MAJOR, {"command": command})

# Handle incoming MQTT messages for I2C dynamic device selection
def handle_i2c_device_selection_message(client, userdata, message):
    """Handle MQTT messages for I2C dynamic device selection"""
    print(f"Received I2C device selection message: {message.payload.decode('utf-8')} on topic {message.topic}")
    payload = message.payload.decode('utf-8')
    
    try:
        command = json.loads(payload)
        response = {}

        if command.get('command') == 'getDeviceTypes':
            device_types = get_device_types("i2c")
            response = {
                "command": "getDeviceTypes",
                "status": "success",
                "message": "I2C Device types retrieved successfully",
                "data": device_types
            }

        elif command.get('command') == 'getManufacturers':
            device_type = command.get('device_type')
            if device_type:
                manufacturers = get_manufacturers_by_type(device_type, "i2c")
                response = {
                    "command": "getManufacturers",
                    "status": "success",
                    "message": f"Manufacturers for I2C {device_type} retrieved successfully",
                    "data": manufacturers
                }
            else:
                response = {"status": "error", "message": "device_type is required"}

        elif command.get('command') == 'getPartNumbers':
            device_type = command.get('device_type')
            manufacturer = command.get('manufacturer')
            if device_type and manufacturer:
                part_numbers = get_part_numbers_by_manufacturer(device_type, manufacturer, "i2c")
                response = {
                    "command": "getPartNumbers",
                    "status": "success",
                    "message": f"Part numbers for I2C {device_type}/{manufacturer} retrieved successfully",
                    "data": part_numbers
                }
            else:
                response = {"status": "error", "message": "device_type and manufacturer are required"}

        elif command.get('command') == 'getDeviceSummary':
            summary = get_device_summary("i2c")
            response = {
                "status": "success",
                "message": "I2C Device summary retrieved successfully",
                "data": summary
            }

        else:
            response = {"status": "error", "message": "Unknown command"}

        # Publish response
        response_topic = "response_i2c_device_selection"
        client.publish(response_topic, json.dumps(response))
        log_simple(f"Published I2C response to {response_topic}: {response['status']}", "INFO")

    except json.JSONDecodeError as e:
        error_response = {"status": "error", "message": f"Invalid JSON: {e}"}
        client.publish("response_i2c_device_selection", json.dumps(error_response))
        log_simple(f"JSON decode error: {e}", "ERROR")
    except Exception as e:
        error_response = {"status": "error", "message": f"Internal error: {e}"}
        client.publish("response_i2c_device_selection", json.dumps(error_response))
        error_msg = f"Error in I2C device selection handler: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log("handle_i2c_device_selection_message", error_msg, ERROR_TYPE_MAJOR, {"command": command})

# ====== CENTRALIZED DEVICE CONFIGURATION FUNCTIONS ======

def load_modular_i2c_devices():
    """Load available devices from MODULAR_I2C/JSON/Config/installed_devices.json
    Extract name, address, device_bus, part_number, mac, manufacturer, device_type, topic
    """
    try:
        with open(I2C_CONFIG_PATH, 'r') as file:
            devices_data = json.load(file)
        
        available_devices = []
        for device in devices_data:
            profile = device.get('profile', {})
            protocol_setting = device.get('protocol_setting', {})
            
            # Generate device ID if not present
            device_id = device.get('id') or str(uuid.uuid4())
            
            available_device = {
                "id": device_id,
                "name": profile.get('name', ''),
                "address": protocol_setting.get('address', 0),
                "device_bus": protocol_setting.get('device_bus', 0), 
                "part_number": profile.get('part_number', ''),
                "mac": "",  # Usually empty for I2C devices
                "manufacturer": profile.get('manufacturer', ''),
                "device_type": profile.get('device_type', ''),
                "topic": profile.get('topic', '')
            }
            available_devices.append(available_device)
        
        log_simple(f"Loaded {len(available_devices)} MODULAR I2C devices", "SUCCESS")
        return available_devices
        
    except FileNotFoundError:
        log_simple(f"MODULAR I2C config file not found: {I2C_CONFIG_PATH}", "ERROR")
        send_error_log("load_modular_i2c_devices", f"MODULAR I2C config file not found: {I2C_CONFIG_PATH}", ERROR_TYPE_MAJOR, {"file": I2C_CONFIG_PATH})
        return []
    except json.JSONDecodeError as e:
        log_simple(f"Error decoding MODULAR I2C JSON: {e}", "ERROR")
        send_error_log("load_modular_i2c_devices", f"Error decoding MODULAR I2C JSON: {e}", ERROR_TYPE_MAJOR, {"file": I2C_CONFIG_PATH})
        return []
    except Exception as e:
        log_simple(f"Error loading MODULAR I2C devices: {e}", "ERROR")
        send_error_log("load_modular_i2c_devices", f"Error loading MODULAR I2C devices: {e}", ERROR_TYPE_MAJOR, {"file": I2C_CONFIG_PATH})
        return []

def load_modbus_snmp_devices():
    """Load available devices from MODBUS_SNMP/JSON/Config/installed_devices.json
    Extract name, address, device_bus, part_number, mac, manufacturer, device_type, topic
    """
    try:
        with open(MODBUS_SNMP_CONFIG_PATH, 'r') as file:
            devices_data = json.load(file)
        
        available_devices = []
        for device in devices_data:
            profile = device.get('profile', {})
            protocol_setting = device.get('protocol_setting', {})
            
            # Generate device ID if not present
            device_id = device.get('id') or str(uuid.uuid4())
            
            available_device = {
                "id": device_id,
                "name": profile.get('name', ''),
                "address": protocol_setting.get('ip_address', ''),  # For MODBUS/SNMP, address is IP
                "device_bus": 0,  # Not applicable for MODBUS/SNMP
                "part_number": profile.get('part_number', ''),
                "mac": "",  # Usually not available for MODBUS/SNMP devices
                "manufacturer": profile.get('manufacturer', ''),
                "device_type": profile.get('device_type', ''),
                "topic": profile.get('topic', '')
            }
            available_devices.append(available_device)
        
        log_simple(f"Loaded {len(available_devices)} MODBUS SNMP devices", "SUCCESS")
        return available_devices
        
    except FileNotFoundError:
        log_simple(f"MODBUS SNMP config file not found: {MODBUS_SNMP_CONFIG_PATH}", "ERROR")
        send_error_log("load_modbus_snmp_devices", f"MODBUS SNMP config file not found: {MODBUS_SNMP_CONFIG_PATH}", ERROR_TYPE_MAJOR, {"file": MODBUS_SNMP_CONFIG_PATH})
        return []
    except json.JSONDecodeError as e:
        log_simple(f"Error decoding MODBUS SNMP JSON: {e}", "ERROR")
        send_error_log("load_modbus_snmp_devices", f"Error decoding MODBUS SNMP JSON: {e}", ERROR_TYPE_MAJOR, {"file": MODBUS_SNMP_CONFIG_PATH})
        return []
    except Exception as e:
        log_simple(f"Error loading MODBUS SNMP devices: {e}", "ERROR")
        send_error_log("load_modbus_snmp_devices", f"Error loading MODBUS SNMP devices: {e}", ERROR_TYPE_MAJOR, {"file": MODBUS_SNMP_CONFIG_PATH})
        return []

def send_modular_available_devices(client):
    """Send MODULAR I2C available devices to MODULAR_DEVICE/AVAILABLES topic"""
    try:
        available_devices = load_modular_i2c_devices()
        if available_devices:
            client.publish(MODULAR_DEVICE_AVAILABLES_TOPIC, json.dumps(available_devices), qos=0, retain=False)
            log_simple(f"Published {len(available_devices)} MODULAR devices to {MODULAR_DEVICE_AVAILABLES_TOPIC}", "SUCCESS")
        else:
            log_simple("No MODULAR I2C devices to publish", "WARNING")
    except Exception as e:
        error_msg = f"Failed to send MODULAR available devices: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log("send_modular_available_devices", error_msg, ERROR_TYPE_MAJOR)

def send_modbus_available_devices(client):
    """Send MODBUS SNMP available devices to MODBUS_DEVICE/AVAILABLES topic"""
    try:
        available_devices = load_modbus_snmp_devices()
        if available_devices:
            client.publish(MODBUS_DEVICE_AVAILABLES_TOPIC, json.dumps(available_devices), qos=0, retain=False)
            log_simple(f"Published {len(available_devices)} MODBUS devices to {MODBUS_DEVICE_AVAILABLES_TOPIC}", "SUCCESS")
        else:
            log_simple("No MODBUS SNMP devices to publish", "WARNING")
    except Exception as e:
        error_msg = f"Failed to send MODBUS available devices: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log("send_modbus_available_devices", error_msg, ERROR_TYPE_MAJOR)

def send_all_available_devices(client):
    """Send all available devices from both MODULAR I2C and MODBUS SNMP"""
    log_simple("Sending all available devices...", "INFO")
    send_modular_available_devices(client)
    send_modbus_available_devices(client)



def periodic_available_devices_publish(client):
    """Periodic publishing of available devices every 30 seconds"""
    while True:
        try:
            if client.is_connected():
                send_all_available_devices(client)
                log_simple("Periodic available devices published", "INFO")
            else:
                log_simple("Client not connected, skipping available devices publish", "WARNING")
        except Exception as e:
            error_msg = f"Error during periodic available devices publishing: {e}"
            log_simple(error_msg, "ERROR")
            send_error_log("periodic_available_devices_publish", error_msg, ERROR_TYPE_MAJOR)
        time.sleep(30)  # Send every 30 seconds

def handle_available_devices_command(client, userdata, message):
    """Handle MQTT commands for available devices"""
    print(f"Received available devices command: {message.payload.decode('utf-8')} on topic {message.topic}")
    payload = message.payload.decode('utf-8')
    
    try:
        command = json.loads(payload)
        response = {}

        if command.get('command') == 'get_modular_availables':
            devices = load_modular_i2c_devices()
            client.publish(MODULAR_DEVICE_AVAILABLES_TOPIC, json.dumps(devices), qos=0, retain=False)
            log_simple(f"Published {len(devices)} MODULAR devices to topic", "SUCCESS")
            response = {"status": "success", "message": f"Published {len(devices)} MODULAR devices"}
            
        elif command.get('command') == 'get_modbus_availables':
            devices = load_modbus_snmp_devices()
            client.publish(MODBUS_DEVICE_AVAILABLES_TOPIC, json.dumps(devices), qos=0, retain=False)
            log_simple(f"Published {len(devices)} MODBUS devices to topic", "SUCCESS")
            response = {"status": "success", "message": f"Published {len(devices)} MODBUS devices"}
            
        elif command.get('command') == 'get_all_availables':
            send_all_available_devices(client)
            response = {"status": "success", "message": "Published all available devices"}
            
        else:
            response = {"status": "error", "message": "Unknown command"}
        
        # Send response back
        client.publish("response_available_devices", json.dumps(response), qos=0, retain=False)
        
    except json.JSONDecodeError as e:
        error_response = {"status": "error", "message": f"Invalid JSON: {e}"}
        client.publish("response_available_devices", json.dumps(error_response))
        log_simple(f"JSON decode error: {e}", "ERROR")
    except Exception as e:
        error_response = {"status": "error", "message": f"Internal error: {e}"}
        client.publish("response_available_devices", json.dumps(error_response))
        error_msg = f"Error in available devices handler: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log("handle_available_devices_command", error_msg, ERROR_TYPE_MAJOR, {"command": command})

# ====== END CENTRALIZED DEVICE CONFIGURATION FUNCTIONS ======

# Main function to run both clients
def main():
    global local_broker_connected, data_broker_connected
    
    # Print startup banner
    print_startup_banner()
    
    log_simple("Initializing error logger...")
    initialize_error_logger("device_config")
    
    log_simple("Setting up MQTT clients...")
    client_operations = setup_mqtt_client_operations()
    client_publishing = setup_mqtt_client_publishing()

    # Wait a moment for connections to establish
    time.sleep(2)
    
    # Print success banner and broker status
    print_success_banner()
    print_broker_status(local_broker_connected, data_broker_connected)

    log_simple("Starting periodic publish thread...")
    threading.Thread(target=periodic_publish, args=(client_publishing,), daemon=True).start()

    # Start periodic available devices publishing
    log_simple("Starting periodic available devices publishing...")
    threading.Thread(target=periodic_available_devices_publish, args=(client_operations,), daemon=True).start()
    
    log_simple("Device Config service started successfully", "SUCCESS")

    try:
        client_operations.loop_forever()
    except KeyboardInterrupt:
        log_simple("Device config service stopped by user", "WARNING")
    except Exception as e:
        log_simple(f"Critical error: {e}", "ERROR")
        send_error_log("main", f"Unhandled exception in main loop: {e}", "critical")
    finally:
        log_simple("Shutting down services...")
        if error_logger_client:
            error_logger_client.loop_stop()
            error_logger_client.disconnect()
        log_simple("Application terminated", "SUCCESS")

if __name__ == "__main__":
    main()
