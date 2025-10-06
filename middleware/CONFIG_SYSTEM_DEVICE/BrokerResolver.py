import json
import logging
import paho.mqtt.client as mqtt
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import time
import threading
from BrokerTemplateManager import BrokerTemplateManager

class BrokerConnection:
    """Represents a single broker connection with health monitoring"""

    def __init__(self, broker_config: Dict[str, Any], template_id: str = ""):
        self.broker_config = broker_config
        self.template_id = template_id
        self.client: Optional[mqtt.Client] = None
        self.connected = False
        self.last_connected: Optional[datetime] = None
        self.connection_attempts = 0
        self.last_error: Optional[str] = None
        self.response_times: List[float] = []
        self.lock = threading.Lock()

    def connect(self) -> bool:
        """Establish connection to broker"""
        try:
            with self.lock:
                if self.connected and self.client and self.client.is_connected():
                    return True

                client_id = f"payload_static_{self.template_id}_{int(time.time())}"

                self.client = mqtt.Client(client_id=client_id, clean_session=True)

                # Set up credentials if provided
                if self.broker_config.get('username'):
                    self.client.username_pw_set(
                        self.broker_config['username'],
                        self.broker_config.get('password', '')
                    )

                # Set up TLS if required
                if self.broker_config.get('ssl', False):
                    self.client.tls_set()

                # Connection timeout
                connect_timeout = self.broker_config.get('connect_timeout', 10)

                # Attempt connection
                start_time = time.time()
                connected = False

                def on_connect(client, userdata, flags, rc):
                    nonlocal connected
                    if rc == 0:
                        connected = True
                        print(f"✅ Broker {self.template_id} connected successfully")
                    else:
                        print(f"❌ Broker {self.template_id} connection failed with code: {rc}")

                self.client.on_connect = on_connect

                try:
                    print(f"🔄 Connecting to {self.broker_config['host']}:{self.broker_config['port']}...")
                    self.client.connect(
                        self.broker_config['host'],
                        self.broker_config['port'],
                        keepalive=self.broker_config.get('keepalive', 60)
                    )

                    # Start network loop
                    self.client.loop_start()

                    # Wait for connection with timeout
                    timeout = connect_timeout
                    while timeout > 0 and not connected:
                        time.sleep(0.1)
                        timeout -= 0.1

                    if connected:
                        self.connected = True
                        self.last_connected = datetime.now()
                        self.connection_attempts += 1
                        self.last_error = None

                        # Record response time
                        response_time = time.time() - start_time
                        self.response_times.append(response_time)

                        # Keep only last 10 response times
                        if len(self.response_times) > 10:
                            self.response_times.pop(0)

                        print(f"✅ Broker {self.template_id} connection established")
                        return True
                    else:
                        self.last_error = f"Connection timeout after {connect_timeout}s"
                        print(f"❌ Broker {self.template_id} connection timeout")
                        return False

                except Exception as e:
                    self.last_error = str(e)
                    print(f"❌ Broker {self.template_id} connection error: {e}")
                    return False

        except Exception as e:
            print(f"❌ Error in connect for {self.template_id}: {e}")
            self.last_error = str(e)
            return False

    def disconnect(self):
        """Disconnect from broker"""
        with self.lock:
            if self.client and self.connected:
                self.client.loop_stop()
                self.client.disconnect()
                self.connected = False

    def publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False) -> bool:
        """Publish message to broker"""
        try:
            if not self.connected or not self.client:
                if not self.connect():
                    return False

            start_time = time.time()
            result = self.client.publish(topic, payload, qos=qos, retain=retain)

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                # Record response time
                response_time = time.time() - start_time
                self.response_times.append(response_time)
                if len(self.response_times) > 10:
                    self.response_times.pop(0)
                return True
            else:
                self.last_error = f"Publish failed with code: {result.rc}"
                return False

        except Exception as e:
            self.last_error = str(e)
            return False

    def is_healthy(self) -> bool:
        """Check if broker connection is healthy"""
        if not self.connected:
            return False

        # Check if connection is too old (no ping for 2 minutes)
        if self.last_connected:
            time_since_last_connection = datetime.now() - self.last_connected
            if time_since_last_connection.total_seconds() > 120:
                return False

        # Check average response time (should be < 5 seconds)
        if self.response_times:
            avg_response_time = sum(self.response_times) / len(self.response_times)
            if avg_response_time > 5.0:
                return False

        return True

    def get_health_score(self) -> float:
        """Get health score (0-100)"""
        if not self.connected:
            return 0.0

        score = 100.0

        # Penalize for connection attempts
        if self.connection_attempts > 5:
            score -= min(50, self.connection_attempts * 5)

        # Penalize for slow response times
        if self.response_times:
            avg_response = sum(self.response_times) / len(self.response_times)
            if avg_response > 2.0:
                score -= min(30, avg_response * 5)

        # Penalize for recent errors
        if self.last_error:
            score -= 20

        return max(0.0, score)

