import json
import os
import time
import logging
import threading
from datetime import datetime

# Try to import paho.mqtt.client
try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("WARNING: paho-mqtt library not installed. Please install with: pip3 install paho-mqtt")
    mqtt = None

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
DEFAULT_BROKER = "18.143.215.113"
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
    """Load MQTT config from remapping config instead of MODULAR_I2C config"""
    global config

    # First load remapping config to get publish settings
    load_remapping_config(silent=True)

    if config and len(config) > 0:
        # Use the MQTT publish config from the first enabled remapping config
        for remap_config in config:
            if remap_config.get('enabled', False):
                pub_config = remap_config.get('mqtt_publish_config', {})
                broker_url = pub_config.get('broker_url', 'mqtt://18.143.215.113:1883')

                # Parse broker_url (format: mqtt://host:port)
                try:
                    if broker_url.startswith('mqtt://'):
                        broker_part = broker_url[7:]  # Remove 'mqtt://'
                        if ':' in broker_part:
                            host, port = broker_part.split(':', 1)
                            port = int(port)
                        else:
                            host = broker_part
                            port = 1883

                        return {
                            "enable": True,
                            "broker_address": host,
                            "broker_port": port,
                            "username": "",
                            "password": "",
                            "qos": pub_config.get('qos', 1),
                            "retain": pub_config.get('retain', False),
                            "mac_address": "00:00:00:00:00:00"
                        }
                except Exception as e:
                    log_simple(f"Error parsing broker URL {broker_url}: {e}", "WARNING")

    # Fallback if no remapping config found
    log_simple("No remapping config found, using fallback MQTT config", "WARNING")
    default_config = {
        "enable": True,
        "broker_address": "18.143.215.113",
        "broker_port": 1883,
        "username": "",
        "password": "",
        "qos": 1,
        "retain": True,
        "mac_address": "00:00:00:00:00:00"
    }

    # Try to load from the original mqtt_config.json as fallback
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
            log_simple(f"MQTT config file not found. Using default config.", "WARNING")
            return default_config
        except json.JSONDecodeError as e:
            log_simple(f"Error decoding MQTT config file: {e}. Using default configuration.", "WARNING")
            return default_config
        except Exception as e:
            log_simple(f"Unexpected error loading MQTT config: {e}. Using default.", "WARNING")
            return default_config

