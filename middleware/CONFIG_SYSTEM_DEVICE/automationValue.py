import json
import time
import threading
import paho.mqtt.client as mqtt
import operator
import uuid
from datetime import datetime
import logging
import requests

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("AutomationValueService")

# --- Startup Banner ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("===== Automation Value Only =====")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("===== Automation Value Only =====")
    print("Success To Running")
    print("")

def print_broker_status(local_status=False, server_status=False):
    """Print MQTT broker connection status"""
    if local_status:
        print("MQTT Broker Local is Running")
    else:
        print("MQTT Broker Local connection failed")
    
    if server_status:
        print("MQTT Broker Server is Running")
    else:
        print("MQTT Broker Server connection failed")
    
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

# --- GLOBAL CONFIGURATION ---
DEBUG_MODE = True # Set to False to disable most debug prints from console, but errors will still be logged via MQTT.
RECONNECT_INTERVAL = 5 # Seconds between reconnection attempts
HEARTBEAT_INTERVAL = 30 # Seconds between heartbeat messages

# File Paths
MODBUS_FILE_PATH = "../MODBUS_SNMP/JSON/Config/installed_devices.json"
MODULAR_FILE_PATH = "../MODULAR_I2C/JSON/Config/installed_devices.json"
AUTOMATION_FILE_PATH = "./JSON/automationValueConfig.json"
MQTT_CONFIG_PATH = "../MODBUS_SNMP/JSON/Config/mqtt_config.json"
WHATSAPP_CONFIG_PATH = "./whatsapp_config.json"
# VOICE_CONTROL_PATH moved to automationVoice.py

# MQTT Local Broker Configuration
LOCAL_BROKER = "localhost"
LOCAL_PORT = 1883
QOS = 1

# MQTT Server Broker Configuration (loaded from file)
SERVER_BROKER = "localhost" # Default fallback
SERVER_PORT = 1883 # Default fallback

# --- Connection Status Tracking ---
local_broker_connected = False
server_broker_connected = False

try:
    with open(MQTT_CONFIG_PATH, "r") as f:
        mqtt_server_config = json.load(f)
    SERVER_BROKER = mqtt_server_config.get("broker_address", SERVER_BROKER)
    SERVER_PORT = mqtt_server_config.get("broker_port", SERVER_PORT)
except FileNotFoundError:
    logger.error(f"MQTT config file not found at {MQTT_CONFIG_PATH}. Using default server broker settings.")
    # No send_error_log here, as error logger client might not be initialized yet.
except json.JSONDecodeError:
    logger.error(f"Invalid JSON in MQTT config file at {MQTT_CONFIG_PATH}. Using default server broker settings.")
except Exception as e:
    logger.error(f"Unexpected error loading MQTT config from {MQTT_CONFIG_PATH}: {e}. Using default server broker settings.")

# MQTT Topic Definitions (Local Broker)
MODBUS_TOPIC = "modbus_value/data"
MODULAR_TOPIC = "modular_value/data"
AUTOMATION_TOPIC = "automation_value/data"
# Simplified Topics (like AutomationLogic)
AUTOMATION_COMMAND_TOPIC = "command_control_value"
AUTOMATION_RESPONSE_TOPIC = "response_control_value"
AUTOMATION_STATUS_TOPIC = "automation_value/status"
HEARTBEAT_TOPIC = "automation_value/heartbeat"
# Voice control topics moved to automationVoice.py

# MQTT Topic Definitions (Other)
RELAY_COMMAND_TOPIC = "modular"
MQTT_BROKER_SERVER_TOPIC = "mqtt_broker_server"
ERROR_LOG_TOPIC = "subrack/error/log" # Topic for centralized error logging

# --- GLOBAL STATE / HELPERS ---
trigger_states = {} # Stores previous trigger states for automation rules

# Operator mapping for comparisons
logic_ops = {
    ">": operator.gt,
    "<": operator.lt,
    ">=": operator.ge,
    "<=": operator.le,
    "==": operator.eq,
    "!=": operator.ne,
    "more_than": operator.gt,
    "less_than": operator.lt
}

# Get MAC address
MAC_ADDRESS = ":".join([f"{(uuid.getnode() >> i) & 0xff:02x}" for i in range(0, 8*6, 8)][::-1])

# --- DEDICATED ERROR LOGGING CLIENT ---
error_logger_client = None
ERROR_LOGGER_CLIENT_ID = f'automation-error-logger-{uuid.uuid4()}'

def on_error_logger_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to dedicated Error Log MQTT Broker (localhost).")
    else:
        logger.error(f"Failed to connect dedicated Error Log MQTT Broker, return code: {rc}")

