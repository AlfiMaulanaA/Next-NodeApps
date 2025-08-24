#!/usr/bin/python
import json
import paho.mqtt.client as mqtt


send_msg = {
        "ip_address":"192.168.0.210",
        "port": 161,
        "snmp_version": 1,
        "read_community": "private",
        "data_type": "INTEGER",
        "value":{"OID": ".1.3.6.1.4.1.318.1.1.12.1.14.0","value": 2},
        "timeout" : 3
        }
client = mqtt.Client("P1")

broker_address ="mqtt-containmentunit.denish-faldu.in"
broker_port =  1883
username = "mqtt-user"
password = "Mha382QfnN8LD4RJ1"

client.username_pw_set(username, password)
client.connect(broker_address, broker_port)
client.publish("Control_Smartrack/PDU/APC/AP8853", payload=json.dumps(send_msg))
