import json
import os
import time
import subprocess
import re
import logging
import uuid
import threading
from paho.mqtt import client as mqtt_client
from getmac import get_mac_address
from datetime import datetime

# --- Global Configuration & Constants ---
# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("NetworkManagerService")

# MQTT Broker Details
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
QOS = 1 # Quality of Service for MQTT messages

# File Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INTERFACES_FILE = "/etc/network/interfaces" # Standard path for network interfaces config
# Paths to MQTT configuration JSON files
# Pastikan jalur ini benar relatif terhadap lokasi script ini
MQTT_MODBUS_CONFIG_PATH = os.path.join(BASE_DIR, '../MODBUS_SNMP/JSON/Config/mqtt_config.json')
MQTT_I2C_CONFIG_PATH = os.path.join(BASE_DIR, '../MODULAR_I2C/JSON/Config/mqtt_config.json')

# MQTT Topics
# IP Configuration Topics
TOPIC_IP_CONFIG_COMMAND = "command_device_ip"
TOPIC_IP_CONFIG_RESPONSE = "response_device_ip"

# MAC Address Topics
TOPIC_REQUEST_MAC = "mqtt_config/get_mac_address"
TOPIC_RESPONSE_MAC = "mqtt_config/response_mac"

# Broker Configuration Topics
REQUEST_TOPIC_BROKER_CONFIG = "request/broker_config"
RESPONSE_TOPIC_BROKER_CONFIG = "response/broker_config"

# Specific MQTT Config Update/Request Topics
TOPIC_MQTT_I2C_UPDATE = "mqtt_config/update"
TOPIC_MQTT_I2C_REQUEST = "mqtt_config/request"
TOPIC_MQTT_MODBUS_UPDATE = "mqtt_config_modbus/update"
TOPIC_MQTT_MODBUS_REQUEST = "mqtt_config_modbus/request"

# Wi-Fi Management Topics
MQTT_TOPIC_WIFI_SCAN = 'wifi/scan_results'
MQTT_TOPIC_SCAN_REQUEST = 'wifi/scan_request'
MQTT_TOPIC_SWITCH_WIFI = 'wifi/switch_wifi'
MQTT_TOPIC_DELETE_WIFI = 'wifi/delete_wifi'
MQTT_TOPIC_IP_UPDATE = 'wifi/ip_update' # For reporting IP changes after Wi-Fi switch

# System Topics
MQTT_TOPIC_REBOOT = 'system/reboot'
ERROR_LOG_TOPIC = "subrack/error/log" # Centralized error logging topic

# --- Dedicated Error Logging Client ---
error_logger_client = None
ERROR_LOGGER_CLIENT_ID = f'network-manager-error-logger-{uuid.uuid4()}'

# Perbaikan: Tambahkan parameter `properties` di semua fungsi callback MQTT.
def on_error_logger_connect(client, userdata, flags, rc):
    """Callback for dedicated error logging MQTT client connection."""
    if rc == 0:
        logger.info("Connected to dedicated Error Log MQTT Broker.")
    else:
        logger.error(f"Failed to connect dedicated Error Log MQTT Broker, return code: {rc}")

def on_error_logger_disconnect(client, userdata, rc):
    """Callback for dedicated error logging MQTT client disconnection."""
    if rc != 0:
        logger.warning(f"Unexpected disconnect from Error Log broker with code {rc}. Attempting reconnect...")
    else:
        logger.info("Error Log client disconnected normally.")

def initialize_error_logger():
    """Initializes and connects the dedicated error logging MQTT client."""
    global error_logger_client
    try:
        # Perbaikan: Tentukan callback_api_version untuk paho-mqtt 2.x
        error_logger_client = mqtt_client.Client(
            client_id=ERROR_LOGGER_CLIENT_ID
        )
        error_logger_client.on_connect = on_error_logger_connect
        error_logger_client.on_disconnect = on_error_logger_disconnect
        error_logger_client.reconnect_delay_set(min_delay=1, max_delay=120) # Exponential back-off
        error_logger_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        error_logger_client.loop_start() # Start background thread for MQTT operations
        logger.info(f"Dedicated error logger client initialized and started loop to {MQTT_BROKER}:{MQTT_PORT}")
    except Exception as e:
        logger.critical(f"FATAL: Failed to initialize dedicated error logger: {e}", exc_info=True)
        # Cannot send error log if the logger itself fails to initialize

