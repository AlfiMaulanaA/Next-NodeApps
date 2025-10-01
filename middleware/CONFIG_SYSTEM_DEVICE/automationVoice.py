import json
import time
import threading
import logging
import uuid
import subprocess
import paho.mqtt.client as mqtt
from datetime import datetime
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("AutomationVoiceService")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("======= Automation Voice Control =======")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("======= Automation Voice Control =======")
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
client_control = None  # For sending control commands to devices
client_crud = None     # For handling configuration CRUD operations
error_logger = None

# --- Connection Status Tracking ---
crud_broker_connected = False
control_broker_connected = False

# --- Configuration File Paths ---
mqtt_config_file = '../MODBUS_SNMP/JSON/Config/mqtt_config.json'
config_file = './JSON/automationVoiceConfig.json'
modular_devices_file = '../MODULAR_I2C/JSON/Config/installed_devices.json'

# --- MQTT Topic Definitions ---
# Simplified Topics (localhost broker)
topic_command = "command_control_voice"
topic_response = "response_control_voice"

# Device and Control Topics
MODULAR_AVAILABLES_TOPIC = "MODULAR_DEVICE/AVAILABLES"
MODULAR_CONTROL_TOPIC = "modular"
VOICE_CONTROL_DATA_TOPIC = "voice_control/data"
MODULAR_VALUE_DATA_TOPIC = "modular_value/data"

# --- Error severity levels ---
ERROR_TYPE_CRITICAL = "CRITICAL"
ERROR_TYPE_MAJOR = "MAJOR"
ERROR_TYPE_MINOR = "MINOR"
ERROR_TYPE_WARNING = "WARNING"

# --- MAC Address Detection ---
def get_active_mac_address():
    """Get MAC address from active network interface (prioritize wlan0, then eth0)"""
    # Priority: wlan0 (WiFi) > eth0 (Ethernet)
    interfaces = ['wlan0', 'eth0']

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

    # Fallback to default if no active interface found
    log_simple("No active network interface found, using default MAC", "WARNING")
    return "00:00:00:00:00:00"

# --- Configuration Management ---
def load_mqtt_config():
    """Load MQTT config with graceful error handling and retry loop"""
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

def load_voice_config():
    """Load automation voice configuration"""
    global config
    try:
        with open(config_file, 'r') as file:
            loaded_data = json.load(file)

        if isinstance(loaded_data, list):
            config = loaded_data
            log_simple(f"Voice configuration loaded from {config_file}")
        else:
            config = []
            log_simple("Invalid config format, using default structure.", "WARNING")

    except FileNotFoundError:
        log_simple(f"Config file not found: {config_file}. Creating default config.")
        config = []
        save_voice_config()
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load config (JSON decode error): {e}. Using default.", "ERROR")
        config = []
        send_error_log("load_voice_config", f"Config JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load config: {e}", "ERROR")
        config = []
        send_error_log("load_voice_config", f"Config load error: {e}", ERROR_TYPE_MAJOR)

def save_voice_config():
    """Save automation voice configuration"""
    try:
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=2)
        log_simple(f"Configuration saved to {config_file}")
    except Exception as e:
        log_simple(f"Failed to save config: {e}", "ERROR")
        send_error_log("save_voice_config", f"Config save error: {e}", ERROR_TYPE_MAJOR)

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

# --- MQTT Connection Functions ---
def on_connect_crud(client, userdata, flags, rc):
    global crud_broker_connected
    if rc == 0:
        crud_broker_connected = True
        log_simple("CRUD MQTT broker connected", "SUCCESS")

        # Subscribe to simplified command topic
        client.subscribe(topic_command, 1)

        # Publish available devices on connection
        publish_available_modular_devices()

    else:
        crud_broker_connected = False
        log_simple(f"CRUD MQTT broker connection failed (code {rc})", "ERROR")

def on_connect_control(client, userdata, flags, rc):
    global control_broker_connected
    if rc == 0:
        control_broker_connected = True
        log_simple("Control MQTT broker connected", "SUCCESS")

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

