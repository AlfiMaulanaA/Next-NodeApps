#!/usr/bin/python
import json
import paho.mqtt.client as mqtt


send_msg = {
        "mac":"02:81:ac:b3:66:48",
        "protocol_type":"Modbus RTU",
        "port": "/dev/ttyAMA0",
        "baudrate": 9600,
        "parity": "NONE",
        "bytesize": 8,
        "stop_bit": 1,
        "timeout": 3,
        "endianness" : "Big Endian",
        "number_address":1,
        "value":{"address": 120,"value": 2},
        "data_type": "INT16",
        "function": "multiple",
        "Timestamp":""
        }
client = mqtt.Client("P1")

broker = "mqtt-containmentunit.denish-faldu.in"
port = 1883
username = "mqtt-user"
password = "Mha382QfnN8LD4RJ"

client.username_pw_set(username, password)
client.connect(broker, port)
client.publish("gspe_iot2", payload=json.dumps(send_msg))
