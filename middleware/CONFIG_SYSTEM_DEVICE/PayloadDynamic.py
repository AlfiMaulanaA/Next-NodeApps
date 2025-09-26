import json
import paho.mqtt.client as mqtt
import time
import threading
import os
import logging
import statistics
from datetime import datetime
from collections import OrderedDict, defaultdict

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PayloadDynamicService")

# Paths to configuration and devices files
summary_config_path = './JSON/payloadDynamicConfig.json'
modular_installed_devices_path = '../MODULAR_I2C/JSON/Config/installed_devices.json'
modbus_snmp_installed_devices_path = '../MODBUS_SNMP/JSON/Config/installed_devices.json'
mqtt_config_path = '../MODULAR_I2C/JSON/Config/mqtt_config.json'

# MQTT Topics
TOPIC_CONFIG_SUMMARY = "config/summary_device"
TOPIC_CONFIG_SUMMARY_RESPONSE = f"{TOPIC_CONFIG_SUMMARY}/response"
TOPIC_CONFIG_DEVICE_INFO = "config/device_info"
TOPIC_CONFIG_DEVICE_INFO_RESPONSE = f"{TOPIC_CONFIG_DEVICE_INFO}/response"

ERROR_LOG_TOPIC = "subrack/error/log"

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

interval_publish =10

# MQTT broker addresses
crud_broker_address = "localhost"
crud_broker_port = 1883

# Load device broker configuration
with open(mqtt_config_path) as mqtt_config_file:
    mqtt_config = json.load(mqtt_config_file)

device_broker_address = mqtt_config['broker_address']
device_broker_port = mqtt_config['broker_port']

# Load summary configuration
def load_summary_config():
    if os.path.exists(summary_config_path):
        with open(summary_config_path) as summary_config_file:
            return json.load(summary_config_file)
    else:
        return {}

# Save summary configuration
def save_summary_config(data):
    try:
        with open(summary_config_path, 'w') as summary_config_file:
            json.dump(data, summary_config_file, indent=4)
        logger.info(f"Config saved successfully to {summary_config_path}")
    except IOError as e:
        logger.error(f"Failed to save config: {e}")

# Load installed devices information from both paths
def load_installed_devices():
    devices = []
    if os.path.exists(modular_installed_devices_path):
        with open(modular_installed_devices_path) as devices_file:
            devices += json.load(devices_file)
    if os.path.exists(modbus_snmp_installed_devices_path):
        with open(modbus_snmp_installed_devices_path) as devices_file:
            devices += json.load(devices_file)
    return devices

# Initialize the summary config at startup
summary_config = load_summary_config()
groups = summary_config.get('groups', [])

# Thread-safe data storage with locks
combined_data_lock = threading.Lock()
combined_data_per_group = defaultdict(dict)

# Performance monitoring
class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            "messages_processed": 0,
            "calculations_performed": 0,
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

# MQTT Callbacks
def on_device_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected successfully to device MQTT broker")
        devices = load_installed_devices()
        for device in devices:
            device_name = device['profile']['name']
            topic = device['profile']['topic']
            for group in groups:
                for included_device in group['included_devices']:
                    if device_name == included_device['name']:
                        client.subscribe(topic)
                        # print(f"Subscribed to {topic} (Device: {device_name}) for group {group['summary_topic']}")
                        break
    else:
        logger.error(f"Connection to device broker failed with code {rc}")

def on_crud_connect(client, userdata, flags, rc):
    if rc == 0:
        client.subscribe(TOPIC_CONFIG_SUMMARY)
        client.subscribe(TOPIC_CONFIG_DEVICE_INFO)
        # print(f"Subscribed to {TOPIC_CONFIG_SUMMARY} and {TOPIC_CONFIG_DEVICE_INFO} for configuration CRUD operations")
    else:
        logger.error(f"Connection to CRUD broker failed with code {rc}")

def on_crud_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode()

    if topic == TOPIC_CONFIG_SUMMARY:
        handle_crud_message(client, payload)
    elif topic == TOPIC_CONFIG_DEVICE_INFO:
        handle_device_info_message(client, payload)

