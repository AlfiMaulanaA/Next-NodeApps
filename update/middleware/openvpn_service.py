# vpn.py
import paho.mqtt.client as mqtt
import json
import subprocess
import os
import threading
import time
import re
from datetime import datetime
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# MQTT Configuration
MQTT_BROKER = "18.143.215.113"
MQTT_PORT = 1883
MQTT_USERNAME = ""  # Optional
MQTT_PASSWORD = ""  # Optional

# Topics
TOPIC_VPN_REQUEST = "vpn/openvpn/request"
TOPIC_VPN_CONFIG = "vpn/openvpn/config"
TOPIC_VPN_UPDATE = "vpn/openvpn/update"
TOPIC_VPN_COMMAND = "vpn/openvpn/command"
TOPIC_VPN_STATUS = "vpn/openvpn/status"
TOPIC_VPN_RESPONSE = "vpn/openvpn/response"
# Di bagian Topics, tambahkan:
TOPIC_VPN_UPLOAD = "vpn/openvpn/upload"

# File paths - Auto-detect base directory
def get_base_dir():
    """Auto-detect base directory from environment or use home directory"""
    env_base = os.getenv('VPN_BASE_DIR')
    if env_base and os.path.isdir(env_base):
        return env_base
    return os.path.expanduser('~')

BASE_DIR = get_base_dir()
CONFIG_DIR = os.path.join(BASE_DIR, "vpn", "openvpn")
ACTIVE_CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
OVPN_FILE = os.path.join(CONFIG_DIR, "subrack.ovpn")

# Global variables
current_config = None
vpn_process = None
monitoring_thread = None
is_monitoring = False

# Initialize directories
os.makedirs(CONFIG_DIR, exist_ok=True)


def create_default_ovpn_template():
    """Generate default .ovpn template jika file tidak ada"""
    template = """##############################################
# OpenVPN Client Configuration Template
# Please edit the configuration below
##############################################

client
dev tun
proto udp

# EDIT THIS: Replace with your VPN server address and port
remote YOUR_VPN_SERVER_HERE 1194

resolv-retry infinite
nobind
persist-key
persist-tun

# Uncomment if using username/password authentication
;auth-user-pass

# Security settings
cipher AES-256-GCM
auth SHA256
remote-cert-tls server

# Compression (uncomment if needed)
;comp-lzo

verb 3

# Certificates - Replace with your actual certificates
<ca>
-----BEGIN CERTIFICATE-----
PASTE_YOUR_CA_CERTIFICATE_HERE
-----END CERTIFICATE-----
</ca>

<cert>
-----BEGIN CERTIFICATE-----
PASTE_YOUR_CLIENT_CERTIFICATE_HERE
-----END CERTIFICATE-----
</cert>

<key>
-----BEGIN PRIVATE KEY-----
PASTE_YOUR_CLIENT_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----
</key>

# Optional: TLS-Crypt key
;<tls-crypt>
;-----BEGIN OpenVPN Static key V1-----
;PASTE_YOUR_TLS_CRYPT_KEY_HERE
;-----END OpenVPN Static key V1-----
;</tls-crypt>
"""
    
    try:
        with open(OVPN_FILE, 'w') as f:
            f.write(template)
        os.chmod(OVPN_FILE, 0o600)
        print(f"Created template: {OVPN_FILE}")
        return True
    except Exception as e:
        send_error_log("create_default_ovpn_template", f"Error creating template: {e}", ERROR_TYPE_MAJOR, {"file": OVPN_FILE})
        print(f"Error creating template: {e}")
        return False


def is_template_file(content):
    """Check if file is still a template (not configured yet)"""
    placeholders = [
        "YOUR_VPN_SERVER_HERE",
        "PASTE_YOUR_CA_CERTIFICATE_HERE",
        "PASTE_YOUR_CLIENT_CERTIFICATE_HERE",
        "PASTE_YOUR_CLIENT_PRIVATE_KEY_HERE"
    ]
    for placeholder in placeholders:
        if placeholder in content:
            return True
    return False


