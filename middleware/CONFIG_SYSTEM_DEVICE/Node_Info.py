#!/usr/bin/env python3
"""
Node Information Publisher Service
Publishes node network information to MQTT broker every 10 seconds
"""

import json
import os
import time
import subprocess
from datetime import datetime
import uuid
import paho.mqtt.client as mqtt
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("NodeInfoService")

# Configuration
CONFIG_FILE_PATH = "../MODBUS_SNMP/JSON/Config/mqtt_config.json"
NODE_INFO_CONFIG_FILE = "./JSON/nodeInfoConfig.json"

# Global variables loaded from config
NODE_NAME = "UNKNOWN_NODE"
BASE_TOPIC_MQTT = "NANO_PI/"

# Get MAC address using improved method
def get_active_mac_address():
    """Get MAC address from active network interface"""
    # Check for all common interface names (not just eth0/wlan0)
    common_interfaces = [
        'eno1', 'eno2', 'ens1', 'ens2', 'ens3',    # Ethernet
        'wlo1', 'wlo2', 'wlan0', 'wlan1', 'wlx',  # Wireless
        'eth0', 'eth1', 'eth2',                   # Legacy Ethernet
        'wlan0', 'wlan1', 'wlan2'                  # Legacy Wireless
    ]

    # Method 1: Use ip link command (most reliable)
    for interface in common_interfaces:
        try:
            result = subprocess.run(
                ["ip", "link", "show", interface],
                capture_output=True, text=True, timeout=2
            )
            if result.returncode == 0 and 'link/ether' in result.stdout:
                # Find the MAC address
                for line in result.stdout.split('\n'):
                    if 'link/ether' in line:
                        mac_parts = line.strip().split()
                        if len(mac_parts) >= 2:
                            mac_address = mac_parts[1].upper()
                            # Validate MAC format
                            if len(mac_address.split(':')) == 6 and len(mac_address) == 17:
                                # Check if interface is UP by looking for <UP> flag
                                first_line = result.stdout.split('\n')[0]
                                if '<UP,' in first_line or 'UP,' in first_line:
                                    logger.info(f"Found active MAC address from {interface}: {mac_address}")
                                    return mac_address
                                else:
                                    logger.info(f"Interface {interface} exists but is not UP (MAC: {mac_address})")
        except subprocess.SubprocessError:
            continue

    # Method 2: Use ifconfig (fallback)
    try:
        result = subprocess.run(['ifconfig'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                # Look for interface lines (not indented)
                if line and not line.startswith(' ') and not line.startswith('\t'):
                    interface_name = line.split(':')[0].strip()
                    if interface_name in common_interfaces or interface_name.startswith(('en', 'wl', 'eth', 'wlan')):
                        logger.info(f"Checking interface {interface_name} from ifconfig")
                        # Look for ether line
                        j = i + 1
                        while j < len(lines) and (lines[j].startswith(' ') or lines[j].startswith('\t')):
                            if 'ether ' in lines[j]:
                                mac_match = lines[j].split('ether ')[1].split()[0].strip().upper()
                                if len(mac_match.split(':')) == 6 and len(mac_match) == 17:
                                    logger.info(f"Found MAC address from {interface_name}: {mac_match}")
                                    return mac_match
                            j += 1
                i += 1
    except Exception as e:
        logger.warning(f"ifconfig method failed: {e}")

    # Method 3: Use sysfs directly (for all known interfaces)
    try:
        net_dir = '/sys/class/net'
        if os.path.exists(net_dir):
            for item in os.listdir(net_dir):
                interface_path = os.path.join(net_dir, item)
                address_file = os.path.join(interface_path, 'address')
                operstate_file = os.path.join(interface_path, 'operstate')

                try:
                    # Check if operstate is up
                    with open(operstate_file, 'r') as f:
                        operstate = f.read().strip()

                    if operstate.lower() == 'up':
                        # Get MAC address
                        with open(address_file, 'r') as f:
                            mac_address = f.read().strip().upper()

                        # Validate MAC format
                        if len(mac_address.split(':')) == 6 and len(mac_address) == 17 and mac_address != "00:00:00:00:00:00":
                            logger.info(f"Found active MAC address from {item} (sysfs): {mac_address}")
                            return mac_address
                except (FileNotFoundError, PermissionError):
                    continue
    except Exception as e:
        logger.warning(f"sysfs method failed: {e}")

    # Method 4: Try getmac library as last resort
    try:
        import getmac
        mac_address = getmac.get_mac_address()
        if mac_address and mac_address.upper() != "00:00:00:00:00:00":
            logger.info(f"Found MAC address using getmac library: {mac_address.upper()}")
            return mac_address.upper()
    except ImportError:
        logger.warning("getmac library not available")
    except Exception as e:
        logger.warning(f"getmac library method failed: {e}")

    # Final fallback
    logger.error("Could not find any valid MAC address from any network interface")
    return "00:00:00:00:00:00"

def load_node_info_config():
    """Load node information configuration from file"""
    global NODE_NAME, BASE_TOPIC_MQTT

    try:
        if os.path.exists(NODE_INFO_CONFIG_FILE):
            with open(NODE_INFO_CONFIG_FILE, "r") as file:
                config = json.load(file)
            NODE_NAME = config.get("NODE_NAME", "UNKNOWN_NODE")
            BASE_TOPIC_MQTT = config.get("BASE_TOPIC_MQTT", "NANO_PI/")
            logger.info(f"Node info config loaded from {NODE_INFO_CONFIG_FILE}")
            logger.info(f"NODE_NAME: {NODE_NAME}")
            logger.info(f"BASE_TOPIC_MQTT: {BASE_TOPIC_MQTT}")
            return True
        else:
            logger.warning(f"Node info config file not found: {NODE_INFO_CONFIG_FILE}")
            # Create default config file
            default_config = {
                "NODE_NAME": "UNKNOWN_NODE",
                "BASE_TOPIC_MQTT": "NANO_PI/"
            }
            with open(NODE_INFO_CONFIG_FILE, "w") as file:
                json.dump(default_config, file, indent=4)
            logger.info(f"Created default node info config file: {NODE_INFO_CONFIG_FILE}")
            return True
    except Exception as e:
        logger.error(f"Error loading node info config: {e}")
        return False

def save_node_info_config():
    """Save node information configuration to file"""
    global NODE_NAME, BASE_TOPIC_MQTT

    try:
        config = {
            "NODE_NAME": NODE_NAME,
            "BASE_TOPIC_MQTT": BASE_TOPIC_MQTT
        }
        with open(NODE_INFO_CONFIG_FILE, "w") as file:
            json.dump(config, file, indent=4)
        logger.info(f"Node info config saved to {NODE_INFO_CONFIG_FILE}")
        return True
    except Exception as e:
        logger.error(f"Error saving node info config: {e}")
        return False

# Get node name from environment
def get_node_name():
    """Get node name from configuration"""
    return NODE_NAME

# Get network information
def get_installed_devices(device_type):
    """Get installed devices data from JSON files"""
    try:
        device_file = ""
        if device_type == "modbus":
            device_file = "../MODBUS_SNMP/JSON/Config/installed_devices.json"
        elif device_type == "modular":
            device_file = "../MODULAR_I2C/JSON/Config/installed_devices.json"
        else:
            logger.warning(f"Unknown device type: {device_type}")
            return []

        if os.path.exists(device_file):
            with open(device_file, 'r') as f:
                devices = json.load(f)
                logger.info(f"Loaded {len(devices)} {device_type} devices from {device_file}")
                return devices
        else:
            logger.warning(f"Device file not found: {device_file}")
            return []
    except Exception as e:
        logger.error(f"Error loading {device_type} devices: {e}")
        return []

def get_network_info():
    """Get comprehensive network information for the node"""
    try:
        info = {}

        # Get active network interfaces and their IP addresses using hostname -I and ip addr
        try:
            # Use hostname -I to get main IP (usually acts like ifconfig)
            hostname_result = subprocess.check_output(
                ["hostname", "-I"],
                universal_newlines=True,
                stderr=subprocess.DEVNULL
            ).strip()

            # This might give multiple IPs separated by spaces
            all_ips = hostname_result.split()

            logger.info(f"Hostname IPs found: {all_ips}")

        except subprocess.CalledProcessError:
            all_ips = []

        # Get all interface addresses using ip addr
        try:
            addr_result = subprocess.check_output(
                ["ip", "addr", "show"],
                universal_newlines=True
            )

            # Parse interface information
            interfaces_info = {}
            current_interface = None

            for line in addr_result.split('\n'):
                line = line.strip()
                if not line:
                    continue

                # Interface header line (e.g., "2: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP>")
                if line and ':' in line and not line.startswith(' '):
                    parts = line.split(':')
                    if len(parts) >= 2:
                        current_interface = parts[1].strip()
                        interfaces_info[current_interface] = {
                            'mac': 'N/A',
                            'ip': 'N/A',
                            'state': 'DOWN'
                        }

                        # Check if interface is UP
                        if '<UP,' in line or 'UP,' in line:
                            interfaces_info[current_interface]['state'] = 'UP'

                # MAC address line
                elif current_interface and 'link/ether' in line:
                    mac_parts = line.split('link/ether')[1].split()
                    if mac_parts:
                        interfaces_info[current_interface]['mac'] = mac_parts[0].upper()

                # IP address line
                elif current_interface and line.startswith('inet '):
                    ip_parts = line.split()
                    if len(ip_parts) >= 2:
                        ip_addr = ip_parts[1].split('/')[0]
                        interfaces_info[current_interface]['ip'] = ip_addr

            logger.info(f"Interface info: {interfaces_info}")

            # Determine which interfaces to report
            # Look for ethernet-like (en*, eth*) and wireless-like (wl*, wlan, wlo*) interfaces with IPs
            ethernet_interfaces = []
            wireless_interfaces = []

            for iface, iface_data in interfaces_info.items():
                # Check if interface has an IP address (not just 'N/A')
                if iface_data['ip'] != 'N/A':
                    if iface.startswith(('en', 'eth')):
                        ethernet_interfaces.append(iface)
                    elif iface.startswith(('wl', 'wlan', 'wlo')):
                        wireless_interfaces.append(iface)

            # Set IP addresses based on detected interfaces with IPs
            if ethernet_interfaces:
                interface_name = ethernet_interfaces[0]
                info["ip_eth"] = interfaces_info[interface_name]['ip']
                info["mac_address_eth"] = interfaces_info[interface_name]['mac']
                logger.info(f"Using Ethernet interface {interface_name}: IP={info['ip_eth']}, MAC={info['mac_address_eth']}")
            else:
                info["ip_eth"] = "N/A"
                info["mac_address_eth"] = "N/A"

            if wireless_interfaces:
                interface_name = wireless_interfaces[0]
                info["ip_wlan"] = interfaces_info[interface_name]['ip']
                info["mac_address_wlan"] = interfaces_info[interface_name]['mac']
                logger.info(f"Using Wireless interface {interface_name}: IP={info['ip_wlan']}, MAC={info['mac_address_wlan']}")
            else:
                info["ip_wlan"] = "N/A"
                info["mac_address_wlan"] = "N/A"

            # Set general MAC address (prefer ethernet, fallback to wireless)
            if info["mac_address_eth"] != "N/A":
                info["mac_address"] = info["mac_address_eth"]
            elif info["mac_address_wlan"] != "N/A":
                info["mac_address"] = info["mac_address_wlan"]
            else:
                # Fallback to get_active_mac_address if no interfaces found
                info["mac_address"] = get_active_mac_address()

        except subprocess.CalledProcessError as e:
            logger.warning(f"Failed to get network addresses: {e}")
            info["ip_eth"] = "N/A"
            info["ip_wlan"] = "N/A"
            info["mac_address_eth"] = "N/A"
            info["mac_address_wlan"] = "N/A"
            info["mac_address"] = get_active_mac_address()

        return info
    except Exception as e:
        logger.error(f"Error getting network info: {e}")
        return {
            "ip_wlan": "ERROR",
            "ip_eth": "ERROR",
            "mac_address": "ERROR"
        }

# Load MQTT configuration
def load_mqtt_config():
    """Load MQTT broker configuration from file"""
    try:
        if os.path.exists(CONFIG_FILE_PATH):
            with open(CONFIG_FILE_PATH, "r") as file:
                config = json.load(file)
            logger.info("MQTT configuration loaded from file")
            return {
                "broker": config.get("broker_address", "localhost"),
                "port": config.get("broker_port", 1883),
                "username": config.get("username", ""),
                "password": config.get("password", "")
            }
        else:
            logger.warning(f"MQTT config file not found: {CONFIG_FILE_PATH}")
            return {
                "broker": "localhost",
                "port": 1883,
                "username": "",
                "password": ""
            }
    except Exception as e:
        logger.error(f"Error loading MQTT config: {e}")
        return {
            "broker": "localhost",
            "port": 1883,
            "username": "",
            "password": ""
        }

# MQTT Connection status
mqtt_connected = False

# MQTT Topics (following MODBUS_SNMP pattern)
NODE_INFO_COMMAND_TOPIC = "node_info/command"
NODE_INFO_RESPONSE_TOPIC = "node_info/response"

# MQTT Client callbacks (following MODBUS_SNMP pattern)
def on_connect(client, userdata, flags, rc):
    """MQTT connect callback"""
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        logger.info(f"NodeInfoService connected to MQTT broker")

        # Subscribe to command topic after successful connection
        client.subscribe(NODE_INFO_COMMAND_TOPIC, qos=1)
        logger.info(f"Subscribed to command topic: {NODE_INFO_COMMAND_TOPIC}")
    else:
        mqtt_connected = False
        logger.error(f"NodeInfoService failed to connect, code: {rc}")

def on_disconnect(client, userdata, rc):
    """MQTT disconnect callback"""
    global mqtt_connected
    if rc != 0:
        mqtt_connected = False
        logger.warning(f"NodeInfoService disconnected from MQTT broker - will retry")

def on_command_message(client, userdata, msg):
    """Handle incoming MQTT command messages"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()

        logger.info(f"Received command message on topic {topic}: {payload}")

        # Parse JSON payload
        try:
            command_data = json.loads(payload)
            command = command_data.get('command')

            # Handle different commands
            if command == 'get_config':
                handle_get_config(client, command_data)
            elif command == 'update_node_name':
                handle_update_node_name(client, command_data)
            elif command == 'update_base_topic':
                handle_update_base_topic(client, command_data)
            elif command == 'update_node_info':
                handle_update_node_info(client, command_data)
            elif command == 'reload_config':
                handle_reload_config(client, command_data)
            else:
                send_error_response(client, f"Unknown command: {command}")

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in command message: {e}")
            send_error_response(client, f"Invalid JSON: {e}")

    except Exception as e:
        logger.error(f"Error handling command message: {e}")

def send_success_response(client, message):
    """Send success response to node_info/response topic"""
    response = {
        "status": "success",
        "message": message,
        "timestamp": datetime.now().isoformat()
    }

    try:
        if client and mqtt_connected:
            client.publish(NODE_INFO_RESPONSE_TOPIC, json.dumps(response), qos=1)
            logger.info(f"Sent success response: {response}")
        else:
            logger.warning("Cannot send response - MQTT client not connected")
    except Exception as e:
        logger.error(f"Error sending success response: {e}")

def send_error_response(client, error_message):
    """Send error response to node_info/response topic"""
    response = {
        "status": "error",
        "message": error_message,
        "timestamp": datetime.now().isoformat()
    }

    try:
        if client and mqtt_connected:
            client.publish(NODE_INFO_RESPONSE_TOPIC, json.dumps(response), qos=1)
            logger.info(f"Sent error response: {response}")
        else:
            logger.warning("Cannot send response - MQTT client not connected")
    except Exception as e:
        logger.error(f"Error sending error response: {e}")

def handle_get_config(client, command_data):
    """Handle get_config command"""
    try:
        # Reload config to get latest
        load_node_info_config()

        config_response = {
            "status": "success",
            "data": {
                "NODE_NAME": NODE_NAME,
                "BASE_TOPIC_MQTT": BASE_TOPIC_MQTT
            },
            "timestamp": datetime.now().isoformat()
        }

        client.publish(NODE_INFO_RESPONSE_TOPIC, json.dumps(config_response), qos=1)
        logger.info(f"Sent config data: {config_response}")

    except Exception as e:
        logger.error(f"Error handling get_config command: {e}")
        send_error_response(client, f"Error getting config: {e}")

def handle_update_node_name(client, command_data):
    """Handle update_node_name command"""
    try:
        new_node_name = command_data.get('node_name')

        if not new_node_name:
            send_error_response(client, "node_name parameter is required")
            return

        # Validate node name
        if not isinstance(new_node_name, str) or len(new_node_name.strip()) == 0:
            send_error_response(client, "node_name must be a non-empty string")
            return

        # Update global variable
        global NODE_NAME
        NODE_NAME = new_node_name.strip()

        # Save to file
        if save_node_info_config():
            send_success_response(client, f"NODE_NAME updated to: {NODE_NAME}")
            logger.info(f"NODE_NAME updated to: {NODE_NAME}")
        else:
            send_error_response(client, "Failed to save configuration to file")

    except Exception as e:
        logger.error(f"Error handling update_node_name command: {e}")
        send_error_response(client, f"Error updating node name: {e}")

def handle_update_base_topic(client, command_data):
    """Handle update_base_topic command"""
    try:
        new_base_topic = command_data.get('base_topic')

        if not new_base_topic:
            send_error_response(client, "base_topic parameter is required")
            return

        # Validate base topic
        if not isinstance(new_base_topic, str):
            send_error_response(client, "base_topic must be a string")
            return

        # Ensure it ends with slash
        if not new_base_topic.endswith('/'):
            new_base_topic += '/'

        # Update global variable
        global BASE_TOPIC_MQTT
        BASE_TOPIC_MQTT = new_base_topic

        # Save to file
        if save_node_info_config():
            send_success_response(client, f"BASE_TOPIC_MQTT updated to: {BASE_TOPIC_MQTT}")
            logger.info(f"BASE_TOPIC_MQTT updated to: {BASE_TOPIC_MQTT}")
        else:
            send_error_response(client, "Failed to save configuration to file")

    except Exception as e:
        logger.error(f"Error handling update_base_topic command: {e}")
        send_error_response(client, f"Error updating base topic: {e}")

def handle_update_node_info(client, command_data):
    """Handle update_node_info command (update both NODE_NAME and BASE_TOPIC_MQTT)"""
    try:
        new_node_name = command_data.get('node_name')
        new_base_topic = command_data.get('base_topic')

        if not new_node_name and not new_base_topic:
            send_error_response(client, "At least node_name or base_topic must be provided")
            return

        # Update NODE_NAME if provided
        if new_node_name:
            if not isinstance(new_node_name, str) or len(new_node_name.strip()) == 0:
                send_error_response(client, "node_name must be a non-empty string")
                return
            global NODE_NAME
            NODE_NAME = new_node_name.strip()

        # Update BASE_TOPIC_MQTT if provided
        if new_base_topic:
            if not isinstance(new_base_topic, str):
                send_error_response(client, "base_topic must be a string")
                return
            # Ensure it ends with slash
            if not new_base_topic.endswith('/'):
                new_base_topic += '/'
            global BASE_TOPIC_MQTT
            BASE_TOPIC_MQTT = new_base_topic

        # Save to file
        if save_node_info_config():
            updates = []
            if new_node_name:
                updates.append(f"NODE_NAME: {NODE_NAME}")
            if new_base_topic:
                updates.append(f"BASE_TOPIC_MQTT: {BASE_TOPIC_MQTT}")
            send_success_response(client, f"Updated: {', '.join(updates)}")
            logger.info(f"Node info updated: {', '.join(updates)}")
        else:
            send_error_response(client, "Failed to save configuration to file")

    except Exception as e:
        logger.error(f"Error handling update_node_info command: {e}")
        send_error_response(client, f"Error updating node info: {e}")

def handle_reload_config(client, command_data):
    """Handle reload_config command"""
    try:
        if load_node_info_config():
            send_success_response(client, f"Configuration reloaded. NODE_NAME: {NODE_NAME}, BASE_TOPIC_MQTT: {BASE_TOPIC_MQTT}")
            logger.info("Configuration reloaded successfully")
        else:
            send_error_response(client, "Failed to reload configuration from file")

    except Exception as e:
        logger.error(f"Error handling reload_config command: {e}")
        send_error_response(client, f"Error reloading config: {e}")

def ensure_mqtt_connection(client, broker, port):
    """Ensure MQTT connection with exponential backoff retry"""
    global mqtt_connected

    if mqtt_connected:
        return True

    retry_count = 0
    base_delay = 5  # Base delay in seconds

    while not mqtt_connected:
        try:
            logger.info(f"Attempting to connect to MQTT broker: {broker}:{port} (attempt {retry_count + 1})")
            client.connect(broker, port, keepalive=60)
            client.loop_start()

            # Wait a moment to see if connection succeeds
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if mqtt_connected:
                    logger.info(f"Successfully connected to MQTT broker: {broker}:{port}")
                    return True
                time.sleep(0.1)

            # If we get here, connection timed out
            client.loop_stop()
            logger.warning(f"Connection attempt timed out after {timeout} seconds")

        except Exception as e:
            logger.warning(f"Failed to connect to MQTT broker {broker}:{port}: {e}")

        # Exponential backoff with max delay of 5 minutes
        retry_count += 1
        delay = min(base_delay * (2 ** min(retry_count - 1, 6)), 300)
        logger.info(f"Retrying connection in {delay} seconds...")
        time.sleep(delay)

    return False


# Main service function
def publish_node_info():
    """Publish node information every 10 seconds and handle MQTT commands"""

    # Load MQTT configuration
    mqtt_config = load_mqtt_config()
    broker = mqtt_config["broker"]
    port = mqtt_config["port"]
    username = mqtt_config["username"]
    password = mqtt_config["password"]

    # Create single MQTT client (following MODBUS_SNMP pattern)
    client_id = f"node-info-service-{get_node_name().lower()}-{uuid.uuid4().hex[:8]}"
    mqtt_client = mqtt.Client(client_id=client_id, clean_session=True)
    mqtt_client.on_connect = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message = on_command_message

    # Set authentication
    if username and password:
        mqtt_client.username_pw_set(username, password)

    # Publish topic
    publish_topic = f"{BASE_TOPIC_MQTT}{get_node_name()}"

    logger.info(f"Starting NodeInfoService for node: {get_node_name()}")
    logger.info(f"Publishing to topic: {publish_topic}")
    logger.info(f"Commands topic: {NODE_INFO_COMMAND_TOPIC}")
    logger.info(f"Responses topic: {NODE_INFO_RESPONSE_TOPIC}")
    logger.info("Publishing every 10 seconds...")

    try:
        while True:
            # Ensure MQTT connection (following MODBUS_SNMP pattern)
            if not mqtt_connected:
                logger.info(f"Attempting to connect to MQTT broker: {broker}:{port}")
                try:
                    mqtt_client.connect(broker, port, keepalive=60)
                    mqtt_client.loop_start()

                    # Wait for connection
                    timeout = 10
                    start_time = time.time()
                    while time.time() - start_time < timeout and not mqtt_connected:
                        time.sleep(0.1)

                    if not mqtt_connected:
                        logger.warning("MQTT connection timeout, retrying in 10 seconds")
                        time.sleep(10)
                        continue

                except Exception as e:
                    logger.error(f"MQTT connection failed: {e}")
                    time.sleep(10)
                    continue

            # Get current information
            node_name = get_node_name()
            network_info = get_network_info()
            timestamp = datetime.now().isoformat()

            # Load device data from installed devices files
            modbus_devices = get_installed_devices("modbus")
            modular_devices = get_installed_devices("modular")

            # Create payload with required structure
            payload = {
                "name": node_name,
                "ip_wlan": network_info.get("ip_wlan", "N/A"),
                "ip_eth": network_info.get("ip_eth", "N/A"),
                "mac_address": network_info.get("mac_address", "N/A"),  # Backward compatibility
                "mac_address_eth": network_info.get("mac_address_eth", "N/A"),
                "mac_address_wlan": network_info.get("mac_address_wlan", "N/A"),
                "data": {
                    "modbus": modbus_devices,
                    "modular": modular_devices
                },
                "time_stamp": timestamp
            }

            # Publish to MQTT
            try:
                result = mqtt_client.publish(publish_topic, json.dumps(payload), qos=1)
                if result.rc == 0:
                    logger.info(f"Published node info to {publish_topic}: {payload}")
                    logger.info(f"Published {len(modbus_devices)} Modbus devices and {len(modular_devices)} Modular devices")
                else:
                    logger.warning(f"Failed to publish to {publish_topic}, code: {result.rc}")
            except Exception as e:
                logger.error(f"Error publishing to MQTT: {e}")

            # Wait 10 seconds
            time.sleep(10)

    except KeyboardInterrupt:
        logger.info("NodeInfoService stopped by user")
    except Exception as e:
        logger.error(f"Critical error in NodeInfoService: {e}")
    finally:
        # Disconnect MQTT client
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        logger.info("NodeInfoService disconnected from MQTT broker")

# Startup functions
def print_startup_banner():
    """Print startup banner"""
    print("\n" + "="*50)
    print("=========== Node Info Service ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success banner"""
    print("\n" + "="*50)
    print("=========== Node Info Service ===========")
    print("Success To Running")
    print("")

if __name__ == "__main__":
    print_startup_banner()

    # Load node info configuration from file
    if not load_node_info_config():
        logger.error("Failed to load node info configuration, exiting...")
        exit(1)

    # Validate configuration
    node_name = get_node_name()
    if node_name == "UNKNOWN_NODE":
        logger.warning("NODE_NAME not set in configuration, using default")

    logger.info(f"Node Name (from config): {node_name}")
    logger.info(f"Base Topic (from config): {BASE_TOPIC_MQTT}")
    logger.info(f"Publishing to topic: {BASE_TOPIC_MQTT}{node_name}")

    print_success_banner()

    # Start the service
    publish_node_info()