def handle_crud_message(client, payload):
    try:
        data = json.loads(payload)
        command = data.get('command')

        if command == 'writeData':
            new_data = data.get('data', {})
            if validate_summary_data(new_data):
                update_summary_config(new_data)
                save_summary_config(summary_config)
                client.publish(TOPIC_CONFIG_SUMMARY_RESPONSE, json.dumps({"status": "success"}))
            else:
                client.publish(TOPIC_CONFIG_SUMMARY_RESPONSE, json.dumps({"status": "error", "message": "Invalid data"}))
        elif command == 'getData':
            config_data = load_summary_config()
            client.publish(TOPIC_CONFIG_SUMMARY_RESPONSE, json.dumps(config_data))

        elif command == 'deleteData':
            delete_data = data.get('data', {})
            delete_summary_config(delete_data)
            save_summary_config(summary_config)
            client.publish(TOPIC_CONFIG_SUMMARY_RESPONSE, json.dumps({"status": "success"}))
        else:
            client.publish(TOPIC_CONFIG_SUMMARY_RESPONSE, json.dumps({"status": "error", "message": "Invalid command"}))
    except json.JSONDecodeError:
        client.publish(TOPIC_CONFIG_SUMMARY_RESPONSE, json.dumps({"status": "error", "message": "Invalid JSON"}))

def validate_summary_data(data):
    if not data.get("summary_topic"):
        return False

    included_devices = data.get("included_devices", [])
    for device in included_devices:
        if "name" not in device or "value_keys" not in device:
            return False

    calculations = data.get("calculations", [])
    for calc in calculations:
        if not calc.get("operation") or not calc.get("name") or not calc.get("value_group_selected"):
            return False

    # Validate calculation_only if present
    if "calculation_only" in data and not isinstance(data["calculation_only"], bool):
        return False

    return True

def update_summary_config(new_data):
    global summary_config
    summary_topic = new_data.get("summary_topic")
    included_devices = new_data.get("included_devices", [])
    calculations = new_data.get("calculations", [])
    qos = new_data.get("qos", 0)
    retain = new_data.get("retain", False)
    interval = new_data.get("interval", 10)
    calculation_only = new_data.get("calculation_only", False)  # Default to False if not present

    if "groups" not in summary_config:
        summary_config["groups"] = []

    existing_group = next((group for group in summary_config["groups"] if group["summary_topic"] == summary_topic), None)

    if existing_group:
        existing_group["included_devices"] = included_devices
        existing_group["calculations"] = calculations
        existing_group["qos"] = qos
        existing_group["retain"] = retain
        existing_group["interval"] = interval
        existing_group["calculation_only"] = calculation_only
    else:
        summary_config["groups"].append({
            "summary_topic": summary_topic,
            "included_devices": included_devices,
            "calculations": calculations,
            "qos": qos,
            "retain": retain,
            "interval": interval,
            "calculation_only": calculation_only,
        })

# Delete data from summary config based on new data
def delete_summary_config(delete_data):
    global summary_config
    summary_topic = delete_data.get("summary_topic")
    device_name = delete_data.get("device_name")

    existing_group = next((group for group in summary_config["groups"] if group["summary_topic"] == summary_topic), None)

    if existing_group:
        if device_name:
            existing_group["included_devices"] = [device for device in existing_group["included_devices"] if device["name"] != device_name]
            # print(f"Device {device_name} deleted from group {summary_topic}")
        else:
            summary_config["groups"] = [group for group in summary_config["groups"] if group["summary_topic"] != summary_topic]
            # print(f"Group {summary_topic} deleted")
    else:
        logger.warning(f"Group {summary_topic} not found")

