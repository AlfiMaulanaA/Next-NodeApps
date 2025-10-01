import json
import time
import threading
from threading import Lock
import paho.mqtt.client as mqtt
import logging
import statistics
from datetime import datetime
from collections import defaultdict

CONFIG_FILE_PATH = "../MODULAR_I2C/JSON/Config/mqtt_config.json"
DATA_FILE_PATH = "./JSON/payloadStaticConfig.json"
ERROR_LOG_TOPIC = "subrack/error/log"

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PayloadStaticService")

json_lock = Lock()

# Performance monitoring
class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            "messages_processed": 0,
            "publish_operations": 0,
            "errors_encountered": 0,
            "average_processing_time": 0.0
        }
        self.processing_times = []
        self.lock = threading.Lock()

    def record_processing_time(self, time_taken):
        with self.lock:
            self.processing_times.append(time_taken)
            if len(self.processing_times) > 100:  # Keep last 100 measurements
                self.processing_times.pop(0)
            self.metrics["average_processing_time"] = sum(self.processing_times) / len(self.processing_times)

    def increment_counter(self, metric_name):
        with self.lock:
            if metric_name in self.metrics:
                self.metrics[metric_name] += 1

    def get_metrics(self):
        with self.lock:
            return self.metrics.copy()

performance_monitor = PerformanceMonitor()

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
    default_config = {
        "broker_address": "localhost",
        "broker_port": 1883,
        "username": "",
        "password": "",
        "qos": 1,
        "retain": True
    }

    while True:
        try:
            with open(CONFIG_FILE_PATH, "r") as file:
                content = file.read().strip()
                if not content:
                    logger.warning(f"MQTT config file is empty. Retrying in 5 seconds...")
                    time.sleep(5)
                    continue
                config = json.loads(content)
            return {
                "broker": config.get("broker_address", "localhost"),
                "port": config.get("broker_port", 1883),
                "username": config.get("username", ""),
                "password": config.get("password", "")
            }
        except FileNotFoundError:
            logger.warning(f"MQTT config file not found. Creating default config and retrying...")
            try:
                import os
                os.makedirs(os.path.dirname(CONFIG_FILE_PATH), exist_ok=True)
                with open(CONFIG_FILE_PATH, 'w') as file:
                    json.dump(default_config, file, indent=4)
                logger.info(f"Created default MQTT config file: {CONFIG_FILE_PATH}")
            except Exception as create_error:
                logger.error(f"Failed to create config file: {create_error}. Retrying in 5 seconds...")
                time.sleep(5)
                continue
        except json.JSONDecodeError as e:
            logger.error(f"Error decoding MQTT config: {e}. Using defaults.")
            return {"broker": "localhost", "port": 1883, "username": "", "password": ""}
        except Exception as e:
            logger.error(f"Failed to load MQTT configuration: {e}. Retrying in 5 seconds...")
            time.sleep(5)
            continue

mqtt_config = load_mqtt_config()

# Define callback functions before using them
def on_crud_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("CRUD client connected successfully")
        client.subscribe("command/data/payload")
        client.subscribe("command/data/metrics")  # Subscribe to metrics requests
    else:
        logger.error(f"CRUD client connection failed with code {rc}")

def on_crud_disconnect(client, userdata, rc):
    logger.warning(f"CRUD client disconnected with code {rc}")

def on_pub_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Publisher client connected successfully")
    else:
        logger.error(f"Publisher client connection failed with code {rc}")

def on_pub_disconnect(client, userdata, rc):
    logger.warning(f"Publisher client disconnected with code {rc}")

def handle_metrics_request(client, msg):
    """Handle requests for performance metrics."""
    try:
        metrics = performance_monitor.get_metrics()
        client.publish("response/data/metrics", json.dumps(metrics))
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        client.publish("response/data/metrics", json.dumps({"error": str(e)}))

# Update message handler to include metrics
def handle_message(client, msg):
    start_time = time.time()

    try:
        if msg.topic == "command/data/metrics":
            handle_metrics_request(client, msg)
            return

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
            performance_monitor.increment_counter("errors_encountered")

        performance_monitor.increment_counter("messages_processed")

    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON: {e}")
        log_error(client, f"Error decoding JSON: {e}", "major")
        performance_monitor.increment_counter("errors_encountered")
    except Exception as e:
        logger.error(f"Unexpected error in handle_message: {e}")
        performance_monitor.increment_counter("errors_encountered")

    # Record processing time
    processing_time = time.time() - start_time
    performance_monitor.record_processing_time(processing_time)

# CRUD Client for localhost broker
crud_client = mqtt.Client(client_id="payload_static_crud", clean_session=False)
crud_client.on_connect = on_crud_connect
crud_client.on_disconnect = on_crud_disconnect
crud_client.on_message = handle_message

