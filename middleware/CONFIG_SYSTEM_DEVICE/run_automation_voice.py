#!/usr/bin/env python3
"""
Automation Voice MQTT Service Runner

This script starts the Automation Voice MQTT service that handles
voice command processing and device control via MQTT.

Usage:
    python run_automation_voice.py

The service will:
1. Connect to MQTT broker
2. Listen for voice commands from frontend
3. Process natural language commands
4. Execute device control actions
5. Handle CRUD operations for voice commands
"""

import sys
import os
import signal
import logging
import time
from datetime import datetime

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from AutomationVoiceMQTT import AutomationVoiceMQTT

# Setup clean logging - only errors and warnings to console
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.WARNING)  # Only show warnings and errors
console_formatter = logging.Formatter('%(levelname)s: %(message)s')
console_handler.setFormatter(console_formatter)

# File logging with more details
file_handler = logging.FileHandler('automation_voice.log')
file_handler.setLevel(logging.INFO)
file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    handlers=[console_handler, file_handler]
)

logger = logging.getLogger(__name__)

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down...")
    sys.exit(0)

def print_banner():
    """Print modern startup banner"""
    print("\n" + "╔" + "═"*58 + "╗")
    print("║" + " "*58 + "║")
    print("║" + " "*20 + "🎤 VOICE CONTROL SYSTEM" + " "*20 + "║")
    print("║" + " "*58 + "║")
    print("║" + " "*15 + "Smart Home Automation Service" + " "*15 + "║")
    print("║" + " "*58 + "║")
    print("╚" + "═"*58 + "╝")

def print_startup_progress():
    """Print startup progress with modern indicators"""
    steps = [
        ("🔧", "Initializing components", 0.5),
        ("📡", "Connecting to MQTT broker", 1.0),
        ("🎯", "Subscribing to topics", 1.5),
        ("📦", "Loading voice commands", 2.0),
        ("✅", "Service ready", 2.5)
    ]

    print(f"\n🚀 Starting service at {datetime.now().strftime('%H:%M:%S')}")
    print("├" + "─"*50)

    for icon, message, delay in steps:
        print(f"│ {icon} {message}")
        time.sleep(delay)

    print("└" + "─"*50)
    print("🎯 Ready to process voice commands!\n")

def main():
    """Main entry point"""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Print banner
    print_banner()

    try:
        # Show startup progress
        print_startup_progress()

        # Create and start the service
        logger.info("Starting Automation Voice MQTT Service...")
        service = AutomationVoiceMQTT()

        # Start the service
        success = service.start()

        if success:
            logger.info("Service started successfully")
            print("✅ All systems operational!")
            print("💡 Use voice commands like 'nyalakan lampu kamar' or 'matikan ac'")
            print("🔇 Press Ctrl+C to stop\n")
        else:
            logger.error("Failed to start service")
            print("❌ Failed to start service")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Service interrupted by user")
        print("\n👋 Service stopped by user")
    except Exception as e:
        logger.error(f"Service error: {e}")
        print(f"❌ Service error: {e}")
        sys.exit(1)
    finally:
        print("\n🔄 Shutting down...")
        logger.info("Service shutdown complete")

if __name__ == "__main__":
    main()
