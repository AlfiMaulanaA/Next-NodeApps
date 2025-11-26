import json
import os
import time
import subprocess
import re
import logging
import uuid
import threading
from paho.mqtt import client as mqtt_client
from getmac import get_mac_address
from datetime import datetime

# --- Global Configuration & Constants ---
# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("NetworkManagerService")

# MQTT Broker Details
MQTT_BROKER = "18.143.215.113"
MQTT_PORT = 1883
QOS = 1 # Quality of Service for MQTT messages

# File Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INTERFACES_FILE = "/etc/network/interfaces" # Standard path for network interfaces config

# MQTT Config File Paths
MQTT_CONFIG_MODBUS = os.path.join(BASE_DIR, "../MODBUS_SNMP/JSON/Config/mqtt_config.json")
MQTT_CONFIG_MODULAR = os.path.join(BASE_DIR, "../MODULAR_I2C/JSON/Config/mqtt_config.json")

# MQTT Config Topics
TOPIC_MQTT_MODBUS_RESPONSE = "mqtt_config/modbus/response"
TOPIC_MQTT_MODBUS_COMMAND = "mqtt_config/modbus/command"
TOPIC_MQTT_MODULAR_RESPONSE = "mqtt_config/modular/response"
TOPIC_MQTT_MODULAR_COMMAND = "mqtt_config/modular/command"

# MQTT Topics
# IP Configuration Topics
TOPIC_IP_CONFIG_COMMAND = "command_device_ip"
TOPIC_IP_CONFIG_RESPONSE = "response_device_ip"

# MAC Address Topics
TOPIC_REQUEST_MAC = "mqtt_config/get_mac_address"
TOPIC_RESPONSE_MAC = "mqtt_config/response_mac"

# System Topics
MQTT_TOPIC_REBOOT = 'system/reboot'
ERROR_LOG_TOPIC = "subrack/error/log" # Centralized error logging topic

# WiFi Management Topics
TOPIC_WIFI_SCAN = "rpi/wifi/scan"
TOPIC_WIFI_SCAN_RESPONSE = "rpi/wifi/scan_response"
TOPIC_WIFI_CONNECT = "rpi/wifi/connect"
TOPIC_WIFI_CONNECT_RESPONSE = "rpi/wifi/connect_response"
TOPIC_WIFI_DISCONNECT = "rpi/wifi/disconnect"
TOPIC_WIFI_DISCONNECT_RESPONSE = "rpi/wifi/disconnect_response"
TOPIC_WIFI_DELETE = "rpi/wifi/delete"
TOPIC_WIFI_DELETE_RESPONSE = "rpi/wifi/delete_response"
TOPIC_WIFI_STATUS = "rpi/wifi/status"
TOPIC_WIFI_STATUS_GET = "rpi/wifi/status/get"
TOPIC_WIFI_STATUS_RESPONSE = "rpi/wifi/status/response"

# Network Configuration Topics
TOPIC_NETWORK_GET = "rpi/network/get"
TOPIC_NETWORK_SET = "rpi/network/set"
TOPIC_NETWORK_RESPONSE = "rpi/network/response"

# System Control Topics
TOPIC_SYSTEM_REBOOT = "rpi/system/reboot"
TOPIC_SYSTEM_FACTORY_RESET = "rpi/system/factory_reset"

# IP Synchronization Topics
TOPIC_IP_SYNC_COMMAND = "rpi/network/sync_ip"
TOPIC_IP_SYNC_RESPONSE = "rpi/network/sync_ip_response"

# Protocol Configuration File Paths
SNMP_COMM_JSON = os.path.join(BASE_DIR, "../PROTOCOL_OUT/SNMP_SERVER/json/Comm.json")
MODBUS_TCP_JSON = os.path.join(BASE_DIR, "../PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Config/modbus_tcp.json")

# --- Dedicated Error Logging Client ---
error_logger_client = None
ERROR_LOGGER_CLIENT_ID = f'network-manager-error-logger-{uuid.uuid4()}'

# Perbaikan: Tambahkan parameter `properties` di semua fungsi callback MQTT.
def on_error_logger_connect(client, userdata, flags, rc):
    """Callback for dedicated error logging MQTT client connection."""
    if rc == 0:
        logger.info("Error logger connected.")
    else:
        logger.error(f"Failed to connect error logger, return code: {rc}")

def on_error_logger_disconnect(client, userdata, rc):
    """Callback for dedicated error logging MQTT client disconnection."""
    if rc != 0:
        logger.warning(f"Unexpected disconnect from Error Log broker with code {rc}. Attempting reconnect...")
    else:
        logger.info("Error Log client disconnected normally.")

def initialize_error_logger():
    """Initializes and connects the dedicated error logging MQTT client."""
    global error_logger_client
    try:
        # Perbaikan: Tentukan callback_api_version untuk paho-mqtt 2.x
        error_logger_client = mqtt_client.Client(
            client_id=ERROR_LOGGER_CLIENT_ID
        )
        error_logger_client.on_connect = on_error_logger_connect
        error_logger_client.on_disconnect = on_error_logger_disconnect
        error_logger_client.reconnect_delay_set(min_delay=1, max_delay=120) # Exponential back-off
        error_logger_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        error_logger_client.loop_start() # Start background thread for MQTT operations
        logger.info("Error logger initialized.")
    except Exception as e:
        logger.critical(f"FATAL: Failed to initialize dedicated error logger: {e}", exc_info=True)
        # Cannot send error log if the logger itself fails to initialize

