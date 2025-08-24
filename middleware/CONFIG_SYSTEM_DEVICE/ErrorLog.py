import os
import paho.mqtt.client as mqtt
import json
from datetime import datetime
import logging
import time
import threading
import sys

# --- Setup Logging ---
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(message)s')

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Error Log ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Error Log ===========")
    print("Success To Running")
    print("")

def print_broker_status(broker_status=False):
    """Print MQTT broker connection status"""
    if broker_status:
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

# --- Connection Status Tracking ---
broker_connected = False

# --- Paths and Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MQTT_CONFIG_PATH = os.path.join(SCRIPT_DIR, '..', 'MODBUS_SNMP', 'JSON', 'Config', 'mqtt_config.json')

ERROR_LOG_DIR = os.path.join(SCRIPT_DIR, "JSON")
ERROR_LOG_FILE_PATH = os.path.join(ERROR_LOG_DIR, "errorLog.json")

DEFAULT_MQTT_BROKER_ADDRESS = "localhost"
DEFAULT_MQTT_BROKER_PORT = 1883

ERROR_DATA_TOPIC = "subrack/error/data"
ERROR_LOG_RECEIVE_TOPIC = "subrack/error/log"
DELETE_ALL_LOGS_COMMAND_TOPIC = "subrack/error/data/delete/all"
DELETE_BY_DATA_COMMAND_TOPIC = "subrack/error/data/delete/by_message"
REQUEST_BROKER_CONFIG_TOPIC = "request/broker_config"
RESPONSE_BROKER_CONFIG_TOPIC = "response/broker_config"
RESOLVE_ERROR_COMMAND_TOPIC = "subrack/error/data/resolve"

MAX_LOG_ENTRIES = 500
PUBLISH_INTERVAL_SECONDS = 5

# --- Global State ---
mqtt_client_instance = None
file_lock = threading.Lock()
last_published_filtered_errors = []

# --- Helper Functions ---

def ensure_directory_exists(path):
    directory = os.path.dirname(path)
    if not os.path.exists(directory):
        try:
            os.makedirs(directory)
            logger.info(f"Created directory: {directory}")
        except OSError as e:
            logger.critical(f"Failed to create directory {directory}: {e}. Exiting.", exc_info=True)
            sys.exit(1)

def load_json_file(file_path, default_value):
    ensure_directory_exists(file_path)
    with file_lock:
        try:
            if os.path.exists(file_path):
                with open(file_path, 'r') as file:
                    return json.load(file)
            logger.info(f"File not found: {file_path}. Returning default value.")
            return default_value
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error(f"Error reading {file_path}: {e}. Returning default value.", exc_info=True)
            return default_value
        except Exception as e:
            logger.error(f"An unexpected error occurred while loading {file_path}: {e}", exc_info=True)
            return default_value

