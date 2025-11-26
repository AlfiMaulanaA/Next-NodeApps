import json
import time
import paho.mqtt.client as mqtt
from datetime import datetime
import uuid
import logging
import os
import threading
import sys # Import sys for sys.exit()

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("DeviceLibraryService")

# --- GLOBAL CONFIGURATION ---
DEBUG_MODE = True

# File Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PATH_DEVICES_LIBRARY = os.path.join(BASE_DIR, '../MODBUS_SNMP/JSON/Config/Library/devices.json')

# MQTT Topics
MQTT_BROKER = "18.143.215.113"
MQTT_PORT = 1883
QOS = 1

TOPIC_LIBRARY_DEVICES_SUMMARY = "library/devices/summary"
TOPIC_LIBRARY_SEARCH_COMMAND = "library/devices/summary/search"
TOPIC_LIBRARY_SEARCH_RESPONSE = "library/devices/summary/search/response"
TOPIC_LIBRARY_COMMAND = "library/devices/command"
TOPIC_LIBRARY_COMMAND_RESPONSE = "library/devices/command/response"
TOPIC_LIBRARY_EDIT_LOAD_COMMAND = "library/devices/edit/load"
TOPIC_LIBRARY_EDIT_LOAD_RESPONSE = "library/devices/edit/load/response"

# Centralized Error Logging
ERROR_LOG_TOPIC = "subrack/error/log"
error_logger_client = None
ERROR_LOGGER_CLIENT_ID = f'device-lib-error-logger-{uuid.uuid4()}'

# --- Error Logging Client Callbacks ---
def on_error_logger_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to dedicated Error Log MQTT Broker (18.143.215.113).")
    else:
        logger.error(f"Failed to connect dedicated Error Log MQTT Broker, return code: {rc}")

def on_error_logger_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning(f"Unexpected disconnect from Error Log broker with code {rc}. Attempting reconnect...")
    else:
        logger.info("Error Log client disconnected normally.")

def initialize_error_logger():
    global error_logger_client
    try:
        error_logger_client = mqtt.Client(client_id=ERROR_LOGGER_CLIENT_ID, protocol=mqtt.MQTTv311, clean_session=True)
        error_logger_client.on_connect = on_error_logger_connect
        error_logger_client.on_disconnect = on_error_logger_disconnect
        error_logger_client.reconnect_delay_set(min_delay=1, max_delay=120)
        error_logger_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        error_logger_client.loop_start()
        logger.info(f"Dedicated error logger client initialized and started loop to {MQTT_BROKER}:{MQTT_PORT}")
    except Exception as e:
        logger.critical(f"FATAL: Failed to initialize dedicated error logger: {e}", exc_info=True)