def parse_ovpn_file():
    """Parse existing .ovpn file untuk ambil semua info"""
    try:
        if not os.path.exists(OVPN_FILE):
            print(f"File not found: {OVPN_FILE}")
            return None
        
        info = {
            "config_name": "OpenVPN Client",
            "config_file": OVPN_FILE,
            "remote_host": "",
            "remote_port": 1194,
            "protocol": "udp",
            "cipher": "",
            "auth": "",
            "ca_certificate": "",
            "client_certificate": "",
            "client_key": "",
            "tls_crypt": "",
            "compression": False,
            "extra_options": ""
        }
        
        with open(OVPN_FILE, 'r') as f:
            content = f.read()
            
            # Check if it's a template
            if is_template_file(content):
                print("Detected template file (not configured yet)")
                info['is_template'] = True
                return info
            
            info['is_template'] = False
            lines = content.split('\n')
            
            # Parse line by line
            in_ca = False
            in_cert = False
            in_key = False
            in_tls = False
            ca_lines = []
            cert_lines = []
            key_lines = []
            tls_lines = []
            extra_lines = []
            
            for line in lines:
                line_stripped = line.strip()
                
                # Skip comments and empty lines
                if not line_stripped or line_stripped.startswith('#') or line_stripped.startswith(';'):
                    continue
                
                # Parse remote
                if line_stripped.startswith('remote '):
                    parts = line_stripped.split()
                    if len(parts) >= 3:
                        info['remote_host'] = parts[1]
                        try:
                            info['remote_port'] = int(parts[2])
                        except ValueError:
                            info['remote_port'] = 1194
                
                # Parse protocol
                elif line_stripped.startswith('proto '):
                    info['protocol'] = line_stripped.split()[1]
                
                # Parse cipher
                elif line_stripped.startswith('cipher '):
                    info['cipher'] = line_stripped.split()[1]
                
                # Parse auth
                elif line_stripped.startswith('auth '):
                    info['auth'] = line_stripped.split()[1]
                
                # Parse compression
                elif line_stripped.startswith('comp-lzo'):
                    info['compression'] = True
                
                # Parse certificates
                elif line_stripped == '<ca>':
                    in_ca = True
                elif line_stripped == '</ca>':
                    in_ca = False
                    info['ca_certificate'] = '\n'.join(ca_lines)
                elif in_ca:
                    ca_lines.append(line)
                
                elif line_stripped == '<cert>':
                    in_cert = True
                elif line_stripped == '</cert>':
                    in_cert = False
                    info['client_certificate'] = '\n'.join(cert_lines)
                elif in_cert:
                    cert_lines.append(line)
                
                elif line_stripped == '<key>':
                    in_key = True
                elif line_stripped == '</key>':
                    in_key = False
                    info['client_key'] = '\n'.join(key_lines)
                elif in_key:
                    key_lines.append(line)
                
                elif line_stripped == '<tls-crypt>' or line_stripped == '<tls-auth>':
                    in_tls = True
                elif line_stripped == '</tls-crypt>' or line_stripped == '</tls-auth>':
                    in_tls = False
                    info['tls_crypt'] = '\n'.join(tls_lines)
                elif in_tls:
                    tls_lines.append(line)
        
        # Validate required fields
        if not info['remote_host'] or info['remote_host'] == 'YOUR_VPN_SERVER_HERE':
            print("Warning: Remote host not configured")
            info['is_template'] = True
        
        print(f"Parsed .ovpn file successfully")
        print(f"Remote: {info['remote_host']}:{info['remote_port']}")
        print(f"Protocol: {info['protocol']}")
        print(f"Cipher: {info['cipher']}")
        print(f"Is Template: {info.get('is_template', False)}")
        
        return info

    except Exception as e:
        send_error_log("parse_ovpn_file", f"Error parsing .ovpn file: {e}", ERROR_TYPE_MAJOR, {"file": OVPN_FILE})
        print(f"Error parsing .ovpn: {e}")
        return None