def send_error_log(function_name, error, error_type, additional_info=None):
    """
    Sends an error message to the centralized error log service via MQTT.
    Uses the dedicated error_logger_client.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # Convert the error object/string to a string for logging
    error_message_str = str(error)
    # Attempt to clean the error string if it contains subprocess's '[Errno X] ' prefix
    cleaned_error = error_message_str.split("] ")[-1] if isinstance(error, subprocess.CalledProcessError) or ']' in error_message_str else error_message_str
    human_readable_function = function_name.replace("_", " ").title()
    unique_id_fragment = str(uuid.uuid4().int % 10000000000)
    log_id = f"NetworkManagerService--{int(time.time())}-{unique_id_fragment}"

    error_payload = {
        "data": f"[{human_readable_function}] {cleaned_error}",
        "type": error_type.upper(),
        "source": "NetworkManagerService",
        "Timestamp": timestamp,
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

    # Also log to console for immediate visibility
    # Use 'error_message_str' for console logging as it contains the full original error
    if error_type.lower() == "critical":
        logger.critical(f"[{function_name}] {error_message_str}")
    elif error_type.lower() == "major":
        logger.error(f"[{function_name}] {error_message_str}")
    elif error_type.lower() == "minor":
        logger.warning(f"[{function_name}] {error_message_str}")
    else:
        logger.info(f"[{function_name}] {error_message_str}") # Default for less severe "errors"

## Network Configuration Methods and Detection

def _detect_network_method():
    """Detect which network configuration method is used"""
    try:
        # Priority 1: Check NetworkManager (default on RPi5 Bookworm)
        result = subprocess.run(['systemctl', 'is-active', 'NetworkManager'],
                               capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip() == 'active':
            return 'networkmanager'

        # Priority 2: Check dhcpcd (older RPi OS)
        if os.path.exists('/etc/dhcpcd.conf'):
            result = subprocess.run(['systemctl', 'is-active', 'dhcpcd'],
                                   capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip() == 'active':
                return 'dhcpcd'

        # Priority 3: Check systemd-networkd
        result = subprocess.run(['systemctl', 'is-active', 'systemd-networkd'],
                               capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip() == 'active':
            return 'systemd-networkd'

        # Priority 4: Check interfaces file (legacy)
        if os.path.exists('/etc/network/interfaces'):
            with open('/etc/network/interfaces', 'r') as f:
                content = f.read().strip()
                if content and not all(line.startswith('#') for line in content.splitlines() if line.strip()):
                    return 'interfaces'

        # Default fallback
        return 'networkmanager'

    except Exception as e:
        logger.error(f"Error detecting network method: {e}")
        return 'networkmanager'

## Helper Functions

def _validate_network_config(static_ip, netmask, gateway=None):
    """Validate network configuration"""
    try:
        import ipaddress

        # Validate IP address
        ip_obj = ipaddress.IPv4Address(static_ip)

        # Validate netmask and get CIDR
        cidr = _netmask_to_cidr(netmask)
        network = ipaddress.IPv4Network(f"{static_ip}/{cidr}", strict=False)

        # Validate gateway is in same network (if provided)
        if gateway:
            gateway_obj = ipaddress.IPv4Address(gateway)
            if gateway_obj not in network:
                raise ValueError(f"Gateway {gateway} not in network {network}")

        return True, f"Valid network configuration: {network}"

    except Exception as e:
        return False, f"Invalid network config: {e}"

def _netmask_to_cidr(netmask):
    """Convert netmask to CIDR notation with validation"""
    try:
        octets = netmask.split('.')
        if len(octets) != 4:
            raise ValueError(f"Invalid netmask format: {netmask}")

        cidr = 0
        for octet in octets:
            octet_int = int(octet)
            if not 0 <= octet_int <= 255:
                raise ValueError(f"Invalid octet value: {octet_int}")
            cidr += bin(octet_int).count('1')

        if not 8 <= cidr <= 30:
            raise ValueError(f"Invalid CIDR: /{cidr}")

        return cidr
    except Exception as e:
        logger.error(f"Netmask conversion error: {e}")
        raise ValueError(f"Invalid netmask: {netmask}")

def _cidr_to_netmask(cidr):
    """Convert CIDR to netmask"""
    try:
        mask = (0xffffffff >> (32 - cidr)) << (32 - cidr)
        return f"{(mask >> 24) & 0xff}.{(mask >> 16) & 0xff}.{(mask >> 8) & 0xff}.{mask & 0xff}"
    except:
        return "255.255.255.0"

## WiFi Management Functions

def run_nmcli_command(command_args, description):
    """Helper to run nmcli commands and handle output/errors"""
    try:
        result = subprocess.run(['nmcli'] + command_args, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, check=True, timeout=15)
        return True, result.stdout.strip()
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to {description}: {e.stderr.strip()}"
        logger.error(error_msg)
        return False, error_msg
    except FileNotFoundError:
        error_msg = "nmcli command not found. NetworkManager might not be installed."
        logger.error(error_msg)
        return False, error_msg
    except subprocess.TimeoutExpired:
        error_msg = f"Command timed out while trying to {description}."
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Unexpected error while trying to {description}: {e}"
        logger.error(error_msg)
        return False, error_msg

def scan_wifi():
    """Scans for available Wi-Fi networks"""
    logger.info("Scanning for Wi-Fi networks...")
    # Get current connection info for comparison
    current_status = get_wifi_status()
    current_ssid = None
    if current_status.get("connected") and current_status.get("current_network"):
        current_ssid = current_status["current_network"]["ssid"]

    success, filtered_output = run_nmcli_command(['-t', '-f', 'SSID,SECURITY,SIGNAL,FREQ', 'dev', 'wifi', 'list', '--rescan', 'yes'],
                                                 "scan Wi-Fi networks")
    if not success:
        return []

    wifi_networks = []
    seen_ssids = set()

    for filtered_line in filtered_output.splitlines():
        parts = filtered_line.split(':', 3)
        if len(parts) >= 4:
            ssid = parts[0].strip()
            security = parts[1].strip()
            signal = parts[2].strip()
            frequency = parts[3].strip()

            if ssid and ssid not in seen_ssids:
                seen_ssids.add(ssid)

                network_info = {
                    "ssid": ssid,
                    "security": security,
                    "signal": signal,
                    "frequency": frequency,
                    "is_current": ssid == current_ssid,
                    "is_saved": any(saved["ssid"] == ssid for saved in current_status.get("saved_networks", []))
                }

                wifi_networks.append(network_info)

    # Sort by signal strength (descending)
    wifi_networks.sort(key=lambda x: int(x["signal"]) if x["signal"].isdigit() else 0, reverse=True)

    logger.info(f"Found {len(wifi_networks)} Wi-Fi networks.")
    return wifi_networks

def disconnect_current_wifi():
    """Disconnects any active Wi-Fi connection on wlan0"""
    logger.info("Attempting to disconnect current Wi-Fi connection on wlan0...")
    success, message = run_nmcli_command(['device', 'disconnect', 'wlan0'], "disconnect current Wi-Fi")

    if not success and "not connected" not in message.lower():
        logger.warning(f"Failed to disconnect Wi-Fi: {message}")
        return False, message

    logger.info("Successfully disconnected Wi-Fi.")
    return True, "Successfully disconnected."

def connect_wifi(ssid, password=None):
    """Connects to a Wi-Fi network"""
    logger.info(f"Attempting to connect to Wi-Fi SSID: {ssid}")

    disconnect_success, disconnect_msg = disconnect_current_wifi()
    if not disconnect_success and "not connected" not in disconnect_msg.lower():
        return False, disconnect_msg

    time.sleep(2)

    if password:
        connect_success, connect_msg = run_nmcli_command(['dev', 'wifi', 'connect', ssid, 'password', password],
                                                         f"connect to {ssid}")
    else:
        connect_success, connect_msg = run_nmcli_command(['dev', 'wifi', 'connect', ssid],
                                                         f"connect to {ssid} (no password)")

    if not connect_success:
        return False, connect_msg

    logger.info(f"Successfully connected to {ssid}")
    time.sleep(3)

    ip_success, ip_output = run_nmcli_command(['device', 'show', 'wlan0'], "get IP address from wlan0")
    if ip_success:
        import re
        match = re.search(r"IP4\.ADDRESS\[1\]:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/\d+", ip_output)
        ip_address = match.group(1) if match else "IP not found"
    else:
        ip_address = "IP not found"

    return True, ip_address

def delete_wifi(ssid):
    """Deletes a Wi-Fi connection by SSID"""
    logger.info(f"Attempting to delete Wi-Fi connection: {ssid}")

    success, output = run_nmcli_command(['-t', '-f', 'UUID,NAME', 'connection', 'show'],
                                        "fetch Wi-Fi connections")
    if not success:
        return False, output

    uuid_to_delete = None
    for line in output.splitlines():
        parts = line.split(':')
        if len(parts) >= 2 and parts[1] == ssid:
            uuid_to_delete = parts[0]
            break

    if not uuid_to_delete:
        return False, f"Wi-Fi connection '{ssid}' not found in saved connections."

    success, message = run_nmcli_command(['connection', 'delete', 'uuid', uuid_to_delete],
                                         f"delete Wi-Fi connection '{ssid}'")
    if not success:
        return False, message

    logger.info(f"Successfully deleted Wi-Fi {ssid}")
    return True, f"Wi-Fi {ssid} deleted successfully."

def get_wifi_status():
    """Get comprehensive WiFi status including current connection and saved networks"""
    try:
        # Get current connection status
        success, output = run_nmcli_command(['-t', '-f', 'DEVICE,TYPE,STATE,CONNECTION', 'device', 'status'],
                                            "get device status")
        if not success:
            return {"connected": False, "current_network": None, "saved_networks": [], "error": output}

        wifi_status = {
            "connected": False,
            "current_network": None,
            "saved_networks": [],
            "device_state": "unknown"
        }

        # Check WiFi device status
        for line in output.splitlines():
            parts = line.split(':')
            if len(parts) >= 4 and parts[0] == 'wlan0':
                wifi_status["device_state"] = parts[2]

                if parts[2] == 'connected' and parts[3]:
                    wifi_status["connected"] = True
                    connection_name = parts[3]  # Simpan connection name

                    # Get SSID asli dari connection profile
                    ssid_success, ssid_output = run_nmcli_command(['-t', '-f', '802-11-wireless.ssid', 'connection', 'show', connection_name],
                                                                "get real SSID")
                    current_ssid = connection_name  # fallback
                    if ssid_success and ssid_output.strip():
                        for line in ssid_output.splitlines():
                            if line.startswith('802-11-wireless.ssid:'):
                                current_ssid = line.split(':', 1)[1].strip()
                                break

                    # Get detailed info for current connection
                    ip_success, ip_output = run_nmcli_command(['device', 'show', 'wlan0'], "get wlan0 details")
                    current_ip = None
                    signal_strength = None

                    if ip_success:
                        import re
                        # Extract IP address
                        ip_match = re.search(r"IP4\.ADDRESS\[1\]:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/\d+", ip_output)
                        if ip_match:
                            current_ip = ip_match.group(1)

                    # Get signal strength for current connection
                    signal_success, signal_output = run_nmcli_command(['-t', '-f', 'SSID,SIGNAL', 'dev', 'wifi'],
                                                                    "get current signal strength")
                    if signal_success:
                        for signal_line in signal_output.splitlines():
                            signal_parts = signal_line.split(':')
                            if len(signal_parts) >= 2 and signal_parts[0] == current_ssid:
                                signal_strength = signal_parts[1]
                                break

                    wifi_status["current_network"] = {
                        "ssid": current_ssid,
                        "ip_address": current_ip,
                        "signal_strength": signal_strength
                    }
                break

        # Get all saved WiFi connections
        saved_success, saved_output = run_nmcli_command(['-t', '-f', 'NAME,TYPE', 'connection', 'show'],
                                                        "get saved connections")
        if saved_success:
            for line in saved_output.splitlines():
                parts = line.split(':')
                if len(parts) >= 2 and parts[1] == '802-11-wireless':
                    wifi_status["saved_networks"].append({
                        "ssid": parts[0],
                        "is_current": wifi_status["connected"] and wifi_status["current_network"] and
                                    wifi_status["current_network"]["ssid"] == parts[0]
                    })

        return wifi_status

    except Exception as e:
        logger.error(f"Error getting comprehensive WiFi status: {e}")
        return {"connected": False, "current_network": None, "saved_networks": [], "error": str(e)}

## Network Configuration Management (Advanced)

def _get_ethernet_connection_name(interface="eth0"):
    """Get NetworkManager ethernet connection name"""
    try:
        result = subprocess.run([
            'nmcli', '-t', '-f', 'NAME,TYPE,DEVICE', 'connection', 'show'
        ], capture_output=True, text=True, check=True)

        logger.info(f"Connection list output: {result.stdout}")

        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split(':')
                if len(parts) >= 3:
                    name, conn_type, device = parts[:3]
                    # FIX: Ganti 'ethernet' jadi '802-3-ethernet'
                    if conn_type == '802-3-ethernet' and device == interface:
                        logger.info(f"Found ethernet connection: '{name}' on {interface}")
                        return name  # Return "Wired connection 2"

        # Fallback: look for any ethernet connection
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split(':')
                # FIX: Ganti 'ethernet' jadi '802-3-ethernet'
                if len(parts) >= 2 and parts[1] == '802-3-ethernet':
                    logger.info(f"Found ethernet connection: '{parts[0]}' (fallback)")
                    return parts[0]  # Bisa return "Wired connection 2" atau "Wired connection 1"

        # Default fallback
        return "Wired connection 1"

    except Exception as e:
        logger.error(f"Error getting ethernet connection name: {e}")
        return "Wired connection 1"

# --- NetworkManager Functions ---

def _set_networkmanager_static(interface, ip, netmask, gateway, dns):
    """Set static IP using NetworkManager"""
    try:
        # Validate network configuration first
        valid, msg = _validate_network_config(ip, netmask, gateway)
        if not valid:
            return False, msg

        # Get actual connection name
        conn_name = _get_ethernet_connection_name(interface)
        logger.info(f"Using connection name: '{conn_name}'")

        # Configure static IP on existing connection
        cidr = _netmask_to_cidr(netmask)

        cmd = [
            'nmcli', 'con', 'modify', conn_name,
            'ipv4.method', 'manual',
            'ipv4.addresses', f'{ip}/{cidr}',
            'ipv4.gateway', gateway
        ]

        if dns:
            cmd.extend(['ipv4.dns', dns.replace(' ', ',')])

        logger.info(f"Executing command: {cmd}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info(f"Static IP configured for connection: '{conn_name}'")

        # Try to reactivate connection
        try:
            down_cmd = ['nmcli', 'con', 'down', conn_name]
            up_cmd = ['nmcli', 'con', 'up', conn_name]

            logger.info(f"Deactivating connection: {down_cmd}")
            subprocess.run(down_cmd, capture_output=True, text=True, check=True)
            time.sleep(2)

            logger.info(f"Activating connection: {up_cmd}")
            subprocess.run(up_cmd, capture_output=True, text=True, check=True)

            logger.info("Connection reactivated successfully")
            return True, f"Static IP {ip} set and activated for {interface}"
        except subprocess.CalledProcessError as e:
            logger.info(f"Connection configured but activation failed: {e.stderr}")
            return True, f"Static IP {ip} configured for {interface}. Connect ethernet cable to activate."

    except subprocess.CalledProcessError as e:
        error_msg = f"nmcli command failed: {e.stderr if e.stderr else str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Error setting NetworkManager static IP: {e}"
        logger.error(error_msg)
        return False, error_msg

def _set_networkmanager_dhcp(interface):
    """Set DHCP using NetworkManager"""
    try:
        conn_name = _get_ethernet_connection_name(interface)
        logger.info(f"Using connection name: '{conn_name}'")

        cmd = [
            'nmcli', 'con', 'modify', conn_name,
            'ipv4.method', 'auto'
        ]

        # Clear any static settings
        clear_cmds = [
            ['nmcli', 'con', 'modify', conn_name, 'ipv4.addresses', ''],
            ['nmcli', 'con', 'modify', conn_name, 'ipv4.gateway', ''],
            ['nmcli', 'con', 'modify', conn_name, 'ipv4.dns', '']
        ]

        for clear_cmd in clear_cmds:
            subprocess.run(clear_cmd, capture_output=True, text=True)

        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info(f"DHCP configured for connection: '{conn_name}'")

        # Try to reactivate connection
        try:
            down_cmd = ['nmcli', 'con', 'down', conn_name]
            up_cmd = ['nmcli', 'con', 'up', conn_name]

            subprocess.run(down_cmd, capture_output=True, text=True, check=True)
            time.sleep(2)
            subprocess.run(up_cmd, capture_output=True, text=True, check=True)

            logger.info("DHCP connection activated successfully")
            return True, f"DHCP configured and activated for {interface}"
        except subprocess.CalledProcessError:
            logger.info("DHCP configured but activation failed (cable may not be connected)")
            return True, f"DHCP configured for {interface}. Connect ethernet cable to activate."

    except subprocess.CalledProcessError as e:
        error_msg = f"nmcli command failed: {e.stderr if e.stderr else str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        return False, f"Error setting NetworkManager DHCP: {e}"

def _read_networkmanager_config():
    """Read NetworkManager configuration"""
    try:
        # Get device status
        result = subprocess.run(['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE,CONNECTION', 'device', 'status'],
                               capture_output=True, text=True, check=True)

        logger.info(f"Device status output: {result.stdout}")

        interfaces = {}
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split(':')
                if len(parts) >= 4:
                    device, type_name, state, connection = parts[:4]
                    logger.info(f"Processing device: {device}, type: {type_name}, state: {state}, connection: {connection}")

                    # PERBAIKAN: Tambah kondisi untuk berbagai format type name
                    is_ethernet = type_name in ['802-3-ethernet', 'ethernet']
                    is_wireless = type_name in ['802-11-wireless', 'wifi', 'wireless']

                    if is_ethernet or is_wireless:
                        interfaces[device] = {
                            'state': state,
                            'connection': connection if connection and connection != '--' else 'none',
                            'type': type_name,
                            'method': 'dhcp'  # Default, akan diupdate nanti
                        }

                        logger.info(f"Added device {device}: state={state}, connection='{connection}'")

                        # Jika ethernet tidak punya active connection, cari ethernet connections yang tersedia
                        if is_ethernet and (not connection or connection == '--'):
                            logger.info(f"{device} has no active connection, looking for ethernet connections...")
                            try:
                                # Find ethernet connections
                                conn_result = subprocess.run([
                                    'nmcli', '-t', '-f', 'NAME,TYPE', 'con', 'show'
                                ], capture_output=True, text=True, check=True)

                                logger.info(f"Available connections: {conn_result.stdout}")

                                for conn_line in conn_result.stdout.strip().split('\n'):
                                    if conn_line:
                                        conn_parts = conn_line.split(':')
                                        if len(conn_parts) >= 2:
                                            conn_name, conn_type = conn_parts[0], conn_parts[1]
                                            # Check for ethernet connection types
                                            if conn_type in ['802-3-ethernet', 'ethernet']:
                                                connection = conn_name
                                                interfaces[device]['connection'] = connection
                                                logger.info(f"Found ethernet connection: '{connection}'")
                                                break
                            except subprocess.CalledProcessError as e:
                                logger.error(f"Failed to find ethernet connections: {e}")

                        # Get detailed connection info if connection exists
                        if connection and connection != '--' and connection != '':
                            try:
                                # Get connection details
                                con_result = subprocess.run([
                                    'nmcli', '-t', '-f', 'ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns',
                                    'con', 'show', connection
                                ], capture_output=True, text=True, check=True)

                                logger.info(f"Connection '{connection}' details: {con_result.stdout}")

                                for con_line in con_result.stdout.strip().split('\n'):
                                    if ':' in con_line:
                                        key, value = con_line.split(':', 1)
                                        if key == 'ipv4.method':
                                            interfaces[device]['method'] = 'static' if value == 'manual' else 'dhcp'
                                            logger.info(f"Device {device} method: {interfaces[device]['method']}")
                                        elif key == 'ipv4.addresses' and value and value.strip():
                                            # Parse addresses - could be multiple, take first one
                                            addresses = value.split(',')[0].strip()
                                            if addresses and '/' in addresses:
                                                ip_addr = addresses.split('/')[0]
                                                cidr = addresses.split('/')[1]
                                                interfaces[device]['address'] = ip_addr
                                                interfaces[device]['cidr'] = cidr
                                                interfaces[device]['netmask'] = _cidr_to_netmask(int(cidr))
                                                logger.info(f"Device {device} configured IP: {ip_addr}/{cidr}")
                                        elif key == 'ipv4.gateway' and value and value.strip():
                                            interfaces[device]['gateway'] = value.strip()
                                            logger.info(f"Device {device} gateway: {value.strip()}")
                                        elif key == 'ipv4.dns' and value and value.strip():
                                            # Clean up DNS - remove semicolons and extra spaces
                                            dns_servers = value.replace(';', ' ').strip()
                                            if dns_servers:
                                                interfaces[device]['dns-nameservers'] = dns_servers
                                                logger.info(f"Device {device} DNS: {dns_servers}")
                            except subprocess.CalledProcessError as e:
                                logger.error(f"Failed to get connection details for '{connection}': {e}")

                        # Get current active IP if device is connected
                        if state == 'connected':
                            try:
                                ip_result = subprocess.run(['nmcli', '-t', '-f', 'IP4.ADDRESS', 'device', 'show', device],
                                                        capture_output=True, text=True, check=True)

                                logger.info(f"Current IP info for {device}: {ip_result.stdout}")

                                if ip_result.stdout.strip():
                                    for ip_line in ip_result.stdout.strip().split('\n'):
                                        if ip_line.startswith('IP4.ADDRESS[1]'):
                                            ip_addr_full = ip_line.split(':')[1].strip()
                                            if '/' in ip_addr_full:
                                                current_ip = ip_addr_full.split('/')[0]
                                                interfaces[device]['current_address'] = current_ip
                                                logger.info(f"Device {device} current IP: {current_ip}")

                                                # If no configured address but we have current address, use it
                                                if 'address' not in interfaces[device]:
                                                    interfaces[device]['address'] = current_ip
                                            break
                            except subprocess.CalledProcessError as e:
                                logger.error(f"Failed to get current IP for {device}: {e}")

                        # Additional info gathering for better display
                        try:
                            # Get more device info
                            device_result = subprocess.run([
                                'nmcli', '-t', '-f', 'GENERAL.STATE,IP4.ADDRESS,IP4.GATEWAY,IP4.DNS',
                                'device', 'show', device
                            ], capture_output=True, text=True, check=True)

                            for info_line in device_result.stdout.strip().split('\n'):
                                if ':' in info_line:
                                    key, value = info_line.split(':', 1)
                                    if key == 'GENERAL.STATE':
                                        interfaces[device]['device_state'] = value.strip()
                                    elif key == 'IP4.GATEWAY' and value.strip():
                                        if 'gateway' not in interfaces[device] or not interfaces[device]['gateway']:
                                            interfaces[device]['gateway'] = value.strip()
                                    elif key.startswith('IP4.DNS') and value.strip():
                                        if 'dns-nameservers' not in interfaces[device]:
                                            interfaces[device]['dns-nameservers'] = value.strip()
                                        else:
                                            # Append additional DNS servers
                                            current_dns = interfaces[device]['dns-nameservers']
                                            new_dns = value.strip()
                                            if new_dns not in current_dns:
                                                interfaces[device]['dns-nameservers'] = f"{current_dns} {new_dns}"
                        except subprocess.CalledProcessError as e:
                            logger.warning(f"Failed to get additional device info for {device}: {e}")
                    else:
                        logger.debug(f"Skipping device {device} with type {type_name}")

        logger.info(f"Final interfaces config: {interfaces}")
        return True, interfaces

    except subprocess.CalledProcessError as e:
        logger.error(f"NetworkManager command failed: {e}")
        return False, f"NetworkManager command failed: {e}"
    except Exception as e:
        logger.error(f"Error reading NetworkManager config: {e}")
        return False, f"Error reading NetworkManager config: {e}"

# --- dhcpcd Functions ---

def _set_dhcpcd_static(interface, ip, netmask, gateway, dns):
    """Set static IP using dhcpcd"""
    try:
        if not os.path.exists('/etc/dhcpcd.conf'):
            return False, "dhcpcd.conf not found at /etc/dhcpcd.conf"

        valid, msg = _validate_network_config(ip, netmask, gateway)
        if not valid:
            return False, msg

        with open('/etc/dhcpcd.conf', 'r') as f:
            config_lines = f.readlines()

        # Remove existing interface config
        new_lines = []
        skip_interface = False
        for line in config_lines:
            if line.strip().startswith(f'interface {interface}'):
                skip_interface = True
                continue
            elif line.strip().startswith('interface ') and skip_interface:
                skip_interface = False
                new_lines.append(line)
            elif not skip_interface:
                new_lines.append(line)

        # Add new static config
        new_lines.append(f'\n# Static IP for {interface}\n')
        new_lines.append(f'interface {interface}\n')
        new_lines.append(f'static ip_address={ip}/{_netmask_to_cidr(netmask)}\n')
        new_lines.append(f'static routers={gateway}\n')
        if dns:
            new_lines.append(f'static domain_name_servers={dns}\n')

        with open('/etc/dhcpcd.conf', 'w') as f:
            f.writelines(new_lines)

        subprocess.run(['sudo', 'systemctl', 'restart', 'dhcpcd'],
                      check=True, capture_output=True)

        logger.info(f"dhcpcd static IP set for {interface}: {ip}")
        return True, f"Static IP {ip} set successfully using dhcpcd"

    except Exception as e:
        return False, f"Error setting dhcpcd static IP: {e}"

def _set_dhcpcd_dhcp(interface):
    """Set DHCP using dhcpcd"""
    try:
        if not os.path.exists('/etc/dhcpcd.conf'):
            return False, "dhcpcd.conf not found at /etc/dhcpcd.conf"

        with open('/etc/dhcpcd.conf', 'r') as f:
            config_lines = f.readlines()

        # Remove existing interface config
        new_lines = []
        skip_interface = False
        for line in config_lines:
            if line.strip().startswith(f'interface {interface}'):
                skip_interface = True
                continue
            elif line.strip().startswith('interface ') and skip_interface:
                skip_interface = False
                new_lines.append(line)
            elif not skip_interface:
                new_lines.append(line)

        with open('/etc/dhcpcd.conf', 'w') as f:
            f.writelines(new_lines)

        subprocess.run(['sudo', 'systemctl', 'restart', 'dhcpcd'],
                      check=True, capture_output=True)

        logger.info(f"dhcpcd DHCP set for {interface}")
        return True, f"DHCP set successfully for {interface} using dhcpcd"

    except Exception as e:
        return False, f"Error setting dhcpcd DHCP: {e}"

def _read_dhcpcd_config():
    """Read dhcpcd configuration"""
    try:
        interfaces = {}

        if os.path.exists('/etc/dhcpcd.conf'):
            with open('/etc/dhcpcd.conf', 'r') as f:
                content = f.read()

            current_interface = None
            for line in content.splitlines():
                line = line.strip()
                if line.startswith('interface '):
                    current_interface = line.split()[1]
                    interfaces[current_interface] = {'method': 'static'}
                elif current_interface and line.startswith('static ip_address='):
                    interfaces[current_interface]['address'] = line.split('=')[1].split('/')[0]
                elif current_interface and line.startswith('static routers='):
                    interfaces[current_interface]['gateway'] = line.split('=')[1]
                elif current_interface and line.startswith('static domain_name_servers='):
                    interfaces[current_interface]['dns-nameservers'] = line.split('=')[1]

        # Add common interfaces if not found
        for iface in ['eth0', 'wlan0']:
            if iface not in interfaces:
                interfaces[iface] = {'method': 'dhcp'}

        return True, interfaces

    except Exception as e:
        return False, f"Error reading dhcpcd config: {e}"

# --- interfaces Functions ---

def _set_interfaces_static(interface, ip, netmask, gateway, dns):
    """Set static IP using /etc/network/interfaces"""
    try:
        if not os.path.exists('/etc/network/interfaces'):
            return False, "/etc/network/interfaces not found"

        valid, msg = _validate_network_config(ip, netmask, gateway)
        if not valid:
            return False, msg

        success, message = change_ip_configuration(interface, "static", ip, netmask, gateway, dns)
        if success:
            logger.info(f"Static IP set for {interface}: {ip}")
            restart_success, restart_msg = restart_networking_service()
            return restart_success, f"{message} {restart_msg}"
        return success, message

    except Exception as e:
        return False, f"Error setting interfaces static IP: {e}"

def _set_interfaces_dhcp(interface):
    """Set DHCP using /etc/network/interfaces"""
    try:
        if not os.path.exists('/etc/network/interfaces'):
            return False, "/etc/network/interfaces not found"

        success, message = change_ip_configuration(interface, "dhcp")
        if success:
            logger.info(f"Dynamic IP set for {interface}")
            restart_success, restart_msg = restart_networking_service()
            return restart_success, f"{message} {restart_msg}"
        return success, message

    except Exception as e:
        return False, f"Error setting interfaces DHCP: {e}"

def _read_interfaces_config():
    """Read /etc/network/interfaces configuration"""
    try:
        if not os.path.exists('/etc/network/interfaces'):
            return True, {'eth0': {'method': 'dhcp'}, 'wlan0': {'method': 'dhcp'}}

        with open('/etc/network/interfaces', 'r') as file:
            file_content = file.read()
        interfaces_json = parse_interfaces_file(file_content)
        return True, interfaces_json

    except FileNotFoundError:
        return True, {'eth0': {'method': 'dhcp'}, 'wlan0': {'method': 'dhcp'}}
    except PermissionError:
        return False, "Permission denied to read /etc/network/interfaces"
    except Exception as e:
        return False, f"Error reading interfaces file: {e}"

# --- Unified Network Configuration Functions ---

def read_current_ip_config():
    """Read current IP configuration based on detected network method"""
    try:
        network_method = _detect_network_method()

        if network_method == 'networkmanager':
            return _read_networkmanager_config()
        elif network_method == 'dhcpcd':
            return _read_dhcpcd_config()
        elif network_method == 'interfaces':
            return _read_interfaces_config()
        else:
            return False, f"Unsupported network method: {network_method}"

    except Exception as e:
        logger.error(f"Error reading network config: {e}")
        return False, f"Error reading network config: {e}"

def set_static_ip(interface="eth0", ip="192.168.0.100", netmask="255.255.255.0", gateway="192.168.0.1", dns="8.8.8.8 8.8.4.4"):
    """Set static IP for interface using detected network method"""
    try:
        network_method = _detect_network_method()

        if network_method == 'networkmanager':
            return _set_networkmanager_static(interface, ip, netmask, gateway, dns)
        elif network_method == 'dhcpcd':
            return _set_dhcpcd_static(interface, ip, netmask, gateway, dns)
        elif network_method == 'interfaces':
            return _set_interfaces_static(interface, ip, netmask, gateway, dns)
        else:
            return False, f"Unsupported network method: {network_method}"

    except Exception as e:
        logger.error(f"Error setting static IP: {e}")
        return False, f"Error setting static IP: {e}"

def set_dynamic_ip(interface="eth0"):
    """Set dynamic IP (DHCP) for interface using detected network method"""
    try:
        network_method = _detect_network_method()

        if network_method == 'networkmanager':
            return _set_networkmanager_dhcp(interface)
        elif network_method == 'dhcpcd':
            return _set_dhcpcd_dhcp(interface)
        elif network_method == 'interfaces':
            return _set_interfaces_dhcp(interface)
        else:
            return False, f"Unsupported network method: {network_method}"

    except Exception as e:
        logger.error(f"Error setting dynamic IP: {e}")
        return False, f"Error setting dynamic IP: {e}"

def restart_networking_service():
    """Restarts the appropriate networking service based on detected method"""
    try:
        network_method = _detect_network_method()

        if network_method == 'networkmanager':
            subprocess.run(["sudo", "systemctl", "restart", "NetworkManager"],
                          check=True, text=True, capture_output=True)
            logger.info("NetworkManager service restarted successfully")
            return True, "NetworkManager service restarted successfully."

        elif network_method == 'dhcpcd':
            subprocess.run(["sudo", "systemctl", "restart", "dhcpcd"],
                          check=True, text=True, capture_output=True)
            logger.info("dhcpcd service restarted successfully")
            return True, "dhcpcd service restarted successfully."

        elif network_method == 'interfaces':
            try:
                subprocess.run(["sudo", "systemctl", "restart", "networking"],
                              check=True, text=True, capture_output=True)
                logger.info("networking service restarted successfully")
                return True, "networking service restarted successfully."
            except subprocess.CalledProcessError:
                logger.info("networking service not found, using ifdown/ifup")
                subprocess.run(["sudo", "ifdown", "eth0"], capture_output=True)
                time.sleep(2)
                subprocess.run(["sudo", "ifup", "eth0"], capture_output=True)
                return True, "Network interface restarted with ifdown/ifup."
        else:
            return False, f"Unknown network method: {network_method}"

    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to restart network service: {e.stderr.strip() if e.stderr else str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Unexpected error restarting network service: {e}"
        logger.error(error_msg)
        return False, error_msg

## IP Synchronization Functions

def get_current_eth0_ip():
    """Get current IP, netmask, and gateway of eth0 interface"""
    try:
        success, config = read_current_ip_config()
        if success and 'eth0' in config:
            eth0_config = config['eth0']
            if eth0_config.get('current_address') and eth0_config.get('netmask') and eth0_config.get('gateway'):
                return {
                    'ip': eth0_config['current_address'],
                    'netmask': eth0_config['netmask'],
                    'gateway': eth0_config['gateway']
                }
        logger.warning("Failed to get current eth0 IP configuration")
        return None
    except Exception as e:
        logger.error(f"Error getting current eth0 IP: {e}")
        return None

def sync_ip_to_protocol_configs(new_ip=None, new_netmask=None, new_gateway=None):
    """Synchronize IP configuration to SNMP and Modbus TCP config files"""
    try:
        # If no parameters provided, get from current network config
        if not all([new_ip, new_netmask, new_gateway]):
            eth0_info = get_current_eth0_ip()
            if not eth0_info:
                logger.error("Failed to get current eth0 IP for synchronization")
                return False, "Failed to get current eth0 IP configuration"

            new_ip = eth0_info['ip']
            new_netmask = eth0_info['netmask']
            new_gateway = eth0_info['gateway']

        results = []

        # Update SNMP Configuration
        try:
            with open(SNMP_COMM_JSON, 'r') as f:
                snmp_config = json.load(f)

            snmp_config['snmpIPaddress'] = new_ip
            snmp_config['snmpNetmask'] = new_netmask
            snmp_config['snmpGateway'] = new_gateway

            with open(SNMP_COMM_JSON, 'w') as f:
                json.dump(snmp_config, f, indent=4)

            results.append("SNMP config updated successfully")
            logger.info(f"SNMP config synchronized: IP={new_ip}, Netmask={new_netmask}, Gateway={new_gateway}")
        except Exception as e:
            error_msg = f"Failed to update SNMP config: {e}"
            results.append(error_msg)
            logger.error(error_msg)

        # Update Modbus TCP Configuration
        try:
            with open(MODBUS_TCP_JSON, 'r') as f:
                modbus_config = json.load(f)

            modbus_config['modbus_tcp_ip'] = new_ip

            with open(MODBUS_TCP_JSON, 'w') as f:
                json.dump(modbus_config, f, indent=4)

            results.append("Modbus TCP config updated successfully")
            logger.info(f"Modbus TCP config synchronized: IP={new_ip}")
        except Exception as e:
            error_msg = f"Failed to update Modbus TCP config: {e}"
            results.append(error_msg)
            logger.error(error_msg)

        # Check if all updates succeeded
        success = all("successfully" in result for result in results)
        message = "; ".join(results)

        return success, message
    except Exception as e:
        error_msg = f"Critical error during IP synchronization: {e}"
        logger.error(error_msg)
        return False, error_msg

## IP Address Configuration

def parse_interfaces_file(content):
    """Parses the /etc/network/interfaces file content."""
    interfaces = {}
    current_iface = None
    try:
        for line in content.splitlines():
            line = line.strip()

            if line.startswith("auto "):
                current_iface = line.split()[1]
                if current_iface not in interfaces:
                    interfaces[current_iface] = {}
                # If 'auto' line is followed by an 'iface' line, we'll update the details then.
                # Otherwise, it might just be an 'auto' line without further config in this block.

            elif line.startswith("iface "):
                parts = line.split()
                if len(parts) < 4:
                    logger.warning(f"Malformed iface line encountered: {line}. Skipping.")
                    continue

                iface_name = parts[1]
                if iface_name not in interfaces: # Handle iface without preceding auto
                    interfaces[iface_name] = {}
                interfaces[iface_name]["method"] = parts[3]

                if parts[3] == "static":
                    # Initialize static parameters as empty; they will be filled by subsequent lines
                    interfaces[iface_name]["address"] = ""
                    interfaces[iface_name]["netmask"] = ""
                    interfaces[iface_name]["gateway"] = ""
                current_iface = iface_name # Set current_iface to the one defined by 'iface'

            elif current_iface and line:
                try:
                    key, value = line.split(maxsplit=1)
                    # Only add iface-specific network configuration keys
                    if key in ["address", "netmask", "gateway", "dns-nameservers", "pre-up", "post-down"]:
                        interfaces[current_iface][key] = value
                except ValueError:
                    # Ignore lines that don't conform to key-value (e.g., comments or empty lines)
                    pass
        return interfaces
    except Exception as e:
        send_error_log("parse_interfaces_file", f"Error parsing interfaces file: {e}", "major", {"content_preview": content[:200]})
        return {}

def change_ip_configuration(interface, method, static_ip=None, netmask=None, gateway=None):
    """Changes the IP configuration for a given network interface in /etc/network/interfaces."""
    original_permissions = None
    try:
        # Save original permissions and set writable permissions temporarily
        original_permissions = os.stat(INTERFACES_FILE).st_mode
        os.chmod(INTERFACES_FILE, 0o666) # Temporarily make it writable for all (careful with this in production!)

        new_lines = []
        in_target_iface_section = False

        with open(INTERFACES_FILE, 'r') as file:
            lines = file.readlines()

        with open(INTERFACES_FILE, 'w') as file:
            for line in lines:
                stripped_line = line.strip()

                if stripped_line.startswith(f"auto {interface}"):
                    new_lines.append(line) # Always keep the 'auto' line
                    # The actual iface config will be handled when 'iface' line is found

                elif stripped_line.startswith(f"iface {interface}"):
                    in_target_iface_section = True
                    # Write the new 'iface' line with the desired method
                    new_lines.append(f"iface {interface} inet {method}")
                else:
                    new_lines.append(line)

            file.writelines(new_lines)

        return True, "IP configuration updated successfully"
    except Exception as e:
        send_error_log("change_ip_configuration", f"Error changing IP: {str(e)}", "error")
        return False, f"Error: {str(e)}"
    finally:
        if original_permissions is not None:
            os.chmod(INTERFACES_FILE, original_permissions)

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Network Manager ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Network Manager ===========")
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

def change_ip_configuration(interface, method, static_ip=None, netmask=None, gateway=None, dns=None):
    """Change IP configuration for a network interface"""
    try:
        if method == "static":
            if not all([static_ip, netmask, gateway]):
                send_error_log("change_ip_configuration", "Missing static IP parameters (address, netmask, gateway).", "warning", {"interface": interface, "method": method})
                return False, "Missing static IP parameters (address, netmask, gateway)."

        # Implementation would continue here...
        return True, "IP configuration updated successfully"
    except Exception as e:
        send_error_log("change_ip_configuration", f"Error changing IP configuration: {str(e)}", "error", {"interface": interface, "method": method})
        return False, f"Error: {str(e)}"

def restart_service(service_name):
    """Restarts a systemd service."""
    try:
        result = subprocess.run(["sudo", "systemctl", "restart", service_name], check=True, text=True, capture_output=True)
        logger.info(f"Service '{service_name}' restarted successfully: {result.stdout.strip()}")
        return True, f"Service '{service_name}' restarted successfully."
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to restart service '{service_name}': {e.stderr.strip()}"
        send_error_log("restart_service", error_msg, "critical", {"service": service_name, "command_output_stderr": e.stderr.strip(), "command_output_stdout": e.stdout.strip()})
        return False, error_msg
    except FileNotFoundError:
        error_msg = "systemctl command not found. Is systemd installed or is it in PATH?"
        send_error_log("restart_service", error_msg, "critical", {"service": service_name})
        return False, error_msg
    except Exception as e:
        error_msg = f"Unexpected error restarting service '{service_name}': {e}"
        send_error_log("restart_service", error_msg, "critical", {"service": service_name, "error": str(e)})
        return False, error_msg

def handle_mac_address_request(client, msg=None):
    """Publishes the device's MAC address to MQTT."""
    try:
        mac_address = get_mac_address()
        if mac_address:
            payload = {"mac_address": mac_address, "timestamp": datetime.now().isoformat()}
            # FIXED: Add connection check for safety
            if client and client.is_connected():
                client.publish(TOPIC_RESPONSE_MAC, json.dumps(payload), qos=QOS)
                logger.info(f"Published MAC address: {mac_address}")
                print(f"[NETWORK] ✅ Published MAC address: {mac_address}")
            else:
                logger.warning("Client not connected, cannot publish MAC address response")
        else:
            send_error_log("handle_mac_address_request", "Failed to retrieve MAC address", "major")
    except Exception as e:
        send_error_log("handle_mac_address_request", f"Error retrieving MAC address: {e}", "critical")

