import json
import os
import time
import logging
import threading
import paho.mqtt.client as mqtt
from datetime import datetime

# Try to import ErrorLogger
try:
    from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING
except ImportError:
    # Fallback if ErrorLogger not available
    ERROR_TYPE_MINOR = "MINOR"
    ERROR_TYPE_MAJOR = "MAJOR"
    ERROR_TYPE_CRITICAL = "CRITICAL"
    ERROR_TYPE_WARNING = "WARNING"

    def initialize_error_logger(*args):
        return None

    def send_error_log(module, message, severity):
        print(f"[ERROR_LOG] {severity}: {module} - {message}")

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("RemappingPayloadService")

# --- Configuration File Paths ---
mqtt_config_file = '../MODULAR_I2C/JSON/Config/mqtt_config.json'
config_file = './JSON/remappingConfig.json'

# MQTT Broker settings (defaults, can be loaded from config)
DEFAULT_BROKER = "localhost"
DEFAULT_PORT = 1883

# MQTT Topics
topic_command = "REMAP_COMMAND"
topic_response = "REMAP_RESPONSE"

# --- Global Variables ---
config = []
client_remap = None
config_publish_thread = None

# --- Logging Control ---
device_topic_logging_enabled = False  # Control device topic message logging

# --- Connection Status Tracking ---
remap_broker_connected = False

# --- Error severity levels ---
ERROR_TYPE_CRITICAL = "CRITICAL"
ERROR_TYPE_MAJOR = "MAJOR"
ERROR_TYPE_MINOR = "MINOR"
ERROR_TYPE_WARNING = "WARNING"

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("======= MQTT Payload Remapping =======")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("======= MQTT Payload Remapping =======")
    print("Success To Running")
    print("")

def print_broker_status(remap_status=False):
    """Print MQTT broker connection status"""
    if remap_status:
        print("MQTT Broker Remap is Running")
    else:
        print("MQTT Broker connection failed")

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

# --- Configuration Management ---
def load_mqtt_config():
    """Load MQTT config with graceful error handling and retry loop"""
    default_config = {
        "enable": True,
        "broker_address": "192.168.0.193",
        "broker_port": 1883,
        "username": "",
        "password": "",
        "qos": 1,
        "retain": True,
        "mac_address": "00:00:00:00:00:00"
    }

    while True:
        try:
            with open(mqtt_config_file, 'r') as file:
                content = file.read().strip()
                if not content:
                    log_simple(f"MQTT config file is empty. Retrying in 5 seconds...", "WARNING")
                    time.sleep(5)
                    continue
                return json.loads(content)
        except FileNotFoundError:
            log_simple(f"MQTT config file not found. Creating default config and retrying in 5 seconds...", "WARNING")
            try:
                # Create directory if not exists
                import os
                os.makedirs(os.path.dirname(mqtt_config_file), exist_ok=True)
                # Create default config file
                with open(mqtt_config_file, 'w') as file:
                    json.dump(default_config, file, indent=4)
                log_simple(f"Created default MQTT config file: {mqtt_config_file}", "INFO")
            except Exception as create_error:
                log_simple(f"Failed to create config file: {create_error}. Retrying in 5 seconds...", "WARNING")
                time.sleep(5)
                continue
        except json.JSONDecodeError as e:
            log_simple(f"Error decoding MQTT config file: {e}. Using default configuration.", "WARNING")
            return default_config
        except Exception as e:
            log_simple(f"Unexpected error loading MQTT config: {e}. Retrying in 5 seconds...", "WARNING")
            time.sleep(5)
            continue

def load_remapping_config():
    """Load remapping configuration"""
    global config
    try:
        with open(config_file, 'r') as file:
            loaded_data = json.load(file)

        if isinstance(loaded_data, list):
            config = loaded_data
            log_simple(f"Remapping configuration loaded from {config_file}")
        else:
            config = []
            log_simple("Invalid config format, using default structure.", "WARNING")

    except FileNotFoundError:
        log_simple(f"Config file not found: {config_file}. Creating default config.")
        config = []
        save_remapping_config()
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load config (JSON decode error): {e}. Using default.", "ERROR")
        config = []
        send_error_log("load_remapping_config", f"Config JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load config: {e}", "ERROR")
        config = []
        send_error_log("load_remapping_config", f"Config load error: {e}", ERROR_TYPE_MAJOR)

