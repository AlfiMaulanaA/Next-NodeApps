import psutil
import time
import json
import paho.mqtt.client as mqtt
import os
import subprocess
import logging
import threading 
from getmac import get_mac_address
import netifaces as ni
from datetime import datetime

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Settings ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Settings ===========")
    print("Success To Running")
    print("")

def print_broker_status(broker_status=False):
    """Print MQTT broker connection status"""
    if broker_status:
        print("MQTT Broker Local is Running")
    else:
        print("MQTT Broker Local connection failed")
    
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

# --- Configuration Paths ---
# Define paths to various JSON configuration files and network interface file.
# These paths indicate a modular structure for different system components.
SCHEDULER_CONFIG_PATH = '../MODULAR_I2C/JSON/Config/scheduler_config.json'
DRYCONTACT_CONFIG_PATH = '../MODULAR_I2C/JSON/Config/drycontact_config.json'
INSTALLED_DEVICES_MODULAR_PATH = '../MODULAR_I2C/JSON/Config/installed_devices.json'
MQTT_CONFIG_MODULAR_PATH = '../MODULAR_I2C/JSON/Config/mqtt_config.json'

INSTALLED_DEVICES_MODBUS_PATH = '../MODBUS_SNMP/JSON/Config/installed_devices.json'
MQTT_CONFIG_MODBUS_PATH = '../MODBUS_SNMP/JSON/Config/mqtt_config.json'
NETWORK_CONFIG_PATH = '/etc/network/interfaces' # Standard Linux network configuration file

# New path for Modbus TCP configuration
MODBUS_TCP_CONFIG_PATH = '../PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Config/modbus_tcp.json'

# New path for SNMP configuration
SNMP_CONFIG_PATH = '../PROTOCOL_OUT/SNMP_SERVER/json/Comm.json'

# Directory and File paths for file operations (e.g., file transfer via MQTT)
FILEPATH = "../MODBUS_SNMP/JSON/Config/Library/devices.json"

# --- MQTT Topics ---
# Define MQTT topics used for various communication purposes.
TOPIC_DOWNLOAD = "command_download_file"
TOPIC_UPLOAD = "command_upload_file"
TOPIC_RESPONSE_FILE = "response_file_transfer"

COMMAND_TOPIC = "service/command" # For general system commands (reboot, restart services)
RESPONSE_TOPIC = "service/response" # For responses to general commands
TOPIC_COMMAND_RESET = "command/reset_config" # Topic to trigger factory reset
TOPIC_RESPONSE_RESET = "response/reset_config" # Response after factory reset
TOPIC_SYSTEM_STATUS = "system/status" # Topic for publishing real-time system information
ERROR_LOG_TOPIC = "subrack/error/data" # Topic for publishing error logs (matches frontend expectation)

# --- Default Configurations ---
# These dictionaries and strings define the "factory default" settings for the system.
# When a reset command is received, these values will be written to their respective files.
DEFAULT_SCHEDULER_CONFIG = {"autoControl": True, "devices": []}
DEFAULT_DRYCONTACT_CONFIG = {"control": True, "read_data": []}
DEFAULT_INSTALLED_DEVICES_MODULAR = [] # Empty list for modular devices
DEFAULT_INSTALLED_DEVICES_MODBUS = [
  {
    "profile": {
      "name": "pzem017_battery",
      "device_type": "power_meter",
      "manufacturer": "Peacefair",
      "part_number" : "pzem017",
      "topic": "pzem017/1",
      "interval_publish": 60,
      "custom_by_customer": False,
      "customer": "tbig",
      "custom_payload" : False,
      "qos": 1
      },
    "protocol_setting" : {
      "protocol": "Modbus RTU",
      "address":1,
      "port": "/dev/ttyUSB0",
      "baudrate": 9600,
      "parity": "NONE",
      "bytesize": 8,
      "stop_bit": 1,
      "timeout": 0.25,
      "endianness" : "Little Endian"
    }
  },
  {
    "profile": {
      "name": "pzem017_output",
      "device_type": "power_meter",
      "manufacturer": "Peacefair",
      "part_number" : "pzem017",
      "topic": "pzem017/2",
      "interval_publish": 60,
      "custom_by_customer": False,
      "customer": "tbig",
      "custom_payload" : False,
      "qos": 1
      },
    "protocol_setting" : {
      "protocol": "Modbus RTU",
      "address":5,
      "port": "/dev/ttyUSB0",
      "baudrate": 9600,
      "parity": "NONE",
      "bytesize": 8,
      "stop_bit": 1,
      "timeout": 0.25,
      "endianness" : "Little Endian"
    }
  },
  {
    "profile": {
      "name": "pzem016_input",
      "device_type": "power_meter",
      "manufacturer": "Peacefair",
      "part_number" : "pzem016",
      "topic": "pzem016/1",
      "interval_publish": 60,
      "custom_by_customer": False,
      "customer": "tbig",
      "custom_payload" : False,
      "qos": 1
      },
    "protocol_setting" : {
      "protocol": "Modbus RTU",
      "address":13,
      "port": "/dev/ttyUSB0",
      "baudrate": 9600,
      "parity": "NONE",
      "bytesize": 8,
      "stop_bit": 1,
      "timeout": 0.25,
      "endianness" : "Little Endian"
    }
  }
]

