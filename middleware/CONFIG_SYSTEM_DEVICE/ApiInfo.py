from flask import Flask, jsonify, request
from flask_cors import CORS
import netifaces as ni
import uuid
import os
import json
import requests
from multiprocessing.dummy import Pool as ThreadPool
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Paths and constants
MQTT_CONFIG_PATH = "../MODULAR_I2C/JSON/Config/mqtt_config.json"
SERVER_PORT = 8000
ENDPOINT = "/api/info"
TIMEOUT = 2  # seconds for the request timeout

ERROR_LOG_TOPIC = "subrack/error/log"

# Publish error log to MQTT
def log_error(client, error_message, error_type):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    error_payload = {
        "data": error_message,
        "type": error_type,
        "Timestamp": timestamp
    }
    print(f"Error: {error_message}, Type: {error_type}")
    client.publish(ERROR_LOG_TOPIC, json.dumps(error_payload))

# Function to get IP address from a specific interface
def get_ip_address(interface):
    try:
        ip = ni.ifaddresses(interface)[ni.AF_INET][0]['addr']
    except (KeyError, IndexError, ValueError):
        ip = None
    return ip

# Function to get the server IP
def get_server_ip():
    # Try common interfaces (wlan0, eth0, etc.)
    for interface in ['wlan0', 'wlx78321bab2a6e', 'eth0', 'enp0s31f6']:
        ip = get_ip_address(interface)
        if ip:
            return ip
    return "127.0.0.1"  # Fallback to loopback if no interface is found

# Load MQTT configuration from file
def load_mqtt_config():
    try:
        with open(MQTT_CONFIG_PATH, 'r') as file:
            mqtt_config = json.load(file)
        return mqtt_config
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading MQTT configuration: {e}")
        return None

# Function to get device information
def get_device_info():
    # Load MQTT configuration
    mqtt_config = load_mqtt_config()
    
    if mqtt_config:
        # Concatenate mqtthost and mqttport into one string
        mqtthost = f"{mqtt_config.get('broker_address', 'Not Available')}:{mqtt_config.get('broker_port', 'Not Available')}"
    else:
        mqtthost = "Not Available"

    mac_address = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff)
                            for elements in range(0, 2*6, 2)][::-1])
    
    # Check for available interfaces
    wlan_ip = get_ip_address('wlan0') or get_ip_address('wlx78321bab2a6e')
    eth_ip = get_ip_address('eth0') or get_ip_address('enp0s31f6')
    local_ip = "127.0.0.1"  # Local IP address
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # New fields
    manufacture = "GSPE IOT"
    webapp = "https://www.gspe.co.id/"
    
    # Additional fields based on the modified requirements
    uptime_s = 60408  # Example uptime in seconds
    build = datetime.now().strftime("Built on %b %d %Y %H:%M:%S version main_c7f8b6c69dc0")  # Use the current datetime
    chipset = "BK7231N"
    short_name = os.getlogin()  # Use os.getlogin() for shortName
    start_cmd = ""
    supports_ssdp = 0
    supports_client_device_db = True
    flags = ""  # Empty string for flags field

    return {
        "uptime_s": uptime_s,
        "build": build,
        "ip": wlan_ip,  # Change ip_wlan to ip
        "mac": mac_address,
        "flags": flags,  # Empty string
        "mqtthost": mqtthost,  # Concatenated mqtt_broker and mqtt_port
        "chipset": chipset,
        "manufacture": manufacture,
        "webapp": webapp,
        "shortName": short_name,
        "startcmd": start_cmd,
        "supportsSSDP": supports_ssdp,
        "supportsClientDeviceDB": supports_client_device_db
    }

# Function to check each node device
def check_node(ip):
    try:
        url = f"http://{ip}:{SERVER_PORT}{ENDPOINT}"
        response = requests.get(url, timeout=TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            if validate_node_data(data):
                return {
                    "uptime_s": data.get("uptime_s"),
                    "build": data.get("build"),
                    "ip": ip,
                    "mac": data.get("mac"),
                    "flags": data.get("flags", ""),
                    "mqtthost": data.get("mqtthost", ""),
                    "mqtttopic": data.get("mqtttopic", ""),
                    "chipset": data.get("chipset"),
                    "manufacture": data.get("manufacture"),
                    "webapp": data.get("webapp"),
                    "shortName": data.get("shortName"),
                    "startcmd": data.get("startcmd", ""),
                    "supportsSSDP": data.get("supportsSSDP"),
                    "supportsClientDeviceDB": data.get("supportsClientDeviceDB")
                }
    except requests.RequestException:
        return None

# Validate the node device response structure
def validate_node_data(data):
    required_keys = ["mac", "ip", "chipset", "manufacture", "webapp"]
    return all(key in data for key in required_keys)

# Route to scan the network and update broker addresses
@app.route('/api/scan', methods=['GET'])
def scan_network():
    # Get the IP range from the query parameter
    ip_base = request.args.get('range', '192.168.0')  # Default range is 192.168.0
    ip_range = [f"{ip_base}.{i}" for i in range(1, 226)]
    
    with ThreadPool(20) as pool:  # Use 20 threads for faster scanning
        results = pool.map(check_node, ip_range)
    connected_devices = [result for result in results if result]
    return jsonify(connected_devices), 200

@app.route('/api/ips', methods=['GET'])
def get_ips():
    wlan_ip = get_ip_address('wlan0') or get_ip_address('wlx78321bab2a6e')  # Check for both wlan0 and wlx78321bab2a6e
    eth_ip = get_ip_address('eth0') or get_ip_address('enp0s31f6') or get_ip_address('enp1s0')  # Check for both eth0 and other interfaces
    local_ip = "127.0.0.1"

    return jsonify({
        "wlan_ip": wlan_ip,
        "eth_ip": eth_ip,
        "local_ip": local_ip
    }), 200

@app.route('/api/info', methods=['GET'])
def get_info():
    return jsonify(get_device_info()), 200

@app.route('/api/update_mqtt_config', methods=['POST'])
def update_mqtt_config():
    try:
        # Get the JSON data from the request
        data = request.json

        # Load the existing mqtt_config.json
        with open(MQTT_CONFIG_PATH, 'r') as file:
            mqtt_config = json.load(file)

        # FIXED: Only update fields that are actually provided, preserve all existing fields
        if 'broker_address' in data:
            mqtt_config['broker_address'] = data['broker_address']
        if 'broker_port' in data:
            mqtt_config['broker_port'] = data['broker_port']
        if 'username' in data:
            mqtt_config['username'] = data['username']
        if 'password' in data:
            mqtt_config['password'] = data['password']

        # Ensure all required fields exist with defaults if missing
        default_fields = {
            'enable': True,
            'pub_interval': 10,
            'broker_address_local': 'localhost',
            'qos': 1,
            'retain': True,
            'username': '',
            'password': ''
        }

        for key, default_value in default_fields.items():
            if key not in mqtt_config:
                mqtt_config[key] = default_value

        # Save the updated mqtt_config.json
        with open(MQTT_CONFIG_PATH, 'w') as file:
            json.dump(mqtt_config, file, indent=4)

        return jsonify({"status": "success", "message": "MQTT configuration updated successfully."}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Run the Flask app on port 8000
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== API Info ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== API Info ===========")
    print("Success To Running")
    print("")

def print_broker_status(**brokers):
    """Print MQTT broker connection status"""
    for broker_name, status in brokers.items():
        if status:
            print(f"MQTT Broker {broker_name.title()} is Running")
        else:
            print(f"MQTT Broker {broker_name.title()} connection failed")
    
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
broker_connected = False
