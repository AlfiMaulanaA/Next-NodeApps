import json
import time
import threading
import logging
import uuid
import operator
import subprocess
import paho.mqtt.client as mqtt
from datetime import datetime, timedelta
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("AutomationValueService")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("======= Automation Value Control =======")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("======= Automation Value Control =======")
    print("Success To Running")
    print("")

def print_broker_status(crud_status=False, control_status=False):
    """Print MQTT broker connection status"""
    if crud_status:
        print("MQTT Broker CRUD is Running")
    else:
        print("MQTT Broker CRUD connection failed")

    if control_status:
        print("MQTT Broker Control is Running")
    else:
        print("MQTT Broker Control connection failed")

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

# --- Global Variables ---
config = []
modbus_devices = []
modular_devices = []
subscribed_topics = set()  # Track subscribed device topics
client_control = None  # For sending control commands to devices
client_crud = None     # For handling configuration CRUD operations
client_error_logger = None  # For unified error logger MQTT client
error_logger = None
device_states = {}  # Track current device states for trigger evaluation
trigger_states = {}  # Track trigger states for auto-off functionality
trigger_timers = {}  # Track delay timers for triggers
action_timers = {}  # Track delay timers for actions
latched_actions = {}  # Track latched relay states (device_pin -> state)

# --- Logging Control ---
device_topic_logging_enabled = False  # Control device topic message logging

# --- Connection Status Tracking ---
crud_broker_connected = False
control_broker_connected = False

# --- Configuration File Paths ---
mqtt_config_file = '../MODBUS_SNMP/JSON/Config/mqtt_config.json'
config_file = './JSON/automationValueConfig.json'
modbus_devices_file = '../MODBUS_SNMP/JSON/Config/installed_devices.json'
modular_devices_file = '../MODULAR_I2C/JSON/Config/installed_devices.json'
whatsapp_config_file = './JSON/whatsapp_config.json'

# --- MQTT Topic Definitions ---
# Simplified Topics (18.143.215.113 broker)
topic_command = "command_control_value"
topic_response = "response_control_value"

# Device and Control Topics
MODBUS_AVAILABLES_TOPIC = "MODBUS_DEVICE/AVAILABLES"
MODULAR_AVAILABLES_TOPIC = "MODULAR_DEVICE/AVAILABLES"
MODBUS_DATA_TOPIC = "modbus_device/data"
MODBUS_CONTROL_TOPIC = "modular"
RESULT_MESSAGE_TOPIC = "result/message/value/control"

# --- Error severity levels ---
ERROR_TYPE_CRITICAL = "CRITICAL"
ERROR_TYPE_MAJOR = "MAJOR"
ERROR_TYPE_MINOR = "MINOR"
ERROR_TYPE_WARNING = "WARNING"

# --- Error Log Helper Function ---
ERROR_LOG_BROKER = "18.143.215.113"
ERROR_LOG_PORT = 1883
# Using unified ErrorLogger

def get_active_mac_address():
    """Get MAC address from active network interface (prioritize eth0, then wlan0)"""
    # Priority: eth0 (Ethernet) > wlan0 (WiFi) for consistency with other automation services
    interfaces = ['eth0', 'wlan0']

    # First try: Use ifconfig (most reliable on embedded systems)
    try:
        log_simple("Checking network interfaces with ifconfig", "INFO")
        ifconfig_result = subprocess.run(['ifconfig'], capture_output=True, text=True, timeout=5)
        if ifconfig_result.returncode == 0:
            lines = ifconfig_result.stdout.split('\n')
            current_interface = None
            for line in lines:
                line = line.strip()
                # Look for interface name (line that starts with interface name)
                if line and not line.startswith(' ') and not line.startswith('\t') and ':' in line:
                    current_interface = line.split(':')[0].strip()
                # Look for ether (MAC address) in the interface block
                elif current_interface and current_interface in interfaces and 'ether ' in line:
                    mac_match = line.split('ether ')[1].split()[0].strip()
                    # Validate MAC address format
                    if len(mac_match.split(':')) == 6 and len(mac_match) == 17:
                        # Check if interface is RUNNING by looking for RUNNING flag in previous lines
                        interface_block_start = None
                        for i, check_line in enumerate(lines):
                            if check_line.strip().startswith(f'{current_interface}:'):
                                interface_block_start = i
                                break

                        if interface_block_start is not None:
                            # Check the flags line (usually the line after interface name)
                            flags_line = lines[interface_block_start].strip()
                            if 'RUNNING' in flags_line:
                                log_simple(f"Found active MAC address from {current_interface}: {mac_match}", "SUCCESS")
                                return mac_match
                            else:
                                log_simple(f"Interface {current_interface} is not RUNNING", "WARNING")
    except Exception as e:
        log_simple(f"ifconfig method failed: {e}", "ERROR")

    # Second try: Use sysfs method
    for interface in interfaces:
        try:
            # Check if interface exists and is up
            operstate_path = f'/sys/class/net/{interface}/operstate'
            address_path = f'/sys/class/net/{interface}/address'

            # Check operstate
            with open(operstate_path, 'r') as f:
                operstate = f.read().strip()

            if operstate == 'up':
                # Get MAC address
                with open(address_path, 'r') as f:
                    mac_address = f.read().strip()

                # Validate MAC address format
                if len(mac_address.split(':')) == 6 and len(mac_address) == 17:
                    log_simple(f"Found active MAC address from {interface} (sysfs): {mac_address}", "SUCCESS")
                    return mac_address
                else:
                    log_simple(f"Invalid MAC format from {interface}: {mac_address}", "WARNING")
            else:
                log_simple(f"Interface {interface} operstate is {operstate}", "WARNING")
        except (FileNotFoundError, PermissionError, Exception) as e:
            log_simple(f"Failed to get MAC from {interface} (sysfs): {e}", "WARNING")
            continue

    # Third try: Use getmac library as fallback
    try:
        import getmac
        mac_address = getmac.get_mac_address()
        if mac_address and mac_address != "00:00:00:00:00:00":
            log_simple(f"Found MAC address using getmac library: {mac_address}", "SUCCESS")
            return mac_address
    except ImportError:
        log_simple("getmac library not available", "WARNING")
    except Exception as e:
        log_simple(f"getmac library method failed: {e}", "WARNING")

    # Fallback to default if no active interface found
    log_simple("No active network interface found, using default MAC", "WARNING")
    return "00:00:00:00:00:00"

