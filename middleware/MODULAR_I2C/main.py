from pdb import Restart
import sys
import getmac
import datetime
import pprint
import traceback
import psutil
import threading
import os
import time
import signal
import json
from Tasks.i2c_modular import i2c_modular_polling_task
from Tasks.i2c_out import i2c_out_polling_task
import os
import requests

import paho.mqtt.client as mqtt
from time import strftime, localtime

timeout = 5

MODULAR = "Modular"
I2COUT = "I2Cout"
PROTOCOLS = [MODULAR, I2COUT]

pp = pprint.PrettyPrinter(indent=2)
ParentFolder = os.path.abspath('..')

# Function to get current memory usage (only for development stage)
def get_process_memory():
    process = psutil.Process(os.getpid())
    return [process.memory_info().rss, process.memory_full_info().rss]

# Function to get polling intervalv1/devices/me/telemetry
def get_polling_interval():
    # [http get] polling interval from API
    # ... insert codes here

    # In case API cannot provide this
    polling_interval = 1  # DEFAULT VALUE (5 seconds)
    return polling_interval


class ServiceExit(Exception):
    pass


def service_shutdown(signum, frame):
    print('Caught signal %d' % signum)
    raise ServiceExit

def process_data_subscribe(client, userdata, message):
    print("Get Subscribe data system control with topic: "+ message.topic)
    sub_data = json.loads(message.payload)
    if sub_data["control"] == "restart":
        print("Restart")
        os.execl(sys.executable, sys.executable, *sys.argv)

if __name__ == '__main__':
    # Set polling task status
    
    FINISH = False
    with open(os.getcwd() + '/stat.temp', 'w') as file:
        file.write(str(FINISH))

    # Register the signal handlers
    signal.signal(signal.SIGTERM, service_shutdown)
    signal.signal(signal.SIGINT, service_shutdown)

    print("Starting Poller")
    print("...")

    # Get all device profile and protocol setting via API
    # Modular
    INSTALLED_DEVICES = []
    with open(os.getcwd() + '/JSON/Config/installed_devices.json') as json_data:
        INSTALLED_DEVICES = json.load(json_data)

    # Clustering equipments (profile and protocol setting) based on their communication protocol
    INSTALLED_DEVICES_SORTED = {
        "Modular": [],
        "I2Cout": [],    
    }

    for i,item in enumerate(INSTALLED_DEVICES):
        protocol_type = item['protocol_setting']['protocol']
        INSTALLED_DEVICES_SORTED[protocol_type].append(item)

    print("\n====================================== INSTALLED DEVICES SORTED =========================================")
    pp.pprint(INSTALLED_DEVICES_SORTED)


    # Get MQTT service config
    MQTT_CONFIG = {}
    with open(os.getcwd() + '/JSON/Config/mqtt_config.json') as json_data:
        MQTT_CONFIG = json.load(json_data)
    
    # Subscribe for control system
    while True:
        try:
            # Subscribe for control system
            Subsclient = mqtt.Client()
            Subsclient.on_message=process_data_subscribe 
            Subsclient.connect(MQTT_CONFIG["broker_address"], MQTT_CONFIG["broker_port"])
            Subsclient.loop_start()
            Subsclient.subscribe(MQTT_CONFIG['sub_topic_system'])
            print("MAIN: Succes Connecting to broker for Subscriber")
            break
        except Exception as e:
            print(e)
            print("Failed to connect broker mqtt")
            time.sleep(5)
            Timestamp = strftime("%Y-%m-%d %H:%M:%S", localtime())
            mqtt_client = mqtt.Client()
            #mqtt_client.set_usr_pw("", "")
            mqtt_client.connect("localhost", 1883)
            mqtt_client.publish(
                "subrack/error/log", json.dumps({"data": "MODULAR I2C cannot connect to server broker mqtt", "type" : "critical", "Timestamp" : Timestamp})
                )

            errlog = open(os.getcwd() + "/errlog.txt", "a")
            errlog.write("{0} {1} Error 5: {2}\n".format(
                strftime("%Y-%m-%d %H:%M:%S", localtime()), "modbus snmp task", "Failed to connect broker mqtt"))
            errlog.close()

    print("\n=================== MQTT CONFIG and MQTT Subrcribe System Control ======================")
    pp.pprint(MQTT_CONFIG)
    
    

    # GET POLLING INTERVAL
    INTERVAL = get_polling_interval()

    print("\n====================================== Threads =========================================")
    try:
        print("All Threads started")
        threads = {protocol: [] for protocol in PROTOCOLS}
        for protocol in PROTOCOLS:
            if protocol == MODULAR:
                threads[protocol] = threading.Thread(target=i2c_modular_polling_task, args=[
                                             INSTALLED_DEVICES_SORTED[MODULAR], INTERVAL, MQTT_CONFIG])
                threads[protocol].setDaemon(True)
                threads[protocol].start()
            elif protocol == I2COUT:
                #threads[protocol] = threading.Thread(target=i2c_out_polling_task, args=[
                #                            INSTALLED_DEVICES_SORTED[I2COUT], INTERVAL, MQTT_CONFIG])
                #threads[protocol].setDaemon(True)
                #threads[protocol].start()
                print("test")
        while (True):
            time.sleep(0.5)

    except ServiceExit:
        # Set polling task status
        print("Finished")
        FINISH = True
        with open(os.getcwd() + '/stat.temp', 'w') as file:
            file.write(str(FINISH))

        for protocol in PROTOCOLS:
            for thread in threads[protocol]:
                thread.join()
        print('All Thread Stopped')
    except:
        tb = traceback.format_exc()
        # print(tb)
