#!/usr/bin/python
import json
import paho.mqtt.client as mqtt
import getmac
from time import strftime, localtime
import json
import os

Subsclient = mqtt.Client("modular write")
MQTT_CONFIG = {}
with open(os.getcwd() + '/JSON/Config/mqtt_config.json') as json_data:
    MQTT_CONFIG = json.load(json_data)

mqtt_enable = MQTT_CONFIG['enable']
broker_address = MQTT_CONFIG['broker_address']
broker_port = MQTT_CONFIG['broker_port']
retain = MQTT_CONFIG['retain']
qos = MQTT_CONFIG['qos']
topic_pub_write = MQTT_CONFIG["sub_topic_modular"]

username = MQTT_CONFIG['username']
password = MQTT_CONFIG['password']

Pubsclient = mqtt.Client()
Pubsclient.connect(MQTT_CONFIG["broker_address"], MQTT_CONFIG["broker_port"])

send_msg = {
        "mac":getmac.get_mac_address(),
        "protocol_type":"Modular",
        "device": "RELAYMINI",
        "function": "write",
        "value": {"pin": 4,"data": 1},
        "address": 37,
        "device_bus": 2,
        "Timestamp":strftime("%Y-%m-%d %H:%M:%S", localtime())
        }
Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
