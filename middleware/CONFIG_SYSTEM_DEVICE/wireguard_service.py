# wireguard_service.py
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
TOPIC_VPN_REQUEST = "vpn/wireguard/request"
TOPIC_VPN_CONFIG = "vpn/wireguard/config"
TOPIC_VPN_UPDATE = "vpn/wireguard/update"
TOPIC_VPN_COMMAND = "vpn/wireguard/command"
TOPIC_VPN_STATUS = "vpn/wireguard/status"
TOPIC_VPN_RESPONSE = "vpn/wireguard/response"
TOPIC_VPN_UPLOAD = "vpn/wireguard/upload"

# File paths
BASE_DIR = "/home/bms"
CONFIG_DIR = os.path.join(BASE_DIR, "vpn_configs/wireguard")
ACTIVE_CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
WG_CONF_FILE = "/etc/wireguard/wg0.conf"

# WireGuard interface name
WG_INTERFACE = "wg0"

# Global variables
current_config = None

os.makedirs(CONFIG_DIR, exist_ok=True)


def create_default_config():
    """Generate default WireGuard config template"""
    return {
        "enabled": False,
        "config_name": "WireGuard VPN",
        "private_key": "",
        "public_key": "",
        "address": "",
        "dns": "1.1.1.1",
        "mtu": 1420,
        "peer_public_key": "",
        "preshared_key": "",
        "endpoint": "",
        "endpoint_port": 51820,
        "allowed_ips": "0.0.0.0/0",
        "persistent_keepalive": 25,
        "status": "disconnected",
        "vpn_ip": "",
        "is_template": True,
        "warning": "Please configure WireGuard settings"
    }


def generate_keypair():
    """Generate WireGuard private/public key pair"""
    try:
        # Generate private key
        private_result = subprocess.run(
            ['wg', 'genkey'],
            capture_output=True,
            text=True,
            check=True
        )
        private_key = private_result.stdout.strip()
        
        # Generate public key from private
        public_result = subprocess.run(
            ['wg', 'pubkey'],
            input=private_key,
            capture_output=True,
            text=True,
            check=True
        )
        public_key = public_result.stdout.strip()
        
        return {
            "private_key": private_key,
            "public_key": public_key
        }
    except Exception as e:
        print(f"[WireGuard] Error generating keys: {e}")
        return None


