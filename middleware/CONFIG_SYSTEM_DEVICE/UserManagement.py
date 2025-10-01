import json
import time
import threading
import logging
import uuid
import hashlib
import paho.mqtt.client as mqtt
from datetime import datetime, timedelta
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("UserManagementService")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("===== User Management Service =====")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("===== User Management Service =====")
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
users = []
broker_connected = False

# --- Locking for thread safety ---
users_lock = threading.RLock()

# --- MQTT Client ---
client = None  # Will be set by the caller

# --- Threading ---
users_publisher_thread = None
users_publisher_stop = False

# --- Configuration File Paths ---
mqtt_config_file = '../MODBUS_SNMP/JSON/Config/mqtt_config.json'
users_config_file = './JSON/usersConfig.json'

# --- MQTT Topic Definitions ---
topic_command = "command_user_management"
topic_response = "response_user_management"

# --- Error severity levels ---
ERROR_TYPE_CRITICAL = "CRITICAL"
ERROR_TYPE_MAJOR = "MAJOR"
ERROR_TYPE_MINOR = "MINOR"
ERROR_TYPE_WARNING = "WARNING"

# --- Configuration Management ---
def load_mqtt_config():
    """Load MQTT config with graceful error handling and retry loop"""
    default_config = {
        "enable": True,
        "broker_address": "localhost",
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
                    log_simple("MQTT config file is empty. Retrying in 5 seconds...", "WARNING")
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

def load_users_config():
    """Load user management configuration"""
    global users
    try:
        with open(users_config_file, 'r') as file:
            loaded_data = json.load(file)

        if isinstance(loaded_data, list):
            users[:] = loaded_data
            log_simple(f"Users configuration loaded from {users_config_file}")
        else:
            users[:] = []
            log_simple("Invalid users config format, using default structure.", "WARNING")

    except FileNotFoundError:
        log_simple(f"Users config file not found: {users_config_file}. Creating default config.")
        users[:] = []
        # Create some default users
        default_users = [
            {
                "id": str(uuid.uuid4()),
                "name": "System Administrator",
                "email": "admin@gmail.com",
                "department": "IT",
                "status": "active",
                "role": "admin",
                "password_hash": hashlib.sha256("pass123".encode()).hexdigest(),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "last_login": None
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Regular User",
                "email": "user@gmail.com",
                "department": "IT",
                "status": "active",
                "role": "user",
                "password_hash": hashlib.sha256("pass123".encode()).hexdigest(),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "last_login": None
            }
        ]
        users[:] = default_users
        save_users_config()
    except json.JSONDecodeError as e:
        log_simple(f"Failed to load users config (JSON decode error): {e}. Using default.", "ERROR")
        users[:] = []
        send_error_log("load_users_config", f"Users config JSON decode error: {e}", ERROR_TYPE_MAJOR)
    except Exception as e:
        log_simple(f"Failed to load users config: {e}", "ERROR")
        users[:] = []
        send_error_log("load_users_config", f"Users config load error: {e}", ERROR_TYPE_MAJOR)

def save_users_config():
    """Save user management configuration"""
    try:
        with users_lock:
            with open(users_config_file, 'w') as file:
                json.dump(users, file, indent=2)
        log_simple(f"Users configuration saved to {users_config_file}")
    except Exception as e:
        log_simple(f"Failed to save users config: {e}", "ERROR")
        send_error_log("save_users_config", f"Users config save error: {e}", ERROR_TYPE_MAJOR)

def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, password_hash):
    """Verify password against hash"""
    return hash_password(password) == password_hash

