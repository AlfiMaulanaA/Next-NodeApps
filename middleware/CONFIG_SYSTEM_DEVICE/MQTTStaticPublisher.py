#!/usr/bin/env python3
"""
MQTT Static Payload Publisher Service

Advanced MQTT publisher service that reads static payload configurations
from JSON file and publishes data to predefined topics at specified intervals.

Features:
- Configuration-driven publishing from JSON
- Interval-based publishing with individual timers
- Connection management with auto-reconnection
- Last Will and Testament (LWT) support
- Performance monitoring and statistics
- Comprehensive logging and error handling
- Health checks and status monitoring
- Thread-safe operations

Configuration File: ./JSON/payloadStaticConfig.json
Broker: localhost:1883 (configurable)

Author: AI Assistant
Version: 2.0
"""

import json
import time
import threading
import logging
import signal
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import paho.mqtt.client as mqtt
import os

# Configuration
CONFIG_FILE_PATH = "./JSON/payloadStaticConfig.json"
LOG_FILE_PATH = "./logs/mqtt_publisher.log"
DEFAULT_BROKER = "localhost"
DEFAULT_PORT = 1883

# Ensure directories exist
os.makedirs(os.path.dirname(CONFIG_FILE_PATH), exist_ok=True)
os.makedirs(os.path.dirname(LOG_FILE_PATH), exist_ok=True)

@dataclass
class PublishConfig:
    """Publishing configuration for each topic"""
    id: str
    topic: str
    data: Dict[str, Any]
    interval: int
    qos: int
    retain: bool
    lwt: bool
    last_publish: float = 0.0
    publish_count: int = 0
    error_count: int = 0

    def should_publish(self, current_time: float) -> bool:
        """Check if it's time to publish for this configuration"""
        return current_time - self.last_publish >= self.interval

    def mark_published(self, current_time: float):
        """Mark successful publish"""
        self.last_publish = current_time
        self.publish_count += 1

    def mark_error(self):
        """Mark publish error"""
        self.error_count += 1