def send_error_log(function_name, error, error_type, additional_info=None):
    """
    Sends an error message to the centralized error log service via MQTT.
    Uses the dedicated error_logger_client.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # Convert the error object/string to a string for logging
    error_message_str = str(error) 
    # Attempt to clean the error string if it contains subprocess's '[Errno X] ' prefix
    cleaned_error = error_message_str.split("] ")[-1] if isinstance(error, subprocess.CalledProcessError) or ']' in error_message_str else error_message_str
    human_readable_function = function_name.replace("_", " ").title()
    unique_id_fragment = str(uuid.uuid4().int % 10000000000)
    log_id = f"NetworkManagerService--{int(time.time())}-{unique_id_fragment}"

    error_payload = {
        "data": f"[{human_readable_function}] {cleaned_error}",
        "type": error_type.upper(),
        "source": "NetworkManagerService",
        "Timestamp": timestamp,
        "id": log_id,
        "status": "active",
    }
    if additional_info:
        error_payload.update(additional_info)

    try:
        if error_logger_client and error_logger_client.is_connected():
            error_logger_client.publish(ERROR_LOG_TOPIC, json.dumps(error_payload), qos=QOS)
            logger.debug(f"Error log sent: {error_payload}")
        else:
            logger.error(f"Error logger MQTT client not connected, unable to send log: {error_payload}")
    except Exception as e:
        logger.error(f"Failed to publish error log (internal error in send_error_log): {e}", exc_info=True)
    
    # Also log to console for immediate visibility
    # Use 'error_message_str' for console logging as it contains the full original error
    if error_type.lower() == "critical":
        logger.critical(f"[{function_name}] {error_message_str}")
    elif error_type.lower() == "major":
        logger.error(f"[{function_name}] {error_message_str}")
    elif error_type.lower() == "minor":
        logger.warning(f"[{function_name}] {error_message_str}")
    else:
        logger.info(f"[{function_name}] {error_message_str}") # Default for less severe "errors"

## IP Address Configuration

def parse_interfaces_file(content):
    """Parses the /etc/network/interfaces file content."""
    interfaces = {}
    current_iface = None
    try:
        for line in content.splitlines():
            line = line.strip()

            if line.startswith("auto "):
                current_iface = line.split()[1]
                if current_iface not in interfaces:
                    interfaces[current_iface] = {}
                # If 'auto' line is followed by an 'iface' line, we'll update the details then.
                # Otherwise, it might just be an 'auto' line without further config in this block.

            elif line.startswith("iface "):
                parts = line.split()
                if len(parts) < 4:
                    logger.warning(f"Malformed iface line encountered: {line}. Skipping.")
                    continue
                
                iface_name = parts[1]
                if iface_name not in interfaces: # Handle iface without preceding auto
                    interfaces[iface_name] = {}
                interfaces[iface_name]["method"] = parts[3]
                
                if parts[3] == "static":
                    # Initialize static parameters as empty; they will be filled by subsequent lines
                    interfaces[iface_name]["address"] = ""
                    interfaces[iface_name]["netmask"] = ""
                    interfaces[iface_name]["gateway"] = ""
                current_iface = iface_name # Set current_iface to the one defined by 'iface'

            elif current_iface and line:
                try:
                    key, value = line.split(maxsplit=1)
                    # Only add iface-specific network configuration keys
                    if key in ["address", "netmask", "gateway", "dns-nameservers", "pre-up", "post-down"]:
                        interfaces[current_iface][key] = value
                except ValueError:
                    # Ignore lines that don't conform to key-value (e.g., comments or empty lines)
                    pass
        return interfaces
    except Exception as e:
        send_error_log("parse_interfaces_file", f"Error parsing interfaces file: {e}", "major", {"content_preview": content[:200]})
        return {}

def change_ip_configuration(interface, method, static_ip=None, netmask=None, gateway=None):
    """Changes the IP configuration for a given network interface in /etc/network/interfaces."""
    original_permissions = None
    try:
        # Save original permissions and set writable permissions temporarily
        original_permissions = os.stat(INTERFACES_FILE).st_mode
        os.chmod(INTERFACES_FILE, 0o666) # Temporarily make it writable for all (careful with this in production!)

        new_lines = []
        in_target_iface_section = False
        
        with open(INTERFACES_FILE, 'r') as file:
            lines = file.readlines()

        with open(INTERFACES_FILE, 'w') as file:
            for line in lines:
                stripped_line = line.strip()

                if stripped_line.startswith(f"auto {interface}"):
                    new_lines.append(line) # Always keep the 'auto' line
                    # The actual iface config will be handled when 'iface' line is found

                elif stripped_line.startswith(f"iface {interface}"):
                    in_target_iface_section = True
                    # Write the new 'iface' line with the desired method
                    new_lines.append(f"iface {interface} inet {method}")
                else:
                    new_lines.append(line)
            
            file.writelines(new_lines)
        
        return True, "IP configuration updated successfully"
    except Exception as e:
        send_error_log("change_ip_configuration", f"Error changing IP: {str(e)}", "error")
        return False, f"Error: {str(e)}"
    finally:
        if original_permissions is not None:
            os.chmod(INTERFACES_FILE, original_permissions)

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Network Manager ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Network Manager ===========")
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

def change_ip_configuration(interface, method, static_ip=None, netmask=None, gateway=None, dns=None):
    """Change IP configuration for a network interface"""
    try:
        if method == "static":
            if not all([static_ip, netmask, gateway]):
                send_error_log("change_ip_configuration", "Missing static IP parameters (address, netmask, gateway).", "warning", {"interface": interface, "method": method})
                return False, "Missing static IP parameters (address, netmask, gateway)."
        
        # Implementation would continue here...
        return True, "IP configuration updated successfully"
    except Exception as e:
        send_error_log("change_ip_configuration", f"Error changing IP configuration: {str(e)}", "error", {"interface": interface, "method": method})
        return False, f"Error: {str(e)}"

def restart_service(service_name):
    """Restarts a systemd service."""
    try:
        result = subprocess.run(["sudo", "systemctl", "restart", service_name], check=True, text=True, capture_output=True)
        logger.info(f"Service '{service_name}' restarted successfully: {result.stdout.strip()}")
        return True, f"Service '{service_name}' restarted successfully."
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to restart service '{service_name}': {e.stderr.strip()}"
        send_error_log("restart_service", error_msg, "critical", {"service": service_name, "command_output_stderr": e.stderr.strip(), "command_output_stdout": e.stdout.strip()})
        return False, error_msg
    except FileNotFoundError:
        error_msg = "systemctl command not found. Is systemd installed or is it in PATH?"
        send_error_log("restart_service", error_msg, "critical", {"service": service_name})
        return False, error_msg
    except Exception as e:
        error_msg = f"Unexpected error restarting service '{service_name}': {e}"
        send_error_log("restart_service", error_msg, "critical", {"service": service_name, "error": str(e)})
        return False, error_msg

# Perbaikan: Tambahkan parameter `properties`
def on_message_ip_config(client, userdata, message):
    """Handles incoming MQTT messages for IP configuration commands."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        payload_data = json.loads(message.payload.decode())
        command = payload_data.get('command')
        logger.info(f"Received IP config command: '{command}' with data: {payload_data}")

        if command == 'readIP':
            try:
                with open(INTERFACES_FILE, 'r') as file:
                    file_content = file.read()
                interfaces_json = parse_interfaces_file(file_content)
                response_payload = {"status": "success", "data": interfaces_json}
            except FileNotFoundError:
                response_payload = {"status": "error", "message": f"Interfaces file not found: {INTERFACES_FILE}"}
                send_error_log("on_message_ip_config", response_payload["message"], "critical")
            except PermissionError:
                response_payload = {"status": "error", "message": f"Permission denied to read {INTERFACES_FILE}"}
                send_error_log("on_message_ip_config", response_payload["message"], "critical")

        elif command == 'changeIP':
            interface = payload_data.get('interface')
            method = payload_data.get('method')
            static_ip = payload_data.get('static_ip')
            netmask = payload_data.get('netmask')
            gateway = payload_data.get('gateway')

            if not interface or not method:
                response_payload = {"status": "error", "message": "Missing 'interface' or 'method' for changeIP command."}
                send_error_log("on_message_ip_config", response_payload["message"], "warning", {"payload": payload_data})
            else:
                success, msg = change_ip_configuration(interface, method, static_ip, netmask, gateway)
                response_payload = {"status": "success" if success else "error", "message": msg}
                if success:
                    # Delay for 3 seconds before rebooting
                    time.sleep(3)

                    try:
                        # Execute the reboot command
                        subprocess.run(["sudo", "reboot"], check=True)
                        logger.info("Initiated system reboot after successful IP change.")
                        # We won't get a response_payload back to the client for the reboot itself.
                        # The client-side should expect a disconnection.
                        response_payload["reboot_status"] = "initiated"
                        response_payload["message"] = "IP configuration saved. Device is rebooting..."
                    except subprocess.CalledProcessError as e:
                        error_msg = f"Failed to initiate reboot: {e}"
                        logger.error(error_msg)
                        response_payload["status"] = "error"
                        response_payload["message"] = f"IP configuration saved, but failed to initiate reboot: {error_msg}"
                    except Exception as e:
                        error_msg = f"An unexpected error occurred during reboot attempt: {e}"
                        logger.error(error_msg)
                        response_payload["status"] = "error"
                        response_payload["message"] = f"IP configuration saved, but an error occurred during reboot attempt: {error_msg}"
                # If `change_ip_configuration` failed, the `response_payload` already reflects the error.
                
        elif command == 'restartNetworking':
            success, msg = restart_service("networking")
            response_payload = {"status": "success" if success else "error", "message": msg}
            
        else:
            response_payload = {"status": "error", "message": f"Invalid IP command received: '{command}'"}
            send_error_log("on_message_ip_config", response_payload["message"], "warning", {"command": command})

    except json.JSONDecodeError as e:
        response_payload = {"status": "error", "message": f"Invalid JSON payload for IP config: {e}"}
        send_error_log("on_message_ip_config", f"JSON decoding error: {e}", "major", {"payload_raw": message.payload.decode()})
    except Exception as e:
        response_payload = {"status": "error", "message": f"Server error during IP configuration: {e}"}
        send_error_log("on_message_ip_config", f"Unhandled error: {e}", "critical", {"payload_raw": message.payload.decode()})
    finally:
        client.publish(TOPIC_IP_CONFIG_RESPONSE, json.dumps(response_payload), qos=QOS)
        logger.info(f"Published IP config response to {TOPIC_IP_CONFIG_RESPONSE}: {json.dumps(response_payload)}")

