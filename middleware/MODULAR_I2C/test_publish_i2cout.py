#!/usr/bin/python
import json
import paho.mqtt.client as mqtt


send_msg = {
        "mac":"dc:a6:32:26:ad:fc",
        "protocol_type":"I2COUT",
        "part_number": "LM75",
        "function": "read",
        "value": "test",
        "address": 73,
        "device_bus": 1,
        "Timestamp":"2022-01-18 10:54:22"
        }
client = mqtt.Client("P1")
client.connect("192.168.0.179")
client.publish("out", payload=json.dumps(send_msg))