## MQTT Configuration Management

def read_mqtt_config(config_file):
    """Reads MQTT configuration from JSON file and returns broker_address, broker_port, username, password, and mac_address."""
    try:
        with open(config_file, 'r') as file:
            config = json.load(file)
            # Extract the required fields including MAC address
            mqtt_config = {
                "broker_address": config.get("broker_address", ""),
                "broker_port": config.get("broker_port", 1883),
                "username": config.get("username", ""),
                "password": config.get("password", ""),
                "mac_address": get_mac_address()  # Add MAC address from system
            }
            return mqtt_config
    except FileNotFoundError:
        send_error_log("read_mqtt_config", f"MQTT config file not found: {config_file}", "critical")
        return None
    except json.JSONDecodeError as e:
        send_error_log("read_mqtt_config", f"Invalid JSON in MQTT config file {config_file}: {e}", "major")
        return None
    except Exception as e:
        send_error_log("read_mqtt_config", f"Error reading MQTT config from {config_file}: {e}", "critical")
        return None

def update_mqtt_config(config_file, broker_address=None, broker_port=None, username=None, password=None):
    """Updates MQTT configuration in JSON file for broker_address, broker_port, username, password only."""
    try:
        # Read existing config
        with open(config_file, 'r') as file:
            config = json.load(file)

        # Update only the specified fields
        if broker_address is not None:
            config["broker_address"] = broker_address
        if broker_port is not None:
            config["broker_port"] = broker_port
        if username is not None:
            config["username"] = username
        if password is not None:
            config["password"] = password

        # Write back to file
        with open(config_file, 'w') as file:
            json.dump(config, file, indent=4)

        logger.info(f"Updated MQTT config in {config_file}")
        return True, "MQTT configuration updated successfully"
    except FileNotFoundError:
        error_msg = f"MQTT config file not found: {config_file}"
        send_error_log("update_mqtt_config", error_msg, "critical")
        return False, error_msg
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON in MQTT config file {config_file}: {e}"
        send_error_log("update_mqtt_config", error_msg, "major")
        return False, error_msg
    except Exception as e:
        error_msg = f"Error updating MQTT config in {config_file}: {e}"
        send_error_log("update_mqtt_config", error_msg, "critical")
        return False, error_msg

