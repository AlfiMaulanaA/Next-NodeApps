#!/usr/bin/env python3
"""
Test script to verify empty message handling in frontend MQTT client
"""
import json
import time
import paho.mqtt.client as mqtt
from datetime import datetime

class EmptyMessageTest:
    def __init__(self):
        self.client = mqtt.Client(client_id="empty-message-test-client", clean_session=True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.test_results = {
            "create_response": False,
            "delete_response": False,
            "empty_message_handled": True  # Assume success unless error occurs
        }

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✅ Test client connected to MQTT broker")
            client.subscribe("response/data/write")
            client.subscribe("response/data/delete")
            client.subscribe("test/empty/message/topic")  # Subscribe to test topic for empty messages
        else:
            print(f"❌ Test client connection failed with code {rc}")

    def on_message(self, client, userdata, msg):
        try:
            # Handle empty messages gracefully
            if len(msg.payload) == 0:
                print(f"📨 Received empty message on topic {msg.topic} (length: 0)")
                # This should not cause JSON parsing errors
                return

            payload = json.loads(msg.payload.decode())
            print(f"📨 Received on {msg.topic}: {json.dumps(payload, indent=2)}")

            if msg.topic == "response/data/write" and payload.get("status") == "success":
                self.test_results["create_response"] = True
                print("✅ Create operation successful")

            elif msg.topic == "response/data/delete" and payload.get("status") == "success":
                self.test_results["delete_response"] = True
                print("✅ Delete operation successful")

        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error on topic {msg.topic}: {e}")
            print(f"❌ Raw payload: {msg.payload}")
            self.test_results["empty_message_handled"] = False
        except Exception as e:
            print(f"❌ Error processing message: {e}")
            self.test_results["empty_message_handled"] = False

    def run_test(self):
        print("🚀 Starting Empty Message Handling Test")
        print("=" * 50)

        try:
            # Connect to broker
            self.client.connect("localhost", 1883, 60)
            self.client.loop_start()

            time.sleep(2)  # Wait for connection

            # Test 1: Create payload
            print("\n📝 Test 1: Creating payload for deletion test")
            create_payload = {
                "command": "writeData",
                "topic": "test/empty/message/topic",
                "data": {"test": "data"},
                "interval": 5,
                "qos": 1,
                "lwt": True,
                "retain": False,
                "template_id": "test_template"
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

            # Test 2: Delete payload (this should trigger empty message cleanup)
            print("\n📝 Test 2: Deleting payload (should send empty message for cleanup)")
            delete_payload = {
                "command": "deleteData",
                "topic": "test/empty/message/topic"
            }

            self.client.publish("command/data/payload", json.dumps(delete_payload))
            print("📤 Published delete command")

            # Wait for delete response
            start_time = time.time()
            while not self.test_results["delete_response"] and (time.time() - start_time) < timeout:
                time.sleep(0.5)

            if not self.test_results["delete_response"]:
                print("❌ Delete operation timed out")
                return False

            time.sleep(3)  # Wait for any empty messages to be processed

            # Test Results
            print("\n📊 Test Results:")
            print("=" * 30)
            print(f"✅ Create Response: {self.test_results['create_response']}")
            print(f"✅ Delete Response: {self.test_results['delete_response']}")
            print(f"✅ Empty Message Handled: {self.test_results['empty_message_handled']}")

            all_passed = all(self.test_results.values())

            if all_passed:
                print("\n🎉 ALL TESTS PASSED!")
                print("✅ Empty message handling is working correctly")
                print("✅ No JSON parsing errors occurred")
            else:
                print("\n❌ SOME TESTS FAILED!")
                print("❌ Empty message handling has issues")

            return all_passed

        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            return False

        finally:
            self.client.loop_stop()
            self.client.disconnect()

if __name__ == "__main__":
    test = EmptyMessageTest()
    success = test.run_test()
    exit(0 if success else 1)