def load_config():
    """Load active configuration from file"""
    global current_config
    try:
        if os.path.exists(ACTIVE_CONFIG_FILE):
            with open(ACTIVE_CONFIG_FILE, 'r') as f:
                current_config = json.load(f)
                print(f"Loaded config: {current_config.get('config_name', 'Unknown')}")
        else:
            # Check if .ovpn file exists
            if not os.path.exists(OVPN_FILE):
                print(f"File {OVPN_FILE} not found")
                print("Creating default template...")
                create_default_ovpn_template()
            
            # Parse from .ovpn file
            parsed = parse_ovpn_file()
            
            if parsed and not parsed.get('is_template', False) and parsed.get('remote_host'):
                # Valid configuration
                current_config = {
                    **parsed,
                    "enabled": False,
                    "status": "disconnected",
                    "vpn_ip": "",
                    "is_template": False
                }
                print("Valid configuration loaded")
            else:
                # Template or invalid config
                current_config = {
                    "enabled": False,
                    "config_name": "VPN Configuration (Template)",
                    "config_file": OVPN_FILE,
                    "remote_host": parsed.get('remote_host', 'YOUR_VPN_SERVER_HERE') if parsed else 'YOUR_VPN_SERVER_HERE',
                    "remote_port": parsed.get('remote_port', 1194) if parsed else 1194,
                    "protocol": parsed.get('protocol', 'udp') if parsed else 'udp',
                    "cipher": parsed.get('cipher', 'AES-256-GCM') if parsed else 'AES-256-GCM',
                    "auth": parsed.get('auth', 'SHA256') if parsed else 'SHA256',
                    "ca_certificate": parsed.get('ca_certificate', '') if parsed else '',
                    "client_certificate": parsed.get('client_certificate', '') if parsed else '',
                    "client_key": parsed.get('client_key', '') if parsed else '',
                    "tls_crypt": parsed.get('tls_crypt', '') if parsed else '',
                    "compression": parsed.get('compression', False) if parsed else False,
                    "status": "needs_config",
                    "vpn_ip": "",
                    "is_template": True,
                    "warning": "Please edit the configuration file with your VPN credentials"
                }
                print("Template configuration, needs editing")
            
            save_config()
    except Exception as e:
        send_error_log("load_config", f"Error loading config: {e}", ERROR_TYPE_MAJOR, {"config_file": ACTIVE_CONFIG_FILE})
        print(f"Error loading config: {e}")
        current_config = None


def save_config():
    """Save configuration to file"""
    try:
        with open(ACTIVE_CONFIG_FILE, 'w') as f:
            json.dump(current_config, f, indent=2)
        print("Config saved")
    except Exception as e:
        send_error_log("save_config", f"Error saving config: {e}", ERROR_TYPE_MAJOR, {"config_file": ACTIVE_CONFIG_FILE})
        print(f"Error saving config: {e}")


def generate_ovpn_from_config(config):
    """Generate .ovpn file from configuration data"""
    try:
        ovpn_content = f"""# OpenVPN Client Configuration
# Generated from UI configuration

client
dev tun
proto {config.get('protocol', 'udp')}
remote {config['remote_host']} {config['remote_port']}

resolv-retry infinite
nobind
persist-key
persist-tun

cipher {config.get('cipher', 'AES-256-GCM')}
auth {config.get('auth', 'SHA256')}
remote-cert-tls server

"""
        
        # Add compression if enabled
        if config.get('compression'):
            ovpn_content += "comp-lzo\n"
        
        ovpn_content += "\nverb 3\n\n"
        
        # Add certificates
        if config.get('ca_certificate'):
            ovpn_content += f"<ca>\n{config['ca_certificate']}\n</ca>\n\n"
        
        if config.get('client_certificate'):
            ovpn_content += f"<cert>\n{config['client_certificate']}\n</cert>\n\n"
        
        if config.get('client_key'):
            ovpn_content += f"<key>\n{config['client_key']}\n</key>\n\n"
        
        if config.get('tls_crypt'):
            ovpn_content += f"<tls-crypt>\n{config['tls_crypt']}\n</tls-crypt>\n\n"
        
        # Add extra options
        if config.get('extra_options'):
            ovpn_content += f"\n# Extra Options\n{config['extra_options']}\n"
        
        # Write to file
        with open(OVPN_FILE, 'w') as f:
            f.write(ovpn_content)
        
        os.chmod(OVPN_FILE, 0o600)
        print(f"Generated .ovpn file: {OVPN_FILE}")
        return True

    except Exception as e:
        send_error_log("generate_ovpn_from_config", f"Error generating .ovpn file: {e}", ERROR_TYPE_MAJOR, {"file": OVPN_FILE})
        print(f"Error generating .ovpn file: {e}")
        return False


