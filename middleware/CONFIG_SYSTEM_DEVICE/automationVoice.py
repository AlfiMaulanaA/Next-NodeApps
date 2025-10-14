import json
import os
import uuid
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging
import subprocess

# Setup Logging
logger = logging.getLogger("AutomationVoice")

class AutomationVoice:
    def __init__(self, config_file: str = "middleware/CONFIG_SYSTEM_DEVICE/JSON/automationVoiceConfig.json"):
        self.config_file = config_file
        self.ensure_config_file()

    def ensure_config_file(self):
        """Ensure the configuration file exists"""
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            if not os.path.exists(self.config_file):
                # Create initial config file as array
                initial_config = []
                with open(self.config_file, 'w', encoding='utf-8') as f:
                    json.dump(initial_config, f, indent=2, ensure_ascii=False)
                logger.info(f"Created initial voice control config file: {self.config_file}")
        except Exception as e:
            logger.error(f"Error creating config file: {e}")
            raise

    def load_config(self) -> List[Dict[str, Any]]:
        """Load configuration from file"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Handle both old format (dict) and new format (array)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    # Convert old format to new format
                    return data.get('commands', [])
                else:
                    return []
        except FileNotFoundError:
            logger.warning(f"Config file not found: {self.config_file}")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing config file: {e}")
            return []

    def save_config(self, config: List[Dict[str, Any]]):
        """Save configuration to file"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            logger.info("Configuration saved successfully")
        except Exception as e:
            logger.error(f"Error saving config file: {e}")
            raise

    def create_command(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new voice command"""
        try:
            config = self.load_config()

            # Validate required fields
            required_fields = ['device_name', 'object_name', 'voice_commands']
            for field in required_fields:
                if field not in command_data:
                    return {
                        'success': False,
                        'error': f'Missing required field: {field}'
                    }

            # Generate unique ID
            command_id = str(uuid.uuid4().hex)[:16]
            current_time = datetime.now().isoformat()

            # Detect MAC address for the device if not provided
            device_mac = command_data.get('mac', '00:00:00:00:00:00')
            if device_mac == '00:00:00:00:00:00':
                device_mac = self.detect_device_mac(
                    command_data['device_name'],
                    command_data.get('address', 0),
                    command_data.get('device_bus', 0)
                )

            # Create command entry
            command = {
                'id': command_id,
                'device_name': command_data['device_name'],
                'part_number': command_data.get('part_number', 'RELAY'),
                'pin': command_data.get('pin', 1),
                'address': command_data.get('address', 0),
                'device_bus': command_data.get('bus', command_data.get('device_bus', 0)),
                'mac': device_mac,  # Use detected MAC address
                'voice_commands': command_data['voice_commands'] if isinstance(command_data['voice_commands'], list) else [command_data['voice_commands']],
                'object_name': command_data['object_name'],
                'description': command_data.get('desc', command_data.get('description', '')),
                'status': 'active',
                'created_at': current_time,
                'updated_at': current_time
            }

            # Add to commands list (config is now a list)
            config.append(command)
            self.save_config(config)

            logger.info(f"Created voice command: {command_id} for device {command_data['device_name']} with MAC {device_mac}")
            return {
                'success': True,
                'data': command
            }

        except Exception as e:
            logger.error(f"Error creating command: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_all_commands(self) -> Dict[str, Any]:
        """Get all voice commands"""
        try:
            config = self.load_config()
            # config is now a list directly
            commands = config if isinstance(config, list) else []

            logger.info(f"Retrieved {len(commands)} voice commands")
            return {
                'success': True,
                'data': commands
            }

        except Exception as e:
            logger.error(f"Error getting commands: {e}")
            return {
                'success': False,
                'error': str(e),
                'data': []
            }

    def get_command_by_id(self, command_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific command by ID"""
        try:
            config = self.load_config()
            # config is now a list directly
            commands = config if isinstance(config, list) else []

            for command in commands:
                if command.get('id') == command_id:
                    return command

            return None

        except Exception as e:
            logger.error(f"Error getting command {command_id}: {e}")
            return None

    def update_command(self, command_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing voice command"""
        try:
            config = self.load_config()
            # config is now a list directly
            commands = config if isinstance(config, list) else []

            # Find and update the command
            for i, command in enumerate(commands):
                if command.get('id') == command_id:
                    # Update fields
                    updated_command = command.copy()
                    updated_command['updated_at'] = datetime.now().isoformat()

                    # Update provided fields
                    for key, value in update_data.items():
                        if key in ['device_name', 'part_number', 'pin', 'address', 'device_bus',
                                 'mac', 'voice_commands', 'object_name', 'description']:
                            if key == 'voice_commands' and isinstance(value, str):
                                # Convert comma-separated string to list
                                updated_command[key] = [cmd.strip() for cmd in value.split(',') if cmd.strip()]
                            else:
                                updated_command[key] = value

                    # Update in config (config is now a list)
                    config[i] = updated_command
                    self.save_config(config)

                    logger.info(f"Updated voice command: {command_id}")
                    return {
                        'success': True,
                        'data': updated_command
                    }

            return {
                'success': False,
                'error': f'Command with ID {command_id} not found'
            }

        except Exception as e:
            logger.error(f"Error updating command {command_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def delete_command(self, command_id: str) -> Dict[str, Any]:
        """Delete a voice command"""
        try:
            config = self.load_config()
            # config is now a list directly
            commands = config if isinstance(config, list) else []

            # Find and remove the command
            for i, command in enumerate(commands):
                if command.get('id') == command_id:
                    deleted_command = commands.pop(i)
                    self.save_config(config)

                    logger.info(f"Deleted voice command: {command_id}")
                    return {
                        'success': True,
                        'data': deleted_command
                    }

            return {
                'success': False,
                'error': f'Command with ID {command_id} not found'
            }

        except Exception as e:
            logger.error(f"Error deleting command {command_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_commands_by_device(self, device_name: str) -> List[Dict[str, Any]]:
        """Get all commands for a specific device"""
        try:
            config = self.load_config()
            # config is now a list directly
            commands = config if isinstance(config, list) else []

            device_commands = [
                command for command in commands
                if command.get('device_name') == device_name
            ]

            logger.info(f"Found {len(device_commands)} commands for device {device_name}")
            return device_commands

        except Exception as e:
            logger.error(f"Error getting commands for device {device_name}: {e}")
            return []

    def search_commands(self, query: str) -> List[Dict[str, Any]]:
        """Search commands by object name or voice commands"""
        try:
            config = self.load_config()
            # config is now a list directly
            commands = config if isinstance(config, list) else []
            query_lower = query.lower()

            matching_commands = []
            for command in commands:
                # Search in object name
                if query_lower in command.get('object_name', '').lower():
                    matching_commands.append(command)
                    continue

                # Search in voice commands
                voice_commands = command.get('voice_commands', [])
                if any(query_lower in cmd.lower() for cmd in voice_commands):
                    matching_commands.append(command)
                    continue

                # Search in description
                if query_lower in command.get('description', '').lower():
                    matching_commands.append(command)

            logger.info(f"Found {len(matching_commands)} commands matching query '{query}'")
            return matching_commands

        except Exception as e:
            logger.error(f"Error searching commands: {e}")
            return []

    def validate_command_data(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate command data before creation/update"""
        errors = []

        # Required fields
        required_fields = ['device_name', 'object_name', 'voice_commands']
        for field in required_fields:
            if not command_data.get(field):
                errors.append(f"Field '{field}' is required")

        # Validate pin number
        pin = command_data.get('pin')
        if pin is not None:
            if not isinstance(pin, int) or pin < 1 or pin > 8:
                errors.append("Pin must be an integer between 1 and 8")

        # Validate address
        address = command_data.get('address')
        if address is not None and not isinstance(address, int):
            errors.append("Address must be an integer")

        # Validate device_bus
        device_bus = command_data.get('device_bus')
        if device_bus is not None and not isinstance(device_bus, int):
            errors.append("Device bus must be an integer")

        # Validate voice_commands
        voice_commands = command_data.get('voice_commands')
        if voice_commands:
            if isinstance(voice_commands, str):
                # Convert to list if string
                voice_commands = [cmd.strip() for cmd in voice_commands.split(',') if cmd.strip()]
                command_data['voice_commands'] = voice_commands
            elif isinstance(voice_commands, list):
                # Validate list items
                if not all(isinstance(cmd, str) and cmd.strip() for cmd in voice_commands):
                    errors.append("All voice commands must be non-empty strings")
            else:
                errors.append("Voice commands must be a string or list of strings")

        return {
            'valid': len(errors) == 0,
            'errors': errors
        }

    def detect_device_mac(self, device_name: str, device_address: int = None, device_bus: int = None) -> str:
        """Detect MAC address for a device using system network scanning - Prioritizes Ethernet over WiFi"""
        try:
            # Priority 1: Try Ethernet interfaces first
            ethernet_macs = self._get_ethernet_interfaces()
            if ethernet_macs:
                logger.info(f"Found {len(ethernet_macs)} Ethernet interfaces, checking ARP table...")

                # Check ARP table for Ethernet MACs
                for mac in ethernet_macs:
                    if device_address is not None:
                        try:
                            ip_address = f"192.168.1.{device_address}"  # Assuming common subnet
                            result = subprocess.run(['arp', '-n', ip_address],
                                                  capture_output=True, text=True, timeout=5)

                            if result.returncode == 0:
                                lines = result.stdout.strip().split('\n')
                                for line in lines:
                                    if ip_address in line and mac.lower() in line.lower():
                                        logger.info(f"✅ Detected Ethernet MAC address {mac} for device {device_name} at {ip_address}")
                                        return mac
                        except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
                            logger.warning(f"ARP scan failed for Ethernet MAC {mac}: {e}")

            # Priority 2: Try WiFi interfaces
            wifi_macs = self._get_wifi_interfaces()
            if wifi_macs:
                logger.info(f"Found {len(wifi_macs)} WiFi interfaces, checking ARP table...")

                # Check ARP table for WiFi MACs
                for mac in wifi_macs:
                    if device_address is not None:
                        try:
                            ip_address = f"192.168.1.{device_address}"  # Assuming common subnet
                            result = subprocess.run(['arp', '-n', ip_address],
                                                  capture_output=True, text=True, timeout=5)

                            if result.returncode == 0:
                                lines = result.stdout.strip().split('\n')
                                for line in lines:
                                    if ip_address in line and mac.lower() in line.lower():
                                        logger.info(f"📶 Detected WiFi MAC address {mac} for device {device_name} at {ip_address}")
                                        return mac
                        except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
                            logger.warning(f"ARP scan failed for WiFi MAC {mac}: {e}")

            # Priority 3: General ARP scan (fallback)
            if device_address is not None:
                try:
                    ip_address = f"192.168.1.{device_address}"  # Assuming common subnet
                    result = subprocess.run(['arp', '-n', ip_address],
                                          capture_output=True, text=True, timeout=5)

                    if result.returncode == 0:
                        lines = result.stdout.strip().split('\n')
                        for line in lines:
                            if ip_address in line:
                                # Extract MAC address from arp output
                                parts = line.split()
                                if len(parts) >= 3:
                                    mac = parts[2]
                                    if self._validate_mac_address(mac):
                                        # Check if it's an Ethernet MAC (preferred)
                                        if ethernet_macs and mac.lower() in [e.lower() for e in ethernet_macs]:
                                            logger.info(f"✅ Detected Ethernet MAC address {mac} for device {device_name} at {ip_address}")
                                            return mac
                                        # Check if it's a WiFi MAC
                                        elif wifi_macs and mac.lower() in [w.lower() for w in wifi_macs]:
                                            logger.info(f"📶 Detected WiFi MAC address {mac} for device {device_name} at {ip_address}")
                                            return mac
                                        # Accept any valid MAC as fallback
                                        else:
                                            logger.info(f"📡 Detected MAC address {mac} for device {device_name} at {ip_address}")
                                            return mac
                except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
                    logger.warning(f"General ARP scan failed for device {device_name}: {e}")

            # Priority 4: Try network scanning with nmap if available (reduced timeout and better error handling)
            try:
                logger.debug("Attempting nmap network scan...")
                result = subprocess.run(['nmap', '-sn', '192.168.1.0/24'],
                                      capture_output=True, text=True, timeout=15)  # Reduced timeout from 30 to 15 seconds

                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    current_ip = None
                    current_mac = None

                    for line in lines:
                        line = line.strip()
                        if line.startswith('Nmap scan report for'):
                            # Extract IP address
                            ip_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', line)
                            if ip_match:
                                current_ip = ip_match.group(1)
                        elif line.startswith('MAC Address:'):
                            # Extract MAC address
                            mac_match = re.search(r'MAC Address: ([0-9A-Fa-f:]{17})', line)
                            if mac_match:
                                current_mac = mac_match.group(1)
                                if current_ip and current_mac and self._validate_mac_address(current_mac):
                                    # Check if this matches our device address
                                    if device_address and current_ip.endswith(f'.{device_address}'):
                                        # Prioritize Ethernet over WiFi
                                        if ethernet_macs and current_mac.lower() in [e.lower() for e in ethernet_macs]:
                                            logger.info(f"✅ Detected Ethernet MAC address {current_mac} for device {device_name} at {current_ip}")
                                            return current_mac
                                        elif wifi_macs and current_mac.lower() in [w.lower() for w in wifi_macs]:
                                            logger.info(f"📶 Detected WiFi MAC address {current_mac} for device {device_name} at {current_ip}")
                                            return current_mac
                                        else:
                                            logger.info(f"📡 Detected MAC address {current_mac} for device {device_name} at {current_ip}")
                                            return current_mac
                else:
                    logger.warning(f"Nmap scan failed with return code {result.returncode}")
            except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
                logger.warning(f"Nmap scan failed: {e}")
            except FileNotFoundError:
                logger.debug("Nmap not installed on this system")

            # Fallback: generate a mock MAC address based on device info
            logger.warning(f"Could not detect real MAC address for device {device_name}, using generated MAC")
            return self._generate_mock_mac(device_name, device_address, device_bus)

        except Exception as e:
            logger.error(f"Error detecting MAC address for device {device_name}: {e}")
            return "00:00:00:00:00:00"

    def _validate_mac_address(self, mac: str) -> bool:
        """Validate MAC address format"""
        if not mac:
            return False

        # Check format XX:XX:XX:XX:XX:XX
        pattern = re.compile(r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$')
        return bool(pattern.match(mac))

    def _get_ethernet_interfaces(self) -> List[str]:
        """Get list of Ethernet interface MAC addresses"""
        ethernet_macs = []
        try:
            # Try to get network interfaces using ifconfig/ip command
            try:
                # Try ip command first (Linux)
                result = subprocess.run(['ip', 'link', 'show'],
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    current_interface = None
                    for line in lines:
                        line = line.strip()
                        # Look for interface names (eth0, enp0s3, etc.)
                        if line and not line.startswith(' ') and not line.startswith('\t'):
                            # Extract interface name
                            parts = line.split(':')
                            if len(parts) >= 2:
                                interface_name = parts[1].strip()
                                # Check if it's an Ethernet interface
                                if (interface_name.startswith('eth') or
                                    interface_name.startswith('enp') or
                                    interface_name.startswith('eno') or
                                    'ethernet' in interface_name.lower()):
                                    current_interface = interface_name
                        # Look for MAC address in the same interface block
                        elif current_interface and 'link/ether' in line:
                            mac_match = re.search(r'link/ether ([0-9a-f:]{17})', line)
                            if mac_match:
                                mac = mac_match.group(1)
                                if self._validate_mac_address(mac):
                                    ethernet_macs.append(mac.upper())
                                    logger.debug(f"Found Ethernet interface {current_interface} with MAC {mac}")
            except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
                # Try ifconfig command (macOS/BSD)
                try:
                    result = subprocess.run(['ifconfig'],
                                          capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        lines = result.stdout.split('\n')
                        current_interface = None
                        for line in lines:
                            line = line.strip()
                            # Look for interface names
                            if line and not line.startswith('\t') and not line.startswith(' '):
                                parts = line.split(':')
                                if len(parts) >= 1:
                                    interface_name = parts[0].strip()
                                    # Check if it's an Ethernet interface
                                    if (interface_name.startswith('eth') or
                                        interface_name.startswith('en') or
                                        'ethernet' in interface_name.lower()):
                                        current_interface = interface_name
                            # Look for MAC address (ether keyword)
                            elif current_interface and 'ether' in line:
                                mac_match = re.search(r'ether ([0-9a-f:]{17})', line)
                                if mac_match:
                                    mac = mac_match.group(1)
                                    if self._validate_mac_address(mac):
                                        ethernet_macs.append(mac.upper())
                                        logger.debug(f"Found Ethernet interface {current_interface} with MAC {mac}")
                except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
                    logger.warning("Could not detect Ethernet interfaces using system commands")

        except Exception as e:
            logger.error(f"Error detecting Ethernet interfaces: {e}")

        return ethernet_macs

    def _get_wifi_interfaces(self) -> List[str]:
        """Get list of WiFi interface MAC addresses"""
        wifi_macs = []
        try:
            # Try to get network interfaces using ifconfig/ip command
            try:
                # Try ip command first (Linux)
                result = subprocess.run(['ip', 'link', 'show'],
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    current_interface = None
                    for line in lines:
                        line = line.strip()
                        # Look for interface names (wlan0, wlp0s20f3, etc.)
                        if line and not line.startswith(' ') and not line.startswith('\t'):
                            # Extract interface name
                            parts = line.split(':')
                            if len(parts) >= 2:
                                interface_name = parts[1].strip()
                                # Check if it's a WiFi interface
                                if (interface_name.startswith('wlan') or
                                    interface_name.startswith('wlp') or
                                    'wifi' in interface_name.lower() or
                                    'wireless' in interface_name.lower()):
                                    current_interface = interface_name
                        # Look for MAC address in the same interface block
                        elif current_interface and 'link/ether' in line:
                            mac_match = re.search(r'link/ether ([0-9a-f:]{17})', line)
                            if mac_match:
                                mac = mac_match.group(1)
                                if self._validate_mac_address(mac):
                                    wifi_macs.append(mac.upper())
                                    logger.debug(f"Found WiFi interface {current_interface} with MAC {mac}")
            except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
                # Try ifconfig command (macOS/BSD)
                try:
                    result = subprocess.run(['ifconfig'],
                                          capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        lines = result.stdout.split('\n')
                        current_interface = None
                        for line in lines:
                            line = line.strip()
                            # Look for interface names
                            if line and not line.startswith('\t') and not line.startswith(' '):
                                parts = line.split(':')
                                if len(parts) >= 1:
                                    interface_name = parts[0].strip()
                                    # Check if it's a WiFi interface
                                    if (interface_name.startswith('wlan') or
                                        interface_name.startswith('en1') or  # macOS WiFi
                                        'wifi' in interface_name.lower() or
                                        'wireless' in interface_name.lower()):
                                        current_interface = interface_name
                            # Look for MAC address (ether keyword)
                            elif current_interface and 'ether' in line:
                                mac_match = re.search(r'ether ([0-9a-f:]{17})', line)
                                if mac_match:
                                    mac = mac_match.group(1)
                                    if self._validate_mac_address(mac):
                                        wifi_macs.append(mac.upper())
                                        logger.debug(f"Found WiFi interface {current_interface} with MAC {mac}")
                except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
                    logger.warning("Could not detect WiFi interfaces using system commands")

        except Exception as e:
            logger.error(f"Error detecting WiFi interfaces: {e}")

        return wifi_macs

    def _generate_mock_mac(self, device_name: str, device_address: int = None, device_bus: int = None) -> str:
        """Generate a mock MAC address for testing purposes"""
        try:
            # Create a deterministic MAC based on device info
            base_mac = "02:00:00"  # Locally administered MAC prefix

            # Use device name hash for middle bytes
            name_hash = hash(device_name) % 0xFFFFFF
            middle_bytes = f"{name_hash:06X}"

            # Use address and bus for last bytes
            addr_byte = f"{device_address or 0:02X}"
            bus_byte = f"{device_bus or 0:02X}"

            mock_mac = f"{base_mac}:{middle_bytes[:2]}:{middle_bytes[2:4]}:{middle_bytes[4:6]}:{addr_byte}:{bus_byte}"

            logger.info(f"Generated mock MAC address {mock_mac} for device {device_name}")
            return mock_mac

        except Exception as e:
            logger.error(f"Error generating mock MAC: {e}")
            return "00:00:00:00:00:00"

    def update_device_mac_addresses(self) -> Dict[str, Any]:
        """Update MAC addresses for all devices in the configuration"""
        try:
            config = self.load_config()
            # config is now a list directly
            commands = config if isinstance(config, list) else []
            updated_count = 0

            for command in commands:
                device_name = command.get('device_name')
                current_mac = command.get('mac', '00:00:00:00:00:00')
                device_address = command.get('address')
                device_bus = command.get('device_bus')

                # Skip if MAC is already detected (not default)
                if current_mac != '00:00:00:00:00:00':
                    continue

                # Detect new MAC address
                new_mac = self.detect_device_mac(device_name, device_address, device_bus)
                if new_mac != current_mac:
                    command['mac'] = new_mac
                    command['updated_at'] = datetime.now().isoformat()
                    updated_count += 1
                    logger.info(f"Updated MAC address for device {device_name}: {new_mac}")

            if updated_count > 0:
                self.save_config(config)
                logger.info(f"Updated MAC addresses for {updated_count} devices")

            return {
                'success': True,
                'updated_count': updated_count,
                'message': f'Successfully updated MAC addresses for {updated_count} devices'
            }

        except Exception as e:
            logger.error(f"Error updating device MAC addresses: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about voice commands"""
        try:
            config = self.load_config()
            # config is now a list directly
            commands = config if isinstance(config, list) else []

            stats = {
                'total_commands': len(commands),
                'active_commands': len([c for c in commands if c.get('status') == 'active']),
                'unique_devices': len(set(c.get('device_name') for c in commands if c.get('device_name'))),
                'device_types': {},
                'commands_per_device': {},
                'mac_addresses_detected': len([c for c in commands if c.get('mac') and c.get('mac') != '00:00:00:00:00:00'])
            }

            # Count device types and commands per device
            for command in commands:
                device_name = command.get('device_name', 'unknown')
                part_number = command.get('part_number', 'unknown')

                if part_number not in stats['device_types']:
                    stats['device_types'][part_number] = 0
                stats['device_types'][part_number] += 1

                if device_name not in stats['commands_per_device']:
                    stats['commands_per_device'][device_name] = 0
                stats['commands_per_device'][device_name] += 1

            return stats

        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {
                'total_commands': 0,
                'active_commands': 0,
                'unique_devices': 0,
                'device_types': {},
                'commands_per_device': {},
                'mac_addresses_detected': 0
            }