# --- Configuration Management ---
def load_mqtt_config():
    """Load MQTT config with graceful error handling and retry loop"""
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
            with open(mqtt_config_file, 'r') as file:
                content = file.read().strip()
                if not content:
                    log_simple(f"MQTT config file is empty. Retrying in 5 seconds...", "WARNING")
                    time.sleep(5)
                    continue
                return json.loads(content)
        except FileNotFoundError:
            log_simple(f"MQTT config file not found. Creating default config and retrying in 5 seconds...", "WARNING")
            try:
                # Create directory if not exists
                import os
                os.makedirs(os.path.dirname(mqtt_config_file), exist_ok=True)
                # Create default config file
                with open(mqtt_config_file, 'w') as file:
                    json.dump(default_config, file, indent=4)
                log_simple(f"Created default MQTT config file: {mqtt_config_file}", "INFO")
            except Exception as create_error:
                log_simple(f"Failed to create config file: {create_error}. Retrying in 5 seconds...", "WARNING")
                time.sleep(5)
                continue
        except json.JSONDecodeError as e:
            log_simple(f"Error decoding MQTT config file: {e}. Using default configuration.", "WARNING")
            return default_config
        except Exception as e:
            log_simple(f"Unexpected error loading MQTT config: {e}. Retrying in 5 seconds...", "WARNING")
            time.sleep(5)
            continue

def load_value_config():
    """Load automation value configuration"""
    global config
    try:
        with open(config_file, 'r') as file:
            loaded_data = json.load(file)

        if isinstance(loaded_data, list):
            config = loaded_data
            log_simple(f"Value configuration loaded from {config_file}")
        else:
            config = []
            log_simple("Invalid config format, using default structure.", "WARNING")

    except FileNotFoundError:
        log_simple(f"Config file not found: {config_file}. Creating default config.")
        config = []
        save_value_config()
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load config (JSON decode error): {e}. Using default.", "ERROR")
        config = []
        send_error_log("load_value_config", f"Config JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load config: {e}", "ERROR")
        config = []
        send_error_log("load_value_config", f"Config load error: {e}", ERROR_TYPE_MAJOR)

def save_value_config():
    """Save automation value configuration"""
    try:
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=2)
        log_simple(f"Configuration saved to {config_file}")
    except Exception as e:
        log_simple(f"Failed to save config: {e}", "ERROR")
        send_error_log("save_value_config", f"Config save error: {e}", ERROR_TYPE_MAJOR)

def load_modbus_devices():
    """Load MODBUS devices from installed_devices.json"""
    global modbus_devices
    try:
        with open(modbus_devices_file, 'r') as file:
            modbus_devices = json.load(file)
        log_simple(f"MODBUS devices loaded: {len(modbus_devices)} devices")

        # Publish available devices to MODBUS_DEVICE/AVAILABLES topic
        publish_available_devices()

    except FileNotFoundError:
        log_simple(f"MODBUS devices file not found: {modbus_devices_file}")
        modbus_devices = []
        send_error_log("load_modbus_devices", f"MODBUS devices file not found", ERROR_TYPE_WARNING)
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load MODBUS devices (JSON decode error): {e}")
        modbus_devices = []
        send_error_log("load_modbus_devices", f"MODBUS devices JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load MODBUS devices: {e}", "ERROR")
        modbus_devices = []
        send_error_log("load_modbus_devices", f"MODBUS devices load error: {e}", ERROR_TYPE_MAJOR)

def load_modular_devices():
    """Load modular devices from installed_devices.json"""
    global modular_devices
    try:
        with open(modular_devices_file, 'r') as file:
            modular_devices = json.load(file)
        log_simple(f"Modular devices loaded: {len(modular_devices)} devices")

        # Publish available devices to MODULAR_DEVICE/AVAILABLES topic
        publish_available_modular_devices()

    except FileNotFoundError:
        log_simple(f"Modular devices file not found: {modular_devices_file}")
        modular_devices = []
        send_error_log("load_modular_devices", f"Modular devices file not found", ERROR_TYPE_WARNING)
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load modular devices (JSON decode error): {e}")
        modular_devices = []
        send_error_log("load_modular_devices", f"Modular devices JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load modular devices: {e}", "ERROR")
        modular_devices = []
        send_error_log("load_modular_devices", f"Modular devices load error: {e}", ERROR_TYPE_MAJOR)

def publish_available_devices():
    """Publish available MODBUS devices to MODBUS_DEVICE/AVAILABLES topic"""
    try:
        if client_crud and client_crud.is_connected():
            available_devices = []
            for device in modbus_devices:
                available_device = {
                    'id': device.get('id', ''),
                    'name': device.get('profile', {}).get('name', ''),
                    'ip_address': device.get('protocol_setting', {}).get('ip_address', ''),
                    'port': device.get('protocol_setting', {}).get('port', 502),
                    'part_number': device.get('profile', {}).get('part_number', ''),
                    'mac': device.get('mac', '00:00:00:00:00:00'),
                    'device_type': device.get('profile', {}).get('device_type', ''),
                    'manufacturer': device.get('profile', {}).get('manufacturer', ''),
                    'topic': device.get('profile', {}).get('topic', ''),
                    'protocol': device.get('protocol_setting', {}).get('protocol', '')
                }
                available_devices.append(available_device)

            # Add connection check for safety
            if client_crud and client_crud.is_connected():
                client_crud.publish(MODBUS_AVAILABLES_TOPIC, json.dumps(available_devices))
                log_simple(f"Published {len(available_devices)} available MODBUS devices", "SUCCESS")
            else:
                log_simple("CRUD client not connected, cannot publish available devices", "WARNING")
        else:
            log_simple("Cannot publish available devices - CRUD client not connected", "WARNING")

    except Exception as e:
        log_simple(f"Error publishing available devices: {e}", "ERROR")
        send_error_log("publish_available_devices", f"Error publishing available devices: {e}", ERROR_TYPE_MINOR)