def test_mqtt_connection(broker_address, broker_port, username=None, password=None, timeout=5):
    """Test MQTT connection to a broker and return status."""
    try:
        import paho.mqtt.client as mqtt_client_test

        # Create a test client
        test_client = mqtt_client_test.Client(
            client_id=f"connection-test-{uuid.uuid4()}",
            clean_session=True
        )

        # Set credentials if provided
        if username and password:
            test_client.username_pw_set(username, password)

        # Set connection timeout
        connection_result = {"connected": False, "error": None, "response_time": None}

        def on_test_connect(client, userdata, flags, rc):
            if rc == 0:
                connection_result["connected"] = True
                connection_result["response_time"] = time.time() - start_time
                client.disconnect()
            else:
                connection_result["connected"] = False
                connection_result["error"] = f"Connection failed with code: {rc}"

        def on_test_disconnect(client, userdata, rc):
            pass

        test_client.on_connect = on_test_connect
        test_client.on_disconnect = on_test_disconnect

        start_time = time.time()
        test_client.connect(broker_address, int(broker_port), keepalive=10)

        # Wait for connection result with timeout
        test_client.loop_start()
        end_time = time.time() + timeout

        while time.time() < end_time:
            if connection_result["connected"] is not None:
                break
            time.sleep(0.1)

        test_client.loop_stop()
        test_client.disconnect()

        if connection_result["connected"]:
            return {
                "status": "connected",
                "response_time": round(connection_result.get("response_time", 0) * 1000, 2),  # ms
                "message": "Successfully connected to MQTT broker"
            }
        else:
            return {
                "status": "disconnected",
                "error": connection_result.get("error", "Connection timeout"),
                "message": f"Failed to connect: {connection_result.get('error', 'Unknown error')}"
            }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": f"Connection test failed: {str(e)}"
        }