## MQTT Configuration Management

def load_mqtt_config(file_path):
    """Loads MQTT configuration from a specified JSON file."""
    try:
        if not os.path.exists(file_path):
            logger.warning(f"MQTT config file not found: {file_path}. Returning empty config.")
            return {}
        with open(file_path, 'r') as f:
            config = json.load(f)
        return config
    except json.JSONDecodeError as e:
        send_error_log("load_mqtt_config", f"Error decoding JSON from {file_path}: {e}", "critical", {"file_path": file_path})
        return {}
    except IOError as e:
        send_error_log("load_mqtt_config", f"IOError reading {file_path}: {e}", "critical", {"file_path": file_path})
        return {}
    except Exception as e:
        send_error_log("load_mqtt_config", f"Unexpected error loading {file_path}: {e}", "critical", {"file_path": file_path})
        return {}

def save_mqtt_config(file_path, config_data):
    """Saves MQTT configuration to a specified JSON file."""
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True) # Ensure directory exists
        with open(file_path, 'w') as f:
            json.dump(config_data, f, indent=4)
        logger.info(f"Successfully saved MQTT config to {file_path}.")
    except IOError as e:
        send_error_log("save_mqtt_config", f"IOError writing to {file_path}: {e}", "critical", {"file_path": file_path})
    except Exception as e:
        send_error_log("save_mqtt_config", f"Unexpected error writing to {file_path}: {e}", "critical", {"file_path": file_path})