def publish_available_modular_devices():
    """Publish available modular devices to MODULAR_DEVICE/AVAILABLES topic"""
    try:
        if client_crud and client_crud.is_connected():
            available_devices = []
            for device in modular_devices:
                available_device = {
                    'id': device.get('id', ''),
                    'name': device.get('profile', {}).get('name', ''),
                    'address': device.get('protocol_setting', {}).get('address', 0),
                    'device_bus': device.get('protocol_setting', {}).get('device_bus', 0),
                    'part_number': device.get('profile', {}).get('part_number', ''),
                    'mac': device.get('mac', '00:00:00:00:00:00'),
                    'device_type': device.get('profile', {}).get('device_type', ''),
                    'manufacturer': device.get('profile', {}).get('manufacturer', ''),
                    'topic': device.get('profile', {}).get('topic', '')
                }
                available_devices.append(available_device)

            # Add connection check for safety
            if client_crud and client_crud.is_connected():
                client_crud.publish(MODULAR_AVAILABLES_TOPIC, json.dumps(available_devices))
                log_simple(f"Published {len(available_devices)} available MODULAR devices", "SUCCESS")
            else:
                log_simple("CRUD client not connected, cannot publish available modular devices", "WARNING")
        else:
            log_simple("Cannot publish available modular devices - CRUD client not connected", "WARNING")

    except Exception as e:
        log_simple(f"Error publishing available modular devices: {e}", "ERROR")
        send_error_log("publish_available_modular_devices", f"Error publishing available modular devices: {e}", ERROR_TYPE_MINOR)

def handle_available_devices_update(client, available_devices):
    """Handle available devices update"""
    try:
        log_simple(f"Available devices update received: {len(available_devices)} devices")

        # Update subscribed topics based on available devices
        subscribe_to_device_topics(client)

    except Exception as e:
        log_simple(f"Error handling available devices update: {e}", "ERROR")
        send_error_log("handle_available_devices_update", f"Available devices update error: {e}", ERROR_TYPE_MINOR)

def subscribe_to_device_topics(client):
    """Subscribe to device topics used in trigger conditions"""
    try:
        if not client or not client.is_connected():
            log_simple("Client not connected, cannot subscribe to device topics", "WARNING")
            return

        # Collect all unique device topics from value rules
        device_topics = set()

        for rule in config:
            trigger_groups = rule.get('trigger_groups', [])
            for group in trigger_groups:
                triggers = group.get('triggers', [])
                for trigger in triggers:
                    device_topic = trigger.get('device_topic')
                    if device_topic:
                        device_topics.add(device_topic)

        # Subscribe to each unique device topic
        for topic in device_topics:
            if topic not in subscribed_topics:
                client.subscribe(topic)
                subscribed_topics.add(topic)
                log_simple(f"Subscribed to device topic: {topic}", "SUCCESS")

        # Log total subscribed topics
        log_simple(f"Total device topics subscribed: {len(subscribed_topics)}", "INFO")

    except Exception as e:
        log_simple(f"Error subscribing to device topics: {e}", "ERROR")
        send_error_log("subscribe_to_device_topics", f"Device topic subscription error: {e}", ERROR_TYPE_MAJOR)

# --- MQTT Connection Functions ---
def on_connect_crud(client, userdata, flags, rc):
    global crud_broker_connected
    if rc == 0:
        crud_broker_connected = True
        log_simple("CRUD MQTT broker connected", "SUCCESS")

        # Subscribe to simplified command topic
        client.subscribe([
            (topic_command, 1),
            ("command_available_device", 1)
        ])

        # Publish available devices on connection
        publish_available_devices()
        publish_available_modular_devices()

    else:
        crud_broker_connected = False
        log_simple(f"CRUD MQTT broker connection failed (code {rc})", "ERROR")

def on_connect_control(client, userdata, flags, rc):
    global control_broker_connected
    if rc == 0:
        control_broker_connected = True
        log_simple("Control MQTT broker connected", "SUCCESS")

        # Subscribe to available devices topics to get device topics
        client.subscribe([(MODBUS_AVAILABLES_TOPIC, 0), (MODULAR_AVAILABLES_TOPIC, 0)])

        # Subscribe to already known device topics
        subscribe_to_device_topics(client)

    else:
        control_broker_connected = False
        log_simple(f"Control MQTT broker connection failed (code {rc})", "ERROR")

def on_disconnect_crud(client, userdata, rc):
    global crud_broker_connected
    crud_broker_connected = False
    if rc != 0:
        log_simple("CRUD MQTT broker disconnected unexpectedly", "WARNING")

def on_disconnect_control(client, userdata, rc):
    global control_broker_connected
    control_broker_connected = False
    if rc != 0:
        log_simple("Control MQTT broker disconnected unexpectedly", "WARNING")

