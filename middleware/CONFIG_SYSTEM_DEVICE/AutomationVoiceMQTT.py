import logging
import json
import time
import threading
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
import paho.mqtt.client as mqtt

from AutomationVoice import AutomationVoice
from VoiceCommandProcessor import VoiceCommandProcessor

# Configuration
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
CLIENT_ID = "automation_voice_mqtt_client"

# MQTT Topics
COMMAND_TOPICS = {
    'CREATE': "command/automation_voice/create",
    'READ': "command/automation_voice/read",
    'UPDATE': "command/automation_voice/update",
    'DELETE': "command/automation_voice/delete",
    'DISCOVER': "command/automation_voice/discover",
    'VOICE_INPUT': "voice/command/input",
    'VOICE_TEST': "voice/command/test",
}

RESPONSE_TOPICS = {
    'RESULT': "response/automation_voice/result",
    'VOICE_RESULT': "voice/command/result",
    'MODULAR': "modular",
    'DEVICE_AVAILABLE': "MODULAR_DEVICE/AVAILABLES",
}

# Setup clean logging
logger = logging.getLogger("AutomationVoiceMQTT")

# Reduce MQTT library logging verbosity
logging.getLogger("paho.mqtt.client").setLevel(logging.WARNING)

class AutomationVoiceMQTT:
    def __init__(self):
        self.client = None
        # Use the correct path for the config file
        config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "JSON", "automationVoiceConfig.json")
        self.automation_voice = AutomationVoice(config_file=config_file)
        self.voice_processor = None  # Will be initialized after MQTT client is created
        self.connected = False
        self.device_cache = []
        self.last_device_update = 0
        self.device_cache_timeout = 300  # 5 minutes
        self.last_device_log_time = 0
        self.device_log_throttle = 30  # Only log device updates every 30 seconds

    def connect_mqtt(self):
        """Connect to MQTT broker"""
        try:
            self.client = mqtt.Client(client_id=CLIENT_ID, clean_session=False)
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message

            logger.info(f"Connecting to MQTT broker {MQTT_BROKER}:{MQTT_PORT}")
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()

        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            return False

        return True

    def on_connect(self, client, userdata, flags, rc):
        """MQTT connection callback"""
        if rc == 0:
            self.connected = True
            logger.info(f"Connected to MQTT broker {MQTT_BROKER}:{MQTT_PORT}")

            # Initialize VoiceCommandProcessor with the MQTT client and shared automation_voice
            if self.voice_processor is None:
                self.voice_processor = VoiceCommandProcessor(automation_voice=self.automation_voice, mqtt_client=client)
                logger.info("Voice Command Processor initialized with shared MQTT client and automation voice")

            # Subscribe to topics with error handling and retry
            self._subscribe_to_topics(client)

        else:
            self.connected = False
            logger.error(f"MQTT connection failed with code {rc}")

    def _subscribe_to_topics(self, client):
        """Subscribe to all required MQTT topics with error handling"""
        # Wait for connection to stabilize
        time.sleep(0.2)

        # Double-check connection status
        if not self.connected:
            logger.warning("Connection lost during topic subscription, aborting...")
            return

        topics_to_subscribe = list(COMMAND_TOPICS.values()) + [RESPONSE_TOPICS['DEVICE_AVAILABLE']]

        for topic in topics_to_subscribe:
            max_retries = 3
            retry_count = 0

            while retry_count < max_retries:
                # Check connection before each attempt
                if not self.connected:
                    logger.warning(f"Connection lost, aborting subscription to {topic}")
                    break

                try:
                    result = client.subscribe(topic)
                    if result and result[0] == 0:  # Subscribe successful
                        logger.info(f"Subscribed to topic: {topic}")
                        break  # Success, exit retry loop
                    else:
                        retry_count += 1
                        if retry_count < max_retries:
                            logger.warning(f"Failed to subscribe to topic: {topic} (result: {result}), retrying... ({retry_count}/{max_retries})")
                            time.sleep(0.5 * retry_count)  # Exponential backoff
                        else:
                            logger.error(f"Failed to subscribe to topic after {max_retries} attempts: {topic}")

                except BrokenPipeError as e:
                    retry_count += 1
                    if retry_count < max_retries:
                        logger.warning(f"Broken pipe error subscribing to {topic}, retrying... ({retry_count}/{max_retries})")
                        time.sleep(1 * retry_count)  # Longer delay for broken pipe
                        # Check if we need to reconnect
                        if not self.connected:
                            logger.info("Connection appears broken, will attempt reconnect on next connection...")
                            break
                    else:
                        logger.error(f"Broken pipe error persisted for topic {topic} after {max_retries} attempts")

                except Exception as e:
                    retry_count += 1
                    if retry_count < max_retries:
                        logger.warning(f"Error subscribing to topic {topic}: {e}, retrying... ({retry_count}/{max_retries})")
                        time.sleep(0.5 * retry_count)
                    else:
                        logger.error(f"Error subscribing to topic {topic} after {max_retries} attempts: {e}")
                        # Continue with other subscriptions even if one fails

    def on_disconnect(self, client, userdata, rc):
        """MQTT disconnection callback"""
        self.connected = False
        logger.warning(f"Disconnected from MQTT broker (code: {rc})")

        # Attempt to reconnect
        if rc != 0:  # Not a clean disconnect
            logger.info("Attempting to reconnect...")
            time.sleep(5)
            self.connect_mqtt()

    def on_message(self, client, userdata, msg):
        """Handle incoming MQTT messages"""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())

            # Only log important messages at INFO level, device availability at DEBUG
            if topic == RESPONSE_TOPICS['DEVICE_AVAILABLE']:
                logger.debug(f"Received device availability update on topic: {topic}")
            else:
                logger.info(f"Received message on topic: {topic}")

            # Route message to appropriate handler
            if topic == COMMAND_TOPICS['CREATE']:
                self.handle_create_command(payload)
            elif topic == COMMAND_TOPICS['READ']:
                self.handle_read_command(payload)
            elif topic == COMMAND_TOPICS['UPDATE']:
                self.handle_update_command(payload)
            elif topic == COMMAND_TOPICS['DELETE']:
                self.handle_delete_command(payload)
            elif topic == COMMAND_TOPICS['DISCOVER']:
                self.handle_discover_command(payload)
            elif topic == COMMAND_TOPICS['VOICE_INPUT']:
                self.handle_voice_input(payload)
            elif topic == COMMAND_TOPICS['VOICE_TEST']:
                self.handle_voice_test(payload)
            elif topic == RESPONSE_TOPICS['DEVICE_AVAILABLE']:
                self.handle_device_available(payload)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON payload: {e}")
            self.send_error_response("Invalid JSON payload", str(e))
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            self.send_error_response("Internal processing error", str(e))

    def handle_create_command(self, payload):
        """Handle create automation voice command"""
        try:
            result = self.automation_voice.create_command(payload)

            if result['success']:
                logger.info(f"Created voice command for device: {payload.get('device_name')}")
                self.send_success_response(result['data'], "Command created successfully")
            else:
                logger.error(f"Failed to create voice command: {result.get('error')}")
                self.send_error_response("Failed to create command", result.get('error'))

        except Exception as e:
            logger.error(f"Error in handle_create_command: {e}")
            self.send_error_response("Create command failed", str(e))

    def handle_read_command(self, payload):
        """Handle read automation voice commands"""
        try:
            result = self.automation_voice.get_all_commands()

            if result['success']:
                logger.info(f"Retrieved {len(result['data'])} voice commands")
                # Send response wrapped in success structure for consistency
                self.send_success_response(result['data'], "Commands retrieved successfully")
            else:
                logger.error(f"Failed to read voice commands: {result.get('error')}")
                self.send_error_response("Failed to read commands", result.get('error'))

        except Exception as e:
            logger.error(f"Error in handle_read_command: {e}")
            self.send_error_response("Read command failed", str(e))

    def handle_update_command(self, payload):
        """Handle update automation voice command"""
        try:
            command_id = payload.get('id')
            update_data = payload.get('data', {})

            if not command_id:
                self.send_error_response("Missing command ID", "Command ID is required for update")
                return

            result = self.automation_voice.update_command(command_id, update_data)

            if result['success']:
                logger.info(f"Updated voice command: {command_id}")
                self.send_success_response(result['data'], "Command updated successfully")
            else:
                logger.error(f"Failed to update voice command: {result.get('error')}")
                self.send_error_response("Failed to update command", result.get('error'))

        except Exception as e:
            logger.error(f"Error in handle_update_command: {e}")
            self.send_error_response("Update command failed", str(e))

    def handle_delete_command(self, payload):
        """Handle delete automation voice command"""
        try:
            command_id = payload.get('id')

            if not command_id:
                self.send_error_response("Missing command ID", "Command ID is required for deletion")
                return

            result = self.automation_voice.delete_command(command_id)

            if result['success']:
                logger.info(f"Deleted voice command: {command_id}")
                self.send_success_response({"id": command_id}, "Command deleted successfully")
            else:
                logger.error(f"Failed to delete voice command: {result.get('error')}")
                self.send_error_response("Failed to delete command", result.get('error'))

        except Exception as e:
            logger.error(f"Error in handle_delete_command: {e}")
            self.send_error_response("Delete command failed", str(e))

    def handle_discover_command(self, payload):
        """Handle device discovery command"""
        try:
            # Request available devices
            self.request_device_discovery()

            # Return cached devices if available and not too old
            current_time = time.time()
            if self.device_cache and (current_time - self.last_device_update) < self.device_cache_timeout:
                logger.info("Returning cached device list")
                self.send_success_response(self.device_cache, "Devices discovered successfully")
            else:
                logger.info("Device cache expired or empty, requesting fresh discovery")
                # Response will be sent when device_available message is received
                self.send_success_response([], "Device discovery initiated")

        except Exception as e:
            logger.error(f"Error in handle_discover_command: {e}")
            self.send_error_response("Discovery failed", str(e))

    def handle_voice_input(self, payload):
        """Handle voice command input for execution"""
        try:
            text = payload.get('text', '').strip()

            if not text:
                self.send_voice_error("Empty voice command", "No text provided")
                return

            logger.info(f"Processing voice command: '{text}'")

            # Process the voice command
            result = self.voice_processor.process_voice_command(text)

            if result['success']:
                logger.info(f"Voice command executed successfully: {result.get('message', '')}")

                # Publish success response
                response_payload = {
                    'success': True,
                    'recognized_text': text,
                    'action': result.get('action'),
                    'object_name': result.get('object_name'),
                    'device_name': result.get('device_name'),
                    'pin': result.get('pin'),
                    'device_found': result.get('device_found', False),
                    'message': result.get('message', ''),
                    'timestamp': datetime.now().isoformat()
                }

                self.client.publish(RESPONSE_TOPICS['VOICE_RESULT'], json.dumps(response_payload))

            else:
                logger.warning(f"Voice command failed: {result.get('error', 'Unknown error')}")
                self.send_voice_error(result.get('error', 'Command failed'), text)

        except Exception as e:
            logger.error(f"Error in handle_voice_input: {e}")
            self.send_voice_error(f"Processing error: {str(e)}", payload.get('text', ''))

    def handle_voice_test(self, payload):
        """Handle voice command testing"""
        try:
            text = payload.get('text', '').strip()

            if not text:
                self.send_voice_error("Empty test command", "No text provided")
                return

            logger.info(f"Testing voice command: '{text}'")

            # Test the voice command (similar to input but without actual execution)
            result = self.voice_processor.test_voice_command(text)

            response_payload = {
                'success': result.get('success', False),
                'recognized_text': text,
                'action': result.get('action'),
                'object_name': result.get('object_name'),
                'device_name': result.get('device_name'),
                'pin': result.get('pin'),
                'device_found': result.get('device_found', False),
                'message': result.get('message', ''),
                'error': result.get('error'),
                'timestamp': datetime.now().isoformat()
            }

            self.client.publish(RESPONSE_TOPICS['VOICE_RESULT'], json.dumps(response_payload))

        except Exception as e:
            logger.error(f"Error in handle_voice_test: {e}")
            self.send_voice_error(f"Test error: {str(e)}", payload.get('text', ''))

    def handle_device_available(self, payload):
        """Handle device available notification with throttling"""
        try:
            if isinstance(payload, list):
                # Filter to only RELAY and RELAYMINI devices
                filtered_devices = [
                    device for device in payload
                    if device.get('part_number') in ['RELAY', 'RELAYMINI']
                ]

                # Check if device list has actually changed
                current_time = time.time()
                devices_changed = self._devices_changed(filtered_devices)

                # Update cache
                old_device_count = len(self.device_cache)
                self.device_cache = filtered_devices
                self.last_device_update = current_time

                # Only publish if devices changed OR it's been more than 30 seconds since last publish
                should_publish = devices_changed or (current_time - self.last_device_log_time) >= self.device_log_throttle

                if should_publish:
                    # Only log if devices actually changed
                    if devices_changed:
                        logger.info(f"Device list changed: {old_device_count} → {len(filtered_devices)} relay devices")
                        self.last_device_log_time = current_time
                    elif (current_time - self.last_device_log_time) >= self.device_log_throttle:
                        logger.debug(f"Periodic device update: {len(filtered_devices)} relay devices")
                        self.last_device_log_time = current_time

                    # Publish filtered device list to subscribers
                    self.client.publish(RESPONSE_TOPICS['DEVICE_AVAILABLE'], json.dumps(filtered_devices))
                # If not publishing, just update cache silently

        except Exception as e:
            logger.error(f"Error handling device available: {e}")

    def _devices_changed(self, new_devices):
        """Check if device list has changed"""
        if len(self.device_cache) != len(new_devices):
            return True

        # Check if any device properties changed
        for new_device in new_devices:
            device_id = new_device.get('id') or new_device.get('name')
            existing_device = next(
                (d for d in self.device_cache if (d.get('id') or d.get('name')) == device_id),
                None
            )
            if not existing_device or existing_device != new_device:
                return True

        return False

    def request_device_discovery(self):
        """Request device discovery"""
        try:
            # Publish discovery request
            discovery_payload = {"action": "discover"}
            self.client.publish("MODULAR_DEVICE/DISCOVER", json.dumps(discovery_payload))
            logger.info("Requested device discovery")
        except Exception as e:
            logger.error(f"Error requesting device discovery: {e}")

    def send_success_response(self, data, message="Success"):
        """Send success response"""
        response = {
            'status': 'success',
            'message': message,
            'data': data,
            'timestamp': datetime.now().isoformat()
        }
        self.client.publish(RESPONSE_TOPICS['RESULT'], json.dumps(response))

    def send_error_response(self, message, error_details=None):
        """Send error response"""
        response = {
            'status': 'error',
            'message': message,
            'error': error_details,
            'timestamp': datetime.now().isoformat()
        }
        self.client.publish(RESPONSE_TOPICS['RESULT'], json.dumps(response))

    def send_voice_error(self, error_message, recognized_text=""):
        """Send voice command error response"""
        response = {
            'success': False,
            'recognized_text': recognized_text,
            'error_message': error_message,
            'timestamp': datetime.now().isoformat()
        }
        self.client.publish(RESPONSE_TOPICS['VOICE_RESULT'], json.dumps(response))

    def start(self):
        """Start the Automation Voice MQTT service"""
        logger.info("Starting Automation Voice MQTT Service...")

        if not self.connect_mqtt():
            logger.error("Failed to start MQTT connection")
            return False

        # Keep the service running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down Automation Voice MQTT Service...")
            self.stop()

        return True

    def stop(self):
        """Stop the Automation Voice MQTT service"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("MQTT client disconnected")

        self.connected = False

def main():
    """Main entry point"""
    service = AutomationVoiceMQTT()
    service.start()

if __name__ == "__main__":
    main()
