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
logger = logging.getLogger("AutomationLogicService")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("======= Automation Logic Control =======")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("======= Automation Logic Control =======")
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

# --- Logging Control ---
device_topic_logging_enabled = False  # Control device topic message logging

# --- Connection Status Tracking ---
crud_broker_connected = False
control_broker_connected = False

# --- Configuration File Paths ---
mqtt_config_file = '../MODULAR_I2C/JSON/Config/mqtt_config.json'
config_file = './JSON/automationLogicConfig.json'
modular_devices_file = '../MODULAR_I2C/JSON/Config/installed_devices.json'
whatsapp_config_file = './JSON/whatsapp_config.json'

# --- MQTT Topic Definitions ---
# Simplified Topics (localhost broker)
topic_command = "command_control_logic"
topic_response = "response_control_logic"

# Device and Control Topics
MODULAR_AVAILABLES_TOPIC = "MODULAR_DEVICE/AVAILABLES"
MODULAR_DATA_TOPIC = "modular_device/data"
MODULAR_CONTROL_TOPIC = "modular"
RESULT_MESSAGE_TOPIC = "result/message/logic/control"

# --- Error severity levels ---
ERROR_TYPE_CRITICAL = "CRITICAL"
ERROR_TYPE_MAJOR = "MAJOR"
ERROR_TYPE_MINOR = "MINOR"
ERROR_TYPE_WARNING = "WARNING"

# --- Error Log Helper Function ---
ERROR_LOG_BROKER = "18.143.215.113"
ERROR_LOG_PORT = 1883
# Removed old error logging - using unified ErrorLogger now

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
                        # Go back a few lines to check for RUNNING flag
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

    # Third try: Use ip command
    try:
        log_simple("Trying ip command method", "WARNING")
        ip_result = subprocess.run(['ip', 'link', 'show'], capture_output=True, text=True, timeout=5)
        if ip_result.returncode == 0:
            lines = ip_result.stdout.split('\n')
            current_interface = None
            for line in lines:
                line = line.strip()
                # Look for interface line
                if line.startswith('link/ether'):
                    parts = line.split()
                    if len(parts) >= 2 and current_interface in interfaces:
                        mac_address = parts[1]
                        if len(mac_address.split(':')) == 6:
                            log_simple(f"Found MAC from ip command {current_interface}: {mac_address}", "SUCCESS")
                            return mac_address
                elif line and not line.startswith(' ') and ':' in line:
                    current_interface = line.split(':')[0].strip()
    except Exception as e:
        log_simple(f"ip command method failed: {e}", "ERROR")

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
                    send_error_log("load_mqtt_config", f"MQTT config file is empty at {mqtt_config_file}", ERROR_TYPE_WARNING)
                    time.sleep(5)
                    continue
                # FIX: Use json.loads with content instead of json.load with file
                return json.loads(content)
        except FileNotFoundError:
            log_simple(f"MQTT config file not found. Creating default config and retrying in 5 seconds...", "WARNING")
            send_error_log("load_mqtt_config", f"MQTT config file not found at {mqtt_config_file}, creating default", ERROR_TYPE_WARNING)
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
                send_error_log("load_mqtt_config", f"Failed to create MQTT config file: {create_error}", ERROR_TYPE_MAJOR)
                time.sleep(5)
                continue
        except json.JSONDecodeError as e:
            log_simple(f"Error decoding MQTT config file: {e}. Using default configuration.", "WARNING")
            send_error_log("load_mqtt_config", f"JSON decode error in MQTT config: {e}", ERROR_TYPE_MAJOR, {"file_path": mqtt_config_file})
            return default_config
        except Exception as e:
            log_simple(f"Unexpected error loading MQTT config: {e}. Retrying in 5 seconds...", "WARNING")
            send_error_log("load_mqtt_config", f"Unexpected error loading MQTT config: {e}", ERROR_TYPE_CRITICAL)
            time.sleep(5)
            continue