def send_error_log(function_name, error_detail, error_type, additional_info=None):
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Generate ID consistent with other services
    unique_id_fragment = str(uuid.uuid4().int % 10000000000)
    log_id = f"DeviceLibraryService--{int(time.time())}-{unique_id_fragment}"

    error_payload = {
        "data": f"[{function_name}] {error_detail}",
        "type": error_type.upper(),
        "source": "DeviceLibraryService",
        "Timestamp": timestamp_str,
        "id": log_id,
        "status": "active",
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
    
    if error_type.lower() == "critical":
        logger.critical(f"[{function_name}] {error_detail}")
    elif error_type.lower() == "major":
        logger.error(f"[{function_name}] {error_detail}")
    elif error_type.lower() == "minor":
        logger.warning(f"[{function_name}] {error_detail}")
    else:
        logger.info(f"[{function_name}] {error_detail}")

# --- File Operations ---
def ensure_directory_exists(file_path):
    directory = os.path.dirname(file_path)
    if directory and not os.path.exists(directory):
        try:
            os.makedirs(directory)
            logger.info(f"Created directory: {directory}")
        except OSError as e:
            send_error_log("ensure_directory_exists", f"Failed to create directory {directory}: {e}", "critical", {"path": directory, "error": str(e)})
            sys.exit(1)

def read_devices_json(file_path):
    ensure_directory_exists(file_path)
    try:
        if not os.path.exists(file_path):
            send_error_log("read_devices_json", f"Device library file not found: {file_path}. Returning empty dict.", "major", {"file_path": file_path})
            return {}
        with open(file_path, 'r') as file:
            data = json.load(file)
        return data
    except json.JSONDecodeError as e:
        send_error_log("read_devices_json", f"Error decoding JSON from {file_path}: {e}. Returning empty dict.", "critical", {"file_path": file_path, "error": str(e)})
        return {}
    except Exception as e:
        send_error_log("read_devices_json", f"Unexpected error reading {file_path}: {e}. Returning empty dict.", "critical", {"file_path": file_path, "error": str(e)})
        return {}

def write_devices_json(file_path, data):
    ensure_directory_exists(file_path)
    try:
        with open(file_path, 'w') as file:
            json.dump(data, file, indent=4)
        logger.info(f"Successfully wrote data to {file_path}.")
    except IOError as e:
        send_error_log("write_devices_json", f"IOError writing to {file_path}: {e}", "critical", {"file_path": file_path, "error": str(e)})
    except Exception as e:
        send_error_log("write_devices_json", f"Unexpected error writing to {file_path}: {e}", "critical", {"file_path": file_path, "error": str(e)})

# --- Device Library Logic ---
def search_device(devices_data, search_params):
    section = search_params.get("section")
    
    if section not in devices_data:
        send_error_log("search_device", f"Section '{section}' does not exist.", "minor", {"search_params": search_params})
        return {"error": f"Section {section} does not exist."}

    devices = devices_data[section]
    
    for device in devices:
        match = True
        for key, value in search_params.items():
            if key != "section" and key in device and device[key] != value:
                match = False
                break
        if match:
            return device
    return None

def add_new_device(devices_data, command_data):
    section = command_data.get("section")
    device_params = command_data.get("device_params")
    
    if not section or not device_params:
        send_error_log("add_new_device", "Missing section or device_params in command.", "warning", {"command_data": command_data})
        return {"error": "Missing section or device_params in command"}

    if section not in devices_data:
        devices_data[section] = []
        logger.info(f"Created new section: {section}")

    required_keys = ["manufacturer", "part_number", "protocol"]
    if not all(k in device_params for k in required_keys):
        send_error_log("add_new_device", "Missing required device parameters.", "warning", {"device_params": device_params})
        return {"error": "Missing required device_params (manufacturer, part_number, protocol)."}

    for existing_device in devices_data[section]:
        if (existing_device.get("manufacturer") == device_params["manufacturer"] and
            existing_device.get("part_number") == device_params["part_number"] and
            existing_device.get("protocol") == device_params["protocol"]):
            send_error_log("add_new_device", "Device with same manufacturer, part_number, and protocol already exists.", "warning", {"device_params": device_params})
            return {"error": "Device with the same manufacturer, part_number, and protocol already exists."}

    devices_data[section].append({
        "manufacturer": device_params["manufacturer"],
        "part_number": device_params["part_number"],
        "protocol": device_params["protocol"],
        "data": device_params.get("data", [])
    })

    write_devices_json(PATH_DEVICES_LIBRARY, devices_data)
    return {"status": "success", "message": f"Device {device_params['part_number']} added to {section}"}

def update_device_data(devices_data, command_data):
    section = command_data.get("section")
    device_params = command_data.get("device_params")
    
    if not section or not device_params:
        send_error_log("update_device_data", "Missing section or device_params in command.", "warning", {"command_data": command_data})
        return {"error": "Missing section or device_params in command"}

    if section not in devices_data:
        send_error_log("update_device_data", f"Section '{section}' does not exist.", "minor", {"section": section})
        return {"error": f"Section {section} does not exist."}

    found_device_index = -1
    for i, device in enumerate(devices_data[section]):
        if (device.get("manufacturer") == device_params.get("manufacturer") and
            device.get("part_number") == device_params.get("part_number") and
            device.get("protocol") == device_params.get("protocol")):
            found_device_index = i
            break

    if found_device_index == -1:
        send_error_log("update_device_data", "Device not found for update.", "warning", {"device_params": device_params})
        return {"error": "Device not found."}

    found_device = devices_data[section][found_device_index]
    new_data = device_params.get("data", [])
    
    if new_data:
        for new_var in new_data:
            var_exists = False
            for existing_var in found_device.get("data", []):
                if existing_var.get("var_name") == new_var.get("var_name"):
                    existing_var.update(new_var)
                    var_exists = True
                    break
            if not var_exists:
                if "data" not in found_device:
                    found_device["data"] = []
                found_device["data"].append(new_var)
    else:
        found_device["data"] = []

    write_devices_json(PATH_DEVICES_LIBRARY, devices_data)
    return {"status": "success", "message": f"Device {device_params['part_number']} updated in {section}"}

def create_new_section(devices_data, section_name):
    if section_name in devices_data:
        send_error_log("create_new_section", f"Section '{section_name}' already exists.", "warning", {"section_name": section_name})
        return {"error": f"Section {section_name} already exists."}
    
    devices_data[section_name] = []
    write_devices_json(PATH_DEVICES_LIBRARY, devices_data)
    return {"status": "success", "message": f"New section {section_name} created."}

def delete_section(devices_data, section_name):
    if section_name not in devices_data:
        send_error_log("delete_section", f"Section '{section_name}' does not exist.", "minor", {"section_name": section_name})
        return {"error": f"Section {section_name} does not exist."}

    del devices_data[section_name]
    write_devices_json(PATH_DEVICES_LIBRARY, devices_data)
    return {"status": "success", "message": f"Section {section_name} deleted."}

def delete_device(devices_data, section_name, manufacturer, part_number, protocol):
    if section_name not in devices_data:
        send_error_log("delete_device", f"Section '{section_name}' does not exist.", "minor", {"section_name": section_name})
        return {"error": f"Section {section_name} does not exist."}

    devices = devices_data[section_name]
    
    initial_len = len(devices)
    devices_data[section_name] = [
        d for d in devices if not (
            d.get("manufacturer") == manufacturer and
            d.get("part_number") == part_number and
            d.get("protocol") == protocol
        )
    ]

    if len(devices_data[section_name]) < initial_len:
        write_devices_json(PATH_DEVICES_LIBRARY, devices_data)
        return {"status": "success", "message": f"Device {part_number} deleted from section {section_name}"}
    else:
        send_error_log("delete_device", "Device not found for deletion.", "warning", {"section": section_name, "manufacturer": manufacturer, "part_number": part_number, "protocol": protocol})
        return {"error": "Device not found."}

def update_section(devices_data, old_section_name, new_section_name):
    if old_section_name not in devices_data:
        send_error_log("update_section", f"Old section '{old_section_name}' does not exist.", "minor", {"old_section_name": old_section_name})
        return {"error": f"Section {old_section_name} does not exist."}

    if new_section_name in devices_data:
        send_error_log("update_section", f"New section '{new_section_name}' already exists.", "warning", {"new_section_name": new_section_name})
        return {"error": f"Section {new_section_name} already exists."}

    devices_data[new_section_name] = devices_data.pop(old_section_name)
    write_devices_json(PATH_DEVICES_LIBRARY, devices_data)
    return {"status": "success", "message": f"Section {old_section_name} updated to {new_section_name}"}

def load_device_for_edit(devices_data, edit_params):
    """Load device data for editing - returns full device details including variables"""
    section = edit_params.get("section")
    manufacturer = edit_params.get("manufacturer")
    part_number = edit_params.get("part_number")
    protocol = edit_params.get("protocol")

    if not all([section, manufacturer, part_number, protocol]):
        error_msg = "Missing required edit parameters (section, manufacturer, part_number, protocol)."
        send_error_log("load_device_for_edit", error_msg, "warning", {"edit_params": edit_params})
        return {"error": error_msg}

    if section not in devices_data:
        error_msg = f"Section {section} does not exist."
        send_error_log("load_device_for_edit", error_msg, "minor", {"section": section})
        return {"error": error_msg}

    devices = devices_data[section]

    for device in devices:
        if (device.get("manufacturer") == manufacturer and
            device.get("part_number") == part_number and
            device.get("protocol") == protocol):
            return {"status": "success", "data": device}

    error_msg = f"Device {part_number} not found in section {section}."
    send_error_log("load_device_for_edit", error_msg, "warning", {"edit_params": edit_params})
    return {"error": error_msg}

# --- MQTT Message Handler ---
def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        command = payload.get("command")

        # Handle edit load command separately (doesn't use "command" field)
        if msg.topic == TOPIC_LIBRARY_EDIT_LOAD_COMMAND:
            devices_data = read_devices_json(PATH_DEVICES_LIBRARY)
            if devices_data is None:
                response = {"status": "error", "message": "Failed to load device library data."}
                client.publish(TOPIC_LIBRARY_EDIT_LOAD_RESPONSE, json.dumps(response), qos=QOS)
                return

            edit_params = payload.get("edit_params", {})
            result = load_device_for_edit(devices_data, edit_params)
            client.publish(TOPIC_LIBRARY_EDIT_LOAD_RESPONSE, json.dumps(result), qos=QOS)
            logger.info(f"Load device for edit response: {result}")
            return

        devices_data = read_devices_json(PATH_DEVICES_LIBRARY)
        if devices_data is None:
            response = {"status": "error", "message": "Failed to load device library data."}
            client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps(response), qos=QOS)
            return

        result = {}
        if command == "Get Data" and "search_params" in payload:
            search_params = payload["search_params"]
            device = search_device(devices_data, search_params)
            if device and "error" not in device:
                result = {"status": "success", "data": device} # Wrap device in a success status
                client.publish(TOPIC_LIBRARY_SEARCH_RESPONSE, json.dumps(result), qos=QOS)
                logger.info(f"Status: success, Data found and sent: {result}")
            else:
                result = device if "error" in device else {"status": "error", "message": "Device not found"}
                client.publish(TOPIC_LIBRARY_SEARCH_RESPONSE, json.dumps(result), qos=QOS)
                logger.info(f"Device not found or search error, sent error response: {result}")

        elif command == "Create New Section" and "data" in payload:
            section_name = payload["data"]
            result = create_new_section(devices_data, section_name)
            client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps(result), qos=QOS)
            logger.info(f"Status: success, Create new section response: {result}")
        
        elif command == "Create Data" and "section" in payload and "device_params" in payload:
            result = add_new_device(devices_data, payload)
            client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps(result), qos=QOS)
            logger.info(f"Status: success, Add device response: {result}")
        
        elif command == "Update Data" and "section" in payload and "device_params" in payload:
            result = update_device_data(devices_data, payload)
            client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps(result), qos=QOS)
            logger.info(f"Status: success, Update device response: {result}")

        elif command == "Delete Section" and "data" in payload:
            section_name = payload["data"]
            result = delete_section(devices_data, section_name)
            client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps(result), qos=QOS)
            logger.info(f"Status: success, Delete section response: {result}")
        
        elif command == "Delete Device" and all(k in payload for k in ["section", "manufacturer", "part_number", "protocol"]):
            result = delete_device(devices_data, payload["section"], payload["manufacturer"], payload["part_number"], payload["protocol"])
            client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps(result), qos=QOS)
            logger.info(f"Status: success, Delete device response: {result}")

        elif command == "Update Section" and all(k in payload for k in ["old_section_name", "new_section_name"]):
            result = update_section(devices_data, payload["old_section_name"], payload["new_section_name"])
            client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps(result), qos=QOS)
            logger.info(f"Status: success, Update section response: {result}")
        
        else:
            result = {"status": "error", "message": f"Unknown or incomplete command: {command}"}
            client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps(result), qos=QOS)
            send_error_log("on_message", f"Unknown or incomplete command received: {command}", "warning", {"payload": payload})

    except json.JSONDecodeError as e:
        send_error_log("on_message", f"Invalid JSON payload: {e}", "major", {"payload_raw": msg.payload.decode('utf-8')})
        client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps({"status": "error", "message": f"Invalid JSON format: {e}"}), qos=QOS)
    except Exception as e:
        send_error_log("on_message", f"Unhandled error processing message: {e}", "critical", {"payload_raw": msg.payload.decode('utf-8')})
        client.publish(TOPIC_LIBRARY_COMMAND_RESPONSE, json.dumps({"status": "error", "message": f"Internal server error: {e}"}), qos=QOS)

