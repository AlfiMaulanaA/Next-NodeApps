import os
import json
import zipfile
import shutil
import time
import base64
import threading
import paho.mqtt.client as mqtt
from datetime import datetime
import uuid
import hashlib
from pathlib import Path

# Simple logging functions
def log_simple(message, level="INFO"):
    """Simple logging without timestamp for cleaner output"""
    if level == "ERROR":
        print(f"[ERROR] {message}")
    elif level == "SUCCESS":
        print(f"[SUCCESS] {message}")
    elif level == "WARNING":
        print(f"[WARNING] {message}")
    else:
        print(f"[INFO] {message}")

def send_error_log_dummy(*args, **kwargs):
    """Dummy function to replace error logging"""
    pass

# Configuration
UI_ROOT_PATH = "/var/www/html"
BACKUP_BASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backup")
VERSION_CONFIG_PATH = os.path.join(BACKUP_BASE_PATH, "ui_versions.json")
UI_UPDATE_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui_update_config.json")

MQTT_BROKER = "localhost"
MQTT_PORT = 1883

# MQTT Topics
TOPIC_UI_UPDATE_COMMAND = "command/ui-update"
TOPIC_UI_UPDATE_RESPONSE = "response/ui-update"
TOPIC_UI_UPDATE_STATUS = "status/ui-update/progress"
TOPIC_UI_VERSION_INFO = "status/ui-version"
TOPIC_UI_UPDATE_ALERT = "alert/ui-update"

# Default Configuration
DEFAULT_UI_CONFIG = {
    "max_file_size": 100 * 1024 * 1024,  # 100MB
    "allowed_extensions": [".zip"],
    "backup_settings": {
        "max_backups": 10,
        "auto_cleanup": True
    },
    "security": {
        "validate_zip_content": True,
        "required_files": ["index.html"],  # Must contain main index
        "max_extract_time": 300  # 5 minutes timeout
    }
}

