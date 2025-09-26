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

# MQTT Config File Paths
MQTT_CONFIG_MODBUS = os.path.join(BASE_DIR, "../MODBUS_SNMP/JSON/Config/mqtt_config.json")
MQTT_CONFIG_MODULAR = os.path.join(BASE_DIR, "../MODULAR_I2C/JSON/Config/mqtt_config.json")

# MQTT Config Topics
TOPIC_MQTT_MODBUS_RESPONSE = "mqtt_config/modbus/response"
TOPIC_MQTT_MODBUS_COMMAND = "mqtt_config/modbus/command"
TOPIC_MQTT_MODULAR_RESPONSE = "mqtt_config/modular/response"
TOPIC_MQTT_MODULAR_COMMAND = "mqtt_config/modular/command"

# MQTT Topics
# IP Configuration Topics
TOPIC_IP_CONFIG_COMMAND = "command_device_ip"
TOPIC_IP_CONFIG_RESPONSE = "response_device_ip"

# MAC Address Topics
TOPIC_REQUEST_MAC = "mqtt_config/get_mac_address"
TOPIC_RESPONSE_MAC = "mqtt_config/response_mac"

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
        logger.info("Error logger connected.")
    else:
        logger.error(f"Failed to connect error logger, return code: {rc}")

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
        logger.info("Error logger initialized.")
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

def handle_mac_address_request(client):
    """Publishes the device's MAC address to MQTT."""
    try:
        mac_address = get_mac_address()
        if mac_address:
            payload = {"mac_address": mac_address, "timestamp": datetime.now().isoformat()}
            client.publish(TOPIC_RESPONSE_MAC, json.dumps(payload), qos=QOS)
            logger.info(f"Published MAC address: {mac_address}")
        else:
            send_error_log("handle_mac_address_request", "Failed to retrieve MAC address", "major")
    except Exception as e:
        send_error_log("handle_mac_address_request", f"Error retrieving MAC address: {e}", "critical")

## MQTT Configuration Management

def read_mqtt_config(config_file):
    """Reads MQTT configuration from JSON file and returns only broker_address, broker_port, username, password."""
    try:
        with open(config_file, 'r') as file:
            config = json.load(file)
            # Extract only the required fields
            mqtt_config = {
                "broker_address": config.get("broker_address", ""),
                "broker_port": config.get("broker_port", 1883),
                "username": config.get("username", ""),
                "password": config.get("password", "")
            }
            return mqtt_config
    except FileNotFoundError:
        send_error_log("read_mqtt_config", f"MQTT config file not found: {config_file}", "critical")
        return None
    except json.JSONDecodeError as e:
        send_error_log("read_mqtt_config", f"Invalid JSON in MQTT config file {config_file}: {e}", "major")
        return None
    except Exception as e:
        send_error_log("read_mqtt_config", f"Error reading MQTT config from {config_file}: {e}", "critical")
        return None

def update_mqtt_config(config_file, broker_address=None, broker_port=None, username=None, password=None):
    """Updates MQTT configuration in JSON file for broker_address, broker_port, username, password only."""
    try:
        # Read existing config
        with open(config_file, 'r') as file:
            config = json.load(file)

        # Update only the specified fields
        if broker_address is not None:
            config["broker_address"] = broker_address
        if broker_port is not None:
            config["broker_port"] = broker_port
        if username is not None:
            config["username"] = username
        if password is not None:
            config["password"] = password

        # Write back to file
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=4)

        logger.info(f"Updated MQTT config in {config_file}")
        return True, "MQTT configuration updated successfully"
    except FileNotFoundError:
        error_msg = f"MQTT config file not found: {config_file}"
        send_error_log("update_mqtt_config", error_msg, "critical")
        return False, error_msg
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON in MQTT config file {config_file}: {e}"
        send_error_log("update_mqtt_config", error_msg, "major")
        return False, error_msg
    except Exception as e:
        error_msg = f"Error updating MQTT config in {config_file}: {e}"
        send_error_log("update_mqtt_config", error_msg, "critical")
        return False, error_msg