DEFAULT_MQTT_CONFIG_MODULAR = {
    "enable": True,
    "pub_interval": 10, # Publish interval in seconds
    "broker_address": "localhost",
    "broker_port": 1883,
    "username": "", # Default empty username
    "password": "", # Default empty password
    "qos": 1, # Quality of Service level
    "retain": True, # Retain flag for published messages
    "pub_topic": ["telemetry"], # Default publication topic
    "sub_topic_system": "system_modular", # Default subscription topic for modular system
    "mac": get_mac_address() # MAC address used as part of client ID
}

DEFAULT_MQTT_CONFIG_MODBUS = {
    "enable": True,
    "pub_interval": 2,
    "broker_address": "localhost",
    "broker_address_local": "localhost",
    "broker_port": 1883,
    "username": "",
    "password": "",
    "qos": 1,
    "retain": True,
    "pub_topic": [
        "telemetry"
    ],
    "sub_topic_system": "gspe_iot1",
    "sub_topic_modbusRTU": "gspe_iot2",
    "sub_topic_modbusTCP": "gspe_iot3",
    "sub_topic_snmp": "gspe_iot4",
    "publish_failed_data_modbusrtu": "gspe_iot5"
}

# Default network configuration for /etc/network/interfaces (static IP for eth0)
DEFAULT_NETWORK_CONFIG = """
auto lo
iface lo inet loopback

auto eth0
iface eth0 inet static
    address 192.168.0.100
    netmask 255.255.255.0
    gateway 192.168.0.1
"""

# New default Modbus TCP configuration
DEFAULT_MODBUS_TCP_CONFIG = {
    "modbus_tcp_ip" : "192.168.0.100",
    "modbus_tcp_port" : 502
}

# New default SNMP configuration
DEFAULT_SNMP_CONFIG = {
    "snmpIPaddress":"192.168.0.100",
    "snmpNetmask":"255.255.255.0",
    "snmpGateway":"10.20.1.1",
    "snmpVersion":"2c",
    "authKey": "authkey1",
    "privKey": "privkey1",
    "securityName": "usr-md5-des",
    "securityLevel": "authPriv",
    "snmpCommunity":"public",
    "snmpPort":"161",
    "sysOID":".1.3.6.1.4.1.10000.11",
    "MasterIPaddress":"localhost",
    "snmpTrapEnabled":True,
    "ipSnmpManager":"192.168.0.130",
    "portSnmpManager":162,
    "snmpTrapComunity":"public",
    "snmpTrapVersion":"2",
    "timeDelaySnmpTrap":30,
    "DeviceName":"BMS Battery Charger",
    "Site":"JKT"
}