def generate_preshared_key():
    """Generate WireGuard preshared key"""
    try:
        result = subprocess.run(
            ['wg', 'genpsk'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except Exception as e:
        print(f"[WireGuard] Error generating PSK: {e}")
        return ""


def parse_wg_conf(content):
    """Parse WireGuard .conf file"""
    try:
        config = {
            "private_key": "",
            "address": "",
            "dns": "",
            "mtu": 1420,
            "peer_public_key": "",
            "preshared_key": "",
            "endpoint": "",
            "endpoint_port": 51820,
            "allowed_ips": "",
            "persistent_keepalive": 0
        }
        
        lines = content.split('\n')
        section = None
        
        for line in lines:
            line = line.strip()
            
            if line.startswith('[Interface]'):
                section = 'interface'
            elif line.startswith('[Peer]'):
                section = 'peer'
            elif '=' in line and section:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                
                if section == 'interface':
                    if key == 'PrivateKey':
                        config['private_key'] = value
                    elif key == 'Address':
                        config['address'] = value
                    elif key == 'DNS':
                        config['dns'] = value
                    elif key == 'MTU':
                        config['mtu'] = int(value)
                
                elif section == 'peer':
                    if key == 'PublicKey':
                        config['peer_public_key'] = value
                    elif key == 'PresharedKey':
                        config['preshared_key'] = value
                    elif key == 'Endpoint':
                        if ':' in value:
                            parts = value.rsplit(':', 1)
                            config['endpoint'] = parts[0]
                            config['endpoint_port'] = int(parts[1])
                        else:
                            config['endpoint'] = value
                    elif key == 'AllowedIPs':
                        config['allowed_ips'] = value
                    elif key == 'PersistentKeepalive':
                        config['persistent_keepalive'] = int(value)
        
        return config
        
    except Exception as e:
        print(f"[WireGuard] Error parsing config: {e}")
        return None


def load_config():
    """Load WireGuard configuration"""
    global current_config
    try:
        if os.path.exists(ACTIVE_CONFIG_FILE):
            with open(ACTIVE_CONFIG_FILE, 'r') as f:
                current_config = json.load(f)
                print(f"[WireGuard] Loaded config: {current_config.get('config_name')}")
        else:
            current_config = create_default_config()
            save_config()
            print("[WireGuard] Created default config")
    except Exception as e:
        print(f"[WireGuard] Error loading config: {e}")
        current_config = create_default_config()


def save_config():
    """Save WireGuard configuration"""
    try:
        with open(ACTIVE_CONFIG_FILE, 'w') as f:
            json.dump(current_config, f, indent=2)
        print("[WireGuard] Config saved")
    except Exception as e:
        print(f"[WireGuard] Error saving config: {e}")


def generate_wg_conf(config):
    """Generate /etc/wireguard/wg0.conf"""
    try:
        conf_content = f"""[Interface]
PrivateKey = {config['private_key']}
Address = {config['address']}
"""
        
        if config.get('dns'):
            conf_content += f"DNS = {config['dns']}\n"
        
        if config.get('mtu'):
            conf_content += f"MTU = {config['mtu']}\n"
        
        conf_content += f"""
[Peer]
PublicKey = {config['peer_public_key']}
"""
        
        if config.get('preshared_key'):
            conf_content += f"PresharedKey = {config['preshared_key']}\n"
        
        conf_content += f"Endpoint = {config['endpoint']}:{config['endpoint_port']}\n"
        conf_content += f"AllowedIPs = {config.get('allowed_ips', '0.0.0.0/0')}\n"
        
        if config.get('persistent_keepalive'):
            conf_content += f"PersistentKeepalive = {config['persistent_keepalive']}\n"
        
        # Write to temp file
        temp_conf = os.path.join(CONFIG_DIR, "wg0.conf.tmp")
        with open(temp_conf, 'w') as f:
            f.write(conf_content)
        
        # Copy to /etc/wireguard/
        subprocess.run(['sudo', 'cp', temp_conf, WG_CONF_FILE], check=True)
        subprocess.run(['sudo', 'chmod', '600', WG_CONF_FILE], check=True)
        
        print(f"[WireGuard] Generated config: {WG_CONF_FILE}")
        return True
        
    except Exception as e:
        print(f"[WireGuard] Error generating config: {e}")
        return False


def get_vpn_interface_info():
    """Get WireGuard interface info"""
    try:
        result = subprocess.run(['ip', 'addr', 'show', WG_INTERFACE], 
                              capture_output=True, text=True, timeout=5)
        
        vpn_info = {"interface": "", "vpn_ip": "", "peer_ip": ""}
        
        if result.returncode == 0:
            vpn_info["interface"] = WG_INTERFACE
            
            for line in result.stdout.split('\n'):
                if 'inet ' in line:
                    match = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)', line)
                    if match:
                        vpn_info["vpn_ip"] = match.group(1)
                        break
        
        return vpn_info
    except:
        return {"interface": "", "vpn_ip": "", "peer_ip": ""}


def get_vpn_traffic():
    """Get WireGuard traffic stats"""
    try:
        result = subprocess.run(['sudo', 'wg', 'show', WG_INTERFACE, 'transfer'],
                              capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            # Parse output: "peer_pubkey\t12345\t67890"
            lines = result.stdout.strip().split('\n')
            if lines and lines[0]:
                parts = lines[0].split('\t')
                if len(parts) >= 3:
                    return {
                        "bytes_received": int(parts[1]),
                        "bytes_sent": int(parts[2])
                    }
        
        return {"bytes_received": 0, "bytes_sent": 0}
    except:
        return {"bytes_received": 0, "bytes_sent": 0}


def check_vpn_status():
    """Check if WireGuard is running"""
    try:
        result = subprocess.run(['sudo', 'wg', 'show', WG_INTERFACE],
                              capture_output=True, text=True, timeout=5)
        return result.returncode == 0 and len(result.stdout.strip()) > 0
    except:
        return False


def connect_vpn(client):
    """Connect WireGuard VPN"""
    try:
        if current_config.get('is_template'):
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Configuration incomplete. Please configure WireGuard settings."
            }))
            return
        
        if check_vpn_status():
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "WireGuard already connected"
            }))
            return
        
        # Generate config file
        if not generate_wg_conf(current_config):
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Failed to generate WireGuard config"
            }))
            return
        
        # Start WireGuard
        subprocess.run(['sudo', 'wg-quick', 'up', WG_INTERFACE], check=True)
        
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": True,
            "message": "WireGuard connected"
        }))
        print("[WireGuard] Connection started")
        
    except Exception as e:
        print(f"[WireGuard] Error connecting: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def disconnect_vpn(client):
    """Disconnect WireGuard VPN"""
    try:
        subprocess.run(['sudo', 'wg-quick', 'down', WG_INTERFACE], check=True)
        
        if current_config:
            current_config["status"] = "disconnected"
            current_config["vpn_ip"] = ""
        
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": True,
            "message": "WireGuard disconnected"
        }))
        print("[WireGuard] Disconnected")
        
    except Exception as e:
        print(f"[WireGuard] Error disconnecting: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def handle_upload_config(client, payload):
    """Handle .conf file upload"""
    try:
        file_content = payload.get('content', '')
        
        if not file_content:
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "File content is empty"
            }))
            return
        
        # Parse uploaded config
        parsed = parse_wg_conf(file_content)
        
        if parsed and parsed.get('private_key') and parsed.get('peer_public_key'):
            global current_config
            
            # Update config with parsed values
            current_config.update({
                **parsed,
                "is_template": False,
                "status": "disconnected"
            })
            current_config.pop('warning', None)
            
            # Derive public key from private key
            try:
                pub_result = subprocess.run(
                    ['wg', 'pubkey'],
                    input=parsed['private_key'],
                    capture_output=True,
                    text=True,
                    check=True
                )
                current_config['public_key'] = pub_result.stdout.strip()
            except:
                pass
            
            save_config()
            
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": True,
                "message": "Config uploaded and parsed successfully"
            }))
            client.publish(TOPIC_VPN_CONFIG, json.dumps(current_config))
        else:
            client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                "success": False,
                "message": "Invalid WireGuard config format"
            }))
            
    except Exception as e:
        print(f"[WireGuard] Upload error: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def handle_generate_keys(client, payload):
    """Handle key generation request"""
    try:
        key_type = payload.get('type', 'keypair')
        
        if key_type == 'keypair':
            keys = generate_keypair()
            if keys:
                client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                    "success": True,
                    "message": "Keys generated",
                    "data": keys
                }))
            else:
                client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                    "success": False,
                    "message": "Failed to generate keys"
                }))
        
        elif key_type == 'preshared':
            psk = generate_preshared_key()
            if psk:
                client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                    "success": True,
                    "message": "Preshared key generated",
                    "data": {"preshared_key": psk}
                }))
            else:
                client.publish(TOPIC_VPN_RESPONSE, json.dumps({
                    "success": False,
                    "message": "Failed to generate preshared key"
                }))
        
    except Exception as e:
        print(f"[WireGuard] Key generation error: {e}")
        client.publish(TOPIC_VPN_RESPONSE, json.dumps({
            "success": False,
            "message": f"Error: {str(e)}"
        }))


