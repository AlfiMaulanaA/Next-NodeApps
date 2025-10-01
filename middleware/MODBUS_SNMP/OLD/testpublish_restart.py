#!/usr/bin/python
import json
import paho.mqtt.client as mqtt


send_msg = {
        "mac":"b8:27:eb:30:63:a7",
        "control": "restart",
        "Timestamp":"2022-01-18 10:54:22"
        }
client = mqtt.Client("P1")
client.connect("127.0.0.1")
client.publish("system", payload=json.dumps(send_msg))
