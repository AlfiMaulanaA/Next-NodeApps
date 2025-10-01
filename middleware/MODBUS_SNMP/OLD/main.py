from pdb import Restart
import sys
from dotenv.main import dotenv_values
import getmac
import datetime
import dotenv
import pprint
import traceback
import psutil
import threading
import os
import time
import signal
import json
from Poller.libs import PROTOCOLS, SNMP, MODBUS_RTU, MODBUS_TCP
from Tasks.snmp import snmp_polling_task
from Tasks.modbus_tcp import modbustcp_polling_task
from Tasks.modbus_rtu import modbusrtu_polling_task
import os
import requests

import paho.mqtt.client as mqtt

dotenv.load_dotenv()

print('[DEVICE MAC ADDRESS]', getmac.get_mac_address())

# Intial node registration
try:
    res = requests.post(
        f'{dotenv_values()["BASE_URL"]}/register-node', headers={'content-type': 'application/json'}, json={'mac_address': getmac.get_mac_address(), 'name': f'RPI {datetime.datetime.now().isoformat()}'}, timeout =5)

    print('[NODE REGISTER STATUS]', res.status_code)
    print('[NODE REGISTER BODY]', res.json())

except Exception as e:
    print('[Register node error]', e)

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
    polling_interval = 60  # DEFAULT VALUE (5 seconds)
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
    INSTALLED_DEVICES = []
    with open(os.getcwd() + '/JSON/Config/installed_devices.json') as json_data:
        INSTALLED_DEVICES = json.load(json_data)

    # Clustering equipments (profile and protocol setting) based on their communication protocol
    INSTALLED_DEVICES_SORTED = {
        "SNMP": [],
        "Modbus TCP": [],
        "Modbus RTU": {},
    }

    for i, item in enumerate(INSTALLED_DEVICES):
        protocol_type = item['protocol_setting']['protocol']
        # FOR MODBUS RTU
        if protocol_type == MODBUS_RTU:
            comm_port = item['protocol_setting']['port']
            if comm_port in INSTALLED_DEVICES_SORTED[protocol_type]:
                INSTALLED_DEVICES_SORTED[protocol_type][comm_port]['profile_list'].append(
                    item['profile'])
                INSTALLED_DEVICES_SORTED[protocol_type][comm_port]['protocol_setting_list'].append(
                    item['protocol_setting'])
            else:
                INSTALLED_DEVICES_SORTED[protocol_type][comm_port] = {
                    "profile_list": [],
                    "protocol_setting_list": []
                }
                INSTALLED_DEVICES_SORTED[protocol_type][comm_port]['profile_list'].append(
                    item['profile'])
                INSTALLED_DEVICES_SORTED[protocol_type][comm_port]['protocol_setting_list'].append(
                    item['protocol_setting'])
        # FOR MODBUS TCP and SNMP
        else:
            INSTALLED_DEVICES_SORTED[protocol_type].append(item)

    print("\n====================================== INSTALLED DEVICES SORTED =========================================")
    pp.pprint(INSTALLED_DEVICES_SORTED)

    # Get MQTT service config
    MQTT_CONFIG = {}
    with open(os.getcwd() + '/JSON/Config/mqtt_config.json') as json_data:
        MQTT_CONFIG = json.load(json_data)

    print("\n====================================== MQTT CONFIG =========================================")
    pp.pprint(MQTT_CONFIG)
    
    # Subscribe for control system
    Subsclient = mqtt.Client()
    Subsclient.on_message=process_data_subscribe 
    Subsclient.connect(MQTT_CONFIG["broker_address"], MQTT_CONFIG["broker_port"])
    Subsclient.loop_start()
    Subsclient.subscribe(MQTT_CONFIG['sub_topic_system'])

    print("\n============================ MQTT Subrcribe System Control ===============================")

    # GET POLLING INTERVAL
    INTERVAL = get_polling_interval()

    print("\n====================================== Threads =========================================")
    try:
        threads = {protocol: [] for protocol in PROTOCOLS}

        for protocol in PROTOCOLS:
            if protocol == SNMP:
                for i, each_device in enumerate(INSTALLED_DEVICES_SORTED[protocol]):
                    profile = each_device['profile']
                    protocol_setting = each_device['protocol_setting']
                    threads[protocol].append(threading.Thread(target=snmp_polling_task, args=[
                                             profile, protocol_setting, INTERVAL, MQTT_CONFIG]))
                    threads[protocol][i].setDaemon(True)
                    threads[protocol][i].start()
            elif protocol == MODBUS_TCP:
                for i, each_device in enumerate(INSTALLED_DEVICES_SORTED[protocol]):
                    profile = each_device['profile']
                    protocol_setting = each_device['protocol_setting']
                    threads[protocol].append(threading.Thread(target=modbustcp_polling_task, args=[
                                             profile, protocol_setting, INTERVAL, MQTT_CONFIG]))
                    threads[protocol][i].setDaemon(True)
                    threads[protocol][i].start()
            elif protocol == MODBUS_RTU:
                for i, comm_port in enumerate(INSTALLED_DEVICES_SORTED[protocol].keys()):
                    profile_list = INSTALLED_DEVICES_SORTED[protocol][comm_port]['profile_list']
                    protocol_setting_list = INSTALLED_DEVICES_SORTED[
                        protocol][comm_port]['protocol_setting_list']
                    threads[protocol].append(threading.Thread(target=modbusrtu_polling_task, args=[
                                             profile_list, protocol_setting_list, INTERVAL, MQTT_CONFIG, comm_port]))
                    threads[protocol][i].setDaemon(True)
                    threads[protocol][i].start()

        print("All Threads started")
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