def on_message_control(client, userdata, msg):
    """Handle control messages (device data from subscribed topics)"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()

        # Log device topic messages only if enabled
        if device_topic_logging_enabled:
            log_simple(f"Control Message: {topic} - {payload}")

        # Check if this is an available devices topic
        if topic in [MODBUS_AVAILABLES_TOPIC, MODULAR_AVAILABLES_TOPIC]:
            try:
                available_devices = json.loads(payload)
                handle_available_devices_update(client, available_devices)
            except json.JSONDecodeError as e:
                log_simple(f"Failed to parse available devices message JSON: {e}", "ERROR")
            return

        # Handle device data from subscribed topics
        try:
            device_message = json.loads(payload)

            # Extract device information from topic
            # Topic format can be:
            # - MODBUS: "TBGPower/T00Q56/parameters"
            # - Sensor: "limbah/ph2"
            # Use the full topic as identifier
            device_topic = topic

            # Extract numeric data from the message
            if 'value' in device_message:
                # The value field contains JSON string with device data
                if isinstance(device_message['value'], str):
                    try:
                        device_data = json.loads(device_message['value'])
                    except json.JSONDecodeError:
                        # If value is a status string (e.g., "data acquisition success"), skip processing
                        if "success" in device_message['value'].lower() or "error" in device_message['value'].lower():
                            log_simple(f"Skipping status message: {device_message['value']}", "INFO")
                            return
                        # Otherwise, treat the whole message as data
                        device_data = device_message
                else:
                    device_data = device_message['value']
            else:
                # Direct sensor data (e.g., pH sensor)
                device_data = device_message

            # Validate that device_data is a dictionary before processing
            if not isinstance(device_data, dict):
                log_simple(f"Invalid device data format for topic '{topic}': expected dict, got {type(device_data).__name__}", "WARNING")
                return

            # Process the device data for automation value logic
            process_modbus_device_data({
                'device_topic': device_topic,
                'data': device_data,
                'topic': topic
            })

        except json.JSONDecodeError as e:
            log_simple(f"Failed to parse device message JSON: {e}", "ERROR")
        except Exception as e:
            log_simple(f"Error processing device message: {e}", "ERROR")
            send_error_log("on_message_control", f"Device message processing error: {e}", ERROR_TYPE_MINOR)

    except Exception as e:
        log_simple(f"Error handling control message: {e}", "ERROR")
        send_error_log("on_message_control", f"Control message handling error: {e}", ERROR_TYPE_MINOR)

# --- Message Handling ---
def on_message_crud(client, userdata, msg):
    """Handle CRUD messages"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()

        log_simple(f"CRUD Message: {topic} - {payload}")

        if topic == "command_available_device":
            if payload == "get_modbus_devices":
                publish_available_devices()
            elif payload == "get_modular_devices":
                publish_available_modular_devices()
            return

        # Handle simplified command topic
        if topic == topic_command:
            try:
                message_data = json.loads(payload)
                command = message_data.get('command')

                if command == "get":
                    handle_get_request(client)
                elif command in ["add", "set", "delete"]:
                    handle_crud_request(client, command, message_data)
                elif command == "enable_device_logging":
                    handle_device_logging_control(client, True)
                elif command == "disable_device_logging":
                    handle_device_logging_control(client, False)
                else:
                    log_simple(f"Unknown command: {command}", "WARNING")

            except json.JSONDecodeError:
                log_simple(f"Invalid JSON in command message: {payload}", "ERROR")
            except Exception as e:
                log_simple(f"Error processing command: {e}", "ERROR")

    except Exception as e:
        log_simple(f"Error handling CRUD message: {e}", "ERROR")
        send_error_log("on_message_crud", f"CRUD message handling error: {e}", ERROR_TYPE_MINOR)

# --- CRUD Operations ---
def handle_get_request(client):
    """Handle get data request"""
    try:
        response = {
            "status": "success",
            "data": config,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        # Add connection check for safety
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response))
            log_simple("Configuration data sent to client", "SUCCESS")
        else:
            log_simple("Client not connected, cannot send configuration data", "WARNING")
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        # Add connection check for safety
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response))
        else:
            log_simple("Client not connected, cannot send error response", "WARNING")
        log_simple(f"Error sending config data: {e}", "ERROR")

