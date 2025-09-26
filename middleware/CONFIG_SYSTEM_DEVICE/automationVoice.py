import json
import time
import threading
import paho.mqtt.client as mqtt
import uuid
from datetime import datetime
import logging

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("AutomationVoiceService")

# --- Startup Banner ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("======= Automation Voice =======")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("======= Automation Voice =======")
    print("Success To Running")
    print("")

def print_broker_status(local_status=False):
    """Print MQTT broker connection status"""
    if local_status:
        print("MQTT Broker Local is Running")
    else:
        print("MQTT Broker Local connection failed")
    
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
DEBUG_MODE = True # Set to False to disable most debug prints from console

# File Paths
VOICE_CONTROL_PATH = "./JSON/automationVoiceConfig.json"

# MQTT Local Broker Configuration
LOCAL_BROKER = "localhost"
LOCAL_PORT = 1883
QOS = 1

# --- Connection Status Tracking ---
local_broker_connected = False

# MQTT Topic Definitions (Local Broker)
VOICE_CONTROL_TOPIC = "voice_control/data"
# Simplified Topics (like AutomationValue)
VOICE_CONTROL_COMMAND_TOPIC = "command_control_voice"
VOICE_CONTROL_RESPONSE_TOPIC = "response_control_voice"

# MQTT Topic Definitions (Other)
ERROR_LOG_TOPIC = "subrack/error/log" # Topic for centralized error logging

# --- DEDICATED ERROR LOGGING CLIENT ---
error_logger_client = None
ERROR_LOGGER_CLIENT_ID = f'automation-voice-error-logger-{uuid.uuid4()}'

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
        "source": "AutomationVoiceService",
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

# --- CRUD FUNCTIONS: VOICE CONTROL ---
def add_voice_control(data):
    try:
        items = read_json(VOICE_CONTROL_PATH)
        if items is None: # Handle case where read_json returns None due to critical error
            send_error_log("add_voice_control", "Failed to read existing voice control data.", "critical")
            return

        # Ensure UUID exists or generate one
        if not data.get("uuid"):
            data["uuid"] = str(uuid.uuid4())
            logger.info(f"Generated UUID for new voice control: {data['uuid']}")

        items.append(data)
        write_json(VOICE_CONTROL_PATH, items)
        logger.info(f"Voice Control Added: {data.get('keyword', 'N/A')} (UUID: {data['uuid']})")
    except Exception as e:
        send_error_log("add_voice_control", f"Failed to add voice control: {e}", "major", {"data": data})

def update_voice_control(uuid_key, new_data):
    try:
        items = read_json(VOICE_CONTROL_PATH)
        if items is None:
            send_error_log("update_voice_control", "Failed to read existing voice control data.", "critical")
            return

        found = False
        for item in items:
            if item.get("uuid") == uuid_key:
                item.update(new_data)
                write_json(VOICE_CONTROL_PATH, items)
                logger.info(f"Voice Control Updated: {uuid_key}")
                found = True
                break
        if not found:
            logger.warning(f"Voice Control Not Found for update: {uuid_key}")
            send_error_log("update_voice_control", f"Voice Control not found for update.", "warning", {"uuid": uuid_key, "new_data": new_data})
    except Exception as e:
        send_error_log("update_voice_control", f"Failed to update voice control: {e}", "major", {"uuid": uuid_key, "new_data": new_data})

def delete_voice_control(uuid_key):
    try:
        items = read_json(VOICE_CONTROL_PATH)
        if items is None:
            send_error_log("delete_voice_control", "Failed to read existing voice control data.", "critical")
            return

        new_items = [i for i in items if i.get("uuid") != uuid_key]
        if len(new_items) != len(items):
            write_json(VOICE_CONTROL_PATH, new_items)
            logger.info(f"Voice Control Deleted: {uuid_key}")
        else:
            logger.warning(f"Voice Control Not Found for delete: {uuid_key}")
            send_error_log("delete_voice_control", f"Voice Control not found for delete.", "warning", {"uuid": uuid_key})
    except Exception as e:
        send_error_log("delete_voice_control", f"Failed to delete voice control: {e}", "major", {"uuid": uuid_key})

def filter_voice_control_by_manufacturer(manufacturer_filter=None):
    """Filter voice control data by manufacturer"""
    try:
        items = read_json(VOICE_CONTROL_PATH)
        if items is None:
            return []
        
        if manufacturer_filter:
            filtered_items = [item for item in items if item.get('manufacturer', '').lower() == manufacturer_filter.lower()]
            logger.info(f"Filtered voice controls by manufacturer '{manufacturer_filter}': {len(filtered_items)} items")
            return filtered_items
        else:
            return items
    except Exception as e:
        send_error_log("filter_voice_control_by_manufacturer", f"Failed to filter voice control data: {e}", "major", {"manufacturer_filter": manufacturer_filter})
        return []

# --- MQTT CLIENTS ---
mqtt_local = mqtt.Client(client_id=f"automation-voice-local-{uuid.uuid4()}")