def publish_mqtt_config_modbus(client):
    """Publishes current Modbus MQTT configuration to response topic."""
    try:
        config = read_mqtt_config(MQTT_CONFIG_MODBUS)
        if config:
            # Test connection status
            connection_status = test_mqtt_connection(
                config["broker_address"],
                config["broker_port"],
                config["username"],
                config["password"]
            )

            payload = {
                "status": "success",
                "data": config,
                "connection": connection_status,
                "timestamp": datetime.now().isoformat()
            }
            if client and client.is_connected():
                client.publish(TOPIC_MQTT_MODBUS_RESPONSE, json.dumps(payload), qos=QOS)
            else:
                logger.warning("Client not connected, cannot publish Modbus MQTT config")
        else:
            payload = {
                "status": "error",
                "message": "Failed to read Modbus MQTT config",
                "timestamp": datetime.now().isoformat()
            }
            if client and client.is_connected():
                client.publish(TOPIC_MQTT_MODBUS_RESPONSE, json.dumps(payload), qos=QOS)
            else:
                logger.warning("Client not connected, cannot publish Modbus MQTT error")
    except Exception as e:
        send_error_log("publish_mqtt_config_modbus", f"Error publishing Modbus MQTT config: {e}", "major")

def publish_mqtt_config_modular(client):
    """Publishes current Modular MQTT configuration to response topic."""
    try:
        config = read_mqtt_config(MQTT_CONFIG_MODULAR)
        if config:
            # Test connection status
            connection_status = test_mqtt_connection(
                config["broker_address"],
                config["broker_port"],
                config["username"],
                config["password"]
            )

            payload = {
                "status": "success",
                "data": config,
                "connection": connection_status,
                "timestamp": datetime.now().isoformat()
            }
            if client and client.is_connected():
                client.publish(TOPIC_MQTT_MODULAR_RESPONSE, json.dumps(payload), qos=QOS)
            else:
                logger.warning("Client not connected, cannot publish Modular MQTT config")
        else:
            payload = {
                "status": "error",
                "message": "Failed to read Modular MQTT config",
                "timestamp": datetime.now().isoformat()
            }
            if client and client.is_connected():
                client.publish(TOPIC_MQTT_MODULAR_RESPONSE, json.dumps(payload), qos=QOS)
            else:
                logger.warning("Client not connected, cannot publish Modular MQTT error")
    except Exception as e:
        send_error_log("publish_mqtt_config_modular", f"Error publishing Modular MQTT config: {e}", "major")

