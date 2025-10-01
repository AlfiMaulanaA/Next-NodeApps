import json
import os
import paho.mqtt.client as mqtt
import time

def process_data_subscribe(client, userdata, message):
    print("Get Subscribe data system control with topic: "+ message.topic)
    sub_data = json.loads(message.payload)
    sub_data_value = json.loads(sub_data["value"])
    print(sub_data_value)
    data_modular =  list(sub_data_value.values())
    type_modular = message.topic.split("/")[2]
    number_modular = message.topic.split("/")[3]

    data_modular_string =  json.dumps(data_modular)
    with open(os.getcwd() + '/JSON/Data/Modular/modular_' + str(type_modular)+ "_" + str(number_modular) + '.json' , "w") as outfile:
        outfile.write(data_modular_string)

    data_modular_string =  json.dumps(sub_data_value)
    with open(os.getcwd() + '/snmp_server/json/Modular/' + str(type_modular)+ "/modular_" + str(type_modular) +"_" + str(number_modular) + '.json' , "w") as outfile:
        outfile.write(data_modular_string)

Subsclient = mqtt.Client()
MQTT_CONFIG = {}
with open(os.getcwd() + '/JSON/Config/mqtt_config.json') as json_data:
    MQTT_CONFIG = json.load(json_data)

mqtt_enable = MQTT_CONFIG['enable']
broker_address = MQTT_CONFIG['broker_address']
broker_port = MQTT_CONFIG['broker_port']
retain = MQTT_CONFIG['retain']
qos = MQTT_CONFIG['qos']

username = MQTT_CONFIG['username']
password = MQTT_CONFIG['password']

Subsclient = mqtt.Client()
Subsclient.on_message=process_data_subscribe 
Subsclient.connect(MQTT_CONFIG["broker_address"], MQTT_CONFIG["broker_port"])
Subsclient.loop_start()
Subsclient.subscribe(MQTT_CONFIG['sub_topic_system'])

with open(os.getcwd() + '/JSON/Config/installed_devices.json') as json_data:
    list_modular = json.load(json_data)
    for i in range(len(list_modular)):
        print(list_modular[i]["profile"]["topic"])
        Subsclient.subscribe(list_modular[i]["profile"]["topic"])

while True:
    print("looping")
    time.sleep(1)