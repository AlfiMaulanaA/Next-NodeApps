import json
import sys
import time
import threading
from threading import Lock
import paho.mqtt.client as mqtt
import logging
from datetime import datetime
from BrokerTemplateManager import BrokerTemplateManager
from BrokerResolver import BrokerResolver

CONFIG_FILE_PATH = "../MODULAR_I2C/JSON/Config/mqtt_config.json"
DATA_FILE_PATH = "./JSON/payloadStaticConfig.json"
ERROR_LOG_TOPIC = "subrack/error/log"

# --- Minimal Logging Setup (like run_automation_voice.py) ---
def setup_minimal_logging():
    """Setup minimal logging - only warnings/errors to console, detailed to file"""

    # Clear existing handlers
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Console handler - only warnings and errors (minimal spam)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.WARNING)  # Only show warnings and errors
    console_formatter = logging.Formatter('%(levelname)s: %(message)s')
    console_handler.setFormatter(console_formatter)

    # File handler - detailed logging
    file_handler = logging.FileHandler('payload_static.log')
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(file_formatter)

    # Setup root logger
    logging.basicConfig(
        level=logging.INFO,
        handlers=[console_handler, file_handler]
    )

    # Suppress noisy third-party logs
    logging.getLogger('paho.mqtt.client').setLevel(logging.WARNING)
    logging.getLogger('BrokerResolver').setLevel(logging.WARNING)

# Initialize minimal logging
setup_minimal_logging()
logger = logging.getLogger("PayloadStatic")

json_lock = Lock()

# Publish error log to MQTT
def log_error(client, error_message, error_type):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    error_payload = {
        "data": error_message,
        "type": error_type,
        "Timestamp": timestamp
    }
    logger.warning(f"No data to publish yet for {error_message.replace('Error No data to publish yet for ', '')}")
    client.publish(ERROR_LOG_TOPIC, json.dumps(error_payload))

def read_json_file(file_path):
    with json_lock:
        try:
            with open(file_path, "r") as file:
                return json.load(file)
        except FileNotFoundError:
            logger.warning(f"JSON file not found at {file_path}, creating empty structure")
            # Create the file with empty array structure (new format)
            empty_data = []
            write_json_file(file_path, empty_data)
            return empty_data
        except Exception as e:
            logger.error(f"Error reading JSON file at {file_path}: {e}")
            return []

def write_json_file(file_path, data):
    with json_lock:
        try:
            with open(file_path, "w") as file:
                json.dump(data, file, indent=2)
        except Exception as e:
            logger.error(f"Error writing JSON file at {file_path}: {e}")

def load_mqtt_config():
    try:
        with open(CONFIG_FILE_PATH, "r") as file:
            config = json.load(file)
        logger.info("MQTT configuration loaded successfully from file")
        broker_host = config.get("broker_address", "localhost")
        broker_port = config.get("broker_port", 1883)

        # Ensure consistent configuration with frontend
        logger.info(f"Using MQTT broker: {broker_host}:{broker_port}")
        return {
            "broker": broker_host,
            "port": broker_port,
            "username": config.get("username", ""),
            "password": config.get("password", "")
        }
    except Exception as e:
        logger.warning(f"MQTT config file not found, using defaults: {e}")
        logger.info("Using default MQTT configuration (localhost:1883, no auth)")
        return {"broker": "localhost", "port": 1883, "username": "", "password": ""}

# Load configuration at startup
mqtt_config = load_mqtt_config()
MQTT_BROKER_HOST = mqtt_config["broker"]
MQTT_BROKER_PORT = mqtt_config["port"]