class MQTTConnectionManager:
    """MQTT connection manager with auto-reconnection"""

    def __init__(self, broker: str = DEFAULT_BROKER, port: int = DEFAULT_PORT,
                 username: Optional[str] = None, password: Optional[str] = None):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self.client = None
        self.connected = False
        self.connecting = False
        self.last_connect_attempt = 0
        self.reconnect_interval = 5  # seconds
        self.max_reconnect_attempts = 10
        self.reconnect_count = 0

        self.lock = threading.RLock()
        self._setup_client()

    def _setup_client(self):
        """Setup MQTT client with callbacks"""
        self.client = mqtt.Client(client_id=f"static_publisher_{int(time.time())}", clean_session=False)

        if self.username and self.password:
            self.client.username_pw_set(self.username, self.password)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_publish = self._on_publish

        # Enable logging
        self.client.enable_logger()

    def _on_connect(self, client, userdata, flags, rc):
        """MQTT connect callback"""
        with self.lock:
            if rc == 0:
                self.connected = True
                self.connecting = False
                self.reconnect_count = 0
                logging.info(f"Connected to MQTT broker {self.broker}:{self.port}")
            else:
                self.connected = False
                self.connecting = False
                logging.error(f"Failed to connect to MQTT broker, code: {rc}")

    def _on_disconnect(self, client, userdata, rc):
        """MQTT disconnect callback"""
        with self.lock:
            self.connected = False
            if rc != 0:
                logging.warning(f"Unexpected disconnection from MQTT broker, code: {rc}")
                # Schedule reconnection
                threading.Timer(1.0, self._attempt_reconnect).start()

    def _on_publish(self, client, userdata, mid):
        """MQTT publish callback"""
        logging.debug(f"Message {mid} published successfully")

    def _attempt_reconnect(self):
        """Attempt to reconnect to MQTT broker"""
        with self.lock:
            if self.connecting or self.connected:
                return

            current_time = time.time()
            if current_time - self.last_connect_attempt < self.reconnect_interval:
                return

            if self.reconnect_count >= self.max_reconnect_attempts:
                logging.error("Max reconnection attempts reached, giving up")
                return

            self.connecting = True
            self.last_connect_attempt = current_time
            self.reconnect_count += 1

            logging.info(f"Attempting to reconnect ({self.reconnect_count}/{self.max_reconnect_attempts})")

            try:
                self.client.reconnect()
            except Exception as e:
                logging.error(f"Reconnection failed: {e}")
                self.connecting = False
                # Schedule next attempt
                threading.Timer(self.reconnect_interval, self._attempt_reconnect).start()

    def connect(self) -> bool:
        """Initial connection to MQTT broker"""
        with self.lock:
            if self.connected:
                return True

            try:
                logging.info(f"Connecting to MQTT broker {self.broker}:{self.port}")
                self.client.connect(self.broker, self.port, 60)
                self.client.loop_start()
                # Wait a bit for connection
                time.sleep(2)
                return self.connected
            except Exception as e:
                logging.error(f"Failed to connect to MQTT broker: {e}")
                return False

    def disconnect(self):
        """Disconnect from MQTT broker"""
        with self.lock:
            if self.client:
                self.client.loop_stop()
                self.client.disconnect()
            self.connected = False
            logging.info("Disconnected from MQTT broker")

    def publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False) -> bool:
        """Publish message to MQTT topic"""
        with self.lock:
            if not self.connected:
                logging.warning(f"Cannot publish to {topic}: not connected to broker")
                return False

            try:
                result = self.client.publish(topic, payload, qos=qos, retain=retain)
                if result.rc == mqtt.MQTT_ERR_SUCCESS:
                    logging.debug(f"Published to {topic}: {payload[:100]}...")
                    return True
                else:
                    logging.error(f"Failed to publish to {topic}, MQTT error: {result.rc}")
                    return False
            except Exception as e:
                logging.error(f"Exception while publishing to {topic}: {e}")
                return False

    def set_lwt(self, topic: str, payload: str, qos: int = 0, retain: bool = False):
        """Set Last Will and Testament"""
        with self.lock:
            if self.client:
                self.client.will_set(topic, payload, qos, retain)
                logging.info(f"LWT set for topic {topic}")

    def is_connected(self) -> bool:
        """Check connection status"""
        with self.lock:
            return self.connected

class ConfigurationLoader:
    """Configuration loader with caching and monitoring"""

    def __init__(self, config_file: str):
        self.config_file = config_file
        self.configs: List[PublishConfig] = []
        self.last_load_time = 0
        self.load_interval = 30  # seconds
        self.lock = threading.RLock()

    def load_configurations(self, force_reload: bool = False) -> List[PublishConfig]:
        """Load configurations from JSON file"""
        with self.lock:
            current_time = time.time()

            # Check if reload is needed
            if not force_reload and current_time - self.last_load_time < self.load_interval:
                return self.configs.copy()

            try:
                if not os.path.exists(self.config_file):
                    logging.warning(f"Configuration file not found: {self.config_file}")
                    return []

                with open(self.config_file, 'r') as f:
                    data = json.load(f)

                configs = []
                for item in data:
                    try:
                        # Convert dict to PublishConfig, handling missing fields
                        config = PublishConfig(
                            id=item.get('id', f"config_{len(configs)}"),
                            topic=item['topic'],
                            data=item['data'],
                            interval=item.get('interval', 10),
                            qos=item.get('qos', 0),
                            retain=item.get('retain', False),
                            lwt=item.get('lwt', True)
                        )
                        configs.append(config)
                    except KeyError as e:
                        logging.error(f"Invalid configuration item, missing field: {e}")
                        continue
                    except Exception as e:
                        logging.error(f"Error parsing configuration item: {e}")
                        continue

                self.configs = configs
                self.last_load_time = current_time

                logging.info(f"Loaded {len(configs)} configurations from {self.config_file}")
                return configs.copy()

            except json.JSONDecodeError as e:
                logging.error(f"JSON decode error in config file: {e}")
                return self.configs.copy()
            except Exception as e:
                logging.error(f"Error loading configurations: {e}")
                return self.configs.copy()

    def get_active_configs(self) -> List[PublishConfig]:
        """Get configurations that should be actively published"""
        configs = self.load_configurations()
        return [config for config in configs if config.interval > 0]

