import json
import time
import threading
import logging
import uuid
import operator
import paho.mqtt.client as mqtt
from datetime import datetime

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("AutomationLogicService")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("======= Automation Logic =======")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("======= Automation Logic =======")
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
config = {}
installed_devices = []
client_control = None  # For sending control commands to devices
client_crud = None     # For handling configuration CRUD operations
client_error_logger = None  # Dedicated client for sending error logs to localhost

# --- Connection Status Tracking ---
crud_broker_connected = False
control_broker_connected = False

# --- Configuration File Paths ---
mqtt_config_file = '../MODULAR_I2C/JSON/Config/mqtt_config.json'
config_file = './JSON/automationLogicConfig.json'
installed_devices_file = '../MODULAR_I2C/JSON/Config/installed_devices.json'

# --- MQTT Topic Definitions ---
# CRUD Topics (localhost broker)
AUTOMATION_LOGIC_TOPIC = "automation_logic/data"
AUTOMATION_LOGIC_CREATE_TOPIC = "automation_logic/create"
AUTOMATION_LOGIC_READ_TOPIC = "automation_logic/read"
AUTOMATION_LOGIC_UPDATE_TOPIC = "automation_logic/update"
AUTOMATION_LOGIC_DELETE_TOPIC = "automation_logic/delete"
AUTOMATION_LOGIC_GET_TOPIC = "automation_logic/get"

# Response Topics (localhost broker)
RESPONSE_AUTOMATION_LOGIC_TOPIC = "response_automation_logic"
RESPONSE_GET_DATA_TOPIC = "response_get_data"

# --- Error severity levels ---
ERROR_TYPE_CRITICAL = "CRITICAL"
ERROR_TYPE_MAJOR = "MAJOR"
ERROR_TYPE_MINOR = "MINOR"
ERROR_TYPE_WARNING = "WARNING"

# --- Error Log Helper Function (to localhost) ---
ERROR_LOG_BROKER = "localhost"
ERROR_LOG_PORT = 1883
ERROR_LOG_TOPIC = "subrack/error/log"
ERROR_LOG_CLIENT_ID = f'automation-logic-error-logger-{uuid.uuid4()}'

def on_error_logger_connect(client, userdata, flags, rc):
    if rc == 0:
        log_simple("Error Logger MQTT broker connected", "SUCCESS")
    else:
        log_simple(f"Error Logger MQTT broker connection failed (code {rc})", "ERROR")

def on_error_logger_disconnect(client, userdata, rc):
    if rc != 0:
        log_simple("Error Logger MQTT broker disconnected", "WARNING")
    else:
        log_simple("Error Logger disconnected normally", "INFO")

def init_error_logger_client():
    """Initializes and connects the dedicated error logging MQTT client."""
    global client_error_logger
    try:
        client_error_logger = mqtt.Client(ERROR_LOG_CLIENT_ID)
        client_error_logger.on_connect = on_error_logger_connect
        client_error_logger.on_disconnect = on_error_logger_disconnect
        client_error_logger.connect(ERROR_LOG_BROKER, ERROR_LOG_PORT, 60)
        client_error_logger.loop_start()
        return True
    except Exception as e:
        log_simple(f"Failed to initialize error logger client: {e}", "ERROR")
        return False

def send_error_log(error_message, error_type=ERROR_TYPE_MINOR):
    """Send error log to localhost MQTT broker"""
    global client_error_logger
    if client_error_logger and client_error_logger.is_connected():
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        error_payload = {
            "data": error_message,
            "type": error_type,
            "source": "AutomationLogic",
            "Timestamp": timestamp
        }
        try:
            client_error_logger.publish(ERROR_LOG_TOPIC, json.dumps(error_payload))
            log_simple(f"Error logged: {error_message}", "WARNING")
        except Exception as e:
            log_simple(f"Failed to send error log: {e}", "ERROR")

# --- Configuration Management ---
def load_config():
    """Load configuration files"""
    global config, installed_devices
    try:
        # Load automation logic config
        with open(config_file, 'r') as file:
            config = json.load(file)
        log_simple("Automation logic configuration loaded", "SUCCESS")
        
        # Load installed devices
        with open(installed_devices_file, 'r') as file:
            installed_devices = json.load(file)
        log_simple("Installed devices configuration loaded", "SUCCESS")
        
        return True
    except FileNotFoundError as e:
        error_msg = f"Configuration file not found: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)
        return False
    except json.JSONDecodeError as e:
        error_msg = f"Error decoding JSON configuration: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)
        return False
    except Exception as e:
        error_msg = f"Unexpected error loading configuration: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)
        return False