def save_json_file(file_path, data):
    ensure_directory_exists(file_path)
    with file_lock:
        try:
            with open(file_path, 'w') as file:
                json.dump(data, file, indent=4)
            logger.info(f"Data saved to {file_path}")
        except IOError as e:
            logger.error(f"Failed to save data to {file_path}: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"An unexpected error occurred while saving {file_path}: {e}", exc_info=True)

def load_mqtt_config():
    config = load_json_file(MQTT_CONFIG_PATH, {})
    return {
        "broker_address": config.get("broker_address", DEFAULT_MQTT_BROKER_ADDRESS),
        "broker_port": config.get("broker_port", DEFAULT_MQTT_BROKER_PORT)
    }

def get_current_timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def parse_timestamp(timestamp_str):
    try:
        return datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        logger.warning(f"Invalid or missing 'Timestamp' format: '{timestamp_str}'. Using current time for ordering.")
        return datetime.now()

## Error Log Validation

def validate_incoming_log_structure(log_entry):
    if not isinstance(log_entry, dict):
        logger.warning(f"Validation failed: Log entry is not a dictionary. Received: {log_entry}")
        return False

    required_fields = {
        "id": str,
        "data": str,
        "type": str,
        "source": str,
        "Timestamp": str,
        "status": str,
    }

    for field, expected_type in required_fields.items():
        if field not in log_entry:
            logger.warning(f"Validation failed: Missing required field '{field}'. Entry: {log_entry}")
            return False
        if not isinstance(log_entry[field], expected_type):
            logger.warning(f"Validation failed: Field '{field}' has incorrect type. Expected {expected_type.__name__}, got {type(log_entry[field]).__name__}. Entry: {log_entry}")
            return False

    allowed_types = ["MINOR", "MAJOR", "CRITICAL", "INFO", "WARNING", "ERROR"]
    if log_entry.get("type") not in allowed_types:
        logger.warning(f"Validation failed: 'type' field '{log_entry.get('type')}' is not an allowed value. Allowed: {allowed_types}. Entry: {log_entry}")
        return False
    
    allowed_statuses = ["active", "resolved"]
    current_status = log_entry.get("status")
    if current_status not in allowed_statuses:
        logger.warning(f"Validation failed: 'status' field '{current_status}' is not an allowed value. Allowed: {allowed_statuses}. Entry: {log_entry}")
        return False

    try:
        datetime.strptime(log_entry["Timestamp"], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        logger.warning(f"Validation failed: 'Timestamp' format is incorrect. Expected YYYY-MM-DD HH:MM:SS. Entry: {log_entry}")
        return False

    # 'resolved_at' is required only if status is 'resolved'
    if current_status == "resolved":
        if "resolved_at" not in log_entry or not isinstance(log_entry["resolved_at"], str) or not log_entry["resolved_at"]:
            logger.warning(f"Validation failed: 'resolved_at' must be a non-empty string for 'resolved' status. Entry: {log_entry}")
            return False
        try:
            datetime.strptime(log_entry["resolved_at"], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            logger.warning(f"Validation failed: 'resolved_at' format is incorrect for 'resolved' status. Expected YYYY-MM-DD HH:MM:SS. Entry: {log_entry}")
            return False
    else: # status is 'active'
        if "resolved_at" in log_entry and log_entry["resolved_at"] not in [None, ""]:
             logger.warning(f"Validation failed: 'resolved_at' should be empty or absent for 'active' status. Entry: {log_entry}")
             return False

    return True

def load_all_error_logs():
    return load_json_file(ERROR_LOG_FILE_PATH, [])

def save_new_error_log_entry(new_log_entry):
    if not validate_incoming_log_structure(new_log_entry):
        logger.error("Skipping save: Incoming error log entry failed structure validation.")
        return

    error_data = load_all_error_logs()
    
    incoming_data_content = new_log_entry.get("data")
    incoming_type_content = new_log_entry.get("type")
    
    # Check for duplicates (based on 'data' AND 'type' for active errors)
    for existing_entry in reversed(error_data):
        if not validate_incoming_log_structure(existing_entry):
            logger.debug(f"Skipping duplicate check for invalid existing entry: {existing_entry.get('id', 'N/A')}")
            continue

        # Only consider active errors for duplication check
        if existing_entry.get("status", "active") != "active":
            continue

        existing_data_content = existing_entry.get("data")
        existing_type_content = existing_entry.get("type")

        if existing_data_content == incoming_data_content and \
           existing_type_content == incoming_type_content:
            logger.info(f"Duplicate active error detected (data & type match) for '{incoming_data_content}' with type '{incoming_type_content}'. Skipping new entry.")
            return

    error_data.append(new_log_entry)

    if len(error_data) > MAX_LOG_ENTRIES:
        error_data = error_data[-MAX_LOG_ENTRIES:]

    save_json_file(ERROR_LOG_FILE_PATH, error_data)
    logger.info(f"Successfully saved new error log entry with data '{incoming_data_content}' and type '{incoming_type_content}'")
    trigger_immediate_publish()

def delete_all_error_logs():
    save_json_file(ERROR_LOG_FILE_PATH, [])
    logger.info(f"All error logs deleted from {ERROR_LOG_FILE_PATH}")
    trigger_immediate_publish()

def delete_errors_by_message(error_message):
    current_errors = load_all_error_logs()
    
    updated_errors = []
    deleted_count = 0
    for entry in current_errors:
        if not validate_incoming_log_structure(entry):
            logger.warning(f"Skipping processing invalid existing entry during delete by message: {entry.get('id', 'N/A')}")
            updated_errors.append(entry)
            continue

        if entry.get("data") != error_message:
            updated_errors.append(entry)
        else:
            deleted_count += 1

    if deleted_count > 0:
        save_json_file(ERROR_LOG_FILE_PATH, updated_errors)
        logger.info(f"Deleted {deleted_count} error entries with message: '{error_message}'.")
        trigger_immediate_publish()
    else:
        logger.warning(f"No error entries found with message: '{error_message}' to delete.")

def update_error_status(error_id, new_status="resolved"):
    error_data = load_all_error_logs()
    updated = False
    for entry in error_data:
        if not validate_incoming_log_structure(entry):
            logger.warning(f"Skipping status update for invalid existing entry with ID: {entry.get('id', 'N/A')}")
            continue

        if entry.get("id") == error_id:
            entry["status"] = new_status
            entry["resolved_at"] = get_current_timestamp()
            updated = True
            break
    if updated:
        save_json_file(ERROR_LOG_FILE_PATH, error_data)
        logger.info(f"Error with ID '{error_id}' marked as '{new_status}'.")
        trigger_immediate_publish()
    else:
        logger.warning(f"Error with ID '{error_id}' not found for status update.")

def filter_and_prepare_errors_for_display(all_error_logs):
    unique_active_errors = {}
    
    # Sort all_error_logs by timestamp in descending order first
    # This ensures that when we iterate, the latest entry for a key will overwrite older ones
    sorted_all_errors = sorted(all_error_logs, 
                                 key=lambda x: parse_timestamp(x.get("Timestamp", "1970-01-01 00:00:00")), 
                                 reverse=True)

    for entry in sorted_all_errors:
        if not validate_incoming_log_structure(entry):
            logger.warning(f"Skipping invalid log entry for display: {entry.get('id', 'N/A')}")
            continue

        if entry.get("status", "active") != "active":
            continue

        data_field = entry.get("data")
        source_field = entry.get("source", "unknown")
        error_key = f"{source_field}-{data_field}" 

        # The first time we encounter a key (which will be the newest due to initial sort), we store it.
        # Subsequent older entries for the same key are implicitly ignored.
        unique_active_errors[error_key] = entry
            
    # Convert dictionary values to a list and sort by Timestamp (newest first)
    final_sorted_errors = sorted(list(unique_active_errors.values()), 
                                 key=lambda x: parse_timestamp(x.get("Timestamp", "1970-01-01 00:00:00")), 
                                 reverse=True)
    return final_sorted_errors

def publish_filtered_error_log(client_instance, filtered_errors):
    if not client_instance or not client_instance.is_connected():
        logger.warning("MQTT client not connected, cannot publish filtered error log.")
        return

    try:
        payload = json.dumps(filtered_errors, indent=4)
        client_instance.publish(ERROR_DATA_TOPIC, payload, qos=1, retain=False)
        logger.info(f"Published {len(filtered_errors)} filtered error logs to topic {ERROR_DATA_TOPIC}")
    except Exception as e:
        logger.error(f"Failed to publish filtered errors to MQTT: {e}", exc_info=True)

def on_connect(client, userdata, flags, rc):
    global broker_connected
    if rc == 0:
        broker_connected = True
        log_simple("MQTT broker connected", "SUCCESS")
        try:
            client.subscribe(ERROR_LOG_RECEIVE_TOPIC, qos=1)
            client.subscribe(DELETE_ALL_LOGS_COMMAND_TOPIC, qos=1)
            client.subscribe(DELETE_BY_DATA_COMMAND_TOPIC, qos=1)
            client.subscribe(REQUEST_BROKER_CONFIG_TOPIC, qos=1)
            client.subscribe(RESOLVE_ERROR_COMMAND_TOPIC, qos=1)

            all_errors = load_all_error_logs()
            filtered = filter_and_prepare_errors_for_display(all_errors)
            publish_filtered_error_log(client, filtered)
        except Exception as e:
            log_simple(f"Failed to subscribe to topics: {e}", "ERROR")
    else:
        broker_connected = False
        log_simple(f"MQTT broker connection failed (code {rc})", "ERROR")

def on_disconnect(client, userdata, rc):
    global broker_connected
    broker_connected = False
    if rc != 0:
        log_simple("MQTT broker disconnected", "WARNING")
    else:
        log_simple("MQTT client disconnected normally", "INFO")

def on_message(client, userdata, message):
    logger.debug(f"Received message on topic: {message.topic}")
    try:
        payload = message.payload.decode('utf-8').strip()
        if not payload:
            logger.warning(f"Received an empty payload from topic {message.topic}")
            return

        try:
            payload_data = json.loads(payload)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON payload from topic {message.topic}: {e}. Payload: '{payload}'", exc_info=True)
            return

        if message.topic == DELETE_ALL_LOGS_COMMAND_TOPIC:
            if payload_data.get("command", "").lower() == "delete_all":
                logger.info(f"Received delete ALL command from topic {message.topic}")
                delete_all_error_logs()
            else:
                logger.warning(f"Unrecognized command in delete ALL topic: {payload_data}")

        elif message.topic == DELETE_BY_DATA_COMMAND_TOPIC:
            error_msg_to_delete = payload_data.get("message")
            if error_msg_to_delete:
                logger.info(f"Received delete by message command for: '{error_msg_to_delete}'")
                delete_errors_by_message(error_msg_to_delete)
            else:
                logger.warning(f"Delete by message command received without 'message': {payload_data}")

        elif message.topic == REQUEST_BROKER_CONFIG_TOPIC:
            logger.info(f"Request for broker config received on {REQUEST_BROKER_CONFIG_TOPIC}")
            config = load_mqtt_config()
            response_payload = {
                "broker_address": config["broker_address"],
                "broker_port": config["broker_port"]
            }
            client.publish(RESPONSE_BROKER_CONFIG_TOPIC, json.dumps(response_payload), qos=1, retain=False)
            logger.info(f"Sent broker config to {RESPONSE_BROKER_CONFIG_TOPIC}: {response_payload}")

        elif message.topic == RESOLVE_ERROR_COMMAND_TOPIC:
            error_id_to_resolve = payload_data.get("id")
            if error_id_to_resolve:
                logger.info(f"Received resolve command for error ID: {error_id_to_resolve}")
                update_error_status(error_id_to_resolve, "resolved")
            else:
                logger.warning(f"Resolve command received without 'id': {payload_data}")

        elif message.topic == ERROR_LOG_RECEIVE_TOPIC:
            logger.info(f"Received new error log entry from topic {message.topic}: {payload_data}")
            save_new_error_log_entry(payload_data)
        else:
            logger.warning(f"Received message on unhandled specific topic: {message.topic} with payload: {payload_data}")

    except Exception as e:
        logger.error(f"Error processing received message: {e}", exc_info=True)

publish_event = threading.Event()

def trigger_immediate_publish():
    publish_event.set()

def periodic_publish_filtered_error_log(client_instance):
    logger.info("Starting periodic error log publisher thread...")
    while True:
        try:
            publish_event.wait(timeout=PUBLISH_INTERVAL_SECONDS)
            publish_event.clear()

            all_errors = load_all_error_logs()
            filtered_errors = filter_and_prepare_errors_for_display(all_errors)
            
            global last_published_filtered_errors
            if filtered_errors != last_published_filtered_errors:
                publish_filtered_error_log(client_instance, filtered_errors)
                last_published_filtered_errors = filtered_errors
            else:
                logger.debug("Filtered error logs unchanged, skipping publish.")

        except Exception as e:
            logger.error(f"Error in periodic error log publisher thread: {e}", exc_info=True)

def setup_mqtt_client():
    config = load_mqtt_config()
    broker_address = config["broker_address"]
    broker_port = config["broker_port"]

    client = mqtt.Client(client_id="ErrorLogService", protocol=mqtt.MQTTv311, clean_session=True)
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    client.reconnect_delay_set(min_delay=1, max_delay=120)

    try:
        logger.info(f"Attempting to connect to MQTT broker at {broker_address}:{broker_port}...")
        client.connect(broker_address, int(broker_port), 60)
        return client
    except Exception as e:
        logger.critical(f"Failed to connect MQTT client at startup: {e}. Exiting. ❌", exc_info=True)
        sys.exit(1)

def main():
    global mqtt_client_instance, broker_connected
    
    # Print startup banner
    print_startup_banner()
    
    try:
        log_simple("Initializing directories...")
        ensure_directory_exists(ERROR_LOG_FILE_PATH)

        log_simple("Setting up MQTT client...")
        mqtt_client_instance = setup_mqtt_client()
        mqtt_client_instance.loop_start()

        # Wait a moment for connection to establish
        time.sleep(2)
        
        # Print success banner and broker status
        print_success_banner()
        print_broker_status(broker_connected)

        log_simple("Starting periodic publisher thread...")
        threading.Thread(target=periodic_publish_filtered_error_log, args=(mqtt_client_instance,), daemon=True).start()
        
        log_simple("Error Log service started successfully", "SUCCESS")

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        log_simple("Error Log service stopped by user", "WARNING")
    except Exception as e:
        log_simple(f"Critical error: {e}", "ERROR")
    finally:
        log_simple("Shutting down services...")
        if mqtt_client_instance:
            mqtt_client_instance.loop_stop()
            mqtt_client_instance.disconnect()
        log_simple("Application terminated", "SUCCESS")

if __name__ == "__main__":
    main()