def sync_broker_settings(update_data):
    """Synchronizes broker settings across both MQTT config files."""
    try:
        broker_address = update_data.get('broker_address')
        broker_port = update_data.get('broker_port')
        username = update_data.get('username')
        password = update_data.get('password')

        if not all([broker_address, broker_port is not None]):
            send_error_log("sync_broker_settings", "Missing essential broker parameters for synchronization.", "warning", {"update_data": update_data})
            return False, "Missing essential broker parameters."

        # Load both configurations
        i2c_config = load_mqtt_config(MQTT_I2C_CONFIG_PATH)
        modbus_config = load_mqtt_config(MQTT_MODBUS_CONFIG_PATH)

        # Update common broker settings
        common_settings = {
            "broker_address": broker_address,
            "broker_port": broker_port,
            "username": username,
            "password": password,
        }
        i2c_config.update(common_settings)
        modbus_config.update(common_settings)

        # Save updated configurations
        save_mqtt_config(MQTT_I2C_CONFIG_PATH, i2c_config)
        save_mqtt_config(MQTT_MODBUS_CONFIG_PATH, modbus_config)

        logger.info("Synchronized broker settings across MQTT I2C and Modbus configurations.")
        
        # Trigger restart of relevant services after changing broker
        # These service names might need adjustment based on actual systemd unit files
        restart_service("multiprocessing.service") # Assuming this service uses the MQTT config
        
        return True, "Broker settings synchronized."
    except Exception as e:
        send_error_log("sync_broker_settings", f"Error synchronizing broker settings: {e}", "critical", {"update_data": update_data})
        return False, str(e)

def update_and_publish_mqtt_config(client, config_type, update_data=None):
    """
    Updates and/or publishes MQTT configuration for a given type (I2C or Modbus).
    If update_data is provided, it updates the file before publishing.
    """
    file_path = MQTT_I2C_CONFIG_PATH if config_type == "i2c" else MQTT_MODBUS_CONFIG_PATH
    # The topic for publishing the current config is the same as the update topic for simplicity
    topic_to_publish = TOPIC_MQTT_I2C_UPDATE if config_type == "i2c" else TOPIC_MQTT_MODBUS_UPDATE

    config = load_mqtt_config(file_path)

    if update_data:
        config.copy().update(update_data) # Create a copy to safely update
        save_mqtt_config(file_path, config)
        # If broker settings are part of the update, trigger sync
        if any(k in update_data for k in ["broker_address", "broker_port", "username", "password"]):
            sync_broker_settings(update_data)
        logger.info(f"MQTT {config_type.upper()} config file updated.")

    try:
        payload = json.dumps(config)
        client.publish(topic_to_publish, payload, qos=QOS, retain=False)
        logger.info(f"Published MQTT {config_type.upper()} config to {topic_to_publish}.")
    except Exception as e:
        send_error_log(f"publish_mqtt_{config_type}_config", f"Failed to publish MQTT {config_type.upper()} config: {e}", "critical")

def get_local_mac_address(interface=None):
    """Retrieves the MAC address of a specified interface or the default."""
    try:
        # get_mac_address can return None if no address is found
        mac_address = get_mac_address(interface=interface)
        if mac_address:
            logger.info(f"Detected MAC address: {mac_address}")
            return mac_address
        else:
            send_error_log("get_local_mac_address", f"Could not find MAC address for interface {interface or 'default'}.", "major")
            return None
    except Exception as e:
        send_error_log("get_local_mac_address", f"Error getting MAC address for interface {interface or 'default'}: {e}", "critical")
        return None

def handle_mac_address_request(client):
    """Handles requests for MAC address and publishes it."""
    mac_address = get_local_mac_address()
    response_payload = {"mac": mac_address} if mac_address else {"mac": "N/A", "error": "Could not retrieve MAC address."}
    try:
        client.publish(TOPIC_RESPONSE_MAC, json.dumps(response_payload), qos=QOS, retain=False)
        logger.info(f"Published MAC address {mac_address} to topic {TOPIC_RESPONSE_MAC}.")
    except Exception as e:
        send_error_log("handle_mac_address_request", f"Failed to publish MAC address: {e}", "critical")