# --- MQTT Client Setup ---
main_mqtt_client = None

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to MQTT Broker!")
        client.subscribe(TOPIC_LIBRARY_SEARCH_COMMAND, qos=QOS)
        client.subscribe(TOPIC_LIBRARY_COMMAND, qos=QOS)
        client.subscribe(TOPIC_LIBRARY_EDIT_LOAD_COMMAND, qos=QOS)
        logger.info(f"Subscribed to topics: {TOPIC_LIBRARY_SEARCH_COMMAND}, {TOPIC_LIBRARY_COMMAND}, {TOPIC_LIBRARY_EDIT_LOAD_COMMAND}")
    else:
        send_error_log("on_connect", f"Failed to connect to MQTT Broker, return code {rc}", "critical", {"return_code": rc})

def on_disconnect_handler(client, userdata, rc):
    client_id_str = client._client_id.decode() if hasattr(client, '_client_id') else "unknown_client"
    if rc != 0:
        logger.warning(f"Unexpected MQTT disconnection for client {client_id_str}. Return code: {rc}. Attempting reconnect...")
    else:
        logger.info(f"MQTT client {client_id_str} disconnected gracefully.")

def setup_mqtt_client():
    global main_mqtt_client
    main_mqtt_client = mqtt.Client(client_id=f"device-library-service-{uuid.uuid4()}", protocol=mqtt.MQTTv311, clean_session=True)
    main_mqtt_client.on_connect = on_connect
    main_mqtt_client.on_disconnect = on_disconnect_handler
    main_mqtt_client.on_message = on_message
    main_mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)

    try:
        main_mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        main_mqtt_client.loop_start()
    except Exception as e:
        send_error_log("setup_mqtt_client", f"Failed to connect or start MQTT client: {e}", "critical")
        logger.critical(f"FATAL: Failed to connect or start MQTT client: {e}", exc_info=True)
        sys.exit(1)

