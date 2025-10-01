#!/usr/bin/env python3
"""
Unified Error Logger Module
Provides standardized error logging across all middleware services.
Synchronized with ErrorLog.py service for consistent error handling.
"""

import os
import json
import time
import uuid
import threading
import paho.mqtt.client as mqtt
from datetime import datetime
from typing import Optional, Dict, Any
import logging

# --- Configuration ---
ERROR_LOG_TOPIC = "subrack/error/log"
DEFAULT_MQTT_BROKER = "localhost"
DEFAULT_MQTT_PORT = 1883
QOS = 1

# Error Types (standardized)
ERROR_TYPE_MINOR = "MINOR"
ERROR_TYPE_MAJOR = "MAJOR"
ERROR_TYPE_CRITICAL = "CRITICAL"
ERROR_TYPE_INFO = "INFO"
ERROR_TYPE_WARNING = "WARNING"
ERROR_TYPE_ERROR = "ERROR"

# Global state
_error_logger_client = None
_connection_status = False
_pending_logs = []
_pending_logs_lock = threading.Lock()
_client_lock = threading.Lock()
MAX_PENDING_LOGS = 50

# Setup logging
logger = logging.getLogger(__name__)

class UnifiedErrorLogger:
    """
    Unified Error Logger that provides consistent error logging
    across all middleware services with robust MQTT handling.
    """

    def __init__(self, service_name: str, mqtt_broker: str = DEFAULT_MQTT_BROKER,
                 mqtt_port: int = DEFAULT_MQTT_PORT):
        self.service_name = service_name
        self.mqtt_broker = mqtt_broker
        self.mqtt_port = mqtt_port
        self.client = None
        self.connected = False
        self.reconnect_thread = None

    def initialize(self) -> bool:
        """Initialize the error logger with MQTT connection"""
        try:
            self.client = mqtt.Client(
                client_id=f"ErrorLogger-{self.service_name}-{uuid.uuid4().hex[:8]}",
                protocol=mqtt.MQTTv311,
                clean_session=True
            )

            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            self.client.reconnect_delay_set(min_delay=1, max_delay=120)

            # Attempt initial connection (non-blocking)
            try:
                self.client.connect(self.mqtt_broker, self.mqtt_port, keepalive=60)
                self.client.loop_start()
                logger.info(f"Error logger initialized for {self.service_name}")
                return True
            except Exception as e:
                logger.warning(f"Initial MQTT connection failed for {self.service_name}: {e}. Will retry in background.")
                self.client.loop_start()  # Start loop for reconnection attempts
                self._start_reconnection()
                return True  # Return True to indicate logger is initialized (will work in offline mode)

        except Exception as e:
            logger.error(f"Failed to initialize error logger for {self.service_name}: {e}")
            return False

    def _on_connect(self, client, userdata, flags, rc):
        """Handle MQTT connection"""
        if rc == 0:
            self.connected = True
            logger.info(f"Error logger connected for {self.service_name}")
            self._process_pending_logs()
        else:
            self.connected = False
            logger.warning(f"Error logger connection failed for {self.service_name} (code: {rc})")

    def _on_disconnect(self, client, userdata, rc):
        """Handle MQTT disconnection"""
        self.connected = False
        if rc != 0:
            logger.warning(f"Error logger disconnected unexpectedly for {self.service_name}. Starting reconnection...")
            self._start_reconnection()
        else:
            logger.info(f"Error logger disconnected normally for {self.service_name}")

    def _start_reconnection(self):
        """Start reconnection thread if not already running"""
        if self.reconnect_thread and self.reconnect_thread.is_alive():
            return

        self.reconnect_thread = threading.Thread(target=self._reconnection_loop, daemon=True)
        self.reconnect_thread.start()

    def _reconnection_loop(self):
        """Background reconnection with exponential backoff"""
        delay = 1
        max_delay = 300

        while not self.connected:
            try:
                logger.debug(f"Attempting reconnection for {self.service_name}...")
                self.client.reconnect()
                break
            except Exception as e:
                logger.debug(f"Reconnection failed for {self.service_name}: {e}")
                time.sleep(delay)
                delay = min(delay * 2, max_delay)

    def _process_pending_logs(self):
        """Process any pending error logs after reconnection"""
        with _pending_logs_lock:
            if not _pending_logs:
                return

            processed = 0
            for log_entry in _pending_logs[:]:
                try:
                    if self._publish_log(log_entry):
                        _pending_logs.remove(log_entry)
                        processed += 1
                except Exception as e:
                    logger.error(f"Failed to process pending log: {e}")

            if processed > 0:
                logger.info(f"Processed {processed} pending error logs for {self.service_name}")

    def _publish_log(self, log_entry: Dict[str, Any]) -> bool:
        """Publish a single log entry"""
        try:
            if self.client and self.connected:
                payload = json.dumps(log_entry)
                result = self.client.publish(ERROR_LOG_TOPIC, payload, qos=QOS)
                return result.rc == mqtt.MQTT_ERR_SUCCESS
            return False
        except Exception as e:
            logger.error(f"Error publishing log entry: {e}")
            return False

    def send_error_log(self, function_name: str, error_detail: str,
                      error_type: str, additional_info: Optional[Dict[str, Any]] = None):
        """
        Send error log with standardized format

        Args:
            function_name: Name of the function/operation that failed
            error_detail: Detailed error message
            error_type: Type of error (use ERROR_TYPE_* constants)
            additional_info: Optional additional information dictionary
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        unique_id = f"{self.service_name}--{int(time.time())}-{uuid.uuid4().int % 10000000000}"

        # Standardized error log structure (compatible with ErrorLog.py)
        log_entry = {
            "id": unique_id,
            "data": f"[{function_name}] {error_detail}",
            "type": error_type.upper(),
            "source": self.service_name,
            "Timestamp": timestamp,
            "status": "active"
        }

        # Add additional info if provided
        if additional_info:
            log_entry.update(additional_info)

        # Try to publish immediately
        if self._publish_log(log_entry):
            logger.debug(f"Error log sent immediately: {function_name}")
        else:
            # Queue for later if connection is down
            self._queue_log(log_entry)
            logger.warning(f"Error log queued (connection down): {function_name}")

    def _queue_log(self, log_entry: Dict[str, Any]):
        """Queue log entry for later processing"""
        with _pending_logs_lock:
            if len(_pending_logs) >= MAX_PENDING_LOGS:
                # Remove oldest entry
                removed = _pending_logs.pop(0)
                logger.warning(f"Pending logs queue full, dropped oldest entry from {removed.get('source', 'unknown')}")

            _pending_logs.append(log_entry)

    def shutdown(self):
        """Gracefully shutdown the error logger"""
        try:
            if self.client:
                self.client.loop_stop()
                self.client.disconnect()
            logger.info(f"Error logger shutdown for {self.service_name}")
        except Exception as e:
            logger.error(f"Error during error logger shutdown: {e}")


# Global error logger instance for backwards compatibility
_global_logger = None

def initialize_error_logger(service_name: str, mqtt_broker: str = DEFAULT_MQTT_BROKER,
                          mqtt_port: int = DEFAULT_MQTT_PORT) -> UnifiedErrorLogger:
    """
    Initialize global error logger for a service

    Args:
        service_name: Name of the service
        mqtt_broker: MQTT broker address
        mqtt_port: MQTT broker port

    Returns:
        UnifiedErrorLogger instance
    """
    global _global_logger
    _global_logger = UnifiedErrorLogger(service_name, mqtt_broker, mqtt_port)
    _global_logger.initialize()
    return _global_logger

def send_error_log(function_name: str, error_detail: str, error_type: str,
                  additional_info: Optional[Dict[str, Any]] = None):
    """
    Send error log using global logger (backwards compatibility)

    Args:
        function_name: Name of the function/operation that failed
        error_detail: Detailed error message
        error_type: Type of error (use ERROR_TYPE_* constants)
        additional_info: Optional additional information dictionary
    """
    if _global_logger:
        _global_logger.send_error_log(function_name, error_detail, error_type, additional_info)
    else:
        logger.error(f"Error logger not initialized. Lost error log: [{function_name}] {error_detail}")

def get_error_logger() -> Optional[UnifiedErrorLogger]:
    """Get the global error logger instance"""
    return _global_logger

def shutdown_error_logger():
    """Shutdown the global error logger"""
    global _global_logger
    if _global_logger:
        _global_logger.shutdown()
        _global_logger = None