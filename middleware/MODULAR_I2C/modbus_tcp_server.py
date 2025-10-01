#!/bin/python

from pyModbusTCP.server import ModbusServer, DataBank
from time import sleep
from random import uniform
import json
import os
import paho.mqtt.client as mqtt
import getmac
from time import strftime, localtime

# Create an instance of ModbusServer
server = ModbusServer("192.168.18.176", 502, no_block=True)
Subsclient = mqtt.Client()
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

list_modular = []
with open(os.getcwd() + '/JSON/Config/installed_devices.json') as json_data:
    list_modular = json.load(json_data)


try:
    #---------------------------------- Start Server Modbus TCP ----------------------------------
    print("Start server...")
    server.start()
    print("Server is online")

    #---------------------------------- List Modular in JSON  ----------------------------------------
    all_data = []
    modbus_list = {}
    last_count = 0
    lst_file_json = os.listdir(os.getcwd() + '/JSON/Data/Modular/') # your directory path
    number_files = len(lst_file_json)
    lst_file_json.sort()

    for i in range(len(lst_file_json)):
            with open(os.getcwd() + '/JSON/Data/Modular/' + lst_file_json[i]) as json_data:
                data_modular = json.load(json_data)
                for j in range(len(data_modular)):
                    address = last_count + 1
                    keyvalue = lst_file_json[i].replace(".json", "") +  "_pin_" + str(j)
                    modbus_list.update({address: keyvalue})
                    last_count = address
            all_data.extend(data_modular)
    #print(modbus_list)

  
    with open(os.getcwd() + '/modbus_list.json' , "w") as outfile:
        outfile.write(json.dumps(modbus_list))
    print("Succes write modbus list")

    while True:
        # Read data in JSON
        all_data = []
        last_count = 0
        value_publish = []
        data_publish = []

        #---------------------------------- List Modular in JSON  ----------------------------------------
        lst_file_json = os.listdir(os.getcwd() + '/JSON/Data/Modular/') # your directory path
        number_files = len(lst_file_json)
        lst_file_json.sort()

        #---------------------------------- Read all data Modular in JSON  ----------------------------------------
        for i in range(len(lst_file_json)):
            with open(os.getcwd() + '/JSON/Data/Modular/' + lst_file_json[i]) as json_data:
                data_modular = json.load(json_data)
            all_data.extend(data_modular)

        #---------------------------------- Store all data Modular to DataBank Modbus TCP  ----------------------------------------
        for i in  range(len(all_data)):
            DataBank.set_words(i, [all_data[i]])

        #---------------------------------- Get Data Write in Modbus TCP  ----------------------------------------    
        for i in range(50):
            data_databank = DataBank.get_words(0, len(all_data))
            if all_data != data_databank:
                print("get write data")
                for i in range(len(all_data)):
                    if all_data[i] != data_databank[i]:
                        value_publish.append(data_databank[i])
                        data_publish.append(modbus_list[i+1]) 
                        all_data[i] = data_databank[i]    
            sleep(0.1)
        
         #---------------------------------- Publish write data to MQTT  ----------------------------------------
        for value, data in zip(value_publish, data_publish):
            if value == 0 or value == 1:
                data_type_modular = data.split("_")[1]
                data_number_modular = data.split("_")[2]
                data_pin_modular = data.split("_")[4]
                #print(data_type_modular)
                #print(data_number_modular)
                with open(os.getcwd() + '/JSON/Config/installed_devices.json') as json_data:
                    list_modular = json.load(json_data)
                for i in range(len(list_modular)):
                    topic_pub = list_modular[i]["profile"]["topic"]
                    type_modular = topic_pub.split("/")[2]
                    number_modular = topic_pub.split("/")[3]
                    if data_type_modular == type_modular and data_number_modular == number_modular:
                        fix_device = list_modular[i]["profile"]["part_number"]
                        fix_address = list_modular[i]["protocol_setting"]["address"]
                        fix_device_bus = list_modular[i]["protocol_setting"]["device_bus"]
                
                        send_msg = {
                                "mac":getmac.get_mac_address(),
                                "protocol_type":"Modular",
                                "device": fix_device,
                                "function": "write",
                                "value": {"pin": int(data_pin_modular),"data": value},
                                "address": fix_address,
                                "device_bus": fix_device_bus,
                                "Timestamp": strftime("%Y-%m-%d %H:%M:%S", localtime())
                                }
                        print(send_msg)
                        Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                    else:
                        print("your modular not configure")


except Exception as e:
    print(e)
    print("Shutdown server ...")
    server.stop()
    print("Server is offline")