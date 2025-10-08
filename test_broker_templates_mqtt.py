#!/usr/bin/env python3
"""
Test script for Broker Templates MQTT functionality
"""
import json
import time
import paho.mqtt.client as mqtt
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = "localhost"
MQTT_PORT = 1883

# Test template data
TEST_TEMPLATE = {
    "template_id": "test_template_mqtt_001",
    "name": "Test MQTT Template",
    "description": "Template for testing MQTT functionality",
    "category": "development",
    "config": {
        "protocol": "mqtt",
        "host": "localhost",
        "port": 1883,
        "ssl": False,
        "username": "",
        "password": "",
        "qos": 1,
        "retain": False,
        "keepalive": 60,
        "connection_timeout": 5,
        "reconnect_period": 3
    },
    "fallback_brokers": [],
    "metadata": {
        "created_by": "test_script",
        "version": "1.0",
        "last_updated": datetime.now().isoformat()
    }
}

class MQTTTestClient:
    def __init__(self):
        self.client = mqtt.Client(client_id="broker-templates-test-client", clean_session=True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

        self.received_messages = []
        self.connected = False

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Test client connected to MQTT broker")
            self.connected = True

            # Subscribe to response and error topics
            client.subscribe("broker-templates/response", qos=1)
            client.subscribe("broker-templates/error", qos=1)
            client.subscribe("broker-templates/create", qos=1)
            client.subscribe("broker-templates/update", qos=1)
            client.subscribe("broker-templates/delete", qos=1)
            print("📡 Subscribed to broker templates topics")
        else:
            print(f"❌ Failed to connect to MQTT broker, return code: {rc}")

    def on_disconnect(self, client, userdata, rc):
        print(f"📴 Test client disconnected from MQTT broker, return code: {rc}")
        self.connected = False

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode('utf-8'))
            print(f"📨 Received message on topic '{msg.topic}': {json.dumps(payload, indent=2)}")
            self.received_messages.append({
                'topic': msg.topic,
                'payload': payload,
                'timestamp': datetime.now().isoformat()
            })
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse message on topic '{msg.topic}': {e}")

    def connect(self):
        try:
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            time.sleep(2)  # Wait for connection
            return self.connected
        except Exception as e:
            print(f"❌ Failed to connect to MQTT broker: {e}")
            return False

    def disconnect(self):
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            print("🔌 Test client disconnected")

    def publish_test_message(self, topic, payload):
        if self.connected:
            self.client.publish(topic, json.dumps(payload), qos=1, retain=False)
            print(f"📤 Published test message to topic '{topic}': {json.dumps(payload, indent=2)}")
            return True
        else:
            print("❌ Cannot publish: not connected to MQTT broker")
            return False

def test_broker_templates_mqtt():
    print("🚀 Starting Broker Templates MQTT Test")
    print("=" * 50)

    # Initialize test client
    test_client = MQTTTestClient()

    # Connect to MQTT broker
    if not test_client.connect():
        print("❌ Test failed: Could not connect to MQTT broker")
        return False

    try:
        # Test 1: Create template via MQTT
        print("\n📝 Test 1: Creating template via MQTT")
        create_payload = {
            "template": TEST_TEMPLATE,
            "timestamp": datetime.now().isoformat()
        }
        test_client.publish_test_message("broker-templates/create", create_payload)

        # Wait for response
        time.sleep(3)

        # Test 2: Update template via MQTT
        print("\n📝 Test 2: Updating template via MQTT")
        update_payload = {
            "template_id": TEST_TEMPLATE["template_id"],
            "template": {
                **TEST_TEMPLATE,
                "name": "Updated Test MQTT Template",
                "description": "Updated description for MQTT testing"
            },
            "timestamp": datetime.now().isoformat()
        }
        test_client.publish_test_message("broker-templates/update", update_payload)

        # Wait for response
        time.sleep(3)

        # Test 3: Delete template via MQTT
        print("\n📝 Test 3: Deleting template via MQTT")
        delete_payload = {
            "template_id": TEST_TEMPLATE["template_id"],
            "timestamp": datetime.now().isoformat()
        }
        test_client.publish_test_message("broker-templates/delete", delete_payload)

        # Wait for response
        time.sleep(3)

        # Analyze results
        print("\n📊 Test Results Analysis")
        print("-" * 30)

        create_responses = [msg for msg in test_client.received_messages if msg['topic'] == 'broker-templates/response' and msg['payload'].get('action') == 'created']
        update_responses = [msg for msg in test_client.received_messages if msg['topic'] == 'broker-templates/response' and msg['payload'].get('action') == 'updated']
        delete_responses = [msg for msg in test_client.received_messages if msg['topic'] == 'broker-templates/response' and msg['payload'].get('action') == 'deleted']

        print(f"✅ Create responses received: {len(create_responses)}")
        print(f"✅ Update responses received: {len(update_responses)}")
        print(f"✅ Delete responses received: {len(delete_responses)}")

        # Check for errors
        error_messages = [msg for msg in test_client.received_messages if msg['topic'] == 'broker-templates/error']
        if error_messages:
            print(f"⚠️  Error messages received: {len(error_messages)}")
            for error in error_messages:
                print(f"   - {error['payload'].get('error', 'Unknown error')}")

        # Overall test result
        expected_responses = 3  # create, update, delete
        actual_responses = len(create_responses) + len(update_responses) + len(delete_responses)

        if actual_responses >= expected_responses and len(error_messages) == 0:
            print("\n🎉 Test PASSED: All MQTT operations completed successfully!")
            return True
        else:
            print(f"\n❌ Test FAILED: Expected {expected_responses} responses, got {actual_responses}")
            return False

    finally:
        test_client.disconnect()

if __name__ == "__main__":
    success = test_broker_templates_mqtt()
    exit(0 if success else 1)