# --- Logging Setup ---
# Basic logging configuration for console output.
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions for File Operations ---
def save_json_config(filepath, config_data):
    """
    Saves a dictionary as a JSON file to the specified filepath.
    Ensures the directory exists before writing.
    """
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True) # Create directory if it doesn't exist
        with open(filepath, 'w') as file:
            json.dump(config_data, file, indent=4) # Write JSON with 4-space indentation
        logging.info(f"Configuration saved to {filepath}")
        return True
    except Exception as e:
        logging.error(f"Failed to save JSON config to {filepath}: {e}")
        return False

def load_json_config(filepath, default_config=None):
    """
    Loads a JSON configuration file from the specified filepath.
    If the file is not found or decoding fails, it uses and optionally saves a default configuration.
    """
    try:
        if not os.path.exists(filepath):
            logging.warning(f"Config file not found: {filepath}. Using default.")
            if default_config is not None:
                # Optionally save default if file doesn't exist, and return it
                if save_json_config(filepath, default_config):
                    return default_config
            return default_config # Return default even if saving fails
            
        with open(filepath, 'r') as file:
            return json.load(file)
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON from {filepath}: {e}. Using default.")
        return default_config
    except Exception as e:
        logging.error(f"Failed to load configuration from {filepath}: {e}. Using default.")
        return default_config

