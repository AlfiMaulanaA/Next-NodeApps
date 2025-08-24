#!/bin/bash
# Installation script for CONFIG_SYSTEM_DEVICE requirements on NanoPi Duo2

echo "Installing Python packages for CONFIG_SYSTEM_DEVICE..."

# Update pip3 first
echo "Updating pip3..."
python3 -m pip install --upgrade pip

# Install requirements using pip3
echo "Installing requirements..."
pip3 install -r requirements.txt

# Install hardware-specific packages for NanoPi
echo "Installing NanoPi-specific packages..."
# pip3 install nanopi.duo  # Uncomment if available

# Install additional system packages that might be needed
echo "Installing system packages..."
sudo apt update
sudo apt install -y python3-dev python3-setuptools

echo "Installation complete!"
echo "You can now run: python3 <script_name>.py"