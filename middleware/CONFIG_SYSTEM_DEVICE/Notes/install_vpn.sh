#!/bin/bash

# VPN Dependencies Smart Installer
# Checks first, installs only if missing

echo "========================================="
echo "VPN Dependencies Check & Install"
echo "========================================="

NEED_UPDATE=false
NEED_INSTALL=()

# Function to check if command exists
check_command() {
    if command -v $1 &> /dev/null; then
        echo "✓ $2 already installed"
        return 0
    else
        echo "✗ $2 not found - will install"
        NEED_INSTALL+=("$3")
        NEED_UPDATE=true
        return 1
    fi
}

# Check OpenVPN
echo "[1/3] Checking OpenVPN..."
check_command "openvpn" "OpenVPN" "openvpn"

# Check StrongSwan (IKEv2)
echo "[2/3] Checking StrongSwan..."
check_command "ipsec" "StrongSwan" "strongswan strongswan-pki libcharon-extra-plugins"

# Check WireGuard
echo "[3/3] Checking WireGuard..."
check_command "wg" "WireGuard" "wireguard wireguard-tools"

# Install if needed
if [ "$NEED_UPDATE" = true ]; then
    echo ""
    echo "========================================="
    echo "Installing missing packages..."
    echo "========================================="
    
    # Update package list
    echo "Updating package list..."
    sudo apt-get update
    
    # Install each missing package
    for package in "${NEED_INSTALL[@]}"; do
        echo "Installing $package..."
        sudo apt-get install -y $package
    done
else
    echo ""
    echo "All VPN tools already installed!"
fi

# Verify installations
echo ""
echo "========================================="
echo "Final Verification"
echo "========================================="

if command -v openvpn &> /dev/null; then
    echo "✓ OpenVPN: $(openvpn --version | head -n1)"
fi

if command -v ipsec &> /dev/null; then
    echo "✓ StrongSwan: $(ipsec --version | head -n1)"
fi

if command -v wg &> /dev/null; then
    echo "✓ WireGuard: $(wg --version)"
fi

# Create directories
echo ""
echo "Creating VPN config directories..."
mkdir -p /home/bms/vpn_configs/{openvpn,ikev2,wireguard}
chmod 755 /home/bms/vpn_configs
chmod 755 /home/bms/vpn_configs/{openvpn,ikev2,wireguard}

# Check Python MQTT
echo ""
echo "Checking Python dependencies..."
if python3 -c "import paho.mqtt.client" 2>/dev/null; then
    echo "✓ paho-mqtt already installed"
else
    echo "✗ paho-mqtt not found"
    echo "Installing paho-mqtt..."
    pip3 install paho-mqtt
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "- VPN tools: Ready"
echo "- Config directories: Created"
echo "- Python MQTT: Ready"
echo ""
echo "Run services: python3 main.py"