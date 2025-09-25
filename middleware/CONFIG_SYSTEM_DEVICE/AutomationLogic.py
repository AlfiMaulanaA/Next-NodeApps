import json
import time
import threading
import logging
import uuid
import operator
import paho.mqtt.client as mqtt
from datetime import datetime, timedelta

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
config = {"logic_rules": []}
modular_devices = []
client_control = None  # For sending control commands to devices
client_crud = None     # For handling configuration CRUD operations
client_error_logger = None  # Dedicated client for sending error logs
device_states = {}  # Track current device states for trigger evaluation
trigger_timers = {}  # Track delay timers for triggers

# --- Connection Status Tracking ---
crud_broker_connected = False
control_broker_connected = False

# --- Configuration File Paths ---
mqtt_config_file = '../MODULAR_I2C/JSON/Config/mqtt_config.json'
config_file = './JSON/automationLogicConfig.json'
modular_devices_file = '../MODULAR_I2C/JSON/Config/installed_devices.json'

# --- MQTT Topic Definitions ---
# CRUD Topics (localhost broker)
AUTOMATION_LOGIC_CREATE_TOPIC = "automation_logic/create"
AUTOMATION_LOGIC_READ_TOPIC = "automation_logic/read"
AUTOMATION_LOGIC_UPDATE_TOPIC = "automation_logic/update"
AUTOMATION_LOGIC_DELETE_TOPIC = "automation_logic/delete"
AUTOMATION_LOGIC_GET_TOPIC = "automation_logic/get"

# Response Topics (localhost broker)
RESPONSE_AUTOMATION_LOGIC_TOPIC = "response_automation_logic"
RESPONSE_GET_DATA_TOPIC = "response_get_data"

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
ERROR_LOG_BROKER = "localhost"
ERROR_LOG_PORT = 1883
ERROR_LOG_TOPIC = "subrack/error/log"
ERROR_LOG_CLIENT_ID = f'automation-logic-error-logger-{uuid.uuid4()}'

def send_error_log(error_msg, error_type):
    """Send error log to MQTT topic"""
    try:
        if client_error_logger and client_error_logger.is_connected():
            error_message = {
                "data": f"[AutomationLogic] {error_msg}",
                "type": error_type.upper(),
                "source": "AutomationLogicService",
                "Timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            client_error_logger.publish(ERROR_LOG_TOPIC, json.dumps(error_message))
    except Exception as e:
        log_simple(f"Failed to send error log: {e}", "ERROR")

# --- Configuration Management ---
def load_mqtt_config():
    """Load MQTT config with graceful error handling"""
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
    
    try:
        with open(mqtt_config_file, 'r') as file:
            content = file.read().strip()
            if not content:
                log_simple(f"MQTT config file is empty. Using defaults.", "WARNING")
                return default_config
            return json.load(file)
    except FileNotFoundError:
        log_simple(f"MQTT config file not found. Using defaults.", "WARNING")
        return default_config
    except json.JSONDecodeError as e:
        log_simple(f"Error decoding MQTT config: {e}. Using defaults.", "WARNING")
        return default_config
    except Exception as e:
        log_simple(f"Unexpected error loading MQTT config: {e}. Using defaults.", "WARNING")
        return default_config

def load_logic_config():
    """Load automation logic configuration"""
    global config
    try:
        with open(config_file, 'r') as file:
            loaded_data = json.load(file)
            
        if isinstance(loaded_data, dict):
            config = loaded_data
            log_simple(f"Logic configuration loaded from {config_file}")
        else:
            config = {"logic_rules": []}
            log_simple("Invalid config format, using default structure.", "WARNING")
            
    except FileNotFoundError:
        log_simple(f"Config file not found: {config_file}. Creating default config.")
        config = {"logic_rules": []}
        save_logic_config()
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load config (JSON decode error): {e}. Using default.", "ERROR")
        config = {"logic_rules": []}
        send_error_log(f"Config JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load config: {e}", "ERROR")
        config = {"logic_rules": []}
        send_error_log(f"Config load error: {e}", ERROR_TYPE_MAJOR)

def save_logic_config():
    """Save automation logic configuration"""
    try:
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=2)
        log_simple(f"Configuration saved to {config_file}")
    except Exception as e:
        log_simple(f"Failed to save config: {e}", "ERROR")
        send_error_log(f"Config save error: {e}", ERROR_TYPE_MAJOR)

