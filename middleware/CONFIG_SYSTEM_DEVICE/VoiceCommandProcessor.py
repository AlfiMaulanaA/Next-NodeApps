import json
import re
import time
import subprocess
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import logging
import paho.mqtt.client as mqtt

from AutomationVoice import AutomationVoice

# Setup Logging
logger = logging.getLogger("VoiceCommandProcessor")

class VoiceCommandProcessor:
    def __init__(self, automation_voice: Optional[AutomationVoice] = None, mqtt_client=None):
        self.automation_voice = automation_voice or AutomationVoice()
        self.mqtt_client = mqtt_client  # Use provided MQTT client or None
        self.connected = mqtt_client is not None

        # Indonesian language patterns for voice commands
        self.action_patterns = {
            'on': [
                r'\b(nyalakan|hidupkan|aktifkan|on|turn on|enable)\b',
                r'\b(nyala|hidup|aktif)\b.*\b(lampu|light|switch)\b',
                r'\b(lampu|light|switch)\b.*\b(nyala|hidup|aktif)\b'
            ],
            'off': [
                r'\b(matikan|padamkan|nonaktifkan|off|turn off|disable)\b',
                r'\b(mati|padam|nonaktif)\b.*\b(lampu|light|switch)\b',
                r'\b(lampu|light|switch)\b.*\b(mati|padam|nonaktif)\b'
            ]
        }

        # Object name patterns (expandable)
        self.object_patterns = [
            r'\b(lampu|light|lampu utama|main light|living room light|ruang tamu)\b',
            r'\b(kamar|bedroom|kamar tidur|bed room)\b',
            r'\b(dapur|kitchen|dapur rumah)\b',
            r'\b(toilet|bathroom|kamar mandi)\b',
            r'\b(ruang tamu|living room|family room)\b',
            r'\b(ruang makan|dining room)\b',
            r'\b(teras|terrace|outdoor)\b',
            r'\b(taman|garden|yard)\b',
            r'\b(garasi|garage)\b',
            r'\b(kipas|fan|exhaust fan)\b',
            r'\b(ac|air conditioner|pendingin)\b',
            r'\b(tv|television|monitor)\b',
            r'\b(radio|music player|pemutar musik)\b'
        ]

    def init_mqtt_client(self):
        """Initialize MQTT client for device control"""
        try:
            self.mqtt_client = mqtt.Client(client_id="voice_command_processor", clean_session=False)
            self.mqtt_client.on_connect = self.on_mqtt_connect
            self.mqtt_client.on_disconnect = self.on_mqtt_disconnect

            # Connect to MQTT broker
            self.mqtt_client.connect("localhost", 1883, 60)
            self.mqtt_client.loop_start()

            logger.info("Voice Command Processor MQTT client initialized")

        except Exception as e:
            logger.error(f"Failed to initialize MQTT client: {e}")

    def on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT connection callback"""
        if rc == 0:
            self.connected = True
            logger.info("Voice Command Processor connected to MQTT broker")
        else:
            self.connected = False
            logger.error(f"Voice Command Processor MQTT connection failed: {rc}")

    def on_mqtt_disconnect(self, client, userdata, rc):
        """MQTT disconnection callback"""
        self.connected = False
        logger.warning(f"Voice Command Processor disconnected from MQTT: {rc}")

    def preprocess_text(self, text: str) -> str:
        """Preprocess voice command text"""
        if not text:
            return ""

        # Convert to lowercase
        text = text.lower().strip()

        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)

        # Remove punctuation except spaces
        text = re.sub(r'[^\w\s]', '', text)

        return text

    def extract_action(self, text: str) -> Optional[str]:
        """Extract action (on/off) from voice command"""
        text = self.preprocess_text(text)

        # Check for 'on' patterns
        for pattern in self.action_patterns['on']:
            if re.search(pattern, text, re.IGNORECASE):
                return 'on'

        # Check for 'off' patterns
        for pattern in self.action_patterns['off']:
            if re.search(pattern, text, re.IGNORECASE):
                return 'off'

        return None

    def extract_object_name(self, text: str) -> Optional[str]:
        """Extract object name from voice command"""
        text = self.preprocess_text(text)

        # Define action words to help identify object context
        action_words = ['nyalakan', 'hidupkan', 'aktifkan', 'matikan', 'padamkan', 'nonaktifkan', 'on', 'off', 'turn']

        # Split text into words
        words = text.split()

        # Find action word position
        action_pos = -1
        for i, word in enumerate(words):
            if any(action in word for action in action_words):
                action_pos = i
                break

        if action_pos >= 0 and action_pos < len(words) - 1:
            # Extract words after the action
            object_words = words[action_pos + 1:]

            # Remove common stop words
            stop_words = ['yang', 'dan', 'atau', 'dengan', 'untuk', 'pada', 'di', 'ke', 'dari']
            filtered_words = [w for w in object_words if w not in stop_words and len(w) > 1]

            if len(filtered_words) >= 2:
                # Return all remaining words as the object name
                return ' '.join(filtered_words)
            elif len(filtered_words) == 1:
                return filtered_words[0]

        # Fallback: Try to match against known object patterns with full context
        for pattern in self.object_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                # Try to get more context around the match
                start = max(0, match.start() - 10)
                end = min(len(text), match.end() + 10)
                context = text[start:end].strip()

                # Extract meaningful words from context
                context_words = [w for w in context.split() if len(w) > 2 and w not in ['yang', 'dan', 'atau', 'dengan', 'untuk', 'pada', 'di', 'ke', 'dari']]
                if context_words:
                    return ' '.join(context_words)

                return match.group(1)  # Return the matched group

        # Last resort: extract any meaningful words after action words
        for i, word in enumerate(words):
            if any(action in word for action in action_words):
                remaining_words = words[i+1:]
                meaningful_words = [w for w in remaining_words if len(w) > 2 and w not in ['yang', 'dan', 'atau', 'dengan', 'untuk', 'pada', 'di', 'ke', 'dari']]
                if meaningful_words:
                    return ' '.join(meaningful_words)

        return None

    def find_matching_command(self, action: str, object_name: str) -> Optional[Dict[str, Any]]:
        """Find matching voice command configuration"""
        try:
            # Get all commands
            result = self.automation_voice.get_all_commands()
            if not result['success']:
                logger.error("Failed to get voice commands")
                return None

            commands = result['data']
            logger.info(f"Searching through {len(commands)} voice commands for action '{action}' and object '{object_name}'")

            best_match = None
            best_score = 0

            # Search for matching command with scoring
            for command in commands:
                command_object = command.get('object_name', '').lower()
                voice_commands = command.get('voice_commands', [])
                score = 0

                # Check voice command variations first (highest priority)
                for voice_cmd in voice_commands:
                    voice_cmd_lower = voice_cmd.lower()

                    # Exact match with voice command
                    if voice_cmd_lower == f"{action} {object_name}".lower():
                        logger.info(f"Perfect match found: '{voice_cmd}' for '{action} {object_name}'")
                        return command

                    # Check if voice command contains both action and object
                    if action in voice_cmd_lower and object_name.lower() in voice_cmd_lower:
                        score = 100  # High score for action + object match
                        break

                    # Check word overlap with voice command
                    object_words = set(object_name.lower().split())
                    voice_words = set(voice_cmd_lower.split())
                    overlap = len(object_words.intersection(voice_words))
                    if overlap > 0:
                        score = max(score, overlap * 20)

                # Check object name matching (secondary priority)
                if score == 0:  # Only if no voice command match
                    object_words = set(object_name.lower().split())
                    command_words = set(command_object.lower().split())

                    # Exact object name match
                    if object_name.lower() == command_object.lower():
                        score = 90
                    # All words from object match command
                    elif object_words.issubset(command_words):
                        score = 80
                    # Significant overlap
                    elif len(object_words.intersection(command_words)) >= len(object_words) * 0.5:
                        score = len(object_words.intersection(command_words)) * 10

                # Update best match
                if score > best_score:
                    best_score = score
                    best_match = command
                    logger.debug(f"New best match: '{command_object}' with score {score}")

            if best_match:
                logger.info(f"Selected best match: '{best_match.get('object_name')}' with score {best_score} for '{action} {object_name}'")
                return best_match

            logger.warning(f"No matching command found for action '{action}' and object '{object_name}'")
            return None

        except Exception as e:
            logger.error(f"Error finding matching command: {e}")
            return None

    def execute_device_action(self, command: Dict[str, Any], action: str) -> Dict[str, Any]:
        """Execute action on device via MQTT"""
        try:
            device_name = command.get('device_name')
            pin = command.get('pin', 1)
            object_name = command.get('object_name')

            if not device_name:
                return {
                    'success': False,
                    'error': 'Device name not found in command'
                }

            # Determine the state to set (1 for on, 0 for off)
            state = 1 if action == 'on' else 0

            # Create MQTT topic for device control - use MODULAR topic for successful commands
            topic = "modular"

            # Get active MAC address for the controller (same as AutomationLogic.py)
            active_mac = self._get_active_mac_address()

            # Create payload using the simplified structure
            payload = {
                "mac": active_mac,  # Use active network MAC address
                "protocol_type": "Modular",
                "device": command.get('part_number', 'RELAY'),  # RELAY or RELAYMINI
                "function": "write",
                "value": {
                    "pin": pin,
                    "data": state  # 1 for on, 0 for off
                },
                "address": command.get('address', 0),
                "device_bus": command.get('device_bus', 0),
                "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

            # Publish to MQTT
            if self.mqtt_client and self.connected:
                result = self.mqtt_client.publish(topic, json.dumps(payload), qos=1, retain=False)

                if result.rc == 0:
                    logger.info(f"Successfully published {action} command to {topic} for device {device_name} pin {pin}")
                    return {
                        'success': True,
                        'message': f'Successfully turned {action} {object_name}',
                        'device_name': device_name,
                        'pin': pin,
                        'state': state
                    }
                else:
                    logger.error(f"Failed to publish MQTT message: {result.rc}")
                    return {
                        'success': False,
                        'error': f'MQTT publish failed with code {result.rc}'
                    }
            else:
                logger.error("MQTT client not connected")
                return {
                    'success': False,
                    'error': 'MQTT client not connected'
                }

        except Exception as e:
            logger.error(f"Error executing device action: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def process_voice_command(self, text: str) -> Dict[str, Any]:
        """Process a voice command and execute the corresponding action"""
        try:
            logger.info(f"Processing voice command: '{text}'")

            # Extract action (on/off)
            action = self.extract_action(text)
            if not action:
                return {
                    'success': False,
                    'error': 'Could not determine action (on/off) from voice command',
                    'recognized_text': text
                }

            # Extract object name
            object_name = self.extract_object_name(text)
            if not object_name:
                return {
                    'success': False,
                    'error': 'Could not determine target object from voice command',
                    'recognized_text': text,
                    'action': action
                }

            logger.info(f"Extracted action: {action}, object: {object_name}")

            # Find matching command configuration
            command = self.find_matching_command(action, object_name)
            if not command:
                return {
                    'success': False,
                    'error': f'No configured command found for "{action} {object_name}"',
                    'recognized_text': text,
                    'action': action,
                    'object_name': object_name,
                    'device_found': False
                }

            # Execute the device action
            result = self.execute_device_action(command, action)

            if result['success']:
                return {
                    'success': True,
                    'message': result['message'],
                    'recognized_text': text,
                    'action': action,
                    'object_name': command.get('object_name'),
                    'device_name': command.get('device_name'),
                    'pin': command.get('pin'),
                    'device_found': True
                }
            else:
                return {
                    'success': False,
                    'error': result['error'],
                    'recognized_text': text,
                    'action': action,
                    'object_name': command.get('object_name'),
                    'device_name': command.get('device_name'),
                    'pin': command.get('pin'),
                    'device_found': True
                }

        except Exception as e:
            logger.error(f"Error processing voice command: {e}")
            return {
                'success': False,
                'error': f'Processing error: {str(e)}',
                'recognized_text': text
            }

    def test_voice_command(self, text: str) -> Dict[str, Any]:
        """Test a voice command without executing the action"""
        try:
            logger.info(f"Testing voice command: '{text}'")

            # Extract action and object (same as processing)
            action = self.extract_action(text)
            object_name = self.extract_object_name(text)

            if not action or not object_name:
                return {
                    'success': False,
                    'error': 'Could not parse voice command',
                    'recognized_text': text,
                    'action': action,
                    'object_name': object_name
                }

            # Find matching command (same as processing)
            command = self.find_matching_command(action, object_name)

            if command:
                return {
                    'success': True,
                    'message': f'Would execute: turn {action} {command.get("object_name")} on device {command.get("device_name")} pin {command.get("pin")}',
                    'recognized_text': text,
                    'action': action,
                    'object_name': command.get('object_name'),
                    'device_name': command.get("device_name"),
                    'pin': command.get('pin'),
                    'device_found': True
                }
            else:
                return {
                    'success': False,
                    'error': f'No command configured for "{action} {object_name}"',
                    'recognized_text': text,
                    'action': action,
                    'object_name': object_name,
                    'device_found': False
                }

        except Exception as e:
            logger.error(f"Error testing voice command: {e}")
            return {
                'success': False,
                'error': str(e),
                'recognized_text': text
            }

    def get_supported_commands(self) -> List[Dict[str, Any]]:
        """Get list of all supported voice commands"""
        try:
            result = self.automation_voice.get_all_commands()
            if result['success']:
                return result['data']
            return []
        except Exception as e:
            logger.error(f"Error getting supported commands: {e}")
            return []

    def add_custom_action_pattern(self, action: str, pattern: str):
        """Add custom action pattern for voice recognition"""
        if action not in self.action_patterns:
            self.action_patterns[action] = []

        if pattern not in self.action_patterns[action]:
            self.action_patterns[action].append(pattern)
            logger.info(f"Added custom pattern for action '{action}': {pattern}")

    def add_custom_object_pattern(self, pattern: str):
        """Add custom object pattern for voice recognition"""
        if pattern not in self.object_patterns:
            self.object_patterns.append(pattern)
            logger.info(f"Added custom object pattern: {pattern}")

    def get_voice_command_stats(self) -> Dict[str, Any]:
        """Get statistics about voice command processing"""
        try:
            commands = self.get_supported_commands()

            stats = {
                'total_commands': len(commands),
                'actions_supported': list(self.action_patterns.keys()),
                'object_patterns': len(self.object_patterns),
                'commands_by_device': {}
            }

            # Group commands by device
            for command in commands:
                device = command.get('device_name', 'unknown')
                if device not in stats['commands_by_device']:
                    stats['commands_by_device'][device] = 0
                stats['commands_by_device'][device] += 1

            return stats

        except Exception as e:
            logger.error(f"Error getting voice command stats: {e}")
            return {
                'total_commands': 0,
                'actions_supported': [],
                'object_patterns': 0,
                'commands_by_device': {}
            }

    def _get_active_mac_address(self) -> str:
        """Get MAC address from active network interface (prioritize wlan0/en0, then eth0/en1)"""
        # Priority: WiFi > Ethernet (cross-platform interface names)
        interfaces = ['wlan0', 'en0', 'eth0', 'en1']  # Support both Linux and macOS interface names

        # First try: Use ifconfig (works on macOS, Linux, and embedded systems)
        try:
            logger.debug("Checking network interfaces with ifconfig")
            ifconfig_result = subprocess.run(['ifconfig'], capture_output=True, text=True, timeout=5)
            if ifconfig_result.returncode == 0:
                lines = ifconfig_result.stdout.split('\n')
                current_interface = None
                for line in lines:
                    line = line.strip()
                    # Look for interface name (line that starts with interface name)
                    if line and not line.startswith(' ') and not line.startswith('\t') and (':' in line or ' ' in line):
                        # Handle both macOS (en0:) and Linux (eth0) formats
                        if ':' in line:
                            current_interface = line.split(':')[0].strip()
                        else:
                            current_interface = line.split()[0].strip()

                    # Look for ether (MAC address) in the interface block - handle both formats
                    elif current_interface and current_interface in interfaces:
                        # macOS format: ether aa:bb:cc:dd:ee:ff
                        if 'ether ' in line:
                            mac_match = line.split('ether ')[1].split()[0].strip()
                            if self._validate_mac_address(mac_match):
                                logger.info(f"Found active MAC address from {current_interface}: {mac_match}")
                                return mac_match
                        # Alternative format: just the MAC address
                        elif len(line.split()) == 1 and self._validate_mac_address(line):
                            logger.info(f"Found active MAC address from {current_interface}: {line}")
                            return line
        except Exception as e:
            logger.warning(f"ifconfig method failed: {e}")

        # Second try: Use networksetup on macOS
        try:
            logger.debug("Trying networksetup method (macOS)")
            # Get list of hardware ports
            networksetup_result = subprocess.run(['networksetup', '-listallhardwareports'],
                                               capture_output=True, text=True, timeout=5)
            if networksetup_result.returncode == 0:
                lines = networksetup_result.stdout.split('\n')
                current_device = None
                for line in lines:
                    line = line.strip()
                    if line.startswith('Device:'):
                        current_device = line.split('Device:')[1].strip()
                    elif line.startswith('Ethernet Address:') and current_device:
                        mac_match = line.split('Ethernet Address:')[1].strip()
                        if self._validate_mac_address(mac_match):
                            logger.info(f"Found MAC address from networksetup {current_device}: {mac_match}")
                            return mac_match
        except Exception as e:
            logger.debug(f"networksetup method failed: {e}")

        # Third try: Use sysfs method (Linux only)
        for interface in interfaces[:2]:  # Only try wlan0/en0 for sysfs
            try:
                # Check if interface exists and is up
                operstate_path = f'/sys/class/net/{interface}/operstate'
                address_path = f'/sys/class/net/{interface}/address'

                # Check operstate
                with open(operstate_path, 'r') as f:
                    operstate = f.read().strip()

                if operstate == 'up':
                    # Get MAC address
                    with open(address_path, 'r') as f:
                        mac_address = f.read().strip()

                    # Validate MAC address format
                    if self._validate_mac_address(mac_address):
                        logger.info(f"Found active MAC address from {interface} (sysfs): {mac_address}")
                        return mac_address
                    else:
                        logger.warning(f"Invalid MAC format from {interface}: {mac_address}")
                else:
                    logger.debug(f"Interface {interface} operstate is {operstate}")
            except (FileNotFoundError, PermissionError, Exception) as e:
                logger.debug(f"Failed to get MAC from {interface} (sysfs): {e}")
                continue

        # Fourth try: Use ip command (Linux only)
        try:
            logger.debug("Trying ip command method")
            ip_result = subprocess.run(['ip', 'link', 'show'], capture_output=True, text=True, timeout=5)
            if ip_result.returncode == 0:
                lines = ip_result.stdout.split('\n')
                current_interface = None
                for line in lines:
                    line = line.strip()
                    # Look for interface line
                    if line.startswith('link/ether'):
                        parts = line.split()
                        if len(parts) >= 2 and current_interface in interfaces:
                            mac_address = parts[1]
                            if self._validate_mac_address(mac_address):
                                logger.info(f"Found MAC from ip command {current_interface}: {mac_address}")
                                return mac_address
                    elif line and not line.startswith(' ') and ':' in line:
                        current_interface = line.split(':')[0].strip()
        except Exception as e:
            logger.debug(f"ip command method failed: {e}")

        # Fifth try: Use Python's uuid module to get MAC address (cross-platform)
        try:
            logger.debug("Trying uuid module method")
            import uuid
            # Get the MAC address using uuid module
            mac_int = uuid.getnode()
            mac_address = ':'.join(['{:02x}'.format((mac_int >> elements) & 0xff) for elements in range(0,8*6,8)][::-1])
            if self._validate_mac_address(mac_address):
                logger.info(f"Found MAC address from uuid module: {mac_address}")
                return mac_address
        except Exception as e:
            logger.debug(f"uuid module method failed: {e}")

        # Final fallback: generate a consistent MAC based on hostname
        try:
            logger.debug("Using hostname-based MAC generation")
            import socket
            hostname = socket.gethostname()
            # Create a deterministic MAC from hostname hash
            hostname_hash = hash(hostname) & 0xFFFFFFFFFFFFFF  # 48 bits
            mac_address = ':'.join(['{:02x}'.format((hostname_hash >> i) & 0xff) for i in range(40, -1, -8)])
            if self._validate_mac_address(mac_address):
                logger.info(f"Generated hostname-based MAC address: {mac_address}")
                return mac_address
        except Exception as e:
            logger.debug(f"Hostname-based MAC generation failed: {e}")

        # Absolute fallback to default
        logger.warning("All MAC address detection methods failed, using default MAC")
        return "00:00:00:00:00:00"

    def _validate_mac_address(self, mac: str) -> bool:
        """Validate MAC address format"""
        if not mac:
            return False

        # Check format XX:XX:XX:XX:XX:XX
        pattern = re.compile(r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$')
        return bool(pattern.match(mac))

    def cleanup(self):
        """Cleanup resources"""
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            logger.info("Voice Command Processor MQTT client cleaned up")