def save_config():
    """Save automation logic configuration"""
    global config
    try:
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=4)
        log_simple("Configuration saved successfully", "SUCCESS")
        return True
    except Exception as e:
        error_msg = f"Failed to save configuration: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MAJOR)
        return False

def load_mqtt_config():
    """Load MQTT broker configuration"""
    try:
        with open(mqtt_config_file, 'r') as file:
            mqtt_config = json.load(file)
        return mqtt_config
    except Exception as e:
        error_msg = f"Failed to load MQTT configuration: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)
        return None

# --- Logic Processing Functions ---
def evaluate_condition(condition, value):
    """Evaluate a single condition against a value"""
    try:
        operator_map = {
            ">": operator.gt,
            "<": operator.lt,
            ">=": operator.ge,
            "<=": operator.le,
            "==": operator.eq,
            "!=": operator.ne
        }
        
        op = operator_map.get(condition.get("operator"))
        if not op:
            log_simple(f"Invalid operator: {condition.get('operator')}", "WARNING")
            return False
        
        return op(float(value), float(condition.get("value", 0)))
    except (ValueError, TypeError) as e:
        log_simple(f"Error evaluating condition: {e}", "WARNING")
        return False

def evaluate_logic_group(logic_group, device_data):
    """Evaluate a logic group with AND/OR operations"""
    try:
        conditions = logic_group.get("conditions", [])
        logic_operator = logic_group.get("logic_operator", "AND").upper()
        
        results = []
        for condition in conditions:
            device_name = condition.get("device_name")
            field_name = condition.get("field_name")
            
            # Find device data
            device_value = None
            for data in device_data:
                if data.get("device_name") == device_name:
                    device_value = data.get("data", {}).get(field_name)
                    break
            
            if device_value is not None:
                result = evaluate_condition(condition, device_value)
                results.append(result)
                log_simple(f"Condition {device_name}.{field_name} {condition.get('operator')} {condition.get('value')}: {result}")
            else:
                log_simple(f"Device data not found: {device_name}.{field_name}", "WARNING")
                results.append(False)
        
        # Apply logic operator
        if logic_operator == "AND":
            return all(results)
        elif logic_operator == "OR":
            return any(results)
        else:
            log_simple(f"Invalid logic operator: {logic_operator}", "WARNING")
            return False
            
    except Exception as e:
        error_msg = f"Error evaluating logic group: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MINOR)
        return False

def execute_action(action, mqtt_config):
    """Execute an action based on logic evaluation result"""
    try:
        action_type = action.get("action_type")
        target_device = action.get("target_device")
        
        if action_type == "control_relay":
            control_relay_action(action, mqtt_config)
        elif action_type == "send_notification":
            send_notification_action(action)
        else:
            log_simple(f"Unknown action type: {action_type}", "WARNING")
            
    except Exception as e:
        error_msg = f"Error executing action: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MINOR)