def load_modular_devices():
    """Load modular devices from installed_devices.json"""
    global modular_devices
    try:
        with open(modular_devices_file, 'r') as file:
            modular_devices = json.load(file)
        log_simple(f"Modular devices loaded: {len(modular_devices)} devices")
        
        # Publish available devices to MODULAR_DEVICE/AVAILABLES topic
        publish_available_devices()
        
    except FileNotFoundError:
        log_simple(f"Modular devices file not found: {modular_devices_file}")
        modular_devices = []
        send_error_log(f"Modular devices file not found", ERROR_TYPE_WARNING)
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load modular devices (JSON decode error): {e}")
        modular_devices = []
        send_error_log(f"Modular devices JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load modular devices: {e}", "ERROR")
        modular_devices = []
        send_error_log(f"Modular devices load error: {e}", ERROR_TYPE_MAJOR)

def publish_available_devices():
    """Publish available modular devices to MODULAR_DEVICE/AVAILABLES topic"""
    try:
        if client_crud and client_crud.is_connected():
            available_devices = []
            for device in modular_devices:
                available_device = {
                    'name': device.get('profile', {}).get('name', ''),
                    'address': device.get('protocol_setting', {}).get('address', 0),
                    'device_bus': device.get('protocol_setting', {}).get('device_bus', 0),
                    'part_number': device.get('profile', {}).get('part_number', ''),
                    'mac': device.get('mac', '00:00:00:00:00:00'),
                    'device_type': device.get('profile', {}).get('device_type', ''),
                    'manufacturer': device.get('profile', {}).get('manufacturer', '')
                }
                available_devices.append(available_device)
            
            client_crud.publish(MODULAR_AVAILABLES_TOPIC, json.dumps(available_devices))
            log_simple(f"Published {len(available_devices)} available devices", "SUCCESS")
        else:
            log_simple("Cannot publish available devices - CRUD client not connected", "WARNING")
            
    except Exception as e:
        log_simple(f"Error publishing available devices: {e}", "ERROR")
        send_error_log(f"Error publishing available devices: {e}", ERROR_TYPE_MINOR)