# Periodic Publisher Client from config
pub_client = mqtt.Client(client_id="payload_static_pub", clean_session=False)
if mqtt_config["username"] and mqtt_config["password"]:
    pub_client.username_pw_set(mqtt_config["username"], mqtt_config["password"])
pub_client.on_connect = on_pub_connect
pub_client.on_disconnect = on_pub_disconnect

# Connect clients with error handling
try:
    crud_client.connect("localhost", 1883, 60)
except Exception as e:
    logger.error(f"Failed to connect CRUD client: {e}")

try:
    pub_client.connect(mqtt_config["broker"], mqtt_config["port"], 60)
except Exception as e:
    logger.error(f"Failed to connect publisher client: {e}")

def add_online_status(data):
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
    if not data:
        logger.info("No data available to set LWT.")
        return
    for item in data:
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
    data = read_json_file(DATA_FILE_PATH)
    client.publish("response/data/payload", json.dumps(data))

def handle_write_data(client, payload):
    new_entry = payload.get("data")
    if new_entry and isinstance(new_entry, dict):
        current_data = read_json_file(DATA_FILE_PATH)
        new_entry["interval"] = payload.get("interval", 0)
        new_entry["qos"] = payload.get("qos", 0)
        new_entry["lwt"] = payload.get("lwt", True)
        new_entry["retain"] = payload.get("retain", False)
        current_data.append(new_entry)
        write_json_file(DATA_FILE_PATH, current_data)
        client.publish("response/data/write", json.dumps({"status": "success", "data": new_entry}))
    else:
        client.publish("response/data/write", json.dumps({"status": "error", "message": "Invalid data format"}))

def handle_update_data(client, payload):
    topic = payload.get("topic")
    updated_data = payload.get("data")
    if topic and updated_data:
        current_data = read_json_file(DATA_FILE_PATH)
        for item in current_data:
            if item.get("topic") == topic:
                item["data"] = {field["key"]: field["value"] for field in updated_data}
                item["interval"] = payload.get("interval", item.get("interval", 0))
                item["qos"] = payload.get("qos", item.get("qos", 0))
                item["lwt"] = payload.get("lwt", item.get("lwt", True))
                item["retain"] = payload.get("retain", item.get("retain", True))
                write_json_file(DATA_FILE_PATH, current_data)
                update_lwt(pub_client, item)
                client.publish("response/data/update", json.dumps({"status": "success", "topic": topic, "data": updated_data}))
                return
        client.publish("response/data/update", json.dumps({"status": "error", "message": f"No entry found with topic {topic}"}))

def handle_delete_data(client, payload):
    topic = payload.get("topic")
    if topic:
        current_data = read_json_file(DATA_FILE_PATH)
        updated_data = [item for item in current_data if item.get("topic") != topic]
        if len(updated_data) < len(current_data):
            write_json_file(DATA_FILE_PATH, updated_data)
            client.publish("response/data/delete", json.dumps({"status": "success", "topic": topic}))
        else:
            client.publish("response/data/delete", json.dumps({"status": "error", "message": f"No entry found with topic {topic}"}))

def send_data_periodically(client):
    """Send data periodically with individual intervals and performance monitoring."""
    last_publish_times = {}  # Track last publish time for each topic

    while True:
        try:
            data = read_json_file(DATA_FILE_PATH)
            if data:
                data_with_online = add_online_status(data)
                current_time = time.time()

                for item in data_with_online:
                    topic = item.get("topic")
                    payload = item.get("data")
                    interval = item.get("interval", 5)  # Default 5 seconds if not set
                    qos = item.get("qos", 1)
                    retain = item.get("retain", False)

                    if topic and payload and interval > 0:
                        # Check if it's time to publish for this topic
                        last_publish = last_publish_times.get(topic, 0)
                        if current_time - last_publish >= interval:
                            try:
                                result = client.publish(topic, json.dumps(payload), qos=qos, retain=retain)
                                if result.rc == 0:
                                    performance_monitor.increment_counter("publish_operations")
                                    last_publish_times[topic] = current_time
                                    logger.debug(f"Published static data to {topic} (interval: {interval}s)")
                                else:
                                    logger.warning(f"Failed to publish to {topic}, MQTT error code: {result.rc}")
                            except Exception as e:
                                logger.error(f"Error publishing to {topic}: {e}")
                                performance_monitor.increment_counter("errors_encountered")

            # Sleep for 1 second to check intervals frequently
            time.sleep(1)

        except Exception as e:
            logger.error(f"Error in send_data_periodically: {e}")
            performance_monitor.increment_counter("errors_encountered")
            time.sleep(5)  # Sleep longer on error

# Set LWT for publisher client
set_lwt(pub_client)

# Start periodic publishing thread
publisher_thread = threading.Thread(target=send_data_periodically, args=(pub_client,), daemon=True)
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