class BrokerResolver:
    """Advanced broker resolver with template support and health monitoring"""

    def __init__(self, payload_config_file: str = "./JSON/payloadStaticConfig.json"):
        self.payload_config_file = payload_config_file
        self.template_manager = BrokerTemplateManager()
        self.broker_connections: Dict[str, BrokerConnection] = {}
        self.logger = logging.getLogger("BrokerResolver")
        self.lock = threading.Lock()

    def resolve_broker_for_topic(self, topic: str, payload_data: Dict[str, Any] = None) -> Optional[BrokerConnection]:
        """Resolve the best broker for a specific topic"""
        try:
            # Load current payload configuration
            with open(self.payload_config_file, 'r') as f:
                config = json.load(f)

            payloads = config.get('payloads', [])

            # Find payload configuration for this topic
            payload_config = None
            for payload in payloads:
                if payload.get('topic') == topic:
                    payload_config = payload
                    break

            if not payload_config:
                self.logger.warning(f"No configuration found for topic: {topic}")
                return None

            # Get template configuration
            template_id = payload_config.get('template_id')
            broker_config = payload_config.get('broker_config', {})

            if not template_id:
                self.logger.error(f"No template specified for topic: {topic}")
                return None

            # Get template
            template = self.template_manager.get_template(template_id)
            if not template:
                self.logger.error(f"Template not found: {template_id}")
                return None

            # Resolve template with overrides
            resolved_config = self._resolve_broker_config(template, broker_config, payload_data)

            # Create or get existing connection
            connection_key = f"{template_id}_{resolved_config['host']}_{resolved_config['port']}"

            with self.lock:
                if connection_key not in self.broker_connections:
                    self.broker_connections[connection_key] = BrokerConnection(resolved_config, template_id)

                connection = self.broker_connections[connection_key]

                # Try to connect if not connected
                if not connection.is_healthy():
                    self.logger.info(f"Broker {connection_key} not healthy, attempting reconnection...")
                    connection.disconnect()
                    if not connection.connect():
                        self.logger.error(f"Failed to connect to broker {connection_key}")
                        return None

                return connection

        except Exception as e:
            self.logger.error(f"Error resolving broker for topic {topic}: {e}")
            return None

    def _resolve_broker_config(self, template: Dict[str, Any], broker_config: Dict[str, Any], payload_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Resolve broker configuration with template and overrides"""
        try:
            # Start with template config
            resolved = json.loads(json.dumps(template.get('config', {})))

            # Apply broker_config overrides
            overrides = broker_config.get('overrides', {})
            resolved.update(overrides)

            # Apply payload-specific overrides
            if payload_data:
                payload_overrides = payload_data.get('broker_overrides', {})
                resolved.update(payload_overrides)

            # Resolve variables
            variables = payload_data.get('broker_variables', {}) if payload_data else {}
            resolved = self.template_manager.resolve_template_variables(resolved, variables)

            return resolved

        except Exception as e:
            self.logger.error(f"Error resolving broker config: {e}")
            return template.get('config', {})

    def get_best_broker_for_topic(self, topic: str, payload_data: Dict[str, Any] = None) -> Optional[BrokerConnection]:
        """Get the best available broker for a topic (with enhanced failover support)"""
        try:
            # Try primary broker first
            primary_broker = self.resolve_broker_for_topic(topic, payload_data)
            if primary_broker:
                # Try to connect if not connected
                if not primary_broker.connected:
                    if primary_broker.connect():
                        return primary_broker
                elif primary_broker.is_healthy():
                    return primary_broker

            # If primary fails, try fallback brokers from template
            fallback_brokers = self._get_fallback_brokers(topic, payload_data)
            for fallback_broker in fallback_brokers:
                if fallback_broker.connect():
                    self.logger.info(f"Using fallback broker for topic {topic}")
                    return fallback_broker

            # If fallback fails, try alternative brokers (same category)
            alternative_brokers = self._get_alternative_brokers(topic, payload_data)
            for alt_broker in alternative_brokers:
                if alt_broker.connect():
                    self.logger.info(f"Using alternative broker for topic {topic}")
                    return alt_broker

            # Final fallback: use local broker
            local_broker = self._get_local_fallback_broker()
            if local_broker and local_broker.connect():
                self.logger.info(f"Using local fallback broker for topic {topic}")
                return local_broker

            self.logger.error(f"No working brokers available for topic: {topic}")
            return None

        except Exception as e:
            self.logger.error(f"Error getting best broker for topic {topic}: {e}")
            return None

    def _get_fallback_brokers(self, topic: str, payload_data: Dict[str, Any] = None) -> List[BrokerConnection]:
        """Get fallback brokers from template configuration"""
        try:
            fallbacks = []

            # Load payload config to find current template
            with open(self.payload_config_file, 'r') as f:
                config = json.load(f)

            payloads = config.get('payloads', [])
            current_template_id = None

            for payload in payloads:
                if payload.get('topic') == topic:
                    current_template_id = payload.get('template_id')
                    break

            if not current_template_id:
                return fallbacks

            # Get template with fallback brokers
            template = self.template_manager.get_template(current_template_id)
            if template and 'fallback_brokers' in template:
                for fallback_config in template.get('fallback_brokers', []):
                    try:
                        # Convert WebSocket config to MQTT if needed
                        if fallback_config.get('protocol') == 'ws':
                            fallback_config = self._convert_websocket_to_mqtt(fallback_config)

                        fallback_connection = BrokerConnection(fallback_config, f"{current_template_id}_fallback")

                        if fallback_connection.connect():
                            fallbacks.append(fallback_connection)
                    except Exception as e:
                        self.logger.warning(f"Failed to connect to fallback broker: {e}")
                        continue

            return fallbacks

        except Exception as e:
            self.logger.error(f"Error getting fallback brokers: {e}")
            return []

    def _get_alternative_brokers(self, topic: str, payload_data: Dict[str, Any] = None) -> List[BrokerConnection]:
        """Get alternative brokers for failover"""
        try:
            alternatives = []

            # Get all available templates
            all_templates = self.template_manager.get_all_templates()

            # Load payload config to find current template
            with open(self.payload_config_file, 'r') as f:
                config = json.load(f)

            payloads = config.get('payloads', [])
            current_template_id = None

            for payload in payloads:
                if payload.get('topic') == topic:
                    current_template_id = payload.get('template_id')
                    break

            if not current_template_id:
                return alternatives

            # Find alternative templates (same category, different template)
            current_template = self.template_manager.get_template(current_template_id)
            if current_template:
                current_category = current_template.get('category')

                for template in all_templates:
                    if (template.get('category') == current_category and
                        template.get('template_id') != current_template_id):

                        # Create connection for alternative template
                        alt_config = self._resolve_broker_config(template, {}, payload_data)
                        alt_connection = BrokerConnection(alt_config, template.get('template_id'))

                        if alt_connection.connect():
                            alternatives.append(alt_connection)

            return alternatives

        except Exception as e:
            self.logger.error(f"Error getting alternative brokers: {e}")
            return []

    def _get_local_fallback_broker(self) -> Optional[BrokerConnection]:
        """Get local broker as final fallback"""
        try:
            local_config = {
                "protocol": "mqtt",
                "host": "localhost",
                "port": 1883,
                "ssl": False,
                "username": "",
                "password": "",
                "qos": 0,
                "retain": False,
                "keepalive": 60,
                "connection_timeout": 5,
                "reconnect_period": 3
            }

            local_connection = BrokerConnection(local_config, "local_fallback")

            if local_connection.connect():
                return local_connection
            else:
                # Try WebSocket as final fallback
                ws_config = {
                    "protocol": "ws",
                    "host": "localhost",
                    "port": 9000,
                    "path": "/mqtt",
                    "ssl": False,
                    "username": "",
                    "password": "",
                    "qos": 0,
                    "retain": False,
                    "keepalive": 60,
                    "connection_timeout": 5,
                    "reconnect_period": 3
                }

                ws_connection = BrokerConnection(ws_config, "local_websocket_fallback")
                if ws_connection.connect():
                    return ws_connection

            return None

        except Exception as e:
            self.logger.error(f"Error getting local fallback broker: {e}")
            return None

    def _convert_websocket_to_mqtt(self, ws_config: Dict[str, Any]) -> Dict[str, Any]:
        """Convert WebSocket config to MQTT config"""
        mqtt_config = ws_config.copy()
        mqtt_config['protocol'] = 'mqtt'
        return mqtt_config

    def publish_to_topic(self, topic: str, payload: str, payload_data: Dict[str, Any] = None) -> bool:
        """Publish payload to topic using appropriate broker"""
        try:
            broker = self.get_best_broker_for_topic(topic, payload_data)
            if not broker:
                self.logger.error(f"No available broker for topic: {topic}")
                return False

            # Get QoS and retain settings
            qos = payload_data.get('qos', 0) if payload_data else 0
            retain = payload_data.get('retain', False) if payload_data else False

            return broker.publish(topic, payload, qos=qos, retain=retain)

        except Exception as e:
            self.logger.error(f"Error publishing to topic {topic}: {e}")
            return False

    def get_broker_health_report(self) -> Dict[str, Any]:
        """Get health report for all broker connections"""
        try:
            report = {
                "total_connections": len(self.broker_connections),
                "healthy_connections": 0,
                "unhealthy_connections": 0,
                "brokers": {}
            }

            for connection_key, connection in self.broker_connections.items():
                health_score = connection.get_health_score()
                is_healthy = connection.is_healthy()

                broker_info = {
                    "template_id": connection.template_id,
                    "host": connection.broker_config.get('host'),
                    "port": connection.broker_config.get('port'),
                    "connected": connection.connected,
                    "health_score": health_score,
                    "last_connected": connection.last_connected.isoformat() if connection.last_connected else None,
                    "connection_attempts": connection.connection_attempts,
                    "last_error": connection.last_error,
                    "avg_response_time": sum(connection.response_times) / len(connection.response_times) if connection.response_times else 0
                }

                report["brokers"][connection_key] = broker_info

                if is_healthy:
                    report["healthy_connections"] += 1
                else:
                    report["unhealthy_connections"] += 1

            return report

        except Exception as e:
            self.logger.error(f"Error generating health report: {e}")
            return {"error": str(e)}

    def cleanup_unhealthy_connections(self):
        """Clean up unhealthy broker connections"""
        try:
            unhealthy_keys = []

            for connection_key, connection in self.broker_connections.items():
                if not connection.is_healthy():
                    connection.disconnect()
                    unhealthy_keys.append(connection_key)

            for key in unhealthy_keys:
                del self.broker_connections[key]

            if unhealthy_keys:
                self.logger.info(f"Cleaned up {len(unhealthy_keys)} unhealthy connections")

        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")

    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        try:
            stats = {
                "total_templates": len(self.template_manager.templates),
                "active_connections": len(self.broker_connections),
                "template_categories": {}
            }

            # Count templates by category
            for template in self.template_manager.templates.values():
                category = template.get('category', 'unknown')
                stats["template_categories"][category] = stats["template_categories"].get(category, 0) + 1

            return stats

        except Exception as e:
            self.logger.error(f"Error getting connection stats: {e}")
            return {"error": str(e)}