def load_logic_config():
    """Load automation logic configuration"""
    global config
    try:
        with open(config_file, 'r') as file:
            loaded_data = json.load(file)

        if isinstance(loaded_data, list):
            config = loaded_data
            log_simple(f"Logic configuration loaded from {config_file}")
            log_simple(f"Loaded {len(config)} automation rules", "INFO")
        else:
            config = []
            log_simple("Invalid config format, using default structure.", "WARNING")
            send_error_log("load_logic_config", f"Invalid config format - expected list, got {type(loaded_data).__name__}", ERROR_TYPE_WARNING)

    except FileNotFoundError:
        log_simple(f"Config file not found: {config_file}. Creating default config.")
        send_error_log("load_logic_config", f"Logic config file not found at {config_file}, creating new", ERROR_TYPE_WARNING)
        config = []
        save_logic_config()
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load config (JSON decode error): {e}. Using default.", "ERROR")
        config = []
        send_error_log("load_logic_config", f"Config JSON decode error: {str(e)}", ERROR_TYPE_MAJOR, {"file_path": config_file, "line": getattr(e, 'lineno', 'unknown')})
    except Exception as e:
        log_simple(f"Failed to load config: {e}", "ERROR")
        config = []
        send_error_log("load_logic_config", f"Config load error: {e}", ERROR_TYPE_MAJOR, {"file_path": config_file})

def save_logic_config():
    """Save automation logic configuration"""
    try:
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=2)
        log_simple(f"Configuration saved to {config_file}")
        log_simple(f"Saved {len(config)} automation rules", "SUCCESS")
    except IOError as e:
        log_simple(f"Failed to save config (I/O error): {e}", "ERROR")
        send_error_log("save_logic_config", f"I/O error saving config: {e}", ERROR_TYPE_MAJOR, {"file_path": config_file})
    except Exception as e:
        log_simple(f"Failed to save config: {e}", "ERROR")
        send_error_log("save_logic_config", f"Config save error: {e}", ERROR_TYPE_MAJOR, {"file_path": config_file, "rule_count": len(config)})

def load_modular_devices():
    """Load modular devices from installed_devices.json"""
    global modular_devices
    try:
        with open(modular_devices_file, 'r') as file:
            modular_devices = json.load(file)
        log_simple(f"Modular devices loaded: {len(modular_devices)} devices")

        # Log loaded device details
        for device in modular_devices:
            device_name = device.get('profile', {}).get('name', 'Unknown')
            device_type = device.get('profile', {}).get('device_type', 'Unknown')
            log_simple(f"  ├─ {device_name} ({device_type})", "INFO")

        # Publish available devices to MODULAR_DEVICE/AVAILABLES topic
        publish_available_devices()

    except FileNotFoundError:
        log_simple(f"Modular devices file not found: {modular_devices_file}")
        modular_devices = []
        send_error_log("load_modular_devices", f"Modular devices file not found at {modular_devices_file}", ERROR_TYPE_WARNING)
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load modular devices (JSON decode error): {e}")
        modular_devices = []
        send_error_log("load_modular_devices", f"Modular devices JSON decode error: {str(e)}", ERROR_TYPE_MAJOR, {"file_path": modular_devices_file})
    except Exception as e:
        log_simple(f"Failed to load modular devices: {e}", "ERROR")
        modular_devices = []
        send_error_log("load_modular_devices", f"Modular devices load error: {e}", ERROR_TYPE_MAJOR, {"file_path": modular_devices_file})

def publish_available_devices():
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
                    'topic': device.get('profile', {}).get('topic', '')  # Fixed: get topic from profile object
                }
                available_devices.append(available_device)

            # FIXED: Add connection check for safety
            if client_crud and client_crud.is_connected():
                client_crud.publish(MODULAR_AVAILABLES_TOPIC, json.dumps(available_devices))
                log_simple(f"Published {len(available_devices)} available devices", "SUCCESS")
            else:
                log_simple("CRUD client not connected, cannot publish available devices", "WARNING")
        else:
            log_simple("Cannot publish available devices - CRUD client not connected", "WARNING")

    except Exception as e:
        log_simple(f"Error publishing available devices: {e}", "ERROR")
        send_error_log(f"Error publishing available devices: {e}", ERROR_TYPE_MINOR)

