#!/usr/bin/env python3
"""
Publish Available Devices Mock Data
Publishes mock device data to MODULAR_DEVICE/AVAILABLES topic for testing.
"""

import json
import time
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker with result code: {rc}")

def on_publish(client, userdata, mid):
    print(f"Message published with mid: {mid}")

def main():
    # MQTT Configuration
    broker = "localhost"
    port = 1883
    topic = "MODULAR_DEVICE/AVAILABLES"

    # Create MQTT client
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_publish = on_publish

    try:
        # Connect to broker
        client.connect(broker, port, 60)

        # Load mock data
        with open('./JSON/availableDevicesMock.json', 'r') as f:
            devices = json.load(f)

        # Publish device data
        payload = json.dumps(devices, indent=2)
        result = client.publish(topic, payload, qos=1, retain=True)

        print(f"Published {len(devices)} devices to topic '{topic}'")
        print("Devices:")
        for device in devices:
            print(f"  - {device['name']} ({device['part_number']}) - Address: {device['address']}")

        # Wait for publish to complete
        result.wait_for_publish()
        print("✅ Device data published successfully!")

        # Keep connection alive briefly
        client.loop_start()
        time.sleep(2)
        client.loop_stop()

    except FileNotFoundError:
        print("❌ Error: availableDevicesMock.json not found")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.disconnect()

if __name__ == "__main__":
    main()