def on_crud_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info(f"CRUD client connected successfully to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
        client.subscribe("command/data/payload")
    else:
        logger.error(f"CRUD client connection failed with code {rc}")

def on_crud_disconnect(client, userdata, rc):
    logger.warning(f"CRUD client disconnected with code {rc}")

def on_pub_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info(f"Publisher client connected successfully to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
    else:
        logger.error(f"Publisher client connection failed with code {rc}")

def on_pub_disconnect(client, userdata, rc):
    logger.warning(f"Publisher client disconnected with code {rc}")

def handle_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        command = payload.get("command")

        if command == "getData":
            handle_get_data(client)
        elif command == "writeData":
            handle_write_data(client, payload)
        elif command == "updateData":
            handle_update_data(client, payload)
        elif command == "deleteData":
            handle_delete_data(client, payload)
        else:
            logger.warning(f"Unknown command received: {command}")

    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON: {e}")
        log_error(client, f"Error decoding JSON: {e}", "major")
    except Exception as e:
        logger.error(f"Unexpected error in handle_message: {e}")

# CRUD Client for localhost broker
crud_client = mqtt.Client(client_id="payload_static_crud", clean_session=False)
crud_client.on_connect = on_crud_connect
crud_client.on_disconnect = on_crud_disconnect
crud_client.on_message = handle_message

# Periodic Publisher Client from config
pub_client = mqtt.Client(client_id="payload_static_pub", clean_session=False)
pub_client.on_connect = on_pub_connect
pub_client.on_disconnect = on_pub_disconnect

# Connect clients with error handling
try:
    crud_client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)
    logger.info(f"CRUD client connecting to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
except Exception as e:
    logger.error(f"Failed to connect CRUD client to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}: {e}")

try:
    pub_client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)
    logger.info(f"Publisher client connecting to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
except Exception as e:
    logger.error(f"Failed to connect publisher client to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}: {e}")

def add_online_status(data):
    """Add online status to payload data"""
    if not isinstance(data, list):
        logger.warning("Invalid data format for add_online_status")
        return []

    for item in data:
        topic = item.get("topic")
        item_data = item.get("data", {})
        lwt_status = item.get("lwt", True)
        if not isinstance(item_data, dict):
            logger.warning(f"Skipping invalid data format for topic {topic}: {item_data}")
            continue
        # Always set online status: 1 when LWT is enabled, 0 when disabled
        item["data"] = {"online": 1 if lwt_status else 0, **item_data}
    return data

def set_lwt(client):
    data = read_json_file(DATA_FILE_PATH)
    if not data:
        logger.info("No valid data available to set LWT.")
        return

    # Handle both old format (dict) and new format (array)
    if isinstance(data, dict):
        payloads = data.get('payloads', [])
    else:
        payloads = data  # New format: direct array

    if not payloads:
        logger.info("No payloads configured for LWT.")
        return

    for item in payloads:
        topic = item.get("topic")
        lwt_status = item.get("lwt", True)
        if topic and lwt_status:
            offline_payload = {"online": 0, **item.get("data", {})}
            client.will_set(topic, json.dumps(offline_payload), qos=1, retain=False)

def update_lwt(client, new_entry):
    topic = new_entry.get("topic")
    if topic:
        offline_payload = {"online": 0, **new_entry.get("data", {})}
        client.will_set(topic, json.dumps(offline_payload), qos=1, retain=False)

def handle_get_data(client):
    """Handle getData command with clean logging"""
    try:
        data = read_json_file(DATA_FILE_PATH)
        if not data:
            logger.warning("No payload data available")
            data = {"templates": [], "payloads": []}

        # Ensure proper format
        if isinstance(data, list):
            data = {"templates": [], "payloads": data}

        payload_count = len(data.get('payloads', []))
        template_count = len(data.get('templates', []))

        logger.info(f"Processed getData: {payload_count} payloads, {template_count} templates")

        json_response = json.dumps(data)
        result = client.publish("response/data/payload", json_response)

        if result.rc != 0:
            logger.error(f"Failed to publish response (code: {result.rc})")

    except Exception as e:
        logger.error(f"Error in handle_get_data: {e}")
        client.publish("response/data/payload", json.dumps({
            "status": "error",
            "message": "Failed to retrieve data",
            "error": str(e)
        }))

def handle_write_data(client, payload):
    try:
        # Construct the entry object from frontend payload
        data_payload = payload.get("data")
        topic = payload.get("topic")

        if not topic or not data_payload:
            client.publish("response/data/write", json.dumps({"status": "error", "message": "Missing topic or data"}))
            return

        # Generate unique ID and timestamps
        import uuid
        entry_id = str(uuid.uuid4().hex)[:16]  # Generate 16-character ID
        current_time = datetime.now().isoformat()

        # Get template ID from payload or use default
        template_id = payload.get("template_id", "local_dev_v1")

        new_entry = {
            "id": entry_id,
            "topic": topic,
            "data": data_payload,
            "interval": payload.get("interval", 0),
            "qos": payload.get("qos", 0),
            "lwt": payload.get("lwt", True),
            "retain": payload.get("retain", False),
            "template_id": template_id,
            "broker_config": {
                "template_id": template_id,
                "overrides": {}
            },
            "created_at": current_time,
            "updated_at": current_time,
            "version": 1
        }

        # Read current data (handle both old and new format)
        current_data = read_json_file(DATA_FILE_PATH)
        if not current_data:
            # Initialize with new format (direct array)
            current_data = []

        # Handle both old format (dict) and new format (array)
        if isinstance(current_data, dict):
            # Old format: convert to new format
            payloads = current_data.get('payloads', [])
            payloads.append(new_entry)
            current_data = payloads  # Now it's a direct array
        else:
            # New format: direct array
            current_data.append(new_entry)

        write_json_file(DATA_FILE_PATH, current_data)

        # Set LWT for the new entry
        update_lwt(pub_client, new_entry)

        # Send success response to frontend
        response_payload = {
            "status": "success",
            "message": f"Data created for topic {topic}",
            "data": new_entry
        }
        client.publish("response/data/write", json.dumps(response_payload))
        logger.info(f"Created payload for topic: {topic} (template: {template_id})")

        # Immediately send updated data to frontend to refresh UI
        logger.info("Sending updated data to frontend after create operation")
        handle_get_data(client)

    except Exception as e:
        logger.error(f"Error in handle_write_data: {e}")
        client.publish("response/data/write", json.dumps({"status": "error", "message": str(e)}))

def handle_update_data(client, payload):
    try:
        # Get original topic for identification and new topic for updating
        original_topic = payload.get("originalTopic")
        new_topic = payload.get("topic")
        updated_data = payload.get("data")

        if not original_topic:
            client.publish("response/data/update", json.dumps({"status": "error", "message": "Missing original topic for identification"}))
            return

        current_data = read_json_file(DATA_FILE_PATH)

        # Handle both old format (dict) and new format (array)
        if isinstance(current_data, dict):
            # Old format: get payloads array
            payloads = current_data.get('payloads', [])
            is_old_format = True
        else:
            # New format: direct array
            payloads = current_data
            is_old_format = False

        # Find and update the payload
        for i, item in enumerate(payloads):
            if item.get("topic") == original_topic:
                old_topic = item.get("topic")

                # Update the topic if it has changed
                if new_topic and new_topic != old_topic:
                    payloads[i]["topic"] = new_topic
                    logger.info(f"Topic updated from '{old_topic}' to '{new_topic}'")

                # Update the data field - frontend sends array of {key, value} objects
                if updated_data and isinstance(updated_data, list):
                    payloads[i]["data"] = {field["key"]: field["value"] for field in updated_data}
                elif updated_data and isinstance(updated_data, dict):
                    payloads[i]["data"] = updated_data

                # Update other fields
                payloads[i]["interval"] = payload.get("interval", item.get("interval", 0))
                payloads[i]["qos"] = payload.get("qos", item.get("qos", 0))
                payloads[i]["lwt"] = payload.get("lwt", item.get("lwt", True))
                payloads[i]["retain"] = payload.get("retain", item.get("retain", False))

                # Update template if provided - ensure broker resolver gets updated
                if payload.get("template_id"):
                    payloads[i]["template_id"] = payload.get("template_id")
                    payloads[i]["broker_config"] = {
                        "template_id": payload.get("template_id"),
                        "overrides": {}
                    }
                    logger.info(f"Template updated to: {payload.get('template_id')}")

                # Update timestamp and version
                payloads[i]["updated_at"] = datetime.now().isoformat()
                payloads[i]["version"] = item.get("version", 1) + 1

                # Save the updated data
                if is_old_format:
                    current_data["payloads"] = payloads
                    write_json_file(DATA_FILE_PATH, current_data)
                    update_lwt(pub_client, payloads[i])
                else:
                    write_json_file(DATA_FILE_PATH, payloads)
                    update_lwt(pub_client, payloads[i])

                # Clear retained message for old topic if topic changed
                if new_topic and new_topic != old_topic:
                    try:
                        result = client.publish(old_topic, "", qos=1, retain=True)
                        logger.info(f"✓ Cleared retained message for old topic: {old_topic}")
                    except Exception as e:
                        logger.warning(f"Failed to clear retained message for old topic {old_topic}: {e}")

                # Send success response to frontend
                response_payload = {
                    "status": "success",
                    "message": f"Data updated for topic {new_topic}",
                    "topic": new_topic,
                    "data": payloads[i]
                }
                client.publish("response/data/update", json.dumps(response_payload))
                logger.info(f"Updated payload for topic: {new_topic} (from {original_topic})")

                # Immediately send updated data to frontend to refresh UI
                logger.info("Sending updated data to frontend after update operation")
                handle_get_data(client)
                return

        client.publish("response/data/update", json.dumps({"status": "error", "message": f"No entry found with topic {original_topic}"}))

    except Exception as e:
        logger.error(f"Error in handle_update_data: {e}")
        client.publish("response/data/update", json.dumps({"status": "error", "message": str(e)}))

def handle_delete_data(client, payload):
    topic = payload.get("topic")
    if topic:
        current_data = read_json_file(DATA_FILE_PATH)

        # Handle both old format (dict) and new format (array)
        if isinstance(current_data, dict):
            # Old format: get payloads array and update it
            payloads = current_data.get('payloads', [])
            original_count = len(payloads)
            updated_payloads = [item for item in payloads if item.get("topic") != topic]

            if len(updated_payloads) < original_count:
                current_data["payloads"] = updated_payloads
                write_json_file(DATA_FILE_PATH, current_data)

                # Clear retained message by publishing empty payload with retain=True
                try:
                    result = client.publish(topic, "", qos=1, retain=True)
                    logger.info(f"✓ Cleared retained message for topic: {topic}")
                except Exception as e:
                    logger.warning(f"Failed to clear retained message for topic {topic}: {e}")

                # Send success response to frontend
                response_payload = {
                    "status": "success",
                    "message": f"Successfully deleted topic {topic}",
                    "topic": topic
                }
                client.publish("response/data/delete", json.dumps(response_payload))
                logger.info(f"Deleted payload for topic: {topic}")

                # Immediately send updated data to frontend to refresh UI
                logger.info("Sending updated data to frontend after delete operation")
                handle_get_data(client)
            else:
                client.publish("response/data/delete", json.dumps({"status": "error", "message": f"No entry found with topic {topic}"}))
        else:
            # New format: direct array
            original_count = len(current_data)
            updated_payloads = [item for item in current_data if item.get("topic") != topic]

            if len(updated_payloads) < original_count:
                write_json_file(DATA_FILE_PATH, updated_payloads)

                # Clear retained message by publishing empty payload with retain=True
                try:
                    result = client.publish(topic, "", qos=1, retain=True)
                    logger.info(f"✓ Cleared retained message for topic: {topic}")
                except Exception as e:
                    logger.warning(f"Failed to clear retained message for topic {topic}: {e}")

                # Send success response to frontend
                response_payload = {
                    "status": "success",
                    "message": f"Successfully deleted topic {topic}",
                    "topic": topic
                }
                client.publish("response/data/delete", json.dumps(response_payload))
                logger.info(f"Deleted payload for topic: {topic}")

                # Immediately send updated data to frontend to refresh UI
                logger.info("Sending updated data to frontend after delete operation")
                handle_get_data(client)
            else:
                client.publish("response/data/delete", json.dumps({"status": "error", "message": f"No entry found with topic {topic}"}))
    else:
        client.publish("response/data/delete", json.dumps({"status": "error", "message": "No topic provided"}))

def send_data_periodically():
    """Send data periodically using template broker system with health monitoring."""
    last_publish_times = {}  # Track last publish time for each topic
    broker_resolver = BrokerResolver(DATA_FILE_PATH)  # Initialize broker resolver

    # Cleanup unhealthy connections periodically
    cleanup_counter = 0

    while True:
        try:
            data = read_json_file(DATA_FILE_PATH)
            if not data:
                time.sleep(5)
                continue

            # Handle both old format (dict) and new format (array)
            if isinstance(data, dict):
                payloads = data.get('payloads', [])
            else:
                payloads = data  # New format: direct array

            if not payloads:
                time.sleep(5)
                continue

            data_with_online = add_online_status(payloads)
            current_time = time.time()

            for item in data_with_online:
                topic = item.get("topic")
                payload = item.get("data")
                interval = item.get("interval", 5)

                if not topic or not payload or interval <= 0:
                    continue

                # Check if it's time to publish for this topic
                last_publish = last_publish_times.get(topic, 0)
                if current_time - last_publish >= interval:
                    try:
                        # Prepare payload data for broker resolver
                        payload_data = {
                            "qos": item.get("qos", 0),
                            "retain": item.get("retain", False),
                            "lwt": item.get("lwt", True),
                            "template_id": item.get("template_id"),
                            "broker_config": item.get("broker_config", {})
                        }

                        # Use broker resolver to publish
                        success = broker_resolver.publish_to_topic(topic, json.dumps(payload), payload_data)

                        if success:
                            last_publish_times[topic] = current_time
                            # Success logged to file only (no console spam)
                        else:
                            logger.warning(f"Failed to publish to {topic}")

                    except Exception as e:
                        logger.error(f"Publishing error for {topic}: {e}")

            # Periodic cleanup of unhealthy connections (every 60 seconds)
            cleanup_counter += 1
            if cleanup_counter >= 60:
                broker_resolver.cleanup_unhealthy_connections()
                cleanup_counter = 0
                logger.info("Broker connections cleaned up")

            time.sleep(1)

        except Exception as e:
            logger.error(f"Error in send_data_periodically: {e}")
            time.sleep(5)

# Set LWT for publisher client
set_lwt(pub_client)

# Start periodic publishing thread
publisher_thread = threading.Thread(target=send_data_periodically, daemon=True)
publisher_thread.start()

# Start MQTT loop
try:
    crud_client.loop_forever()
except KeyboardInterrupt:
    logger.info("Shutting down Payload Static service...")
    crud_client.disconnect()
    pub_client.disconnect()
except Exception as e:
    logger.error(f"Critical error in main loop: {e}")
    crud_client.disconnect()
    pub_client.disconnect()

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Payload Static ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Payload Static ===========")
    print("Success To Running")
    print("")

def print_broker_status(**brokers):
    """Print MQTT broker connection status"""
    for broker_name, status in brokers.items():
        if status:
            print(f"MQTT Broker {broker_name.title()} is Running")
        else:
            print(f"MQTT Broker {broker_name.title()} connection failed")
    
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