# --- Message Handling ---
def on_message_crud(client, userdata, msg):
    """Handle CRUD messages"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()

        log_simple(f"CRUD Message: {topic} - {payload}")

        # Handle simplified command topic
        if topic == topic_command:
            try:
                message_data = json.loads(payload)
                action = message_data.get('action')

                if action == "get":
                    handle_get_request(client)
                elif action in ["add", "set", "delete"]:
                    handle_crud_request(client, action, message_data)
                else:
                    log_simple(f"Unknown action: {action}", "WARNING")

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
        # Publish voice control config data
        if client and client.is_connected():
            client.publish(VOICE_CONTROL_DATA_TOPIC, json.dumps(config))
            log_simple("Voice control data published", "SUCCESS")

        # Publish modular devices data
        if client and client.is_connected():
            available_devices = []
            for device in modular_devices:
                available_device = {
                    'profile': {
                        'name': device.get('profile', {}).get('name', ''),
                        'device_bus': device.get('protocol_setting', {}).get('device_bus', 0),
                        'address': device.get('protocol_setting', {}).get('address', 0)
                    },
                    'protocol_setting': {
                        'address': device.get('protocol_setting', {}).get('address', 0),
                        'device_bus': device.get('protocol_setting', {}).get('device_bus', 0)
                    },
                    'data': device.get('data', [])
                }
                available_devices.append(available_device)

            client.publish(MODULAR_VALUE_DATA_TOPIC, json.dumps(available_devices))
            log_simple("Modular devices data published", "SUCCESS")

    except Exception as e:
        log_simple(f"Error sending config data: {e}", "ERROR")

def handle_crud_request(client, action, message_data):
    """Handle CRUD operations"""
    try:
        data = message_data.get('data', {})

        success = False
        message = ""

        if action == "add":
            success, message = create_voice_control(data)
        elif action == "set":
            success, message = update_voice_control(data)
        elif action == "delete":
            # Support both 'uuid', 'id', and direct data object for ID
            delete_id = data.get('uuid') or data.get('id') or data.get('data', {}).get('id')
            success, message = delete_voice_control(delete_id)
        else:
            message = f"Unknown action: {action}"

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

def create_voice_control(voice_data):
    """Create new voice control"""
    try:
        # Generate ID if not provided
        if not voice_data.get('id'):
            voice_data['id'] = str(uuid.uuid4())

        # Get active MAC address
        active_mac = get_active_mac_address()

        # Find device from modular_devices to get part_number and mac
        device_name = voice_data.get('device_name', '')
        device_info = None
        device_part_number = voice_data.get('part_number', 'RELAYMINI')  # Use from frontend or default
        device_mac = voice_data.get('mac', active_mac)  # Use from frontend or active MAC

        for device in modular_devices:
            if device.get('profile', {}).get('name', '') == device_name:
                device_info = device
                # Only override if not provided from frontend
                if not voice_data.get('part_number'):
                    device_part_number = device.get('profile', {}).get('part_number', 'RELAYMINI')
                if not voice_data.get('mac'):
                    device_mac = device.get('mac', active_mac)
                break

        # Create voice control entry with flat structure
        voice_entry = {
            'id': voice_data.get('id'),
            'description': voice_data.get('description', ''),
            'rule_name': voice_data.get('rule_name', ''),
            'device_name': device_name,
            'part_number': device_part_number,
            'pin': voice_data.get('pin', 1),
            'address': voice_data.get('address', 0),
            'device_bus': voice_data.get('device_bus', 0),
            'mac': device_mac,
            'created_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'updated_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        config.append(voice_entry)
        save_voice_config()

        log_simple(f"Voice control created: {voice_entry.get('rule_name', 'Unknown')} on {device_name} ({device_part_number})")
        return True, f"Voice control '{voice_entry.get('rule_name', 'Unknown')}' created successfully"

    except Exception as e:
        log_simple(f"Error creating voice control: {e}", "ERROR")
        send_error_log("create_voice_control", f"Voice control creation error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def update_voice_control(voice_data):
    """Update existing voice control"""
    try:
        # Get the ID from either uuid, id, or data.id
        voice_id = voice_data.get('uuid') or voice_data.get('id') or voice_data.get('data', {}).get('id')

        if not voice_id:
            return False, "Voice control ID is required for update"

        # Find the voice control entry to update
        for i, voice in enumerate(config):
            if voice.get('uuid') == voice_id or voice.get('id') == voice_id:
                # Get data from voice_data directly or from voice_data.data
                update_data = voice_data.get('data', voice_data)

                # Find device from modular_devices to get part_number and mac
                device_name = update_data.get('device_name', voice.get('device_name', ''))
                device_part_number = voice.get('part_number', 'RELAYMINI')  # Keep existing if not found
                device_mac = voice.get('mac', '00:00:00:00:00:00')

                for device in modular_devices:
                    if device.get('profile', {}).get('name', '') == device_name:
                        device_part_number = device.get('profile', {}).get('part_number', 'RELAYMINI')
                        device_mac = device.get('mac', device_mac)
                        break

                # Update voice control entry with consistent field naming
                config[i].update({
                    'description': update_data.get('description', voice.get('description', '')),
                    'rule_name': update_data.get('rule_name', voice.get('rule_name', voice.get('object_name', ''))),  # Support both rule_name and object_name for backward compatibility
                    'device_name': device_name,
                    'part_number': device_part_number,  # Dynamic from device
                    'pin': update_data.get('pin', voice.get('pin', 1)),
                    'address': update_data.get('address', voice.get('address', 0)),
                    'device_bus': update_data.get('device_bus', voice.get('device_bus', 0)),
                    'mac': device_mac,  # From device
                    'updated_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })

                save_voice_config()

                rule_name = config[i].get('rule_name', config[i].get('object_name', 'Unknown'))
                log_simple(f"Voice control updated: {rule_name} on {device_name} ({device_part_number})")
                return True, f"Voice control '{rule_name}' updated successfully"

        return False, f"Voice control with ID {voice_id} not found"

    except Exception as e:
        log_simple(f"Error updating voice control: {e}", "ERROR")
        send_error_log("update_voice_control", f"Voice control update error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def delete_voice_control(voice_id):
    """Delete voice control"""
    try:
        if not voice_id:
            return False, "Voice control UUID is required for deletion"

        initial_count = len(config)
        config[:] = [voice for voice in config if voice.get('uuid') != voice_id and voice.get('id') != voice_id]

        if len(config) < initial_count:
            save_voice_config()

            log_simple(f"Voice control deleted: {voice_id}")
            return True, "Voice control deleted successfully"
        else:
            return False, f"Voice control with UUID {voice_id} not found"

    except Exception as e:
        log_simple(f"Error deleting voice control: {e}", "ERROR")
        send_error_log("delete_voice_control", f"Voice control deletion error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

# --- Voice Control Publisher Thread ---
def run_voice_publisher_loop():
    """Publisher thread to continuously publish voice control data"""
    while True:
        try:
            if client_crud and client_crud.is_connected():
                # Publish voice control data
                client_crud.publish(VOICE_CONTROL_DATA_TOPIC, json.dumps(config))

                # Publish modular devices data
                available_devices = []
                for device in modular_devices:
                    available_device = {
                        'profile': {
                            'name': device.get('profile', {}).get('name', ''),
                            'device_bus': device.get('protocol_setting', {}).get('device_bus', 0),
                            'address': device.get('protocol_setting', {}).get('address', 0)
                        },
                        'protocol_setting': {
                            'address': device.get('protocol_setting', {}).get('address', 0),
                            'device_bus': device.get('protocol_setting', {}).get('device_bus', 0)
                        },
                        'data': device.get('data', [])
                    }
                    available_devices.append(available_device)

                client_crud.publish(MODULAR_VALUE_DATA_TOPIC, json.dumps(available_devices))

        except Exception as e:
            send_error_log("run_voice_publisher_loop", f"Error in voice publisher loop: {e}", ERROR_TYPE_MAJOR)

        time.sleep(1)  # Publish every 1 second

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
    global client_control, client_crud, error_logger

    print_startup_banner()

    # Test MAC address detection
    log_simple("Testing MAC address detection...")
    test_mac = get_active_mac_address()
    log_simple(f"MAC address detection test result: {test_mac}", "INFO")

    # Load configurations
    log_simple("Loading configurations...")
    mqtt_config = load_mqtt_config()
    load_voice_config()
    load_modular_devices()

    broker = mqtt_config.get('broker_address', 'localhost')
    port = int(mqtt_config.get('broker_port', 1883))
    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')

    # Initialize unified error logger
    log_simple("Initializing unified error logger...")
    error_logger = initialize_error_logger("AutomationVoiceService", broker, port)

    # Connect to CRUD broker
    log_simple("Connecting to CRUD MQTT broker...")
    client_crud = connect_mqtt(
        f'automation-voice-crud-{uuid.uuid4()}',
        broker, port, username, password,
        on_connect_crud, on_disconnect_crud, on_message_crud
    )

    # Connect to Control broker
    log_simple("Connecting to Control MQTT broker...")
    client_control = connect_mqtt(
        f'automation-voice-control-{uuid.uuid4()}',
        broker, port, username, password,
        on_connect_control, on_disconnect_control, None
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

    log_simple("Automation Voice Control service started successfully", "SUCCESS")

    # Start publisher thread
    log_simple("Starting voice control publisher thread...")
    voice_thread = threading.Thread(target=run_voice_publisher_loop, daemon=True)
    voice_thread.start()
    log_simple("Voice control publisher thread started successfully", "SUCCESS")

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
