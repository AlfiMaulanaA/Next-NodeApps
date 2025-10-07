#!/usr/bin/env python3
"""
Test script to verify payload static template update functionality
"""
import json
import time
import paho.mqtt.client as mqtt
from datetime import datetime

class PayloadTemplateUpdateTest:
    def __init__(self):
        self.client = mqtt.Client(client_id="payload-template-test-client", clean_session=True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.test_results = {
            "create_response": False,
            "update_response": False,
            "template_updated": False
        }

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Test client connected to MQTT broker")
            client.subscribe("response/data/write")
            client.subscribe("response/data/update")
        else:
            print(f"❌ Test client connection failed with code {rc}")

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            print(f"📨 Received on {msg.topic}: {json.dumps(payload, indent=2)}")

            if msg.topic == "response/data/write" and payload.get("status") == "success":
                self.test_results["create_response"] = True
                print("✅ Create operation successful")

            elif msg.topic == "response/data/update" and payload.get("status") == "success":
                self.test_results["update_response"] = True
                # Check if template was updated
                if payload.get("data", {}).get("template_id") == "updated_template_456":
                    self.test_results["template_updated"] = True
                    print("✅ Template update verified in response")
                else:
                    print(f"❌ Template not updated. Expected: 'updated_template_456', Got: {payload.get('data', {}).get('template_id')}")

        except Exception as e:
            print(f"❌ Error processing message: {e}")

    def run_test(self):
        print("🚀 Starting Payload Template Update Test")
        print("=" * 50)

        try:
            # Connect to broker
            self.client.connect("localhost", 1883, 60)
            self.client.loop_start()

            time.sleep(2)  # Wait for connection

            # Test 1: Create payload with initial template
            print("\n📝 Test 1: Creating payload with initial template")
            create_payload = {
                "command": "writeData",
                "topic": "test/template/update",
                "data": {"temperature": 25, "humidity": 60},
                "interval": 5,
                "qos": 1,
                "lwt": True,
                "retain": False,
                "template_id": "initial_template_123"
            }

            self.client.publish("command/data/payload", json.dumps(create_payload))
            print("📤 Published create command")

            # Wait for create response
            timeout = 10
            start_time = time.time()
            while not self.test_results["create_response"] and (time.time() - start_time) < timeout:
                time.sleep(0.5)

            if not self.test_results["create_response"]:
                print("❌ Create operation timed out")
                return False

            time.sleep(2)  # Wait a bit

            # Test 2: Update payload with new template
            print("\n📝 Test 2: Updating payload with new template")
            update_payload = {
                "command": "updateData",
                "originalTopic": "test/template/update",
                "topic": "test/template/update",
                "data": [{"key": "temperature", "value": 30}, {"key": "humidity", "value": 65}],
                "interval": 10,
                "qos": 1,
                "lwt": True,
                "retain": False,
                "template_id": "updated_template_456"
            }

            self.client.publish("command/data/payload", json.dumps(update_payload))
            print("📤 Published update command")

            # Wait for update response
            start_time = time.time()
            while not self.test_results["update_response"] and (time.time() - start_time) < timeout:
                time.sleep(0.5)

            if not self.test_results["update_response"]:
                print("❌ Update operation timed out")
                return False

            time.sleep(2)  # Wait for verification

            # Test Results
            print("\n📊 Test Results:")
            print("=" * 30)
            print(f"✅ Create Response: {self.test_results['create_response']}")
            print(f"✅ Update Response: {self.test_results['update_response']}")
            print(f"✅ Template Updated: {self.test_results['template_updated']}")

            all_passed = all(self.test_results.values())

            if all_passed:
                print("\n🎉 ALL TESTS PASSED!")
                print("✅ Payload template update functionality is working correctly")
            else:
                print("\n❌ SOME TESTS FAILED!")
                print("❌ Payload template update functionality has issues")

            return all_passed

        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            return False

        finally:
            self.client.loop_stop()
            self.client.disconnect()

if __name__ == "__main__":
    test = PayloadTemplateUpdateTest()
    success = test.run_test()
    exit(0 if success else 1)