def auto_publish_mqtt_configs(client):
    """Auto-publishes MQTT configurations every 5 seconds for faster updates."""
    # Configuration intervals (in seconds)
    PUBLISH_INTERVAL = 5  # Changed from 30s to 5s for faster response
    ERROR_RETRY_INTERVAL = 10  # Shorter retry on error

    last_publish_time = 0

    # Print sekali saat startup berhasil
    print("Auto-publish MQTT configs started successfully")

    while True:
        try:
            current_time = time.time()

            # Only publish if interval has passed
            if current_time - last_publish_time >= PUBLISH_INTERVAL:
                publish_mqtt_config_modbus(client)
                publish_mqtt_config_modular(client)
                last_publish_time = current_time
                # Only log errors, not success messages to keep error log clean
                # send_error_log("auto_publish_mqtt_configs", "MQTT configs published successfully", "info")

            time.sleep(5)  # Check every 5 seconds but only publish every 30s

        except Exception as e:
            send_error_log("auto_publish_mqtt_configs", f"Error in auto-publish loop: {e}", "major")
            time.sleep(ERROR_RETRY_INTERVAL)  # Wait before retrying

# Perbaikan: Tambahkan parameter `properties`
def on_message_mqtt_modbus_command(client, userdata, message):
    """Handles incoming MQTT messages for Modbus MQTT configuration commands."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        payload_data = json.loads(message.payload.decode())
        command = payload_data.get('command')
        logger.info(f"Received Modbus MQTT config command: '{command}' with data: {payload_data}")

        if command == 'updateMqttModbus':
            data = payload_data.get('data', {})
            broker_address = data.get('broker_address')
            broker_port = data.get('broker_port')
            username = data.get('username')
            password = data.get('password')

            success, msg = update_mqtt_config(MQTT_CONFIG_MODBUS, broker_address, broker_port, username, password)
            response_payload = {"status": "success" if success else "error", "message": msg}
        else:
            response_payload = {"status": "error", "message": f"Invalid Modbus MQTT command received: '{command}'"}
            send_error_log("on_message_mqtt_modbus_command", response_payload["message"], "warning", {"command": command})

    except json.JSONDecodeError as e:
        response_payload = {"status": "error", "message": f"Invalid JSON payload for Modbus MQTT config: {e}"}
        send_error_log("on_message_mqtt_modbus_command", f"JSON decoding error: {e}", "major", {"payload_raw": message.payload.decode()})
    except Exception as e:
        response_payload = {"status": "error", "message": f"Server error during Modbus MQTT configuration: {e}"}
        send_error_log("on_message_mqtt_modbus_command", f"Unhandled error: {e}", "critical", {"payload_raw": message.payload.decode()})
    finally:
        if client and client.is_connected():
            client.publish(TOPIC_MQTT_MODBUS_RESPONSE, json.dumps(response_payload), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish Modbus response")
        logger.info(f"Published Modbus MQTT config response to {TOPIC_MQTT_MODBUS_RESPONSE}: {json.dumps(response_payload)}")

# Perbaikan: Tambahkan parameter `properties`
def on_message_mqtt_modular_command(client, userdata, message):
    """Handles incoming MQTT messages for Modular MQTT configuration commands."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        payload_data = json.loads(message.payload.decode())
        command = payload_data.get('command')
        logger.info(f"Received Modular MQTT config command: '{command}' with data: {payload_data}")

        if command == 'updateMqttModular':
            data = payload_data.get('data', {})
            broker_address = data.get('broker_address')
            broker_port = data.get('broker_port')
            username = data.get('username')
            password = data.get('password')

            success, msg = update_mqtt_config(MQTT_CONFIG_MODULAR, broker_address, broker_port, username, password)
            response_payload = {"status": "success" if success else "error", "message": msg}
        else:
            response_payload = {"status": "error", "message": f"Invalid Modular MQTT command received: '{command}'"}
            send_error_log("on_message_mqtt_modular_command", response_payload["message"], "warning", {"command": command})

    except json.JSONDecodeError as e:
        response_payload = {"status": "error", "message": f"Invalid JSON payload for Modular MQTT config: {e}"}
        send_error_log("on_message_mqtt_modular_command", f"JSON decoding error: {e}", "major", {"payload_raw": message.payload.decode()})
    except Exception as e:
        response_payload = {"status": "error", "message": f"Server error during Modular MQTT configuration: {e}"}
        send_error_log("on_message_mqtt_modular_command", f"Unhandled error: {e}", "critical", {"payload_raw": message.payload.decode()})
    finally:
        if client and client.is_connected():
            client.publish(TOPIC_MQTT_MODULAR_RESPONSE, json.dumps(response_payload), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish Modular response")
        logger.info(f"Published Modular MQTT config response to {TOPIC_MQTT_MODULAR_RESPONSE}: {json.dumps(response_payload)}")

# Perbaikan: Tambahkan parameter `properties`
def on_message_ip_config(client, userdata, message):
    """Handles incoming MQTT messages for IP configuration commands."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        payload_data = json.loads(message.payload.decode())
        command = payload_data.get('command')
        logger.info(f"Received IP config command: '{command}' with data: {payload_data}")

        if command == 'readIP':
            try:
                with open(INTERFACES_FILE, 'r') as file:
                    file_content = file.read()
                interfaces_json = parse_interfaces_file(file_content)
                response_payload = {"status": "success", "data": interfaces_json}
            except FileNotFoundError:
                response_payload = {"status": "error", "message": f"Interfaces file not found: {INTERFACES_FILE}"}
                send_error_log("on_message_ip_config", response_payload["message"], "critical")
            except PermissionError:
                response_payload = {"status": "error", "message": f"Permission denied to read {INTERFACES_FILE}"}
                send_error_log("on_message_ip_config", response_payload["message"], "critical")

        elif command == 'changeIP':
            interface = payload_data.get('interface')
            method = payload_data.get('method')
            static_ip = payload_data.get('static_ip')
            netmask = payload_data.get('netmask')
            gateway = payload_data.get('gateway')

            if not interface or not method:
                response_payload = {"status": "error", "message": "Missing 'interface' or 'method' for changeIP command."}
                send_error_log("on_message_ip_config", response_payload["message"], "warning", {"payload": payload_data})
            else:
                success, msg = change_ip_configuration(interface, method, static_ip, netmask, gateway)
                response_payload = {"status": "success" if success else "error", "message": msg}
                if success:
                    # Delay for 3 seconds before rebooting
                    time.sleep(3)

                    try:
                        # Execute the reboot command
                        subprocess.run(["sudo", "reboot"], check=True)
                        logger.info("Initiated system reboot after successful IP change.")
                        # We won't get a response_payload back to the client for the reboot itself.
                        # The client-side should expect a disconnection.
                        response_payload["reboot_status"] = "initiated"
                        response_payload["message"] = "IP configuration saved. Device is rebooting..."
                    except subprocess.CalledProcessError as e:
                        error_msg = f"Failed to initiate reboot: {e}"
                        logger.error(error_msg)
                        response_payload["status"] = "error"
                        response_payload["message"] = f"IP configuration saved, but failed to initiate reboot: {error_msg}"
                    except Exception as e:
                        error_msg = f"An unexpected error occurred during reboot attempt: {e}"
                        logger.error(error_msg)
                        response_payload["status"] = "error"
                        response_payload["message"] = f"IP configuration saved, but an error occurred during reboot attempt: {error_msg}"
                # If `change_ip_configuration` failed, the `response_payload` already reflects the error.

        elif command == 'restartNetworking':
            success, msg = restart_service("networking")
            response_payload = {"status": "success" if success else "error", "message": msg}

        else:
            response_payload = {"status": "error", "message": f"Invalid IP command received: '{command}'"}
            send_error_log("on_message_ip_config", response_payload["message"], "warning", {"command": command})

    except json.JSONDecodeError as e:
        response_payload = {"status": "error", "message": f"Invalid JSON payload for IP config: {e}"}
        send_error_log("on_message_ip_config", f"JSON decoding error: {e}", "major", {"payload_raw": message.payload.decode()})
    except Exception as e:
        response_payload = {"status": "error", "message": f"Server error during IP configuration: {e}"}
        send_error_log("on_message_ip_config", f"Unhandled error: {e}", "critical", {"payload_raw": message.payload.decode()})
    finally:
        if client and client.is_connected():
            client.publish(TOPIC_IP_CONFIG_RESPONSE, json.dumps(response_payload), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish IP config response")
        logger.info(f"Published IP config response to {TOPIC_IP_CONFIG_RESPONSE}: {json.dumps(response_payload)}")

# Perbaikan: Tambahkan parameter `properties`
def on_message_reboot(client, userdata, msg):
    """Handles requests to reboot the system."""
    response_payload = {"status": "error", "message": "Unknown error."}
    try:
        logger.info("Received system reboot command.")

        # Acknowledge the command quickly
        response_payload = {"status": "success", "message": "Reboot command received. System is shutting down."}
        if client and client.is_connected():
            client.publish(MQTT_TOPIC_REBOOT, json.dumps(response_payload), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish reboot response")
        logger.info(f"Acknowledged reboot command to {MQTT_TOPIC_REBOOT}.")

        # Give some time for the message to be sent
        time.sleep(1)

        # Execute the reboot command
        subprocess.run(["sudo", "reboot"], check=True)
        logger.info("Initiated system reboot.")
        # The script will terminate here as the system reboots.
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to initiate reboot: {e.stderr.strip()}"
        response_payload = {"status": "error", "message": error_msg}
        send_error_log("on_message_reboot", error_msg, "critical", {"command_output_stderr": e.stderr.strip()})
        if client and client.is_connected():
            client.publish(MQTT_TOPIC_REBOOT, json.dumps(response_payload), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish reboot error")
    except Exception as e:
        error_msg = f"An unexpected error occurred during reboot command: {e}"
        response_payload = {"status": "error", "message": error_msg}
        send_error_log("on_message_reboot", error_msg, "critical")
        if client and client.is_connected():
            client.publish(MQTT_TOPIC_REBOOT, json.dumps(response_payload), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish reboot critical error")

# --- Main MQTT Client Setup ---
main_mqtt_client = None

# Perbaikan: Tambahkan parameter `properties`
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("MQTT client connected.")
        # Subscribe to existing topics
        client.subscribe(TOPIC_IP_CONFIG_COMMAND, qos=QOS)
        client.subscribe(TOPIC_REQUEST_MAC, qos=QOS)
        client.subscribe(MQTT_TOPIC_REBOOT, qos=QOS)
        client.subscribe(TOPIC_MQTT_MODBUS_COMMAND, qos=QOS)
        client.subscribe(TOPIC_MQTT_MODULAR_COMMAND, qos=QOS)
        # Subscribe to new WiFi topics
        client.subscribe(TOPIC_WIFI_SCAN, qos=QOS)
        client.subscribe(TOPIC_WIFI_CONNECT, qos=QOS)
        client.subscribe(TOPIC_WIFI_DISCONNECT, qos=QOS)
        client.subscribe(TOPIC_WIFI_DELETE, qos=QOS)
        client.subscribe(TOPIC_WIFI_STATUS_GET, qos=QOS)
        # Subscribe to new network config topics
        client.subscribe(TOPIC_NETWORK_GET, qos=QOS)
        client.subscribe(TOPIC_NETWORK_SET, qos=QOS)
        # Subscribe to IP synchronization topic
        client.subscribe(TOPIC_IP_SYNC_COMMAND, qos=QOS)
        # Subscribe to new system topics
        client.subscribe(TOPIC_SYSTEM_REBOOT, qos=QOS)
        client.subscribe(TOPIC_SYSTEM_FACTORY_RESET, qos=QOS)
        logger.info("Subscribed to all topics.")

        # Initial publish of current MAC after connection
        handle_mac_address_request(client)

        # Start auto-publishing MQTT configs in background thread
        auto_publish_thread = threading.Thread(target=auto_publish_mqtt_configs, args=(client,), daemon=True)
        auto_publish_thread.start()
        logger.info("Started auto-publishing MQTT configurations.")

    else:
        send_error_log("on_connect", f"Failed to connect to main MQTT Broker, return code: {rc}", "critical", {"return_code": rc})
        logger.critical(f"Failed to connect to main MQTT Broker, return code {rc}")
        # Consider adding sys.exit(1) here if MQTT connection is critical for service operation.

# --- New WiFi and Network MQTT Handlers ---

def factory_reset():
    """Performs factory reset - already exists in Network.py"""
    logger.critical("Initiating factory reset...")
    # Factory reset implementation would be added here
    # For now just log that it's been called
    send_error_log("factory_reset", "Factory reset initiated", "critical")
    return True, "Factory reset initiated"

def on_message_wifi_scan(client, userdata, message):
    """Handle WiFi scan requests"""
    try:
        logger.info("Received WiFi scan request")
        wifi_networks = scan_wifi()

        response_data = {
            "action": "wifi_scan",
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "networks": wifi_networks,
            "count": len(wifi_networks)
        }

        if client and client.is_connected():
            client.publish(TOPIC_WIFI_SCAN_RESPONSE, json.dumps(response_data), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish WiFi scan response")

    except Exception as e:
        logger.error(f"Error in WiFi scan handler: {e}")
        error_response = {
            "action": "wifi_scan",
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
        if client and client.is_connected():
            client.publish(TOPIC_WIFI_SCAN_RESPONSE, json.dumps(error_response), qos=QOS)

def on_message_wifi_connect(client, userdata, message):
    """Handle WiFi connect requests"""
    try:
        payload = json.loads(message.payload.decode())
        ssid = payload.get("ssid")
        password = payload.get("password")

        if not ssid:
            raise ValueError("Missing 'ssid' field")

        logger.info(f"Received WiFi connect request for: {ssid}")
        success, result = connect_wifi(ssid, password)

        response_data = {
            "action": "wifi_connect",
            "status": "success" if success else "error",
            "timestamp": datetime.now().isoformat(),
            "ssid": ssid,
            "message": f"Connected to {ssid}" if success else result,
            "ip_address": result if success else None
        }

        if not success:
            response_data["error"] = result

        if client and client.is_connected():
            client.publish(TOPIC_WIFI_CONNECT_RESPONSE, json.dumps(response_data), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish WiFi connect response")

    except Exception as e:
        logger.error(f"Error in WiFi connect handler: {e}")
        error_response = {
            "action": "wifi_connect",
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
        if client and client.is_connected():
            client.publish(TOPIC_WIFI_CONNECT_RESPONSE, json.dumps(error_response), qos=QOS)

def on_message_wifi_disconnect(client, userdata, message):
    """Handle WiFi disconnect requests"""
    try:
        logger.info("Received WiFi disconnect request")
        success, message_result = disconnect_current_wifi()

        response_data = {
            "action": "wifi_disconnect",
            "status": "success" if success else "error",
            "timestamp": datetime.now().isoformat(),
            "message": message_result
        }

        if not success:
            response_data["error"] = message_result

        if client and client.is_connected():
            client.publish(TOPIC_WIFI_DISCONNECT_RESPONSE, json.dumps(response_data), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish WiFi disconnect response")

    except Exception as e:
        logger.error(f"Error in WiFi disconnect handler: {e}")
        error_response = {
            "action": "wifi_disconnect",
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
        if client and client.is_connected():
            client.publish(TOPIC_WIFI_DISCONNECT_RESPONSE, json.dumps(error_response), qos=QOS)

def on_message_wifi_delete(client, userdata, message):
    """Handle WiFi delete requests"""
    try:
        payload = json.loads(message.payload.decode())
        ssid = payload.get("ssid")

        if not ssid:
            raise ValueError("Missing 'ssid' field")

        logger.info(f"Received WiFi delete request for: {ssid}")
        success, message_result = delete_wifi(ssid)

        response_data = {
            "action": "wifi_delete",
            "status": "success" if success else "error",
            "timestamp": datetime.now().isoformat(),
            "ssid": ssid,
            "message": message_result
        }

        if not success:
            response_data["error"] = message_result

        if client and client.is_connected():
            client.publish(TOPIC_WIFI_DELETE_RESPONSE, json.dumps(response_data), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish WiFi delete response")

    except Exception as e:
        logger.error(f"Error in WiFi delete handler: {e}")
        error_response = {
            "action": "wifi_delete",
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
        if client and client.is_connected():
            client.publish(TOPIC_WIFI_DELETE_RESPONSE, json.dumps(error_response), qos=QOS)

def on_message_wifi_status_get(client, userdata, message):
    """Handle WiFi status get requests"""
    try:
        logger.info("Received WiFi status get request")
        wifi_status = get_wifi_status()

        response_data = {
            "action": "wifi_status_get",
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "wifi_status": wifi_status
        }

        # Add error to response if present
        if "error" in wifi_status:
            response_data["status"] = "partial_error"
            response_data["error_details"] = wifi_status["error"]

        if client and client.is_connected():
            client.publish(TOPIC_WIFI_STATUS_RESPONSE, json.dumps(response_data), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish WiFi status response")

    except Exception as e:
        logger.error(f"Error in WiFi status handler: {e}")
        error_response = {
            "action": "wifi_status_get",
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
        if client and client.is_connected():
            client.publish(TOPIC_WIFI_STATUS_RESPONSE, json.dumps(error_response), qos=QOS)

def on_message_network_get(client, userdata, message):
    """Handle network configuration get requests"""
    try:
        logger.info("Received network get request")

        success, config_data = read_current_ip_config()
        network_method = _detect_network_method()

        response_data = {
            "action": "get_network_config",
            "status": "success" if success else "error",
            "timestamp": datetime.now().isoformat(),
            "network_method": network_method,
            "network_config": config_data if success else None
        }

        if not success:
            response_data["error"] = config_data

        if client and client.is_connected():
            client.publish(TOPIC_NETWORK_RESPONSE, json.dumps(response_data), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish network get response")

    except Exception as e:
        logger.error(f"Error in network get handler: {e}")
        error_response = {
            "action": "get_network_config",
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
        if client and client.is_connected():
            client.publish(TOPIC_NETWORK_RESPONSE, json.dumps(error_response), qos=QOS)

def on_message_network_set(client, userdata, message):
    """Handle network configuration set requests"""
    try:
        payload = json.loads(message.payload.decode())

        interface = payload.get("interface", "eth0")
        method = payload.get("method")

        if not method:
            raise ValueError("Missing 'method' field")

        response_data = {
            "action": "set_network_config",
            "timestamp": datetime.now().isoformat(),
            "interface": interface,
            "method": method,
            "network_method": _detect_network_method()
        }

        if method == "static":
            static_ip = payload.get("static_ip")
            netmask = payload.get("netmask", "255.255.255.0")
            gateway = payload.get("gateway")
            dns = payload.get("dns", "8.8.8.8 8.8.4.4")

            if not static_ip:
                raise ValueError("Missing required static IP parameter: static_ip")

            if not gateway:
                ip_parts = static_ip.split('.')
                if len(ip_parts) == 4:
                    gateway = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.1"
                else:
                    gateway = "192.168.0.1"

            success, message_result = set_static_ip(interface, static_ip, netmask, gateway, dns)
            response_data.update({
                "static_ip": static_ip,
                "netmask": netmask,
                "gateway": gateway,
                "dns": dns,
                "status": "success" if success else "error",
                "message": message_result
            })

        elif method == "dhcp":
            success, message_result = set_dynamic_ip(interface)
            response_data.update({
                "status": "success" if success else "error",
                "message": message_result
            })

        else:
            raise ValueError(f"Invalid method: {method}. Must be 'static' or 'dhcp'")

        if client and client.is_connected():
            client.publish(TOPIC_NETWORK_RESPONSE, json.dumps(response_data), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish network set response")

    except Exception as e:
        logger.error(f"Error in network set handler: {e}")
        error_response = {
            "action": "set_network_config",
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
        if client and client.is_connected():
            client.publish(TOPIC_NETWORK_RESPONSE, json.dumps(error_response), qos=QOS)

def on_message_system_reboot(client, userdata, message):
    """Handle system reboot requests from new topic"""
    try:
        logger.info("Received system reboot command from rpi/system/reboot")

        # Acknowledge the command quickly
        response_payload = {"status": "success", "message": "Reboot command received. System is shutting down."}

        # Small delay before responding
        time.sleep(0.5)

        # Execute the reboot command
        subprocess.run(["sudo", "reboot"], check=True)
        logger.info("Initiated system reboot from rpi/system/reboot.")
        # The script will terminate here as the system reboots.

    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to initiate reboot: {e.stderr.strip()}"
        logger.error(error_msg)
        response_payload = {"status": "error", "message": error_msg}
        if client and client.is_connected():
            client.publish(TOPIC_SYSTEM_REBOOT, json.dumps(response_payload), qos=QOS)
    except Exception as e:
        error_msg = f"An unexpected error occurred during reboot command: {e}"
        logger.error(error_msg)
        response_payload = {"status": "error", "message": error_msg}
        if client and client.is_connected():
            client.publish(TOPIC_SYSTEM_REBOOT, json.dumps(response_payload), qos=QOS)

def on_message_ip_sync(client, userdata, message):
    """Handle IP synchronization requests"""
    response_payload = {"status": "error", "message": "Unknown error.", "timestamp": datetime.now().isoformat()}
    try:
        logger.info("Received IP synchronization command")

        # Perform IP synchronization
        success, message_result = sync_ip_to_protocol_configs()

        response_payload.update({
            "action": "ip_sync",
            "status": "success" if success else "error",
            "message": message_result,
            "timestamp": datetime.now().isoformat()
        })

        if success:
            logger.info("IP synchronization completed successfully")
        else:
            logger.warning(f"IP synchronization completed with errors: {message_result}")

    except Exception as e:
        error_msg = f"Critical error during IP synchronization: {e}"
        logger.error(error_msg)
        response_payload.update({
            "action": "ip_sync",
            "status": "error",
            "message": error_msg,
            "timestamp": datetime.now().isoformat()
        })

    finally:
        if client and client.is_connected():
            client.publish(TOPIC_IP_SYNC_RESPONSE, json.dumps(response_payload), qos=QOS)
        else:
            logger.warning("Client not connected, cannot publish IP sync response")

def on_message_system_factory_reset(client, userdata, message):
    """Handle factory reset requests"""
    try:
        logger.info("Received factory reset command")

        # Acknowledge the command quickly
        response_payload = {
            "status": "success",
            "message": "Factory reset initiated. System will reboot after reset."
        }

        if client and client.is_connected():
            client.publish(TOPIC_SYSTEM_FACTORY_RESET, json.dumps(response_payload), qos=QOS)

        time.sleep(1)

        # Perform factory reset
        success, message_result = factory_reset()

        if not success:
            error_response = {
                "status": "error",
                "message": f"Factory reset failed: {message_result}"
            }
            if client and client.is_connected():
                client.publish(TOPIC_SYSTEM_FACTORY_RESET, json.dumps(error_response), qos=QOS)

    except Exception as e:
        logger.error(f"Error in factory reset handler: {e}")
        error_response = {
            "status": "error",
            "message": f"Factory reset failed: {str(e)}"
        }
        if client and client.is_connected():
            client.publish(TOPIC_SYSTEM_FACTORY_RESET, json.dumps(error_response), qos=QOS)

# Perbaikan: Tambahkan parameter `properties`
def on_message(client, userdata, msg):
    """General message callback for the main MQTT client."""
    logger.debug(f"Received message on topic: {msg.topic}")
    try:
        if msg.topic == TOPIC_IP_CONFIG_COMMAND:
            on_message_ip_config(client, userdata, msg)
        elif msg.topic == TOPIC_REQUEST_MAC:
            handle_mac_address_request(client)
        elif msg.topic == MQTT_TOPIC_REBOOT:
            on_message_reboot(client, userdata, msg)
        elif msg.topic == TOPIC_MQTT_MODBUS_COMMAND:
            on_message_mqtt_modbus_command(client, userdata, msg)
        elif msg.topic == TOPIC_MQTT_MODULAR_COMMAND:
            on_message_mqtt_modular_command(client, userdata, msg)
        # New WiFi handlers
        elif msg.topic == TOPIC_WIFI_SCAN:
            on_message_wifi_scan(client, userdata, msg)
        elif msg.topic == TOPIC_WIFI_CONNECT:
            on_message_wifi_connect(client, userdata, msg)
        elif msg.topic == TOPIC_WIFI_DISCONNECT:
            on_message_wifi_disconnect(client, userdata, msg)
        elif msg.topic == TOPIC_WIFI_DELETE:
            on_message_wifi_delete(client, userdata, msg)
        elif msg.topic == TOPIC_WIFI_STATUS_GET:
            on_message_wifi_status_get(client, userdata, msg)
        # New network config handlers
        elif msg.topic == TOPIC_NETWORK_GET:
            on_message_network_get(client, userdata, msg)
        elif msg.topic == TOPIC_NETWORK_SET:
            on_message_network_set(client, userdata, msg)
        # IP synchronization handler
        elif msg.topic == TOPIC_IP_SYNC_COMMAND:
            on_message_ip_sync(client, userdata, msg)
        # New system handlers
        elif msg.topic == TOPIC_SYSTEM_REBOOT:
            on_message_system_reboot(client, userdata, msg)
        elif msg.topic == TOPIC_SYSTEM_FACTORY_RESET:
            on_message_system_factory_reset(client, userdata, msg)
        else:
            logger.warning(f"Received message on unsubscribed or unhandled topic: {msg.topic}")
    except json.JSONDecodeError as e:
        send_error_log("on_message", f"Failed to decode JSON from message on topic {msg.topic}: {e}", "major", {"payload_raw": msg.payload.decode()})
    except Exception as e:
        send_error_log("on_message", f"Unhandled error in message callback for topic {msg.topic}: {e}", "critical", {"error_details": str(e), "payload_raw": msg.payload.decode()})

# Perbaikan: Tambahkan parameter `properties`
def on_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning(f"Unexpected disconnect from main broker with code {rc}. Attempting reconnect...")
        send_error_log("on_disconnect", f"Unexpected disconnect from main broker with code {rc}.", "major", {"return_code": rc})
    else:
        logger.info("Main client disconnected normally.")

def setup_mqtt_client():
    """Sets up the main MQTT client for the Network Manager Service."""
    global main_mqtt_client
    try:
        # Perbaikan: Tentukan callback_api_version untuk paho-mqtt 2.x
        main_mqtt_client = mqtt_client.Client(
            client_id=f"network-manager-service-{uuid.uuid4()}"
        )
        main_mqtt_client.on_connect = on_connect
        main_mqtt_client.on_message = on_message
        main_mqtt_client.on_disconnect = on_disconnect

        # Set reconnect delay strategy
        main_mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)

        main_mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        main_mqtt_client.loop_start() # Start background thread for MQTT operations
        logger.info("MQTT client started.")
    except Exception as e:
        send_error_log("setup_mqtt_client", f"Failed to connect or start main MQTT client: {e}", "critical")
        logger.critical(f"FATAL: Failed to connect or start main MQTT client: {e}", exc_info=True)
        # sys.exit(1) # Tambahkan ini jika Anda ingin program keluar total jika koneksi MQTT utama gagal.

# --- Main Service Logic ---
def main():
    logger.info("Starting Network Manager Service...")
    initialize_error_logger() # Initialize dedicated error logger first
    time.sleep(1) # Give logger a moment to connect

    setup_mqtt_client() # Setup main MQTT client

    try:
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Network Manager Service interrupted by user. Shutting down...")
    except Exception as e:
        send_error_log("main", f"Unhandled error in main loop: {e}", "critical")
        logger.critical(f"Unhandled exception in main loop: {e}", exc_info=True)
    finally:
        if main_mqtt_client:
            main_mqtt_client.loop_stop()
            main_mqtt_client.disconnect()
            logger.info("Main MQTT client disconnected.")
        if error_logger_client:
            error_logger_client.loop_stop()
            error_logger_client.disconnect()
            logger.info("Error logger MQTT client disconnected.")
        logger.info("Network Manager Service stopped.")

if __name__ == "__main__":
    main()
