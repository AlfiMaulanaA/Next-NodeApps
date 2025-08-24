from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from multiprocessing.dummy import Pool as ThreadPool
import json
import netifaces as ni
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Path to the MQTT configuration file
MQTT_CONFIG_PATH = "../MODULAR_I2C/JSON/Config/mqtt_config.json"
SERVER_PORT = 8000
ENDPOINT = "/api/info"
TIMEOUT = 2  # seconds for the request timeout

# Function to get the server IP
def get_ip_address(interface):
    try:
        ip = ni.ifaddresses(interface)[ni.AF_INET][0]['addr']
    except (KeyError, IndexError, ValueError):
        ip = None
    return ip

def get_server_ip():
    # Try common interfaces (wlan0, eth0, etc.)
    for interface in ['wlan0', 'wlx78321bab2a6e', 'eth0', 'enp0s31f6']:
        ip = get_ip_address(interface)
        if ip:
            return ip
    return "127.0.0.1"  # Fallback to local loopback if no interface is found

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== API Scan ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== API Scan ===========")
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