# --- Device Summary Publishing ---
def get_device_summary(devices_data):
    device_summary = {}
    for section, devices in devices_data.items():
        device_summary[section] = []
        for device in devices:
            if all(k in device for k in ["manufacturer", "part_number", "protocol"]):
                device_summary[section].append({
                    "manufacturer": device["manufacturer"],
                    "part_number": device["part_number"],
                    "protocol": device["protocol"]
                })
            else:
                send_error_log("get_device_summary", f"Malformed device entry in section '{section}'. Skipping.", "warning", {"device_data": device})
    return device_summary

def send_data_to_mqtt_loop():
    while True:
        try:
            devices_data = read_devices_json(PATH_DEVICES_LIBRARY)
            if devices_data is None:
                time.sleep(5)
                continue
            
            device_summary = get_device_summary(devices_data)

            if main_mqtt_client and main_mqtt_client.is_connected():
                main_mqtt_client.publish(TOPIC_LIBRARY_DEVICES_SUMMARY, json.dumps(device_summary), qos=QOS)
                if DEBUG_MODE:
                    logger.debug(f"Data sent to MQTT Broker: {json.dumps(device_summary)}")
            else:
                logger.warning("Main MQTT client not connected, unable to publish device summary.")
                send_error_log("send_data_to_mqtt_loop", "Main MQTT client not connected, failed to publish device summary.", "warning")

        except Exception as e:
            send_error_log("send_data_to_mqtt_loop", f"Error in data publishing loop: {e}", "critical")
        
        time.sleep(2)

# --- Main Execution ---
if __name__ == "__main__":
    logger.info("Starting Device Library Service...")
    initialize_error_logger()

    setup_mqtt_client()

    data_sender_thread = threading.Thread(target=send_data_to_mqtt_loop, daemon=True)
    data_sender_thread.start()
    logger.info("Device summary publishing thread started.")

    try:
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        logger.info("Service interrupted by user (Ctrl+C). Shutting down...")
    except Exception as e:
        send_error_log("main", f"Unhandled exception in main service: {e}", "critical", {"error": str(e)})
        logger.critical(f"Unhandled exception in main service: {e}", exc_info=True)
    finally:
        logger.info("Cleaning up resources...")
        if main_mqtt_client:
            main_mqtt_client.loop_stop()
            main_mqtt_client.disconnect()
            logger.info("Main MQTT client disconnected.")
        if error_logger_client:
            error_logger_client.loop_stop()
            error_logger_client.disconnect()
            logger.info("Error Logger MQTT client disconnected.")
        
        logger.info("Device Library Service terminated.")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Library Config ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Library Config ===========")
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
