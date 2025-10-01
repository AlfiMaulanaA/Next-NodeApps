#!/usr/bin/python
import json
import paho.mqtt.client as mqtt


send_msg = {
        "mac":"b8:27:eb:30:63:a7",
        "protocol_type":"Modbus RTU",
        "port": "/dev/ttyUSB0",
        "baudrate": 9600,
        "parity": "NONE",
        "bytesize": 8,
        "stop_bit": 1,
        "timeout": 1,
        "endianness" : "Big Endian",
        "number_address":199,
        "value":{"address": 1,"value": 0},
        "data_type": "INT16",
        "Timestamp":"2022-01-18 10:54:22"
        }
client = mqtt.Client("P1")
client.connect("127.0.0.1")
client.publish("test", payload=json.dumps(send_msg))
