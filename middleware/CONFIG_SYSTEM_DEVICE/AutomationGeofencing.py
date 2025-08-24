#!/usr/bin/env python3
"""
AutomationGeofencing.py - Geofencing Automation System
Handles geofence area management, location tracking, and automatic device control

Author: IoT Automation System
Date: 2024
"""

import json
import os
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import math
import paho.mqtt.client as mqtt
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class GeofenceArea:
    """Represents a geofence area (polygon or circle)"""
    
    def __init__(self, area_data: Dict[str, Any]):
        self.id = area_data.get('id', '')
        self.name = area_data.get('name', '')
        self.description = area_data.get('description', '')
        self.type = area_data.get('type', 'polygon')  # polygon or circle
        self.coordinates = area_data.get('coordinates', [])
        self.center = area_data.get('center', {})
        self.radius = area_data.get('radius', 0)  # in meters
        
    def is_point_inside(self, lat: float, lng: float) -> bool:
        """Check if a point is inside this geofence area"""
        if self.type == "circle":
            return self._is_point_in_circle(lat, lng)
        elif self.type == "polygon":
            return self._is_point_in_polygon(lat, lng)
        return False
    
    def _is_point_in_circle(self, lat: float, lng: float) -> bool:
        """Check if point is inside circle"""
        if not self.center or not self.radius:
            return False
            
        distance = self._calculate_distance(
            lat, lng, 
            self.center.get('lat', 0), 
            self.center.get('lng', 0)
        )
        return distance <= self.radius
    
    def _is_point_in_polygon(self, lat: float, lng: float) -> bool:
        """Check if point is inside polygon using ray casting algorithm"""
        if len(self.coordinates) < 3:
            return False
            
        x, y = lng, lat
        n = len(self.coordinates)
        inside = False
        
        p1x, p1y = self.coordinates[0]['lng'], self.coordinates[0]['lat']
        for i in range(1, n + 1):
            p2x, p2y = self.coordinates[i % n]['lng'], self.coordinates[i % n]['lat']
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        
        return inside
    
    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat / 2) * math.sin(delta_lat / 2) +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lng / 2) * math.sin(delta_lng / 2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c

class GeofenceRule:
    """Represents a geofence rule with triggers and actions"""
    
    def __init__(self, rule_data: Dict[str, Any]):
        self.id = rule_data.get('id', '')
        self.name = rule_data.get('name', '')
        self.area_id = rule_data.get('area_id', '')
        self.trigger_type = rule_data.get('trigger_type', 'enter')  # enter, exit, both
        self.enabled = rule_data.get('enabled', True)
        self.actions = rule_data.get('actions', [])
        self.users = rule_data.get('users', [])
        self.created_at = rule_data.get('created_at', datetime.now().isoformat())
        self.last_triggered = rule_data.get('last_triggered', None)
        
        # Track user states for this rule
        self.user_states: Dict[str, bool] = {}  # user_id -> inside_area

class LocationTracker:
    """Tracks user/device locations and manages geofence events"""
    
    def __init__(self):
        self.user_locations: Dict[str, Dict[str, Any]] = {}
        self.location_history: Dict[str, List[Dict[str, Any]]] = {}
        self.max_history = 100  # Keep last 100 locations per user
    
    def update_location(self, user_id: str, lat: float, lng: float, timestamp: str = None):
        """Update user location"""
        if timestamp is None:
            timestamp = datetime.now().isoformat()
            
        location_data = {
            'lat': lat,
            'lng': lng,
            'timestamp': timestamp,
            'accuracy': None  # Can be added later
        }
        
        self.user_locations[user_id] = location_data
        
        # Add to history
        if user_id not in self.location_history:
            self.location_history[user_id] = []
            
        self.location_history[user_id].append(location_data)
        
        # Limit history size
        if len(self.location_history[user_id]) > self.max_history:
            self.location_history[user_id] = self.location_history[user_id][-self.max_history:]
    
    def get_user_location(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get current user location"""
        return self.user_locations.get(user_id)

class AutomationGeofencing:
    """Main geofencing automation system"""
    
    def __init__(self, mqtt_config: Dict[str, Any] = None):
        self.config_dir = "JSON/Config"
        self.geofence_file = os.path.join(self.config_dir, "geofencing.json")
        
        # Ensure config directory exists
        os.makedirs(self.config_dir, exist_ok=True)
        
        # Initialize components
        self.areas: Dict[str, GeofenceArea] = {}
        self.rules: Dict[str, GeofenceRule] = {}
        self.location_tracker = LocationTracker()
        
        # MQTT Configuration
        self.mqtt_config = mqtt_config or {
            "broker": "localhost",
            "port": 1883,
            "username": None,
            "password": None
        }
        
        # MQTT Client
        self.mqtt_client = None
        self.mqtt_connected = False
        
        # Topics
        self.topics = {
            "geofence_data": "geofence/data",
            "geofence_create": "geofence/create",
            "geofence_update": "geofence/update",
            "geofence_delete": "geofence/delete",
            "geofence_request": "geofence/request_data",
            "location_update": "geofence/location/update",
            "device_control": "modular",
            "modular_availables": "MODULAR_DEVICE/AVAILABLES",
            "modbus_availables": "MODBUS_DEVICE/AVAILABLES"
        }
        
        # Load existing configuration
        self.load_configuration()
        
        # Initialize MQTT
        self.init_mqtt()
        
        # Start monitoring thread
        self.monitoring_active = True
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        
        logger.info("AutomationGeofencing system initialized")
    
    def load_configuration(self):
        """Load geofencing configuration from JSON file"""
        try:
            if os.path.exists(self.geofence_file):
                with open(self.geofence_file, 'r') as f:
                    data = json.load(f)
                    
                # Load areas
                for area_data in data.get('areas', []):
                    area = GeofenceArea(area_data)
                    self.areas[area.id] = area
                    
                # Load rules
                for rule_data in data.get('rules', []):
                    rule = GeofenceRule(rule_data)
                    self.rules[rule.id] = rule
                    
                logger.info(f"Loaded {len(self.areas)} areas and {len(self.rules)} rules")
            else:
                logger.info("No existing geofencing configuration found, starting fresh")
                
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
    
    def save_configuration(self):
        """Save geofencing configuration to JSON file"""
        try:
            data = {
                "areas": [self._area_to_dict(area) for area in self.areas.values()],
                "rules": [self._rule_to_dict(rule) for rule in self.rules.values()],
                "last_updated": datetime.now().isoformat()
            }
            
            with open(self.geofence_file, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            logger.info("Configuration saved successfully")
            
        except Exception as e:
            logger.error(f"Error saving configuration: {e}")
    
    def _area_to_dict(self, area: GeofenceArea) -> Dict[str, Any]:
        """Convert GeofenceArea to dictionary"""
        return {
            "id": area.id,
            "name": area.name,
            "description": area.description,
            "type": area.type,
            "coordinates": area.coordinates,
            "center": area.center,
            "radius": area.radius
        }
    
    def _rule_to_dict(self, rule: GeofenceRule) -> Dict[str, Any]:
        """Convert GeofenceRule to dictionary"""
        return {
            "id": rule.id,
            "name": rule.name,
            "area_id": rule.area_id,
            "trigger_type": rule.trigger_type,
            "enabled": rule.enabled,
            "actions": rule.actions,
            "users": rule.users,
            "created_at": rule.created_at,
            "last_triggered": rule.last_triggered
        }
    
    def init_mqtt(self):
        """Initialize MQTT connection"""
        try:
            self.mqtt_client = mqtt.Client()
            
            # Set callbacks
            self.mqtt_client.on_connect = self._on_mqtt_connect
            self.mqtt_client.on_disconnect = self._on_mqtt_disconnect
            self.mqtt_client.on_message = self._on_mqtt_message
            
            # Set credentials if provided
            if self.mqtt_config.get("username"):
                self.mqtt_client.username_pw_set(
                    self.mqtt_config["username"],
                    self.mqtt_config.get("password", "")
                )
            
            # Connect
            self.mqtt_client.connect(
                self.mqtt_config["broker"],
                self.mqtt_config["port"],
                60
            )
            
            # Start loop
            self.mqtt_client.loop_start()
            
        except Exception as e:
            logger.error(f"Failed to initialize MQTT: {e}")
    
    def _on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT connection callback"""
        if rc == 0:
            self.mqtt_connected = True
            logger.info("Connected to MQTT broker")
            
            # Subscribe to topics
            for topic in [
                self.topics["geofence_create"],
                self.topics["geofence_update"], 
                self.topics["geofence_delete"],
                self.topics["geofence_request"],
                self.topics["location_update"]
            ]:
                client.subscribe(topic)
                logger.info(f"Subscribed to {topic}")
                
            # Publish initial data
            self._publish_geofence_data()
            
        else:
            logger.error(f"Failed to connect to MQTT broker: {rc}")
    
    def _on_mqtt_disconnect(self, client, userdata, rc):
        """MQTT disconnection callback"""
        self.mqtt_connected = False
        logger.warning("Disconnected from MQTT broker")
    
    def _on_mqtt_message(self, client, userdata, msg):
        """MQTT message callback"""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())
            
            logger.info(f"Received message on {topic}: {payload}")
            
            if topic == self.topics["geofence_create"]:
                self._handle_create_rule(payload)
            elif topic == self.topics["geofence_update"]:
                self._handle_update_rule(payload)
            elif topic == self.topics["geofence_delete"]:
                self._handle_delete_rule(payload)
            elif topic == self.topics["geofence_request"]:
                self._publish_geofence_data()
            elif topic == self.topics["location_update"]:
                self._handle_location_update(payload)
                
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")
    
    def _handle_create_rule(self, payload: Dict[str, Any]):
        """Handle create rule request"""
        try:
            rule = GeofenceRule(payload)
            self.rules[rule.id] = rule
            
            self.save_configuration()
            self._publish_geofence_data()
            
            logger.info(f"Created geofence rule: {rule.name}")
            
        except Exception as e:
            logger.error(f"Error creating rule: {e}")
    
    def _handle_update_rule(self, payload: Dict[str, Any]):
        """Handle update rule request"""
        try:
            rule_id = payload.get('id')
            if rule_id and rule_id in self.rules:
                rule = GeofenceRule(payload)
                self.rules[rule_id] = rule
                
                self.save_configuration()
                self._publish_geofence_data()
                
                logger.info(f"Updated geofence rule: {rule.name}")
            else:
                logger.warning(f"Rule not found for update: {rule_id}")
                
        except Exception as e:
            logger.error(f"Error updating rule: {e}")
    
    def _handle_delete_rule(self, payload: Dict[str, Any]):
        \"\"\"Handle delete rule request\"\"\"
        try:
            rule_id = payload.get('id')
            if rule_id and rule_id in self.rules:
                rule_name = self.rules[rule_id].name
                del self.rules[rule_id]
                
                self.save_configuration()
                self._publish_geofence_data()
                
                logger.info(f"Deleted geofence rule: {rule_name}")
            else:
                logger.warning(f"Rule not found for deletion: {rule_id}")
                
        except Exception as e:
            logger.error(f"Error deleting rule: {e}")
    
    def _handle_location_update(self, payload: Dict[str, Any]):
        \"\"\"Handle location update from user/device\"\"\"
        try:
            user_id = payload.get('user_id')
            lat = payload.get('lat')
            lng = payload.get('lng')
            timestamp = payload.get('timestamp')
            
            if user_id and lat is not None and lng is not None:
                self.location_tracker.update_location(user_id, lat, lng, timestamp)
                self._check_geofence_triggers(user_id, lat, lng)
                
                logger.info(f"Updated location for user {user_id}: {lat}, {lng}")
            else:
                logger.warning(f"Invalid location update payload: {payload}")
                
        except Exception as e:
            logger.error(f"Error handling location update: {e}")
    
    def _check_geofence_triggers(self, user_id: str, lat: float, lng: float):
        \"\"\"Check if location update triggers any geofence rules\"\"\"
        try:
            for rule in self.rules.values():
                if not rule.enabled:
                    continue
                    
                # Check if user is tracked by this rule
                if rule.users and user_id not in rule.users:
                    continue
                
                # Get the area for this rule
                area = self.areas.get(rule.area_id)
                if not area:
                    continue
                
                # Check if user is inside the area
                is_inside = area.is_point_inside(lat, lng)
                
                # Get previous state
                was_inside = rule.user_states.get(user_id, False)
                
                # Determine if we should trigger
                should_trigger = False
                
                if rule.trigger_type == "enter" and is_inside and not was_inside:
                    should_trigger = True
                elif rule.trigger_type == "exit" and not is_inside and was_inside:
                    should_trigger = True
                elif rule.trigger_type == "both" and is_inside != was_inside:
                    should_trigger = True
                
                # Update state
                rule.user_states[user_id] = is_inside
                
                # Trigger actions if needed
                if should_trigger:
                    self._execute_rule_actions(rule, user_id, is_inside)
                    rule.last_triggered = datetime.now().isoformat()
                
        except Exception as e:
            logger.error(f"Error checking geofence triggers: {e}")
    
    def _execute_rule_actions(self, rule: GeofenceRule, user_id: str, entered: bool):
        \"\"\"Execute actions for triggered rule\"\"\"
        try:
            logger.info(f"Executing actions for rule '{rule.name}' - User: {user_id}, Entered: {entered}")
            
            for action in rule.actions:
                # Add delay if specified
                delay = action.get('delay', 0)
                if delay > 0:
                    threading.Timer(delay, self._execute_single_action, args=[action, user_id, entered]).start()
                else:
                    self._execute_single_action(action, user_id, entered)
                    
        except Exception as e:
            logger.error(f"Error executing rule actions: {e}")
    
    def _execute_single_action(self, action: Dict[str, Any], user_id: str, entered: bool):
        \"\"\"Execute a single action\"\"\"
        try:
            device_name = action.get('device_name')
            pin = action.get('pin', 1)
            action_type = action.get('action')
            address = action.get('address', 0)
            device_bus = action.get('device_bus', 0)
            
            if not device_name or not action_type:
                logger.warning(f"Invalid action configuration: {action}")
                return
            
            # Determine the state based on action type
            if action_type == "on":
                new_state = 1
            elif action_type == "off":
                new_state = 0
            elif action_type == "toggle":
                # For toggle, we need to track current state (simplified implementation)
                new_state = 1 if entered else 0
            else:
                logger.warning(f"Unknown action type: {action_type}")
                return
            
            # Create control payload
            control_payload = {
                "mac": self._get_mac_address(),
                "protocol_type": "Modular",
                "device": "RELAYMINI",
                "function": "write",
                "value": {
                    "pin": pin,
                    "data": new_state
                },
                "address": address,
                "device_bus": device_bus,
                "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            # Publish control command
            if self.mqtt_client and self.mqtt_connected:
                self.mqtt_client.publish(
                    self.topics["device_control"],
                    json.dumps(control_payload)
                )
                
                logger.info(f"Executed action: {device_name} Pin {pin} -> {'ON' if new_state else 'OFF'}")
            else:
                logger.warning("MQTT not connected, cannot execute action")
                
        except Exception as e:
            logger.error(f"Error executing single action: {e}")
    
    def _get_mac_address(self) -> str:
        \"\"\"Get MAC address for device control (simplified implementation)\"\"\"
        # This should be retrieved from actual MQTT broker data
        # For now, return a placeholder
        return "00:00:00:00:00:00"
    
    def _publish_geofence_data(self):
        \"\"\"Publish current geofencing data to MQTT\"\"\"
        try:
            if self.mqtt_client and self.mqtt_connected:
                data = {
                    "rules": [self._rule_to_dict(rule) for rule in self.rules.values()],
                    "areas": [self._area_to_dict(area) for area in self.areas.values()],
                    "timestamp": datetime.now().isoformat()
                }
                
                self.mqtt_client.publish(self.topics["geofence_data"], json.dumps(data))
                logger.info("Published geofence data to MQTT")
                
        except Exception as e:
            logger.error(f"Error publishing geofence data: {e}")
    
    def _monitoring_loop(self):
        \"\"\"Background monitoring loop\"\"\"
        while self.monitoring_active:
            try:
                # Periodic tasks can be added here
                # For example: cleanup old location data, health checks, etc.
                
                time.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(60)
    
    def add_area(self, area_data: Dict[str, Any]) -> bool:
        \"\"\"Add a new geofence area\"\"\"
        try:
            area = GeofenceArea(area_data)
            self.areas[area.id] = area
            self.save_configuration()
            self._publish_geofence_data()
            return True
        except Exception as e:
            logger.error(f"Error adding area: {e}")
            return False
    
    def simulate_location(self, user_id: str, lat: float, lng: float):
        \"\"\"Simulate location update (for testing)\"\"\"
        self._handle_location_update({
            "user_id": user_id,
            "lat": lat,
            "lng": lng,
            "timestamp": datetime.now().isoformat()
        })
    
    def get_status(self) -> Dict[str, Any]:
        \"\"\"Get system status\"\"\"
        return {
            "mqtt_connected": self.mqtt_connected,
            "total_areas": len(self.areas),
            "total_rules": len(self.rules),
            "active_rules": len([r for r in self.rules.values() if r.enabled]),
            "tracked_users": len(self.location_tracker.user_locations),
            "last_updated": datetime.now().isoformat()
        }
    
    def shutdown(self):
        \"\"\"Shutdown the system gracefully\"\"\"
        logger.info("Shutting down AutomationGeofencing system...")
        
        self.monitoring_active = False
        
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        
        self.save_configuration()
        logger.info("System shutdown complete")

def main():
    \"\"\"Main function for testing\"\"\"
    logging.basicConfig(level=logging.INFO)
    
    # MQTT configuration
    mqtt_config = {
        "broker": "localhost",
        "port": 1883,
        "username": None,
        "password": None
    }
    
    # Create geofencing system
    geofencing = AutomationGeofencing(mqtt_config)
    
    try:
        # Keep the system running
        while True:
            status = geofencing.get_status()
            logger.info(f"System status: {status}")
            time.sleep(60)
            
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    finally:
        geofencing.shutdown()

if __name__ == "__main__":
    main()