def handle_available_devices_update(client, available_devices):
    """Handle available devices update"""
    try:
        log_simple(f"Available devices update received: {len(available_devices)} devices")

        # Update subscribed topics based on available devices
        subscribe_to_device_topics(client)

    except Exception as e:
        log_simple(f"Error handling available devices update: {e}", "ERROR")
        send_error_log(f"Available devices update error: {e}", ERROR_TYPE_MINOR)

def subscribe_to_device_topics(client):
    """Subscribe to device topics used in trigger conditions"""
    try:
        if not client or not client.is_connected():
            log_simple("Client not connected, cannot subscribe to device topics", "WARNING")
            return

        # Collect all unique device topics from logic rules
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
        send_error_log(f"Device topic subscription error: {e}", ERROR_TYPE_MAJOR)

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

    else:
        crud_broker_connected = False
        log_simple(f"CRUD MQTT broker connection failed (code {rc})", "ERROR")

def on_connect_control(client, userdata, flags, rc):
    global control_broker_connected
    if rc == 0:
        control_broker_connected = True
        log_simple("Control MQTT broker connected", "SUCCESS")

        # Subscribe to available devices topic to get device topics
        client.subscribe(MODULAR_AVAILABLES_TOPIC)

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

        # Handle device data from subscribed topics
        try:
            device_message = json.loads(payload)

            # Extract device information from topic
            # Topic format: "Limbah/Modular/drycontact/1" or similar
            topic_parts = topic.split('/')
            if len(topic_parts) >= 3:
                device_type = topic_parts[-2]  # e.g., "drycontact"
                device_id = topic_parts[-1]    # e.g., "1"
                device_name = f"{device_type.capitalize()}{device_id}"  # e.g., "Drycontact1"

                # Extract data from the message
                if 'value' in device_message:
                    # The value field contains JSON string with device data
                    if isinstance(device_message['value'], str):
                        device_data = json.loads(device_message['value'])
                    else:
                        device_data = device_message['value']

                    # Process the device data for automation logic
                    process_modular_device_data({
                        'device_name': device_name,
                        'data': device_data
                    })

        except json.JSONDecodeError as e:
            log_simple(f"Failed to parse device message JSON: {e}", "ERROR")
        except Exception as e:
            log_simple(f"Error processing device message: {e}", "ERROR")
            send_error_log(f"Device message processing error: {e}", ERROR_TYPE_MINOR)

    except Exception as e:
        log_simple(f"Error handling control message: {e}", "ERROR")
        send_error_log(f"Control message handling error: {e}", ERROR_TYPE_MINOR)