# --- User Management Operations ---
def create_user(user_data):
    """Create new user"""
    try:
        # Validate required fields
        required_fields = ['name', 'email', 'department', 'password']
        for field in required_fields:
            if not user_data.get(field):
                return False, "Required field missing"

        # Check if email already exists
        if any(user['email'] == user_data['email'] for user in users):
            return False, "Email already exists"

        # Hash password
        password_hash = hash_password(user_data['password'])

        new_user = {
            'id': str(uuid.uuid4()),
            'name': user_data['name'],
            'email': user_data['email'],
            'department': user_data['department'],
            'status': user_data.get('status', 'active'),
            'role': user_data.get('role', 'user'),
            'password_hash': password_hash,
            'created_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'updated_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'last_login': None
        }

        with users_lock:
            users.append(new_user)

        save_users_config()
        log_simple(f"User created: {new_user['name']} ({new_user['email']})")
        return True, f"User '{new_user['name']}' created successfully"

    except Exception as e:
        log_simple(f"Error creating user: {e}", "ERROR")
        send_error_log("create_user", f"User creation error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def update_user(user_data):
    """Update existing user"""
    try:
        user_id = user_data.get('id')
        if not user_id:
            return False, "User ID is required for update"

        with users_lock:
            for i, user in enumerate(users):
                if user['id'] == user_id:
                    # Update fields
                    if 'name' in user_data:
                        user['name'] = user_data['name']
                    if 'email' in user_data:
                        # Check if new email conflicts
                        if user_data['email'] != user['email'] and any(u['email'] == user_data['email'] for u in users):
                            return False, "Email already exists"
                        user['email'] = user_data['email']
                    if 'department' in user_data:
                        user['department'] = user_data['department']
                    if 'status' in user_data:
                        user['status'] = user_data['status']
                    if 'role' in user_data:
                        user['role'] = user_data['role']
                    if 'password' in user_data and user_data['password']:
                        user['password_hash'] = hash_password(user_data['password'])

                    user['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    save_users_config()
                    log_simple(f"User updated: {user['name']} ({user['email']})")
                    return True, f"User '{user['name']}' updated successfully"

        return False, f"User with ID {user_id} not found"

    except Exception as e:
        log_simple(f"Error updating user: {e}", "ERROR")
        send_error_log("update_user", f"User update error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def delete_user(user_id):
    """Delete user"""
    try:
        if not user_id:
            return False, "User ID is required for deletion"

        with users_lock:
            initial_count = len(users)
            users[:] = [user for user in users if user['id'] != user_id]

            if len(users) < initial_count:
                save_users_config()
                log_simple(f"User deleted: {user_id}")
                return True, "User deleted successfully"
            else:
                return False, f"User with ID {user_id} not found"

    except Exception as e:
        log_simple(f"Error deleting user: {e}", "ERROR")
        send_error_log("delete_user", f"User deletion error: {e}", ERROR_TYPE_MAJOR)
        return False, str(e)

def authenticate_user(email, password):
    """Authenticate user"""
    try:
        for user in users:
            if user['email'] == email and user['status'] == 'active':
                if verify_password(password, user['password_hash']):
                    # Update last login
                    user['last_login'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    save_users_config()
                    log_simple(f"User authenticated: {user['name']} ({user['email']})")
                    return user

        return None
    except Exception as e:
        log_simple(f"Error authenticating user: {e}", "ERROR")
        return None

# --- MQTT Message Handling ---
def on_message_user_management(client, userdata, msg):
    """Handle user management messages"""
    try:
        topic = msg.topic
        payload = msg.payload.decode()

        log_simple(f"User Management Message: {topic} - {payload}")

        if topic == topic_command:
            try:
                message_data = json.loads(payload)
                command = message_data.get('command')

                if command == "get":
                    handle_get_users(client)
                elif command == "add":
                    handle_create_user(client, message_data)
                elif command == "set":
                    handle_update_user(client, message_data)
                elif command == "delete":
                    handle_delete_user(client, message_data)
                elif command == "authenticate":
                    handle_authenticate_user(client, message_data)
                else:
                    log_simple(f"Unknown user management command: {command}", "WARNING")

            except json.JSONDecodeError:
                log_simple(f"Invalid JSON in user management command message: {payload}", "ERROR")
            except Exception as e:
                log_simple(f"Error processing user management command: {e}", "ERROR")

    except Exception as e:
        log_simple(f"Error handling user management message: {e}", "ERROR")
        send_error_log("on_message_user_management", f"User management message handling error: {e}", ERROR_TYPE_MINOR)

def handle_get_users(client):
    """Handle get users request"""
    try:
        with users_lock:
            # Remove password hashes from response
            safe_users = []
            for user in users:
                safe_user = user.copy()
                if 'password_hash' in safe_user:
                    del safe_user['password_hash']
                safe_users.append(safe_user)

        response = {
            "command": "get",
            "success": True,
            "data": safe_users,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
            log_simple("Users data sent to client", "SUCCESS")
        else:
            log_simple("Client not connected, cannot send users data", "WARNING")

    except Exception as e:
        error_response = {
            "command": "get",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_get_users", f"Get users error: {e}", ERROR_TYPE_MINOR)

def handle_create_user(client, message_data):
    """Handle create user request"""
    try:
        data = message_data.get('data', {})
        success, message = create_user(data)

        response = {
            "command": "add",
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
            "command": "add",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_create_user", f"Create user error: {e}", ERROR_TYPE_MAJOR)

def handle_update_user(client, message_data):
    """Handle update user request"""
    try:
        data = message_data.get('data', {})
        success, message = update_user(data)

        response = {
            "command": "set",
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
            "command": "set",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_update_user", f"Update user error: {e}", ERROR_TYPE_MAJOR)

def handle_delete_user(client, message_data):
    """Handle delete user request"""
    try:
        data = message_data.get('data', {})
        user_id = data.get('id')
        success, message = delete_user(user_id)

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
        send_error_log("handle_delete_user", f"Delete user error: {e}", ERROR_TYPE_MAJOR)

def handle_authenticate_user(client, message_data):
    """Handle authenticate user request"""
    try:
        data = message_data.get('data', {})
        email = data.get('email')
        password = data.get('password')

        authenticated_user = authenticate_user(email, password)

        if authenticated_user:
            # Remove password hash from response
            safe_user = authenticated_user.copy()
            if 'password_hash' in safe_user:
                del safe_user['password_hash']

            response = {
                "command": "authenticate",
                "success": True,
                "data": safe_user,
                "message": "Authentication successful",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        else:
            response = {
                "command": "authenticate",
                "success": False,
                "error": "Invalid email or password",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        if client and client.is_connected():
            client.publish(topic_response, json.dumps(response), qos=1)
        else:
            log_simple("Client not connected, cannot send authenticate response", "WARNING")

    except Exception as e:
        error_response = {
            "command": "authenticate",
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        if client and client.is_connected():
            client.publish(topic_response, json.dumps(error_response), qos=1)
        send_error_log("handle_authenticate_user", f"Authenticate user error: {e}", ERROR_TYPE_MAJOR)

# --- Initialization ---
def initialize_user_management(mqtt_client=None):
    """Initialize user management service"""
    global client

    print_startup_banner()

    # Removed MAC address testing to avoid log spam

    # Load configurations
    log_simple("Loading user management configurations...")
    mqtt_config = load_mqtt_config()
    load_users_config()

    # Set MQTT client (passed from main service)
    client = mqtt_client

    if client:
        # Subscribe to user management topic
        client.subscribe(topic_command, 1)
        log_simple("Subscribed to user management MQTT topic", "SUCCESS")

    print_success_banner()

    log_simple(f"User Management Service started with {len(users)} users", "SUCCESS")

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

        # Subscribe to user management topic
        client.subscribe(topic_command, 1)
        log_simple("Subscribed to user management MQTT topic", "SUCCESS")

        # Start the users data publisher thread
        start_users_publisher()
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

# --- Users Data Publishing ---
def publish_users_data():
    """
    Continuously publishes users data to MQTT topic every 3 seconds.
    Runs in a separate thread for real-time updates.
    """
    global users_publisher_stop

    log_simple("Starting users data publisher thread...", "INFO")

    while not users_publisher_stop:
        try:
            # Ensure MQTT client is connected before attempting to publish
            if not client or not client.is_connected():
                log_simple("MQTT client not connected, skipping users data publish", "WARNING")
                time.sleep(3)  # Still wait for the interval
                continue

            # Get safe users data (without passwords)
            with users_lock:
                safe_users = []
                for user in users:
                    safe_user = user.copy()
                    if 'password_hash' in safe_user:
                        del safe_user['password_hash']
                    safe_users.append(safe_user)

            # Create periodic publish payload
            payload = {
                "command": "periodic_update",
                "success": True,
                "data": safe_users,
                "user_count": len(safe_users),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

            # Publish to response topic
            client.publish(topic_response, json.dumps(payload), qos=1, retain=False)
            # Reduced logging to avoid spam - only log once every 10 publishes
            # log_simple(f"Published users data ({len(safe_users)} users)", "INFO")

        except Exception as e:
            send_error_log(client, "publish_users_data_loop", f"Error in users data publisher loop: {e}", "critical")
            log_simple(f"Error in users data publisher loop: {e}", "ERROR")
            time.sleep(5)  # Wait longer on error
            continue

        # Publish every 3 seconds
        time.sleep(3)

    log_simple("Users data publisher thread stopped", "INFO")

def start_users_publisher():
    """Start the users data publisher thread"""
    global users_publisher_thread, users_publisher_stop

    users_publisher_stop = False
    users_publisher_thread = threading.Thread(
        target=publish_users_data,
        daemon=True,
        name="UsersPublisher"
    )
    users_publisher_thread.start()
    log_simple("Users data publisher thread started", "SUCCESS")

def stop_users_publisher():
    """Stop the users data publisher thread"""
    global users_publisher_stop, users_publisher_thread

    users_publisher_stop = True
    if users_publisher_thread and users_publisher_thread.is_alive():
        users_publisher_thread.join(timeout=5)
        if users_publisher_thread.is_alive():
            log_simple("Users publisher thread did not stop gracefully", "WARNING")
        else:
            log_simple("Users publisher thread stopped", "INFO")

# --- Main Application ---
def run():
    """Main execution function for the User Management service."""
    global client

    print_startup_banner()

    # Load configurations
    log_simple("Loading user management configurations...")
    mqtt_config = load_mqtt_config()
    load_users_config()

    broker = mqtt_config.get('broker_address', 'localhost')
    port = int(mqtt_config.get('broker_port', 1883))
    username = mqtt_config.get('username', '')
    password = mqtt_config.get('password', '')

    # Connect to MQTT broker
    log_simple("Connecting to MQTT broker...")
    client = connect_mqtt(
        f'user-management-service-{uuid.uuid4()}',
        broker, port, username, password,
        on_connect, on_disconnect, on_message_user_management
    )

    # Start client loop
    if client:
        client.loop_start()

    # Wait for connection
    time.sleep(2)

    print_success_banner()
    print_broker_status(broker_connected)

    log_simple(f"User Management Service started with {len(users)} users", "SUCCESS")

    try:
        while True:
            time.sleep(1)  # Keep the service running
    except KeyboardInterrupt:
        log_simple("Service stopped by user", "WARNING")
    except Exception as e:
        log_simple(f"Critical error: {e}", "ERROR")
        send_error_log("run", f"Critical service error: {e}", ERROR_TYPE_CRITICAL)
    finally:
        log_simple("Shutting down User Management Service...")
        # Stop the users publisher thread first
        stop_users_publisher()

        if client:
            client.loop_stop()
            client.disconnect()
        log_simple("User Management Service terminated", "SUCCESS")

if __name__ == '__main__':
    run()

# --- Exception for missing MQTT client ---
class MQTTClientNotSetError(Exception):
    pass