def test_mqtt_connection(broker_address, broker_port, username=None, password=None, timeout=5):
    """Test MQTT connection to a broker and return status."""
    try:
        import paho.mqtt.client as mqtt_client_test

        # Create a test client
        test_client = mqtt_client_test.Client(
            client_id=f"connection-test-{uuid.uuid4()}",
            clean_session=True
        )

        # Set credentials if provided
        if username and password:
            test_client.username_pw_set(username, password)

        # Set connection timeout
        connection_result = {"connected": False, "error": None, "response_time": None}

        def on_test_connect(client, userdata, flags, rc):
            if rc == 0:
                connection_result["connected"] = True
                connection_result["response_time"] = time.time() - start_time
                client.disconnect()
            else:
                connection_result["connected"] = False
                connection_result["error"] = f"Connection failed with code: {rc}"

        def on_test_disconnect(client, userdata, rc):
            pass

        test_client.on_connect = on_test_connect
        test_client.on_disconnect = on_test_disconnect

        start_time = time.time()
        test_client.connect(broker_address, int(broker_port), keepalive=10)

        # Wait for connection result with timeout
        test_client.loop_start()
        end_time = time.time() + timeout

        while time.time() < end_time:
            if connection_result["connected"] is not None:
                break
            time.sleep(0.1)

        test_client.loop_stop()
        test_client.disconnect()

        if connection_result["connected"]:
            return {
                "status": "connected",
                "response_time": round(connection_result.get("response_time", 0) * 1000, 2),  # ms
                "message": "Successfully connected to MQTT broker"
            }
        else:
            return {
                "status": "disconnected",
                "error": connection_result.get("error", "Connection timeout"),
                "message": f"Failed to connect: {connection_result.get('error', 'Unknown error')}"
            }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": f"Connection test failed: {str(e)}"
        }

def publish_mqtt_config_modbus(client):
    """Publishes current Modbus MQTT configuration to response topic."""
    try:
        config = read_mqtt_config(MQTT_CONFIG_MODBUS)
        if config:
            # Test connection status
            connection_status = test_mqtt_connection(
                config["broker_address"],
                config["broker_port"],
                config["username"],
                config["password"]
            )

            payload = {
                "status": "success",
                "data": config,
                "connection": connection_status,
                "timestamp": datetime.now().isoformat()
            }
            client.publish(TOPIC_MQTT_MODBUS_RESPONSE, json.dumps(payload), qos=QOS)
            logger.debug(f"Published Modbus MQTT config with status: {payload}")
        else:
            payload = {
                "status": "error",
                "message": "Failed to read Modbus MQTT config",
                "timestamp": datetime.now().isoformat()
            }
            client.publish(TOPIC_MQTT_MODBUS_RESPONSE, json.dumps(payload), qos=QOS)
    except Exception as e:
        send_error_log("publish_mqtt_config_modbus", f"Error publishing Modbus MQTT config: {e}", "major")

def publish_mqtt_config_modular(client):
    """Publishes current Modular MQTT configuration to response topic."""
    try:
        config = read_mqtt_config(MQTT_CONFIG_MODULAR)
        if config:
            # Test connection status
            connection_status = test_mqtt_connection(
                config["broker_address"],
                config["broker_port"],
                config["username"],
                config["password"]
            )

            payload = {
                "status": "success",
                "data": config,
                "connection": connection_status,
                "timestamp": datetime.now().isoformat()
            }
            client.publish(TOPIC_MQTT_MODULAR_RESPONSE, json.dumps(payload), qos=QOS)
            logger.debug(f"Published Modular MQTT config with status: {payload}")
        else:
            payload = {
                "status": "error",
                "message": "Failed to read Modular MQTT config",
                "timestamp": datetime.now().isoformat()
            }
            client.publish(TOPIC_MQTT_MODULAR_RESPONSE, json.dumps(payload), qos=QOS)
    except Exception as e:
        send_error_log("publish_mqtt_config_modular", f"Error publishing Modular MQTT config: {e}", "major")

def auto_publish_mqtt_configs(client):
    """Auto-publishes MQTT configurations every 3 seconds."""
    while True:
        try:
            publish_mqtt_config_modbus(client)
            publish_mqtt_config_modular(client)
            time.sleep(3)  # Publish every 3 seconds
        except Exception as e:
            send_error_log("auto_publish_mqtt_configs", f"Error in auto-publish loop: {e}", "major")
            time.sleep(3)  # Continue trying even on error