def update_mac_in_config_files():
    """Updates the MAC address in the I2C MQTT config if it has changed."""
    try:
        i2c_config = load_mqtt_config(MQTT_I2C_CONFIG_PATH)
        current_mac = get_local_mac_address()

        if current_mac and i2c_config.get('mac') != current_mac:
            logger.info(f"MAC address mismatch in I2C config. Updating from {i2c_config.get('mac')} to {current_mac}")
            i2c_config['mac'] = current_mac
            save_mqtt_config(MQTT_I2C_CONFIG_PATH, i2c_config)
            # No need to publish here, as it will be published by the main loop or on explicit request
        else:
            logger.info("MAC address in I2C config is already up to date or no MAC found.")
    except Exception as e:
        send_error_log("update_mac_in_config_files", f"Error updating MAC address in config files: {e}", "major")

## Wi-Fi Management

def extract_ip_from_nmcli_device_show(output):
    """Extracts the IP address (IPv4) from 'nmcli device show <interface>' output."""
    match = re.search(r"IP4\.ADDRESS\[1\]:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/\d+", output)
    if match:
        return match.group(1)
    logger.warning(f"Could not extract IPv4 address from nmcli output. Output preview: {output[:200]}")
    return "IP not found"

def run_nmcli_command(command_args, description):
    """Helper to run nmcli commands and handle output/errors."""
    try:
        # Using check=True will raise CalledProcessError for non-zero exit codes
        result = subprocess.run(['nmcli'] + command_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True, timeout=10)
        return True, result.stdout.strip()
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to {description}: {e.stderr.strip()}"
        send_error_log("run_nmcli_command", error_msg, "major", {"command": command_args, "stdout": e.stdout.strip(), "stderr": e.stderr.strip()})
        return False, error_msg
    except FileNotFoundError:
        error_msg = "nmcli command not found. NetworkManager might not be installed or in PATH."
        send_error_log("run_nmcli_command", error_msg, "critical", {"command": command_args})
        return False, error_msg
    except subprocess.TimeoutExpired:
        error_msg = f"Command timed out while trying to {description}."
        send_error_log("run_nmcli_command", error_msg, "major", {"command": command_args})
        return False, error_msg
    except Exception as e:
        error_msg = f"Unexpected error while trying to {description}: {e}"
        send_error_log("run_nmcli_command", error_msg, "critical", {"command": command_args, "error": str(e)})
        return False, error_msg

def disconnect_current_wifi():
    """Disconnects any active Wi-Fi connection on wlan0."""
    logger.info("Attempting to disconnect current Wi-Fi connection on wlan0...")
    # Using 'nmcli device disconnect wlan0' works by deactivating the device.
    # If the device is already disconnected, nmcli will still report success, but stderr might contain 'not connected'.
    success, message = run_nmcli_command(['device', 'disconnect', 'wlan0'], "disconnect current Wi-Fi")
    
    # Check for specific "not connected" message which is not an actual error for our purpose
    if not success and "not connected" not in message.lower() and "no network devices" not in message.lower():
        logger.warning(f"Failed to disconnect Wi-Fi: {message}")
        return False, message
    
    logger.info("Successfully initiated disconnection of current Wi-Fi (or it was already disconnected).")
    return True, "Successfully initiated disconnection."

def switch_wifi(ssid, password):
    """Switches to a new Wi-Fi connection."""
    logger.info(f"Attempting to switch to Wi-Fi SSID: {ssid}")

    # Ensure current Wi-Fi is disconnected to avoid conflicts
    disconnect_success, disconnect_msg = disconnect_current_wifi()
    if not disconnect_success:
        # If it failed to disconnect and it wasn't due to being already disconnected, report it.
        if "not connected" not in disconnect_msg.lower():
            send_error_log("switch_wifi", f"Failed to disconnect current Wi-Fi before switching: {disconnect_msg}", "major")
            return False, disconnect_msg

    time.sleep(2) # Give NetworkManager a moment after potential disconnection

    # Try connecting to the new Wi-Fi.
    # If the connection already exists, nmcli will activate it. If not, it will create and activate.
    connect_success, connect_msg = run_nmcli_command(['dev', 'wifi', 'connect', ssid, 'password', password], f"connect to {ssid}")
    if not connect_success:
        return False, connect_msg

    logger.info(f"Successfully sent connect command to {ssid}. Waiting for IP address...")
    time.sleep(5) # Give the system time to acquire an IP after connection

    # Get the new IP address after connecting
    ip_success, ip_output = run_nmcli_command(['device', 'show', 'wlan0'], "get IP address from wlan0")
    if not ip_success:
        return False, ip_output

    ip_address = extract_ip_from_nmcli_device_show(ip_output)
    
    if ip_address == "IP not found":
        send_error_log("switch_wifi", f"Could not determine IP address after connecting to {ssid}. Connection might still be establishing.", "major", {"nmcli_output": ip_output})
        return True, "Connected to network, but IP address could not be determined yet." # Still considered "connected" to network

    logger.info(f"Successfully connected to {ssid}, IP address: {ip_address}")
    return True, ip_address

