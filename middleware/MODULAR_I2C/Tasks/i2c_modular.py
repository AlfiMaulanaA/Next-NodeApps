import imp
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

import Modular.aio as aio
import Modular.gpio as gpio
import Modular.optocoupler as optocoupler
import Modular.relay as relay
import Modular.relay_mini as relay_mini

import Protocols.mqtt as MyMQTT


wait_delay = False

topic_state = "stateinfo"
function_read = "read"
function_write = "write"

AIO = "AIO"
GPIO = "GPIO"
OPTOCOUPLER = "OPTOCOUPLER"
RELAY = "RELAY"
DRYCONTACT ="DRYCONTACT"
RELAYMINI = "RELAYMINI"

Subsclient = mqtt.Client("")
sub_data = []
sub_topic = ""


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
    global sub_data, sub_topic
    print("hello")
    print(message.payload)
    try: 
        sub_data = json.loads(message.payload)
        sub_topic = message.topic
        process_data_subscribe_in_loop()
        with open(os.getcwd() + '/stat_subscribe_modular.temp', 'w') as file:
            file.write(str(True))
    except Exception as e:
        print(e)
        pass

def process_data_subscribe_in_loop():
    global Subsclient, sub_data, sub_topic
    try: 
        #Parshing data
        mac = sub_data["mac"]
        device = sub_data["device"]
        function = sub_data["function"]
        value = sub_data["value"]
        address = sub_data["address"]
        device_bus = sub_data["device_bus"]

        errlog = open(os.getcwd() + "/errlog.txt", "a")

        if mac == getmac.get_mac_address():
            print("Get Subscribe data with topic =", sub_topic)
            
            if device == AIO:
                print("AIO")
                errlog.write("{0} {1} data acquisition check\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "Control AIO"))
                errlog.close()
                if function == function_read:
                    data, status = aio.read_data_pin(value["pin"], address, device_bus)
                    sub_data["data"] = data
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
                elif function == function_write:
                    status = aio.write_data_pin(address, device_bus, value["pin"], value["data"])
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
            elif device == GPIO:
                print("GPIO")
                errlog.write("{0} {1} data acquisition check\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "Control GPIO"))
                errlog.close()
                if function == function_read:
                    data, status = gpio.read_gpio_num(value["pin"], address, device_bus)
                    sub_data["data"] = data
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
                elif function == function_write:
                    print(value)
                    status = gpio.write_gpio_num(value["pin"], value["data"], address, device_bus)
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
            elif device == OPTOCOUPLER:
                print("OPTOCOUPLER")
                errlog.write("{0} {1} data acquisition check\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "Control OPTOCOUPLER"))
                errlog.close()
                if function == function_read:
                    data, status = optocoupler.read_gpio_num(value["pin"], address, device_bus)
                    sub_data["data"] = data
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
                elif function == function_write:
                    status = optocoupler.write_gpio_num(value["pin"], value["data"], address, device_bus)
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
            elif device == RELAY:
                print("RELAY")
                errlog.write("{0} {1} data acquisition check\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "Control RELAY"))
                errlog.close()
                if function == function_read:
                    data, status = relay.read_gpio_num(value["pin"], address, device_bus)
                    sub_data["data"] = data
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
                elif function == function_write:
                    status = relay.write_gpio_num(value["pin"], value["data"], address, device_bus)
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
            elif device == RELAYMINI:
                print("RELAYMINI")
                errlog.write("{0} {1} data acquisition check\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "Control RELAY"))
                errlog.close()
                if function == function_read:
                    data, status = relay_mini.read_gpio_num(value["pin"], address, device_bus)
                    sub_data["data"] = data
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
                elif function == function_write:
                    status = relay_mini.write_gpio_num(value["pin"], value["data"], address, device_bus)
                    sub_data["status"] = status
                    Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
            else:
                print("not recognize")
            
    except Exception as e:
        print(e)
        mqtt_client_local = MyMQTT.Client("localhost", 1883, True, 1, "",
                                "")
        mqtt_client_local.set_usr_pw("", "")
        mqtt_client_local.connect()
        mqtt_client_local.publish(
            "subrack/error/log", {"data": "MODULAR I2C failed to control", "type" : "minor"}
            )
        pass


def i2c_modular_polling_task(devices_list, interval, mqtt_config):
    global Subsclient, wait_delay

    print("starting i2c modular polling task ....")

    errlog = open(os.getcwd() + "/errlog.txt", "a")
    errlog.write("{0} I'm still running!\n".format(
        strftime("%Y-%m-%d %H:%M:%S")))
    errlog.close()

    dev_num = len(devices_list)
    dev_poller = []

    for i in range(dev_num):
        print(devices_list[i]["profile"]["name"], "is running")
        dev_poller.append(poller.Modular(
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


    while(True):
        try:
            Subsclient.on_message=process_data_subscribe 
            Subsclient.username_pw_set(username, password)
            Subsclient.connect(broker_address, broker_port, 60)
            Subsclient.loop_start()
            Subsclient.subscribe(mqtt_config['sub_topic_modular'])
            break
        except Exception as e:
            print(e)
            print("Failed to connect broker mqtt")

            mqtt_client_local = MyMQTT.Client("localhost", 1883, True, 1, "",
                                    "")
            mqtt_client_local.set_usr_pw("", "")
            mqtt_client_local.connect()
            mqtt_client_local.publish(
                "subrack/error/log", {"data": "MODULAR I2C cannot connect to server broker mqtt", "type" : "critical"}
                )

            errlog = open(os.getcwd() + "/errlog.txt", "a")
            errlog.write("{0} {1} Error 5: {2}\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "i2c modular task", "Failed to connect broker mqtt"))
            errlog.close()

    print("Connecting to broker for Subscriber")

    pub_data =  {
                    'mac': getmac.get_mac_address(),
                    'protocol_type': 'I2C Modular',
                    'device' : "",
                    'adrress': "",
                    'device_bus': "",
                    'function': "",
                    'value': "start running i2c modular"
                }
    # Publish State
    Subsclient.publish(topic_state,  json.dumps(pub_data))


    # reading last data
    # still development
    """
    try:
        last_data_relaymini = {}
        with open(os.getcwd() + '/last_data_RELAYMINI.json') as json_data:
            last_data_relaymini = json.load(json_data)
        for i in range(6):
            relay_mini.write_gpio_num(i+1,  last_data_relaymini["relayMiniOutput" + str(i+1)], 34, 0)
    except Exception as e:
            print(e)
            print("Failed to read last data relay mini")
            pass
    """

    while(True):
        try:
            mqtt_client = MyMQTT.Client(broker_address, broker_port, retain, qos, username, password)
            mqtt_client.set_usr_pw(username, password)
            mqtt_client.connect()
            mqtt_client.loop_start()
            break
        except Exception as e:
            print(e)
            print("Failed to connect broker mqtt")
            time.sleep(5)
            mqtt_client_local = MyMQTT.Client("localhost", 1883, True, 1, "",
                                    "")
            mqtt_client_local.set_usr_pw("", "")
            mqtt_client_local.connect()
            mqtt_client_local.publish(
                "subrack/error/log", {"data": "MODULAR I2C cannot connect to server broker mqtt", "type" : "critical"}
                )
            
            errlog = open(os.getcwd() + "/errlog.txt", "a")
            errlog.write("{0} {1} Error 4: {2}\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "i2c modular task", "Failed to connect broker mqtt"))
            errlog.close()
            pass
            

    while (not FINISH):
        try:            
            for i in range(dev_num):
                #topic = mqtt_config['pub_topic'][0]
                topic = devices_list[i]["profile"]["topic"]
                try:
                    data = dev_poller[i].poll()
                    # Publish data to MQTT Broker IF MQTT SERVICE ENABLED
                    if mqtt_enable:
                        try:
                            #print('[protocol setting identifier]')
                            #print(devices_list[i])

                            i2c_addres = devices_list[i]["protocol_setting"]["address"]
                            mqtt_client.publish(topic, {
                                'mac': getmac.get_mac_address(),
                                'protocol_type': 'I2C MODULAR',
                                'number_address': i2c_addres,
                                'value': json.dumps(data)
                            })

                            #write data subscriber
                            #check is a any subscriber?
                            any_subs =  False
                            with open(os.getcwd() + '/stat_subscribe_modular.temp') as file:
                                any_subs = ast.literal_eval(file.read())
                            #print("any_subs: ", any_subs)
                            if any_subs:
                                #process_data_subscribe_in_loop()
                                with open(os.getcwd() + '/stat_subscribe_modular.temp', 'w') as file:
                                    file.write(str(False))
                                
                            type_device = devices_list[i]["profile"]["part_number"]    
                            with open(os.getcwd() + '/last_data_'+ type_device +'.json', "w") as outfile:
                                outfile.write(json.dumps(data)) 

                            #errlog = open(os.getcwd() + "/errlog.txt", "a")
                            #errlog.write("{0} {1} publish check\n".format(
                            #    strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"]))
                            #errlog.close()
                        except Exception as e:
                            print(e)
                            tb = traceback.format_exc()
                            print(tb)
                            errlog = open(os.getcwd() + "/errlog.txt", "a")
                            errlog.write("{0} {1} Error 1: {2}\n".format(
                                strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"]), str(e))
                            errlog.close()
                            pass
                except Exception as e:
                    print(e)
                    print("publish failed")
                    #try:
                    #    mqtt_client.publish(
                    #        topic, devices_list[i]["profile"]["name"] + " data acquisition failed")
                    #except Exception as e:
                    #    print(e)
                    #    mqtt_client.reconnect()
                    #    pass

                    mqtt_client_local = MyMQTT.Client("localhost", 1883, retain, qos, username,
                                                password)
                    mqtt_client_local.set_usr_pw(username, password)
                    mqtt_client_local.connect()

                    mqtt_client_local.publish(
                        "subrack/error/log", {"data": "MODULAR I2C reading error/failed on device " + devices_list[i]["profile"]["name"]  , "type" : "major"}
                        )
                    
                    errlog = open(os.getcwd() + "/errlog.txt", "a")
                    errlog.write("{0} {1} Error 2: {2}\n".format(
                        strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"], str(e)))
                    errlog.close()
                    pass
            #errlog = open(os.getcwd() + "/errlog.txt", "a")
            #errlog.write("{0} {1} data acquisition check\n".format(
            #    strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"]))
            #.close()
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
            errlog.write("{0} {1} Error 3: your program sucks it goes out of the loop\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), devices_list[i]["profile"]["name"]))
            pass
        errlog = open(os.getcwd() + "/errlog.txt", "a")
        errlog.write("{0} loop check\n".format(strftime("%Y-%m-%d %H:%M:%S")))
        errlog.close()

