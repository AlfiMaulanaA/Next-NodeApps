#!/usr/bin/env python3
"""
Auto Restart Service Script
Automatically restarts Multiprocesing.service every 6 hours
"""

import time
import subprocess
import logging
import threading
from datetime import datetime, timedelta
import sys
import os

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/auto_restart.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("AutoRestartService")

# Configuration
SERVICE_NAME = "Multiprocesing.service"
RESTART_INTERVAL_HOURS = 6
MAX_RESTART_ATTEMPTS = 3

class ServiceAutoRestart:
    def __init__(self):
        self.running = True
        self.last_restart = None
        self.restart_count = 0
        
    def check_sudo_access(self):
        """Check if current user can run sudo systemctl without password"""
        try:
            result = subprocess.run(
                ["sudo", "-n", "systemctl", "status", SERVICE_NAME],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Failed to check sudo access: {e}")
            return False
    
    def restart_service(self):
        """Restart the specified service"""
        try:
            logger.info(f"Attempting to restart {SERVICE_NAME}...")
            
            # Check service status first
            status_result = subprocess.run(
                ["sudo", "systemctl", "is-active", SERVICE_NAME],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10
            )
            
            current_status = status_result.stdout.strip()
            logger.info(f"Current service status: {current_status}")
            
            # Restart the service
            restart_result = subprocess.run(
                ["sudo", "systemctl", "restart", SERVICE_NAME],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=30
            )
            
            if restart_result.returncode == 0:
                logger.info(f"✅ Successfully restarted {SERVICE_NAME}")
                self.last_restart = datetime.now()
                self.restart_count += 1
                
                # Wait a moment and verify service is running
                time.sleep(3)
                verify_result = subprocess.run(
                    ["sudo", "systemctl", "is-active", SERVICE_NAME],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                if verify_result.stdout.strip() == "active":
                    logger.info(f"✅ Service {SERVICE_NAME} is running after restart")
                    return True
                else:
                    logger.warning(f"⚠️ Service {SERVICE_NAME} may not be running properly after restart")
                    return False
            else:
                logger.error(f"❌ Failed to restart {SERVICE_NAME}: {restart_result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error(f"❌ Timeout while restarting {SERVICE_NAME}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error restarting {SERVICE_NAME}: {e}")
            return False
    
    def get_next_restart_time(self):
        """Calculate next restart time"""
        if self.last_restart:
            return self.last_restart + timedelta(hours=RESTART_INTERVAL_HOURS)
        else:
            return datetime.now() + timedelta(hours=RESTART_INTERVAL_HOURS)
    
    def run_scheduler(self):
        """Main scheduler loop"""
        logger.info(f"🚀 Auto Restart Service started for {SERVICE_NAME}")
        logger.info(f"📅 Restart interval: {RESTART_INTERVAL_HOURS} hours")
        
        # Check sudo access on startup
        if not self.check_sudo_access():
            logger.error("❌ No sudo access available. Please configure sudoers or run as root.")
            return
        
        # Initial restart to ensure service is fresh
        logger.info("🔄 Performing initial service restart...")
        self.restart_service()
        
        while self.running:
            try:
                next_restart = self.get_next_restart_time()
                current_time = datetime.now()
                
                if current_time >= next_restart:
                    logger.info(f"⏰ Time for scheduled restart #{self.restart_count + 1}")
                    success = self.restart_service()
                    
                    if not success:
                        logger.warning(f"⚠️ Restart attempt failed, will retry in 10 minutes")
                        time.sleep(600)  # Wait 10 minutes before retry
                        continue
                else:
                    # Calculate sleep time until next restart
                    sleep_seconds = (next_restart - current_time).total_seconds()
                    sleep_minutes = int(sleep_seconds / 60)
                    
                    logger.info(f"⏳ Next restart in {sleep_minutes} minutes at {next_restart.strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    # Sleep in smaller chunks to allow for graceful shutdown
                    chunk_size = min(300, sleep_seconds)  # 5 minutes or remaining time
                    time.sleep(chunk_size)
                    
            except KeyboardInterrupt:
                logger.info("🛑 Received interrupt signal, stopping scheduler...")
                break
            except Exception as e:
                logger.error(f"❌ Unexpected error in scheduler: {e}")
                time.sleep(60)  # Wait 1 minute before continuing
        
        logger.info("🏁 Auto Restart Service stopped")
    
    def stop(self):
        """Stop the scheduler"""
        self.running = False

def create_systemd_service():
    """Create systemd service file for auto restart"""
    service_content = f"""[Unit]
Description=Auto Restart Service for {SERVICE_NAME}
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
Group=root
ExecStart=/usr/bin/python3 {os.path.abspath(__file__)}
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""
    
    service_file_path = "/etc/systemd/system/auto-restart.service"
    
    try:
        with open(service_file_path, 'w') as f:
            f.write(service_content)
        
        logger.info(f"✅ Created systemd service file: {service_file_path}")
        logger.info("To enable the service, run:")
        logger.info("sudo systemctl daemon-reload")
        logger.info("sudo systemctl enable auto-restart.service")
        logger.info("sudo systemctl start auto-restart.service")
        
    except PermissionError:
        logger.error("❌ Permission denied. Run as root to create systemd service file.")
    except Exception as e:
        logger.error(f"❌ Failed to create systemd service file: {e}")

def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == "install":
        create_systemd_service()
        return
    
    # Create and start the auto restart service
    restart_service = ServiceAutoRestart()
    
    # Handle graceful shutdown
    def signal_handler():
        restart_service.stop()
    
    try:
        restart_service.run_scheduler()
    except KeyboardInterrupt:
        logger.info("🛑 Keyboard interrupt received")
        signal_handler()

if __name__ == "__main__":
    main()

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Auto Restart ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Auto Restart ===========")
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
