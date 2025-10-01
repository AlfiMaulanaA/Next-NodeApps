from cmath import e
import imp
import I2Cout
import paho.mqtt.client as mqtt
from time import strftime, localtime
import json
import getmac
import pprint
import traceback
import time
import psutil
import os
import ast
import sys

import Poller.poller_task as poller
import Protocols.mqtt as MyMQTT

topic_state = "stateinfo"
function_read = "read"
function_write = "write"

Subsclient = mqtt.Client("")

wait_delay = False

def get_process_memory():
    process = psutil.Process(os.getpid())
    return [process.memory_info().rss, process.memory_full_info().rss]

def wait_until(somepredicate, timeout, period=0.25):
  mustend = time.time() + timeout
  while time.time() < mustend:
    if somepredicate: 
        return True
    time.sleep(period)
  return False

def process_data_subscribe(client, userdata, message):
    global Subsclient
    try:
        sub_data = json.loads(message.payload)
        #Parshing data
        mac = sub_data["mac"]
        device = sub_data["part_number"]
        function = sub_data["function"]
        address = sub_data["address"]
        value = sub_data["value"]
        device_bus = sub_data["device_bus"]

        errlog = open(os.getcwd() + "/errlog.txt", "a")

        if mac == getmac.get_mac_address():
            print("Get Subscribe data with topic =",message.topic)
            if wait_until(wait_delay, 10, 0.1):
                try:
                    errlog.write("{0} {1} data acquisition check\n".format(
                    strftime("%Y-%m-%d %H:%M:%S", localtime()), "Control: " + device))
                    errlog.close()

                    if function == function_read:
                        command = """
data, status = I2Cout.%s.get_data(%d, %d)
sub_data["data"] = data
sub_data["status"] = status
                """ % (device , address, device_bus)
                        exec(command)
                        Subsclient.publish( message.topic + "_status", json.dumps(sub_data))
                    elif function == function_write:
                        command = """
status = I2Cout.%s.set_data(%d, %d, %d)
sub_data["status"] = status
                """ % (device , value, address, device_bus)
                        exec(command)
                        Subsclient.publish( message.topic + "_status", json.dumps(sub_data))
                except Exception as e:
                    print(e)
                    sub_data["status"] = "Failed"
                    Subsclient.publish( message.topic + "_status", json.dumps(sub_data))


    except Exception as e:
        print(e)      

        
def i2c_out_polling_task(devices_list, interval, mqtt_config, ):
    global Subsclient, wait_delay

    print("starting i2c out polling task ....")

    errlog = open(os.getcwd() + "/errlog.txt", "a")
    errlog.write("{0} I'm still running!\n".format(
        strftime("%Y-%m-%d %H:%M:%S")))
    errlog.close()

    dev_num = len(devices_list)
    dev_poller = []

    for i in range(dev_num):
        print(devices_list[i]["profile"]["name"], "is running")
        dev_poller.append(poller.I2C_OUT(
            devices_list[i]["profile"], devices_list[i]["protocol_setting"]))

    with open(os.getcwd() + '/stat.temp') as file:
        FINISH = ast.literal_eval(file.read())

    # MQTT Config Data
    mqtt_enable = mqtt_config['enable']
    broker_address = mqtt_config['broker_address']
    broker_port = mqtt_config['broker_port']
    retain = mqtt_config['retain']
    qos = mqtt_config['qos']

    username = mqtt_config['username']
    password = mqtt_config['password']
    print("MQTT success")

    # MQTT Connect 
    Subsclient.on_message=process_data_subscribe 
    Subsclient.username_pw_set(username, password)
    Subsclient.connect(broker_address, broker_port, 60)
    Subsclient.loop_start()
    Subsclient.subscribe(mqtt_config['sub_topic_i2cout'])
    print("Connecting to broker for Subscriber")

    data_pub = {
                'mac': getmac.get_mac_address(),
                'protocol_type': 'I2C Modular',
                'device' : "",
                'adrress': "",
                'device_bus': "",
                'function': "",
                'value': "start running i2c out"
                }
    # Publish State
    Subsclient.publish(topic_state, json.dumps(data_pub))
    while (not FINISH):
        try:            
            for i in range(dev_num):
                topic = mqtt_config['pub_topic'][0]
                try:
                    data = dev_poller[i].poll()
                    print(data)
                    # Publish data to MQTT Broker IF MQTT SERVICE ENABLED
                    if mqtt_enable:
                        try:
                            mqtt_client = MyMQTT.Client(broker_address, broker_port, retain, qos, username,
                                                        password)
                            mqtt_client.set_usr_pw(username, password)
                            mqtt_client.connect()
                            # mqtt_client.publish(topic,  item["data"])
                            # DYNAMIC: ADDITIONAL DATA RTU

                            print('[protocol setting identifier]')
                            print(devices_list[i])

                            i2c_addres = devices_list[i]["protocol_setting"]["address"]
                            mqtt_client.publish(topic, {
                                'mac': getmac.get_mac_address(),
                                'protocol_type': 'I2C OUT',
                                'number_address': i2c_addres,
                                'value': json.dumps(data)
                            })

                            errlog = open(os.getcwd() + "/errlog.txt", "a")
                            errlog.write("{0} {1} publish check\n".format(
                                strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"]))
                            errlog.close()
                        except Exception as e:
                            print(e)
                            tb = traceback.format_exc()
                            print(tb)
                            errlog = open(os.getcwd() + "/errlog.txt", "a")
                            errlog.write("{0} {1} Error: {2}\n".format(
                                strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"]), str(e))
                            errlog.close()
                            pass
                except Exception as e:
                    print(e)
                    print("publish failed")
                    mqtt_client = MyMQTT.Client(broker_address, broker_port, retain, qos, username,
                                                password)
                    mqtt_client.set_usr_pw(username, password)
                    mqtt_client.connect()
                    mqtt_client.publish(
                        topic, devices_list[i]["profile"]["name"] + " data acquisition failed")
                    errlog = open(os.getcwd() + "/errlog.txt", "a")
                    errlog.write("{0} {1} Error: {2}\n".format(
                        strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"], str(e)))
                    errlog.close()
                    pass
            errlog = open(os.getcwd() + "/errlog.txt", "a")
            errlog.write("{0} {1} data acquisition check\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"]))
            errlog.close()
            # Read Polling Service Status
            with open(os.getcwd() + '/stat.temp') as file:
                FINISH = ast.literal_eval(file.read())

            # Wait for next data polling
            wait_delay = True
            for i in range(interval):
                if i == interval -2:
                    wait_delay = False
                time.sleep(1)
           

        except KeyboardInterrupt:
            print('Interrupted')
            break

        except:
            errlog.write("{0} {1} Error: your program sucks it goes out of the loop\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"]))
            raise
            # Wait for next data polling
            time.sleep(interval)
            tb = traceback.format_exc()
            print("exception occured")
            print(tb)
        errlog = open(os.getcwd() + "/errlog.txt", "a")
        errlog.write("{0} loop check\n".format(strftime("%Y-%m-%d %H:%M:%S")))
        errlog.close()
