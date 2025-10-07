# ikev2_service.py
import paho.mqtt.client as mqtt
import json
import subprocess
import os
import time
import re
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = "localhost"
MQTT_PORT = 1883

# Topics
TOPIC_VPN_REQUEST = "vpn/ikev2/request"
TOPIC_VPN_CONFIG = "vpn/ikev2/config"
TOPIC_VPN_UPDATE = "vpn/ikev2/update"
TOPIC_VPN_COMMAND = "vpn/ikev2/command"
TOPIC_VPN_STATUS = "vpn/ikev2/status"
TOPIC_VPN_RESPONSE = "vpn/ikev2/response"
TOPIC_VPN_UPLOAD = "vpn/ikev2/upload"

# File paths
BASE_DIR = "/home/bms"
CONFIG_DIR = os.path.join(BASE_DIR, "vpn_configs/ikev2")
ACTIVE_CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

# StrongSwan config files
IPSEC_CONF = "/etc/ipsec.conf"
IPSEC_SECRETS = "/etc/ipsec.secrets"

# Global variables
current_config = None
connection_name = "ikev2-client"

os.makedirs(CONFIG_DIR, exist_ok=True)


def create_default_config():
    """Generate default IKEv2 config template"""
    return {
        "enabled": False,
        "config_name": "IKEv2 VPN",
        "server_address": "",
        "auth_method": "psk",  # psk, cert, eap
        "local_id": "",
        "remote_id": "",
        "psk": "",  # Pre-shared key
        "username": "",
        "password": "",
        "ca_certificate": "",
        "client_certificate": "",
        "client_key": "",
        "ike_encryption": "aes256",
        "ike_integrity": "sha256",
        "esp_encryption": "aes256",
        "esp_integrity": "sha256",
        "dpd_interval": 30,
        "dpd_timeout": 150,
        "nat_traversal": True,
        "local_subnet": "0.0.0.0/0",
        "remote_subnet": "0.0.0.0/0",
        "status": "disconnected",
        "vpn_ip": "",
        "is_template": True,
        "warning": "Please configure IKEv2 connection settings"
    }


def load_config():
    """Load IKEv2 configuration"""
    global current_config
    try:
        if os.path.exists(ACTIVE_CONFIG_FILE):
            with open(ACTIVE_CONFIG_FILE, 'r') as f:
                current_config = json.load(f)
                print(f"[IKEv2] Loaded config: {current_config.get('config_name')}")
        else:
            current_config = create_default_config()
            save_config()
            print("[IKEv2] Created default config")
    except Exception as e:
        print(f"[IKEv2] Error loading config: {e}")
        current_config = create_default_config()


def save_config():
    """Save IKEv2 configuration"""
    try:
        with open(ACTIVE_CONFIG_FILE, 'w') as f:
            json.dump(current_config, f, indent=2)
        print("[IKEv2] Config saved")
    except Exception as e:
        print(f"[IKEv2] Error saving config: {e}")


def generate_ipsec_conf(config):
    """Generate /etc/ipsec.conf for IKEv2"""
    try:
        conn_config = f"""# IKEv2 Configuration
# Generated from UI

conn {connection_name}
    keyexchange=ikev2
    
    # Server settings
    right={config['server_address']}
    rightid={config.get('remote_id', config['server_address'])}
    
    # Client settings
    left=%defaultroute
    leftid={config.get('local_id', '%any')}
    
    # Subnets
    leftsubnet={config.get('local_subnet', '0.0.0.0/0')}
    rightsubnet={config.get('remote_subnet', '0.0.0.0/0')}
    
    # Authentication
"""
        
        if config['auth_method'] == 'psk':
            conn_config += f"""    leftauth=psk
    rightauth=psk
"""
        elif config['auth_method'] == 'cert':
            conn_config += f"""    leftauth=pubkey
    rightauth=pubkey
    leftcert=client.crt
"""
        elif config['auth_method'] == 'eap':
            conn_config += f"""    leftauth=eap-mschapv2
    rightauth=pubkey
    eap_identity={config.get('username', 'user')}
"""
        
        # Encryption & Integrity
        conn_config += f"""    
    # Encryption
    ike={config.get('ike_encryption', 'aes256')}-{config.get('ike_integrity', 'sha256')}-modp2048!
    esp={config.get('esp_encryption', 'aes256')}-{config.get('esp_integrity', 'sha256')}!
    
    # DPD
    dpdaction=restart
    dpddelay={config.get('dpd_interval', 30)}s
    dpdtimeout={config.get('dpd_timeout', 150)}s
    
    # Connection settings
    auto=add
    closeaction=restart
    fragmentation=yes
    rekey=yes
"""
        
        # Write to temp file first
        temp_conf = os.path.join(CONFIG_DIR, "ipsec.conf.tmp")
        with open(temp_conf, 'w') as f:
            f.write(conn_config)
        
        # Copy to /etc/ipsec.conf (requires sudo)
        subprocess.run(['sudo', 'cp', temp_conf, IPSEC_CONF], check=True)
        subprocess.run(['sudo', 'chmod', '644', IPSEC_CONF], check=True)
        
        print(f"[IKEv2] Generated ipsec.conf")
        return True
        
    except Exception as e:
        print(f"[IKEv2] Error generating ipsec.conf: {e}")
        return False


