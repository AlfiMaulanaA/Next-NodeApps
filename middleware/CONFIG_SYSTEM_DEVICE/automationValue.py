import json
import time
import threading
import paho.mqtt.client as mqtt
import operator
import uuid
from datetime import datetime
import logging

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
AUTOMATION_CREATE_TOPIC = "automation_value/create"
AUTOMATION_UPDATE_TOPIC = "automation_value/update"
AUTOMATION_DELETE_TOPIC = "automation_value/delete"
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
        # Validate required fields
        required_fields = ['name', 'topic', 'config', 'relay']
        for field in required_fields:
            if field not in data:
                send_error_log("add_automation_value", f"Missing required field: {field}", "major", {"data": data})
                return False
        
        # Validate config structure
        config_fields = ['key_value', 'logic', 'value', 'auto']
        for field in config_fields:
            if field not in data['config']:
                send_error_log("add_automation_value", f"Missing config field: {field}", "major", {"data": data})
                return False
        
        # Validate relay structure
        relay_fields = ['name', 'pin', 'logic']
        for field in relay_fields:
            if field not in data['relay']:
                send_error_log("add_automation_value", f"Missing relay field: {field}", "major", {"data": data})
                return False

        items = read_json(AUTOMATION_FILE_PATH)
        if items is None:
            send_error_log("add_automation_value", "Failed to read existing automation data.", "critical")
            return False

        # Check for duplicate names
        existing_names = [item.get('name') for item in items]
        if data.get('name') in existing_names:
            send_error_log("add_automation_value", f"Automation with name '{data.get('name')}' already exists.", "warning")
            return False

        items.append(data)
        write_json(AUTOMATION_FILE_PATH, items)
        logger.info(f"Automation Added: {data.get('name', 'N/A')}")
        
        # Publish status update
        publish_automation_status("created", data.get('name'))
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
        # Subscribe to local CRUD topics after successful connection
        client.subscribe(AUTOMATION_CREATE_TOPIC, qos=QOS)
        client.subscribe(AUTOMATION_UPDATE_TOPIC, qos=QOS)
        client.subscribe(AUTOMATION_DELETE_TOPIC, qos=QOS)
        # Voice control subscriptions moved to automationVoice.py
        if DEBUG_MODE:
            logger.debug("[DEBUG] Subscribed to local CRUD topics.")
    else:
        local_broker_connected = False
        log_simple(f"Local MQTT broker connection failed (code {rc})", "ERROR")
        send_error_log("on_local_connect", f"Failed to connect to local MQTT broker, return code {rc}", "critical", {"return_code": rc})