class UiUpdater:
    def __init__(self):
        self.mqtt_client = None
        self.is_initializing = True
        self.current_version = None
        self.service_id = f"ui-updater-{uuid.uuid4().hex[:8]}"

        # Ensure backup directory exists
        os.makedirs(BACKUP_BASE_PATH, exist_ok=True)

        # Load or create configuration
        self.config = self.load_config()

        # Initialize MQTT
        self.setup_mqtt()

        # Initialize version tracking
        self.load_version_info()

        self.is_initializing = False
        print(f"[INIT] UI Updater Service Started - {self.service_id}")
        print(f"[INIT] UI Root Path: {UI_ROOT_PATH}")
        print(f"[INIT] Backup Path: {BACKUP_BASE_PATH}")

    def load_config(self):
        """Load UI updater configuration"""
        try:
            if os.path.exists(UI_UPDATE_CONFIG_PATH):
                with open(UI_UPDATE_CONFIG_PATH, 'r') as f:
                    config = json.load(f)
                print(f"[CONFIG] Configuration loaded from {UI_UPDATE_CONFIG_PATH}")
                return config
            else:
                # Create default config
                with open(UI_UPDATE_CONFIG_PATH, 'w') as f:
                    json.dump(DEFAULT_UI_CONFIG, f, indent=4)
                print(f"[CONFIG] Default configuration created at {UI_UPDATE_CONFIG_PATH}")
                return DEFAULT_UI_CONFIG
        except Exception as e:
            print(f"[CONFIG] Error loading config: {e}. Using defaults.")
            send_error_log("UiUpdater", f"Configuration load error: {e}", ERROR_TYPE_WARNING)
            return DEFAULT_UI_CONFIG

    def load_version_info(self):
        """Load current version information"""
        try:
            if os.path.exists(VERSION_CONFIG_PATH):
                with open(VERSION_CONFIG_PATH, 'r') as f:
                    version_data = json.load(f)
                self.current_version = version_data.get("current_version", "unknown")
                print(f"[VERSION] Current UI version: {self.current_version}")
            else:
                # Initialize version tracking
                version_data = {
                    "current_version": "initial_install",
                    "install_date": datetime.now().isoformat(),
                    "backup_versions": [],
                    "last_update": None
                }
                self.save_version_info(version_data)
                self.current_version = "initial_install"
                print("[VERSION] Version tracking initialized")
        except Exception as e:
            print(f"[VERSION] Error loading version info: {e}")
            send_error_log("UiUpdater", f"Version info load error: {e}", ERROR_TYPE_WARNING)

    def save_version_info(self, version_data):
        """Save version information"""
        try:
            with open(VERSION_CONFIG_PATH, 'w') as f:
                json.dump(version_data, f, indent=4)
        except Exception as e:
            print(f"[VERSION] Error saving version info: {e}")
            send_error_log("UiUpdater", f"Version info save error: {e}", ERROR_TYPE_MAJOR)

    def setup_mqtt(self):
        """Initialize MQTT client and connection"""
        try:
            self.mqtt_client = mqtt.Client(
                client_id=self.service_id,
                protocol=mqtt.MQTTv311,
                clean_session=True
            )

            # Setup callbacks
            self.mqtt_client.on_connect = self.on_mqtt_connect
            self.mqtt_client.on_disconnect = self.on_mqtt_disconnect
            self.mqtt_client.on_message = self.on_mqtt_message

            # Connect to broker
            print(f"[MQTT] Connecting to broker {MQTT_BROKER}:{MQTT_PORT}")
            self.mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            self.mqtt_client.loop_start()

        except Exception as e:
            print(f"[MQTT] Failed to setup MQTT client: {e}")
            send_error_log("UiUpdater", f"MQTT setup error: {e}", ERROR_TYPE_CRITICAL)

    def on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT connect callback"""
        if rc == 0:
            print("[MQTT] Connected to broker successfully ✅")

            # Subscribe to all UI update topics
            topics = [
                TOPIC_UI_UPDATE_COMMAND,
                "command/ui-rollback",  # Rollback commands
                "command/ui-status"     # Status requests
            ]

            for topic in topics:
                try:
                    client.subscribe(topic)
                    print(f"[MQTT] Subscribed to: {topic}")
                except Exception as e:
                    print(f"[MQTT] Failed to subscribe to {topic}: {e}")

            # Publish service online status
            self.publish_status("online", {"service_id": self.service_id, "version": self.current_version})

        else:
            print(f"[MQTT] Connection failed with code {rc} ❌")

    def on_mqtt_disconnect(self, client, userdata, rc):
        """MQTT disconnect callback"""
        print(f"[MQTT] Disconnected from broker with code {rc}")
        if not self.is_initializing:  # Skip logging during startup
            send_error_log("UiUpdater", f"MQTT disconnection: {rc}", ERROR_TYPE_WARNING)

    def on_mqtt_message(self, client, userdata, message):
        """Main message handler for UI update commands"""
        try:
            print(f"[MQTT] Received on {message.topic}: {len(message.payload)} bytes")

            # Parse payload
            payload = json.loads(message.payload.decode())

            # Route commands
            command = payload.get("command", "").lower()

            if command == "upload":
                self.handle_upload(payload, message.topic)
            elif command == "rollback":
                self.handle_rollback(payload)
            elif command == "get_status":
                self.handle_get_status()
            elif command == "get_history":
                self.handle_get_history()
            else:
                print(f"[CMD] Unknown command: {command}")
                self.send_response(message.topic, {
                    "status": "error",
                    "message": f"Unknown command: {command}",
                    "available_commands": ["upload", "rollback", "get_status", "get_history"]
                })

        except json.JSONDecodeError as e:
            print(f"[MQTT] JSON parse error: {e}")
            self.send_response(message.topic, {
                "status": "error",
                "message": "Invalid JSON payload",
                "error": str(e)
            })
        except Exception as e:
            print(f"[MQTT] Message handling error: {e}")
            send_error_log("UiUpdater", f"Message handling error: {e}", ERROR_TYPE_MAJOR)
            self.send_response(message.topic, {
                "status": "error",
                "message": "Internal server error"
            })

    def handle_get_status(self):
        """Handle status request"""
        status = {
            "current_version": self.current_version,
            "ui_root_path": UI_ROOT_PATH,
            "backup_count": len([d for d in os.listdir(BACKUP_BASE_PATH) if d.startswith("backup_")]) if os.path.exists(BACKUP_BASE_PATH) else 0,
            "config_valid": self.validate_ui_directory(),
            "last_update": self.get_last_update_time(),
            "service_uptime": self.get_service_uptime()
        }
        self.send_response("response/ui-status", status)

    def handle_get_history(self):
        """Handle backup history request"""
        try:
            if os.path.exists(VERSION_CONFIG_PATH):
                with open(VERSION_CONFIG_PATH, 'r') as f:
                    version_data = json.load(f)
                backup_history = version_data.get("backup_versions", [])

                # Add size info for each backup
                for backup in backup_history:
                    backup_dir = os.path.join(BACKUP_BASE_PATH, backup["id"], "ui")
                    if os.path.exists(backup_dir):
                        backup["size_mb"] = self.get_directory_size_mb(backup_dir)
                    else:
                        backup["size_mb"] = "unknown"

                self.send_response("response/ui-history", {
                    "status": "success",
                    "backup_versions": backup_history
                })
            else:
                self.send_response("response/ui-history", {
                    "status": "error",
                    "message": "No history available",
                    "backup_versions": []
                })
        except Exception as e:
            self.send_response("response/ui-history", {
                "status": "error",
                "message": str(e)
            })

    def publish_status(self, status_type, data):
        """Publish status update via MQTT"""
        try:
            payload = {
                "type": status_type,
                "timestamp": datetime.now().isoformat(),
                "service": self.service_id,
                **data
            }
            self.mqtt_client.publish(TOPIC_UI_UPDATE_STATUS, json.dumps(payload))
        except Exception as e:
            print(f"[STATUS] Failed to publish status: {e}")

    def send_response(self, topic, response_data):
        """Send response on specified topic"""
        try:
            self.mqtt_client.publish(topic, json.dumps(response_data))
        except Exception as e:
            print(f"[RESPONSE] Failed to send response to {topic}: {e}")

    def validate_zip_file(self, content, filename):
        """Validate uploaded zip file"""
        try:
            # Check file extension
            if not any(filename.endswith(ext) for ext in self.config["allowed_extensions"]):
                return False, "Invalid file extension. Only .zip files allowed."

            # Check file size
            if len(content) > self.config["max_file_size"]:
                return False, f"File too large. Maximum size: {self.config['max_file_size'] // (1024*1024)}MB"

            # Decode base64 and validate zip
            try:
                zip_data = base64.b64decode(content)
            except Exception as e:
                return False, f"Invalid base64 content: {e}"

            # Try to open as zip file
            import io
            with zipfile.ZipFile(io.BytesIO(zip_data)) as zip_ref:
                # Check for required files
                if self.config["security"]["validate_zip_content"]:
                    file_list = zip_ref.namelist()
                    required_files = self.config["security"]["required_files"]

                    for required in required_files:
                        if not any(required in f for f in file_list):
                            return False, f"Required file '{required}' not found in zip"

                # Check for potentially dangerous files
                dangerous_exts = ['.exe', '.bat', '.sh', '.cmd', '.pif', '.scr', '.vbs', '.js']
                for filename in file_list:
                    if any(filename.endswith(ext) for ext in dangerous_exts):
                        return False, f"Potentially dangerous file found: {filename}"

                return True, "Validation passed"

        except Exception as e:
            return False, f"Zip validation error: {e}"

    def create_backup(self):
        """Create backup of current UI"""
        version_id = f"backup_{int(time.time())}"
        timestamp = datetime.now().isoformat()

        try:
            backup_dir = os.path.join(BACKUP_BASE_PATH, version_id)
            os.makedirs(backup_dir, exist_ok=True)

            ui_backup_path = os.path.join(backup_dir, "ui")

            # Copy current UI to backup
            if os.path.exists(UI_ROOT_PATH):
                shutil.copytree(UI_ROOT_PATH, ui_backup_path)
                print(f"[BACKUP] Created backup: {version_id}")
            else:
                # Create empty backup structure
                os.makedirs(ui_backup_path, exist_ok=True)
                print(f"[BACKUP] Created empty backup: {version_id}")

            # Update version info
            if os.path.exists(VERSION_CONFIG_PATH):
                with open(VERSION_CONFIG_PATH, 'r') as f:
                    version_data = json.load(f)
            else:
                version_data = {"backup_versions": []}

            backup_info = {
                "id": version_id,
                "timestamp": timestamp,
                "triggered_by": "automatic_backup",
                "description": f"Backup before update {self.current_version}",
                "status": "completed"
            }

            version_data["backup_versions"].append(backup_info)

            # Keep only max_backups
            if len(version_data["backup_versions"]) > self.config["backup_settings"]["max_backups"]:
                to_remove = version_data["backup_versions"][:-self.config["backup_settings"]["max_backups"]]
                for old_backup in to_remove:
                    old_path = os.path.join(BACKUP_BASE_PATH, old_backup["id"])
                    if os.path.exists(old_path):
                        shutil.rmtree(old_path)
                        print(f"[BACKUP] Removed old backup: {old_backup['id']}")
                version_data["backup_versions"] = version_data["backup_versions"][-self.config["backup_settings"]["max_backups"]:]

            self.save_version_info(version_data)
            return version_id

        except Exception as e:
            print(f"[BACKUP] Backup failed: {e}")
            send_error_log("UiUpdater", f"Backup creation failed: {e}", ERROR_TYPE_MAJOR)
            raise

    def extract_zip(self, content, version_id):
        """Extract zip content to UI directory"""
        import io
        import tempfile

        extract_timeout = self.config["security"]["max_extract_time"]
        zip_data = base64.b64decode(content)

        # Create temp directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            with zipfile.ZipFile(io.BytesIO(zip_data)) as zip_ref:
                # Extract all files
                zip_ref.extractall(temp_dir)

                # Validate extracted content
                extracted_files = []
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        extracted_files.append(os.path.relpath(file_path, temp_dir))

                print(f"[EXTRACT] Extracted {len(extracted_files)} files")

                # Check for index.html
                has_index = any("index.html" in f for f in extracted_files)
                if not has_index:
                    raise Exception("No index.html found in extracted files")

                # Remove old UI (but keep backup)
                if os.path.exists(UI_ROOT_PATH):
                    shutil.rmtree(UI_ROOT_PATH)

                # Move extracted files to UI root
                shutil.move(temp_dir, UI_ROOT_PATH)
                print(f"[EXTRACT] UI updated to {UI_ROOT_PATH}")

    def rollback(self, version_id):
        """Rollback to specified version"""
        try:
            backup_dir = os.path.join(BACKUP_BASE_PATH, version_id, "ui")

            if not os.path.exists(backup_dir):
                raise Exception(f"Backup version {version_id} not found")

            print(f"[ROLLBACK] Rolling back to {version_id}")

            # Remove current UI
            if os.path.exists(UI_ROOT_PATH):
                shutil.rmtree(UI_ROOT_PATH)

            # Restore from backup
            shutil.copytree(backup_dir, UI_ROOT_PATH)

            # Update current version
            self.current_version = version_id

            # Update version config
            version_data = {
                "current_version": version_id,
                "last_update": datetime.now().isoformat(),
                "rollback_from": self.get_last_update_time()
            }
            self.save_version_info(version_data)

            print(f"[ROLLBACK] Successfully rolled back to {version_id}")
            return True

        except Exception as e:
            print(f"[ROLLBACK] Rollback failed: {e}")
            send_error_log("UiUpdater", f"Rollback failed: {e}", ERROR_TYPE_CRITICAL)
            return False

    def handle_upload(self, payload, original_topic):
        """Handle UI upload request"""
        try:
            content = payload.get("content")
            filename = payload.get("filename")

            if not content or not filename:
                self.send_response(TOPIC_UI_UPDATE_RESPONSE, {
                    "status": "error",
                    "message": "Missing content or filename"
                })
                return

            # Publish progress: Validating
            self.publish_status("validating", {
                "filename": filename,
                "progress": 10
            })

            # Validate file
            is_valid, validation_message = self.validate_zip_file(content, filename)
            if not is_valid:
                self.send_response(TOPIC_UI_UPDATE_RESPONSE, {
                    "status": "error",
                    "message": validation_message
                })
                return

            # Publish progress: Creating backup
            self.publish_status("backup", {"progress": 20})

            # Create backup
            version_id = self.create_backup()

            # Publish progress: Extracting
            self.publish_status("extracting", {"progress": 50})

            # Extract and replace UI
            self.extract_zip(content, version_id)

            # Update version info
            version_data = {
                "current_version": version_id,
                "last_update": datetime.now().isoformat(),
                "filename": filename,
                "file_hash": hashlib.md5(content.encode()).hexdigest()[:16],
                "update_type": "upload"
            }
            self.save_version_info(version_data)

            # Update current version
            self.current_version = version_id

            # Publish success
            self.publish_status("completed", {"progress": 100})
            self.send_response(TOPIC_UI_UPDATE_RESPONSE, {
                "status": "success",
                "message": "UI updated successfully",
                "version": version_id,
                "has_backup": True
            })

            print(f"[UPLOAD] UI successfully updated to version {version_id}")

        except Exception as e:
            error_msg = f"Upload failed: {str(e)}"
            print(f"[UPLOAD] {error_msg}")

            # Attempt rollback on failure
            if 'version_id' in locals():
                try:
                    self.rollback(version_id)
                    error_msg += " (automatically rolled back to previous version)"
                except:
                    error_msg += " (rollback failed, manual intervention required)"

            self.send_response(TOPIC_UI_UPDATE_RESPONSE, {
                "status": "error",
                "message": error_msg
            })

            send_error_log("UiUpdater", error_msg, ERROR_TYPE_CRITICAL)

    def handle_rollback(self, payload):
        """Handle rollback request"""
        try:
            version_id = payload.get("version_id")
            if not version_id:
                self.send_response(TOPIC_UI_UPDATE_RESPONSE, {
                    "status": "error",
                    "message": "version_id required for rollback"
                })
                return

            # Publish rollback status
            self.publish_status("rollback", {"version_id": version_id})

            # Perform rollback
            if self.rollback(version_id):
                self.send_response(TOPIC_UI_UPDATE_RESPONSE, {
                    "status": "success",
                    "message": f"Successfully rolled back to version {version_id}",
                    "rolled_back_to": version_id
                })
            else:
                self.send_response(TOPIC_UI_UPDATE_RESPONSE, {
                    "status": "error",
                    "message": f"Failed to rollback to version {version_id}"
                })

        except Exception as e:
            self.send_response(TOPIC_UI_UPDATE_RESPONSE, {
                "status": "error",
                "message": f"Rollback error: {str(e)}"
            })
            send_error_log("UiUpdater", f"Rollback error: {e}", ERROR_TYPE_CRITICAL)

    def validate_ui_directory(self):
        """Validate current UI directory structure"""
        try:
            if not os.path.exists(UI_ROOT_PATH):
                return False

            index_path = os.path.join(UI_ROOT_PATH, "index.html")
            return os.path.exists(index_path)
        except:
            return False

    def get_last_update_time(self):
        """Get last update timestamp"""
        try:
            if os.path.exists(VERSION_CONFIG_PATH):
                with open(VERSION_CONFIG_PATH, 'r') as f:
                    data = json.load(f)
                return data.get("last_update")
        except:
            pass
        return None

    def get_service_uptime(self):
        """Get service uptime in seconds"""
        return time.time() - time.mktime(time.strptime(datetime.now().strftime('%Y-%m-%d %H:%M:%S'), '%Y-%m-%d %H:%M:%S'))

    def get_directory_size_mb(self, path):
        """Get directory size in MB"""
        try:
            total_size = 0
            for dirpath, dirnames, filenames in os.walk(path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    total_size += os.path.getsize(filepath)
            return round(total_size / (1024 * 1024), 2)
        except:
            return "unknown"

# Main execution
def main():
    """Main service entry point"""
    print("="*50)
    print("UI Updater Service Starting...")
    print("="*50)

    ui_updater = UiUpdater()

    # Keep service running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] UI Updater Service stopping...")
        if ui_updater.mqtt_client:
            ui_updater.mqtt_client.loop_stop()
            ui_updater.mqtt_client.disconnect()
        print("[SHUTDOWN] Service stopped ✅")

if __name__ == "__main__":
    main()
