import getmac
import Poller.poller_task as poller
import pprint
import traceback
import time
import psutil
import os
import ast
import sys
import Protocols.mqtt as MyMQTT
from Poller import datapckgr_by_pn
from time import strftime, localtime
import json

import paho.mqtt.client as mqtt
import Poller.poller_control as control

pp = pprint.PrettyPrinter(indent=2)
ParentFolder = os.path.abspath('..')

list_comport = []
comport = "" 
Subsclient = mqtt.Client()

sub_data = []
sub_topic = ""

debug = True
# Function to get current memory usage (only for development stage)

def get_process_memory():
    process = psutil.Process(os.getpid())
    return [process.memory_info().rss, process.memory_full_info().rss]

def process_data_subscribe_in_loop():
    global Subsclient, sub_data, sub_topic, list_comport
    try:
        if sub_data["port"] in list_comport:
            print("MODBUS_RTU: Get Subscribe data with topic: "+ sub_topic + " in port: " + sub_data["port"])
            if control.ModbusRTU_Control(sub_data):
                print("MODBUS_RTU: succes control modbus")
                sub_data["status"] = "succes control modbus"
                Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
            else:
                print("MODBUS_RTU: failed control modbus")
                sub_data["status"] = "failed control modbus"
                Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
    except Exception as e:
        print("MODBUS_RTU: " + str(e))
        mqtt_client = MyMQTT.Client("localhost", 1883, True, 1, "",
                                "")
        mqtt_client.set_usr_pw("", "")
        mqtt_client.connect()
        mqtt_client.publish(
            "subrack/error/log", {"data": "MODBUS RTU failed to control", "type" : "minor"}
            )
        pass

def process_data_subscribe(client, userdata, message):
    global sub_data, sub_topic
    sub_data = json.loads(message.payload)
    sub_topic = message.topic
    with open(os.getcwd() + '/stat_subscribe_rtu.temp', 'w') as file:
            file.write(str(True))