def monitor_loop(client):
    """Monitor WireGuard status"""
    while True:
        try:
            is_connected = check_vpn_status()
            
            if is_connected:
                vpn_info = get_vpn_interface_info()
                traffic = get_vpn_traffic()
                
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
                print(f"[WireGuard] Connected - IP: {vpn_info['vpn_ip']}, RX: {traffic['bytes_received']}, TX: {traffic['bytes_sent']}")
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
            print(f"[WireGuard] Monitor error: {e}")
            time.sleep(5)


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[WireGuard] Connected to MQTT")
        client.subscribe(TOPIC_VPN_REQUEST)
        client.subscribe(TOPIC_VPN_UPDATE)
        client.subscribe(TOPIC_VPN_COMMAND)
        client.subscribe(TOPIC_VPN_UPLOAD)
        print("[WireGuard] Subscribed to topics")


def on_message(client, userdata, msg):
    global current_config
    
    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        print(f"[WireGuard] Message from {topic}")
        
        if topic == TOPIC_VPN_REQUEST:
            action = payload.get('action')
            if action == 'getConfig':
                if current_config:
                    client.publish(TOPIC_VPN_CONFIG, json.dumps(current_config))
            elif action == 'generateKeys':
                handle_generate_keys(client, payload)
        
        elif topic == TOPIC_VPN_UPDATE:
            if current_config:
                current_config.update(payload)
                
                # Check if config is complete
                if (payload.get('private_key') and 
                    payload.get('address') and 
                    payload.get('peer_public_key') and 
                    payload.get('endpoint')):
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
        print(f"[WireGuard] Message error: {e}")


def main():
    print("[WireGuard] Starting service...")
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