def generate_ipsec_secrets(config):
    """Generate /etc/ipsec.secrets for authentication"""
    try:
        secrets = ""
        
        if config['auth_method'] == 'psk':
            # Pre-shared key
            local_id = config.get('local_id', '%any')
            remote_id = config.get('remote_id', config['server_address'])
            psk = config.get('psk', '')
            secrets = f'{local_id} {remote_id} : PSK "{psk}"\n'
            
        elif config['auth_method'] == 'eap':
            # EAP username/password
            username = config.get('username', '')
            password = config.get('password', '')
            secrets = f'{username} : EAP "{password}"\n'
            
        elif config['auth_method'] == 'cert':
            # Certificate private key
            secrets = f': RSA client.key\n'
        
        # Write to temp file
        temp_secrets = os.path.join(CONFIG_DIR, "ipsec.secrets.tmp")
        with open(temp_secrets, 'w') as f:
            f.write(secrets)
        
        # Copy to /etc/ipsec.secrets (requires sudo)
        subprocess.run(['sudo', 'cp', temp_secrets, IPSEC_SECRETS], check=True)
        subprocess.run(['sudo', 'chmod', '600', IPSEC_SECRETS], check=True)
        
        print(f"[IKEv2] Generated ipsec.secrets")
        return True
        
    except Exception as e:
        print(f"[IKEv2] Error generating ipsec.secrets: {e}")
        return False


def save_certificates(config):
    """Save certificates to /etc/ipsec.d/"""
    try:
        if config['auth_method'] != 'cert':
            return True
        
        certs_dir = "/etc/ipsec.d"
        
        # Save CA certificate
        if config.get('ca_certificate'):
            ca_file = os.path.join(CONFIG_DIR, "ca.crt")
            with open(ca_file, 'w') as f:
                f.write(config['ca_certificate'])
            subprocess.run(['sudo', 'cp', ca_file, f"{certs_dir}/cacerts/ca.crt"], check=True)
        
        # Save client certificate
        if config.get('client_certificate'):
            cert_file = os.path.join(CONFIG_DIR, "client.crt")
            with open(cert_file, 'w') as f:
                f.write(config['client_certificate'])
            subprocess.run(['sudo', 'cp', cert_file, f"{certs_dir}/certs/client.crt"], check=True)
        
        # Save client private key
        if config.get('client_key'):
            key_file = os.path.join(CONFIG_DIR, "client.key")
            with open(key_file, 'w') as f:
                f.write(config['client_key'])
            subprocess.run(['sudo', 'cp', key_file, f"{certs_dir}/private/client.key"], check=True)
            subprocess.run(['sudo', 'chmod', '600', f"{certs_dir}/private/client.key"], check=True)
        
        print("[IKEv2] Certificates saved")
        return True
        
    except Exception as e:
        print(f"[IKEv2] Error saving certificates: {e}")
        return False


def get_vpn_interface_info():
    """Get VPN interface info (ipsec0 or similar)"""
    try:
        result = subprocess.run(['ip', 'addr', 'show'], capture_output=True, text=True, timeout=5)
        vpn_info = {"interface": "", "vpn_ip": "", "peer_ip": ""}
        
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            current_interface = None
            
            for line in lines:
                if ': ip_vti' in line or ': ipsec' in line:
                    match = re.search(r'\d+:\s+(\w+):', line)
                    if match:
                        current_interface = match.group(1)
                        vpn_info["interface"] = current_interface
                
                if current_interface and 'inet ' in line:
                    match = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)', line)
                    if match:
                        vpn_info["vpn_ip"] = match.group(1)
                        break
        
        return vpn_info
    except:
        return {"interface": "", "vpn_ip": "", "peer_ip": ""}


def get_vpn_traffic(interface="ip_vti0"):
    """Get traffic stats"""
    try:
        result = subprocess.run(['ip', '-s', 'link', 'show', interface], capture_output=True, text=True, timeout=5)
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
    except:
        return {"bytes_received": 0, "bytes_sent": 0}


