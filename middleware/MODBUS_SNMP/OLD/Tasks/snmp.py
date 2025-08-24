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


pp = pprint.PrettyPrinter(indent=2)
ParentFolder = os.path.abspath('..')

wait_delay = False
device = "" 
Subsclient = mqtt.Client()

# Function to get current memory usage (only for development stage)
def wait_until(somepredicate, timeout, period=0.25):
  mustend = time.time() + timeout
  while time.time() < mustend:
    if somepredicate: 
        return True
    time.sleep(period)
  return False

def get_process_memory():
    process = psutil.Process(os.getpid())
    return [process.memory_info().rss, process.memory_full_info().rss]

def process_data_subscribe(client, userdata, message):
    global Subsclient
    try:
        sub_data = json.loads(message.payload)
        if sub_data["ip_address"] == device:
            print("Get Subscribe data with topic: "+ message.topic + " in port: " + comport)
            if wait_until(wait_delay, 10, 0.1):
                if control.SNMP(sub_data):
                    print("succes control modbus")
                    sub_data["status"] = "succes control modbus"
                    Subsclient.publish( message.topic + "_status", json.dumps(sub_data))
                else:
                    print("failed control modbus")
                    sub_data["status"] = "failed control modbus"
                    Subsclient.publish( message.topic + "_status", json.dumps(sub_data))
            else:
                print("failed control modbus")
                sub_data["status"] = "failed control modbus"
                Subsclient.publish( message.topic + "_status", json.dumps(sub_data))
    except Exception as e:
        pass
    

def snmp_polling_task(profile, protocol_setting, interval, mqtt_config):
    global wait_delay, Subsclient, device

    device = protocol_setting["ip_address"]
    dev_poller = poller.SNMP(profile, protocol_setting)

    print(profile["name"], "is running")

    # MQTT config
    mqtt_enable = mqtt_config['enable']
    broker_address = mqtt_config['broker_address']
    broker_port = mqtt_config['broker_port']
    retain = mqtt_config['retain']
    qos = mqtt_config['qos']
    # topic = mqtt_config['pub_topic'][0] + str(profile["topic"])
    topic = mqtt_config['pub_topic'][0]
    username = mqtt_config['username']
    password = mqtt_config['password']
    print(topic)

    #config to Subscribe data
    Subsclient.on_message=process_data_subscribe 
    Subsclient.connect(mqtt_config['broker_address'])
    Subsclient.loop_start()
    Subsclient.subscribe(mqtt_config['sub_topic_snmp'])
    #print("Connecting to broker for Subscriber")

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
                            topic, profile["name"] + " data acquisition failed")
                        print("published")
                        # mqtt_client.disconnect()
                    except:
                        tb = traceback.format_exc()
                        print(tb)
                        pass

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
                                'mac': getmac.get_mac_address(),
                                'protocol_type': 'SNMP',
                                'ip_address': None,
                                'value': json.dumps(item["data"])
                            })
                            print("published")
                            # mqtt_client.disconnect()
                        except:
                            tb = traceback.format_exc()
                            print(tb)
                            pass

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
            # Wait for next data polling
            time.sleep(interval)
            tb = traceback.format_exc()
            print(tb)
