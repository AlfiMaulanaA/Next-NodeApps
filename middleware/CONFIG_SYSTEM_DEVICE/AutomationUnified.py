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
logger = logging.getLogger("AutomationUnifiedService")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("======= Automation Unified Control =======")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("======= Automation Unified Control =======")
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
action_states = {}  # Track action execution states for managing delays
latched_relay_states = {}  # Track latched relay states separately from current states

# --- Logging Control ---
device_topic_logging_enabled = False  # Control device topic message logging

# --- Connection Status Tracking ---
crud_broker_connected = False
control_broker_connected = False

# --- Configuration File Paths ---
mqtt_config_file = '../MODBUS_SNMP/JSON/Config/mqtt_config.json'
config_file = './JSON/automationUnifiedConfig.json'
modbus_devices_file = '../MODBUS_SNMP/JSON/Config/installed_devices.json'
modular_devices_file = '../MODULAR_I2C/JSON/Config/installed_devices.json'
whatsapp_config_file = './JSON/whatsapp_config.json'

# --- MQTT Topic Definitions ---
topic_command = "command_control_unified"
topic_response = "response_control_unified"

# Device and Control Topics
MODBUS_AVAILABLES_TOPIC = "MODBUS_DEVICE/AVAILABLES"
MODULAR_AVAILABLES_TOPIC = "MODULAR_DEVICE/AVAILABLES"
MODBUS_DATA_TOPIC = "modbus_device/data"
MODBUS_CONTROL_TOPIC = "modular"
RESULT_MESSAGE_TOPIC = "result/message/unified/control"

# --- Error severity levels ---
ERROR_TYPE_CRITICAL = "CRITICAL"
ERROR_TYPE_MAJOR = "MAJOR"
ERROR_TYPE_MINOR = "MINOR"
ERROR_TYPE_WARNING = "WARNING"

def get_active_mac_address():
    """Get MAC address from active network interface (prioritize eno2, then wlo1)"""
    interfaces = ['eno2', 'wlo1']

    # First try: Use ifconfig (most reliable on embedded systems)
    try:
        log_simple("Checking network interfaces with ifconfig", "INFO")
        ifconfig_result = subprocess.run(['ifconfig'], capture_output=True, text=True, timeout=5)
        if ifconfig_result.returncode == 0:
            lines = ifconfig_result.stdout.split('\n')
            current_interface = None
            for line in lines:
                line = line.strip()
                if line and not line.startswith(' ') and not line.startswith('\t') and ':' in line:
                    current_interface = line.split(':')[0].strip()
                elif current_interface and current_interface in interfaces and 'ether ' in line:
                    mac_match = line.split('ether ')[1].split()[0].strip()
                    if len(mac_match.split(':')) == 6 and len(mac_match) == 17:
                        interface_block_start = None
                        for i, check_line in enumerate(lines):
                            if check_line.strip().startswith(f'{current_interface}:'):
                                interface_block_start = i
                                break

                        if interface_block_start is not None:
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
            operstate_path = f'/sys/class/net/{interface}/operstate'
            address_path = f'/sys/class/net/{interface}/address'

            with open(operstate_path, 'r') as f:
                operstate = f.read().strip()

            if operstate == 'up':
                with open(address_path, 'r') as f:
                    mac_address = f.read().strip()

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

    log_simple("No active network interface found, using default MAC", "WARNING")
    return "00:00:00:00:00:00"

# --- Configuration Management ---
def load_mqtt_config():
    default_config = {
        "enable": True,
        "broker_address": "localhost",
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
                import os
                os.makedirs(os.path.dirname(mqtt_config_file), exist_ok=True)
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

def load_unified_config():
    """Load automation unified configuration"""
    global config
    try:
        with open(config_file, 'r') as file:
            loaded_data = json.load(file)

        if isinstance(loaded_data, list):
            config = loaded_data
            log_simple(f"Unified configuration loaded from {config_file}")
        else:
            config = []
            log_simple("Invalid config format, using default structure.", "WARNING")

    except FileNotFoundError:
        log_simple(f"Config file not found: {config_file}. Creating default config.")
        config = []
        save_unified_config()
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load config (JSON decode error): {e}. Using default.", "ERROR")
        config = []
        send_error_log("load_unified_config", f"Config JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load config: {e}", "ERROR")
        config = []
        send_error_log("load_unified_config", f"Config load error: {e}", ERROR_TYPE_MAJOR)

def save_unified_config():
    """Save automation unified configuration"""
    try:
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=2)
        log_simple(f"Configuration saved to {config_file}")
    except Exception as e:
        log_simple(f"Failed to save config: {e}", "ERROR")
        send_error_log("save_unified_config", f"Config save error: {e}", ERROR_TYPE_MAJOR)

