import json
import time
import threading
import logging
import paho.mqtt.client as mqtt
import uuid
from datetime import datetime, timedelta
import os
import urllib.parse
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("MQTTConfigurationService")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("===== MQTT Configuration Service =====")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("===== MQTT Configuration Service =====")
    print("Success To Running")
    print("Log print Data")
    print("")

def print_broker_status(status=False):
    """Print MQTT broker connection status"""
    if status:
        print("MQTT Broker is Running")
    else:
        print("MQTT Broker connection failed")
    print("\n" + "="*34)

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

# --- Global Variables ---
mqtt_configs = []
broker_connected = False

# --- Locking for thread safety ---
configs_lock = threading.RLock()

# --- MQTT Client ---
client = None  # Will be set by the caller

# --- Threading ---
configs_publisher_thread = None
configs_publisher_stop = False

# --- Configuration File Paths ---
mqtt_config_file = '../MODBUS_SNMP/JSON/Config/mqtt_config.json'
mqtt_configs_file = './JSON/mqttConfig.json'

# --- MQTT Topic Definitions ---
topic_command = "command_mqtt_config"
topic_response = "response_mqtt_config"

# --- MQTT Configuration JSON File Operations ---
def initialize_mqtt_configs_file():
    """Initialize the MQTT configurations JSON file if it doesn't exist"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(mqtt_configs_file), exist_ok=True)

        if not os.path.exists(mqtt_configs_file):
            default_configs = [
                {
                    "id": 1,
                    "name": "Local MQTT Broker",
                    "broker_url": "mqtt://localhost:1883",
                    "broker_port": 1883,
                    "username": "",
                    "password": "",
                    "client_id": "mqtt-local-client",
                    "keepalive": 60,
                    "qos": 0,
                    "retain": False,
                    "clean_session": True,
                    "reconnect_period": 3000,
                    "connect_timeout": 5000,
                    "protocol": "mqtt",
                    "is_active": True,
                    "enabled": True,
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "last_connected": None,
                    "connection_status": "disconnected",
                    "error_message": None
                }
            ]

            with open(mqtt_configs_file, 'w', encoding='utf-8') as f:
                json.dump(default_configs, f, indent=2)

            log_simple("MQTT configurations JSON file created with default config")
            return True
        else:
            log_simple("MQTT configurations JSON file already exists")
            return True

    except Exception as e:
        log_simple(f"Error initializing MQTT configs JSON file: {e}", "ERROR")
        return False

def load_mqtt_configs():
    """Load MQTT configurations from JSON file"""
    global mqtt_configs

    try:
        with configs_lock:
            if not os.path.exists(mqtt_configs_file):
                log_simple("MQTT configurations file not found, creating default", "WARNING")
                initialize_mqtt_configs_file()

            with open(mqtt_configs_file, 'r', encoding='utf-8') as f:
                mqtt_configs[:] = json.load(f)

            log_simple(f"Loaded {len(mqtt_configs)} MQTT configurations from JSON file")

    except json.JSONDecodeError as e:
        log_simple(f"Error parsing MQTT configurations JSON: {e}", "ERROR")
        with configs_lock:
            mqtt_configs[:] = []
        send_error_log("load_mqtt_configs", f"JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Error loading MQTT configurations from JSON: {e}", "ERROR")
        with configs_lock:
            mqtt_configs[:] = []
        send_error_log("load_mqtt_configs", f"Load error: {e}", ERROR_TYPE_MAJOR)

def save_mqtt_configs_to_file():
    """Save current mqtt_configs to JSON file"""
    try:
        with open(mqtt_configs_file, 'w', encoding='utf-8') as f:
            json.dump(mqtt_configs, f, indent=2, ensure_ascii=False)
        log_simple("MQTT configurations saved to JSON file", "SUCCESS")
        return True
    except Exception as e:
        log_simple(f"Error saving MQTT configurations to JSON: {e}", "ERROR")
        return False

def save_mqtt_config(config_data):
    """Save MQTT configuration to JSON file"""
    try:
        # Check if configuration exists
        config_id = config_data.get('id')
        existing = None

        if config_id:
            for i, config in enumerate(mqtt_configs):
                if config['id'] == config_id:
                    existing = (i, config)
                    break

        if existing:
            # Update existing configuration
            index, _ = existing
            config_data['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Ensure all required fields are present
            for key, value in config_data.items():
                if key != 'id':  # Don't update id
                    mqtt_configs[index][key] = value

            action = "updated"
        else:
            # Insert new configuration
            if not config_id:
                # Generate new ID
                existing_ids = [config.get('id', 0) for config in mqtt_configs]
                config_id = max(existing_ids) + 1 if existing_ids else 1

            new_config = {
                'id': config_id,
                'name': config_data.get('name', f'Configuration {config_id}'),
                'created_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'updated_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'last_connected': None,
                'connection_status': 'disconnected',
                'error_message': None,
                **config_data
            }
            mqtt_configs.append(new_config)
            action = "created"

        # Save to file
        if save_mqtt_configs_to_file():
            return True, f"MQTT configuration {action} successfully"
        else:
            return False, "Failed to save configuration to file"

    except Exception as e:
        log_simple(f"Error saving MQTT configuration: {e}", "ERROR")
        return False, str(e)

def delete_mqtt_config(config_id):
    """Delete MQTT configuration from JSON file"""
    try:
        initial_length = len(mqtt_configs)

        with configs_lock:
            mqtt_configs[:] = [config for config in mqtt_configs if config['id'] != config_id]

        if len(mqtt_configs) < initial_length:
            if save_mqtt_configs_to_file():
                return True, "MQTT configuration deleted successfully"
            else:
                return False, "Failed to save after deletion"
        else:
            return False, "MQTT configuration not found"

    except Exception as e:
        log_simple(f"Error deleting MQTT configuration: {e}", "ERROR")
        return False, str(e)

def set_active_mqtt_config(config_id):
    """Set active MQTT configuration in JSON file"""
    try:
        with configs_lock:
            # Set all configurations to inactive first
            for config in mqtt_configs:
                config['is_active'] = False

            # Set specified config to active
            for config in mqtt_configs:
                if config['id'] == config_id:
                    config['is_active'] = True
                    config['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    break

        if save_mqtt_configs_to_file():
            return True, "Active MQTT configuration updated successfully"
        else:
            return False, "Failed to save active configuration"

    except Exception as e:
        log_simple(f"Error setting active MQTT configuration: {e}", "ERROR")
        return False, str(e)

def enable_mqtt_config(config_id, enable=True):
    """Enable/disable MQTT configuration for app use in JSON file"""
    try:
        with configs_lock:
            for config in mqtt_configs:
                if config['id'] == config_id:
                    config['enabled'] = enable
                    config['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    break

        if save_mqtt_configs_to_file():
            return True, f"MQTT configuration {'enabled' if enable else 'disabled'} successfully"
        else:
            return False, "Failed to save enabled configuration"

    except Exception as e:
        log_simple(f"Error updating MQTT configuration enabled status: {e}", "ERROR")
        return False, str(e)

def update_connection_status(config_id, status, error_message=None):
    """Update connection status of MQTT configuration in JSON file"""
    try:
        update_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if status == "connected" else None

        with configs_lock:
            for config in mqtt_configs:
                if config['id'] == config_id:
                    config['connection_status'] = status
                    config['error_message'] = error_message
                    config['last_connected'] = update_time
                    config['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    break

        save_mqtt_configs_to_file()
        return True

    except Exception as e:
        log_simple(f"Error updating connection status: {e}", "ERROR")
        return False

# --- MQTT Configuration Management ---
def create_mqtt_config(config_data):
    """Create new MQTT configuration"""
    try:
        # Validate required fields
        required_fields = ['name', 'broker_url']
        for field in required_fields:
            if not config_data.get(field):
                return False, f"Required field missing: {field}"

        # Construct full broker URL if needed
        broker_url = config_data['broker_url']
        if not broker_url.startswith(('mqtt://', 'mqtts://', 'ws://', 'wss://')):
            protocol = config_data.get('protocol', 'mqtt')
            host = config_data.get('broker_host', broker_url)
            port = config_data.get('broker_port', 1883)

            # For WebSocket protocols, add /mqtt path if not included in host
            if protocol in ['ws', 'wss'] and not host.endswith('/mqtt'):
                broker_url = f"{protocol}://{host}:{port}/mqtt"
            else:
                broker_url = f"{protocol}://{host}:{port}"

        config_to_save = {
            'name': config_data['name'],
            'broker_url': broker_url,
            'broker_port': config_data.get('broker_port', 1883),
            'username': config_data.get('username'),
            'password': config_data.get('password'),
            'client_id': config_data.get('client_id'),
            'keepalive': config_data.get('keepalive', 60),
            'qos': config_data.get('qos', 0),
            'retain': config_data.get('retain', False),
            'clean_session': config_data.get('clean_session', True),
            'reconnect_period': config_data.get('reconnect_period', 3000),
            'connect_timeout': config_data.get('connect_timeout', 5000),
            'protocol': config_data.get('protocol', 'mqtt'),
            'is_active': config_data.get('is_active', False),
            'enabled': config_data.get('enabled', False),
        }

        return save_mqtt_config(config_to_save)

    except Exception as e:
        log_simple(f"Error creating MQTT configuration: {e}", "ERROR")
        return False, str(e)

def update_mqtt_config(config_data):
    """Update existing MQTT configuration"""
    try:
        if not config_data.get('id'):
            return False, "Configuration ID is required for update"

        # Construct full broker URL if needed
        broker_url = config_data['broker_url']
        if not broker_url.startswith(('mqtt://', 'mqtts://', 'ws://', 'wss://')):
            protocol = config_data.get('protocol', 'mqtt')
            host = config_data.get('broker_host', broker_url)
            port = config_data.get('broker_port', 1883)

            # For WebSocket protocols, add /mqtt path if not included in host
            if protocol in ['ws', 'wss'] and not host.endswith('/mqtt'):
                broker_url = f"{protocol}://{host}:{port}/mqtt"
            else:
                broker_url = f"{protocol}://{host}:{port}"

        config_to_save = {
            'id': config_data['id'],
            'name': config_data['name'],
            'broker_url': broker_url,
            'broker_port': config_data.get('broker_port', 1883),
            'username': config_data.get('username'),
            'password': config_data.get('password'),
            'client_id': config_data.get('client_id'),
            'keepalive': config_data.get('keepalive', 60),
            'qos': config_data.get('qos', 0),
            'retain': config_data.get('retain', False),
            'clean_session': config_data.get('clean_session', True),
            'reconnect_period': config_data.get('reconnect_period', 3000),
            'connect_timeout': config_data.get('connect_timeout', 5000),
            'protocol': config_data.get('protocol', 'mqtt'),
            'is_active': config_data.get('is_active', False),
            'enabled': config_data.get('enabled', False),
        }

        return save_mqtt_config(config_to_save)

    except Exception as e:
        log_simple(f"Error updating MQTT configuration: {e}", "ERROR")
        return False, str(e)

# --- MQTT Message Handling ---
def on_message_mqtt_config(client, userdata, msg):
    """Handle MQTT configuration messages"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()

        log_simple(f"MQTT Config Message: {topic} - {payload[:100]}...")

        if topic == topic_command:
            try:
                message_data = json.loads(payload)
                command = message_data.get('command')

                if command == "get":
                    handle_get_configs(client)
                elif command == "get_active_enabled":
                    handle_get_active_enabled_configs(client, message_data)
                elif command == "create":
                    handle_create_config(client, message_data)
                elif command == "update":
                    handle_update_config(client, message_data)
                elif command == "delete":
                    handle_delete_config(client, message_data)
                elif command == "set_active":
                    handle_set_active_config(client, message_data)
                elif command == "enable":
                    handle_enable_config(client, message_data)
                elif command == "check_status":
                    handle_check_all_status(client)
                elif command == "test_connection":
                    handle_test_connection(client, message_data)
                else:
                    log_simple(f"Unknown MQTT config command: {command}", "WARNING")

            except json.JSONDecodeError:
                log_simple(f"Invalid JSON in MQTT config command message: {payload}", "ERROR")
            except Exception as e:
                log_simple(f"Error processing MQTT config command: {e}", "ERROR")

    except Exception as e:
        log_simple(f"Error handling MQTT config message: {e}", "ERROR")

