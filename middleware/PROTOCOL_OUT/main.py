import threading
import time
import pull_data_to_json
import MODBUS_TCP_SERVER.modbus_tcp_server as modbus_tcp_server
import SNMP_SERVER.A as snmp_server
import os, sys
import json
import paho.mqtt.client as mqtt

protocolout_config = {}
with open(os.getcwd() + '/JSON/Config/protocolout_config.json') as json_data:
    protocolout_config = json.load(json_data)


def threading_Modbus_tcp_server():
    modbus_tcp_server.modbus_tcp_server_main()

def threading_snmp_server():
    snmp_server.snmp_server_main()

def _process_data_subscribe(client, userdata, message):
    print("MAIN : Get Subscribe data system control with topic: "+ message.topic)
    data = json.loads(message.payload)
    #protocolout_config["MODBUS_TCP"] = data["MODBUS_TCP"]
    #protocolout_config["SNMP"] = data["SNMP"]
    if data["restart"]:
        os.execl(sys.executable, sys.executable, *sys.argv)



client = mqtt.Client("Protocol_out")
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

client = mqtt.Client()
client.on_message=_process_data_subscribe 
client.connect(MQTT_CONFIG["broker_address"], MQTT_CONFIG["broker_port"])
client.loop_start()
client.subscribe(MQTT_CONFIG['sub_topic_system'])

if __name__ == '__main__':
    try:
        if protocolout_config["SNMP"]:
            print("Protocolout SNMP Running")
            t2 = threading.Thread(target=threading_snmp_server)
            t2.start()
        if protocolout_config["MODBUS_TCP"]:
            print("Protocolout MODBUS TCP Running")
            t1 = threading.Thread(target=threading_Modbus_tcp_server)
            t1.start()
        
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