# Handle device info request
def handle_device_info_message(client, payload):
    try:
        data = json.loads(payload)
        command = data.get('command')

        if command == 'getDeviceInfo':
            devices = load_installed_devices()
            device_info = [{"name": device['profile']['name'], "part_number": device['profile'].get('part_number', 'N/A')}
                           for device in devices]
            client.publish(TOPIC_CONFIG_DEVICE_INFO_RESPONSE, json.dumps(device_info))
            # print(f"Sent device info: {device_info}")
        else:
            client.publish(TOPIC_CONFIG_DEVICE_INFO_RESPONSE, json.dumps({"status": "error", "message": "Invalid command"}))
            # print(f"Received invalid command for device info: {command}")
    except json.JSONDecodeError:
        client.publish(TOPIC_CONFIG_DEVICE_INFO_RESPONSE, json.dumps({"status": "error", "message": "Invalid JSON"}))
        # print("Error decoding JSON from device info message.")

# Handle device messages
def handle_device_message(client, userdata, msg):
    try:
        device_data = json.loads(msg.payload.decode())
        if isinstance(device_data, dict):
            # print(f"Received message from {msg.topic}: {device_data}")
            process_device_message(device_data, msg.topic)
        else:
            logger.warning(f"Unexpected data format in message from {msg.topic}: {device_data}")
    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON from {msg.topic}: {msg.payload.decode()}")