def modbusrtu_polling_task(profile_list, protocol_setting_list, interval, mqtt_config, comm_port):
    global comport, Subsclient, list_comport

    comport = comm_port
    list_comport.append(comport)
    dev_num = len(profile_list)
    
    print("MODBUS_RTU: starting modbus RTU polling task...")

    errlog = open(os.getcwd() + "/errlog.txt", "a")
    errlog.write("{0} I'm still running!\n".format(
        strftime("%Y-%m-%d %H:%M:%S")))
    errlog.close()

    dev_poller = []
    for i in range(dev_num):
        print("MODBUS_RTU: " + profile_list[i]["name"], "is running")
        dev_poller.append(poller.ModbusRTU(
            profile_list[i], protocol_setting_list[i]))
        #print(poller.ModbusRTU(profile_list[i], protocol_setting_list[i]))
        # print(str(dev_poller))
    print("MODBUS_RTU: poller success")
    # Read Polling Service Status
    with open(os.getcwd() + '/stat.temp') as file:
        FINISH = ast.literal_eval(file.read())

    # MQTT config
    mqtt_enable = mqtt_config['enable']
    broker_address = mqtt_config['broker_address']
    broker_port = mqtt_config['broker_port']
    retain = mqtt_config['retain']
    qos = mqtt_config['qos']
    publish_failed_data = mqtt_config['publish_failed_data_modbusrtu']

    username = mqtt_config['username']
    password = mqtt_config['password']
    
    #config to Subscribe data
    while True:
        try:
            Subsclient.on_message=process_data_subscribe 
            Subsclient.connect(broker_address, broker_port)
            Subsclient.loop_start()
            Subsclient.subscribe(mqtt_config['sub_topic_modbusRTU'])
            print("MODBUS_RTU: Succes Connecting to broker for Subscriber")
            break
        except Exception as e:
            print(e)
            print("Failed to connect broker mqtt")
            time.sleep(5)
            mqtt_client = MyMQTT.Client("localhost", 1883, True, 1, "",
                                    "")
            mqtt_client.set_usr_pw("", "")
            mqtt_client.connect()
            mqtt_client.publish(
                "subrack/error/log", {"data": "MODBUS RTU cannot connect to server broker mqtt", "type" : "critical"}
                )
            
            errlog = open(os.getcwd() + "/errlog.txt", "a")
            errlog.write("{0} {1} Error 5: {2}\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "modbus rtu task", "Failed to connect broker mqtt"))
            errlog.close()

    while (not FINISH):
        try:            
            for i in range(dev_num):
                topic = str(profile_list[i]["topic"])
                try:
                    data = dev_poller[i].poll()
                    for item in data:
                        if mqtt_enable:
                            try:
                                device_name = profile_list[i]["name"]
                                modbus_address = protocol_setting_list[i]["address"]
                                modbus_port = protocol_setting_list[i]["port"]  

                                mqtt_client = MyMQTT.Client(broker_address, broker_port, retain, qos, username,
                                                            password)
                                mqtt_client.set_usr_pw(username, password)
                                mqtt_client.connect()
                                mqtt_client.publish(topic, {
                                    'device_name': device_name,
                                    'protocol_type': "MODBUS RTU",
                                    'comport': modbus_port,
                                    'modbus_address': modbus_address,
                                    'value': json.dumps(item["data"])
                                })

                                #write data subscriber
                                #check is a any subscriber?
                                any_subs =  False
                                with open(os.getcwd() + '/stat_subscribe_rtu.temp') as file:
                                    any_subs = ast.literal_eval(file.read())
                                print("MODBUS_RTU: any_subs: ", any_subs)
                                if any_subs:
                                    process_data_subscribe_in_loop()
                                    with open(os.getcwd() + '/stat_subscribe_rtu.temp', 'w') as file:
                                        file.write(str(False))
                                
                                mqtt_client = MyMQTT.Client("localhost", 1883, retain, qos, username,
                                                        password)
                                mqtt_client.set_usr_pw(username, password)
                                mqtt_client.connect()
                                mqtt_client.publish(
                                    topic + "_status", profile_list[i]["name"] + " data acquisition success")
                                mqtt_client.publish("modbus_snmp_summ", {
                                'MODBUS SNMP STATUS': profile_list[i]["name"] + " data acquisition success"
                                })

                                #errlog = open(os.getcwd() + "/errlog.txt", "a")
                                #errlog.write("{0} {1} publish check\n".format(
                                #    strftime("%Y-%m-%d %H:%M:%S", localtime()), profile_list[i]["name"]))
                                #errlog.close()
                            except Exception as e:
                                print("MODBUS_RTU: " + str(e))
                                tb = traceback.format_exc()
                                print(tb)
                                errlog = open(os.getcwd() + "/errlog.txt", "a")
                                errlog.write("{0} {1} Error: {2}\n".format(
                                    strftime("%Y-%m-%d %H:%M:%S", localtime()), profile_list[i]["name"], str(e)))
                                errlog.close()
                                pass
                except Exception as e:
                    print("MODBUS_RTU: " + str(e))
                    print("MODBUS_RTU: reading failed")
                    if publish_failed_data:
                        try:
                            mqtt_client = MyMQTT.Client(broker_address, broker_port, retain, qos, username,
                                                        password)
                            mqtt_client.set_usr_pw(username, password)
                            mqtt_client.connect()
                            mqtt_client.publish(
                                topic + "_status", profile_list[i]["name"] + " data acquisition failed")
                            mqtt_client.publish("modbus_snmp_summ", {
                            'System error': profile_list[i]["name"] + " data acquisition failed"
                            })

                            mqtt_client = MyMQTT.Client("localhost", 1883, retain, qos, username,
                                                        password)
                            mqtt_client.set_usr_pw(username, password)
                            mqtt_client.connect()
                            mqtt_client.publish("modbus_snmp_summ", {
                            'MODBUS SNMP STATUS': profile_list[i]["name"] + " data acquisition failed"
                            })

                            mqtt_client.publish(
                                "subrack/error/log", {"data": "MODBUS RTU reading error/failed on device " + profile_list[i]["name"], "type" : "major"}
                                )
                            
                        except Exception as e:
                            print("MODBUS_RTU: "+ str(e))
                            pass
                        
                    errlog = open(os.getcwd() + "/errlog.txt", "a")
                    errlog.write("{0} {1} Error: {2}\n".format(
                        strftime("%Y-%m-%d %H:%M:%S", localtime()), profile_list[i]["name"], str(e)))
                    errlog.close()
                    pass
            #errlog = open(os.getcwd() + "/errlog.txt", "a")
            #errlog.write("{0} {1} data acquisition check\n".format(
            #    strftime("%Y-%m-%d %H:%M:%S", localtime()), profile_list[i]["name"]))
            #errlog.close()
            # Read Polling Service Status
            with open(os.getcwd() + '/stat.temp') as file:
                FINISH = ast.literal_eval(file.read())

            for i in range(interval):
                time.sleep(1)
           

        except KeyboardInterrupt:
            print('MODBUS_RTU: Interrupted')
            break

        except:
            errlog.write("{0} {1} Error: your program sucks it goes out of the loop\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), profile_list[i]["name"]))
            pass
        errlog = open(os.getcwd() + "/errlog.txt", "a")
        errlog.write("{0} loop check\n".format(strftime("%Y-%m-%d %H:%M:%S")))
        errlog.close()
