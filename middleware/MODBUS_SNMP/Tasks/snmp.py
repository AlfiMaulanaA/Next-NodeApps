import json
import getmac
import Poller.poller_task as poller
import pprint
import traceback
import time
import psutil
import os
import ast
import Protocols.mqtt as MyMQTT
import paho.mqtt.client as mqtt
import Poller.poller_control as control
from time import strftime, localtime

pp = pprint.PrettyPrinter(indent=2)
ParentFolder = os.path.abspath('..')

device = "" 
Subsclient = mqtt.Client()
sub_data = []
sub_topic = ""

# Function to get current memory usage (only for development stage)
def get_process_memory():
    process = psutil.Process(os.getpid())
    return [process.memory_info().rss, process.memory_full_info().rss]

def process_data_subscribe_in_loop():
    global Subsclient, sub_data, sub_topic, device
    try:
        if sub_data["ip_address"] == device:
            print("SNMP: Get Subscribe data with topic: "+ sub_topic + " in device ip: " + device)
            if control.SNMP(sub_data):
                print("SNMP: succes control SNMP")
                sub_data["status"] = "succes control SNMP"
                Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
            else:
                print("SNMP: failed control SNMP with data cannot poll")
                sub_data["status"] = "failed control SNMP with data cannot poll"
                Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
        else:
            print("SNMP: failed control SNMP with IP not same with data recorded")
            sub_data["status"] = "failed control SNMP with IP not same with data recorded"
            Subsclient.publish( sub_topic + "_status", json.dumps(sub_data))
    except Exception as e:
        print("SNMP: " + str(e))
        mqtt_client = MyMQTT.Client("localhost", 1883, True, 1, "",
                                "")
        mqtt_client.set_usr_pw("", "")
        mqtt_client.connect()
        mqtt_client.publish(
            "subrack/error/log", {"data": "SNMP failed to control", "type" : "minor"}
            )
        pass

def process_data_subscribe(client, userdata, message):
    global sub_data, sub_topic
    sub_data = json.loads(message.payload)
    sub_topic = message.topic
    with open(os.getcwd() + '/stat_subscribe_snmp.temp', 'w') as file:
            file.write(str(True))


def snmp_polling_task(profile, protocol_setting, interval, mqtt_config):
    global Subsclient, device

    device = protocol_setting["ip_address"]
    dev_poller = poller.SNMP(profile, protocol_setting)

    # MQTT config
    mqtt_enable = mqtt_config['enable']
    broker_address = mqtt_config['broker_address']
    broker_port = mqtt_config['broker_port']
    retain = mqtt_config['retain']
    qos = mqtt_config['qos']
    topic = profile["topic"]
    #topic = mqtt_config['pub_topic'][0]
    username = mqtt_config['username']
    password = mqtt_config['password']
    protocol_verison = protocol_setting["protocol"] + " V" + str(protocol_setting["snmp_version"])
    device_name = profile["name"] 
    print("SNMP: " + device_name +  " is running")

    while True:
        try:
            #config to Subscribe data
            Subsclient.on_message=process_data_subscribe 
            Subsclient.connect(mqtt_config['broker_address'])
            Subsclient.loop_start()
            Subsclient.subscribe(mqtt_config['sub_topic_snmp'])
            print("SNMP: Succes Connecting to broker for Subscriber")
            #print("Connecting to broker for Subscriber")
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
                "subrack/error/log", {"data": "SNMP cannot connect to server broker mqtt", "type" : "critical"}
                )

            errlog = open(os.getcwd() + "/errlog.txt", "a")
            errlog.write("{0} {1} Error 5: {2}\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "snmp task", "Failed to connect broker mqtt"))
            errlog.close()

    # Read Polling Service Status
    with open(os.getcwd() + '/stat.temp') as file:
        FINISH = ast.literal_eval(file.read())

    while (not FINISH):
        try:
            data = dev_poller.poll()
            if data == -1:
                if mqtt_enable:
                    try:
                        mqtt_client = MyMQTT.Client(broker_address, broker_port, retain, qos, username,
                                                    password)
                        mqtt_client.set_usr_pw(username, password)
                        mqtt_client.connect()
                        mqtt_client.publish(
                            topic + "status", profile["name"] + " data acquisition failed")
                        

                        mqtt_client = MyMQTT.Client("localhost", 1883, retain, qos, username,
                                                    password)
                        mqtt_client.set_usr_pw(username, password)
                        mqtt_client.connect()
                        mqtt_client.publish(
                            topic + "_status", device_name + " data acquisition failed")
                        mqtt_client.publish("modbus_snmp_summ", {
                        'MODBUS SNMP STATUS': device_name + " data acquisition failed"
                        })
                        
                        mqtt_client.publish(
                            "subrack/error/log", {"data": "SNMP reading error/failed on device " + device_name, "type" : "major"}
                        )

                        print("SNMP: published")
                        # mqtt_client.disconnect()
                    except:
                        tb = traceback.format_exc()
                        print(tb)
                        pass
                    errlog = open(os.getcwd() + "/errlog.txt", "a")
                    errlog.write("{0} {1} Error: data acquisition failed\n".format(
                        strftime("%Y-%m-%d %H:%M:%S", localtime()), profile["name"]))
                    errlog.close()

            # Publish data to MQTT Broker IF MQTT SERVICE ENABLED
            else:
                for item in data:
                    #username = item["username"]
                    #password = item["password"]
                    if mqtt_enable:
                        try:
                            mqtt_client = MyMQTT.Client(broker_address, broker_port, retain, qos, username,
                                                        password)
                            mqtt_client.set_usr_pw(username, password)
                            mqtt_client.connect()
                            # mqtt_client.publish(topic, item["data"])
                            # DYNAMIC: ADDITIONAL DATA SNMP
                            mqtt_client.publish(topic, {
                                'device_name': device_name,
                                'protocol_type': protocol_verison,
                                'ip_address': device,
                                'value': json.dumps(item["data"])
                            })

                            mqtt_client = MyMQTT.Client("localhost", 1883, retain, qos, username,
                                                        password)
                            mqtt_client.set_usr_pw(username, password)
                            mqtt_client.connect()
                            mqtt_client.publish(
                                topic + "_status", device_name + " data acquisition success")
                            mqtt_client.publish("modbus_snmp_summ", {
                            'MODBUS SNMP STATUS': device_name + " data acquisition success"
                            })

                            print("SNMP: published")
                        except:
                            tb = traceback.format_exc()
                            print(tb)
                            pass
            any_subs =  False
            with open(os.getcwd() + '/stat_subscribe_snmp.temp') as file:
                any_subs = ast.literal_eval(file.read())
            print("SNMP: any_subs: ", any_subs)
            if any_subs:
                process_data_subscribe_in_loop()
                with open(os.getcwd() + '/stat_subscribe_snmp.temp', 'w') as file:
                    file.write(str(False))

            # Read Polling Service Status
            with open(os.getcwd() + '/stat.temp') as file:
                FINISH = ast.literal_eval(file.read())

            # Wait for next data polling
            for i in range(interval):
                time.sleep(1)

        except KeyboardInterrupt:
            print('SNMP: Interrupted')
            break
        except:
            # Wait for next data polling
            time.sleep(interval)
            tb = traceback.format_exc()
            print(tb)
            pass