# --- MQTT Connection Functions ---
def on_connect_crud(client, userdata, flags, rc):
    global crud_broker_connected
    if rc == 0:
        crud_broker_connected = True
        log_simple("CRUD MQTT broker connected", "SUCCESS")
        
        # Subscribe to CRUD topics
        client.subscribe([
            (AUTOMATION_LOGIC_CREATE_TOPIC, 1),
            (AUTOMATION_LOGIC_READ_TOPIC, 1),
            (AUTOMATION_LOGIC_UPDATE_TOPIC, 1),
            (AUTOMATION_LOGIC_DELETE_TOPIC, 1),
            (AUTOMATION_LOGIC_GET_TOPIC, 1),
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
        
        # Subscribe to device data for trigger evaluation
        client.subscribe(MODULAR_DATA_TOPIC)
        
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
        
        if topic == "command_available_device":
            if payload == "get_modular_devices":
                publish_available_devices()
            return
            
        # Handle CRUD operations
        try:
            message_data = json.loads(payload)
        except json.JSONDecodeError:
            log_simple(f"Invalid JSON in CRUD message: {payload}", "ERROR")
            return
            
        if topic == AUTOMATION_LOGIC_GET_TOPIC:
            handle_get_request(client)
        elif topic in [AUTOMATION_LOGIC_CREATE_TOPIC, AUTOMATION_LOGIC_UPDATE_TOPIC, AUTOMATION_LOGIC_DELETE_TOPIC]:
            handle_crud_request(client, topic, message_data)
            
    except Exception as e:
        log_simple(f"Error handling CRUD message: {e}", "ERROR")
        send_error_log(f"CRUD message handling error: {e}", ERROR_TYPE_MINOR)

def on_message_control(client, userdata, msg):
    """Handle control and device data messages"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()
        
        if topic == MODULAR_DATA_TOPIC:
            # Process device data for trigger evaluation
            try:
                device_data = json.loads(payload)
                process_device_data(device_data)
            except json.JSONDecodeError:
                log_simple(f"Invalid JSON in device data: {payload}", "ERROR")
                
    except Exception as e:
        log_simple(f"Error handling control message: {e}", "ERROR")
        send_error_log(f"Control message handling error: {e}", ERROR_TYPE_MINOR)

# --- CRUD Operations ---
def handle_get_request(client):
    """Handle get data request"""
    try:
        response = {
            "status": "success",
            "data": config,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(RESPONSE_GET_DATA_TOPIC, json.dumps(response))
        log_simple("Configuration data sent to client", "SUCCESS")
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(RESPONSE_GET_DATA_TOPIC, json.dumps(error_response))
        log_simple(f"Error sending config data: {e}", "ERROR")

def handle_crud_request(client, topic, message_data):
    """Handle CRUD operations"""
    try:
        action = message_data.get('action')
        data = message_data.get('data', {})
        
        success = False
        message = ""
        
        if topic == AUTOMATION_LOGIC_CREATE_TOPIC and action == "add":
            success, message = create_logic_rule(data)
        elif topic == AUTOMATION_LOGIC_UPDATE_TOPIC and action == "set":
            success, message = update_logic_rule(data)
        elif topic == AUTOMATION_LOGIC_DELETE_TOPIC and action == "delete":
            success, message = delete_logic_rule(data.get('id'))
        else:
            message = f"Unknown action: {action}"
            
        # Send response
        response = {
            "status": "success" if success else "error",
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(RESPONSE_AUTOMATION_LOGIC_TOPIC, json.dumps(response))
        
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(RESPONSE_AUTOMATION_LOGIC_TOPIC, json.dumps(error_response))
        log_simple(f"Error handling CRUD request: {e}", "ERROR")

def create_logic_rule(rule_data):
    """Create new logic rule"""
    try:
        rule_data['id'] = str(uuid.uuid4())
        rule_data['created_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        config['logic_rules'].append(rule_data)
        save_logic_config()
        
        log_simple(f"Logic rule created: {rule_data.get('rule_name', 'Unknown')}")
        return True, f"Logic rule '{rule_data.get('rule_name', 'Unknown')}' created successfully"
        
    except Exception as e:
        log_simple(f"Error creating logic rule: {e}", "ERROR")
        send_error_log(f"Logic rule creation error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def update_logic_rule(rule_data):
    """Update existing logic rule"""
    try:
        rule_id = rule_data.get('id')
        if not rule_id:
            return False, "Rule ID is required for update"
            
        for i, rule in enumerate(config['logic_rules']):
            if rule.get('id') == rule_id:
                rule_data['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                config['logic_rules'][i] = rule_data
                save_logic_config()
                
                log_simple(f"Logic rule updated: {rule_data.get('rule_name', 'Unknown')}")
                return True, f"Logic rule '{rule_data.get('rule_name', 'Unknown')}' updated successfully"
        
        return False, f"Logic rule with ID {rule_id} not found"
        
    except Exception as e:
        log_simple(f"Error updating logic rule: {e}", "ERROR")
        send_error_log(f"Logic rule update error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def delete_logic_rule(rule_id):
    """Delete logic rule"""
    try:
        if not rule_id:
            return False, "Rule ID is required for deletion"
            
        initial_count = len(config['logic_rules'])
        config['logic_rules'] = [rule for rule in config['logic_rules'] if rule.get('id') != rule_id]
        
        if len(config['logic_rules']) < initial_count:
            save_logic_config()
            log_simple(f"Logic rule deleted: {rule_id}")
            return True, "Logic rule deleted successfully"
        else:
            return False, f"Logic rule with ID {rule_id} not found"
            
    except Exception as e:
        log_simple(f"Error deleting logic rule: {e}", "ERROR")
        send_error_log(f"Logic rule deletion error: {e}", ERROR_TYPE_MAJOR)
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
        for rule in config.get('logic_rules', []):
            evaluate_rule(rule, device_name, data)
            
    except Exception as e:
        log_simple(f"Error processing device data: {e}", "ERROR")
        send_error_log(f"Device data processing error: {e}", ERROR_TYPE_MINOR)

def evaluate_rule(rule, device_name, device_data):
    """Evaluate a single logic rule"""
    try:
        rule_id = rule.get('id', '')
        trigger_groups = rule.get('trigger_groups', [])
        
        if not trigger_groups:
            return
            
        group_results = []
        
        for group in trigger_groups:
            group_result = evaluate_trigger_group(group, device_name, device_data)
            group_results.append(group_result)
            
        # All groups must be true for rule to trigger
        if all(group_results):
            log_simple(f"Logic rule triggered: {rule.get('rule_name', rule_id)}")
            execute_rule_actions(rule)
            
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
    """Evaluate a single trigger condition with delay support"""
    try:
        trigger_type = trigger.get('trigger_type', 'drycontact')
        pin_number = trigger.get('pin_number', 1)
        condition_operator = trigger.get('condition_operator', 'is')
        target_value = trigger.get('target_value', False)
        expected_value = trigger.get('expected_value', False)
        delay_on = trigger.get('delay_on', 0)
        delay_off = trigger.get('delay_off', 0)
        
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
                
            # Handle delays
            trigger_key = f"{trigger.get('device_name', '')}_{pin_number}_{condition_operator}"
            
            if condition_met and delay_on > 0:
                # Start delay timer for activation
                if trigger_key not in trigger_timers:
                    trigger_timers[trigger_key] = {
                        'type': 'delay_on',
                        'start_time': datetime.now(),
                        'delay': delay_on,
                        'triggered': False
                    }
                    log_simple(f"Delay ON started for trigger {trigger_key}: {delay_on}s")
                    return False
                else:
                    # Check if delay has elapsed
                    timer = trigger_timers[trigger_key]
                    if timer['type'] == 'delay_on' and not timer['triggered']:
                        elapsed = (datetime.now() - timer['start_time']).total_seconds()
                        if elapsed >= delay_on:
                            timer['triggered'] = True
                            log_simple(f"Delay ON completed for trigger {trigger_key}")
                            return True
                        else:
                            return False
                    return timer['triggered']
            elif not condition_met and delay_off > 0:
                # Start delay timer for deactivation
                if trigger_key in trigger_timers and trigger_timers[trigger_key]['triggered']:
                    trigger_timers[trigger_key] = {
                        'type': 'delay_off',
                        'start_time': datetime.now(),
                        'delay': delay_off,
                        'triggered': True
                    }
                    log_simple(f"Delay OFF started for trigger {trigger_key}: {delay_off}s")
                    return True
                elif trigger_key in trigger_timers:
                    timer = trigger_timers[trigger_key]
                    if timer['type'] == 'delay_off':
                        elapsed = (datetime.now() - timer['start_time']).total_seconds()
                        if elapsed >= delay_off:
                            del trigger_timers[trigger_key]
                            log_simple(f"Delay OFF completed for trigger {trigger_key}")
                            return False
                        else:
                            return True
                return condition_met
            else:
                # No delay, immediate evaluation
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
        actions = rule.get('actions', [])
        
        for action in actions:
            action_type = action.get('action_type', '')
            
            if action_type == 'control_relay':
                execute_relay_control(action)
            elif action_type == 'send_message':
                execute_send_message(action, rule)
                
    except Exception as e:
        log_simple(f"Error executing rule actions: {e}", "ERROR")
        send_error_log(f"Rule action execution error: {e}", ERROR_TYPE_MINOR)

def execute_relay_control(action):
    """Execute relay control action"""
    try:
        if not (client_control and client_control.is_connected()):
            log_simple("Control client not connected for relay action", "WARNING")
            return
            
        target_device = action.get('target_device', '')
        target_mac = action.get('target_mac', '')
        target_address = action.get('target_address', 0)
        target_bus = action.get('target_bus', 0)
        relay_pin = action.get('relay_pin', 1)
        target_value = action.get('target_value', False)
        
        # Create control payload according to requirements
        mqtt_config = load_mqtt_config()
        control_payload = {
            "mac": target_mac or mqtt_config.get('mac_address', '00:00:00:00:00:00'),
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
        
        # Send control command
        client_control.publish(MODULAR_CONTROL_TOPIC, json.dumps(control_payload))
        log_simple(f"Relay control sent: {target_device} pin {relay_pin} = {target_value}", "SUCCESS")
        
    except Exception as e:
        log_simple(f"Error executing relay control: {e}", "ERROR")
        send_error_log(f"Relay control execution error: {e}", ERROR_TYPE_MINOR)

def execute_send_message(action, rule):
    """Execute send message action"""
    try:
        if not (client_crud and client_crud.is_connected()):
            log_simple("CRUD client not connected for message action", "WARNING")
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
        log_simple(f"Message sent: {message}", "SUCCESS")
        
    except Exception as e:
        log_simple(f"Error executing send message: {e}", "ERROR")
        send_error_log(f"Send message execution error: {e}", ERROR_TYPE_MINOR)

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
    
    # Load configurations
    log_simple("Loading configurations...")
    mqtt_config = load_mqtt_config()
    load_logic_config()
    load_modular_devices()
    
    broker = mqtt_config.get('broker_address', 'localhost')
    port = int(mqtt_config.get('broker_port', 1883))
    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')
    
    # Initialize error logger
    log_simple("Initializing error logger...")
    client_error_logger = connect_mqtt(
        ERROR_LOG_CLIENT_ID,
        ERROR_LOG_BROKER,
        ERROR_LOG_PORT
    )
    if client_error_logger:
        client_error_logger.loop_start()
    
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
        send_error_log(f"Critical service error: {e}", ERROR_TYPE_CRITICAL)
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