def perform_calculation(operation, values):
    """Perform mathematical operations with enhanced error handling."""
    try:
        # Filter out non-numeric values
        numeric_values = []
        for value in values:
            if isinstance(value, (int, float)):
                numeric_values.append(value)
            elif isinstance(value, str):
                try:
                    numeric_values.append(float(value))
                except (ValueError, TypeError):
                    continue

        if not numeric_values:
            logger.warning(f"No numeric values found for operation: {operation}")
            return None

        if operation == "sum":
            return sum(numeric_values)
        elif operation == "average":
            return sum(numeric_values) / len(numeric_values)
        elif operation == "multiply":
            result = 1
            for value in numeric_values:
                result *= value
            return result
        elif operation == "divide":
            if len(numeric_values) < 2:
                logger.warning("Division requires at least 2 values")
                return None
            result = numeric_values[0]
            for value in numeric_values[1:]:
                if value == 0:
                    logger.error("Division by zero encountered")
                    return None
                result /= value
            return result
        elif operation == "min":
            return min(numeric_values)
        elif operation == "max":
            return max(numeric_values)
        elif operation == "median":
            sorted_values = sorted(numeric_values)
            n = len(sorted_values)
            if n % 2 == 0:
                return (sorted_values[n//2 - 1] + sorted_values[n//2]) / 2
            else:
                return sorted_values[n//2]
        elif operation == "std_dev":
            if len(numeric_values) > 1:
                return statistics.stdev(numeric_values)
            else:
                return 0
        elif operation == "count":
            return len(numeric_values)
        else:
            logger.warning(f"Unsupported operation: {operation}")
            return None
    except Exception as e:
        logger.error(f"Error during calculation {operation}: {e}")
        performance_monitor.increment_counter("errors_encountered")
        return None

def process_device_message(device_data, topic):
    """Thread-safe device message processing with performance monitoring."""
    start_time = time.time()

    try:
        devices = load_installed_devices()
        for device in devices:
            if device['profile']['topic'] == topic:
                device_name = device['profile']['name']

                with combined_data_lock:
                    for group in groups:
                        for included_device in group['included_devices']:
                            if device_name == included_device['name']:
                                value_group = included_device.get("value_group")
                                filtered_value = filter_and_rename_device_value(device_data, included_device['value_keys'])

                                # Initialize group data if not exists
                                if group['summary_topic'] not in combined_data_per_group:
                                    combined_data_per_group[group['summary_topic']] = {}

                                group_data = combined_data_per_group[group['summary_topic']]

                                # Update value group or general group data
                                if value_group:
                                    if value_group not in group_data:
                                        group_data[value_group] = {}
                                    group_data[value_group].update(filtered_value)
                                else:
                                    group_data.update(filtered_value)

                                # Update timestamp
                                group_data["Timestamp"] = device_data.get("Timestamp", datetime.utcnow().isoformat())

                                # Perform calculations
                                calculations = group.get("calculations", [])
                                for calc in calculations:
                                    try:
                                        value_group_selected = calc["value_group_selected"]
                                        operation = calc["operation"]
                                        calc_name = calc["name"]

                                        if value_group_selected in group_data:
                                            values_group = group_data[value_group_selected]
                                            if isinstance(values_group, dict):
                                                # Extract numeric values only
                                                values = []
                                                for key, value in values_group.items():
                                                    if isinstance(value, (int, float)):
                                                        values.append(value)
                                                    elif isinstance(value, str):
                                                        try:
                                                            values.append(float(value))
                                                        except (ValueError, TypeError):
                                                            continue

                                                if values:
                                                    result = perform_calculation(operation, values)
                                                    if result is not None:
                                                        group_data[calc_name] = result
                                                        performance_monitor.increment_counter("calculations_performed")
                                                        logger.debug(f"Calculation {calc_name}: {operation} = {result}")
                                                    else:
                                                        logger.warning(f"Calculation failed for {calc_name}")
                                                else:
                                                    logger.warning(f"No numeric values found for calculation {calc_name}")
                                            else:
                                                logger.warning(f"Value group {value_group_selected} is not a dict")
                                        else:
                                            logger.warning(f"Value group {value_group_selected} not found in data")
                                    except Exception as e:
                                        logger.error(f"Error in calculation {calc.get('name', 'unknown')}: {e}")

                                logger.debug(f"Processed: {device_name} in group {group['summary_topic']}")
                                performance_monitor.increment_counter("messages_processed")
                break

        # Record processing time
        processing_time = time.time() - start_time
        performance_monitor.record_processing_time(processing_time)

    except Exception as e:
        logger.error(f"Error processing device message: {e}")
        performance_monitor.increment_counter("errors_encountered")

# Extract specified key-value pairs from "value" field and rename them
def filter_and_rename_device_value(device_data, value_keys):
    """Improved data filtering with better error handling and type conversion."""
    filtered_value = {}

    try:
        # Handle different data formats
        if isinstance(device_data, dict):
            if "value" in device_data:
                value_data = device_data["value"]
                if isinstance(value_data, str):
                    value_data = json.loads(value_data)
                elif not isinstance(value_data, dict):
                    logger.warning(f"Unexpected value format: {type(value_data)}")
                    return filtered_value
            else:
                # Direct data without "value" wrapper
                value_data = device_data
        else:
            logger.warning(f"Device data is not a dict: {type(device_data)}")
            return filtered_value

        # Extract specified keys with type conversion
        for original_key, custom_key in value_keys.items():
            if original_key in value_data:
                raw_value = value_data[original_key]
                # Convert string numbers to float/int
                if isinstance(raw_value, str):
                    try:
                        # Try float first, then int
                        if '.' in raw_value:
                            filtered_value[custom_key] = float(raw_value)
                        else:
                            filtered_value[custom_key] = int(raw_value)
                    except ValueError:
                        filtered_value[custom_key] = raw_value
                else:
                    filtered_value[custom_key] = raw_value

    except (json.JSONDecodeError, TypeError, KeyError) as e:
        logger.error(f"Error processing device data: {e}")
        performance_monitor.increment_counter("errors_encountered")

    return filtered_value

def cleanup_old_data(max_age_seconds=3600):
    """Remove old data to prevent memory leaks."""
    cutoff_time = datetime.utcnow().timestamp() - max_age_seconds

    with combined_data_lock:
        groups_to_cleanup = []
        for group_topic, group_data in combined_data_per_group.items():
            timestamp_str = group_data.get("Timestamp")
            if timestamp_str:
                try:
                    # Parse ISO timestamp
                    data_timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00')).timestamp()
                    if data_timestamp < cutoff_time:
                        groups_to_cleanup.append(group_topic)
                except (ValueError, AttributeError) as e:
                    logger.warning(f"Could not parse timestamp for cleanup: {timestamp_str}")

        for group_topic in groups_to_cleanup:
            logger.info(f"Cleaning up old data for group: {group_topic}")
            combined_data_per_group[group_topic] = {"Timestamp": datetime.utcnow().isoformat()}

def publish_group_data(client, group):
    """Thread-safe data publishing with performance monitoring."""
    summary_topic = group['summary_topic']
    qos = group.get('qos', 0)
    retain = group.get('retain', False)
    interval = group.get('interval', 10)
    calculation_only = group.get("calculation_only", False)

    while True:
        try:
            with combined_data_lock:
                combined_data = combined_data_per_group.get(summary_topic, {})

            if combined_data:
                ordered_combined_data = OrderedDict()

                if calculation_only:
                    for key, value in combined_data.items():
                        if key != "Timestamp" and not isinstance(value, dict):
                            ordered_combined_data[key] = value
                    ordered_combined_data["Timestamp"] = combined_data.get("Timestamp", datetime.utcnow().isoformat())
                else:
                    for key, value in combined_data.items():
                        ordered_combined_data[key] = value
                    ordered_combined_data["Timestamp"] = combined_data.get("Timestamp", datetime.utcnow().isoformat())

                # Handle JSON formatting for "value" field
                if "value" in ordered_combined_data:
                    try:
                        formatted_value = json.dumps(ordered_combined_data["value"])
                        ordered_combined_data["value"] = formatted_value
                    except (TypeError, ValueError) as e:
                        logger.warning(f"Could not format 'value' field for {summary_topic}: {e}")

                # Convert to JSON
                try:
                    combined_json = json.dumps(ordered_combined_data, separators=(',', ':'))

                    # Publish to MQTT
                    result = client.publish(summary_topic, combined_json, qos=qos, retain=retain)
                    if result.rc == 0:
                        performance_monitor.increment_counter("publish_operations")
                        logger.debug(f"Published formatted data to {summary_topic}")
                    else:
                        logger.warning(f"Failed to publish to {summary_topic}, MQTT error code: {result.rc}")
                except (TypeError, ValueError) as e:
                    logger.error(f"Failed to serialize data for {summary_topic}: {e}")
                    performance_monitor.increment_counter("errors_encountered")
            else:
                logger.debug(f"No data to publish yet for {summary_topic}")
                log_error(client, f"No data to publish yet for {summary_topic}", "warning")

        except Exception as e:
            logger.error(f"Error in publish loop for {summary_topic}: {e}")
            performance_monitor.increment_counter("errors_encountered")

        time.sleep(interval)

def mqtt_connection_handler():
    # Load MQTT config
    with open(mqtt_config_path) as mqtt_config_file:
        mqtt_config = json.load(mqtt_config_file)
    
    # Device Broker Config
    device_username = mqtt_config.get("username")
    device_password = mqtt_config.get("password")

    # Device MQTT Client
    device_client = mqtt.Client()
    if device_username and device_password:
        device_client.username_pw_set(device_username, device_password)
    device_client.on_connect = on_device_connect
    device_client.on_message = handle_device_message
    device_client.connect(mqtt_config['broker_address'], mqtt_config['broker_port'], 60)

    # CRUD MQTT Client
    crud_client = mqtt.Client()
    if device_username and device_password:
        crud_client.username_pw_set(device_username, device_password)
    crud_client.on_connect = on_crud_connect
    crud_client.on_message = on_crud_message
    crud_client.connect(crud_broker_address, crud_broker_port, 60)

    # Start publishing data for each group
    for group in groups:
        publish_thread = threading.Thread(target=publish_group_data, args=(device_client, group))
        publish_thread.daemon = True
        publish_thread.start()

    # Start cleanup thread to prevent memory leaks
    cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
    cleanup_thread.start()

    # Start the MQTT loops
    crud_client.loop_start()
    device_client.loop_forever()

def cleanup_worker():
    """Background worker to periodically clean up old data."""
    while True:
        try:
            cleanup_old_data(max_age_seconds=3600)  # Clean data older than 1 hour
            time.sleep(300)  # Run cleanup every 5 minutes
        except Exception as e:
            logger.error(f"Error in cleanup worker: {e}")
            time.sleep(300)

# Start the MQTT connection handler
if __name__ == "__main__":
    mqtt_connection_handler()

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Payload Dynamic ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Payload Dynamic ===========")
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
