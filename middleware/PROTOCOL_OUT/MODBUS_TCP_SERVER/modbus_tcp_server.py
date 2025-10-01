#!/bin/python

from pyModbusTCP.server import ModbusServer, DataBank
from time import sleep
from random import uniform
import json
import os
import paho.mqtt.client as mqtt
import getmac
from time import strftime, localtime
import socket

ParentFolder = os.path.abspath('..')

MODBUS_TCP_CONFIG = {}
with open(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Config/modbus_tcp.json') as json_data:
    MODBUS_TCP_CONFIG = json.load(json_data)

modbus_tcp_ip = MODBUS_TCP_CONFIG["modbus_tcp_ip"]
modbus_tcp_port = MODBUS_TCP_CONFIG["modbus_tcp_port"]

print("MODBUS TCP: Reading Interface for get IP network")
with open('/etc/network/interfaces', "r") as file_interface:
    interface_data_line = file_interface.readlines()

# matric_eth = interface_data_line[14].split(" ")[-1].replace('\n', '')
# if matric_eth == "1000":
#     modbus_tcp_ip = interface_data_line[27].split(" ")[-1].replace('\n', '')
# else:
#     modbus_tcp_ip = interface_data_line[15].split(" ")[-1].replace('\n', '')

print("MODBUS TCP: MODBUS TCP IP Address: " + modbus_tcp_ip)
print("MODBUS TCP: MODBUS TCP Port: " + str(modbus_tcp_port))

# Create an instance of ModbusServer
server = ModbusServer(modbus_tcp_ip, modbus_tcp_port, no_block=True)
Subsclient = mqtt.Client("modbus_tcp_server")
MQTT_CONFIG = {}
with open(ParentFolder + '/PROTOCOL_OUT/JSON/Config/mqtt_config.json') as json_data:
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
with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
    list_modular = json.load(json_data)

list_equipment = []
with open(ParentFolder + '/MODBUS_SNMP/JSON/Config/installed_devices.json') as json_data:
    list_equipment = json.load(json_data)

def modbus_tcp_server_main():
    try:
        #---------------------------------- Start Server Modbus TCP ----------------------------------
        print("MODBUS TCP: Start server...")
        server.start()
        print("MODBUS TCP: Server is online")

        #---------------------------------- List Modular in JSON  ----------------------------------------
        all_data = []
        modbus_list = {}
        last_count = 0

        lst_file_json = []
        lst_file_json_raw = os.listdir(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Modular/') # your directory path
        for i in range(len(lst_file_json_raw)):
            if lst_file_json_raw[i].endswith(".json"):
                lst_file_json.append(lst_file_json_raw[i])
        lst_file_json.sort()

        #---------------------------------- List Equipment in JSON  ----------------------------------------
        lst_file_equipment_json = []
        lst_file_equipment_json_raw = os.listdir(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Equipment/') # your directory path
        for i in range(len(lst_file_equipment_json_raw)):
            if lst_file_equipment_json_raw[i].endswith(".json"):
                lst_file_equipment_json.append(lst_file_equipment_json_raw[i])
        lst_file_equipment_json.sort()


        #---------------------------------- Create Modbus List in JSON ------------------------------------
        for i in range(len(lst_file_json)):
            with open(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Modular/' + lst_file_json[i]) as json_data:
                data_modular = json.load(json_data)
                for j in range(len(data_modular)):
                    address = last_count + 1
                    keyvalue = lst_file_json[i].replace(".json", "") +  "_pin_" + str(j+1)
                    modbus_list.update({address: keyvalue})
                    last_count = address
            all_data.extend(data_modular)
        
        last_count = 1000
        for i in range(len(lst_file_equipment_json)):
            with open(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Equipment/' + lst_file_equipment_json[i]) as json_data:
                data_equipment = json.load(json_data)
                try:
                    del data_equipment["PollingDuration"]
                    del data_equipment["Timestamp"]
                except Exception as e:
                    #print("MODBUS TCP: problem in delete " + str(e))
                    pass
                keysList = list(data_equipment.keys())
                for j in range(len(keysList)):
                    address = last_count + 1
                    modbus_list.update({address: keysList[j] + "-" + lst_file_equipment_json[i].replace(".json","")})
                    last_count = address

        #print(modbus_list)
    
        with open(os.getcwd() + '/Lib/modbus_list.json' , "w") as outfile:
            outfile.write(json.dumps(modbus_list))
        print("MODBUS TCP: Succes write modbus list")

        while True:
            # Read data in JSON
            all_data = []
            all_data_equipment = []
            last_count = 0
            value_publish = []
            data_publish = []
            value_publish_equipment = []
            data_publish_equipment = []

            #---------------------------------- List Modular in JSON  ----------------------------------------
            lst_file_json = []
            lst_file_json_raw = os.listdir(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Modular/') # your directory path
            for i in range(len(lst_file_json_raw)):
                if lst_file_json_raw[i].endswith(".json"):
                    lst_file_json.append(lst_file_json_raw[i])
            lst_file_json.sort()

            #---------------------------------- List Equipment in JSON  ----------------------------------------
            lst_file_equipment_json = []
            lst_file_equipment_json_raw = os.listdir(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Equipment/') # your directory path
            for i in range(len(lst_file_equipment_json_raw)):
                if lst_file_equipment_json_raw[i].endswith(".json"):
                    lst_file_equipment_json.append(lst_file_equipment_json_raw[i])
            lst_file_equipment_json.sort()

            #---------------------------------- Read all data Modular in JSON  ----------------------------------------
            for i in range(len(lst_file_json)):
                with open(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Modular/' + lst_file_json[i]) as json_data:
                    data_modular = json.load(json_data)
                all_data.extend(data_modular)

            #---------------------------------- Read all data Equipment in JSON  ----------------------------------------
            for i in range(len(lst_file_equipment_json)):
                with open(ParentFolder + '/PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Equipment/' + lst_file_equipment_json[i]) as json_data:
                    data_equipment = json.load(json_data)
                    try:
                        del data_equipment["PollingDuration"]
                        del data_equipment["Timestamp"]
                    except Exception as e:
                        #print("MODBUS TCP: problem in delete " + str(e))
                        pass
                all_data_equipment.extend(list(data_equipment.values()))

            #---------------------------------- Store all data Modular to DataBank Modbus TCP  ----------------------------------------
            for i in  range(len(all_data)):
                DataBank.set_words(i, [all_data[i]])
             #---------------------------------- Store all data Equipment to DataBank Modbus TCP  ----------------------------------------
            for i in range(len(all_data_equipment)):
                DataBank.set_words(1000 + i, [all_data_equipment[i]])

            #---------------------------------- Get Data Write in Modbus TCP  ----------------------------------------    
            for i in range(50):
                data_databank = DataBank.get_words(0, len(all_data))
                if all_data != data_databank:
                    print("MODBUS TCP: modular get write data")
                    for i in range(len(all_data)):
                        if all_data[i] != data_databank[i]:
                            #print(modbus_list[i+1])
                            value_publish.append(data_databank[i])
                            data_publish.append(modbus_list[i+1]) 
                            #print(data_databank[i])
                            #print(all_data[i])
                            all_data[i] = data_databank[i]

                data_databank_equipment = DataBank.get_words(1000, len(all_data_equipment))
                if all_data_equipment != data_databank_equipment:
                    print("MODBUS TCP: equipment get write data")
                    for i in range(len(all_data_equipment)):
                        if all_data_equipment[i] != data_databank_equipment[i]:
                            #print(i+1001)
                            #print(all_data_equipment[i])
                            #print(data_databank_equipment[i])
                            value_publish_equipment.append(data_databank_equipment[i])
                            data_publish_equipment.append(modbus_list[i+1001]) 
                            all_data_equipment[i] = data_databank_equipment[i]
                sleep(0.1)
            
            #---------------------------------- Publish write data Modular to MQTT  ----------------------------------------
            for value, data in zip(value_publish, data_publish):
                if value == 0 or value == 1:
                    data_type_modular = data.split("_")[1]
                    data_number_modular = data.split("_")[2]
                    data_pin_modular = data.split("_")[4]
                    if data_number_modular == "mini":
                        data_type_modular = "relay_mini"
                        data_number_modular = data.split("_")[3]
                        data_pin_modular = data.split("_")[5]
                        data
        
                    with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
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
                            print("MODBUS TCP: " + json.dumps(send_msg))

                            MQTT_CONFIG_Modular = []
                            with open(ParentFolder + '/MODULAR_I2C/JSON/Config/mqtt_config.json') as json_data:
                                MQTT_CONFIG_Modular = json.load(json_data)
                            topic_pub_write = MQTT_CONFIG_Modular["sub_topic_modular"]
                            Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                        else:
                            print("MODBUS TCP: your modular not configure")

            #---------------------------------- Publish write data Equipment to MQTT  ----------------------------------------
            # to do: pastikan equipment modbus rtu
            for value, data in zip(value_publish_equipment, data_publish_equipment):
                if value == 0 or value == 1:
                    data_type_equipment_raw = data.split("-")[1]
                    data_name_equipment = data.split("-")[0]
                    data_type_equipment_number = data_type_equipment_raw.split("_")[-1:][0]
                    data_type_equipment = data_type_equipment_raw.replace("_" + data_type_equipment_number, "")
                    
                    list_equipment = []
                    with open(ParentFolder + '/MODBUS_SNMP/JSON/Config/installed_devices.json') as json_data:
                        list_equipment = json.load(json_data)
                    list_device_equipment = []
                    with open(ParentFolder + '/MODBUS_SNMP/JSON/Config/Library/devices.json') as json_data:
                        list_device_equipment = json.load(json_data)

                    for i in range(len(list_equipment)):
                        topic_pub = list_equipment[i]["profile"]["topic"]
                        type_equipment= topic_pub.split("/")[2]
                        number_type_equipment = topic_pub.split("/")[3]
                        if data_type_equipment == type_equipment and data_type_equipment_number == number_type_equipment:
                            fix_device_type = list_equipment[i]["profile"]["device_type"]
                            fix_device = list_equipment[i]["profile"]["part_number"]
                            fix_address = list_equipment[i]["protocol_setting"]["address"]
                            fix_protocol = list_equipment[i]["protocol_setting"]["protocol"]
                            fix_port = list_equipment[i]["protocol_setting"]["port"]
                            fix_baudrate = list_equipment[i]["protocol_setting"]["baudrate"]
                            fix_parity = list_equipment[i]["protocol_setting"]["parity"]
                            fix_bytesize = list_equipment[i]["protocol_setting"]["bytesize"]
                            fix_stop_bit = list_equipment[i]["protocol_setting"]["stop_bit"]
                            fix_timeout = list_equipment[i]["protocol_setting"]["timeout"]
                            fix_endianness = list_equipment[i]["protocol_setting"]["endianness"]
                            
                            fix_register = 0
                            fix_data_type = ""
                            for item in list_device_equipment[fix_device_type]:
                                if item["part_number"] == fix_device:
                                    for data_item in item["data"]:
                                        if data_item["var_name"] == data_name_equipment:
                                            fix_register = data_item["relative_address"]
                                            fix_data_type = data_item["data_type"]

                            send_msg = {
                                        "mac":getmac.get_mac_address(),
                                        "protocol_type": fix_protocol,
                                        "port": fix_port,
                                        "baudrate": fix_baudrate,
                                        "parity": fix_parity,
                                        "bytesize": fix_bytesize,
                                        "stop_bit": fix_stop_bit,
                                        "timeout": fix_timeout,
                                        "endianness" : fix_endianness,
                                        "number_address":fix_address,
                                        "value":{"address": fix_register,"value": value},
                                        "data_type": fix_data_type,
                                        "Timestamp": strftime("%Y-%m-%d %H:%M:%S", localtime())
                                        }

                            MQTT_CONFIG_Equipment_ModbusRTU = []
                            with open(ParentFolder + '/MODBUS_SNMP/JSON/Config/mqtt_config.json') as json_data:
                                MQTT_CONFIG_Equipment_ModbusRTU = json.load(json_data)

                            topic_pub_write = MQTT_CONFIG_Equipment_ModbusRTU["sub_topic_modbusRTU"]
                            print(topic_pub_write)
                            print(send_msg)
                            Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                        else:
                            print("MODBUS TCP: your equipment not configure")



    except Exception as e:
        print("MODBUS TCP: error " + str(e))
        print("MODBUS TCP: Shutdown server ...")
        server.stop()
        print("MODBUS TCP: Server is offline")