def get_vpn_interface_info():
    """Get VPN interface info including name, IP, and stats"""
    try:
        # Find VPN interface (tun0, wg0, etc)
        result = subprocess.run(
            ['ip', 'addr', 'show'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        vpn_info = {
            "interface": "",
            "vpn_ip": "",
            "peer_ip": ""
        }
        
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            current_interface = None
            
            for line in lines:
                # Detect interface line (e.g., "11: tun0: <POINTOPOINT...")
                if ': tun' in line or ': wg' in line:
                    match = re.search(r'\d+:\s+(\w+):', line)
                    if match:
                        current_interface = match.group(1)
                        vpn_info["interface"] = current_interface
                
                # Get IP address for the interface
                if current_interface and 'inet ' in line and 'peer' in line:
                    # Format: "inet 10.8.0.54 peer 10.8.0.53/32"
                    match = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)\s+peer\s+(\d+\.\d+\.\d+\.\d+)', line)
                    if match:
                        vpn_info["vpn_ip"] = match.group(1)
                        vpn_info["peer_ip"] = match.group(2)
                        break
                elif current_interface and 'inet ' in line:
                    # Fallback format: "inet 10.8.0.54/24"
                    match = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)', line)
                    if match:
                        vpn_info["vpn_ip"] = match.group(1)
        
        return vpn_info

    except Exception as e:
        send_error_log("get_vpn_interface_info", f"Error getting VPN interface info: {e}", ERROR_TYPE_WARNING)
        print(f"Error getting VPN interface info: {e}")
        return {"interface": "", "vpn_ip": "", "peer_ip": ""}


