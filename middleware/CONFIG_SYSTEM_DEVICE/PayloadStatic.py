import json
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

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PayloadStaticService")

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
        if lwt_status:
            item["data"] = {"online": 1, **item_data}
        else:
            item_data.pop("online", None)
            item["data"] = item_data
    return data

def set_lwt(client):
    data = read_json_file(DATA_FILE_PATH)
    if not data or not isinstance(data, dict):
        logger.info("No valid data available to set LWT.")
        return

    # Handle new format with templates + payloads structure
    payloads = data.get('payloads', [])
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
    logger.info("[DEBUG] Processing getData command")
    data = read_json_file(DATA_FILE_PATH)
    logger.info(f"[DEBUG] Read {len(data)} items from JSON file")
    logger.debug(f"[DEBUG] Data contents: {data}")

    json_response = json.dumps(data)
    logger.info(f"[DEBUG] Publishing response to response/data/payload, length: {len(json_response)}")
    logger.debug(f"[DEBUG] JSON response: {json_response}")

    result = client.publish("response/data/payload", json_response)
    logger.info(f"[DEBUG] Publish result: {result}")
    if result.rc == 0:
        logger.info("[DEBUG] Successfully published getData response")
    else:
        logger.error(f"[DEBUG] Failed to publish getData response, code: {result.rc}")

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
            # Initialize with new format
            current_data = {"templates": [], "payloads": []}

        # Handle both old format (list) and new format (dict with payloads)
        if isinstance(current_data, list):
            # Convert old format to new format
            current_data = {
                "templates": [],
                "payloads": current_data
            }

        # Add new entry to payloads
        current_data["payloads"].append(new_entry)
        write_json_file(DATA_FILE_PATH, current_data)

        # Set LWT for the new entry
        update_lwt(pub_client, new_entry)

        client.publish("response/data/write", json.dumps({
            "status": "success",
            "message": f"Data created for topic {topic}",
            "data": new_entry
        }))
        logger.info(f"Successfully created new payload entry for topic: {topic} with template: {template_id}")

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

        # Handle both old format (list) and new format (dict with payloads)
        if isinstance(current_data, list):
            # Convert old format to new format
            current_data = {
                "templates": [],
                "payloads": current_data
            }

        payloads = current_data.get('payloads', [])

        # Find and update the payload
        for i, item in enumerate(payloads):
            if item.get("topic") == original_topic:
                old_topic = item.get("topic")

                # Update the topic if it has changed
                if new_topic and new_topic != old_topic:
                    current_data["payloads"][i]["topic"] = new_topic
                    logger.info(f"Topic updated from '{old_topic}' to '{new_topic}'")

                # Update the data field - frontend sends array of {key, value} objects
                if updated_data and isinstance(updated_data, list):
                    current_data["payloads"][i]["data"] = {field["key"]: field["value"] for field in updated_data}
                elif updated_data and isinstance(updated_data, dict):
                    current_data["payloads"][i]["data"] = updated_data

                # Update other fields
                current_data["payloads"][i]["interval"] = payload.get("interval", item.get("interval", 0))
                current_data["payloads"][i]["qos"] = payload.get("qos", item.get("qos", 0))
                current_data["payloads"][i]["lwt"] = payload.get("lwt", item.get("lwt", True))
                current_data["payloads"][i]["retain"] = payload.get("retain", item.get("retain", False))

                # Update template if provided
                if payload.get("template_id"):
                    current_data["payloads"][i]["template_id"] = payload.get("template_id")
                    current_data["payloads"][i]["broker_config"] = {
                        "template_id": payload.get("template_id"),
                        "overrides": {}
                    }

                # Update timestamp and version
                current_data["payloads"][i]["updated_at"] = datetime.now().isoformat()
                current_data["payloads"][i]["version"] = item.get("version", 1) + 1

                write_json_file(DATA_FILE_PATH, current_data)
                update_lwt(pub_client, current_data["payloads"][i])

                # Clear retained message for old topic if topic changed
                if new_topic and new_topic != old_topic:
                    try:
                        result = client.publish(old_topic, "", qos=1, retain=True)
                        logger.info(f"✓ Cleared retained message for old topic: {old_topic}")
                    except Exception as e:
                        logger.warning(f"Failed to clear retained message for old topic {old_topic}: {e}")

                client.publish("response/data/update", json.dumps({
                    "status": "success",
                    "message": f"Data updated for topic {new_topic}",
                    "topic": new_topic,
                    "data": current_data["payloads"][i]
                }))
                logger.info(f"Successfully updated payload entry for topic: {new_topic}")
                return

        client.publish("response/data/update", json.dumps({"status": "error", "message": f"No entry found with topic {original_topic}"}))

    except Exception as e:
        logger.error(f"Error in handle_update_data: {e}")
        client.publish("response/data/update", json.dumps({"status": "error", "message": str(e)}))