def load_modbus_devices():
    """Load MODBUS devices from installed_devices.json"""
    global modbus_devices
    try:
        with open(modbus_devices_file, 'r') as file:
            modbus_devices = json.load(file)
        log_simple(f"MODBUS devices loaded: {len(modbus_devices)} devices")
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
        publish_available_devices()

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
    """Publish available MODBUS and Modular devices to respective topics"""
    try:
        if client_crud and client_crud.is_connected():
            # Publish MODBUS devices
            available_modbus = []
            for device in modbus_devices:
                modbus_device = {
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
                available_modbus.append(modbus_device)

            if client_crud and client_crud.is_connected():
                client_crud.publish(MODBUS_AVAILABLES_TOPIC, json.dumps(available_modbus))
                log_simple(f"Published {len(available_modbus)} available MODBUS devices", "SUCCESS")

            # Publish Modular devices
            available_modular = []
            for device in modular_devices:
                modular_device = {
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
                available_modular.append(modular_device)

            if client_crud and client_crud.is_connected():
                client_crud.publish(MODULAR_AVAILABLES_TOPIC, json.dumps(available_modular))
                log_simple(f"Published {len(available_modular)} available MODULAR devices", "SUCCESS")
        else:
            log_simple("Cannot publish available devices - CRUD client not connected", "WARNING")

    except Exception as e:
        log_simple(f"Error publishing available devices: {e}", "ERROR")
        send_error_log("publish_available_devices", f"Error publishing available devices: {e}", ERROR_TYPE_MINOR)

def subscribe_to_device_topics(client):
    """Subscribe to device topics used in trigger conditions"""
    try:
        if not client or not client.is_connected():
            log_simple("Client not connected, cannot subscribe to device topics", "WARNING")
            return

        device_topics = set()

        for rule in config:
            trigger_groups = rule.get('trigger_groups', [])
            for group in trigger_groups:
                triggers = group.get('triggers', [])
                for trigger in triggers:
                    device_topic = trigger.get('device_topic')
                    if device_topic:
                        device_topics.add(device_topic)

        for topic in device_topics:
            if topic not in subscribed_topics:
                client.subscribe(topic)
                subscribed_topics.add(topic)
                log_simple(f"Subscribed to device topic: {topic}", "SUCCESS")

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

        client.subscribe([
            (topic_command, 1),
            ("command_available_device", 1)
        ])

        publish_available_devices()

    else:
        crud_broker_connected = False
        log_simple(f"CRUD MQTT broker connection failed (code {rc})", "ERROR")

def on_connect_control(client, userdata, flags, rc):
    global control_broker_connected
    if rc == 0:
        control_broker_connected = True
        log_simple("Control MQTT broker connected", "SUCCESS")

        client.subscribe([(MODBUS_AVAILABLES_TOPIC, 0), (MODULAR_AVAILABLES_TOPIC, 0)])
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

        if device_topic_logging_enabled:
            log_simple(f"Control Message: {topic} - {payload}")

        # Check if this is an available devices topic
        if topic in [MODBUS_AVAILABLES_TOPIC, MODULAR_AVAILABLES_TOPIC]:
            try:
                available_devices = json.loads(payload)
                if isinstance(available_devices, list):
                    log_simple(f"Available devices update received: {len(available_devices)} devices", "INFO")
                else:
                    log_simple(f"Available devices update received (format: {type(available_devices).__name__})", "INFO")
                # For unified service, we just log the update since we don't subscribe to device topics directly
            except json.JSONDecodeError as e:
                log_simple(f"Failed to parse available devices message JSON: {e}", "ERROR")
            return

        # Handle device data from subscribed topics
        try:
            device_message = json.loads(payload)

            device_topic = topic

            # Extract numeric data from the message
            if 'value' in device_message:
                if isinstance(device_message['value'], str):
                    try:
                        device_data = json.loads(device_message['value'])
                    except json.JSONDecodeError:
                        if "success" in device_message['value'].lower() or "error" in device_message['value'].lower():
                            log_simple(f"Skipping status message: {device_message['value']}", "INFO")
                            return
                        device_data = device_message
                else:
                    device_data = device_message['value']
            else:
                device_data = device_message

            # Handle different data types for more flexibility
            if isinstance(device_data, dict):
                # Normal case - data is already a dict
                pass
            elif isinstance(device_data, (int, float, str, bool)):
                # If it's a primitive value, wrap it in a dict with 'value' key
                device_data = {'value': device_data}
                log_simple(f"Wrapped primitive value for topic '{topic}' into dict format", "INFO")
            elif isinstance(device_data, list):
                # If it's a list, wrap it in a dict with 'data' key
                device_data = {'data': device_data}
                log_simple(f"Wrapped list value for topic '{topic}' into dict format", "INFO")
            else:
                log_simple(f"Unsupported device data type for topic '{topic}': {type(device_data).__name__}. Skipping.", "WARNING")
                return

            process_unified_device_data({
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
                publish_modbus_devices()
            elif payload == "get_modular_devices":
                publish_modular_devices()
            return

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

def publish_modbus_devices():
    """Publish available MODBUS devices"""
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

def publish_modular_devices():
    """Publish available modular devices"""
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

# --- CRUD Operations ---
def handle_get_request(client):
    """Handle get data request"""
    try:
        response = {
            "status": "success",
            "data": config,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
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
            success, message = create_unified_rule(data)
        elif command == "set":
            success, message = update_unified_rule(data)
        elif command == "delete":
            success, message = delete_unified_rule(data.get('id'))
        else:
            message = f"Unknown command: {command}"

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

def create_unified_rule(rule_data):
    """Create new unified rule"""
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
        save_unified_config()

        if client_control and client_control.is_connected():
            subscribe_to_device_topics(client_control)

        log_simple(f"Unified rule created: {rule_data.get('rule_name', 'Unknown')}")
        return True, f"Unified rule '{rule_data.get('rule_name', 'Unknown')}' created successfully"

    except Exception as e:
        log_simple(f"Error creating unified rule: {e}", "ERROR")
        send_error_log("create_unified_rule", f"Unified rule creation error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def update_unified_rule(rule_data):
    """Update existing unified rule"""
    try:
        rule_id = rule_data.get('id')
        if not rule_id:
            return False, "Rule ID is required for update"

        for i, rule in enumerate(config):
            if rule.get('id') == rule_id:
                rule_data['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                if 'actions' in rule_data:
                    active_mac = get_active_mac_address()
                    for action in rule_data['actions']:
                        if action.get('action_type') == 'control_relay' and action.get('target_mac') == '00:00:00:00:00:00':
                            action['target_mac'] = active_mac
                            log_simple(f"Updated target_mac for relay action in rule '{rule_data.get('rule_name', 'Unknown')}' to {active_mac}", "INFO")

                config[i] = rule_data
                save_unified_config()

                if client_control and client_control.is_connected():
                    subscribe_to_device_topics(client_control)

                log_simple(f"Unified rule updated: {rule_data.get('rule_name', 'Unknown')}")
                return True, f"Unified rule '{rule_data.get('rule_name', 'Unknown')}' updated successfully"

        return False, f"Unified rule with ID {rule_id} not found"

    except Exception as e:
        log_simple(f"Error updating unified rule: {e}", "ERROR")
        send_error_log("update_unified_rule", f"Unified rule update error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def delete_unified_rule(rule_id):
    """Delete unified rule"""
    try:
        if not rule_id:
            return False, "Rule ID is required for deletion"

        initial_count = len(config)
        config[:] = [rule for rule in config if rule.get('id') != rule_id]

        if len(config) < initial_count:
            save_unified_config()

            if client_control and client_control.is_connected():
                subscribe_to_device_topics(client_control)

            log_simple(f"Unified rule deleted: {rule_id}")
            return True, "Unified rule deleted successfully"
        else:
            return False, f"Unified rule with ID {rule_id} not found"

    except Exception as e:
        log_simple(f"Error deleting unified rule: {e}", "ERROR")
        send_error_log("delete_unified_rule", f"Unified rule deletion error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

# --- Unified Processing ---
def process_unified_device_data(device_data):
    """Process incoming device data from any source and evaluate triggers"""
    try:
        device_topic = device_data.get('device_topic', device_data.get('topic', ''))
        data = device_data.get('data', {})

        device_states[device_topic] = data

        for rule in config:
            evaluate_unified_rule(rule, device_topic, data)

    except Exception as e:
        log_simple(f"Error processing unified device data: {e}", "ERROR")
        send_error_log("process_unified_device_data", f"Unified device data processing error: {e}", ERROR_TYPE_MINOR)

def evaluate_unified_rule(rule, device_topic, device_data):
    """Evaluate a single unified rule with mixed trigger types"""
    try:
        rule_id = rule.get('id', '')
        rule_name = rule.get('rule_name', '')
        trigger_groups = rule.get('trigger_groups', [])

        if not trigger_groups:
            return

        # Check if this rule has any triggers for the current device topic
        # Special case for schedule triggers (no device_topic needed)
        is_schedule_check = (device_topic == 'schedule_check')
        has_matching_triggers = is_schedule_check

        if not has_matching_triggers:
            for group in trigger_groups:
                triggers = group.get('triggers', [])
                for trigger in triggers:
                    rule_topic = trigger.get('device_topic', '')
                    if rule_topic == device_topic:
                        has_matching_triggers = True
                        break
                if has_matching_triggers:
                    break

        if not has_matching_triggers:
            return

        group_results = []
        for group in trigger_groups:
            group_result = evaluate_unified_trigger_group(group, device_topic, device_data)
            group_results.append(group_result)

        all_groups_true = all(group_results)

        # Use different rule keys for device-based vs schedule-based triggers
        if is_schedule_check:
            rule_key = f"{rule_id}_schedule"
        else:
            rule_key = f"{rule_id}_{device_topic}"

        previous_state = trigger_states.get(rule_key, False)

        if all_groups_true and not previous_state:
            trigger_type = "SCHEDULE" if is_schedule_check else "DEVICE"
            log_simple(f"[TRIGGER] Unified rule ACTIVATED (ON): {rule_name} [via {trigger_type}]", "SUCCESS")
            execute_unified_rule_actions(rule)
            trigger_states[rule_key] = True
        elif not all_groups_true and previous_state:
            trigger_type = "SCHEDULE" if is_schedule_check else "DEVICE"
            log_simple(f"[TRIGGER] Unified rule DEACTIVATED (OFF): {rule_name} [via {trigger_type}]", "SUCCESS")
            execute_unified_rule_actions_off(rule)
            trigger_states[rule_key] = False

    except Exception as e:
        log_simple(f"[ERROR] evaluate_unified_rule: {e}", "ERROR")
        send_error_log("evaluate_unified_rule", f"Unified rule evaluation error: {e}", ERROR_TYPE_MINOR)

def evaluate_unified_trigger_group(group, device_topic, device_data):
    """Evaluate a unified trigger group (handles both boolean and numeric triggers)"""
    try:
        triggers = group.get('triggers', [])
        group_operator = group.get('group_operator', 'AND')

        trigger_results = []

        for trigger in triggers:
            if trigger.get('device_topic') == device_topic:
                trigger_type = trigger.get('trigger_type', 'numeric')
                result = False

                if trigger_type == 'drycontact':
                    result = evaluate_boolean_trigger(trigger, device_data)
                elif trigger_type == 'numeric':
                    result = evaluate_numeric_trigger(trigger, device_data)
                elif trigger_type == 'schedule':
                    result = evaluate_schedule_trigger(trigger)
                else:
                    log_simple(f"[ERROR] Unknown trigger type: {trigger_type}", "ERROR")

                trigger_results.append(result)

        if not trigger_results:
            return False

        if group_operator == 'AND':
            return all(trigger_results)
        elif group_operator == 'OR':
            return any(trigger_results)
        else:
            return False

    except Exception as e:
        log_simple(f"Error evaluating unified trigger group: {e}", "ERROR")
        return False

def evaluate_boolean_trigger(trigger, device_data):
    """Evaluate boolean trigger condition (dry contact) - delays moved to actions"""
    try:
        trigger_type = trigger.get('trigger_type', 'drycontact')
        field_name = trigger.get('field_name')  # Use field_name from UI first
        pin_number = trigger.get('pin_number', 1)
        condition_operator = trigger.get('condition_operator', 'is')
        target_value = trigger.get('target_value', False)

        # Use field_name from UI if provided, otherwise fallback to legacy pin_number method
        if not field_name:
            field_name = f'drycontactInput{pin_number}'
            log_simple(f"[TRIGGER] Using legacy field_name '{field_name}' from pin_number {pin_number}", "WARNING")

        current_value = device_data.get(field_name, False)

        if isinstance(current_value, (int, float)):
            current_value = bool(current_value)
        elif isinstance(current_value, str):
            current_value = current_value.lower() in ['true', '1', 'on', 'high']

        condition_met = (current_value == target_value) if condition_operator == 'is' else \
                       (current_value and target_value) if condition_operator == 'and' else \
                       (current_value or target_value) if condition_operator == 'or' else False

        # Only log errors, not normal operation to reduce verbosity
        # Delays are now handled at the action level, not trigger level
        return condition_met

    except Exception as e:
        log_simple(f"[ERROR] evaluate_boolean_trigger: {e}", "ERROR")
        return False

def evaluate_numeric_trigger(trigger, device_data):
    """Evaluate numeric trigger condition (sensor/field-based) - delays moved to actions"""
    try:
        field_name = trigger.get('field_name', 'value')
        condition_operator = trigger.get('condition_operator', 'greater_than')
        target_value = trigger.get('target_value', 0)

        current_value = device_data.get(field_name, 0)

        try:
            current_value = float(current_value)
            target_value = float(target_value)
        except (ValueError, TypeError):
            log_simple(f"[TRIGGER] ERROR: Failed to convert values to numeric", "WARNING")
            return False

        condition_met = False

        if condition_operator == 'equals':
            condition_met = (current_value == target_value)
        elif condition_operator == 'greater_than':
            condition_met = (current_value > target_value)
        elif condition_operator == 'less_than':
            condition_met = (current_value < target_value)
        elif condition_operator == 'greater_equal':
            condition_met = (current_value >= target_value)
        elif condition_operator == 'less_equal':
            condition_met = (current_value <= target_value)
        elif condition_operator == 'not_equals':
            condition_met = (current_value != target_value)
        elif condition_operator == 'between':
            if isinstance(target_value, list) and len(target_value) == 2:
                min_val, max_val = target_value
                condition_met = (min_val <= current_value <= max_val)
            else:
                log_simple(f"[TRIGGER] ERROR: Invalid range for 'between'", "WARNING")
                return False

        # Delays are now handled at the action level, not trigger level
        return condition_met

    except Exception as e:
        log_simple(f"[ERROR] evaluate_numeric_trigger: {e}", "ERROR")
        return False

def evaluate_schedule_trigger(trigger):
    """Evaluate schedule-based trigger conditions (time/day based)"""
    try:
        schedule_type = trigger.get('schedule_type', 'daily')
        current_time = datetime.now()
        current_day = current_time.strftime("%a")
        current_time_str = current_time.strftime('%H:%M')

        # Check active days filter
        active_days = trigger.get('active_days', ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        if current_day not in active_days:
            return False

        # Evaluate based on schedule type
        if schedule_type == 'time_range':
            start_time = trigger.get('start_time', '00:00')
            end_time = trigger.get('end_time', '23:59')

            # Handle time range wrapping (e.g., 22:00 - 06:00 next day)
            if start_time <= end_time:
                # Same day range (e.g., 09:00 - 17:00)
                is_active = start_time <= current_time_str <= end_time
                debug_msg = f"[SCHEDULE] Time range {start_time}-{end_time}, current {current_time_str} = {'ACTIVE' if is_active else 'INACTIVE'}"
                log_simple(debug_msg, "INFO" if is_active else "WARNING")
                return is_active
            else:
                # Overnight range (e.g., 22:00 - 06:00)
                is_active = current_time_str >= start_time or current_time_str <= end_time
                debug_msg = f"[SCHEDULE] Overnight range {start_time}-{end_time}, current {current_time_str} = {'ACTIVE' if is_active else 'INACTIVE'}"
                log_simple(debug_msg, "INFO" if is_active else "WARNING")
                return is_active

        elif schedule_type == 'specific_time':
            specific_time = trigger.get('specific_time', '00:00')
            # Check if current time matches or is very close (within 1 minute)
            time_diff = abs((current_time - datetime.strptime(specific_time, '%H:%M').replace(
                year=current_time.year, month=current_time.month, day=current_time.day
            )).total_seconds())
            is_active = time_diff <= 60  # Within 1 minute

            debug_msg = f"[SCHEDULE] Specific time {specific_time}, current {current_time_str}, diff {time_diff:.1f}s = {'ACTIVE' if is_active else 'INACTIVE'}"
            log_simple(debug_msg, "INFO" if is_active else "WARNING")
            return is_active

        elif schedule_type == 'daily':
            # Default behavior - always true when active days match
            log_simple(f"[SCHEDULE] Daily schedule active on {current_day}", "SUCCESS")
            return True

        log_simple(f"[SCHEDULE] Unknown schedule type: {schedule_type}", "ERROR")
        return False

    except Exception as e:
        log_simple(f"[ERROR] evaluate_schedule_trigger: {e}", "ERROR")
        return False

def execute_unified_rule_actions(rule):
    """Execute actions for a triggered unified rule - with action-level delays"""
    try:
        actions = rule.get('actions', [])
        rule_id = rule.get('id', '')

        for action in actions:
            action_type = action.get('action_type', '')
            delay_on = action.get('delay_on', 0)
            action_key = f"{rule_id}_{action_type}_{action.get('target_device', '')}_{action.get('relay_pin', '')}"

            if delay_on > 0:
                # Check if delay is already active for this action
                if action_key in action_timers and action_timers[action_key]['type'] == 'delay_on':
                    timer = action_timers[action_key]
                    elapsed = (datetime.now() - timer['start_time']).total_seconds()
                    if elapsed >= delay_on:
                        # Delay completed, execute action
                        del action_timers[action_key]
                        execute_single_action(action, rule)
                        log_simple(f"[ACTION DELAY] ✅ {action_type} delay ON completed after {delay_on}s", "SUCCESS")
                    else:
                        log_simple(f"[ACTION DELAY] ⏳ {action_type} delay ON active: {elapsed:.1f}/{delay_on}s", "INFO")
                else:
                    # Start new delay timer
                    action_timers[action_key] = {
                        'type': 'delay_on',
                        'start_time': datetime.now(),
                        'delay': delay_on,
                        'action': action,
                        'rule': rule
                    }
                    log_simple(f"[ACTION DELAY] ⏳ {action_type} delay ON started: {delay_on}s", "INFO")
            else:
                # No delay, execute immediately
                execute_single_action(action, rule)

    except Exception as e:
        log_simple(f"Error executing unified rule actions: {e}", "ERROR")
        send_error_log("execute_unified_rule_actions", f"Unified rule action execution error: {e}", ERROR_TYPE_MINOR)

def execute_unified_rule_actions_off(rule):
    """Execute OFF actions when unified rule condition stops being met"""
    try:
        actions = rule.get('actions', [])

        for action in actions:
            action_type = action.get('action_type', '')

            if action_type == 'control_relay':
                off_action = action.copy()
                off_action['target_value'] = not action.get('target_value', False)
                execute_relay_control(off_action)
            elif action_type == 'send_message':
                pass  # Skip message actions for OFF events

    except Exception as e:
        log_simple(f"Error executing unified rule OFF actions: {e}", "ERROR")
        send_error_log("execute_unified_rule_actions_off", f"Unified rule OFF action execution error: {e}", ERROR_TYPE_MINOR)

def execute_relay_control(action):
    """Execute relay control action with latching support"""
    try:
        if not (client_control and client_control.is_connected()):
            log_simple("Control client not connected for relay action", "WARNING")
            return

        target_device = action.get('target_device', '')
        target_address = action.get('target_address', 0)
        target_bus = action.get('target_bus', 0)
        relay_pin = action.get('relay_pin', 1)
        target_value = action.get('target_value', False)
        is_latching = action.get('latching', False)

        # Create unique key for latched relay state
        latch_key = f"{target_device}_{target_address}_{target_bus}_{relay_pin}"

        local_controller_mac = get_active_mac_address()

        # Determine the actual value to send
        if is_latching:
            # For latching mode, track state separately from the current trigger state
            if latch_key not in latched_relay_states:
                latched_relay_states[latch_key] = False

            # Toggle latched state when target_value is True (activation signal)
            if target_value:
                latched_relay_states[latch_key] = not latched_relay_states[latch_key]
                log_simple(f"[LATCHING] Toggled {latch_key} to {latched_relay_states[latch_key]}", "INFO")

            actual_value = latched_relay_states[latch_key]
        else:
            # Normal mode - use target_value directly
            actual_value = target_value

        control_payload = {
            "mac": local_controller_mac,
            "protocol_type": "Modular",
            "device": "RELAYMINI",
            "function": "write",
            "value": {
                "pin": relay_pin,
                "data": 1 if actual_value else 0
            },
            "address": target_address,
            "device_bus": target_bus,
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client_control and client_control.is_connected():
            client_control.publish(MODBUS_CONTROL_TOPIC, json.dumps(control_payload))
            if is_latching:
                log_simple(f"Latched relay control sent: {target_device} pin {relay_pin} = {actual_value} (current state: {latched_relay_states[latch_key]})", "SUCCESS")
            else:
                log_simple(f"Relay control sent: {target_device} pin {relay_pin} = {actual_value}", "SUCCESS")
        else:
            log_simple("Control client not connected, cannot send relay control command", "WARNING")

    except Exception as e:
        log_simple(f"Error executing relay control: {e}", "ERROR")
        send_error_log("execute_relay_control", f"Relay control execution error: {e}", ERROR_TYPE_MINOR)

def execute_send_message(action, rule):
    """Execute send message action (WhatsApp only)"""
    try:
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

def execute_single_action(action, rule):
    """Execute a single action without delays"""
    try:
        action_type = action.get('action_type', '')

        if action_type == 'control_relay':
            execute_relay_control(action)
        elif action_type == 'send_message':
            execute_send_message(action, rule)

    except Exception as e:
        log_simple(f"Error executing single action: {e}", "ERROR")
        send_error_log("execute_single_action", f"Single action execution error: {e}", ERROR_TYPE_MINOR)

def process_action_timers():
    """Process active action timers and execute delayed actions"""
    global action_timers

    try:
        # Create a copy to avoid modification during iteration
        current_timers = action_timers.copy()

        for action_key, timer_info in current_timers.items():
            timer_type = timer_info.get('type')
            start_time = timer_info.get('start_time')
            delay = timer_info.get('delay')
            action = timer_info.get('action')
            rule = timer_info.get('rule')

            elapsed = (datetime.now() - start_time).total_seconds()

            if timer_type == 'delay_on' and elapsed >= delay:
                # Delay completed, execute action
                del action_timers[action_key]
                execute_single_action(action, rule)
                log_simple(f"[ACTION DELAY] ✅ Action {action_key} delay ON completed after {delay}s", "SUCCESS")

            elif timer_type == 'delay_off' and elapsed >= delay:
                # Execute OFF action
                del action_timers[action_key]
                if action.get('action_type') == 'control_relay':
                    off_action = action.copy()
                    off_action['target_value'] = not action.get('target_value', False)
                    execute_relay_control(off_action)
                log_simple(f"[ACTION DELAY] ✅ Action {action_key} delay OFF completed after {delay}s", "SUCCESS")

    except Exception as e:
        log_simple(f"Error processing action timers: {e}", "ERROR")
        send_error_log("process_action_timers", f"Action timer processing error: {e}", ERROR_TYPE_MINOR)

def execute_whatsapp_message(action, rule):
    """Execute WhatsApp message action using Qontak API"""
    try:
        import requests

        whatsapp_config = load_whatsapp_config()

        to_number = action.get('whatsapp_number', '')
        to_name = action.get('whatsapp_name', '')
        message_template_id = action.get('message_template_id', whatsapp_config.get('default_template_id'))
        channel_integration_id = action.get('channel_integration_id', whatsapp_config.get('default_channel_id'))
        message_text = action.get('message', 'Unified rule triggered')
        language_code = whatsapp_config.get('language', 'id')
        timeout = whatsapp_config.get('timeout', 30)

        if not to_number:
            log_simple("WhatsApp number not configured", "WARNING")
            return

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

        headers = {
            "Authorization": f"Bearer {whatsapp_config.get('bearer_token')}",
            "Content-Type": "application/json"
        }

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

# --- Schedule Management ---
def check_schedule_triggers(client_control):
    """Periodic background check for schedule-based triggers"""
    try:
        schedule_triggers_active = False

        for rule in config:
            rule_id = rule.get('id', '')
            trigger_groups = rule.get('trigger_groups', [])

            # Check if rule has any schedule triggers
            has_schedule_triggers = False
            for group in trigger_groups:
                for trigger in group.get('triggers', []):
                    if trigger.get('trigger_type') == 'schedule':
                        has_schedule_triggers = True
                        break
                if has_schedule_triggers:
                    break

            if has_schedule_triggers:
                # Evaluate rule with current time (no device data needed for schedule)
                evaluate_unified_rule(rule, 'schedule_check', None)
                schedule_triggers_active = True

        if schedule_triggers_active:
            log_simple("[SCHEDULE] Performed periodic schedule trigger evaluation", "INFO")

    except Exception as e:
        log_simple(f"Error in periodic schedule check: {e}", "ERROR")

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

    log_simple("Testing MAC address detection...")
    test_mac = get_active_mac_address()
    log_simple(f"MAC address detection test result: {test_mac}", "INFO")

    # Load configurations
    log_simple("Loading configurations...")
    mqtt_config = load_mqtt_config()
    load_unified_config()
    load_modbus_devices()
    load_modular_devices()

    broker = mqtt_config.get('broker_address', 'localhost')
    port = int(mqtt_config.get('broker_port', 1883))
    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')

    # Initialize unified error logger
    log_simple("Initializing unified error logger...")
    global error_logger
    error_logger = initialize_error_logger("AutomationUnifiedService", broker, port)

    # Connect to CRUD broker
    log_simple("Connecting to CRUD MQTT broker...")
    client_crud = connect_mqtt(
        f'automation-unified-crud-{uuid.uuid4()}',
        broker, port, username, password,
        on_connect_crud, on_disconnect_crud, on_message_crud
    )

    # Connect to Control broker
    log_simple("Connecting to Control MQTT broker...")
    client_control = connect_mqtt(
        f'automation-unified-control-{uuid.uuid4()}',
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

    log_simple("Automation Unified Control service started successfully", "SUCCESS")

    try:
        while True:
            # Run schedule-based checks at regular intervals
            check_schedule_triggers(client_control)

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

            if client_error_logger and not client_error_logger.is_connected():
                log_simple("Attempting to reconnect Error Logger client...", "WARNING")
                try:
                    client_error_logger.reconnect()
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
        if client_error_logger:
            client_error_logger.loop_stop()
            client_error_logger.disconnect()
        log_simple("Application terminated", "SUCCESS")

if __name__ == '__main__':
    run()