def on_error_logger_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning(f"Unexpected disconnect from Error Log broker with code {rc}. Attempting reconnect...")
    else:
        logger.info("Error Log client disconnected normally.")

def initialize_error_logger():
    """Initializes and connects the dedicated error logging MQTT client."""
    global error_logger_client
    try:
        error_logger_client = mqtt.Client(ERROR_LOGGER_CLIENT_ID)
        error_logger_client.on_connect = on_error_logger_connect
        error_logger_client.on_disconnect = on_error_logger_disconnect
        error_logger_client.reconnect_delay_set(min_delay=1, max_delay=120) # Add reconnect delay
        error_logger_client.connect(LOCAL_BROKER, LOCAL_PORT, keepalive=60)
        error_logger_client.loop_start()
        logger.info(f"Dedicated error logger client initialized and started loop to {LOCAL_BROKER}:{LOCAL_PORT}")
    except Exception as e:
        logger.critical(f"FATAL: Failed to initialize dedicated error logger: {e}", exc_info=True)
        # Cannot send error log if the logger itself fails to initialize

def send_error_log(function_name, error_detail, error_type, additional_info=None):
    """
    Sends an error message to the centralized error log service via MQTT.
    Uses the dedicated error_logger_client.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    error_payload = {
        "data": f"[{function_name}] {error_detail}",
        "type": error_type.upper(),
        "source": "AutomationValueService",
        "Timestamp": timestamp
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
    logger.error(f"[{function_name}] ({error_type}): {error_detail}")

# --- JSON HELPERS ---
def read_json(file_path):
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(f"File not found: {file_path}. Returning empty list.")
        send_error_log("read_json", f"File not found: {file_path}", "warning", {"file_path": file_path})
        return []
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {file_path}: {e}. Returning empty list.")
        send_error_log("read_json", f"Invalid JSON in {file_path}: {e}", "critical", {"file_path": file_path})
        return []
    except Exception as e:
        logger.error(f"Read error {file_path}: {e}. Returning None.")
        send_error_log("read_json", f"Unexpected error reading {file_path}: {e}", "critical", {"file_path": file_path})
        return None

def write_json(file_path, data):
    try:
        with open(file_path, "w") as f:
            json.dump(data, f, indent=4)
        if DEBUG_MODE:
            logger.debug(f"Data written to {file_path}")
    except Exception as e:
        logger.error(f"Write error {file_path}: {e}")
        send_error_log("write_json", f"Failed to write to {file_path}: {e}", "major", {"file_path": file_path})

# --- MQTT BROKER INFO PUBLISHER ---
def publish_mqtt_broker_info():
    try:
        config = read_json(MQTT_CONFIG_PATH)
        if config:
            payload = {
                "broker_address": config.get("broker_address"),
                "broker_port": config.get("broker_port"),
                "username": config.get("username"),
                "password": config.get("password"),
                "mac_address": MAC_ADDRESS,
                "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            # Use mqtt_local client for publishing broker info to local topic
            if mqtt_local and mqtt_local.is_connected():
                mqtt_local.publish(MQTT_BROKER_SERVER_TOPIC, json.dumps(payload), qos=QOS)
                if DEBUG_MODE:
                    logger.debug(f"Published broker info to {MQTT_BROKER_SERVER_TOPIC}")
            else:
                logger.warning(f"Local MQTT client not connected, unable to publish broker info to {MQTT_BROKER_SERVER_TOPIC}.")
                send_error_log("publish_mqtt_broker_info", "Local MQTT client not connected.", "warning", {"topic": MQTT_BROKER_SERVER_TOPIC})
        else:
            if DEBUG_MODE:
                logger.debug(f"MQTT config not found for broker info at {MQTT_CONFIG_PATH}.")
            send_error_log("publish_mqtt_broker_info", f"MQTT config not found for broker info at {MQTT_CONFIG_PATH}.", "warning", {"file_path": MQTT_CONFIG_PATH})
    except Exception as e:
        send_error_log("publish_mqtt_broker_info", f"Error publishing broker info: {e}", "major")

def publish_mqtt_broker_info_loop():
    while True:
        publish_mqtt_broker_info()
        time.sleep(5) # Publish every 5 seconds

# --- VOICE CONTROL FUNCTIONS MOVED TO automationVoice.py ---

# --- CRUD FUNCTIONS: AUTOMATION VALUES ---
def add_automation_value(data):
    try:
        # Validate required fields - support both old and new structure
        if 'name' in data and 'topic' in data and 'config' in data:
            # Legacy structure - convert to new structure
            rule_name = data.get('name', f"Rule-{uuid.uuid4()}")
            new_data = {
                "id": str(uuid.uuid4()),
                "rule_name": rule_name,
                "description": f"Legacy rule: {rule_name}",
                "group_rule_name": "Legacy Rules",
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "trigger_groups": [
                    {
                        "group_name": f"{rule_name} Group",
                        "group_operator": "AND",
                        "triggers": [
                            {
                                "device_name": f"Device-{rule_name}",
                                "device_mac": MAC_ADDRESS,
                                "device_address": 1,
                                "device_bus": 0,
                                "trigger_type": "drycontact",
                                "pin_number": 1,
                                "condition_operator": "is",
                                "target_value": True,
                                "expected_value": True,
                                "delay_on": 0,
                                "delay_off": 0
                            }
                        ]
                    }
                ],
                "actions": [
                    {
                        "action_type": "control_relay",
                        "target_device": data.get('relay', {}).get('name', 'Unknown'),
                        "target_mac": MAC_ADDRESS,
                        "target_address": data.get('relay', {}).get('address', 1),
                        "target_bus": data.get('relay', {}).get('bus', 0),
                        "relay_pin": data.get('relay', {}).get('pin', 1),
                        "target_value": data.get('relay', {}).get('logic', True),
                        "description": f"Control relay for {rule_name}"
                    }
                ],
                # Keep legacy fields for backward compatibility
                "name": data.get('name'),
                "topic": data.get('topic'),
                "config": data.get('config'),
                "relay": data.get('relay')
            }
            data = new_data
        else:
            # New structure - validate required fields
            required_fields = ['rule_name', 'trigger_groups', 'actions']
            for field in required_fields:
                if field not in data:
                    send_error_log("add_automation_value", f"Missing required field: {field}", "major", {"data": data})
                    return False

        items = read_json(AUTOMATION_FILE_PATH)
        if items is None:
            send_error_log("add_automation_value", "Failed to read existing automation data.", "critical")
            return False

        # Check for duplicate rule names
        existing_names = [item.get('rule_name') or item.get('name') for item in items]
        rule_name = data.get('rule_name') or data.get('name', '')
        if rule_name in existing_names:
            send_error_log("add_automation_value", f"Automation with name '{rule_name}' already exists.", "warning")
            return False

        # Generate ID if not provided
        if 'id' not in data:
            data['id'] = str(uuid.uuid4())

        # Set created_at if not provided
        if 'created_at' not in data:
            data['created_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        items.append(data)
        write_json(AUTOMATION_FILE_PATH, items)
        logger.info(f"Automation Added: {rule_name}")

        # Publish status update
        publish_automation_status("created", rule_name)
        return True
    except Exception as e:
        send_error_log("add_automation_value", f"Failed to add automation value: {e}", "major", {"data": data})
        return False

def update_automation_value(name, new_data):
    try:
        items = read_json(AUTOMATION_FILE_PATH)
        if items is None:
            send_error_log("update_automation_value", "Failed to read existing automation data.", "critical")
            return False

        found = False
        for item in items:
            if item.get("name") == name:
                # Preserve the original name
                original_name = item.get("name")
                item.update(new_data)
                item["name"] = original_name  # Ensure name doesn't change
                
                write_json(AUTOMATION_FILE_PATH, items)
                logger.info(f"Automation Updated: {name}")
                
                # Publish status update
                publish_automation_status("updated", name)
                found = True
                break
        
        if not found:
            logger.warning(f"Automation Not Found for update: {name}")
            send_error_log("update_automation_value", f"Automation not found for update.", "warning", {"name": name, "new_data": new_data})
            return False
        
        return True
    except Exception as e:
        send_error_log("update_automation_value", f"Failed to update automation value: {e}", "major", {"name": name, "new_data": new_data})
        return False

def delete_automation_value(name):
    try:
        items = read_json(AUTOMATION_FILE_PATH)
        if items is None:
            send_error_log("delete_automation_value", "Failed to read existing automation data.", "critical")
            return False

        new_items = [i for i in items if i.get("name") != name]
        if len(new_items) != len(items):
            write_json(AUTOMATION_FILE_PATH, new_items)
            logger.info(f"Automation Deleted: {name}")
            
            # Clean up trigger state
            if name in trigger_states:
                del trigger_states[name]
            
            # Publish status update
            publish_automation_status("deleted", name)
            return True
        else:
            logger.warning(f"Automation Not Found for delete: {name}")
            send_error_log("delete_automation_value", f"Automation not found for delete.", "warning", {"name": name})
            return False
    except Exception as e:
        send_error_log("delete_automation_value", f"Failed to delete automation value: {e}", "major", {"name": name})
        return False

# --- MQTT CLIENTS ---
mqtt_local = mqtt.Client(client_id=f"automation-local-{uuid.uuid4()}")
mqtt_server = mqtt.Client(client_id=f"automation-server-{uuid.uuid4()}")

# --- MQTT LOCAL CLIENT CALLBACKS ---
def on_local_connect(client, userdata, flags, rc):
    global local_broker_connected
    if rc == 0:
        local_broker_connected = True
        log_simple("Local MQTT broker connected", "SUCCESS")
        # Subscribe to simplified command topic
        client.subscribe(AUTOMATION_COMMAND_TOPIC, qos=QOS)
        if DEBUG_MODE:
            logger.debug(f"[DEBUG] Subscribed to simplified command topic: {AUTOMATION_COMMAND_TOPIC}")
    else:
        local_broker_connected = False
        log_simple(f"Local MQTT broker connection failed (code {rc})", "ERROR")
        send_error_log("on_local_connect", f"Failed to connect to local MQTT broker, return code {rc}", "critical", {"return_code": rc})

def on_local_message(client, userdata, msg):
    if DEBUG_MODE:
        logger.debug(f"[DEBUG] Local MQTT message received on topic '{msg.topic}'")
    try:
        topic = msg.topic
        payload = msg.payload.decode("utf-8")

        if topic == AUTOMATION_COMMAND_TOPIC:
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
        else:
            logger.warning(f"Received unexpected message on local topic: {topic}")
            send_error_log("on_local_message", f"Unexpected topic: {topic}", "warning", {"topic": topic})

    except json.JSONDecodeError as e:
        send_error_log("on_local_message", f"Invalid JSON payload on topic {msg.topic}: {e}", "minor", {"topic": msg.topic, "payload_preview": msg.payload.decode('utf-8')[:100]})
    except Exception as e:
        send_error_log("on_local_message", f"Error handling local message on topic {msg.topic}: {e}", "major", {"topic": msg.topic})

# --- CRUD Request Handlers ---
def handle_get_request(client):
    """Handle get data request"""
    try:
        response = {
            "status": "success",
            "data": read_json(AUTOMATION_FILE_PATH) or [],
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(AUTOMATION_RESPONSE_TOPIC, json.dumps(response))
        log_simple("Configuration data sent to client", "SUCCESS")
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(AUTOMATION_RESPONSE_TOPIC, json.dumps(error_response))
        log_simple(f"Error sending config data: {e}", "ERROR")

def handle_crud_request(client, action, message_data):
    """Handle CRUD operations"""
    try:
        data = message_data.get('data', {})

        success = False
        message = ""

        if action == "add":
            success, message = create_automation_rule(data)
        elif action == "set":
            success, message = update_automation_rule(data)
        elif action == "delete":
            success, message = delete_automation_rule(data.get('id') or data.get('name'))
        else:
            message = f"Unknown action: {action}"

        # Send response
        response = {
            "status": "success" if success else "error",
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(AUTOMATION_RESPONSE_TOPIC, json.dumps(response))

    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(AUTOMATION_RESPONSE_TOPIC, json.dumps(error_response))
        log_simple(f"Error handling CRUD request: {e}", "ERROR")

def create_automation_rule(rule_data):
    """Create new automation rule"""
    try:
        success = add_automation_value(rule_data)
        if success:
            return True, f"Automation rule '{rule_data.get('rule_name', rule_data.get('name', 'Unknown'))}' created successfully"
        else:
            return False, "Failed to create automation rule"
    except Exception as e:
        log_simple(f"Error creating automation rule: {e}", "ERROR")
        send_error_log(f"Automation rule creation error: {e}", "major")
        return False, str(e)

def update_automation_rule(rule_data):
    """Update existing automation rule"""
    try:
        rule_id = rule_data.get('id') or rule_data.get('name')
        if not rule_id:
            return False, "Rule ID or name is required for update"

        success = update_automation_value(rule_id, rule_data)
        if success:
            return True, f"Automation rule '{rule_id}' updated successfully"
        else:
            return False, f"Automation rule '{rule_id}' not found"
    except Exception as e:
        log_simple(f"Error updating automation rule: {e}", "ERROR")
        send_error_log(f"Automation rule update error: {e}", "major")
        return False, str(e)

def delete_automation_rule(rule_id):
    """Delete automation rule"""
    try:
        if not rule_id:
            return False, "Rule ID or name is required for deletion"

        success = delete_automation_value(rule_id)
        if success:
            return True, "Automation rule deleted successfully"
        else:
            return False, f"Automation rule '{rule_id}' not found"
    except Exception as e:
        log_simple(f"Error deleting automation rule: {e}", "ERROR")
        send_error_log(f"Automation rule deletion error: {e}", "major")
        return False, str(e)

# --- MQTT SERVER CLIENT CALLBACKS ---
def on_server_connect(client, userdata, flags, rc):
    global server_broker_connected
    if rc == 0:
        server_broker_connected = True
        log_simple("Server MQTT broker connected", "SUCCESS")
        subscribe_all_device_topics() # Subscribe after connection
    else:
        server_broker_connected = False
        log_simple(f"Server MQTT broker connection failed (code {rc})", "ERROR")
        send_error_log("on_server_connect", f"Failed to connect to server MQTT broker, return code {rc}", "critical", {"return_code": rc, "broker": SERVER_BROKER, "port": SERVER_PORT})

def evaluate_trigger_groups(trigger_groups, sensor_data):
    """Evaluate trigger groups and return overall trigger status"""
    if not trigger_groups:
        return False

    group_results = []

    for group in trigger_groups:
        trigger_results = []

        for trigger in group.get("triggers", []):
            # For value-based automation, we evaluate sensor data against trigger conditions
            key = trigger.get("device_name", "").lower()  # Use device_name as key for simplicity
            expected = trigger.get("target_value")
            condition = trigger.get("condition_operator", "is")

            actual = sensor_data.get(key)

            if actual is None:
                if DEBUG_MODE:
                    logger.debug(f"[DEBUG] Key '{key}' not found in sensor data")
                continue

            # Evaluate condition with proper type coercion
            try:
                # Type coercion for comparison
                if isinstance(expected, (int, float)):
                    actual = float(actual)
                elif isinstance(expected, str):
                    actual = str(actual)

                # Use logic operators mapping
                op = logic_ops.get(condition)
                if op:
                    result = op(actual, expected)
                else:
                    # Fallback to simple comparisons
                    if condition == "is":
                        result = actual == expected
                    elif condition == "more_than" or condition == ">":
                        result = float(actual) > float(expected) if actual and expected else False
                    elif condition == "less_than" or condition == "<":
                        result = float(actual) < float(expected) if actual and expected else False
                    elif condition == ">=":
                        result = float(actual) >= float(expected) if actual and expected else False
                    elif condition == "<=":
                        result = float(actual) <= float(expected) if actual and expected else False
                    elif condition == "==":
                        result = actual == expected
                    elif condition == "!=":
                        result = actual != expected
                    else:
                        result = False

                trigger_results.append(result)

            except (ValueError, TypeError) as e:
                if DEBUG_MODE:
                    logger.debug(f"[DEBUG] Type conversion failed for trigger evaluation: {e}")
                trigger_results.append(False)

        # Evaluate group logic (AND/OR)
        group_operator = group.get("group_operator", "AND")
        if group_operator == "AND":
            group_result = all(trigger_results) if trigger_results else False
        else:  # OR
            group_result = any(trigger_results) if trigger_results else False

        group_results.append(group_result)

    # Overall result (OR between groups for now)
    return any(group_results)

def execute_actions(actions, rule):
    """Execute all actions for a triggered rule"""
    for action in actions:
        action_type = action.get("action_type")

        if action_type == "control_relay":
            # Execute relay control
            relay_payload = {
                "mac": MAC_ADDRESS,
                "protocol_type": "Modular",
                "device": "RELAYMINI",
                "function": "write",
                "value": {
                    "pin": action.get("relay_pin", 1),
                    "data": action.get("target_value", True)
                },
                "address": action.get("target_address", 1),
                "device_bus": action.get("target_bus", 0),
                "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

            if mqtt_server and mqtt_server.is_connected():
                mqtt_server.publish(RELAY_COMMAND_TOPIC, json.dumps(relay_payload), qos=QOS)
                logger.info(f"Relay action executed: {action.get('description', 'Control relay')}")
                if DEBUG_MODE:
                    logger.debug(f"[DEBUG] Published relay command: {relay_payload}")
            else:
                logger.warning("Server MQTT client not connected, unable to execute relay action.")
                send_error_log("execute_actions", "Server MQTT client not connected for relay action.", "warning")

        elif action_type == "send_message":
            # Execute message action (WhatsApp)
            execute_send_message(action, rule)

def on_server_message(client, userdata, msg):
    if DEBUG_MODE:
        logger.debug(f"[DEBUG] Server MQTT message received on topic '{msg.topic}'")
    try:
        # It's safer to load payload only once
        payload = json.loads(msg.payload.decode("utf-8"))
        topic = msg.topic
        automation_values = read_json(AUTOMATION_FILE_PATH)

        if automation_values is None: # Handle case where read_json failed
            send_error_log("on_server_message", "Failed to read automation rules from file.", "critical")
            return

        for rule in automation_values:
            rule_name = rule.get('rule_name') or rule.get('name', str(uuid.uuid4()))

            # Check if rule has legacy structure (simple sensor monitoring)
            if rule.get("topic") and rule.get("config"):
                # Legacy structure - handle simple sensor monitoring
                if rule.get("topic") == topic:
                    sensor_data = json.loads(payload.get("value", "{}"))
                    key = rule["config"].get("key_value")
                    expected = rule["config"].get("value")
                    logic = rule["config"].get("logic")
                    auto = rule["config"].get("auto", False)
                    actual = sensor_data.get(key)

                    if actual is None:
                        if DEBUG_MODE:
                            logger.debug(f"[DEBUG] Key '{key}' not found in sensor data from {topic} for rule {rule_name}")
                        continue

                    op = logic_ops.get(logic)
                    if not op:
                        if DEBUG_MODE:
                            logger.debug(f"[DEBUG] Invalid logic operator '{logic}' for rule {rule_name}")
                        continue

                    # Type coercion
                    try:
                        if isinstance(expected, (int, float)):
                            actual = float(actual)
                        elif isinstance(expected, str):
                            actual = str(actual)
                    except (ValueError, TypeError):
                        continue

                    current_status = op(actual, expected)
                    prev_status = trigger_states.get(rule_name)

                    if prev_status == current_status and prev_status is not None:
                        continue

                    trigger_states[rule_name] = current_status

                    # Execute legacy relay action
                    if auto and current_status:
                        relay = rule.get("relay", {})
                        relay_payload = {
                            "mac": MAC_ADDRESS,
                            "protocol_type": "Modular",
                            "device": "RELAYMINI",
                            "function": "write",
                            "value": {
                                "pin": relay.get("pin", 1),
                                "data": 1 if current_status else 0
                            },
                            "address": relay.get("address", 1),
                            "device_bus": relay.get("bus", 0),
                            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }

                        if mqtt_server and mqtt_server.is_connected():
                            mqtt_server.publish(RELAY_COMMAND_TOPIC, json.dumps(relay_payload), qos=QOS)
                            logger.info(f"Legacy automation triggered: {rule_name}")
                        else:
                            logger.warning("Server MQTT client not connected for legacy automation.")

            # Check if rule has new structure (trigger_groups and actions)
            elif rule.get("trigger_groups") and rule.get("actions"):
                # New structure - evaluate trigger groups
                sensor_data = json.loads(payload.get("value", "{}"))
                trigger_result = evaluate_trigger_groups(rule["trigger_groups"], sensor_data)

                if trigger_result:
                    logger.info(f"Automation rule triggered: {rule_name}")
                    execute_actions(rule["actions"], rule)
                else:
                    if DEBUG_MODE:
                        logger.debug(f"[DEBUG] Rule '{rule_name}' conditions not met")

    except json.JSONDecodeError as e:
        send_error_log("on_server_message", f"Invalid JSON payload on server topic {msg.topic}: {e}", "minor", {"topic": msg.topic, "payload_preview": msg.payload.decode('utf-8')[:100]})
    except Exception as e:
        send_error_log("on_server_message", f"Unhandled error processing server MQTT message on topic {msg.topic}: {e}", "major", {"topic": msg.topic})

# Subscribe All Device Topics for Server Client
def subscribe_all_device_topics():
    try:
        automation = read_json(AUTOMATION_FILE_PATH)
        if automation is None: # Handle case where read_json failed
            send_error_log("subscribe_all_device_topics", "Failed to read automation rules for subscription.", "critical")
            return

        if automation:
            topics = set()

            for rule in automation:
                # Legacy structure - get topic directly
                if rule.get("topic"):
                    topics.add(rule["topic"])

                # New structure - extract topics from trigger_groups
                elif rule.get("trigger_groups"):
                    for group in rule["trigger_groups"]:
                        for trigger in group.get("triggers", []):
                            # For now, we'll create topic patterns based on device names
                            # This can be enhanced to use actual topic mappings
                            device_name = trigger.get("device_name", "").lower()
                            if device_name:
                                # Create topic pattern (this should match actual sensor topics)
                                topic_pattern = f"modbus/sensor/{device_name}"
                                topics.add(topic_pattern)

            for topic in topics:
                if mqtt_server and mqtt_server.is_connected():
                    mqtt_server.subscribe(topic, qos=QOS)
                    logger.info(f"Subscribed to {topic} on server broker")
                else:
                    logger.warning(f"Server MQTT client not connected, unable to subscribe to {topic}.")
                    send_error_log("subscribe_all_device_topics", f"Server MQTT client not connected, unable to subscribe to {topic}.", "warning", {"topic": topic})
        else:
            if DEBUG_MODE:
                logger.debug("[DEBUG] No automation rules found to subscribe to server topics.")
    except Exception as e:
        send_error_log("subscribe_all_device_topics", f"Error during subscription: {e}", "major")

# --- STATUS PUBLISHER ---
def publish_automation_status(action, name):
    """Publish automation status updates"""
    try:
        status_payload = {
            "action": action,
            "name": name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "service": "AutomationValueService"
        }
        
        if mqtt_local and mqtt_local.is_connected():
            mqtt_local.publish(AUTOMATION_STATUS_TOPIC, json.dumps(status_payload), qos=QOS)
            if DEBUG_MODE:
                logger.debug(f"[DEBUG] Published status: {action} for {name}")
    except Exception as e:
        send_error_log("publish_automation_status", f"Failed to publish status: {e}", "minor")

# --- HEARTBEAT PUBLISHER ---
def publish_heartbeat():
    """Publish service heartbeat"""
    try:
        heartbeat_payload = {
            "service": "AutomationValueService",
            "status": "running",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "automation_count": len(read_json(AUTOMATION_FILE_PATH) or []),
            "trigger_states_count": len(trigger_states),
            "local_connected": local_broker_connected,
            "server_connected": server_broker_connected
        }
        
        if mqtt_local and mqtt_local.is_connected():
            mqtt_local.publish(HEARTBEAT_TOPIC, json.dumps(heartbeat_payload), qos=QOS)
            if DEBUG_MODE:
                logger.debug(f"[DEBUG] Published heartbeat")
    except Exception as e:
        send_error_log("publish_heartbeat", f"Failed to publish heartbeat: {e}", "minor")

# --- PUBLISHER THREAD FUNCTIONS ---
def run_publisher_loop(file_path, mqtt_topic, client_instance, service_name):
    last_publish_time = 0
    publish_interval = 2  # Seconds between publishes
    
    while True:
        try:
            current_time = time.time()
            
            # Only publish at specified intervals to reduce load
            if current_time - last_publish_time >= publish_interval:
                values = read_json(file_path)
                if values is None: # Handle critical read error
                    logger.error(f"Skipping publication for {mqtt_topic} due to read error.")
                    time.sleep(5) # Wait longer if there's a file read issue
                    continue

                if values:
                    if client_instance and client_instance.is_connected():
                        payload = json.dumps(values)
                        client_instance.publish(mqtt_topic, payload, qos=QOS)
                        if DEBUG_MODE:
                            logger.debug(f"[DEBUG] Published {service_name}/data. Items count: {len(values)}")
                        last_publish_time = current_time
                    else:
                        logger.warning(f"{service_name} MQTT client not connected, unable to publish to {mqtt_topic}.")
                        send_error_log(f"run_publisher_loop ({service_name})", f"MQTT client disconnected, unable to publish.", "warning", {"topic": mqtt_topic})
                else:
                    if DEBUG_MODE:
                        logger.debug(f"[DEBUG] No {service_name} items to publish.")
                    last_publish_time = current_time
            
        except Exception as e:
            send_error_log(f"run_publisher_loop ({service_name})", f"Error in publisher loop: {e}", "major", {"topic": mqtt_topic})
        
        time.sleep(0.5) # Reduced sleep time for better responsiveness

# --- HEARTBEAT LOOP ---
def run_heartbeat_loop():
    while True:
        try:
            publish_heartbeat()
            time.sleep(HEARTBEAT_INTERVAL)
        except Exception as e:
            send_error_log("run_heartbeat_loop", f"Error in heartbeat loop: {e}", "minor")

# --- WHATSAPP CONFIGURATION ---
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
        with open(WHATSAPP_CONFIG_PATH, 'r') as file:
            content = file.read().strip()
            if not content:
                log_simple("WhatsApp config file is empty. Using defaults.", "WARNING")
                return default_config["whatsapp"]
            config = json.load(file)
            return config.get("whatsapp", default_config["whatsapp"])
    except FileNotFoundError:
        log_simple(f"WhatsApp config file not found: {WHATSAPP_CONFIG_PATH}. Using defaults.", "WARNING")
        return default_config["whatsapp"]
    except json.JSONDecodeError as e:
        log_simple(f"Error decoding WhatsApp config: {e}. Using defaults.", "WARNING")
        return default_config["whatsapp"]
    except Exception as e:
        log_simple(f"Unexpected error loading WhatsApp config: {e}. Using defaults.", "WARNING")
        return default_config["whatsapp"]

# --- WHATSAPP MESSAGING ---
def execute_whatsapp_message(action, rule):
    """Execute WhatsApp message action using Qontak API"""
    try:
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
            send_error_log(f"WhatsApp API error: {response.status_code}", "minor")

    except ImportError:
        log_simple("Requests library not available for WhatsApp API", "ERROR")
        send_error_log("Requests library missing for WhatsApp", "major")
    except Exception as e:
        log_simple(f"Error executing WhatsApp message: {e}", "ERROR")
        send_error_log(f"WhatsApp message execution error: {e}", "minor")

def execute_send_message(action, rule):
    """Execute send message action (WhatsApp only)"""
    try:
        # Always use WhatsApp for send_message actions
        execute_whatsapp_message(action, rule)

    except Exception as e:
        log_simple(f"Error executing send message: {e}", "ERROR")
        send_error_log(f"Send message execution error: {e}", "minor")

# --- MAIN EXECUTION BLOCK ---
def main():
    global local_broker_connected, server_broker_connected
    
    # Print startup banner
    print_startup_banner()
    
    # Initialize the dedicated error logger first
    log_simple("Initializing error logger...")
    initialize_error_logger()

    # Setup local MQTT client
    log_simple("Connecting to Local MQTT broker...")
    mqtt_local.on_connect = on_local_connect
    mqtt_local.on_message = on_local_message
    mqtt_local.reconnect_delay_set(min_delay=1, max_delay=120)
    try:
        mqtt_local.connect(LOCAL_BROKER, LOCAL_PORT, 60)
        mqtt_local.loop_start()
    except Exception as e:
        log_simple("Failed to connect to Local MQTT client", "ERROR")
        send_error_log("main", f"Failed to connect or start local MQTT client: {e}", "critical")

    # Setup server MQTT client
    log_simple("Connecting to Server MQTT broker...")
    mqtt_server.on_connect = on_server_connect
    mqtt_server.on_message = on_server_message
    mqtt_server.reconnect_delay_set(min_delay=1, max_delay=120)
    try:
        mqtt_server.connect(SERVER_BROKER, SERVER_PORT, 60)
        mqtt_server.loop_start()
    except Exception as e:
        log_simple("Failed to connect to Server MQTT client", "ERROR")
        send_error_log("main", f"Failed to connect or start server MQTT client: {e}", "critical")

    # Wait a moment for connections to establish
    time.sleep(2)
    
    # Print success banner and broker status
    print_success_banner()
    print_broker_status(local_broker_connected, server_broker_connected)

    # Start publisher threads
    log_simple("Starting publisher threads...")
    threads = [
        threading.Thread(target=publish_mqtt_broker_info_loop, daemon=True),
        threading.Thread(target=run_publisher_loop, args=(AUTOMATION_FILE_PATH, AUTOMATION_TOPIC, mqtt_local, "automation"), daemon=True),
        threading.Thread(target=run_publisher_loop, args=(MODBUS_FILE_PATH, MODBUS_TOPIC, mqtt_local, "modbus"), daemon=True),
        threading.Thread(target=run_publisher_loop, args=(MODULAR_FILE_PATH, MODULAR_TOPIC, mqtt_local, "modular"), daemon=True),
        threading.Thread(target=run_heartbeat_loop, daemon=True),
        # Voice control publisher thread moved to automationVoice.py
    ]

    for t in threads:
        t.start()
    
    log_simple("All publisher threads started successfully", "SUCCESS")

    # Keep main thread alive
    try:
        while True:
            # Periodically check if error logger client is still connected and attempt reconnect if not
            if error_logger_client and not error_logger_client.is_connected():
                logger.warning("Error logger MQTT client disconnected. Attempting reconnect.")
                try:
                    error_logger_client.reconnect()
                except Exception as e:
                    logger.error(f"Failed to reconnect error logger client: {e}")

            time.sleep(1)
    except KeyboardInterrupt:
        log_simple("Automation Value service stopped by user", "WARNING")
    except Exception as e:
        log_simple(f"Critical error: {e}", "ERROR")
        send_error_log("main (main_loop)", f"Unhandled critical exception in main loop: {e}", "critical")
    finally:
        log_simple("Shutting down services...")
        # Disconnect clients gracefully
        if mqtt_local:
            mqtt_local.loop_stop()
            mqtt_local.disconnect()
        if mqtt_server:
            mqtt_server.loop_stop()
            mqtt_server.disconnect()
        if error_logger_client:
            error_logger_client.loop_stop()
            error_logger_client.disconnect()
        log_simple("Application terminated", "SUCCESS")

if __name__ == "__main__":
    main()