def save_remapping_config():
    """Save remapping configuration"""
    try:
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=2)
        log_simple(f"Configuration saved to {config_file}")
    except Exception as e:
        log_simple(f"Failed to save config: {e}", "ERROR")
        send_error_log(f"Config save error: {e}", ERROR_TYPE_MAJOR)

# --- MQTT Connection Functions ---
def on_connect_remap(client, userdata, flags, rc):
    global remap_broker_connected
    if rc == 0:
        remap_broker_connected = True
        log_simple("Remap MQTT broker connected", "SUCCESS")

        # Subscribe to simplified command topic
        client.subscribe([
            (topic_command, 1)
        ])
        log_simple(f"Successfully subscribed to command topic: {topic_command}")
        # Debug: Log connection and subscription status

        # Subscribe to device topics for enabled configs
        subscribe_to_device_topics(client)

        # Start the configuration publishing thread
        start_config_publish_thread()

    else:
        remap_broker_connected = False
        log_simple(f"Remap MQTT broker connection failed (code {rc})", "ERROR")

def on_disconnect_remap(client, userdata, rc):
    global remap_broker_connected
    remap_broker_connected = False
    if rc != 0:
        log_simple("Remap MQTT broker disconnected unexpectedly", "WARNING")

def subscribe_to_device_topics(client):
    """Subscribe to device topics used in remapping configs"""
    try:
        if not client or not client.is_connected():
            log_simple("Client not connected, cannot subscribe to device topics", "WARNING")
            return

        # Collect all unique device topics from configs
        device_topics = set()

        for remap_config in config:
            if remap_config.get('enabled', False):
                for device in remap_config.get('source_devices', []):
                    device_topic = device.get('mqtt_topic')
                    if device_topic:
                        device_topics.add(device_topic)

        # Subscribe to each unique device topic
        for topic in device_topics:
            if topic not in subscribed_topics:
                client.subscribe(topic)
                subscribed_topics.append(topic)
                log_simple(f"Subscribed to device topic: {topic}", "SUCCESS")

        # Log total subscribed topics
        log_simple(f"Total device topics subscribed: {len(subscribed_topics)}", "INFO")

    except Exception as e:
        log_simple(f"Error subscribing to device topics: {e}", "ERROR")
        send_error_log(f"Device topic subscription error: {e}", ERROR_TYPE_MAJOR)

# Initialize subscribed_topics list
subscribed_topics = []

# --- Config Publishing Thread ---
def start_config_publish_thread():
    """Start the config publishing thread"""
    global config_publish_thread
    if config_publish_thread is None or not config_publish_thread.is_alive():
        config_publish_thread = threading.Thread(target=config_publish_worker, daemon=True)
        config_publish_thread.start()
        log_simple("Config publishing thread started", "SUCCESS")

def stop_config_publish_thread():
    """Stop the config publishing thread"""
    global config_publish_thread
    if config_publish_thread and config_publish_thread.is_alive():
        # Thread will be terminated when main program exits (daemon=True)
        log_simple("Config publishing thread will stop with application", "INFO")

def config_publish_worker():
    """Worker function for config publishing thread"""
    log_simple("Config publishing thread active - posting every 5 seconds", "INFO")
    while True:
        try:
            publish_remapping_config()
            time.sleep(5)  # Publish every 5 seconds
        except Exception as e:
            log_simple(f"Error in config publishing thread: {e}", "ERROR")
            time.sleep(1)  # Shorter sleep on error to not spam logs

def publish_remapping_config():
    """Publish current remapping configuration to REMAP_RESPONSE topic"""
    global config, client_remap

    try:
        if not client_remap or not client_remap.is_connected():
            return  # Skip if client not connected

        if not config:
            # Send empty config data if no configurations exist
            config_data = {
                "remapping_configs": [],
                "timestamp": datetime.now().isoformat(),
                "source": "backend_periodic_publish",
                "message": "No remapping configurations found"
            }
        else:
            # Send current config data
            config_data = {
                "remapping_configs": config,
                "timestamp": datetime.now().isoformat(),
                "source": "backend_periodic_publish",
                "count": len(config),
                "message": f"Publishing {len(config)} remapping configurations"
            }

        # Publish to REMAP_RESPONSE topic
        client_remap.publish(topic_response, json.dumps(config_data), qos=1, retain=False)

    except Exception as e:
        log_simple(f"Error publishing config data: {e}", "ERROR")
        send_error_log("publish_remapping_config", f"Config publish error: {e}", ERROR_TYPE_MINOR)