def handle_get_configs(client):
    """Handle get configurations request"""
    try:
        with configs_lock:
            # Get safe configs data
            configs_data = mqtt_configs.copy()

        response = {
            "command": "get",
            "success": True,
            "data": configs_data,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
            log_simple("MQTT configs data sent to client", "SUCCESS")
        else:
            log_simple("Client not connected, cannot send configs data", "WARNING")

    except Exception as e:
        error_response = {
            "command": "get",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_get_configs", f"Get configs error: {e}", ERROR_TYPE_MINOR)

def handle_get_active_enabled_configs(client, message_data):
    """Handle get active/enabled configurations request"""
    try:
        request_id = message_data.get('request_id', 'default')

        with configs_lock:
            # Find enabled configuration first
            enabled_configs = [config for config in mqtt_configs if config.get('enabled', False)]

            if enabled_configs:
                # Return all enabled configs for frontend context selection
                configs_data = enabled_configs.copy()
                selected_config = enabled_configs[0]  # First enabled config
                log_simple(f"Found {len(enabled_configs)} enabled configurations, using first one: {selected_config.get('name')}")
            else:
                # Fallback to active configurations
                active_configs = [config for config in mqtt_configs if config.get('is_active', False)]
                if active_configs:
                    configs_data = active_configs.copy()
                    selected_config = active_configs[0]  # First active config
                    log_simple(f"Found {len(active_configs)} active configurations, using first one: {selected_config.get('name')}")
                else:
                    # No active/enabled configs found
                    response = {
                        "command": "get_active_enabled",
                        "success": False,
                        "error": "No active or enabled MQTT configurations found",
                        "request_id": request_id,
                        "data": [],
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    if client and client.is_connected():
                        client.publish(topic_response, json.dumps(response), qos=1)
                    return

        response = {
            "command": "get_active_enabled",
            "success": True,
            "data": configs_data,
            "request_id": request_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
            log_simple("Active/enabled MQTT configs data sent to client", "SUCCESS")
        else:
            log_simple("Client not connected, cannot send active config data", "WARNING")

    except Exception as e:
        error_response = {
            "command": "get_active_enabled",
            "success": False,
            "error": str(e),
            "request_id": message_data.get('request_id', 'default'),
            "data": [],
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_get_active_enabled_configs", f"Get active/enabled configs error: {e}", ERROR_TYPE_MINOR)

def handle_create_config(client, message_data):
    """Handle create config request"""
    try:
        data = message_data.get('data', {})
        success, message = create_mqtt_config(data)

        response = {
            "command": "create",
            "success": success,
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
        else:
            log_simple("Client not connected, cannot send create response", "WARNING")

    except Exception as e:
        error_response = {
            "command": "create",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_create_config", f"Create config error: {e}", ERROR_TYPE_MAJOR)

def handle_update_config(client, message_data):
    """Handle update config request"""
    try:
        data = message_data.get('data', {})
        success, message = update_mqtt_config(data)

        response = {
            "command": "update",
            "success": success,
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
        else:
            log_simple("Client not connected, cannot send update response", "WARNING")

    except Exception as e:
        error_response = {
            "command": "update",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_update_config", f"Update config error: {e}", ERROR_TYPE_MAJOR)

def handle_delete_config(client, message_data):
    """Handle delete config request"""
    try:
        data = message_data.get('data', {})
        config_id = data.get('id')
        success, message = delete_mqtt_config(config_id)

        response = {
            "command": "delete",
            "success": success,
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
        else:
            log_simple("Client not connected, cannot send delete response", "WARNING")

    except Exception as e:
        error_response = {
            "command": "delete",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_delete_config", f"Delete config error: {e}", ERROR_TYPE_MAJOR)

def handle_set_active_config(client, message_data):
    """Handle set active config request"""
    try:
        data = message_data.get('data', {})
        config_id = data.get('id')
        success, message = set_active_mqtt_config(config_id)

        response = {
            "command": "set_active",
            "success": success,
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
        else:
            log_simple("Client not connected, cannot send set active response", "WARNING")

    except Exception as e:
        error_response = {
            "command": "set_active",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_set_active_config", f"Set active config error: {e}", ERROR_TYPE_MAJOR)

def handle_enable_config(client, message_data):
    """Handle enable config request"""
    try:
        data = message_data.get('data', {})
        config_id = data.get('id')
        enable = data.get('enable', True)
        success, message = enable_mqtt_config(config_id, enable)

        response = {
            "command": "enable",
            "success": success,
            "message": message,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
        else:
            log_simple("Client not connected, cannot send enable response", "WARNING")

    except Exception as e:
        error_response = {
            "command": "enable",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_enable_config", f"Enable config error: {e}", ERROR_TYPE_MAJOR)

def handle_check_all_status(client):
    """Handle check all connection status request"""
    try:
        import paho.mqtt.client as mqtt_test

        status_results = []

        with configs_lock:
            for config in mqtt_configs:
                try:
                    # Parse broker URL
                    broker_url = config['broker_url']
                    if broker_url.startswith(('mqtt://', 'mqtts://', 'ws://', 'wss://')):
                        parsed = urllib.parse.urlparse(broker_url)
                        test_client = mqtt_test.Client(f"test-{config['id']}-{int(time.time())}", clean_session=True)

                        if config.get('username') and config.get('password'):
                            test_client.username_pw_set(config['username'], config['password'])

                        test_client.connect(parsed.hostname, parsed.port or 1883)
                        test_client.disconnect()

                        update_connection_status(config['id'], 'connected')
                        status_results.append({
                            'id': config['id'],
                            'status': 'connected'
                        })
                    else:
                        raise Exception("Invalid broker URL format")

                except Exception as e:
                    update_connection_status(config['id'], 'error', str(e))
                    status_results.append({
                        'id': config['id'],
                        'status': 'error',
                        'error': str(e)
                    })

        response = {
            "command": "check_status",
            "success": True,
            "data": status_results,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
        else:
            log_simple("Client not connected, cannot send check status response", "WARNING")

    except Exception as e:
        error_response = {
            "command": "check_status",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_check_all_status", f"Check all status error: {e}", ERROR_TYPE_MAJOR)

def handle_test_connection(client, message_data):
    """Handle test connection request"""
    try:
        import paho.mqtt.client as mqtt_test

        data = message_data.get('data', {})
        config_id = data.get('id')

        # Find config
        config = None
        with configs_lock:
            for c in mqtt_configs:
                if c['id'] == config_id:
                    config = c
                    break

        if not config:
            response = {
                "command": "test_connection",
                "success": False,
                "error": "Configuration not found",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        else:
            try:
                # Parse broker URL
                broker_url = config['broker_url']
                parsed = urllib.parse.urlparse(broker_url)

                test_client = mqtt_test.Client(f"test-{config_id}-{int(time.time())}", clean_session=True)

                if config.get('username') and config.get('password'):
                    test_client.username_pw_set(config['username'], config['password'])

                start_time = time.time()
                test_client.connect(parsed.hostname, parsed.port or 1883)
                test_client.disconnect()
                latency = int((time.time() - start_time) * 1000)

                update_connection_status(config_id, 'connected')

                response = {
                    "command": "test_connection",
                    "success": True,
                    "latency": latency,
                    "message": "Connection successful",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }

            except Exception as e:
                update_connection_status(config_id, 'error', str(e))
                response = {
                    "command": "test_connection",
                    "success": False,
                    "error": str(e),
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
        else:
            log_simple("Client not connected, cannot send test connection response", "WARNING")

    except Exception as e:
        error_response = {
            "command": "test_connection",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_test_connection", f"Test connection error: {e}", ERROR_TYPE_MAJOR)

# --- Initialization ---
def initialize_mqtt_configuration(mqtt_client=None):
    """Initialize MQTT configuration service"""
    global client

    print_startup_banner()

    # Initialize JSON configuration file
    log_simple("Initializing MQTT configurations JSON file...")
    if not initialize_mqtt_configs_file():
        log_simple("Failed to initialize JSON configuration file", "ERROR")
        return False

    # Load configurations
    load_mqtt_configs()

    # Set MQTT client (passed from main service)
    client = mqtt_client

    if client:
        # Subscribe to MQTT config topic
        client.subscribe(topic_command, 1)
        log_simple("Subscribed to MQTT configuration MQTT topic", "SUCCESS")

    print_success_banner()

    log_simple(f"MQTT Configuration Service started with {len(mqtt_configs)} configurations", "SUCCESS")
    return True

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
        send_error_log("connect_mqtt", f"MQTT connection failed: {e}", ERROR_TYPE_CRITICAL)
        return None

# --- MQTT Callbacks ---
def on_connect(client, userdata, flags, rc):
    """Callback function when MQTT client connects."""
    global broker_connected
    if rc == 0:
        broker_connected = True
        log_simple("Connected to MQTT broker successfully", "SUCCESS")

        # Subscribe to MQTT config topic
        client.subscribe(topic_command, 1)
        log_simple("Subscribed to MQTT configuration MQTT topic", "SUCCESS")
    else:
        broker_connected = False
        send_error_log("on_connect", f"Failed to connect to MQTT Broker, return code: {rc}", "critical")

def on_disconnect(client, userdata, rc):
    """Callback function when MQTT client disconnects."""
    global broker_connected
    broker_connected = False
    if rc != 0:
        log_simple(f"Unexpected disconnect from MQTT broker with code {rc}. Attempting reconnect...", "WARNING")
        send_error_log("on_disconnect", f"Unexpected disconnect from MQTT broker with code {rc}", "major")

def load_mqtt_config():
    """Load MQTT config with graceful error handling"""
    default_config = {
        "enable": True,
        "broker_address": "localhost",
        "broker_port": 1883,
        "username": "",
        "password": "",
        "qos": 1,
        "retain": True
    }

    try:
        with open(mqtt_config_file, 'r') as file:
            content = file.read().strip()
            if not content:
                return default_config
            return json.loads(content)
    except Exception as e:
        log_simple(f"Error loading MQTT config: {e}. Using defaults.", "WARNING")
        return default_config

# --- Main Application ---
def run():
    """Main execution function for the MQTT Configuration service."""
    global client

    print_startup_banner()

    # Initialize JSON configuration file
    log_simple("Initializing MQTT configurations JSON file...")
    if not initialize_mqtt_configs_file():
        log_simple("Failed to initialize JSON configuration file", "ERROR")
        return False

    # Load configurations
    load_mqtt_configs()

    # Load MQTT configuration
    mqtt_config = load_mqtt_config()

    broker = mqtt_config.get('broker_address', 'localhost')
    port = int(mqtt_config.get('broker_port', 1883))
    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')

    # Connect to MQTT broker
    log_simple("Connecting to MQTT broker...")
    client = connect_mqtt(
        f'mqtt-config-service-{int(time.time())}',
        broker, port, username, password,
        on_connect, on_disconnect, on_message_mqtt_config
    )

    # Start client loop
    if client:
        client.loop_start()

    # Wait for connection
    time.sleep(2)

    print_success_banner()
    print_broker_status(broker_connected)

    log_simple(f"MQTT Configuration Service started with {len(mqtt_configs)} configurations", "SUCCESS")

    try:
        while True:
            time.sleep(1)  # Keep the service running
    except KeyboardInterrupt:
        log_simple("Service stopped by user", "WARNING")
    except Exception as e:
        log_simple(f"Critical error: {e}", "ERROR")
        send_error_log("run", f"Critical service error: {e}", ERROR_TYPE_CRITICAL)
    finally:
        log_simple("Shutting down MQTT Configuration Service...")

        if client:
            client.loop_stop()
            client.disconnect()
        log_simple("MQTT Configuration Service terminated", "SUCCESS")

if __name__ == '__main__':
    run()

# --- Exception for missing MQTT client ---
class MQTTClientNotSetError(Exception):
    pass