def handle_delete_data(client, payload):
    topic = payload.get("topic")
    if topic:
        current_data = read_json_file(DATA_FILE_PATH)

        # Handle both old format (list) and new format (dict with payloads)
        if isinstance(current_data, list):
            # Convert old format to new format
            current_data = {
                "templates": [],
                "payloads": current_data
            }

        payloads = current_data.get('payloads', [])
        original_count = len(payloads)

        # Filter out the topic to delete
        updated_payloads = [item for item in payloads if item.get("topic") != topic]

        if len(updated_payloads) < original_count:
            # Update the data structure
            current_data["payloads"] = updated_payloads
            write_json_file(DATA_FILE_PATH, current_data)

            # Clear retained message by publishing empty payload with retain=True
            try:
                result = client.publish(topic, "", qos=1, retain=True)
                logger.info(f"✓ Cleared retained message for topic: {topic}")
            except Exception as e:
                logger.warning(f"Failed to clear retained message for topic {topic}: {e}")

            client.publish("response/data/delete", json.dumps({"status": "success", "topic": topic}))
            logger.info(f"Successfully deleted payload entry for topic: {topic}")
        else:
            client.publish("response/data/delete", json.dumps({"status": "error", "message": f"No entry found with topic {topic}"}))

def send_data_periodically():
    """Send data periodically using template broker system with health monitoring."""
    last_publish_times = {}  # Track last publish time for each topic
    broker_resolver = BrokerResolver(DATA_FILE_PATH)  # Initialize broker resolver

    # Cleanup unhealthy connections periodically
    cleanup_counter = 0

    while True:
        try:
            data = read_json_file(DATA_FILE_PATH)
            if not data or not isinstance(data, dict):
                logger.warning("No valid payload data found or invalid format")
                time.sleep(5)
                continue

            # Get payloads array
            payloads = data.get('payloads', [])
            if not payloads:
                logger.warning("No payloads configured")
                time.sleep(5)
                continue

            data_with_online = add_online_status(payloads)
            current_time = time.time()

            for item in data_with_online:
                topic = item.get("topic")
                payload = item.get("data")
                interval = item.get("interval", 5)  # Default 5 seconds if not set

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
                            logger.info(f"✅ Published static data to {topic} (interval: {interval}s, template: {item.get('template_id')})")
                        else:
                            logger.warning(f"❌ Failed to publish to {topic} using template system")

                    except Exception as e:
                        logger.error(f"Error publishing to {topic}: {e}")

            # Periodic cleanup of unhealthy connections
            cleanup_counter += 1
            if cleanup_counter >= 60:  # Every 60 seconds
                broker_resolver.cleanup_unhealthy_connections()
                cleanup_counter = 0

                # Log health report
                health_report = broker_resolver.get_broker_health_report()
                logger.info(f"Broker Health Report: {health_report}")

            # Sleep for 1 second to check intervals frequently
            time.sleep(1)

        except Exception as e:
            logger.error(f"Error in send_data_periodically: {e}")
            time.sleep(5)  # Sleep longer on error

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