def handle_device_logging_control(client, enable):
    """Handle device topic logging enable/disable commands"""
    global device_topic_logging_enabled

    try:
        device_topic_logging_enabled = enable
        status = "enabled" if enable else "disabled"
        log_simple(f"Device topic message logging {status}", "SUCCESS")

        # Send response
        response = {
            "status": "success",
            "message": f"Device topic logging {status}",
            "data": {"device_topic_logging_enabled": device_topic_logging_enabled},
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(topic_response, json.dumps(response))

    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(topic_response, json.dumps(error_response))
        log_simple(f"Error handling device logging control: {e}", "ERROR")

def handle_crud_request(client, command, message_data):
    """Handle CRUD operations"""
    try:
        data = message_data.get('data', {})

        success = False
        message = ""

        if command == "add":
            success, message = create_value_rule(data)
        elif command == "set":
            success, message = update_value_rule(data)
        elif command == "delete":
            success, message = delete_value_rule(data.get('id'))
        else:
            message = f"Unknown command: {command}"

        # Send response
        response = {
            "status": "success" if success else "error",
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(topic_response, json.dumps(response))

    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(topic_response, json.dumps(error_response))
        log_simple(f"Error handling CRUD request: {e}", "ERROR")

def create_value_rule(rule_data):
    """Create new value rule"""
    try:
        rule_data['id'] = str(uuid.uuid4())
        rule_data['created_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Update target_mac in relay control actions with active MAC address
        if 'actions' in rule_data:
            active_mac = get_active_mac_address()
            for action in rule_data['actions']:
                if action.get('action_type') == 'control_relay' and action.get('target_mac') == '00:00:00:00:00:00':
                    action['target_mac'] = active_mac
                    log_simple(f"Updated target_mac for relay action in rule '{rule_data.get('rule_name', 'Unknown')}' to {active_mac}", "INFO")

        config.append(rule_data)
        save_value_config()

        # Update device topic subscriptions after rule creation
        if client_control and client_control.is_connected():
            subscribe_to_device_topics(client_control)

        log_simple(f"Value rule created: {rule_data.get('rule_name', 'Unknown')}")
        return True, f"Value rule '{rule_data.get('rule_name', 'Unknown')}' created successfully"

    except Exception as e:
        log_simple(f"Error creating value rule: {e}", "ERROR")
        send_error_log("create_value_rule", f"Value rule creation error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def update_value_rule(rule_data):
    """Update existing value rule"""
    try:
        rule_id = rule_data.get('id')
        if not rule_id:
            return False, "Rule ID is required for update"

        for i, rule in enumerate(config):
            if rule.get('id') == rule_id:
                rule_data['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                # Update target_mac in relay control actions with active MAC address
                if 'actions' in rule_data:
                    active_mac = get_active_mac_address()
                    for action in rule_data['actions']:
                        if action.get('action_type') == 'control_relay' and action.get('target_mac') == '00:00:00:00:00:00':
                            action['target_mac'] = active_mac
                            log_simple(f"Updated target_mac for relay action in rule '{rule_data.get('rule_name', 'Unknown')}' to {active_mac}", "INFO")

                config[i] = rule_data
                save_value_config()

                # Update device topic subscriptions after rule update
                if client_control and client_control.is_connected():
                    subscribe_to_device_topics(client_control)

                log_simple(f"Value rule updated: {rule_data.get('rule_name', 'Unknown')}")
                return True, f"Value rule '{rule_data.get('rule_name', 'Unknown')}' updated successfully"

        return False, f"Value rule with ID {rule_id} not found"

    except Exception as e:
        log_simple(f"Error updating value rule: {e}", "ERROR")
        send_error_log("update_value_rule", f"Value rule update error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def delete_value_rule(rule_id):
    """Delete value rule"""
    try:
        if not rule_id:
            return False, "Rule ID is required for deletion"

        initial_count = len(config)
        config[:] = [rule for rule in config if rule.get('id') != rule_id]

        if len(config) < initial_count:
            save_value_config()

            # Update device topic subscriptions after rule deletion
            if client_control and client_control.is_connected():
                subscribe_to_device_topics(client_control)

            log_simple(f"Value rule deleted: {rule_id}")
            return True, "Value rule deleted successfully"
        else:
            return False, f"Value rule with ID {rule_id} not found"

    except Exception as e:
        log_simple(f"Error deleting value rule: {e}", "ERROR")
        send_error_log("delete_value_rule", f"Value rule deletion error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

# --- Value Processing ---
def process_device_data(device_data):
    """Process incoming device data and evaluate triggers"""
    try:
        device_name = device_data.get('device_name', '')
        data = device_data.get('data', {})

        # Update device state
        device_states[device_name] = data

        # Evaluate all value rules
        for rule in config:
            evaluate_rule(rule, device_name, data)

    except Exception as e:
        log_simple(f"Error processing device data: {e}", "ERROR")
        send_error_log("process_device_data", f"Device data processing error: {e}", ERROR_TYPE_MINOR)

def process_modbus_device_data(device_data):
    """Process incoming MODBUS device data from device topics and evaluate triggers"""
    try:
        # Extract device information from the data
        device_topic = device_data.get('device_topic', device_data.get('topic', ''))
        data = device_data.get('data', {})

        # Update device state by topic
        device_states[device_topic] = data

        # Evaluate all value rules for this device topic
        for rule in config:
            evaluate_rule(rule, device_topic, data)

    except Exception as e:
        log_simple(f"Error processing MODBUS device data: {e}", "ERROR")
        send_error_log("process_modbus_device_data", f"MODBUS device data processing error: {e}", ERROR_TYPE_MINOR)

def evaluate_rule(rule, device_topic, device_data):
    """Evaluate a single value rule with auto-off functionality"""
    try:
        rule_id = rule.get('id', '')
        rule_name = rule.get('rule_name', '')
        trigger_groups = rule.get('trigger_groups', [])

        if not trigger_groups:
            return

        # Debug: Log incoming sensor data
        log_simple(f"[DEBUG] Evaluating rule '{rule_name}' for topic '{device_topic}'", "INFO")
        log_simple(f"[DEBUG] Device data received: {json.dumps(device_data)}", "INFO")

        group_results = []

        # Debug: Check which triggers belong to this device topic
        has_matching_triggers = False
        for group in trigger_groups:
            for trigger in group.get('triggers', []):
                rule_topic = trigger.get('device_topic', '')
                if rule_topic == device_topic:
                    has_matching_triggers = True
                    break
            if has_matching_triggers:
                break

        # Debug: List all topics mentioned in this rule's triggers
        rule_device_topics = set()
        for group in trigger_groups:
            for trigger in group.get('triggers', []):
                rule_device_topics.add(trigger.get('device_topic', ''))

        log_simple(f"[DEBUG] Rule '{rule_name}' is looking for topics: {list(rule_device_topics)}", "INFO")
        log_simple(f"[DEBUG] Current topic being processed: '{device_topic}'", "INFO")

        if not has_matching_triggers:
            # Skip this rule - device topic doesn't match
            return
        else:
            log_simple(f"[DEBUG] ✅ Found matching triggers for topic '{device_topic}' - evaluating triggers", "SUCCESS")
            for group in trigger_groups:
                group_result = evaluate_trigger_group(group, device_topic, device_data)
                group_results.append(group_result)

        # All groups must be true for rule to trigger
        all_groups_true = all(group_results)

        # Track rule state for auto-off functionality
        rule_key = f"{rule_id}_{device_topic}"
        previous_state = trigger_states.get(rule_key, False)

        log_simple(f"[DEBUG] Rule '{rule_name}': Previous state={previous_state}, Current evaluation={all_groups_true}", "INFO")

        if all_groups_true and not previous_state:
            # Rule just became active - execute ON actions
            log_simple(f"[TRIGGER] Value rule ACTIVATED (ON): {rule_name} - All conditions met!", "SUCCESS")
            execute_rule_actions(rule)
            trigger_states[rule_key] = True
        elif not all_groups_true and previous_state:
            # Rule just became inactive - execute OFF actions
            log_simple(f"[TRIGGER] Value rule DEACTIVATED (OFF): {rule_name} - Conditions no longer met", "SUCCESS")
            execute_rule_actions_off(rule)
            trigger_states[rule_key] = False
        else:
            # State unchanged - log current status
            status = "ACTIVE" if all_groups_true else "INACTIVE"
            log_simple(f"[STATUS] Rule '{rule_name}': {status} - {'Conditions met' if all_groups_true else 'Conditions not met'}", "INFO")

    except Exception as e:
        log_simple(f"[ERROR] evaluate_rule: {e}", "ERROR")
        send_error_log("evaluate_rule", f"Rule evaluation error: {e}", ERROR_TYPE_MINOR)

def evaluate_trigger_group(group, device_topic, device_data):
    """Evaluate a trigger group"""
    try:
        triggers = group.get('triggers', [])
        group_operator = group.get('group_operator', 'AND')

        trigger_results = []

        for trigger in triggers:
            # Match by device_topic instead of device_name
            if trigger.get('device_topic') == device_topic:
                result = evaluate_trigger_condition(trigger, device_data)
                trigger_results.append(result)

        if not trigger_results:
            return False

        # Apply group operator
        if group_operator == 'AND':
            return all(trigger_results)
        elif group_operator == 'OR':
            return any(trigger_results)
        else:
            return False

    except Exception as e:
        log_simple(f"Error evaluating trigger group: {e}", "ERROR")
        return False

def evaluate_trigger_condition(trigger, device_data):
    """Evaluate a single trigger condition for numeric values"""
    try:
        trigger_type = trigger.get('trigger_type', 'numeric')
        device_name = trigger.get('device_name', '')
        field_name = trigger.get('field_name', 'value')
        condition_operator = trigger.get('condition_operator', 'equals')
        target_value = trigger.get('target_value', 0)

        # Validate device_data is a dictionary
        if not isinstance(device_data, dict):
            log_simple(f"[TRIGGER] Invalid data type for '{device_name}': expected dict, got {type(device_data).__name__} - Data: {device_data}", "WARNING")
            return False

        # Get current value from device data
        current_value = device_data.get(field_name, 0)

        # Debug: Log initial trigger info
        log_simple(f"[TRIGGER] Evaluating: Device '{device_name}' -> Field '{field_name}'", "INFO")
        log_simple(f"[TRIGGER] Raw values: sensor={current_value}, target={target_value}", "INFO")

        # Convert to numeric
        try:
            current_value = float(current_value)
            target_value = float(target_value)
            log_simple(f"[TRIGGER] Converted values: sensor={current_value}, target={target_value}", "INFO")
        except (ValueError, TypeError):
            log_simple(f"[TRIGGER] ERROR: Failed to convert values to numeric - sensor={current_value}, target={target_value}", "WARNING")
            return False

        # Evaluate condition with numeric operators
        condition_met = False
        condition_desc = ""

        if condition_operator == 'equals':
            condition_met = (current_value == target_value)
            condition_desc = f"{current_value} == {target_value}"
        elif condition_operator == 'greater_than':
            condition_met = (current_value > target_value)
            condition_desc = f"{current_value} > {target_value}"
        elif condition_operator == 'less_than':
            condition_met = (current_value < target_value)
            condition_desc = f"{current_value} < {target_value}"
        elif condition_operator == 'greater_equal':
            condition_met = (current_value >= target_value)
            condition_desc = f"{current_value} >= {target_value}"
        elif condition_operator == 'less_equal':
            condition_met = (current_value <= target_value)
            condition_desc = f"{current_value} <= {target_value}"
        elif condition_operator == 'not_equals':
            condition_met = (current_value != target_value)
            condition_desc = f"{current_value} != {target_value}"
        elif condition_operator == 'between':
            # For between, target_value should be a range [min, max]
            if isinstance(target_value, list) and len(target_value) == 2:
                min_val, max_val = target_value
                condition_met = (min_val <= current_value <= max_val)
                condition_desc = f"{min_val} <= {current_value} <= {max_val}"
            else:
                log_simple(f"[TRIGGER] ERROR: Invalid range for 'between' operator: {target_value}", "WARNING")
                return False

        # Log condition evaluation result
        status_icon = "✅" if condition_met else "❌"
        log_simple(f"[CONDITION] {status_icon} {condition_operator.upper()}: {condition_desc} = {condition_met}", "SUCCESS" if condition_met else "INFO")

        # No delay handling here - moved to actions
        result_icon = "✅" if condition_met else "❌"
        log_simple(f"[RESULT] {result_icon} Final trigger result: {'TRUE' if condition_met else 'FALSE'}", "SUCCESS" if condition_met else "INFO")
        return condition_met

    except Exception as e:
        log_simple(f"[ERROR] evaluate_trigger_condition: {e}", "ERROR")
        return False

def execute_rule_actions(rule):
    """Execute actions for a triggered rule with delay support"""
    try:
        actions = rule.get('actions', [])
        rule_id = rule.get('id', '')

        for i, action in enumerate(actions):
            action_key = f"{rule_id}_action_{i}"
            action_type = action.get('action_type', '')

            # Check if action has delays configured
            delay_on = action.get('delay_on', 0)
            delay_off = max(action.get('delay_off', 0), delay_on)  # Ensure delay_off >= delay_on

            if delay_on > 0:
                # Start action delay timer
                if action_key not in action_timers:
                    action_timers[action_key] = {
                        'type': 'delay_on',
                        'start_time': datetime.now(),
                        'delay': delay_on,
                        'action': action,
                        'action_type': action_type,
                        'rule': rule
                    }
                    log_simple(f"[ACTION DELAY] ⏳ Action {action_type} delayed by {delay_on}s", "INFO")
                    log_simple(f"[RESULT] ⏸️ Action ACTIVE but DELAYING execution ({delay_on}s)", "INFO")
                else:
                    timer = action_timers[action_key]
                    if timer['type'] == 'delay_on':
                        elapsed = (datetime.now() - timer['start_time']).total_seconds()
                        if elapsed >= delay_on:
                            # Execute the delayed action
                            if action_type == 'control_relay':
                                execute_relay_control(action)
                            elif action_type == 'send_message':
                                execute_send_message(action, rule)

                            # Move to delay_off state if configured
                            if delay_off > delay_on:
                                timer['type'] = 'delay_off'
                                timer['start_time'] = datetime.now()
                                timer['delay'] = delay_off - delay_on
                                log_simple(f"[ACTION DELAY] ✅ Action executed - now delaying OFF by {delay_off - delay_on}s", "SUCCESS")
                            else:
                                del action_timers[action_key]
                                log_simple(f"[ACTION DELAY] ✅ Action {action_type} executed (no OFF delay)", "SUCCESS")
                        else:
                            log_simple(f"[RESULT] ⏸️ Action ACTIVE but still waiting ({elapsed:.1f}s / {delay_on}s)", "INFO")
            elif delay_off > 0:
                # Immediate execution but with OFF delay
                if action_type == 'control_relay':
                    execute_relay_control(action)
                elif action_type == 'send_message':
                    execute_send_message(action, rule)

                # Set up OFF delay timer
                action_timers[action_key] = {
                    'type': 'delay_off',
                    'start_time': datetime.now(),
                    'delay': delay_off,
                    'action': action,
                    'action_type': action_type,
                    'rule': rule
                }
                log_simple(f"[ACTION DELAY] ✅ Action executed - delaying OFF by {delay_off}s", "SUCCESS")
            else:
                # Immediate execution without delays
                if action_type == 'control_relay':
                    execute_relay_control(action)
                elif action_type == 'send_message':
                    execute_send_message(action, rule)

    except Exception as e:
        log_simple(f"Error executing rule actions: {e}", "ERROR")
        send_error_log("execute_rule_actions", f"Rule action execution error: {e}", ERROR_TYPE_MINOR)

def execute_rule_actions_off(rule):
    """Execute OFF actions when rule condition stops being met, respecting latching behavior"""
    try:
        actions = rule.get('actions', [])

        for action in actions:
            action_type = action.get('action_type', '')
            is_latching = action.get('latching', False)  # Default to False for backward compatibility

            if action_type == 'control_relay':
                if is_latching:
                    # With latching enabled, don't turn OFF the relay when trigger condition stops
                    log_simple(f"[LATCHING] 🔒 Relay action with latching enabled - keeping relay ON", "INFO")
                else:
                    # Normal behavior - turn OFF the relay when trigger condition stops
                    off_action = action.copy()
                    off_action['target_value'] = not action.get('target_value', False)
                    execute_relay_control(off_action)
            elif action_type == 'send_message':
                # For messages, we might want to send a different message or skip
                # For now, we'll skip message actions for OFF events
                pass

    except Exception as e:
        log_simple(f"Error executing rule OFF actions: {e}", "ERROR")
        send_error_log("execute_rule_actions_off", f"Rule OFF action execution error: {e}", ERROR_TYPE_MINOR)

def execute_relay_control(action):
    """Execute relay control action"""
    try:
        if not (client_control and client_control.is_connected()):
            log_simple("Control client not connected for relay action", "WARNING")
            return

        target_device = action.get('target_device', '')
        target_address = action.get('target_address', 0)
        target_bus = action.get('target_bus', 0)
        relay_pin = action.get('relay_pin', 1)
        target_value = action.get('target_value', False)

        # Get active MAC address from network interface
        local_controller_mac = get_active_mac_address()

        # Create control payload using active network MAC
        control_payload = {
            "mac": local_controller_mac,
            "protocol_type": "Modular",
            "device": "RELAYMINI",  # Default relay type
            "function": "write",
            "value": {
                "pin": relay_pin,
                "data": 1 if target_value else 0
            },
            "address": target_address,
            "device_bus": target_bus,
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        # Add connection check for safety
        if client_control and client_control.is_connected():
            client_control.publish(MODBUS_CONTROL_TOPIC, json.dumps(control_payload))
            relay_state = "ON" if target_value else "OFF"
            log_simple(f"Relay {target_device}[{relay_pin}] set to {relay_state}", "SUCCESS")
        else:
            log_simple("Control client not connected, cannot send relay control command", "WARNING")

    except Exception as e:
        log_simple(f"[RELAY] ❌ Error executing relay control: {e}", "ERROR")
        send_error_log("execute_relay_control", f"Relay control execution error: {e}", ERROR_TYPE_MINOR)

def execute_send_message(action, rule):
    """Execute send message action (WhatsApp only)"""
    try:
        # Always use WhatsApp for send_message actions
        execute_whatsapp_message(action, rule)

    except Exception as e:
        log_simple(f"Error executing send message: {e}", "ERROR")
        send_error_log("execute_send_message", f"Send message execution error: {e}", ERROR_TYPE_MINOR)

def load_whatsapp_config():
    """Load WhatsApp configuration from file"""
    default_config = {
        "whatsapp": {
            "api_url": "https://service-chat.qontak.com/api/open/v1/broadcasts/whatsapp/direct",
            "bearer_token": "1Bs4cNxWFLUWUEd-3WSUKJOOmfeis8z4VrHU73v6_1Q",
            "default_template_id": "300d84f2-d962-4451-bc27-870fb99d18e7",
            "default_channel_id": "662f9fcb-7e2b-4c1a-8eda-9aeb4a388004",
            "language": "id",
            "timeout": 30,
            "retry_attempts": 3,
            "retry_delay": 5
        }
    }

    try:
        with open(whatsapp_config_file, 'r') as file:
            content = file.read().strip()
            if not content:
                log_simple("WhatsApp config file is empty. Using defaults.", "WARNING")
                return default_config["whatsapp"]
            config = json.load(file)
            return config.get("whatsapp", default_config["whatsapp"])
    except FileNotFoundError:
        log_simple(f"WhatsApp config file not found: {whatsapp_config_file}. Using defaults.", "WARNING")
        return default_config["whatsapp"]
    except json.JSONDecodeError as e:
        log_simple(f"Error decoding WhatsApp config: {e}. Using defaults.", "WARNING")
        return default_config["whatsapp"]
    except Exception as e:
        log_simple(f"Unexpected error loading WhatsApp config: {e}. Using defaults.", "WARNING")
        return default_config["whatsapp"]

def execute_whatsapp_message(action, rule):
    """Execute WhatsApp message action using Qontak API"""
    try:
        import requests

        # Load WhatsApp configuration
        whatsapp_config = load_whatsapp_config()

        # Get WhatsApp configuration from action with defaults
        to_number = action.get('whatsapp_number', '')
        to_name = action.get('whatsapp_name', '')
        message_template_id = action.get('message_template_id', whatsapp_config.get('default_template_id'))
        channel_integration_id = action.get('channel_integration_id', whatsapp_config.get('default_channel_id'))
        message_text = action.get('message', 'Value rule triggered')
        language_code = whatsapp_config.get('language', 'id')
        timeout = whatsapp_config.get('timeout', 30)

        if not to_number:
            log_simple("WhatsApp number not configured", "WARNING")
            return

        # Prepare WhatsApp payload
        whatsapp_payload = {
            "to_number": to_number,
            "to_name": to_name or "User",
            "message_template_id": message_template_id,
            "channel_integration_id": channel_integration_id,
            "language": {
                "code": language_code
            },
            "parameters": {
                "body": [
                    {
                        "key": "1",
                        "value": "full_name",
                        "value_text": to_name or "User"
                    },
                    {
                        "key": "2",
                        "value": "messagetext",
                        "value_text": message_text
                    }
                ]
            }
        }

        # Set headers
        headers = {
            "Authorization": f"Bearer {whatsapp_config.get('bearer_token')}",
            "Content-Type": "application/json"
        }

        # Send WhatsApp message
        response = requests.post(whatsapp_config.get('api_url'), json=whatsapp_payload, headers=headers, timeout=timeout)

        if response.status_code == 200:
            log_simple(f"WhatsApp message sent to {to_number}: {message_text}", "SUCCESS")
        else:
            log_simple(f"WhatsApp API error: {response.status_code} - {response.text}", "ERROR")
            send_error_log("execute_whatsapp_message", f"WhatsApp API error: {response.status_code}", ERROR_TYPE_MINOR)

    except ImportError:
        log_simple("Requests library not available for WhatsApp API", "ERROR")
        send_error_log("execute_whatsapp_message", "Requests library missing for WhatsApp", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Error executing WhatsApp message: {e}", "ERROR")
        send_error_log("execute_whatsapp_message", f"WhatsApp message execution error: {e}", ERROR_TYPE_MINOR)

# --- MQTT Client Setup ---
def connect_mqtt(client_id, broker, port, username="", password="", on_connect_callback=None, on_disconnect_callback=None, on_message_callback=None):
    """Create and connect MQTT client"""
    try:
        client = mqtt.Client(client_id)
        if username and password:
            client.username_pw_set(username, password)

        if on_connect_callback:
            client.on_connect = on_connect_callback
        if on_disconnect_callback:
            client.on_disconnect = on_disconnect_callback
        if on_message_callback:
            client.on_message = on_message_callback

        client.reconnect_delay_set(min_delay=1, max_delay=120)
        client.connect(broker, port, keepalive=60)
        return client

    except Exception as e:
        log_simple(f"Failed to connect to MQTT broker {broker}:{port} - {e}", "ERROR")
        send_error_log("connect_mqtt", f"MQTT connection failed: {e}", ERROR_TYPE_CRITICAL)
        return None

# --- Main Application ---
def run():
    global client_control, client_crud, client_error_logger

    print_startup_banner()

    # Test MAC address detection
    log_simple("Testing MAC address detection...")
    test_mac = get_active_mac_address()
    log_simple(f"MAC address detection test result: {test_mac}", "INFO")

    # Load configurations
    log_simple("Loading configurations...")
    mqtt_config = load_mqtt_config()
    load_value_config()
    load_modbus_devices()
    load_modular_devices()

    broker = mqtt_config.get('broker_address', '18.143.215.113')
    port = int(mqtt_config.get('broker_port', 1883))
    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')

    # Initialize unified error logger
    log_simple("Initializing unified error logger...")
    global error_logger
    error_logger = initialize_error_logger("AutomationValueService", broker, port)

    # Connect to CRUD broker
    log_simple("Connecting to CRUD MQTT broker...")
    client_crud = connect_mqtt(
        f'automation-value-crud-{uuid.uuid4()}',
        broker, port, username, password,
        on_connect_crud, on_disconnect_crud, on_message_crud
    )

    # Connect to Control broker
    log_simple("Connecting to Control MQTT broker...")
    client_control = connect_mqtt(
        f'automation-value-control-{uuid.uuid4()}',
        broker, port, username, password,
        on_connect_control, on_disconnect_control, on_message_control
    )

    # Start client loops
    if client_crud:
        client_crud.loop_start()
    if client_control:
        client_control.loop_start()

    # Wait for connections
    time.sleep(2)

    print_success_banner()
    print_broker_status(crud_broker_connected, control_broker_connected)

    log_simple("Automation Value Control service started successfully", "SUCCESS")

    try:
        while True:
            # Reconnection handling
            if client_crud and not client_crud.is_connected():
                log_simple("Attempting to reconnect CRUD client...", "WARNING")
                try:
                    client_crud.reconnect()
                except:
                    pass

            if client_control and not client_control.is_connected():
                log_simple("Attempting to reconnect Control client...", "WARNING")
                try:
                    client_control.reconnect()
                except:
                    pass

            time.sleep(5)

    except KeyboardInterrupt:
        log_simple("Service stopped by user", "WARNING")
    except Exception as e:
        log_simple(f"Critical error: {e}", "ERROR")
        send_error_log("run", f"Critical service error: {e}", ERROR_TYPE_CRITICAL)
    finally:
        log_simple("Shutting down services...")
        if client_control:
            client_control.loop_stop()
            client_control.disconnect()
        if client_crud:
            client_crud.loop_stop()
            client_crud.disconnect()
        log_simple("Application terminated", "SUCCESS")

if __name__ == '__main__':
    run()