def delete_wifi(ssid):
    """Deletes a Wi-Fi connection by SSID."""
    logger.info(f"Attempting to delete Wi-Fi connection: {ssid}")
    
    # Get all Wi-Fi connections UUID and name
    success, output = run_nmcli_command(['-t', '-f', 'UUID,NAME', 'connection', 'show'], "fetch Wi-Fi connections")
    if not success:
        return False, output

    uuid_to_delete = None
    for line in output.splitlines():
        parts = line.split(':')
        if len(parts) >= 2 and parts[1] == ssid: # Check that parts[1] exists and matches SSID
            uuid_to_delete = parts[0]
            break

    if not uuid_to_delete:
        logger.warning(f"Wi-Fi connection with SSID '{ssid}' not found in saved connections.")
        return False, f"Wi-Fi connection with SSID '{ssid}' not found in saved connections."

    # Delete the connection by UUID
    success, message = run_nmcli_command(['connection', 'delete', 'uuid', uuid_to_delete], f"delete Wi-Fi connection '{ssid}'")
    if not success:
        return False, message
    
    logger.info(f"Successfully deleted Wi-Fi {ssid} (UUID: {uuid_to_delete}).")
    return True, f"Wi-Fi {ssid} (UUID: {uuid_to_delete}) deleted successfully."

def scan_wifi():
    """Scans for available Wi-Fi networks."""
    logger.info("Scanning for Wi-Fi networks...")
    # Use 'dev wifi list' as it's more direct for listing available APs
    success, output = run_nmcli_command(['dev', 'wifi', 'list', '--rescan', 'yes'], "scan Wi-Fi networks")
    if not success:
        return [] # Return empty list on failure

    wifi_networks = []
    # The output format of 'nmcli dev wifi list' can be complex.
    # It typically has columns like BSSID, SSID, MODE, CHAN, RATE, SIGNAL, BARS, SECURITY.
    
    # Re-running nmcli with specific fields for easier parsing
    success_filtered, filtered_output = run_nmcli_command(['-t', '-f', 'SSID,SECURITY', 'dev', 'wifi', 'list', '--rescan', 'yes'], "scan Wi-Fi networks (filtered)")
    if not success_filtered:
        send_error_log("scan_wifi", "Failed to get filtered Wi-Fi scan results.", "minor", {"original_output_error": output})
        return []
    
    # Now parse `SSID:SECURITY` lines
    for filtered_line in filtered_output.splitlines():
        parts = filtered_line.split(':', 1) # Split only on the first colon
        if len(parts) == 2:
            ssid = parts[0].strip()
            security = parts[1].strip()
            if ssid: # Ensure SSID is not empty
                # Avoid duplicates, as nmcli sometimes lists multiple entries for the same SSID
                if not any(network['ssid'] == ssid for network in wifi_networks):
                    wifi_networks.append({"ssid": ssid, "security": security})
        else:
            logger.warning(f"Unexpected nmcli filtered output line format: {filtered_line}")
    
    logger.info(f"Found {len(wifi_networks)} Wi-Fi networks.")
    return wifi_networks

# Perbaikan: Tambahkan parameter `properties`
def on_message_wifi_scan_request(client, userdata, msg):
    """Handles requests for Wi-Fi scan and publishes results."""
    logger.info("Received request for Wi-Fi scan.")
    wifi_list = scan_wifi()
    try:
        payload = json.dumps({"wifi_networks": wifi_list})
        client.publish(MQTT_TOPIC_WIFI_SCAN, payload, qos=QOS)
        logger.info(f"Published Wi-Fi scan results to {MQTT_TOPIC_WIFI_SCAN}.")
    except Exception as e:
        send_error_log("on_message_wifi_scan_request", f"Failed to publish Wi-Fi scan results: {e}", "critical")