class PublisherService:
    """Main MQTT Static Publisher Service"""

    def __init__(self, broker: str = DEFAULT_BROKER, port: int = DEFAULT_PORT,
                 username: Optional[str] = None, password: Optional[str] = None):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password

        # Components
        self.connection_manager = MQTTConnectionManager(broker, port, username, password)
        self.config_loader = ConfigurationLoader(CONFIG_FILE_PATH)

        # State
        self.running = False
        self.publisher_thread: Optional[threading.Thread] = None
        self.monitor_thread: Optional[threading.Thread] = None

        # Statistics
        self.stats = {
            "start_time": datetime.now().isoformat(),
            "total_published": 0,
            "total_errors": 0,
            "active_configs": 0,
            "uptime_seconds": 0,
            "last_config_reload": None
        }

        # Setup logging
        self._setup_logging()

        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _setup_logging(self):
        """Setup comprehensive logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(LOG_FILE_PATH),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("MQTTStaticPublisher")

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        self.logger.info(f"Received signal {signum}, shutting down...")
        self.stop()

    def _setup_lwt(self, configs: List[PublishConfig]):
        """Setup Last Will and Testament for all configurations"""
        for config in configs:
            if config.lwt:
                offline_payload = json.dumps({"online": 0, **config.data})
                self.connection_manager.set_lwt(
                    config.topic,
                    offline_payload,
                    qos=config.qos,
                    retain=config.retain
                )

    def _publisher_loop(self):
        """Main publishing loop"""
        self.logger.info("Starting MQTT Static Publisher loop")

        while self.running:
            try:
                # Check connection
                if not self.connection_manager.is_connected():
                    self.logger.warning("Not connected to MQTT broker, attempting reconnection...")
                    if not self.connection_manager.connect():
                        time.sleep(5)
                        continue

                # Load configurations
                configs = self.config_loader.get_active_configs()
                self.stats["active_configs"] = len(configs)

                # Setup LWT if not already done
                if configs and not hasattr(self, '_lwt_setup'):
                    self._setup_lwt(configs)
                    self._lwt_setup = True

                current_time = time.time()

                # Publish for each configuration
                for config in configs:
                    if config.should_publish(current_time):
                        # Prepare payload with online status
                        if config.lwt:
                            payload_data = {"online": 1, **config.data}
                        else:
                            payload_data = config.data

                        payload = json.dumps(payload_data, ensure_ascii=False)

                        # Publish
                        if self.connection_manager.publish(
                            config.topic,
                            payload,
                            config.qos,
                            config.retain
                        ):
                            config.mark_published(current_time)
                            self.stats["total_published"] += 1
                            self.logger.debug(f"Published to {config.topic} (interval: {config.interval}s)")
                        else:
                            config.mark_error()
                            self.stats["total_errors"] += 1
                            self.logger.error(f"Failed to publish to {config.topic}")

                # Sleep before next iteration
                time.sleep(1)

            except Exception as e:
                self.logger.error(f"Error in publisher loop: {e}")
                self.stats["total_errors"] += 1
                time.sleep(5)

        self.logger.info("Publisher loop stopped")

    def _monitor_loop(self):
        """Monitoring and health check loop"""
        while self.running:
            try:
                # Update uptime
                self.stats["uptime_seconds"] = int(time.time() - datetime.fromisoformat(self.stats["start_time"]).timestamp())

                # Log statistics every 60 seconds
                if int(time.time()) % 60 == 0:
                    self._log_statistics()

                time.sleep(10)

            except Exception as e:
                self.logger.error(f"Error in monitor loop: {e}")
                time.sleep(30)

    def _log_statistics(self):
        """Log current statistics"""
        self.logger.info("=== Publisher Statistics ===")
        self.logger.info(f"Active Configurations: {self.stats['active_configs']}")
        self.logger.info(f"Total Published: {self.stats['total_published']}")
        self.logger.info(f"Total Errors: {self.stats['total_errors']}")
        self.logger.info(f"Uptime: {self.stats['uptime_seconds']} seconds")
        self.logger.info(f"Connection Status: {'Connected' if self.connection_manager.is_connected() else 'Disconnected'}")

    def start(self):
        """Start the MQTT Static Publisher service"""
        if self.running:
            self.logger.warning("Service is already running")
            return

        self.logger.info("Starting MQTT Static Publisher Service")
        self.logger.info(f"Broker: {self.broker}:{self.port}")
        self.logger.info(f"Config File: {CONFIG_FILE_PATH}")

        self.running = True

        # Start publisher thread
        self.publisher_thread = threading.Thread(target=self._publisher_loop, daemon=True)
        self.publisher_thread.start()

        # Start monitor thread
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()

        self.logger.info("MQTT Static Publisher Service started successfully")

        # Keep main thread alive
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.logger.info("Received keyboard interrupt")
            self.stop()

    def stop(self):
        """Stop the MQTT Static Publisher service"""
        if not self.running:
            return

        self.logger.info("Stopping MQTT Static Publisher Service")
        self.running = False

        # Disconnect from MQTT
        self.connection_manager.disconnect()

        # Wait for threads to finish
        if self.publisher_thread and self.publisher_thread.is_alive():
            self.publisher_thread.join(timeout=5)

        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5)

        self._log_statistics()
        self.logger.info("MQTT Static Publisher Service stopped")

    def get_status(self) -> Dict[str, Any]:
        """Get current service status"""
        return {
            "running": self.running,
            "connected": self.connection_manager.is_connected(),
            "broker": f"{self.broker}:{self.port}",
            "config_file": CONFIG_FILE_PATH,
            "active_configs": self.stats["active_configs"],
            "statistics": self.stats.copy(),
            "last_config_reload": self.config_loader.last_load_time
        }

    def reload_config(self) -> bool:
        """Force reload configuration"""
        try:
            configs = self.config_loader.load_configurations(force_reload=True)
            self.stats["last_config_reload"] = datetime.now().isoformat()
            self.logger.info(f"Configuration reloaded, {len(configs)} active configs")
            return True
        except Exception as e:
            self.logger.error(f"Failed to reload configuration: {e}")
            return False

def main():
    """Main function"""
    import argparse

    # Declare global at the beginning
    global CONFIG_FILE_PATH

    parser = argparse.ArgumentParser(description="MQTT Static Payload Publisher Service")
    parser.add_argument("--broker", default=DEFAULT_BROKER, help="MQTT broker address")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="MQTT broker port")
    parser.add_argument("--username", help="MQTT username")
    parser.add_argument("--password", help="MQTT password")
    parser.add_argument("--config", default=CONFIG_FILE_PATH, help="Configuration file path")

    args = parser.parse_args()

    # Update global config path if specified
    if args.config != CONFIG_FILE_PATH:
        CONFIG_FILE_PATH = args.config

    print("=== MQTT Static Payload Publisher Service ===")
    print(f"Broker: {args.broker}:{args.port}")
    print(f"Config: {CONFIG_FILE_PATH}")
    print("Press Ctrl+C to stop")
    print()

    # Create and start service
    service = PublisherService(args.broker, args.port, args.username, args.password)

    try:
        service.start()
    except Exception as e:
        logging.error(f"Failed to start service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