# --- Message Handling ---
def on_message_remap(client, userdata, msg):
    """Handle remap messages"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()

        # Only log command messages, not device topic messages
        if topic == topic_command:
            log_simple(f"Remap Command: {topic}")
        # Remove the generic log that was showing device topics

        if topic == topic_command:
            try:
                message_data = json.loads(payload)
                command = message_data.get('command')

                if command == "get":
                    config_id = message_data.get('config_id')
                    if config_id:
                        handle_get_single_config_request(client, config_id)
                    else:
                        handle_get_request(client)
                elif command in ["add", "set", "delete"]:
                    handle_crud_request(client, command, message_data)
                elif command == "enable_device_logging":
                    handle_device_logging_control(client, True)
                elif command == "disable_device_logging":
                    handle_device_logging_control(client, False)
                else:
                    log_simple(f"Unknown command: {command}", "WARNING")

            except json.JSONDecodeError:
                log_simple(f"Invalid JSON in command message: {payload}", "ERROR")
            except Exception as e:
                log_simple(f"Error processing command: {e}", "ERROR")

        else:
            # Handle device topic subscription and remapping
            handle_device_topic_data(client, topic, payload)

    except Exception as e:
        log_simple(f"Error handling remap message: {e}", "ERROR")
        send_error_log(f"Remap message handling error: {e}", ERROR_TYPE_MINOR)

def handle_device_topic_data(client, topic, payload):
    """Handle incoming device data from subscribed topics and remap/publish"""
    try:
        # Log device topic messages only if enabled
        if device_topic_logging_enabled:
            log_simple(f"Device Data: {topic} - {payload}")

        try:
            # Parse the main device message
            device_message = json.loads(payload)

            # Find matching config and device for this topic
            for remap_config in config:
                if not remap_config.get('enabled', False):
                    continue

                for device in remap_config.get('source_devices', []):
                    if device.get('mqtt_topic') == topic:
                        # Use device-level key mappings
                        key_mappings = device.get('key_mappings', [])

                        # Parse the nested "value" field which contains sensor data as JSON string
                        remapped_data = {}
                        sensor_data = {}

                        if 'value' in device_message:
                            try:
                                # The 'value' field is a JSON string, parse it to get sensor data
                                sensor_data = json.loads(device_message['value'])
                            except json.JSONDecodeError:
                                log_simple(f"Failed to parse value field as JSON: {device_message['value']}", "ERROR")
                                continue

                        # Apply key mappings from sensor data
                        for mapping in key_mappings:
                            original = mapping.get('original_key')
                            custom = mapping.get('custom_key')
                            if original in sensor_data:
                                remapped_data[custom] = sensor_data[original]

                        # If we have remapped data, add config name and timestamp
                        if remapped_data:
                            # Add config name
                            remapped_data['name'] = remap_config.get('name', 'UNKNOWN')

                            # Add timestamp from the original message
                            if 'Timestamp' in device_message:
                                remapped_data['Timestamp'] = device_message['Timestamp']

                            # Publish to configured topic
                            pub_config = remap_config.get('mqtt_publish_config', {})
                            pub_topic = pub_config.get('topic', 'REMAP/DEFAULT')
                            qos = pub_config.get('qos', 1)
                            retain = pub_config.get('retain', False)

                            client.publish(pub_topic, json.dumps(remapped_data), qos=qos, retain=retain)
                            log_simple(f"Remapped data published to {pub_topic}: {json.dumps(remapped_data)}", "SUCCESS")

                        break  # Assume one config per topic

        except json.JSONDecodeError as e:
            log_simple(f"Failed to parse device message JSON: {e}", "ERROR")
        except Exception as e:
            log_simple(f"Error processing device message: {e}", "ERROR")
            send_error_log(f"Device message processing error: {e}", ERROR_TYPE_MINOR)

    except Exception as e:
        log_simple(f"Error handling device topic data: {e}", "ERROR")
        send_error_log(f"Device topic data handling error: {e}", ERROR_TYPE_MINOR)

# --- CRUD Operations ---
def handle_get_request(client):
    """Handle get data request"""
    try:
        response = {
            "status": "success",
            "data": config,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response))
            log_simple("Configuration data sent to client", "SUCCESS")
        else:
            log_simple("Client not connected, cannot send configuration data", "WARNING")
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response))
        else:
            log_simple("Client not connected, cannot send error response", "WARNING")
        log_simple(f"Error sending config data: {e}", "ERROR")

def handle_get_single_config_request(client, config_id):
    """Handle get single config request"""
    try:
        config_obj = next((c for c in config if c['id'] == config_id), None)
        if config_obj:
            response = {
                "status": "success",
                "config": config_obj,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        else:
            response = {
                "status": "error",
                "message": f"Config {config_id} not found",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response))
            log_simple(f"Single config request processed for ID: {config_id}", "SUCCESS")
        else:
            log_simple("Client not connected, cannot send config data", "WARNING")
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response))
        log_simple(f"Error sending single config data: {e}", "ERROR")

def handle_get_list_request(client):
    """Handle get list of all configs request"""
    try:
        response = {
            "status": "success",
            "configs": config,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response))
            log_simple("All configs list sent to client", "SUCCESS")
        else:
            log_simple("Client not connected, cannot send configs list", "WARNING")
    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response))
        log_simple(f"Error sending configs list: {e}", "ERROR")

def handle_device_logging_control(client, enable):
    """Handle device topic logging enable/disable commands"""
    global device_topic_logging_enabled

    try:
        device_topic_logging_enabled = enable
        status = "enabled" if enable else "disabled"
        log_simple(f"Device topic message logging {status}", "SUCCESS")

        # Send response
        response = {
            "status": "success",
            "message": f"Device topic logging {status}",
            "data": {"device_topic_logging_enabled": device_topic_logging_enabled},
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(topic_response, json.dumps(response))

    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(topic_response, json.dumps(error_response))
        log_simple(f"Error handling device logging control: {e}", "ERROR")

def handle_crud_request(client, command, message_data):
    """Handle CRUD operations"""
    try:
        # Handle both 'data', 'config_data', and 'updates' keys for compatibility
        data = message_data.get('data') or message_data.get('config_data') or message_data.get('updates', {})
        config_id = message_data.get('config_id')

        success = False
        message = ""

        if command == "add":
            success, message = create_remapping_config(data)
        elif command == "set":
            success, message = update_remapping_config(data)
        elif command == "delete":
            success, message = delete_remapping_config(data.get('id') or config_id)
        else:
            message = f"Unknown command: {command}"

        # Send response
        response = {
            "status": "success" if success else "error",
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        log_simple(f"Sending CRUD response: {response.get('status')} - {message}", "INFO")
        client.publish(topic_response, json.dumps(response))

        # Update subscriptions after CRUD operation
        global client_remap
        if success and client_remap and client_remap.is_connected():
            subscribe_to_device_topics(client_remap)

    except Exception as e:
        error_response = {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        client.publish(topic_response, json.dumps(error_response))
        log_simple(f"Error handling CRUD request: {e}", "ERROR")

def create_remapping_config(config_data):
    """Create new remapping config"""
    try:
        if 'id' not in config_data or not config_data['id']:
            config_data['id'] = str(datetime.now().strftime("%Y%m%d_%H%M%S"))

        if 'created_at' not in config_data or not config_data['created_at']:
            config_data['created_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        config_data['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        config.append(config_data)
        save_remapping_config()

        log_simple(f"Remapping config created: {config_data.get('name', 'Unknown')}")
        return True, f"Remapping config '{config_data.get('name', 'Unknown')}' created successfully"

    except Exception as e:
        log_simple(f"Error creating remapping config: {e}", "ERROR")
        send_error_log(f"Remapping config creation error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def update_remapping_config(config_data):
    """Update existing remapping config"""
    try:
        config_id = config_data.get('id')
        if not config_id:
            return False, "Config ID is required for update"

        for i, remap_config in enumerate(config):
            if remap_config.get('id') == config_id:
                config_data['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                config[i] = config_data
                save_remapping_config()

                log_simple(f"Remapping config updated: {config_data.get('name', 'Unknown')}")
                return True, f"Remapping config '{config_data.get('name', 'Unknown')}' updated successfully"

        return False, f"Remapping config with ID {config_id} not found"

    except Exception as e:
        log_simple(f"Error updating remapping config: {e}", "ERROR")
        send_error_log(f"Remapping config update error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def delete_remapping_config(config_id):
    """Delete remapping config"""
    try:
        if not config_id:
            return False, "Config ID is required for deletion"

        initial_count = len(config)
        config[:] = [c for c in config if c.get('id') != config_id]

        if len(config) < initial_count:
            save_remapping_config()

            log_simple(f"Remapping config deleted: {config_id}")
            return True, "Remapping config deleted successfully"
        else:
            return False, f"Remapping config with ID {config_id} not found"

    except Exception as e:
        log_simple(f"Error deleting remapping config: {e}", "ERROR")
        send_error_log(f"Remapping config deletion error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

# --- MQTT Client Setup ---
def connect_mqtt(client_id, broker, port, username="", password="", on_connect_callback=None, on_disconnect_callback=None, on_message_callback=None):
    """Create and connect MQTT client"""
    try:
        client = mqtt.Client(client_id)
        if username and password:
            client.username_pw_set(username, password)

        if on_connect_callback:
            client.on_connect = on_connect_callback
        if on_disconnect_callback:
            client.on_disconnect = on_disconnect_callback
        if on_message_callback:
            client.on_message = on_message_callback

        client.reconnect_delay_set(min_delay=1, max_delay=120)
        client.connect(broker, port, keepalive=60)
        return client

    except Exception as e:
        log_simple(f"Failed to connect to MQTT broker {broker}:{port} - {e}", "ERROR")
        send_error_log(f"MQTT connection failed: {e}", ERROR_TYPE_CRITICAL)
        return None

# --- Main Application ---
def run():
    global client_remap, error_logger

    print_startup_banner()

    # Load configurations
    log_simple("Loading configurations...")
    mqtt_config = load_mqtt_config()
    load_remapping_config()

    broker = mqtt_config.get('broker_address', 'localhost')
    port = int(mqtt_config.get('broker_port', 1883))
    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')

    # Initialize unified error logger
    log_simple("Initializing unified error logger...")
    error_logger = initialize_error_logger("RemappingPayloadService", broker, port)
    client_error_logger = error_logger.client if error_logger else None

    # Connect to remap MQTT broker
    log_simple("Connecting to Remap MQTT broker...")
    client_remap = connect_mqtt(
        f'remapping-payload-{datetime.now().strftime("%Y%m%d_%H%M%S")}',
        broker, port, username, password,
        on_connect_remap, on_disconnect_remap, on_message_remap
    )

    # Start client loops
    if client_remap:
        client_remap.loop_start()

    # Wait for connections
    time.sleep(2)

    print_success_banner()
    print_broker_status(remap_broker_connected)

    log_simple("MQTT Payload Remapping service started successfully", "SUCCESS")

    try:
        while True:
            # Reconnection handling
            if client_remap and not client_remap.is_connected():
                log_simple("Attempting to reconnect Remap client...", "WARNING")
                try:
                    client_remap.reconnect()
                except:
                    pass

            if client_error_logger and not client_error_logger.is_connected():
                log_simple("Attempting to reconnect Error Logger client...", "WARNING")
                try:
                    client_error_logger.reconnect()
                except:
                    pass

            time.sleep(5)

    except KeyboardInterrupt:
        log_simple("Service stopped by user", "WARNING")
    except Exception as e:
        log_simple(f"Critical error: {e}", "ERROR")
        send_error_log("run", f"Critical service error: {e}", ERROR_TYPE_CRITICAL)
    finally:
        log_simple("Shutting down services...")
        stop_config_publish_thread()
        if client_remap:
            client_remap.loop_stop()
            client_remap.disconnect()
        if client_error_logger:
            client_error_logger.loop_stop()
            client_error_logger.disconnect()
        log_simple("Application terminated", "SUCCESS")

if __name__ == '__main__':
    run()