# --- Error Logging Function ---
def send_error_log(client, function_name, error_detail, error_type):
    """
    Sends an error log message to the MQTT broker on ERROR_LOG_TOPIC.
    Also logs the error locally.
    """
    # Clean up error detail for better readability in logs
    cleaned_error = str(error_detail).split("] ")[-1] if isinstance(error_detail, Exception) else str(error_detail)
    human_readable_function = function_name.replace("_", " ").title()
    error_message = {
        "data": f"[{human_readable_function}] {cleaned_error}",
        "type": error_type, # e.g., "minor", "major", "critical"
        "Timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    try:
        # Publish to MQTT if client is connected
        if client and client.is_connected():
            client.publish(ERROR_LOG_TOPIC, json.dumps(error_message))
            logging.error(f"Sent error log for {function_name}: {error_message}")
        else:
            logging.error(f"MQTT not connected, cannot send error log for {function_name}: {error_message}")
    except Exception as e:
        # Critical failure if even sending error log fails
        logging.critical(f"FATAL: Failed to send error log and logging locally: {e}. Original error: {error_message}")
    logging.error(f"Local error log for {function_name}: {error_detail}")

# --- System Information Functions ---
def get_uptime(client=None):
    """Returns the system uptime in seconds."""
    try:
        return time.time() - psutil.boot_time()
    except Exception as e:
        send_error_log(client, "get_uptime", e, "minor")
        return 0

def get_ip_addresses(client=None):
    """Returns a dictionary of IP addresses for eth0 and wlan0."""
    ip_addresses = {"eth0_ip": "N/A", "wlan0_ip": "N/A"}
    
    try:
        # Attempt to get eth0 IP
        eth0_ip = ni.ifaddresses('eth0')[ni.AF_INET][0]['addr']
        ip_addresses["eth0_ip"] = eth0_ip
    except (KeyError, ValueError): # KeyError if interface not found, ValueError if AF_INET not found
        logging.info("eth0 interface or IP not found.")
    except Exception as e:
        send_error_log(client, "get_ip_addresses_eth0", e, "minor")

    try:
        # Attempt to get wlan0 IP
        wlan0_ip = ni.ifaddresses('wlan0')[ni.AF_INET][0]['addr']
        ip_addresses["wlan0_ip"] = wlan0_ip
    except (KeyError, ValueError):
        logging.info("wlan0 interface or IP not found.")
    except Exception as e:
        send_error_log(client, "get_ip_addresses_wlan0", e, "minor")
    
    return ip_addresses

def get_cpu_temperature(client=None):
    """Attempts to read CPU temperature from common Linux paths."""
    cpu_temp = "N/A"
    try:
        # Common path for Raspberry Pi and similar ARM boards
        if os.path.exists("/sys/class/thermal/thermal_zone0/temp"):
            with open("/sys/class/thermal/thermal_zone0/temp", 'r') as f:
                cpu_temp = float(f.read()) / 1000.0 # Convert from millidegree Celsius to Celsius
        # Add other common paths for different systems if needed (e.g., using psutil.sensors_temperatures())
    except Exception as e:
        send_error_log(client, "get_cpu_temperature", e, "minor")
        cpu_temp = "N/A" # Set to N/A on error
    return cpu_temp

def get_system_info(client=None):
    """Gathers comprehensive system information (CPU, memory, disk, IP, uptime, temp)."""
    try:
        cpu_usage = psutil.cpu_percent(interval=None) # Non-blocking call for instantaneous usage
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        cpu_temp = get_cpu_temperature(client)
        ip_addresses = get_ip_addresses(client)

        system_info = {
            "cpu_usage": cpu_usage,
            "cpu_temp": cpu_temp,
            "memory_usage": memory.percent,
            "used_memory": memory.used // (1024 * 1024),  # Convert to MB
            "total_memory": memory.total // (1024 * 1024),  # Convert to MB
            "disk_usage": disk.percent,
            "used_disk": disk.used // (1024 * 1024),  # Convert to MB
            "total_disk": disk.total // (1024 * 1024),  # Convert to MB
            "eth0_ip_address": ip_addresses.get("eth0_ip"),
            "wlan0_ip_address": ip_addresses.get("wlan0_ip"),
            "uptime": int(get_uptime(client)),
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S') # Add current timestamp
        }
        return system_info
    except Exception as e:
        send_error_log(client, "get_system_info", e, "critical")
        return {} # Return empty dict on critical failure

# --- Reset Configuration Functions ---
# These functions reset specific configuration files to their default values.
def reset_scheduler_config(client=None):
    if not save_json_config(SCHEDULER_CONFIG_PATH, DEFAULT_SCHEDULER_CONFIG):
        send_error_log(client, "reset_scheduler_config", "Failed to save default config.", "major")

def reset_drycontact_config(client=None):
    if not save_json_config(DRYCONTACT_CONFIG_PATH, DEFAULT_DRYCONTACT_CONFIG):
        send_error_log(client, "reset_drycontact_config", "Failed to save default config.", "major")

def reset_installed_devices_modular(client=None):
    if not save_json_config(INSTALLED_DEVICES_MODULAR_PATH, DEFAULT_INSTALLED_DEVICES_MODULAR):
        send_error_log(client, "reset_installed_devices_modular", "Failed to save default config.", "major")

def reset_installed_devices_modbus(client=None):
    if not save_json_config(INSTALLED_DEVICES_MODBUS_PATH, DEFAULT_INSTALLED_DEVICES_MODBUS):
        send_error_log(client, "reset_installed_devices_modbus", "Failed to save default config.", "major")

def update_mqtt_config_modular(client=None):
    """Resets modular MQTT config to default. Note: Function name 'update' but performs reset."""
    if not save_json_config(MQTT_CONFIG_MODULAR_PATH, DEFAULT_MQTT_CONFIG_MODULAR):
        send_error_log(client, "update_mqtt_config_modular", "Failed to save default config.", "major")
    else:
        logging.info(f"MQTT (MODULAR) config reset. MAC: {DEFAULT_MQTT_CONFIG_MODULAR['mac']}")

def update_mqtt_config_modbus(client=None):
    """Resets Modbus MQTT config to default. Note: Function name 'update' but performs reset."""
    if not save_json_config(MQTT_CONFIG_MODBUS_PATH, DEFAULT_MQTT_CONFIG_MODBUS):
        send_error_log(client, "update_mqtt_config_modbus", "Failed to save default config.", "major")
    else:
        logging.info("MQTT (MODBUS) configuration reset to default.")

def reset_network_config(client=None):
    """Resets the /etc/network/interfaces file to the default static IP configuration for eth0."""
    try:
        with open(NETWORK_CONFIG_PATH, 'w') as file:
            file.write(DEFAULT_NETWORK_CONFIG)
        logging.info(f"Network configuration reset to default in {NETWORK_CONFIG_PATH}.")
    except Exception as e:
        send_error_log(client, "reset_network_config", e, "critical")

def reset_wifi_config(client=None):
    """
    Resets WiFi configuration to default hotspot settings (SSID: IOTech1, Pass: IOT@1868) using nmcli.
    Requires NetworkManager to be active and nmcli to be installed.
    """
    try:
        # Check if NetworkManager is active (nmcli depends on it)
        result = subprocess.run(["systemctl", "is-active", "NetworkManager"], capture_output=True, text=True, check=False)
        if "active" not in result.stdout:
            logging.warning("NetworkManager is not active. Cannot reset WiFi config via nmcli.")
            send_error_log(client, "reset_wifi_config", "NetworkManager not active.", "minor")
            return False

        # 1. Delete all existing Wi-Fi connections for a clean reset
        # Get a list of active Wi-Fi connections
        wifi_connections_cmd = ["nmcli", "-t", "-f", "NAME,TYPE", "con", "show"]
        result = subprocess.run(wifi_connections_cmd, capture_output=True, text=True, check=True)
        connections = result.stdout.strip().split('\n')
        
        for conn in connections:
            if conn and "wifi" in conn: # Filter for Wi-Fi connections
                conn_name = conn.split(':')[0] # Extract connection name
                try:
                    subprocess.run(["sudo", "nmcli", "con", "delete", conn_name], check=True, capture_output=True)
                    logging.info(f"Deleted existing Wi-Fi connection: {conn_name}")
                except subprocess.CalledProcessError as e:
                    logging.warning(f"Failed to delete Wi-Fi connection {conn_name}: {e.stderr.strip()}")
                    send_error_log(client, "reset_wifi_config", f"Failed to delete {conn_name}: {e.stderr.strip()}", "minor")

        # 2. Add a new Wi-Fi connection with the default SSID and password
        add_wifi_cmd = [
            "sudo", "nmcli", "dev", "wifi", "connect", "IOTech1", 
            "password", "IOT@1868", 
            "name", "IOTech1_default", # Assign a recognizable name to the new connection
            "--autoconnect", "yes" # Ensure it auto-connects on boot
        ]
        subprocess.run(add_wifi_cmd, check=True, capture_output=True)
        logging.info("WiFi configuration reset to default (SSID: IOTech1, Password: IOT@1868).")
        return True
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to reset WiFi config with nmcli: {e.stderr.strip()}"
        logging.error(error_msg)
        send_error_log(client, "reset_wifi_config", error_msg, "critical")
        return False
    except Exception as e:
        error_msg = f"An unexpected error occurred during WiFi reset: {e}"
        logging.error(error_msg)
        send_error_log(client, "reset_wifi_config", error_msg, "critical")
        return False

def reset_modbus_tcp_config(client=None):
    """Resets Modbus TCP configuration to default."""
    if not save_json_config(MODBUS_TCP_CONFIG_PATH, DEFAULT_MODBUS_TCP_CONFIG):
        send_error_log(client, "reset_modbus_tcp_config", "Failed to save default Modbus TCP config.", "major")
    else:
        logging.info("Modbus TCP configuration reset to default.")

def reset_snmp_config(client=None):
    """Resets SNMP configuration to default."""
    if not save_json_config(SNMP_CONFIG_PATH, DEFAULT_SNMP_CONFIG):
        send_error_log(client, "reset_snmp_config", "Failed to save default SNMP config.", "major")
    else:
        logging.info("SNMP configuration reset to default.")

# --- System Status Publishing (Corrected for 1-second interval & Robustness) ---
def publish_system_info(client):
    """
    Continuously gathers and publishes system information to MQTT.
    Runs in a separate thread.
    """
    logging.info("Starting system information publisher thread...")
    while True:
        try:
            # Ensure MQTT client is connected before attempting to publish
            if not client or not client.is_connected():
                logging.warning("MQTT client not connected, unable to publish system info. Waiting...")
                time.sleep(5) # Wait longer if not connected
                continue # Skip current iteration and check connection again

            system_info = get_system_info(client)
            if not system_info: # Check if get_system_info return   ed empty data due to internal error
                logging.error("get_system_info returned empty data. Skipping publish for this cycle.")
                time.sleep(1) # Still wait for the interval
                continue

            system_info_json = json.dumps(system_info)
            # Publish with QoS 1 and no retain for live data (retain=False is good for live data)
            client.publish(TOPIC_SYSTEM_STATUS, system_info_json, qos=1, retain=False) 
            logging.debug(f"Published system info: {system_info_json}") # Changed to debug for less verbosity
            
            time.sleep(1) # Publish every 1 second

        except Exception as e:
            send_error_log(client, "publish_system_info_loop", e, "critical")
            logging.error(f"Critical error in system info publisher loop, retrying in 5 seconds: {e}")
            time.sleep(5) # Wait on critical error to prevent rapid-fire failures

# --- MQTT Callbacks ---
def on_connect(client, userdata, flags, rc):
    """Callback function when MQTT client connects."""
    try:
        if rc == 0:
            logging.info("Connected to MQTT broker successfully! ✅")
            # Subscribe to all necessary command topics
            client.subscribe(TOPIC_COMMAND_RESET)
            client.subscribe(COMMAND_TOPIC)
            client.subscribe(TOPIC_DOWNLOAD)
            client.subscribe(TOPIC_UPLOAD)
            # Request logs on connect for frontend synchronization (e.g., to populate error log viewer)
            client.publish("subrack/error/data/request", json.dumps({"command": "get_all"}))
            logging.info(f"Subscribed to: {TOPIC_COMMAND_RESET}, {COMMAND_TOPIC}, {TOPIC_DOWNLOAD}, {TOPIC_UPLOAD}")
        else:
            logging.error(f"Failed to connect to MQTT broker, return code {rc} ❌")
            send_error_log(client, "mqtt_on_connect", f"Connection failed with code {rc}", "critical")
    except Exception as e:
        send_error_log(client, "on_connect_callback_error", e, "critical")

def on_disconnect(client, userdata, rc):
    """Callback function when MQTT client disconnects."""
    logging.warning(f"Disconnected from MQTT broker with result code {rc} 🔌. Attempting to reconnect...")
    send_error_log(client, "mqtt_on_disconnect", f"Disconnected with code {rc}", "major")

def on_message(client, userdata, message):
    """
    General callback for messages if not handled by specific callbacks.
    This should ideally not be hit if all topics are explicitly handled by message_callback_add.
    """
    logging.warning(f"Received message on unhandled topic: {message.topic} with payload: {message.payload.decode()} ❓")
    send_error_log(client, "on_message_unhandled", f"Unhandled topic: {message.topic}", "minor")

def on_message_command(client, userdata, message):
    """Handles service command messages (restart, reboot, reset)."""
    try:
        payload = json.loads(message.payload.decode())
        action = payload.get("action")
        services = payload.get("services", [])

        logging.info(f"Received command: {action} for services: {services} ⚙️")

        response_payload = {"result": "error", "action": action, "services": services, "message": "Unknown error."}

        if action == "restart":
            for service in services:
                try:
                    # Execute systemctl restart command for specified service
                    subprocess.run(["sudo", "systemctl", "restart", service], check=True)
                    logging.info(f"{service} restarted successfully. ✅")
                except subprocess.CalledProcessError as e:
                    logging.error(f"Failed to restart service {service}: {e} ❌")
                    response_payload["message"] = f"Failed to restart {service}: {str(e)}"
                    send_error_log(client, "on_message_command_restart", e, "critical")
                    client.publish(RESPONSE_TOPIC, json.dumps(response_payload))
                    return # Exit if any service restart fails
            response_payload.update({"result": "success", "message": "Services restarted successfully."})
        elif action == "reboot":
            response_payload.update({"result": "success", "message": "System is rebooting... 🔄"})
            client.publish(RESPONSE_TOPIC, json.dumps(response_payload)) # Publish before rebooting
            logging.info("System is rebooting... initiating sudo reboot. ⏳")
            subprocess.run(["sudo", "reboot"], check=True) # Initiate system reboot
        elif action == "reset":
            # This 'reset' action here seems to be a placeholder or partial implementation
            # The main factory reset logic is in on_message_reset
            response_payload.update({"result": "success", "message": "System reset command received. No specific action implemented beyond this command."})
            logging.info("System reset command received. No specific action implemented here. ⚙️")
        else:
            response_payload["message"] = "Unknown action."
            logging.error(f"Command failed: {response_payload['message']} �")
        
        client.publish(RESPONSE_TOPIC, json.dumps(response_payload))

    except json.JSONDecodeError as e:
        response = {"result": "error", "message": f"Invalid JSON payload for command: {str(e)}"}
        client.publish(RESPONSE_TOPIC, json.dumps(response))
        send_error_log(client, "on_message_command_json_error", e, "major")
    except subprocess.CalledProcessError as e:
        response = {"result": "error", "message": f"System command failed: {str(e)}"}
        client.publish(RESPONSE_TOPIC, json.dumps(response))
        send_error_log(client, "on_message_command_subprocess_error", e, "critical")
    except Exception as e:
        response = {"result": "error", "message": f"An unexpected error occurred: {str(e)}"}
        client.publish(RESPONSE_TOPIC, json.dumps(response))
        send_error_log(client, "on_message_command_unexpected_error", e, "critical")

def on_message_reset(client, userdata, message):
    """
    Handles the factory reset configuration command received via MQTT.
    This function is the core of the "factory reset" functionality.
    """
    try:
        logging.info(f"Received message on {message.topic}: {message.payload.decode()} 🔄")
        if message.topic == TOPIC_COMMAND_RESET:
            logging.info("Initiating full configuration reset... 🧹")
            # Call all individual reset functions to revert to default configurations
            reset_scheduler_config(client)
            reset_drycontact_config(client)
            reset_installed_devices_modular(client)
            update_mqtt_config_modular(client) # Function name is 'update' but performs reset
            reset_installed_devices_modbus(client)
            update_mqtt_config_modbus(client) # Function name is 'update' but performs reset
            reset_network_config(client) # Resets wired network config
            reset_wifi_config(client) # Resets WiFi config using nmcli
            reset_modbus_tcp_config(client) # Reset Modbus TCP configuration
            reset_snmp_config(client) # NEW: Reset SNMP configuration
            
            # Publish success response before rebooting
            response = {"result": "success", "message": "All configurations have been reset to default. System will reboot."}
            client.publish(TOPIC_RESPONSE_RESET, json.dumps(response))
            logging.info("Reset command processed successfully. Rebooting system... ⏳")
            subprocess.run(["sudo", "reboot"], check=True) # Initiate system reboot to apply changes
        else:
            response = {"result": "error", "message": "Unknown command."}
            client.publish(TOPIC_RESPONSE_RESET, json.dumps(response))
            logging.error("Unknown command received for reset. 🚫")
    except Exception as e:
        send_error_log(client, "on_message_reset", e, "critical")
        response = {"result": "error", "message": f"Error during reset: {str(e)}"}
        client.publish(TOPIC_RESPONSE_RESET, json.dumps(response))

# --- File Transfer Callbacks ---
def handle_file_download(client):
    """Handles request to download a specific file (e.g., devices.json) via MQTT."""
    try:
        if not os.path.exists(FILEPATH):
            error_message = {
                "status": "error", "action": "download",
                "message": f"File not found: {FILEPATH} 🚫"
            }
            client.publish(TOPIC_RESPONSE_FILE, json.dumps(error_message))
            logging.error(f"File {FILEPATH} not found for download.")
            return

        with open(FILEPATH, 'r') as file:
            file_content = file.read()

        response = {
            "status": "success", "action": "download",
            "content": file_content, # Send file content as string
            "message": "File downloaded successfully. ✅"
        }
        client.publish(TOPIC_RESPONSE_FILE, json.dumps(response))
        logging.info(f"File {FILEPATH} downloaded successfully.")

    except Exception as e:
        error_message = {
            "status": "error", "action": "download",
            "message": f"Failed to download file: {str(e)} ❌"
        }
        client.publish(TOPIC_RESPONSE_FILE, json.dumps(error_message))
        send_error_log(client, "handle_file_download", e, "critical")

def handle_file_upload(client, payload):
    """Handles request to upload file content (e.g., devices.json) via MQTT."""
    try:
        file_content = payload.get("content")
        filepath = payload.get("filepath", FILEPATH) # Default to FILEPATH if not provided in payload

        if not file_content:
            raise ValueError("No file content provided in payload.")
        
        # Ensure directory exists before writing the file
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        with open(filepath, 'w') as file:
            file.write(file_content) # Write the received content to the file

        response = {
            "status": "success", "action": "upload",
            "message": f"File {filepath} uploaded successfully. ✅"
        }
        client.publish(TOPIC_RESPONSE_FILE, json.dumps(response))
        logging.info(f"File {filepath} uploaded successfully.")

    except Exception as e:
        error_message = {
            "status": "error", "action": "upload",
            "message": f"Failed to upload file: {str(e)} ❌"
        }
        client.publish(TOPIC_RESPONSE_FILE, json.dumps(error_message))
        send_error_log(client, "handle_file_upload", e, "critical")

# --- MQTT Client Setup ---
def setup_mqtt_client():
    """Sets up and connects the MQTT client with proper callbacks and configurations,
    hardcoding broker address to localhost and port to 1883."""

    # Hardcode broker_address dan broker_port
    broker_address = "localhost"
    broker_port = 1883
    username = "" 
    password = "" 

    # Create MQTT client instance with a unique client ID
    client = mqtt.Client(
       client_id=f"SystemMonitor_{get_mac_address()}",
        protocol=mqtt.MQTTv311
    )
# `clean_session=True` tidak lagi diperlukan secara eksplisit di paho-mqtt v2 karena perilaku default-nya sudah clean start.
    if username and password:
        client.username_pw_set(username, password)

    # Configure automatic re-connection delays
    client.reconnect_delay_set(min_delay=1, max_delay=120)

    # Assign general callbacks
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message # Fallback handler for unhandled topics

    # Add specific message handlers for known topics using message_callback_add
    client.message_callback_add(TOPIC_COMMAND_RESET, on_message_reset)
    client.message_callback_add(COMMAND_TOPIC, on_message_command)
    # Lambda functions are used to pass additional arguments (like 'client' or parsed payload)
    client.message_callback_add(TOPIC_DOWNLOAD, lambda c, u, m: handle_file_download(c))
    client.message_callback_add(TOPIC_UPLOAD, lambda c, u, m: handle_file_upload(c, json.loads(m.payload.decode())))

    try:
        logging.info(f"Attempting to connect to MQTT broker at {broker_address}:{broker_port}...")
        client.connect(broker_address, int(broker_port), 60) # Connect to the broker
        return client
    except Exception as e:
        logging.critical(f"Failed to connect MQTT client: {e}. Exiting. ❌")
        raise # Re-raise to stop execution if connection fails at startup

# --- Main Execution ---
def main():
    mqtt_client = None
    try:
        mqtt_client = setup_mqtt_client() # Initialize and connect MQTT client
        mqtt_client.loop_start() # Start the MQTT network loop in a background thread

        # Start the system info publishing in a separate thread
        system_info_thread = threading.Thread(target=publish_system_info, args=(mqtt_client,), daemon=True)
        system_info_thread.start()
        logging.info("System info publishing thread started. ▶️")

        # Keep the main thread alive, waiting for KeyboardInterrupt (Ctrl+C)
        while True:
            time.sleep(1) # Small sleep to prevent busy-waiting and allow other threads to run
    except KeyboardInterrupt:
        logging.info("KeyboardInterrupt received. Stopping... 🛑")
    except Exception as e:
        send_error_log(mqtt_client, "main_function", e, "critical")
        logging.critical(f"An unhandled error occurred in main: {e} 💥")
    finally:
        # Ensure MQTT client is properly disconnected and its loop stopped on exit
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
            logging.info("MQTT client disconnected and loop stopped. 🔗")
        logging.info("Application terminated. 👋")

if __name__ == "__main__":
    main() # Entry point of the script