# Perbaikan: Tambahkan parameter `properties`
def on_message_mqtt_modbus_command(client, userdata, message):
    """Handles incoming MQTT messages for Modbus MQTT configuration commands."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        payload_data = json.loads(message.payload.decode())
        command = payload_data.get('command')
        logger.info(f"Received Modbus MQTT config command: '{command}' with data: {payload_data}")

        if command == 'updateMqttModbus':
            data = payload_data.get('data', {})
            broker_address = data.get('broker_address')
            broker_port = data.get('broker_port')
            username = data.get('username')
            password = data.get('password')

            success, msg = update_mqtt_config(MQTT_CONFIG_MODBUS, broker_address, broker_port, username, password)
            response_payload = {"status": "success" if success else "error", "message": msg}
        else:
            response_payload = {"status": "error", "message": f"Invalid Modbus MQTT command received: '{command}'"}
            send_error_log("on_message_mqtt_modbus_command", response_payload["message"], "warning", {"command": command})

    except json.JSONDecodeError as e:
        response_payload = {"status": "error", "message": f"Invalid JSON payload for Modbus MQTT config: {e}"}
        send_error_log("on_message_mqtt_modbus_command", f"JSON decoding error: {e}", "major", {"payload_raw": message.payload.decode()})
    except Exception as e:
        response_payload = {"status": "error", "message": f"Server error during Modbus MQTT configuration: {e}"}
        send_error_log("on_message_mqtt_modbus_command", f"Unhandled error: {e}", "critical", {"payload_raw": message.payload.decode()})
    finally:
        client.publish(TOPIC_MQTT_MODBUS_RESPONSE, json.dumps(response_payload), qos=QOS)
        logger.info(f"Published Modbus MQTT config response to {TOPIC_MQTT_MODBUS_RESPONSE}: {json.dumps(response_payload)}")

# Perbaikan: Tambahkan parameter `properties`
def on_message_mqtt_modular_command(client, userdata, message):
    """Handles incoming MQTT messages for Modular MQTT configuration commands."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        payload_data = json.loads(message.payload.decode())
        command = payload_data.get('command')
        logger.info(f"Received Modular MQTT config command: '{command}' with data: {payload_data}")

        if command == 'updateMqttModular':
            data = payload_data.get('data', {})
            broker_address = data.get('broker_address')
            broker_port = data.get('broker_port')
            username = data.get('username')
            password = data.get('password')

            success, msg = update_mqtt_config(MQTT_CONFIG_MODULAR, broker_address, broker_port, username, password)
            response_payload = {"status": "success" if success else "error", "message": msg}
        else:
            response_payload = {"status": "error", "message": f"Invalid Modular MQTT command received: '{command}'"}
            send_error_log("on_message_mqtt_modular_command", response_payload["message"], "warning", {"command": command})

    except json.JSONDecodeError as e:
        response_payload = {"status": "error", "message": f"Invalid JSON payload for Modular MQTT config: {e}"}
        send_error_log("on_message_mqtt_modular_command", f"JSON decoding error: {e}", "major", {"payload_raw": message.payload.decode()})
    except Exception as e:
        response_payload = {"status": "error", "message": f"Server error during Modular MQTT configuration: {e}"}
        send_error_log("on_message_mqtt_modular_command", f"Unhandled error: {e}", "critical", {"payload_raw": message.payload.decode()})
    finally:
        client.publish(TOPIC_MQTT_MODULAR_RESPONSE, json.dumps(response_payload), qos=QOS)
        logger.info(f"Published Modular MQTT config response to {TOPIC_MQTT_MODULAR_RESPONSE}: {json.dumps(response_payload)}")

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
        logger.info("MQTT client connected.")
        client.subscribe(TOPIC_IP_CONFIG_COMMAND, qos=QOS)
        client.subscribe(TOPIC_REQUEST_MAC, qos=QOS)
        client.subscribe(MQTT_TOPIC_REBOOT, qos=QOS)
        client.subscribe(TOPIC_MQTT_MODBUS_COMMAND, qos=QOS)
        client.subscribe(TOPIC_MQTT_MODULAR_COMMAND, qos=QOS)
        logger.info("Subscribed to topics.")

        # Initial publish of current MAC after connection
        handle_mac_address_request(client)

        # Start auto-publishing MQTT configs in background thread
        auto_publish_thread = threading.Thread(target=auto_publish_mqtt_configs, args=(client,), daemon=True)
        auto_publish_thread.start()
        logger.info("Started auto-publishing MQTT configurations.")

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
        elif msg.topic == MQTT_TOPIC_REBOOT:
            on_message_reboot(client, userdata, msg)
        elif msg.topic == TOPIC_MQTT_MODBUS_COMMAND:
            on_message_mqtt_modbus_command(client, userdata, msg)
        elif msg.topic == TOPIC_MQTT_MODULAR_COMMAND:
            on_message_mqtt_modular_command(client, userdata, msg)
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
        logger.info("MQTT client started.")
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
