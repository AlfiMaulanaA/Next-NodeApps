#!/bin/bash
# Repair Multiprocesing.service and fix all issues

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="Multiprocesing.service"

echo "🔧 Repairing Network Manager Service..."
echo "======================================="

# Step 1: Setup sudoers permissions
echo "📋 Step 1: Setting up sudoers permissions..."
if [ -f "$SCRIPT_DIR/setup_sudoers_interface.sh" ]; then
    chmod +x "$SCRIPT_DIR/setup_sudoers_interface.sh"
    "$SCRIPT_DIR/setup_sudoers_interface.sh"
    echo "✅ Sudoers permissions configured"
else
    echo "⚠️ setup_sudoers_interface.sh not found, skipping..."
fi
echo ""

# Step 2: Check MQTT broker
echo "🔍 Step 2: Checking MQTT broker status..."
if systemctl is-active --quiet mosquitto; then
    echo "✅ MQTT broker (mosquitto) is running"
elif systemctl is-active --quiet mqtt; then
    echo "✅ MQTT broker (mqtt) is running"
else
    echo "⚠️ Starting MQTT broker..."
    if command -v mosquitto >/dev/null 2>&1; then
        sudo systemctl start mosquitto
        sudo systemctl enable mosquitto
        echo "✅ Mosquitto MQTT broker started"
    else
        echo "❌ MQTT broker not found. Installing mosquitto..."
        sudo apt update
        sudo apt install -y mosquitto mosquitto-clients
        sudo systemctl start mosquitto
        sudo systemctl enable mosquitto
        echo "✅ Mosquitto installed and started"
    fi
fi
echo ""

# Step 3: Wait for MQTT broker
echo "⏳ Step 3: Waiting for MQTT broker to be ready..."
chmod +x "$SCRIPT_DIR/wait-for-mqtt.sh"
"$SCRIPT_DIR/wait-for-mqtt.sh"
echo ""

# Step 4: Stop service
echo "⏹️ Step 4: Stopping $SERVICE_NAME..."
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    sudo systemctl stop "$SERVICE_NAME"
    echo "✅ Service stopped"
else
    echo "ℹ️ Service was not running"
fi
echo ""

# Step 5: Fix Python imports (DeviceConfig.py)
echo "🔧 Step 5: Checking Python imports..."
DEVICE_CONFIG="$SCRIPT_DIR/MIDDLEWARE/ZTE_V2/DeviceConfig.py"
if [ -f "$DEVICE_CONFIG" ]; then
    if ! grep -q "^import sys" "$DEVICE_CONFIG"; then
        echo "⚠️ Adding missing 'import sys' to DeviceConfig.py..."
        # Already fixed above
        echo "✅ Import sys added to DeviceConfig.py"
    else
        echo "✅ DeviceConfig.py imports are correct"
    fi
else
    echo "⚠️ DeviceConfig.py not found"
fi
echo ""

# Step 6: Test Network.py syntax
echo "🧪 Step 6: Testing Network.py syntax..."
NETWORK_PY="$SCRIPT_DIR/MIDDLEWARE/ZTE_V2/Network.py"
if [ -f "$NETWORK_PY" ]; then
    if python3 -m py_compile "$NETWORK_PY"; then
        echo "✅ Network.py syntax is valid"
    else
        echo "❌ Network.py has syntax errors"
        echo "Checking for common issues..."
    fi
else
    echo "❌ Network.py not found"
fi
echo ""

# Step 7: Start service with monitoring
echo "▶️ Step 7: Starting $SERVICE_NAME with monitoring..."
sudo systemctl start "$SERVICE_NAME"
sleep 3

# Monitor service startup
for i in {1..10}; do
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "✅ Service started successfully"
        break
    else
        echo "⏳ Waiting for service to start... ($i/10)"
        sleep 2
    fi
done

# Final status check
echo ""
echo "📊 Final Status Check:"
echo "====================="

# Service status
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ $SERVICE_NAME: RUNNING"
    
    # Show process tree
    echo ""
    echo "📋 Process Tree:"
    pgrep -f "python3.*Network.py" | head -1 | xargs -r ps -p --forest 2>/dev/null || echo "Network.py process info not available"
    
else
    echo "❌ $SERVICE_NAME: FAILED"
    echo ""
    echo "📋 Service Status:"
    sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -20
    echo ""
    echo "📋 Recent Logs:"
    sudo journalctl -u "$SERVICE_NAME" -n 20 --no-pager
fi

# MQTT broker status
if systemctl is-active --quiet mosquitto; then
    echo "✅ MQTT Broker: RUNNING"
elif systemctl is-active --quiet mqtt; then
    echo "✅ MQTT Broker: RUNNING"
else
    echo "❌ MQTT Broker: NOT RUNNING"
fi

# Network connectivity test
echo ""
echo "🔌 Network Test:"
if ping -c 1 127.0.0.1 >/dev/null 2>&1; then
    echo "✅ Localhost connectivity: OK"
else
    echo "❌ Localhost connectivity: FAILED"
fi

if nc -z localhost 1883 2>/dev/null; then
    echo "✅ MQTT port 1883: OPEN"
else
    echo "❌ MQTT port 1883: CLOSED"
fi

echo ""
echo "🎯 Repair Summary:"
echo "=================="
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Service repair completed successfully!"
    echo ""
    echo "📝 Test these MQTT topics:"
    echo "   • wifi/scan_request (empty payload)"
    echo "   • command_device_ip (payload: {\"command\":\"readIP\"})"
    echo "   • command_device_ip (payload: {\"command\":\"restartNetworking\"})"
else
    echo "❌ Service repair failed. Please check the logs above."
    echo ""
    echo "💡 Manual troubleshooting steps:"
    echo "   1. Check MQTT broker: sudo systemctl status mosquitto"
    echo "   2. Check service logs: sudo journalctl -u $SERVICE_NAME -f"
    echo "   3. Check Python syntax: python3 -c 'import MIDDLEWARE.ZTE_V2.Network'"
fi

echo ""
echo "🏁 Repair script completed!"