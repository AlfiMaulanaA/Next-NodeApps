import json
import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import re
import paho.mqtt.client as mqtt
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

class BrokerTemplateManager:
    """Manages MQTT broker templates for static payload system"""

    def __init__(self, templates_file: str = "./JSON/brokerTemplates.json", mqtt_broker: str = "18.143.215.113", mqtt_port: int = 1883):
        self.templates_file = templates_file
        self.templates: Dict[str, Any] = {}
        self.logger = logging.getLogger("BrokerTemplateManager")

        # MQTT Configuration
        self.mqtt_broker = mqtt_broker
        self.mqtt_port = mqtt_port
        self.mqtt_client = None
        self.mqtt_topics = {
            'create': 'broker-templates/create',
            'update': 'broker-templates/update',
            'delete': 'broker-templates/delete',
            'response': 'broker-templates/response',
            'error': 'broker-templates/error'
        }

        self.load_templates()
        self._setup_mqtt()

    def _setup_mqtt(self) -> None:
        """Setup MQTT client for broker templates"""
        try:
            self.mqtt_client = mqtt.Client(client_id=f"broker-template-manager-{os.getpid()}", clean_session=True)
            self.mqtt_client.on_connect = self._on_mqtt_connect
            self.mqtt_client.on_message = self._on_mqtt_message
            self.mqtt_client.on_disconnect = self._on_mqtt_disconnect

            # Connect to MQTT broker
            self.mqtt_client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.mqtt_client.loop_start()

            self.logger.info(f"MQTT client initialized for broker templates (broker: {self.mqtt_broker}:{self.mqtt_port})")
        except Exception as e:
            self.logger.error(f"Failed to setup MQTT client: {e}")
            send_error_log("_setup_mqtt", f"Failed to initialize MQTT client for broker templates: {e}", ERROR_TYPE_CRITICAL, {"broker": self.mqtt_broker, "port": self.mqtt_port})
            self.mqtt_client = None

    def _on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT connect callback"""
        if rc == 0:
            self.logger.info("Connected to MQTT broker")
            # Subscribe to command topics
            command_topics = [
                self.mqtt_topics['create'],
                self.mqtt_topics['update'],
                self.mqtt_topics['delete'],
                'broker-templates/requests'  # Add requests topic for get_all operations
            ]
            for topic in command_topics:
                client.subscribe(topic, qos=1)
                self.logger.info(f"Subscribed to MQTT topic: {topic}")
        else:
            self.logger.error(f"Failed to connect to MQTT broker, return code: {rc}")

    def _on_mqtt_disconnect(self, client, userdata, rc):
        """MQTT disconnect callback"""
        self.logger.warning(f"Disconnected from MQTT broker, return code: {rc}")

    def _on_mqtt_message(self, client, userdata, msg):
        """Handle incoming MQTT messages"""
        try:
            payload = json.loads(msg.payload.decode('utf-8'))
            self.logger.info(f"Received MQTT message on topic {msg.topic}: {payload}")

            topic_parts = msg.topic.split('/')
            action = topic_parts[-1] if len(topic_parts) > 0 else None

            if action == 'create':
                self._handle_mqtt_create(payload)
            elif action == 'update':
                self._handle_mqtt_update(payload)
            elif action == 'delete':
                self._handle_mqtt_delete(payload)
            elif action == 'requests' and payload.get('action') == 'get_all':
                self._handle_mqtt_get_all(payload)

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse MQTT message: {e}")
            send_error_log("_on_mqtt_message", f"Failed to parse MQTT message JSON: {e}", ERROR_TYPE_WARNING, {"topic": msg.topic})
            self._publish_mqtt_error("Invalid JSON payload", "parse_error")
        except Exception as e:
            self.logger.error(f"Error processing MQTT message: {e}")
            send_error_log("_on_mqtt_message", f"Error processing MQTT message: {e}", ERROR_TYPE_MAJOR, {"topic": msg.topic})
            self._publish_mqtt_error(str(e), "processing_error")

    def _handle_mqtt_create(self, payload: Dict[str, Any]) -> None:
        """Handle MQTT create template command"""
        try:
            template_data = payload.get('template')
            if not template_data:
                self._publish_mqtt_error("Missing template data", "create")
                return

            success = self.create_template(template_data)
            if success:
                template_id = template_data.get('template_id')
                response = {
                    'action': 'created',
                    'template_id': template_id,
                    'template': self.get_template(template_id),
                    'timestamp': datetime.now().isoformat()
                }
                self._publish_mqtt_response(response)
                self.logger.info(f"Template created via MQTT: {template_id}")
            else:
                self._publish_mqtt_error("Failed to create template", "create")

        except Exception as e:
            self.logger.error(f"Error in MQTT create handler: {e}")
            send_error_log("_handle_mqtt_create", f"Error handling MQTT create template command: {e}", ERROR_TYPE_MAJOR, {"payload": str(payload)})
            self._publish_mqtt_error(str(e), "create")

    def _handle_mqtt_update(self, payload: Dict[str, Any]) -> None:
        """Handle MQTT update template command"""
        try:
            template_id = payload.get('template_id')
            template_data = payload.get('template')

            if not template_id or not template_data:
                self._publish_mqtt_error("Missing template_id or template data", "update")
                return

            success = self.update_template(template_id, template_data)
            if success:
                response = {
                    'action': 'updated',
                    'template_id': template_id,
                    'template': self.get_template(template_id),
                    'timestamp': datetime.now().isoformat()
                }
                self._publish_mqtt_response(response)
                self.logger.info(f"Template updated via MQTT: {template_id}")
            else:
                self._publish_mqtt_error(f"Failed to update template {template_id}", "update")

        except Exception as e:
            self.logger.error(f"Error in MQTT update handler: {e}")
            send_error_log("_handle_mqtt_update", f"Error handling MQTT update template command: {e}", ERROR_TYPE_MAJOR, {"template_id": template_id})
            self._publish_mqtt_error(str(e), "update")

    def _handle_mqtt_delete(self, payload: Dict[str, Any]) -> None:
        """Handle MQTT delete template command"""
        try:
            template_id = payload.get('template_id')
            if not template_id:
                self._publish_mqtt_error("Missing template_id", "delete")
                return

            # Store template data before deletion for response
            template_before_delete = self.get_template(template_id)

            success = self.delete_template(template_id)
            if success:
                response = {
                    'action': 'deleted',
                    'template_id': template_id,
                    'deleted_template': template_before_delete,
                    'timestamp': datetime.now().isoformat()
                }
                self._publish_mqtt_response(response)
                self.logger.info(f"Template deleted via MQTT: {template_id}")
            else:
                self._publish_mqtt_error(f"Failed to delete template {template_id}", "delete")

        except Exception as e:
            self.logger.error(f"Error in MQTT delete handler: {e}")
            send_error_log("_handle_mqtt_delete", f"Error handling MQTT delete template command: {e}", ERROR_TYPE_MAJOR, {"template_id": template_id})
            self._publish_mqtt_error(str(e), "delete")

    def _handle_mqtt_get_all(self, payload: Dict[str, Any]) -> None:
        """Handle MQTT get_all templates request"""
        try:
            request_id = payload.get('request_id', 'unknown')
            self.logger.info(f"Handling get_all request: {request_id}")

            # Get all templates
            templates = self.get_all_templates()

            # Publish response with templates data
            response = {
                'action': 'get_all_response',
                'request_id': request_id,
                'templates': templates,
                'total_count': len(templates),
                'timestamp': datetime.now().isoformat()
            }

            # Publish to response topic
            if self.mqtt_client:
                self.mqtt_client.publish('broker-templates/response', json.dumps(response), qos=1, retain=False)
                self.logger.info(f"Published get_all response with {len(templates)} templates")

        except Exception as e:
            self.logger.error(f"Error in MQTT get_all handler: {e}")
            send_error_log("_handle_mqtt_get_all", f"Error handling MQTT get_all templates request: {e}", ERROR_TYPE_MAJOR, {"request_id": request_id})
            self._publish_mqtt_error(str(e), "get_all")

    def _publish_mqtt_response(self, response: Dict[str, Any]) -> None:
        """Publish response to MQTT"""
        if self.mqtt_client:
            try:
                self.mqtt_client.publish(self.mqtt_topics['response'], json.dumps(response), qos=1, retain=False)
                self.logger.debug(f"Published MQTT response: {response}")
            except Exception as e:
                self.logger.error(f"Failed to publish MQTT response: {e}")
                send_error_log("_publish_mqtt_response", f"Failed to publish MQTT response: {e}", ERROR_TYPE_WARNING, {"topic": self.mqtt_topics['response']})

    def _publish_mqtt_error(self, error_message: str, operation: str) -> None:
        """Publish error to MQTT"""
        if self.mqtt_client:
            try:
                error_payload = {
                    'action': 'error',
                    'operation': operation,
                    'error': error_message,
                    'timestamp': datetime.now().isoformat()
                }
                self.mqtt_client.publish(self.mqtt_topics['error'], json.dumps(error_payload), qos=1, retain=False)
                self.logger.error(f"Published MQTT error for {operation}: {error_message}")
            except Exception as e:
                self.logger.error(f"Failed to publish MQTT error: {e}")
                send_error_log("_publish_mqtt_error", f"Failed to publish MQTT error message: {e}", ERROR_TYPE_WARNING, {"operation": operation, "error_message": error_message})

    def publish_template_event(self, action: str, template_id: str, template_data: Dict[str, Any] = None) -> None:
        """Publish template event to MQTT (used by API endpoints)"""
        if self.mqtt_client:
            try:
                payload = {
                    'action': action,
                    'template_id': template_id,
                    'timestamp': datetime.now().isoformat()
                }

                if template_data:
                    payload['template'] = template_data

                topic = self.mqtt_topics.get(action)
                if topic:
                    self.mqtt_client.publish(topic, json.dumps(payload), qos=1, retain=False)
                    self.logger.info(f"Published template {action} event for {template_id}")
                else:
                    self.logger.error(f"Unknown action for MQTT publish: {action}")
                    send_error_log("publish_template_event", f"Unknown action for MQTT publish: {action}", ERROR_TYPE_WARNING, {"template_id": template_id})
            except Exception as e:
                self.logger.error(f"Failed to publish template event: {e}")
                send_error_log("publish_template_event", f"Failed to publish template event: {e}", ERROR_TYPE_WARNING, {"template_id": template_id, "action": action})

    def load_templates(self) -> None:
        """Load broker templates from JSON file"""
        try:
            if os.path.exists(self.templates_file):
                with open(self.templates_file, 'r') as f:
                    data = json.load(f)
                    self.templates = {template['template_id']: template for template in data.get('templates', [])}
                    self.logger.info(f"Loaded {len(self.templates)} broker templates")
            else:
                self.logger.warning(f"Templates file not found: {self.templates_file}")
                self.templates = {}
        except json.JSONDecodeError as e:
            self.logger.error(f"Error loading templates: {e}")
            send_error_log("load_templates", f"Failed to decode JSON from templates file: {e}", ERROR_TYPE_MAJOR, {"file": self.templates_file})
            self.templates = {}
        except Exception as e:
            self.logger.error(f"Error loading templates: {e}")
            send_error_log("load_templates", f"Error loading templates from file: {e}", ERROR_TYPE_MAJOR, {"file": self.templates_file})
            self.templates = {}

    def save_templates(self) -> bool:
        """Save broker templates to JSON file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.templates_file), exist_ok=True)

            # Convert templates dict back to list format
            templates_list = list(self.templates.values())

            with open(self.templates_file, 'w') as f:
                json.dump({
                    "templates": templates_list,
                    "metadata": {
                        "last_updated": datetime.now().isoformat(),
                        "total_templates": len(templates_list)
                    }
                }, f, indent=2)

            self.logger.info(f"Saved {len(templates_list)} broker templates")
            return True
        except IOError as e:
            self.logger.error(f"Error saving templates: {e}")
            send_error_log("save_templates", f"IO error while saving templates file: {e}", ERROR_TYPE_MAJOR, {"file": self.templates_file})
            return False
        except Exception as e:
            self.logger.error(f"Error saving templates: {e}")
            send_error_log("save_templates", f"Error saving templates to file: {e}", ERROR_TYPE_MAJOR, {"file": self.templates_file})
            return False

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific template by ID"""
        return self.templates.get(template_id)

    def get_all_templates(self) -> List[Dict[str, Any]]:
        """Get all available templates"""
        return list(self.templates.values())

    def get_templates_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get templates by category"""
        return [template for template in self.templates.values() if template.get('category') == category]

    def create_template(self, template_data: Dict[str, Any]) -> bool:
        """Create a new broker template"""
        try:
            template_id = template_data.get('template_id')
            if not template_id:
                self.logger.error("Template ID is required")
                send_error_log("create_template", "Template ID is required but not provided", ERROR_TYPE_WARNING)
                return False

            if template_id in self.templates:
                self.logger.error(f"Template {template_id} already exists")
                send_error_log("create_template", f"Template already exists with ID: {template_id}", ERROR_TYPE_WARNING, {"template_id": template_id})
                return False

            # Add metadata
            template_data['metadata'] = template_data.get('metadata', {})
            template_data['metadata']['created_at'] = datetime.now().isoformat()
            template_data['metadata']['version'] = "1.0"

            # Validate template structure
            if not self._validate_template(template_data):
                return False

            self.templates[template_id] = template_data
            self.save_templates()
            self.logger.info(f"Created new template: {template_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error creating template: {e}")
            send_error_log("create_template", f"Error creating template: {e}", ERROR_TYPE_MAJOR, {"template_id": template_data.get('template_id', 'unknown')})
            return False

    def update_template(self, template_id: str, template_data: Dict[str, Any]) -> bool:
        """Update an existing template"""
        try:
            if template_id not in self.templates:
                self.logger.error(f"Template {template_id} not found")
                send_error_log("update_template", f"Template not found for update: {template_id}", ERROR_TYPE_WARNING, {"template_id": template_id})
                return False

            # Preserve existing metadata
            existing_metadata = self.templates[template_id].get('metadata', {})

            # Update template
            self.templates[template_id].update(template_data)

            # Preserve existing metadata while allowing updates from template_data
            if 'metadata' in template_data:
                # Merge metadata: keep existing values, update with new ones
                merged_metadata = existing_metadata.copy()
                merged_metadata.update(template_data['metadata'])
                self.templates[template_id]['metadata'] = merged_metadata
            else:
                # No metadata in update, keep existing
                self.templates[template_id]['metadata'] = existing_metadata

            # Ensure metadata has required fields
            if 'version' not in self.templates[template_id]['metadata']:
                self.templates[template_id]['metadata']['version'] = '1.0'

            self.templates[template_id]['metadata']['updated_at'] = datetime.now().isoformat()

            # Increment version - very simple approach
            current_version = self.templates[template_id].get('metadata', {}).get('version', '1.0')
            if isinstance(current_version, str) and '.' in current_version:
                parts = current_version.split('.')
                if len(parts) >= 2:
                    major = parts[0]
                    minor = parts[1]
                    new_version = f"{major}.{int(minor) + 1}"
                    self.templates[template_id]['metadata']['version'] = new_version
                else:
                    # Single number with dot, e.g. "1."
                    major = parts[0]
                    new_version = f"{major}.1"
                    self.templates[template_id]['metadata']['version'] = new_version
            else:
                # No dot or not a string
                try:
                    num_version = int(float(current_version))
                    self.templates[template_id]['metadata']['version'] = str(num_version + 1)
                except (ValueError, TypeError):
                    self.templates[template_id]['metadata']['version'] = "1.1"

            self.save_templates()
            self.logger.info(f"Updated template: {template_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error updating template: {e}")
            send_error_log("update_template", f"Error updating template: {e}", ERROR_TYPE_MAJOR, {"template_id": template_id})
            return False

    def delete_template(self, template_id: str) -> bool:
        """Delete a template"""
        try:
            if template_id not in self.templates:
                self.logger.error(f"Template {template_id} not found")
                send_error_log("delete_template", f"Template not found for deletion: {template_id}", ERROR_TYPE_WARNING, {"template_id": template_id})
                return False

            del self.templates[template_id]
            self.save_templates()
            self.logger.info(f"Deleted template: {template_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error deleting template: {e}")
            send_error_log("delete_template", f"Error deleting template: {e}", ERROR_TYPE_MAJOR, {"template_id": template_id})
            return False

    def resolve_template_variables(self, template_config: Dict[str, Any], variables: Dict[str, str] = None) -> Dict[str, Any]:
        """Resolve template variables with provided values"""
        try:
            resolved_config = json.loads(json.dumps(template_config))  # Deep copy

            # Default variables
            default_vars = {
                "${CLOUD_USERNAME}": "default_cloud_user",
                "${CLOUD_PASSWORD}": "default_cloud_pass",
                "${EDGE_PASSWORD}": "default_edge_pass",
                "${BACKUP_USERNAME}": "default_backup_user",
                "${BACKUP_PASSWORD}": "default_backup_pass"
            }

            # Merge with provided variables
            if variables:
                default_vars.update(variables)

            # Resolve string values
            def resolve_value(value):
                if isinstance(value, str):
                    for var, replacement in default_vars.items():
                        value = value.replace(var, replacement)
                    return value
                elif isinstance(value, dict):
                    return {k: resolve_value(v) for k, v in value.items()}
                elif isinstance(value, list):
                    return [resolve_value(item) for item in value]
                else:
                    return value

            return resolve_value(resolved_config)
        except Exception as e:
            self.logger.error(f"Error resolving template variables: {e}")
            send_error_log("resolve_template_variables", f"Error resolving template variables: {e}", ERROR_TYPE_WARNING)
            return template_config

    def _validate_template(self, template: Dict[str, Any]) -> bool:
        """Validate template structure"""
        required_fields = ['template_id', 'name', 'config']

        for field in required_fields:
            if field not in template:
                self.logger.error(f"Missing required field: {field}")
                send_error_log("_validate_template", f"Missing required field in template: {field}", ERROR_TYPE_WARNING, {"template_id": template.get('template_id', 'unknown')})
                return False

        # Validate config structure
        config = template.get('config', {})
        required_config_fields = ['host', 'port', 'protocol']

        for field in required_config_fields:
            if field not in config:
                self.logger.error(f"Missing required config field: {field}")
                send_error_log("_validate_template", f"Missing required config field: {field}", ERROR_TYPE_WARNING, {"template_id": template.get('template_id', 'unknown')})
                return False

        # Validate port number
        try:
            port = int(config.get('port', 0))
            if port < 1 or port > 65535:
                self.logger.error(f"Invalid port number: {port}")
                send_error_log("_validate_template", f"Invalid port number in template config: {port}", ERROR_TYPE_WARNING, {"template_id": template.get('template_id', 'unknown')})
                return False
        except ValueError:
            self.logger.error(f"Port must be a number: {config.get('port')}")
            send_error_log("_validate_template", f"Port is not a valid number: {config.get('port')}", ERROR_TYPE_WARNING, {"template_id": template.get('template_id', 'unknown')})
            return False

        return True

    def get_template_stats(self) -> Dict[str, Any]:
        """Get template statistics"""
        categories = {}
        for template in self.templates.values():
            category = template.get('category', 'unknown')
            categories[category] = categories.get(category, 0) + 1

        return {
            "total_templates": len(self.templates),
            "categories": categories,
            "templates_by_category": {
                category: [t['name'] for t in self.templates.values() if t.get('category') == category]
                for category in categories.keys()
            }
        }

    def search_templates(self, query: str) -> List[Dict[str, Any]]:
        """Search templates by name or description"""
        query = query.lower()
        results = []

        for template in self.templates.values():
            if (query in template.get('name', '').lower() or
                query in template.get('description', '').lower() or
                query in template.get('template_id', '').lower()):
                results.append(template)

        return results

    def export_templates(self, export_file: str) -> bool:
        """Export templates to external file"""
        try:
            templates_list = list(self.templates.values())

            with open(export_file, 'w') as f:
                json.dump({
                    "exported_at": datetime.now().isoformat(),
                    "total_templates": len(templates_list),
                    "templates": templates_list
                }, f, indent=2)

            self.logger.info(f"Exported {len(templates_list)} templates to {export_file}")
            return True
        except IOError as e:
            self.logger.error(f"Error exporting templates: {e}")
            send_error_log("export_templates", f"IO error exporting templates to file: {e}", ERROR_TYPE_MAJOR, {"file": export_file})
            return False
        except Exception as e:
            self.logger.error(f"Error exporting templates: {e}")
            send_error_log("export_templates", f"Error exporting templates: {e}", ERROR_TYPE_MAJOR, {"file": export_file})
            return False

    def import_templates(self, import_file: str, merge: bool = True) -> bool:
        """Import templates from external file"""
        try:
            with open(import_file, 'r') as f:
                data = json.load(f)

            imported_templates = data.get('templates', [])
            imported_count = 0

            for template in imported_templates:
                template_id = template.get('template_id')
                if template_id:
                    if merge and template_id in self.templates:
                        # Update existing template
                        self.update_template(template_id, template)
                    else:
                        # Create new template
                        self.templates[template_id] = template
                    imported_count += 1

            if imported_count > 0:
                self.save_templates()
                self.logger.info(f"Imported {imported_count} templates from {import_file}")
                return True
            else:
                self.logger.warning(f"No valid templates found in {import_file}")
                send_error_log("import_templates", f"No valid templates found in import file: {import_file}", ERROR_TYPE_WARNING, {"file": import_file})
                return False
        except FileNotFoundError as e:
            self.logger.error(f"Error importing templates: {e}")
            send_error_log("import_templates", f"Import file not found: {import_file}", ERROR_TYPE_MAJOR, {"file": import_file})
            return False
        except json.JSONDecodeError as e:
            self.logger.error(f"Error importing templates: {e}")
            send_error_log("import_templates", f"Failed to decode JSON from import file: {e}", ERROR_TYPE_MAJOR, {"file": import_file})
            return False
        except Exception as e:
            self.logger.error(f"Error importing templates: {e}")
            send_error_log("import_templates", f"Error importing templates: {e}", ERROR_TYPE_MAJOR, {"file": import_file})
            return False