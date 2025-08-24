import json
import time
import threading
from threading import Lock
import paho.mqtt.client as mqtt
from datetime import datetime

CONFIG_FILE_PATH = "../MODULAR_I2C/JSON/Config/mqtt_config.json"
DATA_FILE_PATH = "./JSON/payloadStaticConfig.json"
ERROR_LOG_TOPIC = "subrack/error/log"

json_lock = Lock()

# Publish error log to MQTT
def log_error(client, error_message, error_type):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    error_payload = {
        "data": error_message,
        "type": error_type,
        "Timestamp": timestamp
    }
    print(f"Error: {error_message}, Type: {error_type}")
    client.publish(ERROR_LOG_TOPIC, json.dumps(error_payload))

def read_json_file(file_path):
    with json_lock:
        try:
            with open(file_path, "r") as file:
                return json.load(file)
        except Exception as e:
            print(f"Error reading JSON file at {file_path}: {e}")
            return []

def write_json_file(file_path, data):
    with json_lock:
        try:
            with open(file_path, "w") as file:
                json.dump(data, file, indent=2)
        except Exception as e:
            print(f"Error writing JSON file at {file_path}: {e}")

def load_mqtt_config():
    try:
        with open(CONFIG_FILE_PATH, "r") as file:
            config = json.load(file)
        return {
            "broker": config.get("broker_address", "localhost"),
            "port": config.get("broker_port", 1883),
            "username": config.get("username", ""),
            "password": config.get("password", "")
        }
    except Exception as e:
        print(f"Failed to load MQTT configuration: {e}")
        return {"broker": "localhost", "port": 1883, "username": "", "password": ""}

mqtt_config = load_mqtt_config()

# CRUD Client for localhost broker
crud_client = mqtt.Client()
crud_client.on_connect = lambda client, userdata, flags, rc: print(f"[CRUD] Connected with result code {rc}")
crud_client.on_message = lambda client, userdata, msg: handle_message(client, msg)
crud_client.connect("localhost", 1883, 60)
crud_client.subscribe("command/data/payload")

# Periodic Publisher Client from config
pub_client = mqtt.Client()
if mqtt_config["username"] and mqtt_config["password"]:
    pub_client.username_pw_set(mqtt_config["username"], mqtt_config["password"])

def add_online_status(data):
    for item in data:
        topic = item.get("topic")
        item_data = item.get("data", {})
        lwt_status = item.get("lwt", True)
        if not isinstance(item_data, dict):
            print(f"Skipping invalid data format for topic {topic}: {item_data}")
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
        print("No data available to set LWT.")
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

def handle_message(client, msg):
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
            print("Unknown command received.")
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        log_error(client, f"Error decoding JSON: {e}", "major")

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
    while True:
        data = read_json_file(DATA_FILE_PATH)
        if data:
            data_with_online = add_online_status(data)
            for item in data_with_online:
                topic = item.get("topic")
                payload = item.get("data")
                if topic and payload:
                    client.publish(topic, json.dumps(payload), qos=1)
        time.sleep(5)

# Atur LWT dan koneksi client publish
set_lwt(pub_client)
pub_client.connect(mqtt_config["broker"], mqtt_config["port"], 60)

# Mulai thread periodik dan loop MQTT
threading.Thread(target=send_data_periodically, args=(pub_client,), daemon=True).start()
crud_client.loop_forever()

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