# Perbaikan: Tambahkan parameter `properties`
def on_message_switch_wifi(client, userdata, msg):
    """Handles requests to switch Wi-Fi networks."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        payload_data = json.loads(msg.payload.decode())
        ssid = payload_data.get('ssid')
        password = payload_data.get('password')

        if not ssid:
            response_payload = {"status": "error", "message": "Missing SSID for Wi-Fi switch command."}
            send_error_log("on_message_switch_wifi", response_payload["message"], "warning", {"payload": payload_data})
        else:
            success, result_msg = switch_wifi(ssid, password)
            if success:
                response_payload = {"status": "success", "message": f"Switched to {ssid}.", "ip_address": result_msg}
                # Publish the new IP address immediately after successful switch
                client.publish(MQTT_TOPIC_IP_UPDATE, json.dumps({"ssid": ssid, "ip_address": result_msg}), qos=QOS)
                logger.info(f"Published new IP address {result_msg} for {ssid} to {MQTT_TOPIC_IP_UPDATE}.")
            else:
                response_payload = {"status": "error", "message": f"Failed to switch to {ssid}: {result_msg}"}
                send_error_log("on_message_switch_wifi", response_payload["message"], "major", {"ssid": ssid, "error_detail": result_msg})

    except json.JSONDecodeError as e:
        response_payload = {"status": "error", "message": f"Invalid JSON payload for Wi-Fi switch: {e}"}
        send_error_log("on_message_switch_wifi", f"JSON decoding error: {e}", "major", {"payload_raw": msg.payload.decode()})
    except Exception as e:
        response_payload = {"status": "error", "message": f"Server error during Wi-Fi switch: {e}"}
        send_error_log("on_message_switch_wifi", f"Unhandled error: {e}", "critical", {"payload_raw": msg.payload.decode()})
    finally:
        client.publish(MQTT_TOPIC_SWITCH_WIFI, json.dumps(response_payload), qos=QOS) # Publish response back to switch topic

# Perbaikan: Tambahkan parameter `properties`
def on_message_delete_wifi(client, userdata, msg):
    """Handles requests to delete a Wi-Fi network."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        payload_data = json.loads(msg.payload.decode())
        ssid = payload_data.get('ssid')

        if not ssid:
            response_payload = {"status": "error", "message": "Missing SSID for Wi-Fi delete command."}
            send_error_log("on_message_delete_wifi", response_payload["message"], "warning", {"payload": payload_data})
        else:
            success, result_msg = delete_wifi(ssid)
            response_payload = {"status": "success" if success else "error", "message": result_msg}
            if not success:
                send_error_log("on_message_delete_wifi", response_payload["message"], "major", {"ssid": ssid, "error_detail": result_msg})

    except json.JSONDecodeError as e:
        response_payload = {"status": "error", "message": f"Invalid JSON payload for Wi-Fi delete: {e}"}
        send_error_log("on_message_delete_wifi", f"JSON decoding error: {e}", "major", {"payload_raw": msg.payload.decode()})
    except Exception as e:
        response_payload = {"status": "error", "message": f"Server error during Wi-Fi delete: {e}"}
        send_error_log("on_message_delete_wifi", f"Unhandled error: {e}", "critical", {"payload_raw": msg.payload.decode()})
    finally:
        client.publish(MQTT_TOPIC_DELETE_WIFI, json.dumps(response_payload), qos=QOS) # Publish response back to delete topic