# --- Message Handling ---
def on_message_crud(client, userdata, msg):
    """Handle CRUD messages"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()

        log_simple(f"CRUD Message: {topic} - {payload}")

        if topic == "command_available_device":
            if payload == "get_modular_devices":
                publish_available_devices()
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
        send_error_log(f"CRUD message handling error: {e}", ERROR_TYPE_MINOR)

# --- CRUD Operations ---
def handle_get_request(client):
    """Handle get data request - sanitize and prepare config data for UI"""
    try:
        # Sanitize and prepare config data for UI compatibility
        sanitized_config = []
        for rule in config:
            # Deep copy to avoid modifying original config
            sanitized_rule = json.loads(json.dumps(rule))

            # Ensure trigger groups have proper defaults
            if 'trigger_groups' in sanitized_rule:
                for group in sanitized_rule['trigger_groups']:
                    # Set default group name if empty
                    if not group.get('group_name', '').strip():
                        group['group_name'] = f"Group {sanitized_rule['trigger_groups'].index(group) + 1}"

                    # Ensure group has proper operator default
                    if not group.get('group_operator'):
                        group['group_operator'] = "AND"

                    # Ensure trigger conditions have proper defaults
                    if 'triggers' in group:
                        for trigger in group['triggers']:
                            # Clear any old delay settings from triggers (moved to actions)
                            trigger.pop('delay_on', None)
                            trigger.pop('delay_off', None)

                            # Ensure required fields have defaults
                            if not trigger.get('device_name'):
                                trigger['device_name'] = ""
                            if not trigger.get('trigger_type'):
                                trigger['trigger_type'] = "drycontact"
                            if trigger.get('pin_number') is None:
                                trigger['pin_number'] = 1
                            if not trigger.get('condition_operator'):
                                trigger['condition_operator'] = "is"
                            if trigger.get('target_value') is None:
                                trigger['target_value'] = True

            # Ensure actions have proper defaults and sanitize
            if 'actions' in sanitized_rule:
                for action in sanitized_rule['actions']:
                    # Ensure description is present (can be empty string)
                    if action.get('description') is None:
                        action['description'] = ""

                    # Ensure delay settings are present
                    if action.get('delay_on') is None:
                        action['delay_on'] = 0
                    if action.get('delay_off') is None:
                        action['delay_off'] = 0

                    # Ensure other required fields based on action type
                    if action.get('action_type') == 'control_relay':
                        if action.get('relay_pin') is None:
                            action['relay_pin'] = 1
                        if action.get('target_value') is None:
                            action['target_value'] = True
                        if not action.get('target_device'):
                            action['target_device'] = ""
                        if not action.get('target_mac'):
                            action['target_mac'] = ""
                        if action.get('target_address') is None:
                            action['target_address'] = 0
                        if action.get('target_bus') is None:
                            action['target_bus'] = 0

                    elif action.get('action_type') == 'send_message':
                        if action.get('message_type') is None:
                            action['message_type'] = 'whatsapp'
                        if not action.get('whatsapp_number'):
                            action['whatsapp_number'] = ""
                        if not action.get('whatsapp_name'):
                            action['whatsapp_name'] = ""
                        if not action.get('message'):
                            action['message'] = ""

            sanitized_config.append(sanitized_rule)

        response = {
            "status": "success",
            "data": sanitized_config,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        # FIXED: Add connection check for safety
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response))
            log_simple("Sanitized configuration data sent to client", "SUCCESS")
        else:
            log_simple("Client not connected, cannot send configuration data", "WARNING")
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        # FIXED: Add connection check for safety
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
            success, message = create_logic_rule(data)
        elif command == "set":
            success, message = update_logic_rule(data)
        elif command == "delete":
            success, message = delete_logic_rule(data.get('id'))
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

def create_logic_rule(rule_data):
    """Create new logic rule"""
    try:
        rule_id = str(uuid.uuid4())
        rule_name = rule_data.get('rule_name', 'Unnamed Rule')
        rule_data['id'] = rule_id
        rule_data['created_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Validate rule structure
        if 'trigger_groups' not in rule_data:
            log_simple(f"Warning: New rule '{rule_name}' has no trigger groups", "WARNING")
            send_error_log("create_logic_rule", f"Rule '{rule_name}' created without trigger groups", ERROR_TYPE_WARNING, {"rule_id": rule_id, "rule_name": rule_name})

        # Update target_mac in relay control actions with active MAC address
        action_count = 0
        if 'actions' in rule_data:
            active_mac = get_active_mac_address()
            for action in rule_data['actions']:
                if action.get('action_type') == 'control_relay' and action.get('target_mac') == '00:00:00:00:00:00':
                    action['target_mac'] = active_mac
                    log_simple(f"Updated target_mac for relay action in rule '{rule_name}' to {active_mac}", "INFO")
                action_count += 1

        config.append(rule_data)
        save_logic_config()

        # Update device topic subscriptions after rule creation
        if client_control and client_control.is_connected():
            subscribe_to_device_topics(client_control)

        trigger_count = sum(len(g.get('triggers', [])) for g in rule_data.get('trigger_groups', []))
        log_simple(f"Logic rule created: {rule_name} ({trigger_count} triggers, {action_count} actions)", "SUCCESS")
        return True, f"Logic rule '{rule_name}' created successfully"

    except Exception as e:
        log_simple(f"Error creating logic rule: {e}", "ERROR")
        send_error_log("create_logic_rule", f"Logic rule creation error: {e}", ERROR_TYPE_MAJOR, {"rule_name": rule_data.get('rule_name', 'Unknown')})
        return False, str(e)

def update_logic_rule(rule_data):
    """Update existing logic rule"""
    try:
        rule_id = rule_data.get('id')
        rule_name = rule_data.get('rule_name', 'Unknown Rule')

        if not rule_id:
            send_error_log("update_logic_rule", "Rule ID is missing in update request", ERROR_TYPE_WARNING, {"rule_name": rule_name})
            return False, "Rule ID is required for update"

        for i, rule in enumerate(config):
            if rule.get('id') == rule_id:
                rule_data['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                # Update target_mac in relay control actions with active MAC address
                action_count = 0
                if 'actions' in rule_data:
                    active_mac = get_active_mac_address()
                    for action in rule_data['actions']:
                        if action.get('action_type') == 'control_relay' and action.get('target_mac') == '00:00:00:00:00:00':
                            action['target_mac'] = active_mac
                            log_simple(f"Updated target_mac for relay action in rule '{rule_name}' to {active_mac}", "INFO")
                        action_count += 1

                config[i] = rule_data
                save_logic_config()

                # Update device topic subscriptions after rule update
                if client_control and client_control.is_connected():
                    subscribe_to_device_topics(client_control)

                trigger_count = sum(len(g.get('triggers', [])) for g in rule_data.get('trigger_groups', []))
                log_simple(f"Logic rule updated: {rule_name} ({trigger_count} triggers, {action_count} actions)", "SUCCESS")
                return True, f"Logic rule '{rule_name}' updated successfully"

        log_simple(f"Logic rule not found for update: {rule_id}", "WARNING")
        send_error_log("update_logic_rule", f"Logic rule not found for update", ERROR_TYPE_WARNING, {"rule_id": rule_id, "rule_name": rule_name})
        return False, f"Logic rule with ID {rule_id} not found"

    except Exception as e:
        log_simple(f"Error updating logic rule: {e}", "ERROR")
        send_error_log("update_logic_rule", f"Logic rule update error: {e}", ERROR_TYPE_MAJOR, {"rule_id": rule_data.get('id', 'unknown'), "rule_name": rule_data.get('rule_name', 'Unknown')})
        return False, str(e)

def delete_logic_rule(rule_id):
    """Delete logic rule"""
    try:
        if not rule_id:
            send_error_log("delete_logic_rule", "Rule ID is missing in delete request", ERROR_TYPE_WARNING)
            return False, "Rule ID is required for deletion"

        # Find the rule before deletion to get its name for logging
        deleted_rule_name = "Unknown Rule"
        for rule in config:
            if rule.get('id') == rule_id:
                deleted_rule_name = rule.get('rule_name', 'Unknown Rule')
                break

        initial_count = len(config)
        config[:] = [rule for rule in config if rule.get('id') != rule_id]

        if len(config) < initial_count:
            save_logic_config()

            # Update device topic subscriptions after rule deletion
            if client_control and client_control.is_connected():
                subscribe_to_device_topics(client_control)

            log_simple(f"Logic rule deleted: {deleted_rule_name} ({rule_id})", "SUCCESS")
            return True, "Logic rule deleted successfully"
        else:
            log_simple(f"Logic rule not found for deletion: {rule_id}", "WARNING")
            send_error_log("delete_logic_rule", f"Logic rule not found for deletion", ERROR_TYPE_WARNING, {"rule_id": rule_id})
            return False, f"Logic rule with ID {rule_id} not found"

    except Exception as e:
        log_simple(f"Error deleting logic rule: {e}", "ERROR")
        send_error_log("delete_logic_rule", f"Logic rule deletion error: {e}", ERROR_TYPE_MAJOR, {"rule_id": rule_id})
        return False, str(e)

# --- Logic Processing ---
def process_device_data(device_data):
    """Process incoming device data and evaluate triggers"""
    try:
        device_name = device_data.get('device_name', '')
        data = device_data.get('data', {})

        # Update device state
        device_states[device_name] = data

        # Evaluate all logic rules
        for rule in config:
            evaluate_rule(rule, device_name, data)

    except Exception as e:
        log_simple(f"Error processing device data: {e}", "ERROR")
        send_error_log(f"Device data processing error: {e}", ERROR_TYPE_MINOR)

def process_modular_device_data(device_data):
    """Process incoming modular device data from device topics and evaluate triggers"""
    try:
        # Extract device information from the data
        device_name = device_data.get('device_name', '')
        data = device_data.get('data', {})

        # Update device state
        device_states[device_name] = data

        # Evaluate all logic rules for this device
        for rule in config:
            evaluate_rule(rule, device_name, data)

    except Exception as e:
        log_simple(f"Error processing modular device data: {e}", "ERROR")
        send_error_log(f"Modular device data processing error: {e}", ERROR_TYPE_MINOR)

def evaluate_rule(rule, device_name, device_data):
    """Evaluate a single logic rule with auto-off functionality"""
    try:
        rule_id = rule.get('id', '')
        rule_name = rule.get('rule_name', '')
        trigger_groups = rule.get('trigger_groups', [])

        if not trigger_groups:
            return

        group_results = []

        for group in trigger_groups:
            group_result = evaluate_trigger_group(group, device_name, device_data)
            group_results.append(group_result)

        # All groups must be true for rule to trigger
        all_groups_true = all(group_results)

        # Track rule state for auto-off functionality
        rule_key = f"{rule_id}_{device_name}"
        previous_state = trigger_states.get(rule_key, False)

        if all_groups_true and not previous_state:
            # Rule just became active - execute ON actions
            log_simple(f"Logic rule triggered (ON): {rule_name}")
            execute_rule_actions(rule)
            trigger_states[rule_key] = True
        elif not all_groups_true and previous_state:
            # Rule just became inactive - execute OFF actions
            log_simple(f"Logic rule triggered (OFF): {rule_name}")
            execute_rule_actions_off(rule)
            trigger_states[rule_key] = False

    except Exception as e:
        log_simple(f"Error evaluating rule: {e}", "ERROR")
        send_error_log(f"Rule evaluation error: {e}", ERROR_TYPE_MINOR)

def evaluate_trigger_group(group, device_name, device_data):
    """Evaluate a trigger group"""
    try:
        triggers = group.get('triggers', [])
        group_operator = group.get('group_operator', 'AND')
        
        trigger_results = []
        
        for trigger in triggers:
            if trigger.get('device_name') == device_name:
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
    """Evaluate a single trigger condition"""
    try:
        trigger_type = trigger.get('trigger_type', 'drycontact')
        pin_number = trigger.get('pin_number', 1)
        condition_operator = trigger.get('condition_operator', 'is')
        target_value = trigger.get('target_value', False)

        # Get current value from device data
        if trigger_type == 'drycontact':
            field_name = f'drycontactInput{pin_number}'
            current_value = device_data.get(field_name, False)

            # Convert to boolean
            if isinstance(current_value, (int, float)):
                current_value = bool(current_value)
            elif isinstance(current_value, str):
                current_value = current_value.lower() in ['true', '1', 'on', 'high']

            # Evaluate condition
            condition_met = False
            if condition_operator == 'is':
                condition_met = (current_value == target_value)
            elif condition_operator == 'and':
                condition_met = (current_value and target_value)
            elif condition_operator == 'or':
                condition_met = (current_value or target_value)

            # Clear any existing timer for this trigger
            trigger_key = f"{trigger.get('device_name', '')}_{pin_number}_{condition_operator}"
            if trigger_key in trigger_timers:
                del trigger_timers[trigger_key]

            return condition_met

        return False

    except Exception as e:
        log_simple(f"Error evaluating trigger condition: {e}", "ERROR")
        return False

def execute_rule_actions(rule):
    """Execute actions for a triggered rule"""
    try:
        rule_id = rule.get('id', '')
        actions = rule.get('actions', [])

        for action in actions:
            action_type = action.get('action_type', '')

            if action_type == 'control_relay':
                execute_relay_control(action, rule_id)
            elif action_type == 'send_message':
                execute_send_message(action, rule)

    except Exception as e:
        log_simple(f"Error executing rule actions: {e}", "ERROR")
        send_error_log(f"Rule action execution error: {e}", ERROR_TYPE_MINOR)

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
        send_error_log(f"Rule OFF action execution error: {e}", ERROR_TYPE_MINOR)

def execute_relay_control(action, rule_id=""):
    """Execute relay control action with delay support"""
    try:
        # Check for delay settings at action level
        delay_on = action.get('delay_on', 0)
        delay_off = action.get('delay_off', 0)

        # Create unique key for this action
        action_key = f"{rule_id}_{action.get('target_device', '')}_{action.get('relay_pin', 1)}_{action.get('target_value', False)}"

        # Check if this is a delayed action (delay_on for turning ON, delay_off for turning OFF)
        is_turning_on = action.get('target_value', False)
        delay_seconds = delay_on if is_turning_on else delay_off

        if delay_seconds > 0:
            # Schedule delayed execution
            if action_key not in action_timers:
                action_timers[action_key] = {
                    'type': 'delayed_execution',
                    'start_time': datetime.now(),
                    'delay': delay_seconds,
                    'action': action,
                    'rule_id': rule_id
                }
                log_simple(f"Action delayed: {action.get('target_device', '')} pin {action.get('relay_pin', 1)} -> {is_turning_on} (delay: {delay_seconds}s)", "SUCCESS")

                # Start a timer thread to execute after delay
                def execute_after_delay():
                    try:
                        time.sleep(delay_seconds)
                        # Double-check that timer still exists and execute
                        if action_key in action_timers:
                            execute_relay_control_immediate(action_timers[action_key]['action'])
                            # Clean up timer after execution
                            if action_key in action_timers:
                                del action_timers[action_key]
                    except Exception as e:
                        log_simple(f"Error in delayed action execution: {e}", "ERROR")

                # Start timer thread
                timer_thread = threading.Thread(target=execute_after_delay, daemon=True)
                timer_thread.start()
            else:
                log_simple(f"Action already scheduled: {action_key}", "WARNING")
        else:
            # Execute immediately (no delay)
            execute_relay_control_immediate(action)

    except Exception as e:
        log_simple(f"Error executing relay control: {e}", "ERROR")
        send_error_log(f"Relay control execution error: {e}", ERROR_TYPE_MINOR)

def execute_relay_control_immediate(action):
    """Execute relay control action immediately (no delay handling)"""
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

        # FIXED: Add connection check for safety
        if client_control and client_control.is_connected():
            client_control.publish(MODULAR_CONTROL_TOPIC, json.dumps(control_payload))
            log_simple(f"Relay control sent: {target_device} pin {relay_pin} = {target_value} (using active MAC: {local_controller_mac})", "SUCCESS")
        else:
            log_simple("Control client not connected, cannot send relay control command", "WARNING")

    except Exception as e:
        log_simple(f"Error executing relay control: {e}", "ERROR")
        send_error_log(f"Relay control execution error: {e}", ERROR_TYPE_MINOR)

def execute_send_message(action, rule):
    """Execute send message action with delay support (WhatsApp only)"""
    try:
        # Check for delay settings at action level
        delay_on = action.get('delay_on', 0)
        delay_off = action.get('delay_off', 0)

        # For message actions, we'll use delay_on as the standard delay
        delay_seconds = delay_on

        # Skip delay_off for messages as they don't have on/off states like relays

        rule_id = rule.get('id', '')
        action_key = f"{rule_id}_message_{hash(str(action))}"

        if delay_seconds > 0:
            # Schedule delayed execution
            if action_key not in action_timers:
                action_timers[action_key] = {
                    'type': 'delayed_message',
                    'start_time': datetime.now(),
                    'delay': delay_seconds,
                    'action': action,
                    'rule': rule
                }
                log_simple(f"Message action delayed: {action.get('message', 'N/A')} (delay: {delay_seconds}s)", "SUCCESS")

                # Start a timer thread to execute after delay
                def execute_after_delay():
                    try:
                        time.sleep(delay_seconds)
                        # Double-check that timer still exists and execute
                        if action_key in action_timers:
                            execute_send_message_immediate(action_timers[action_key]['action'], action_timers[action_key]['rule'])
                            # Clean up timer after execution
                            if action_key in action_timers:
                                del action_timers[action_key]
                    except Exception as e:
                        log_simple(f"Error in delayed message execution: {e}", "ERROR")

                # Start timer thread
                timer_thread = threading.Thread(target=execute_after_delay, daemon=True)
                timer_thread.start()
            else:
                log_simple(f"Message action already scheduled: {action_key}", "WARNING")
        else:
            # Execute immediately (no delay)
            execute_send_message_immediate(action, rule)

    except Exception as e:
        log_simple(f"Error executing send message: {e}", "ERROR")
        send_error_log(f"Send message execution error: {e}", ERROR_TYPE_MINOR)

def execute_send_message_immediate(action, rule):
    """Execute send message action immediately (no delay handling)"""
    try:
        # Always use WhatsApp for send_message actions
        execute_whatsapp_message(action, rule)

    except Exception as e:
        log_simple(f"Error executing send message: {e}", "ERROR")
        send_error_log(f"Send message execution error: {e}", ERROR_TYPE_MINOR)

def execute_mqtt_message(action, rule):
    """Execute MQTT message action"""
    try:
        if not (client_crud and client_crud.is_connected()):
            log_simple("CRUD client not connected for MQTT message action", "WARNING")
            return

        message = action.get('message', 'Logic rule triggered')

        message_payload = {
            "rule_name": rule.get('rule_name', 'Unknown'),
            "group_rule_name": rule.get('group_rule_name', 'Unknown'),
            "message": message,
            "description": action.get('description', ''),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "rule_id": rule.get('id', '')
        }

        # Send message to result topic
        client_crud.publish(RESULT_MESSAGE_TOPIC, json.dumps(message_payload))
        log_simple(f"MQTT Message sent: {message}", "SUCCESS")

    except Exception as e:
        log_simple(f"Error executing MQTT message: {e}", "ERROR")
        send_error_log(f"MQTT message execution error: {e}", ERROR_TYPE_MINOR)

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
        message_text = action.get('message', 'Logic rule triggered')
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
            send_error_log(f"WhatsApp API error: {response.status_code}", ERROR_TYPE_MINOR)

    except ImportError:
        log_simple("Requests library not available for WhatsApp API", "ERROR")
        send_error_log("Requests library missing for WhatsApp", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Error executing WhatsApp message: {e}", "ERROR")
        send_error_log(f"WhatsApp message execution error: {e}", ERROR_TYPE_MINOR)

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
        send_error_log(f"MQTT connection failed: {e}", ERROR_TYPE_CRITICAL)
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
    load_logic_config()
    load_modular_devices()
    
    broker = mqtt_config.get('broker_address', '18.143.215.113')
    port = int(mqtt_config.get('broker_port', 1883))
    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')
    
    # Initialize unified error logger
    log_simple("Initializing unified error logger...")
    global error_logger
    error_logger = initialize_error_logger("AutomationLogicService", broker, port)
    # Assign the MQTT client for reconnection handling
    client_error_logger = error_logger.client if error_logger else None
    
    # Connect to CRUD broker
    log_simple("Connecting to CRUD MQTT broker...")
    client_crud = connect_mqtt(
        f'automation-logic-crud-{uuid.uuid4()}',
        broker, port, username, password,
        on_connect_crud, on_disconnect_crud, on_message_crud
    )
    
    # Connect to Control broker
    log_simple("Connecting to Control MQTT broker...")
    client_control = connect_mqtt(
        f'automation-logic-control-{uuid.uuid4()}',
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
    
    log_simple("Automation Logic Control service started successfully", "SUCCESS")
    
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
