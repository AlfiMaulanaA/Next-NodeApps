import json
import os
import paho.mqtt.client as mqtt
import time

ParentFolder = os.path.abspath('..')

def process_data_subscribe(client, userdata, message):
    print("Pull data to JSON : Get Subscribe data for Modular and Equipment with topic: "+ message.topic)
    sub_data = json.loads(message.payload)
    #print("Pull data to JSON :" + str(sub_data))
    type_device = message.topic.split("/")[1]
    
    if type_device == "Modular":
        type_modular = message.topic.split("/")[2]
        number_modular = message.topic.split("/")[3]
        sub_data_value = json.loads(sub_data["value"])
        data_modular =  list(sub_data_value.values())
        data_modular_string =  json.dumps(data_modular)
        with open(os.getcwd() + '/MODBUS_TCP_SERVER/JSON/Data/Modular/modular_' + str(type_modular)+ "_" + str(number_modular) + '.json' , "w") as outfile:
            outfile.write(data_modular_string)

        data_modular_string =  json.dumps(sub_data_value)
        with open(os.getcwd() + '/SNMP_SERVER/json/Modular/' + str(type_modular)+ "/modular_" + str(type_modular) +"_" + str(number_modular) + '.json' , "w") as outfile:
            outfile.write(data_modular_string)
    elif type_device == "Smartrack":
        type_equipment = message.topic.split("/")[2]
        number_equipment = message.topic.split("/")[3]    
        data_equipment_string =  json.dumps(sub_data)
        with open(os.getcwd() + '/MODBUS_TCP_SERVER/JSON/Data/Equipment/' + str(type_equipment)+ "_" + str(number_equipment) + '.json' , "w") as outfile:
            outfile.write(data_equipment_string)
        
        with open(os.getcwd() + '/SNMP_SERVER/json/Equipment/' + str(type_equipment)+ "_" + str(number_equipment) + '.json' , "w") as outfile:
            outfile.write(data_equipment_string)

    elif type_device == "2U":
        type_equipment = message.topic.split("/")[2]
        number_equipment = message.topic.split("/")[4]    
        data_equipment_string =  json.dumps(sub_data)
        with open(os.getcwd() + '/MODBUS_TCP_SERVER/JSON/Data/Equipment/' + str(type_equipment)+ "_" + str(number_equipment) + '.json' , "w") as outfile:
            outfile.write(data_equipment_string)
        
        with open(os.getcwd() + '/SNMP_SERVER/json/Equipment/' + str(type_equipment)+ "_" + str(number_equipment) + '.json' , "w") as outfile:
            outfile.write(data_equipment_string)


Subsclient = mqtt.Client("pull_data_to_json")
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
#Subsclient.subscribe(MQTT_CONFIG['sub_topic_system'])

with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
    list_modular = json.load(json_data)
    for i in range(len(list_modular)):
        print(list_modular[i]["profile"]["topic"])
        Subsclient.subscribe(list_modular[i]["profile"]["topic"])

with open(ParentFolder + '/MODBUS_SNMP/JSON/Config/installed_devices.json') as json_data:
    list_modular = json.load(json_data)
    for i in range(len(list_modular)):
        #print(list_modular[i]["profile"]["split_publish"])
        if list_modular[i]["profile"]["split_publish"] > 0:
            for j in range(list_modular[i]["profile"]["split_publish"]):
                print(list_modular[i]["profile"]["topic"] + "/" + str(j+1))
                Subsclient.subscribe(list_modular[i]["profile"]["topic"] + "/" + str(j+1))
        else:    
            print(list_modular[i]["profile"]["topic"])
            Subsclient.subscribe(list_modular[i]["profile"]["topic"])