def get_vpn_traffic():
    """Get VPN traffic statistics"""
    try:
        result = subprocess.run(
            ['ip', '-s', 'link', 'show', 'tun0'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            lines = result.stdout.split('\n')
            if len(lines) >= 6:
                rx_line = lines[3].strip().split()
                tx_line = lines[5].strip().split()
                return {
                    "bytes_received": int(rx_line[0]) if len(rx_line) > 0 else 0,
                    "bytes_sent": int(tx_line[0]) if len(tx_line) > 0 else 0
                }
        return {"bytes_received": 0, "bytes_sent": 0}
    except Exception as e:
        send_error_log("get_vpn_traffic", f"Error getting VPN traffic stats: {e}", ERROR_TYPE_WARNING)
        return {"bytes_received": 0, "bytes_sent": 0}


def check_vpn_process():
    """Check if OpenVPN process is running"""
    try:
        result = subprocess.run(
            ['pgrep', '-f', 'openvpn.*subrack'],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except Exception as e:
        send_error_log("check_vpn_process", f"Error checking VPN process: {e}", ERROR_TYPE_WARNING)
        return False


def monitor_vpn_status(client):
    """Monitor VPN connection status and publish updates"""
    global is_monitoring, current_config
    
    print("Starting VPN monitoring...")
    
    while is_monitoring:
        try:
            is_running = check_vpn_process()
            
            if is_running:
                # Get interface info
                vpn_interface = get_vpn_interface_info()
                
                # Get traffic stats
                traffic = get_vpn_traffic()
                
                status_data = {
                    "status": "connected" if vpn_interface["vpn_ip"] else "connecting",
                    "vpn_ip": vpn_interface["vpn_ip"],
                    "interface": vpn_interface["interface"],  # tun0, wg0, etc
                    "peer_ip": vpn_interface["peer_ip"],      # Server IP
                    "timestamp": datetime.now().isoformat(),
                    "bytes_sent": traffic["bytes_sent"],
                    "bytes_received": traffic["bytes_received"]
                }
                
                if current_config:
                    current_config["status"] = status_data["status"]
                    current_config["vpn_ip"] = vpn_interface["vpn_ip"]
                
                client.publish(TOPIC_VPN_STATUS, json.dumps(status_data))
                print(f"Status: {status_data['status']}, Interface: {vpn_interface['interface']}, IP: {vpn_interface['vpn_ip']}, RX: {traffic['bytes_received']}, TX: {traffic['bytes_sent']}")
            else:
                status_data = {
                    "status": "disconnected",
                    "vpn_ip": "",
                    "interface": "",
                    "peer_ip": "",
                    "timestamp": datetime.now().isoformat(),
                    "bytes_received": 0,
                    "bytes_sent": 0
                }
                
                if current_config:
                    current_config["status"] = "disconnected"
                    current_config["vpn_ip"] = ""
                
                client.publish(TOPIC_VPN_STATUS, json.dumps(status_data))
                print("Status: disconnected")
            
            time.sleep(5)

        except Exception as e:
            send_error_log("monitor_vpn_status", f"Error in monitoring: {e}", ERROR_TYPE_WARNING)
            print(f"Error in monitoring: {e}")
            time.sleep(5)

def connect_vpn(client):
    """Start OpenVPN connection"""
    global vpn_process, is_monitoring, monitoring_thread
    
    try:
        # Check if template
        if current_config and current_config.get('is_template'):
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Cannot connect: Configuration is not complete. Please edit the configuration first."
            }))
            return
        
        # Check if already connected
        if check_vpn_process():
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "VPN already connected"
            }))
            return

        # Check if .ovpn file exists
        if not os.path.exists(OVPN_FILE):
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": f"Configuration file not found: {OVPN_FILE}"
            }))
            return

        # Start OpenVPN process
        print(f"Starting OpenVPN with: {OVPN_FILE}")
        vpn_process = subprocess.Popen(
            ['sudo', 'openvpn', OVPN_FILE],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        # Start monitoring thread
        if not is_monitoring:
            is_monitoring = True
            monitoring_thread = threading.Thread(target=monitor_vpn_status, args=(client,))
            monitoring_thread.daemon = True
            monitoring_thread.start()

        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": True,
            "message": "VPN connection started"
        }))
        print("VPN connection initiated")

    except Exception as e:
        send_error_log("connect_vpn", f"Error connecting VPN: {e}", ERROR_TYPE_MAJOR)
        print(f"Error connecting VPN: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def disconnect_vpn(client):
    """Stop OpenVPN connection"""
    global vpn_process

    try:
        result = subprocess.run(
            ['sudo', 'pkill', '-f', 'openvpn.*subrack'],
            capture_output=True
        )

        vpn_process = None

        if current_config:
            current_config["status"] = "disconnected"
            current_config["vpn_ip"] = ""

        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": True,
            "message": "VPN disconnected"
        }))
        print("VPN disconnected")

    except Exception as e:
        send_error_log("disconnect_vpn", f"Error disconnecting VPN: {e}", ERROR_TYPE_MAJOR)
        print(f"Error disconnecting VPN: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def handle_upload_file(client, payload):
    """Handle uploaded .ovpn file"""
    try:
        file_content = payload.get('content', '')
        
        if not file_content:
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "File content is empty"
            }))
            return
        
        # Check if subrack.ovpn exists
        file_exists = os.path.exists(OVPN_FILE)
        
        # Write content to subrack.ovpn (create or replace)
        with open(OVPN_FILE, 'w') as f:
            f.write(file_content)
        
        os.chmod(OVPN_FILE, 0o600)
        
        # Parse the uploaded file
        parsed = parse_ovpn_file()
        
        if parsed and not parsed.get('is_template'):
            global current_config
            current_config = {
                **parsed,
                "enabled": False,
                "status": "disconnected",
                "vpn_ip": "",
                "is_template": False
            }
            save_config()
            
            action = "replaced" if file_exists else "created"
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": True,
                "message": f"File uploaded successfully and {action} as subrack.ovpn"
            }))
            client.publish(TOPIC_VPN_CONFIG, json.dumps(current_config))
            print(f"File uploaded and {action}: {OVPN_FILE}")
        else:
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Uploaded file is invalid or incomplete"
            }))

    except Exception as e:
        send_error_log("handle_upload_file", f"Error handling upload: {e}", ERROR_TYPE_MAJOR)
        print(f"Error handling upload: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))

def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        print("Connected to MQTT broker")
        
        client.subscribe(TOPIC_VPN_REQUEST)
        client.subscribe(TOPIC_VPN_UPDATE)
        client.subscribe(TOPIC_VPN_COMMAND)
        client.subscribe(TOPIC_VPN_UPLOAD)  # <- TAMBAH INI
        print("Subscribed to VPN topics")
        
    else:
        print(f"Connection failed with code {rc}")


def on_message(client, userdata, msg):
    """Callback when message received"""
    global current_config
    
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        print(f"Message from {topic}: {payload}")
        
        if topic == TOPIC_VPN_REQUEST:
            if payload.get('action') == 'getConfig':
                if current_config:
                    client.publish(TOPIC_VPN_CONFIG, json.dumps(current_config))
                    print("Sent current config")
        
        elif topic == TOPIC_VPN_UPDATE:
            if current_config:
                # Update config
                current_config.update(payload)
                
                # Remove template flag if config is complete
                if (payload.get('remote_host') and 
                    payload['remote_host'] != 'YOUR_VPN_SERVER_HERE' and
                    payload.get('ca_certificate') and
                    'PASTE_YOUR' not in payload.get('ca_certificate', '')):
                    current_config['is_template'] = False
                    current_config['status'] = 'disconnected'
                    current_config.pop('warning', None)
                    
                    # Generate new .ovpn file
                    if generate_ovpn_from_config(current_config):
                        print("Configuration updated and .ovpn file regenerated")
                
                save_config()
                
                client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                    "success": True,
                    "message": "Configuration updated successfully"
                }))
                client.publish(TOPIC_VPN_CONFIG, json.dumps(current_config))
                print("Configuration updated")
        
        elif topic == TOPIC_VPN_COMMAND:
            action = payload.get('action')
            if action == 'connect':
                connect_vpn(client)
            elif action == 'disconnect':
                disconnect_vpn(client)

        elif topic == TOPIC_VPN_UPLOAD:  # <- TAMBAH INI
            handle_upload_file(client, payload)

    except Exception as e:
        send_error_log("on_message", f"Error processing message: {e}", ERROR_TYPE_WARNING, {"topic": msg.topic})
        print(f"Error processing message: {e}")


def main():
    """Main function"""
    # Initialize error logger
    initialize_error_logger("OpenVPNService")

    print("Starting OpenVPN MQTT Middleware...")

    load_config()

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        print(f"Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
    except Exception as e:
        send_error_log("main", f"Failed to connect to MQTT broker: {e}", ERROR_TYPE_CRITICAL, {"broker": MQTT_BROKER, "port": MQTT_PORT})
        print(f"Failed to connect: {e}")
        return
    
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        global is_monitoring
        is_monitoring = False
        if vpn_process:
            try:
                subprocess.run(['sudo', 'pkill', '-f', 'openvpn.*subrack'])
            except:
                pass
        client.disconnect()


if __name__ == "__main__":
    main()