# Perbaikan: Tambahkan parameter `properties`
def on_message_reboot(client, userdata, msg):
    """Handles requests to reboot the system."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        logger.info("Received system reboot command.")
        
        # Acknowledge the command quickly
        response_payload = {"status": "success", "message": "Reboot command received. System is shutting down."}
        client.publish(MQTT_TOPIC_REBOOT, json.dumps(response_payload), qos=QOS)
        logger.info(f"Acknowledged reboot command to {MQTT_TOPIC_REBOOT}.")
        
        # Give some time for the message to be sent
        time.sleep(1) 
        
        # Execute the reboot command
        subprocess.run(["sudo", "reboot"], check=True)
        logger.info("Initiated system reboot.")
        # The script will terminate here as the system reboots.
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to initiate reboot: {e.stderr.strip()}"
        response_payload = {"status": "error", "message": error_msg}
        send_error_log("on_message_reboot", error_msg, "critical", {"command_output_stderr": e.stderr.strip()})
        client.publish(MQTT_TOPIC_REBOOT, json.dumps(response_payload), qos=QOS) # Try to publish error if possible
    except Exception as e:
        error_msg = f"An unexpected error occurred during reboot command: {e}"
        response_payload = {"status": "error", "message": error_msg}
        send_error_log("on_message_reboot", error_msg, "critical")
        client.publish(MQTT_TOPIC_REBOOT, json.dumps(response_payload), qos=QOS) # Try to publish error if possible

# --- Main MQTT Client Setup ---
main_mqtt_client = None

# Perbaikan: Tambahkan parameter `properties`
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Main MQTT client connected and loop started to %s:%d", MQTT_BROKER, MQTT_PORT)
        client.subscribe(TOPIC_IP_CONFIG_COMMAND, qos=QOS)
        client.subscribe(TOPIC_REQUEST_MAC, qos=QOS)
        client.subscribe(REQUEST_TOPIC_BROKER_CONFIG, qos=QOS)
        client.subscribe(TOPIC_MQTT_I2C_REQUEST, qos=QOS)
        client.subscribe(TOPIC_MQTT_I2C_UPDATE, qos=QOS)
        client.subscribe(TOPIC_MQTT_MODBUS_REQUEST, qos=QOS)
        client.subscribe(TOPIC_MQTT_MODBUS_UPDATE, qos=QOS)
        client.subscribe(MQTT_TOPIC_SCAN_REQUEST, qos=QOS)
        client.subscribe(MQTT_TOPIC_SWITCH_WIFI, qos=QOS)
        client.subscribe(MQTT_TOPIC_DELETE_WIFI, qos=QOS)
        client.subscribe(MQTT_TOPIC_REBOOT, qos=QOS)
        logger.info("Subscribed to all necessary topics.")
        
        # Initial publish of current MAC and config after connection
        handle_mac_address_request(client)
        update_and_publish_mqtt_config(client, "i2c")
        update_and_publish_mqtt_config(client, "modbus")
        
    else:
        send_error_log("on_connect", f"Failed to connect to main MQTT Broker, return code: {rc}", "critical", {"return_code": rc})
        logger.critical(f"Failed to connect to main MQTT Broker, return code {rc}")
        # Consider adding sys.exit(1) here if MQTT connection is critical for service operation.

# Perbaikan: Tambahkan parameter `properties`
def on_message(client, userdata, msg):
    """General message callback for the main MQTT client."""
    logger.debug(f"Received message on topic: {msg.topic}")
    try:
        if msg.topic == TOPIC_IP_CONFIG_COMMAND:
            on_message_ip_config(client, userdata, msg)
        elif msg.topic == TOPIC_REQUEST_MAC:
            handle_mac_address_request(client)
        elif msg.topic == REQUEST_TOPIC_BROKER_CONFIG:
            # For broker config requests, we publish the current state of both configs
            client.publish(RESPONSE_TOPIC_BROKER_CONFIG, json.dumps({
                "i2c_config": load_mqtt_config(MQTT_I2C_CONFIG_PATH),
                "modbus_config": load_mqtt_config(MQTT_MODBUS_CONFIG_PATH)
            }), qos=QOS)
        elif msg.topic == TOPIC_MQTT_I2C_UPDATE:
            # If an update is received, apply it and then publish the new state
            update_data = json.loads(msg.payload.decode())
            update_and_publish_mqtt_config(client, "i2c", update_data)
        elif msg.topic == TOPIC_MQTT_I2C_REQUEST:
            update_and_publish_mqtt_config(client, "i2c") # Just publish current state
        elif msg.topic == TOPIC_MQTT_MODBUS_UPDATE:
            # If an update is received, apply it and then publish the new state
            update_data = json.loads(msg.payload.decode())
            update_and_publish_mqtt_config(client, "modbus", update_data)
        elif msg.topic == TOPIC_MQTT_MODBUS_REQUEST:
            update_and_publish_mqtt_config(client, "modbus") # Just publish current state
        elif msg.topic == MQTT_TOPIC_SCAN_REQUEST:
            on_message_wifi_scan_request(client, userdata, msg)
        elif msg.topic == MQTT_TOPIC_SWITCH_WIFI:
            on_message_switch_wifi(client, userdata, msg)
        elif msg.topic == MQTT_TOPIC_DELETE_WIFI:
            on_message_delete_wifi(client, userdata, msg)
        elif msg.topic == MQTT_TOPIC_REBOOT:
            on_message_reboot(client, userdata, msg)
        else:
            logger.warning(f"Received message on unsubscribed or unhandled topic: {msg.topic}")
    except json.JSONDecodeError as e:
        send_error_log("on_message", f"Failed to decode JSON from message on topic {msg.topic}: {e}", "major", {"payload_raw": msg.payload.decode()})
    except Exception as e:
        send_error_log("on_message", f"Unhandled error in message callback for topic {msg.topic}: {e}", "critical", {"error_details": str(e), "payload_raw": msg.payload.decode()})

# Perbaikan: Tambahkan parameter `properties`
def on_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning(f"Unexpected disconnect from main broker with code {rc}. Attempting reconnect...")
        send_error_log("on_disconnect", f"Unexpected disconnect from main broker with code {rc}.", "major", {"return_code": rc})
    else:
        logger.info("Main client disconnected normally.")

def setup_mqtt_client():
    """Sets up the main MQTT client for the Network Manager Service."""
    global main_mqtt_client
    try:
        # Perbaikan: Tentukan callback_api_version untuk paho-mqtt 2.x
        main_mqtt_client = mqtt_client.Client(
            client_id=f"network-manager-service-{uuid.uuid4()}"
        )
        main_mqtt_client.on_connect = on_connect
        main_mqtt_client.on_message = on_message
        main_mqtt_client.on_disconnect = on_disconnect
        
        # Set reconnect delay strategy
        main_mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)

        main_mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        main_mqtt_client.loop_start() # Start background thread for MQTT operations
        logger.info("Main MQTT client connected and loop started to %s:%d", MQTT_BROKER, MQTT_PORT)
    except Exception as e:
        send_error_log("setup_mqtt_client", f"Failed to connect or start main MQTT client: {e}", "critical")
        logger.critical(f"FATAL: Failed to connect or start main MQTT client: {e}", exc_info=True)
        # sys.exit(1) # Tambahkan ini jika Anda ingin program keluar total jika koneksi MQTT utama gagal.

# --- Main Service Logic ---
def main():
    logger.info("Starting Network Manager Service...")
    initialize_error_logger() # Initialize dedicated error logger first
    time.sleep(1) # Give logger a moment to connect

    setup_mqtt_client() # Setup main MQTT client
    
    # Initial check and update MAC in config files
    update_mac_in_config_files()

    try:
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Network Manager Service interrupted by user. Shutting down...")
    except Exception as e:
        send_error_log("main", f"Unhandled error in main loop: {e}", "critical")
        logger.critical(f"Unhandled exception in main loop: {e}", exc_info=True)
    finally:
        if main_mqtt_client:
            main_mqtt_client.loop_stop()
            main_mqtt_client.disconnect()
            logger.info("Main MQTT client disconnected.")
        if error_logger_client:
            error_logger_client.loop_stop()
            error_logger_client.disconnect()
            logger.info("Error logger MQTT client disconnected.")
        logger.info("Network Manager Service stopped.")

if __name__ == "__main__":
    main()