def control_relay_action(action, mqtt_config):
    """Execute relay control action"""
    global client_control
    try:
        target_device = action.get("target_device")
        relay_pin = action.get("relay_pin")
        relay_state = action.get("relay_state", 1)
        
        # Find target device in installed devices
        target_device_info = None
        for device in installed_devices:
            if device.get("profile", {}).get("name") == target_device:
                target_device_info = device
                break
        
        if not target_device_info:
            log_simple(f"Target device not found: {target_device}", "WARNING")
            return
        
        # Prepare control payload
        control_payload = {
            "protocol_type": "I2C MODULAR",
            "device": target_device_info.get("profile", {}).get("part_number"),
            "function": "write",
            "value": {
                "pin": relay_pin,
                "data": relay_state
            },
            "address": target_device_info.get("protocol_setting", {}).get("address"),
            "device_bus": target_device_info.get("protocol_setting", {}).get("bus"),
            "Timestamp": datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        
        # Publish control command
        if client_control and client_control.is_connected():
            topic = mqtt_config.get("sub_topic_modular", "modular/control")
            client_control.publish(topic, json.dumps(control_payload))
            log_simple(f"Control command sent to {target_device}: relay {relay_pin} = {relay_state}", "SUCCESS")
            
            # Log the action to CRUD broker for frontend visibility
            if client_crud and client_crud.is_connected():
                action_log = {
                    "type": "automation_action",
                    "action": "relay_control",
                    "target_device": target_device,
                    "relay_pin": relay_pin,
                    "relay_state": relay_state,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                client_crud.publish("automation/action/log", json.dumps(action_log))
        else:
            log_simple("Control client not connected", "ERROR")
            
    except Exception as e:
        error_msg = f"Error controlling relay: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MINOR)

def send_notification_action(action):
    """Execute notification action"""
    try:
        message = action.get("message", "Automation logic triggered")
        notification_level = action.get("level", "info")
        log_simple(f"Notification [{notification_level.upper()}]: {message}", "INFO")
        
        # Send notification via MQTT if needed
        if client_crud and client_crud.is_connected():
            notification_payload = {
                "type": "automation_notification",
                "level": notification_level,
                "message": message,
                "source": "AutomationLogic",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            client_crud.publish("automation/notification", json.dumps(notification_payload))
            
            # Also send to error log if it's a warning or error
            if notification_level in ["warning", "error"]:
                send_error_log(f"Automation notification: {message}", ERROR_TYPE_WARNING)
            
    except Exception as e:
        error_msg = f"Error sending notification: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MINOR)

def process_automation_logic(device_data):
    """Process automation logic rules"""
    try:
        mqtt_config = load_mqtt_config()
        if not mqtt_config:
            return
        
        logic_rules = config.get("logic_rules", [])
        
        # Process each rule
        for rule in logic_rules:
            if not rule.get("enabled", True):
                continue
                
            rule_name = rule.get("name", "Unnamed Rule")
            rule_id = rule.get("id", "unknown")
            logic_groups = rule.get("logic_groups", [])
            actions = rule.get("actions", [])
            
            # Skip if no logic groups defined
            if not logic_groups:
                log_simple(f"Rule '{rule_name}' has no logic groups, skipping", "WARNING")
                continue
            
            # Evaluate all logic groups
            group_results = []
            for group in logic_groups:
                result = evaluate_logic_group(group, device_data)
                group_results.append(result)
            
            # Apply rule logic operator
            rule_logic = rule.get("rule_logic_operator", "AND").upper()
            if rule_logic == "AND":
                rule_result = all(group_results) if group_results else False
            elif rule_logic == "OR":
                rule_result = any(group_results) if group_results else False
            else:
                log_simple(f"Invalid rule logic operator: {rule_logic}", "WARNING")
                rule_result = False
            
            log_simple(f"Rule '{rule_name}' (ID: {rule_id}) evaluation result: {rule_result}")
            
            # Execute actions if rule is true
            if rule_result and actions:
                log_simple(f"Executing {len(actions)} actions for rule '{rule_name}'")
                for i, action in enumerate(actions):
                    try:
                        execute_action(action, mqtt_config)
                        log_simple(f"Action {i+1}/{len(actions)} executed for rule '{rule_name}'", "SUCCESS")
                    except Exception as action_error:
                        error_msg = f"Failed to execute action {i+1} for rule '{rule_name}': {action_error}"
                        log_simple(error_msg, "ERROR")
                        send_error_log(error_msg, ERROR_TYPE_MINOR)
            elif rule_result and not actions:
                log_simple(f"Rule '{rule_name}' triggered but no actions defined", "WARNING")
                    
    except Exception as e:
        error_msg = f"Error processing automation logic: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MAJOR)

# --- MQTT Event Handlers ---
def on_control_connect(client, userdata, flags, rc):
    """Callback for control client connection"""
    global control_broker_connected
    if rc == 0:
        control_broker_connected = True
        log_simple("Connected to control MQTT broker", "SUCCESS")
        
        # Subscribe to device data topics
        for device in installed_devices:
            topic = device.get("profile", {}).get("topic")
            if topic:
                client.subscribe(topic)
                log_simple(f"Subscribed to device topic: {topic}")
                
    else:
        control_broker_connected = False
        error_msg = f"Failed to connect to control broker (code {rc})"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)

def on_control_disconnect(client, userdata, rc):
    """Callback for control client disconnection"""
    global control_broker_connected
    control_broker_connected = False
    if rc != 0:
        log_simple("Control broker disconnected unexpectedly", "WARNING")
    else:
        log_simple("Control broker disconnected normally", "INFO")

def on_control_message(client, userdata, message):
    """Callback for receiving device data messages"""
    try:
        payload = message.payload.decode()
        data = json.loads(payload)
        
        # Store device data for logic processing
        device_name = data.get("device_name")
        if device_name:
            # Process automation logic with current device data
            device_data_list = [data]  # In real implementation, maintain a data buffer
            process_automation_logic(device_data_list)
            
            # Also publish the device data for other services
            if client_crud and client_crud.is_connected():
                try:
                    client_crud.publish(AUTOMATION_LOGIC_TOPIC, json.dumps(data))
                except Exception as e:
                    log_simple(f"Failed to republish device data: {e}", "WARNING")
            
    except json.JSONDecodeError as e:
        log_simple(f"Failed to parse device data JSON: {e}", "WARNING")
    except Exception as e:
        error_msg = f"Error processing device message: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MINOR)

def on_crud_connect(client, userdata, flags, rc):
    """Callback for CRUD client connection"""
    global crud_broker_connected
    if rc == 0:
        crud_broker_connected = True
        log_simple("Connected to CRUD MQTT broker", "SUCCESS")
        
        # Subscribe to CRUD topics
        client.subscribe(AUTOMATION_LOGIC_CREATE_TOPIC)
        client.subscribe(AUTOMATION_LOGIC_READ_TOPIC)
        client.subscribe(AUTOMATION_LOGIC_UPDATE_TOPIC)
        client.subscribe(AUTOMATION_LOGIC_DELETE_TOPIC)
        client.subscribe(AUTOMATION_LOGIC_GET_TOPIC)
        
    else:
        crud_broker_connected = False
        error_msg = f"Failed to connect to CRUD broker (code {rc})"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)

def on_crud_disconnect(client, userdata, rc):
    """Callback for CRUD client disconnection"""
    global crud_broker_connected
    crud_broker_connected = False
    if rc != 0:
        log_simple("CRUD broker disconnected unexpectedly", "WARNING")
    else:
        log_simple("CRUD broker disconnected normally", "INFO")

def on_crud_message(client, userdata, message):
    """Callback for handling CRUD operations"""
    try:
        payload = message.payload.decode()
        topic = message.topic
        
        # Handle different message formats
        if topic == AUTOMATION_LOGIC_GET_TOPIC:
            # Simple get request
            response = {"status": "success", "data": config}
            client.publish(RESPONSE_GET_DATA_TOPIC, json.dumps(response))
            log_simple(f"Sent automation logic data to {RESPONSE_GET_DATA_TOPIC}")
            return
        
        # Parse JSON command
        command = json.loads(payload)
        response = {"status": "error", "message": "Unknown command"}
        
        if topic == AUTOMATION_LOGIC_CREATE_TOPIC:
            response = handle_create_logic_rule(command)
        elif topic == AUTOMATION_LOGIC_READ_TOPIC:
            response = handle_read_logic_rules(command)
        elif topic == AUTOMATION_LOGIC_UPDATE_TOPIC:
            response = handle_update_logic_rule(command)
        elif topic == AUTOMATION_LOGIC_DELETE_TOPIC:
            response = handle_delete_logic_rule(command)
        
        # Publish response
        client.publish(RESPONSE_AUTOMATION_LOGIC_TOPIC, json.dumps(response))
        log_simple(f"Sent response to {RESPONSE_AUTOMATION_LOGIC_TOPIC}: {response['status']}", "SUCCESS" if response['status'] == 'success' else "WARNING")
        
    except json.JSONDecodeError as e:
        error_msg = f"Failed to parse CRUD command JSON: {e}"
        log_simple(error_msg, "WARNING")
        response_topic = RESPONSE_GET_DATA_TOPIC if message.topic == AUTOMATION_LOGIC_GET_TOPIC else RESPONSE_AUTOMATION_LOGIC_TOPIC
        client.publish(response_topic, json.dumps({
            "status": "error", 
            "message": "Invalid JSON format"
        }))
    except Exception as e:
        error_msg = f"Error processing CRUD command: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MINOR)
        response_topic = RESPONSE_GET_DATA_TOPIC if message.topic == AUTOMATION_LOGIC_GET_TOPIC else RESPONSE_AUTOMATION_LOGIC_TOPIC
        client.publish(response_topic, json.dumps({
            "status": "error", 
            "message": str(e)
        }))

# --- CRUD Operation Handlers ---
def handle_create_logic_rule(command):
    """Handle create logic rule operation"""
    try:
        # Handle both direct data and command structure
        if "action" in command and command.get("action") == "add":
            rule_data = command.get("data")
        else:
            rule_data = command.get("data") or command
        
        if not rule_data:
            return {"status": "error", "message": "No rule data provided"}
        
        # Add unique ID
        rule_data["id"] = str(uuid.uuid4())
        rule_data["created_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Add to config
        if "logic_rules" not in config:
            config["logic_rules"] = []
        config["logic_rules"].append(rule_data)
        
        if save_config():
            log_simple(f"Created logic rule: {rule_data.get('name')}", "SUCCESS")
            return {
                "status": "success", 
                "message": "Logic rule created successfully", 
                "id": rule_data["id"],
                "data": rule_data
            }
        else:
            return {"status": "error", "message": "Failed to save configuration"}
            
    except Exception as e:
        return {"status": "error", "message": f"Error creating rule: {str(e)}"}

def handle_read_logic_rules(command):
    """Handle read logic rules operation"""
    try:
        logic_rules = config.get("logic_rules", [])
        return {
            "status": "success", 
            "data": logic_rules,
            "count": len(logic_rules),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        return {"status": "error", "message": f"Error reading rules: {str(e)}"}

def handle_update_logic_rule(command):
    """Handle update logic rule operation"""
    try:
        # Handle both direct data and command structure
        if "action" in command and command.get("action") == "set":
            rule_data = command.get("data")
        else:
            rule_data = command.get("data") or command
        
        rule_id = rule_data.get("id") if rule_data else None
        
        if not rule_id:
            return {"status": "error", "message": "No rule ID provided"}
        
        # Find and update rule
        logic_rules = config.get("logic_rules", [])
        for i, rule in enumerate(logic_rules):
            if rule.get("id") == rule_id:
                rule_data["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                logic_rules[i] = rule_data
                
                if save_config():
                    log_simple(f"Updated logic rule: {rule_data.get('name')}", "SUCCESS")
                    return {
                        "status": "success", 
                        "message": "Logic rule updated successfully",
                        "data": rule_data
                    }
                else:
                    return {"status": "error", "message": "Failed to save configuration"}
        
        return {"status": "error", "message": "Rule not found"}
        
    except Exception as e:
        return {"status": "error", "message": f"Error updating rule: {str(e)}"}

def handle_delete_logic_rule(command):
    """Handle delete logic rule operation"""
    try:
        # Handle both direct ID and command structure
        if "action" in command and command.get("action") == "delete":
            rule_id = command.get("data", {}).get("id") or command.get("id")
        else:
            rule_id = command.get("id") or command.get("data", {}).get("id")
            
        if not rule_id:
            return {"status": "error", "message": "No rule ID provided"}
        
        # Find and remove rule
        logic_rules = config.get("logic_rules", [])
        original_count = len(logic_rules)
        config["logic_rules"] = [rule for rule in logic_rules if rule.get("id") != rule_id]
        
        if len(config["logic_rules"]) < original_count:
            if save_config():
                log_simple(f"Deleted logic rule ID: {rule_id}", "SUCCESS")
                return {
                    "status": "success", 
                    "message": "Logic rule deleted successfully",
                    "id": rule_id
                }
            else:
                return {"status": "error", "message": "Failed to save configuration"}
        else:
            return {"status": "error", "message": "Rule not found"}
            
    except Exception as e:
        return {"status": "error", "message": f"Error deleting rule: {str(e)}"}

# --- Client Setup Functions ---
def setup_control_client():
    """Setup and connect control MQTT client"""
    global client_control
    try:
        mqtt_config = load_mqtt_config()
        if not mqtt_config:
            return False
        
        client_control = mqtt.Client(f"automation-logic-control-{uuid.uuid4()}")
        client_control.on_connect = on_control_connect
        client_control.on_disconnect = on_control_disconnect
        client_control.on_message = on_control_message
        
        # Set credentials if provided
        username = mqtt_config.get("username")
        password = mqtt_config.get("password")
        if username and password:
            client_control.username_pw_set(username, password)
        
        client_control.connect(
            mqtt_config.get("broker_address", "localhost"),
            mqtt_config.get("broker_port", 1883),
            60
        )
        
        client_control.loop_start()
        return True
        
    except Exception as e:
        error_msg = f"Failed to setup control client: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)
        return False

def setup_crud_client():
    """Setup and connect CRUD MQTT client"""
    global client_crud
    try:
        client_crud = mqtt.Client(f"automation-logic-crud-{uuid.uuid4()}")
        client_crud.on_connect = on_crud_connect
        client_crud.on_disconnect = on_crud_disconnect
        client_crud.on_message = on_crud_message
        
        client_crud.connect("localhost", 1883, 60)
        client_crud.loop_start()
        return True
        
    except Exception as e:
        error_msg = f"Failed to setup CRUD client: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)
        return False

# --- Utility Functions ---
def publish_crud(client, message, topic):
    """Utility function to publish CRUD messages"""
    try:
        if client and client.is_connected():
            client.publish(topic, message)
            log_simple(f"Published to {topic}: {message[:100]}...")
        else:
            log_simple(f"CRUD client not connected, unable to publish to {topic}", "ERROR")
            send_error_log(f"CRUD client disconnected, failed to publish to {topic}", ERROR_TYPE_WARNING)
    except Exception as e:
        error_msg = f"Failed to publish CRUD message to {topic}: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_MAJOR)

def publish_response(client, message, success=True, topic=None):
    """Utility function to publish standardized responses"""
    response_data = {
        "status": "success" if success else "error",
        "message": message,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    response_topic = topic or RESPONSE_AUTOMATION_LOGIC_TOPIC
    publish_crud(client, json.dumps(response_data), response_topic)

# --- Main Functions ---
def initialize_system():
    """Initialize the automation logic system"""
    print_startup_banner()
    
    # Initialize error logger first
    if not init_error_logger_client():
        log_simple("Failed to initialize error logger, continuing without it", "WARNING")
    
    # Load configurations
    if not load_config():
        log_simple("Failed to load configuration", "ERROR")
        return False
    
    # Setup MQTT clients
    control_setup = setup_control_client()
    crud_setup = setup_crud_client()
    
    if not control_setup or not crud_setup:
        log_simple("Failed to setup MQTT clients", "ERROR")
        return False
    
    # Wait for connections
    time.sleep(2)
    print_broker_status(crud_broker_connected, control_broker_connected)
    
    if control_broker_connected and crud_broker_connected:
        print_success_banner()
        return True
    else:
        log_simple("Not all brokers connected successfully", "WARNING")
        return False

def main():
    """Main application loop"""
    try:
        if not initialize_system():
            log_simple("System initialization failed", "ERROR")
            return
        
        log_simple("Automation Logic Service started successfully", "SUCCESS")
        
        # Main service loop
        while True:
            try:
                time.sleep(1)
                
                # Check and reconnect clients if needed
                if client_control and not client_control.is_connected():
                    log_simple("Reconnecting control client...", "WARNING")
                    client_control.reconnect()
                
                if client_crud and not client_crud.is_connected():
                    log_simple("Reconnecting CRUD client...", "WARNING")
                    client_crud.reconnect()
                
                if client_error_logger and not client_error_logger.is_connected():
                    log_simple("Reconnecting error logger client...", "WARNING")
                    client_error_logger.reconnect()
                    
            except KeyboardInterrupt:
                log_simple("Received shutdown signal", "INFO")
                break
            except Exception as e:
                error_msg = f"Error in main loop: {e}"
                log_simple(error_msg, "ERROR")
                send_error_log(error_msg, ERROR_TYPE_MAJOR)
                time.sleep(5)  # Wait before continuing
        
        # Send final status update
        if client_crud and client_crud.is_connected():
            status_payload = {
                "service": "AutomationLogic",
                "status": "stopping",
                "message": "Service is shutting down",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            try:
                client_crud.publish("service/status", json.dumps(status_payload))
            except:
                pass
        
    except Exception as e:
        error_msg = f"Critical error in main function: {e}"
        log_simple(error_msg, "ERROR")
        send_error_log(error_msg, ERROR_TYPE_CRITICAL)
    finally:
        # Cleanup
        log_simple("Shutting down Automation Logic Service", "INFO")
        
        if client_control:
            client_control.loop_stop()
            client_control.disconnect()
        
        if client_crud:
            client_crud.loop_stop()
            client_crud.disconnect()
        
        if client_error_logger:
            client_error_logger.loop_stop()
            client_error_logger.disconnect()

if __name__ == "__main__":
    main()