# --- MQTT LOCAL CLIENT CALLBACKS ---
def on_local_connect(client, userdata, flags, rc):
    global local_broker_connected
    if rc == 0:
        local_broker_connected = True
        log_simple("Local MQTT broker connected", "SUCCESS")
        # Subscribe to simplified command topic
        client.subscribe(VOICE_CONTROL_COMMAND_TOPIC, qos=QOS)
        if DEBUG_MODE:
            logger.debug(f"[DEBUG] Subscribed to simplified command topic: {VOICE_CONTROL_COMMAND_TOPIC}")
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

        if topic == VOICE_CONTROL_COMMAND_TOPIC:
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
            "data": read_json(VOICE_CONTROL_PATH) or [],
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(VOICE_CONTROL_RESPONSE_TOPIC, json.dumps(response))
        log_simple("Configuration data sent to client", "SUCCESS")
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(VOICE_CONTROL_RESPONSE_TOPIC, json.dumps(error_response))
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
            success, message = update_voice_control_crud(data)
        elif action == "delete":
            success, message = delete_voice_control_crud(data.get('id') or data.get('uuid'))
        else:
            message = f"Unknown action: {action}"

        # Send response
        response = {
            "status": "success" if success else "error",
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(VOICE_CONTROL_RESPONSE_TOPIC, json.dumps(response))

    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(VOICE_CONTROL_RESPONSE_TOPIC, json.dumps(error_response))
        log_simple(f"Error handling CRUD request: {e}", "ERROR")

def create_voice_control(rule_data):
    """Create new voice control"""
    try:
        add_voice_control(rule_data)
        return True, f"Voice control '{rule_data.get('data', {}).get('custom_name', 'Unknown')}' created successfully"
    except Exception as e:
        log_simple(f"Error creating voice control: {e}", "ERROR")
        send_error_log(f"Voice control creation error: {e}", "major")
        return False, str(e)

def update_voice_control_crud(rule_data):
    """Update existing voice control"""
    try:
        rule_id = rule_data.get('id') or rule_data.get('uuid')
        if not rule_id:
            return False, "Voice control ID or UUID is required for update"

        update_voice_control(rule_id, rule_data)
        return True, f"Voice control '{rule_id}' updated successfully"
    except Exception as e:
        log_simple(f"Error updating voice control: {e}", "ERROR")
        send_error_log(f"Voice control update error: {e}", "major")
        return False, str(e)

def delete_voice_control_crud(rule_id):
    """Delete voice control"""
    try:
        if not rule_id:
            return False, "Voice control ID or UUID is required for deletion"

        delete_voice_control(rule_id)
        return True, "Voice control deleted successfully"
    except Exception as e:
        log_simple(f"Error deleting voice control: {e}", "ERROR")
        send_error_log(f"Voice control deletion error: {e}", "major")
        return False, str(e)

# --- PUBLISHER THREAD FUNCTIONS ---
def run_voice_publisher_loop():
    while True:
        try:
            values = read_json(VOICE_CONTROL_PATH)
            if values is None: # Handle critical read error
                logger.error(f"Skipping publication for {VOICE_CONTROL_TOPIC} due to read error.")
                time.sleep(5) # Wait longer if there's a file read issue
                continue

            if values:
                if mqtt_local and mqtt_local.is_connected():
                    payload = json.dumps(values)
                    mqtt_local.publish(VOICE_CONTROL_TOPIC, payload, qos=QOS)
                    if DEBUG_MODE:
                        logger.debug(f"[DEBUG] Published voice control data. Items count: {len(values)}")
                else:
                    logger.warning(f"Voice control MQTT client not connected, unable to publish to {VOICE_CONTROL_TOPIC}.")
                    send_error_log("run_voice_publisher_loop", f"MQTT client disconnected, unable to publish.", "warning", {"topic": VOICE_CONTROL_TOPIC})
            else:
                if DEBUG_MODE:
                    logger.debug(f"[DEBUG] No voice control items to publish.")
        except Exception as e:
            send_error_log("run_voice_publisher_loop", f"Error in voice publisher loop: {e}", "major", {"topic": VOICE_CONTROL_TOPIC})
        time.sleep(1) # Standard sleep for data publishers

# --- MAIN EXECUTION BLOCK ---
def main():
    global local_broker_connected
    
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

    # Wait a moment for connections to establish
    time.sleep(2)
    
    # Print success banner and broker status
    print_success_banner()
    print_broker_status(local_broker_connected)

    # Start publisher thread
    log_simple("Starting voice control publisher thread...")
    voice_thread = threading.Thread(target=run_voice_publisher_loop, daemon=True)
    voice_thread.start()
    
    log_simple("Voice control publisher thread started successfully", "SUCCESS")

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
        log_simple("Automation Voice service stopped by user", "WARNING")
    except Exception as e:
        log_simple(f"Critical error: {e}", "ERROR")
        send_error_log("main (main_loop)", f"Unhandled critical exception in main loop: {e}", "critical")
    finally:
        log_simple("Shutting down services...")
        # Disconnect clients gracefully
        if mqtt_local:
            mqtt_local.loop_stop()
            mqtt_local.disconnect()
        if error_logger_client:
            error_logger_client.loop_stop()
            error_logger_client.disconnect()
        log_simple("Application terminated", "SUCCESS")

if __name__ == "__main__":
    main()