def load_remapping_config(silent=False):
    """Load remapping configuration"""
    global config
    try:
        with open(config_file, 'r') as file:
            loaded_data = json.load(file)

        if isinstance(loaded_data, list):
            config = loaded_data
            if not silent:
                log_simple(f"Remapping configuration loaded from {config_file}")
        else:
            config = []
            if not silent:
                log_simple("Invalid config format, using default structure.", "WARNING")

    except FileNotFoundError:
        if not silent:
            log_simple(f"Config file not found: {config_file}. Creating default config.")
        config = []
        save_remapping_config()
    except json.JSONDecodeError as e:
        if not silent:
            log_simple(f"Failed to load config (JSON decode error): {e}. Using default.", "ERROR")
        config = []
        send_error_log("load_remapping_config", f"Config JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        if not silent:
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

# Global cache for device data (temporary storage for combining devices in config)
cached_device_data = {}  # {config_id: {device_topic: {data: {...}, timestamp: "..."}}}

# Global variables for group-based publishing
group_publish_timers = {}  # {config_id: {group_key: timer_object}}
group_buffer_data = {}  # {config_id: {group_key: {device_topic: data, ...}}}
group_publish_lock = threading.Lock()  # Lock for thread-safe group operations
GROUP_PUBLISH_DELAY = 5.0  # Delay in seconds before publishing group data

def clear_cached_device_data(config_id=None):
    """Clear cached device data for config(s)"""
    global cached_device_data
    if config_id:
        cached_device_data.pop(config_id, None)
        # Also clear group timers for this config
        if config_id in group_publish_timers:
            for group_key, timer in group_publish_timers[config_id].items():
                if timer and timer.is_alive():
                    timer.cancel()
            group_publish_timers.pop(config_id, None)
        if config_id in group_buffer_data:
            group_buffer_data.pop(config_id, None)
    else:
        cached_device_data.clear()
        # Clear all group timers
        for config_id, group_timers in group_publish_timers.items():
            for group_key, timer in group_timers.items():
                if timer and timer.is_alive():
                    timer.cancel()
        group_publish_timers.clear()
        group_buffer_data.clear()

def add_to_device_cache(config_id, device_topic, data, timestamp):
    """Add device data to cache for later combination"""
    global cached_device_data
    if config_id not in cached_device_data:
        cached_device_data[config_id] = {}

    cached_device_data[config_id][device_topic] = {
        'data': data,
        'timestamp': timestamp
    }

def clear_group_timers(config_id=None, group_key=None):
    """Clear group publish timers"""
    global group_publish_timers
    if config_id and group_key:
        # Clear specific timer
        if config_id in group_publish_timers and group_key in group_publish_timers[config_id]:
            timer = group_publish_timers[config_id][group_key]
            if timer and timer.is_alive():
                timer.cancel()
            del group_publish_timers[config_id][group_key]
            if not group_publish_timers[config_id]:
                del group_publish_timers[config_id]
    elif config_id:
        # Clear all timers for config
        if config_id in group_publish_timers:
            for timer in group_publish_timers[config_id].values():
                if timer and timer.is_alive():
                    timer.cancel()
            del group_publish_timers[config_id]
    else:
        # Clear all timers
        for config_timers in group_publish_timers.values():
            for timer in config_timers.values():
                if timer and timer.is_alive():
                    timer.cancel()
        group_publish_timers.clear()

def buffer_group_data(config_id, group_key, device_topic, data, timestamp):
    """Buffer data for group-based publishing"""
    global group_buffer_data
    if config_id not in group_buffer_data:
        group_buffer_data[config_id] = {}
    if group_key not in group_buffer_data[config_id]:
        group_buffer_data[config_id][group_key] = {}

    group_buffer_data[config_id][group_key][device_topic] = {
        'data': data,
        'timestamp': timestamp
    }

def get_group_buffered_data(config_id, group_key):
    """Get buffered data for a group"""
    global group_buffer_data
    if config_id in group_buffer_data and group_key in group_buffer_data[config_id]:
        return group_buffer_data[config_id][group_key]
    return {}

def publish_grouped_data(config_id, group_key, client):
    """Publish grouped data from buffer"""
    global group_buffer_data, client_remap

    try:
        # Get the config
        remap_config = None
        for cfg in config:
            if cfg.get('id') == config_id:
                remap_config = cfg
                break

        if not remap_config or not remap_config.get('enabled', False):
            return

        # Get buffered data for this group
        buffered_data = get_group_buffered_data(config_id, group_key)
        if not buffered_data:
            return

        # Find the config device that uses this group
        config_device = None
        for device in remap_config.get('source_devices', []):
            if device.get('group') == group_key:
                config_device = device
                break

        if not config_device:
            return

        # Create final payload structure in device order
        final_payload = {}
        final_payload['name'] = remap_config.get('name', 'UNKNOWN')

        # Process devices in the exact order they appear in configuration to maintain consistency
        for device in remap_config.get('source_devices', []):
            device_topic = device.get('mqtt_topic')
            device_group = device.get('group')
            key_mappings = device.get('key_mappings', [])

            # Check if this device has buffered data
            if device_topic not in buffered_data:
                continue

            device_data = buffered_data[device_topic].get('data', {})

            if device_group == group_key and device_group:
                # This device belongs to the group we're publishing
                if group_key not in final_payload:
                    final_payload[group_key] = {}
                final_payload[group_key].update(device_data)
            elif not device_group and device_data:
                # Ungrouped device - add fields directly to payload
                final_payload.update(device_data)

        # Add timestamp from the latest buffered data
        latest_timestamp = datetime.now().isoformat()
        for device_data in buffered_data.values():
            if device_data.get('timestamp', datetime.min.isoformat()) > latest_timestamp:
                latest_timestamp = device_data['timestamp']

        final_payload['Timestamp'] = latest_timestamp

        # Publish to configured topic
        pub_config = remap_config.get('mqtt_publish_config', {})
        pub_topic = pub_config.get('topic', 'REMAP/DEFAULT')
        qos = pub_config.get('qos', 1)
        retain = pub_config.get('retain', False)

        if client_remap and client_remap.is_connected():
            client_remap.publish(pub_topic, json.dumps(final_payload), qos=qos, retain=retain)
            log_simple(f"Buffered grouped data published to {pub_topic}: {json.dumps(final_payload)}", "SUCCESS")

        # Clear the buffer for this group after publishing
        if config_id in group_buffer_data and group_key in group_buffer_data[config_id]:
            del group_buffer_data[config_id][group_key]
            if not group_buffer_data[config_id]:
                del group_buffer_data[config_id]

    except Exception as e:
        log_simple(f"Error publishing grouped data: {e}", "ERROR")

def schedule_group_publish(config_id, group_key, client):
    """Schedule publishing for a group with delay"""
    global group_publish_timers

    # Cancel existing timer for this group if any
    clear_group_timers(config_id, group_key)

    # Initialize timer storage
    if config_id not in group_publish_timers:
        group_publish_timers[config_id] = {}

    # Schedule new timer
    timer = threading.Timer(GROUP_PUBLISH_DELAY, publish_grouped_data, args=[config_id, group_key, client])
    timer.daemon = True
    group_publish_timers[config_id][group_key] = timer
    timer.start()

    log_simple(f"Scheduled group publish for config {config_id}, group {group_key} in {GROUP_PUBLISH_DELAY}s", "INFO")

# --- Global Variables for Periodic Publishing ---
device_last_publish_time = {}  # Track last publish time per device/topic

def get_device_publish_interval(topic):
    """Get publish interval for a specific device topic"""
    try:
        for remap_config in config:
            if remap_config.get('enabled', False):
                for device in remap_config.get('source_devices', []):
                    if device.get('mqtt_topic') == topic:
                        pub_config = remap_config.get('mqtt_publish_config', {})
                        interval = pub_config.get('publish_interval_seccond', 10)
                        return max(interval, 1)  # Minimum 1 second
        return 10  # Default 10 seconds
    except Exception as e:
        log_simple(f"Error getting publish interval for {topic}: {e}", "ERROR")
        return 10

def should_publish_device_data(topic):
    """Check if it's time to publish data for this device topic"""
    current_time = time.time()
    interval = get_device_publish_interval(topic)

    if topic not in device_last_publish_time:
        device_last_publish_time[topic] = 0

    if current_time - device_last_publish_time[topic] >= interval:
        device_last_publish_time[topic] = current_time
        return True
    return False

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
            publish_periodic_device_data()
            time.sleep(1)  # Check every 1 second for periodic publishing
        except Exception as e:
            log_simple(f"Error in config publishing thread: {e}", "ERROR")
            time.sleep(1)  # Shorter sleep on error to not spam logs

def publish_remapping_config():
    """Publish current remapping configuration to REMAP_RESPONSE topic"""
    global config, client_remap

    try:
        if not client_remap or not client_remap.is_connected():
            return  # Skip if client not connected

        # Always load from file to ensure latest data - this fixes the sync issue
        load_remapping_config(silent=True)

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

def publish_periodic_device_data():
    """Publish combined device data periodically using latest cached data"""
    global config

    try:
        current_time = datetime.now()

        # For each enabled config
        for remap_config in config:
            if not remap_config.get('enabled', False):
                continue

            config_id = remap_config.get('id', 'unknown')
            pub_config = remap_config.get('mqtt_publish_config', {})
            publish_interval = pub_config.get('publish_interval_seccond', 10)

            # Check if it's time to publish for this config
            if not hasattr(publish_periodic_device_data, 'last_publish_time'):
                publish_periodic_device_data.last_publish_time = {}

            current_timestamp = time.time()
            if config_id not in publish_periodic_device_data.last_publish_time:
                publish_periodic_device_data.last_publish_time[config_id] = 0

            if current_timestamp - publish_periodic_device_data.last_publish_time[config_id] >= publish_interval:
                publish_periodic_device_data.last_publish_time[config_id] = current_timestamp

                # Create combined payload using latest cached data
                final_payload = {}

                cached_data = cached_device_data.get(config_id, {})
                latest_timestamp = None

                # Collect latest data from all devices in config
                for device in remap_config.get('source_devices', []):
                    device_topic = device.get('mqtt_topic')
                    key_mappings = device.get('key_mappings', [])

                    if device_topic in cached_data:
                        device_cached = cached_data[device_topic]
                        device_data = device_cached.get('data', {})
                        device_timestamp = device_cached.get('timestamp')

                        # Update latest timestamp
                        if device_timestamp and (latest_timestamp is None or device_timestamp > latest_timestamp):
                            latest_timestamp = device_timestamp

                        # Map the keys according to configuration (use actual data if available, otherwise None)
                        for mapping in key_mappings:
                            original_key = mapping.get('original_key')
                            custom_key = mapping.get('custom_key')
                            if custom_key:
                                if custom_key in device_data:
                                    final_payload[custom_key] = device_data[custom_key]
                                else:
                                    final_payload[custom_key] = None
                    else:
                        # No cached data for this device - set to None
                        for mapping in key_mappings:
                            custom_key = mapping.get('custom_key')
                            if custom_key:
                                final_payload[custom_key] = None

                # Use latest timestamp from cached data or current time
                final_payload['Timestamp'] = latest_timestamp or current_time.isoformat()

                # Publish using config-specific MQTT settings
                pub_topic = pub_config.get('topic', 'REMAP/DEFAULT')
                qos = pub_config.get('qos', 1)
                retain = pub_config.get('retain', False)

                # Parse broker URL from config and publish using config-specific settings
                broker_url = pub_config.get('broker_url', 'mqtt://18.143.215.113:1883')
                try:
                    if broker_url.startswith('mqtt://'):
                        broker_part = broker_url[7:]  # Remove 'mqtt://'
                        if ':' in broker_part:
                            host, port = broker_part.split(':', 1)
                            port = int(port)
                        else:
                            host = broker_part
                            port = 1883

                        # Create a separate client for this specific config's broker
                        client_id = pub_config.get('client_id', f'remap-{config_id}')
                        periodic_client = connect_mqtt(
                            f'{client_id}-periodic-{int(time.time())}',
                            host, port,
                            on_connect_callback=None,
                            on_disconnect_callback=None,
                            on_message_callback=None
                        )

                        if periodic_client:
                            periodic_client.loop_start()
                            # Wait for connection
                            time.sleep(0.5)

                            if periodic_client.is_connected():
                                # Use qos, retain, and topic from config-specific mqtt_publish_config
                                config_qos = pub_config.get('qos', 1)
                                config_retain = pub_config.get('retain', False)
                                config_topic = pub_config.get('topic', 'REMAP/DEFAULT')

                                periodic_client.publish(config_topic, json.dumps(final_payload), qos=config_qos, retain=config_retain)
                                log_simple(f"Config-specific periodic publish to {host}:{port}/{config_topic} (qos={config_qos}, retain={config_retain}): {json.dumps(final_payload)}", "INFO")
                                periodic_client.loop_stop()
                                periodic_client.disconnect()
                            else:
                                log_simple(f"Failed to connect to config broker {host}:{port}", "ERROR")
                        else:
                            log_simple(f"Could not create MQTT client for config {config_id}", "ERROR")

                except Exception as broker_error:
                    log_simple(f"Error parsing broker URL {broker_url}: {broker_error}", "ERROR")

    except Exception as e:
        log_simple(f"Error in periodic device data publishing: {e}", "ERROR")
        send_error_log("publish_periodic_device_data", f"Periodic publish error: {e}", ERROR_TYPE_MINOR)

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

def publish_combined_real_time_data(remap_config, client):
    """Publish combined real-time data from all devices in config"""
    try:
        if not remap_config.get('enabled', False) or not client or not client.is_connected():
            return

        config_id = remap_config.get('id', 'unknown')

        # Check if we have cached data for all devices in this config
        required_devices = [device.get('mqtt_topic') for device in remap_config.get('source_devices', [])]
        cached_data = cached_device_data.get(config_id, {})

        # Only publish if we have data for ALL devices in the config
        if not all(topic in cached_data for topic in required_devices):
            return

        # Create combined payload (without 'name' field as requested)
        combined_payload = {}

        latest_timestamp = None

        # Collect data from all devices in config
        for device in remap_config.get('source_devices', []):
            device_topic = device.get('mqtt_topic')
            key_mappings = device.get('key_mappings', [])

            if device_topic in cached_data:
                device_cached = cached_data[device_topic]
                device_data = device_cached.get('data', {})
                device_timestamp = device_cached.get('timestamp')

                # Update latest timestamp
                if device_timestamp and (latest_timestamp is None or device_timestamp > latest_timestamp):
                    latest_timestamp = device_timestamp

                # Map the keys according to configuration
                for mapping in key_mappings:
                    original_key = mapping.get('original_key')
                    custom_key = mapping.get('custom_key')
                    if custom_key and custom_key in device_data:
                        combined_payload[custom_key] = device_data[custom_key]

        # Use the latest timestamp
        combined_payload['Timestamp'] = latest_timestamp or datetime.now().isoformat()

        # Publish to configured topic
        pub_config = remap_config.get('mqtt_publish_config', {})
        pub_topic = pub_config.get('topic', 'REMAP/DEFAULT')
        qos = pub_config.get('qos', 1)
        retain = pub_config.get('retain', False)

        if client and client.is_connected():
            client.publish(pub_topic, json.dumps(combined_payload), qos=qos, retain=retain)
            log_simple(f"Combined real-time data published to {pub_topic}: {json.dumps(combined_payload)}", "INFO")

    except Exception as e:
        log_simple(f"Error in combined real-time publishing: {e}", "ERROR")

def publish_real_time_data(remap_config, device, remapped_data, timestamp, client):
    """Update cache and publish combined data if all devices have data (real-time publishing)"""
    try:
        if not remap_config.get('enabled', False) or not client or not client.is_connected():
            return

        config_id = remap_config.get('id', 'unknown')
        device_topic = device.get('mqtt_topic')

        # Update cache with new data
        add_to_device_cache(config_id, device_topic, remapped_data, timestamp)

        # Try to publish combined data if we have data for all devices
        publish_combined_real_time_data(remap_config, client)

    except Exception as e:
        log_simple(f"Error in real-time publishing: {e}", "ERROR")

def handle_device_topic_data(client, topic, payload):
    """Handle incoming device data from subscribed topics and remap/publish with real-time publishing"""
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

                config_id = remap_config.get('id', 'unknown')

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

                        # Real-time publishing: Publish immediately when data is received
                        if remapped_data:
                            device_group = device.get('group')
                            timestamp = device_message.get('Timestamp', datetime.now().isoformat())

                            # Publish real-time data immediately
                            publish_real_time_data(remap_config, device, remapped_data, timestamp, client)

                            # Also buffer for periodic publishing if needed
                            add_to_device_cache(config_id, topic, remapped_data, timestamp)

                            # Removed device logging as requested

                        break  # Assume one config per topic

        except json.JSONDecodeError as e:
            log_simple(f"Failed to parse device message JSON: {e}", "ERROR")
        except Exception as e:
            log_simple(f"Error processing device message: {e}", "ERROR")
            send_error_log("handle_device_topic_data", f"Device message processing error: {e}", ERROR_TYPE_MINOR)

    except Exception as e:
        log_simple(f"Error handling device topic data: {e}", "ERROR")
        send_error_log("handle_device_topic_data", f"Device topic data handling error: {e}", ERROR_TYPE_MINOR)

# --- CRUD Operations ---
def handle_get_request(client):
    """Handle get data request"""
    try:
        # Ensure config file is loaded before sending
        load_remapping_config()

        response = {
            "status": "success",
            "data": config,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response))
            log_simple(f"Configuration data sent to client ({len(config)} configs)", "SUCCESS")
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
        if not mqtt:
            log_simple("MQTT client cannot be created - paho-mqtt library not available", "ERROR")
            return None

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

    # Use the broker configuration from the first enabled remapping config
    first_enabled_config = None
    for remap_config in config:
        if remap_config.get('enabled', False):
            first_enabled_config = remap_config
            break

    if first_enabled_config:
        pub_config = first_enabled_config.get('mqtt_publish_config', {})
        broker_url = pub_config.get('broker_url', 'mqtt://18.143.215.113:1883')

        # Parse broker URL for main connection
        try:
            if broker_url.startswith('mqtt://'):
                broker_part = broker_url[7:]  # Remove 'mqtt://'
                if ':' in broker_part:
                    broker, port_part = broker_part.split(':', 1)
                    port = int(port_part)
                else:
                    broker = broker_part
                    port = 1883
        except Exception as e:
            log_simple(f"Error parsing broker URL {broker_url}, using 18.143.215.113:1883: {e}", "WARNING")
            broker = '18.143.215.113'
            port = 1883
    else:
        # Fallback to config or default if no enabled configs
        broker = mqtt_config.get('broker_address', '18.143.215.113')
        port = int(mqtt_config.get('broker_port', 1883))

    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')

    # Initialize unified error logger
    log_simple("Initializing unified error logger...")
    error_logger = initialize_error_logger("RemappingPayloadService", broker, port)
    client_error_logger = error_logger.client if error_logger else None

    # Connect to remap MQTT broker
    log_simple(f"Connecting to Remap MQTT broker at {broker}:{port}...")
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