def check_vpn_status():
    """Check IKEv2 connection status"""
    try:
        result = subprocess.run(['sudo', 'ipsec', 'status', connection_name], 
                              capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0 and 'ESTABLISHED' in result.stdout:
            return True
        return False
    except:
        return False


def connect_vpn(client):
    """Connect IKEv2 VPN"""
    try:
        if current_config.get('is_template'):
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Configuration incomplete. Please configure IKEv2 settings first."
            }))
            return
        
        if check_vpn_status():
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "VPN already connected"
            }))
            return
        
        # Generate config files
        if not generate_ipsec_conf(current_config):
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Failed to generate ipsec.conf"
            }))
            return
        
        if not generate_ipsec_secrets(current_config):
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Failed to generate ipsec.secrets"
            }))
            return
        
        if not save_certificates(current_config):
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Failed to save certificates"
            }))
            return
        
        # Reload strongSwan
        subprocess.run(['sudo', 'ipsec', 'reload'], check=True)
        time.sleep(2)
        
        # Start connection
        subprocess.run(['sudo', 'ipsec', 'up', connection_name], check=True)
        
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": True,
            "message": "IKEv2 connection started"
        }))
        print("[IKEv2] Connection initiated")
        
    except Exception as e:
        print(f"[IKEv2] Error connecting: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def disconnect_vpn(client):
    """Disconnect IKEv2 VPN"""
    try:
        subprocess.run(['sudo', 'ipsec', 'down', connection_name], check=True)
        
        if current_config:
            current_config["status"] = "disconnected"
            current_config["vpn_ip"] = ""
        
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": True,
            "message": "IKEv2 disconnected"
        }))
        print("[IKEv2] Disconnected")
        
    except Exception as e:
        print(f"[IKEv2] Error disconnecting: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def handle_upload_config(client, payload):
    """Handle config file upload (strongSwan format)"""
    try:
        # For IKEv2, we might receive ipsec.conf or .mobileconfig
        # Parse and extract configuration
        file_content = payload.get('content', '')
        
        if not file_content:
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "File content is empty"
            }))
            return
        
        # Save uploaded content for manual configuration
        upload_file = os.path.join(CONFIG_DIR, "uploaded_config.txt")
        with open(upload_file, 'w') as f:
            f.write(file_content)
        
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": True,
            "message": "Config uploaded. Please configure via form."
        }))
        
    except Exception as e:
        print(f"[IKEv2] Upload error: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def monitor_loop(client):
    """Monitor IKEv2 status"""
    while True:
        try:
            is_connected = check_vpn_status()
            
            if is_connected:
                vpn_info = get_vpn_interface_info()
                traffic = get_vpn_traffic(vpn_info["interface"]) if vpn_info["interface"] else {"bytes_sent": 0, "bytes_received": 0}
                
                status_data = {
                    "status": "connected",
                    "vpn_ip": vpn_info["vpn_ip"],
                    "interface": vpn_info["interface"],
                    "peer_ip": vpn_info.get("peer_ip", ""),
                    "timestamp": datetime.now().isoformat(),
                    **traffic
                }
                
                if current_config:
                    current_config["status"] = "connected"
                    current_config["vpn_ip"] = vpn_info["vpn_ip"]
                
                client.publish(TOPIC_VPN_STATUS, json.dumps(status_data))
                print(f"[IKEv2] Connected - IP: {vpn_info['vpn_ip']}")
            else:
                status_data = {
                    "status": "disconnected",
                    "vpn_ip": "",
                    "interface": "",
                    "peer_ip": "",
                    "timestamp": datetime.now().isoformat(),
                    "bytes_sent": 0,
                    "bytes_received": 0
                }
                
                if current_config:
                    current_config["status"] = "disconnected"
                    current_config["vpn_ip"] = ""
                
                client.publish(TOPIC_VPN_STATUS, json.dumps(status_data))
            
            time.sleep(5)
            
        except Exception as e:
            print(f"[IKEv2] Monitor error: {e}")
            time.sleep(5)


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[IKEv2] Connected to MQTT")
        client.subscribe(TOPIC_VPN_REQUEST)
        client.subscribe(TOPIC_VPN_UPDATE)
        client.subscribe(TOPIC_VPN_COMMAND)
        client.subscribe(TOPIC_VPN_UPLOAD)
        print("[IKEv2] Subscribed to topics")


def on_message(client, userdata, msg):
    global current_config
    
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        print(f"[IKEv2] Message from {topic}")
        
        if topic == TOPIC_VPN_REQUEST:
            if payload.get('action') == 'getConfig':
                if current_config:
                    client.publish(TOPIC_VPN_CONFIG, json.dumps(current_config))
        
        elif topic == TOPIC_VPN_UPDATE:
            if current_config:
                current_config.update(payload)
                
                # Check if config is complete
                if payload.get('server_address') and payload.get('server_address') != '':
                    current_config['is_template'] = False
                    current_config.pop('warning', None)
                
                save_config()
                
                client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                    "success": True,
                    "message": "Configuration updated"
                }))
                client.publish(TOPIC_VPN_CONFIG, json.dumps(current_config))
        
        elif topic == TOPIC_VPN_COMMAND:
            action = payload.get('action')
            if action == 'connect':
                connect_vpn(client)
            elif action == 'disconnect':
                disconnect_vpn(client)
        
        elif topic == TOPIC_VPN_UPLOAD:
            handle_upload_config(client, payload)
        
    except Exception as e:
        print(f"[IKEv2] Message error: {e}")


def main():
    print("[IKEv2] Starting service...")
    load_config()
    
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    
    import threading
    monitor_thread = threading.Thread(target=monitor_loop, args=(client,))
    monitor_thread.daemon = True
    monitor_thread.start()
    
    client.loop_forever()


if __name__ == "__main__":
    main()