def on_local_message(client, userdata, msg):
    if DEBUG_MODE:
        logger.debug(f"[DEBUG] Local MQTT message received on topic '{msg.topic}'")
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        success = False
        
        if msg.topic == AUTOMATION_CREATE_TOPIC:
            success = add_automation_value(payload)
            if success:
                # Re-subscribe to new device topics if needed
                subscribe_all_device_topics()
        elif msg.topic == AUTOMATION_UPDATE_TOPIC:
            success = update_automation_value(payload.get("name"), payload)
            if success:
                # Re-subscribe to device topics in case topic changed
                subscribe_all_device_topics()
        elif msg.topic == AUTOMATION_DELETE_TOPIC:
            success = delete_automation_value(payload.get("name"))
        else:
            logger.warning(f"Received unexpected message on local topic: {msg.topic}")
            send_error_log("on_local_message", f"Unexpected topic: {msg.topic}", "warning", {"topic": msg.topic})
        
        # Send response back to frontend
        if msg.topic in [AUTOMATION_CREATE_TOPIC, AUTOMATION_UPDATE_TOPIC, AUTOMATION_DELETE_TOPIC]:
            response_payload = {
                "success": success,
                "action": msg.topic.split("/")[-1],  # create/update/delete
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            if not success:
                response_payload["error"] = "Operation failed"
            
            client.publish(f"{msg.topic}/response", json.dumps(response_payload), qos=QOS)
            
    except json.JSONDecodeError as e:
        send_error_log("on_local_message", f"Invalid JSON payload on topic {msg.topic}: {e}", "minor", {"topic": msg.topic, "payload_preview": msg.payload.decode('utf-8')[:100]})
    except Exception as e:
        send_error_log("on_local_message", f"Error handling local message on topic {msg.topic}: {e}", "major", {"topic": msg.topic})

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
            # Basic validation of rule structure
            if not all(k in rule for k in ["topic", "config"]) or not isinstance(rule["config"], dict):
                logger.warning(f"Skipping malformed automation rule: {rule}")
                send_error_log("on_server_message", "Malformed automation rule skipped.", "warning", {"rule_data": rule})
                continue

            if rule.get("topic") == topic:
                # Safely access nested dictionary values
                sensor_data = json.loads(payload.get("value", "{}"))
                key = rule["config"].get("key_value")
                expected = rule["config"].get("value")
                logic = rule["config"].get("logic")
                auto = rule["config"].get("auto", False)
                actual = sensor_data.get(key)

                if actual is None:
                    if DEBUG_MODE:
                        logger.debug(f"[DEBUG] Key '{key}' not found in sensor data from {topic} for rule {rule.get('name')}")
                    send_error_log("on_server_message", f"Key '{key}' not found in sensor data.", "minor", {"rule_name": rule.get('name'), "topic": topic})
                    continue

                op = logic_ops.get(logic)
                if not op:
                    if DEBUG_MODE:
                        logger.debug(f"[DEBUG] Invalid logic operator '{logic}' for rule {rule.get('name')}")
                    send_error_log("on_server_message", f"Invalid logic operator '{logic}'.", "warning", {"rule_name": rule.get('name')})
                    continue

                # --- Type Coercion for Comparison ---
                try:
                    # Attempt to convert actual to float if expected is numeric
                    if isinstance(expected, (int, float)):
                        actual = float(actual)
                    # If expected is string, ensure actual is also string for comparison
                    elif isinstance(expected, str):
                        actual = str(actual)
                except ValueError:
                    if DEBUG_MODE:
                        logger.debug(f"[DEBUG] Type conversion failed for comparison in rule {rule.get('name')}: actual={actual} ({type(actual).__name__}), expected={expected} ({type(expected).__name__})")
                    send_error_log("on_server_message", f"Type mismatch for comparison.", "minor", {"rule_name": rule.get('name'), "actual_type": type(actual).__name__, "expected_type": type(expected).__name__})
                    continue
                except Exception as type_e:
                    send_error_log("on_server_message", f"Error during type coercion: {type_e}", "minor", {"rule_name": rule.get('name')})
                    continue
                # --- End Type Coercion ---

                current_status = op(actual, expected)
                
                # Use rule name for trigger state key
                rule_name = rule.get("name", str(uuid.uuid4())) # Ensure a fallback key
                prev_status = trigger_states.get(rule_name)

                if prev_status == current_status and prev_status is not None: # Only skip if state is truly unchanged and already known
                    if DEBUG_MODE:
                        logger.debug(f"[DEBUG] Rule '{rule_name}' state unchanged. Skipping.")
                    continue

                trigger_states[rule_name] = current_status

                relay_data = None
                if auto:
                    relay_data = 1 if current_status else 0
                elif not auto and current_status and rule.get("relay", {}).get("logic") is True:
                    # If not auto, only trigger ON if current_status is true AND relay logic is explicitly true
                    relay_data = 1
                elif not auto and not current_status and rule.get("relay", {}).get("logic") is False:
                     # If not auto, only trigger OFF if current_status is false AND relay logic is explicitly false
                     relay_data = 0
                else:
                    if DEBUG_MODE:
                        logger.debug(f"[DEBUG] Automation rule '{rule_name}' not triggered (auto={auto}, current_status={current_status}, relay_logic={rule.get('relay', {}).get('logic')})")
                    continue # Skip if no relay_data determined

                if relay_data is not None:
                    logger.info(f"Automation Triggered: {rule_name}. Setting relay to {relay_data}")

                    relay = rule.get("relay", {})
                    if not all(k in relay for k in ["pin", "address", "bus"]):
                        logger.warning(f"Skipping relay command due to missing info in rule {rule_name}: {relay}")
                        send_error_log("on_server_message", "Missing relay configuration info.", "warning", {"rule_name": rule_name, "relay_config": relay})
                        continue

                    relay_payload = {
                        "mac": MAC_ADDRESS,
                        "protocol_type": "Modular",
                        "device": "RELAYMINI", # Assuming this is fixed for modular relays
                        "function": "write",
                        "value": {
                            "pin": relay.get("pin"),
                            "data": relay_data
                        },
                        "address": relay.get("address"),
                        "device_bus": relay.get("bus"),
                        "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    if mqtt_server and mqtt_server.is_connected():
                        mqtt_server.publish(RELAY_COMMAND_TOPIC, json.dumps(relay_payload), qos=QOS)
                        if DEBUG_MODE:
                            logger.debug(f"[DEBUG] Published relay command: {relay_payload}")
                    else:
                        logger.warning("Server MQTT client not connected, unable to publish relay command.")
                        send_error_log("on_server_message", "Server MQTT client not connected, failed to publish relay command.", "warning", {"relay_payload": relay_payload})

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
            topics = {item.get("topic") for item in automation if item.get("topic")}
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