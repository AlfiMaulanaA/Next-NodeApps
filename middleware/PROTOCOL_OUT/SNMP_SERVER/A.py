import sys
import pysnmp
from pysnmp.smi.mibs.instances import *
from pysnmp.entity import engine, config
from pysnmp.entity.rfc3413 import cmdrsp, context
from pysnmp.carrier.asynsock.dgram import udp
from pysnmp.proto.api import v2c
import random, traceback
from SNMP_SERVER.RegOID import *
#from GSPE_DCB105ZK import *
import time, os, inspect, json
from SNMP_SERVER.DataType import dataType
import getmac
from time import strftime, localtime
import paho.mqtt.client as mqtt

ParentFolder = os.path.abspath('..')
FolderPath = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))

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


def snmp_server_main():
    while (True):
        try:
            Trial = 0
            while(Trial <= 150):
                try:
                    with open(FolderPath + '/json/Comm.json') as json_data:
                        Comm = json.load(json_data)
                    break
                except:
                    Trial += 1
                    time.sleep(0.05)
                    

            sysOID = Comm['sysOID'].split('.')[1:]
            sysOID = list(map(int,sysOID))
            sysOID = tuple(sysOID)

            # print("SNMP: Reading Interface for get IP network")
            # with open('/etc/network/interfaces', "r") as file_interface:
            #     interface_data_line = file_interface.readlines()

            # matric_eth = interface_data_line[14].split(" ")[-1].replace('\n', '')
            # if matric_eth == "1000":
            #     Comm['snmpIPaddress'] = interface_data_line[27].split(" ")[-1].replace('\n', '')
            # else:
            #     Comm['snmpIPaddress'] = interface_data_line[15].split(" ")[-1].replace('\n', '')

            print("SNMP: SNMP Agent IP Address: ", Comm['snmpIPaddress'])
            print("SNMP: SNMP Port: ", Comm['snmpPort'])
            print("SNMP: SNMP Version: ", Comm['snmpVersion'])
            print("SNMP: SNMP Community: ", Comm['snmpCommunity'])
            
            # Create SNMP engine
            snmpEngine = engine.SnmpEngine()

            # Transport setup

            # UDP over IPv4
            config.addSocketTransport(
                snmpEngine,
                udp.domainName,
                udp.UdpTransport().openServerMode((Comm['snmpIPaddress'], int(Comm['snmpPort'])))
            )

            # SNMPv2c setup

            # SecurityName <-> CommunityName mapping.
            config.addV1System(snmpEngine, 'my-area', Comm['snmpCommunity'])

            # Allow read MIB access for this user / securityModels at VACM
            config.addVacmUser(snmpEngine, int(Comm['snmpVersion']), 'my-area', 'noAuthNoPriv', sysOID, sysOID)


            # Create an SNMP context
            snmpContext = context.SnmpContext(snmpEngine)

            # --- create custom Managed Object Instance ---

            mibBuilder = snmpContext.getMibInstrum().getMibBuilder()

            MibScalar, MibScalarInstance = mibBuilder.importSymbols(
                'SNMPv2-SMI', 'MibScalar', 'MibScalarInstance'
            )

            class MyStaticMibScalarInstance(MibScalarInstance):
                def setValue(self, value, name, idx):
                    self._oid = list(self.name)[0:-1]
                    Category = self._oid[8]
                    self.SpecificOID = self._oid[9:]
                    
                    #--------------------------------------------------- SNMP Setting -----------------------------------------------------
                    if Category == 5:
                        self.varName = SNMPSetting_oids[str(self.SpecificOID)]
                        print("SNMP: " + str(self.SpecificOID))
                        print("SNMP: " + self.varName)
                        
                        if dataType[self.varName] == 'Float':
                            value = float(value)
                        elif dataType[self.varName] == 'Integer':
                            value = int(value)
                        elif dataType[self.varName] == 'Boolean':
                            value = int(value)
                        elif dataType[self.varName] == 'String':
                            value = str(value)

                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Comm.json') as json_data:
                                    dat = json.load(json_data)
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                        dat[self.varName] = value
                        
                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Comm.json', 'w') as file:
                                    file.write(json.dumps(dat))
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                                
                        print('SNMP: changed: ' + self.varName)
                        return self.getSyntax().clone(str(value))

                    #--------------------------------------------------- Analog Input Output -----------------------------------------------------
                    elif Category == 6:
                        self.numberModular = self.SpecificOID[1] 
                        self.numberPin = int(self.SpecificOID[2] / 10)
                        list_modular = []
                        with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
                            list_modular = json.load(json_data)

                        for i in range(len(list_modular)):
                            topic_pub = list_modular[i]["profile"]["topic"]
                            type_modular = topic_pub.split("/")[2]
                            number_modular = topic_pub.split("/")[3]
                            if "analog_io" == type_modular and self.numberModular == number_modular:
                                fix_device = list_modular[i]["profile"]["part_number"]
                                fix_address = list_modular[i]["protocol_setting"]["address"]
                                fix_device_bus = list_modular[i]["protocol_setting"]["device_bus"]
                                
                                send_msg = {
                                    "mac":getmac.get_mac_address(),
                                    "protocol_type":"Modular",
                                    "device": fix_device,
                                    "function": "write",
                                    "value": {"pin": int(self.numberPin),"data": value},
                                    "address": fix_address,
                                    "device_bus": fix_device_bus,
                                    "Timestamp": strftime("%Y-%m-%d %H:%M:%S", localtime())
                                    }
                                print("SNMP: " + json.dumps(send_msg))
                            else:
                                print("SNMP: your modular not configure")
                        
                        #print(self.numberModular)
                        #print(self.numberPin)
                        #print(value)
                        return self.getSyntax().clone(int(value))

                    #--------------------------------------------------- Modular Optocoupler ---------------------------------------------------
                    elif Category == 7:
                        self.numberModular = self.SpecificOID[1] 
                        self.numberPin = int(self.SpecificOID[2] / 10)
                        list_modular = []
                        with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
                            list_modular = json.load(json_data)

                        for i in range(len(list_modular)):
                            topic_pub = list_modular[i]["profile"]["topic"]
                            type_modular = topic_pub.split("/")[2]
                            number_modular = topic_pub.split("/")[3]
                            if "optocoupler" == type_modular and self.numberModular == int(number_modular):
                                fix_device = list_modular[i]["profile"]["part_number"]
                                fix_address = list_modular[i]["protocol_setting"]["address"]
                                fix_device_bus = list_modular[i]["protocol_setting"]["device_bus"]
                                
                                send_msg = {
                                    "mac":getmac.get_mac_address(),
                                    "protocol_type":"Modular",
                                    "device": fix_device,
                                    "function": "write",
                                    "value": {"pin": int(self.numberPin),"data": int(value)},
                                    "address": fix_address,
                                    "device_bus": fix_device_bus,
                                    "Timestamp": strftime("%Y-%m-%d %H:%M:%S", localtime())
                                    }
                                print("SNMP: " + json.dumps(send_msg))
                                Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                                
                            else:
                                print("SNMP: your modular not configure")
                        
                        #print(self.numberModular)
                        #print(self.numberPin)
                        #print(value)
                        return self.getSyntax().clone(int(value))

                    #--------------------------------------------------- Modular GPIO ---------------------------------------------------
                    elif Category == 8:
                        self.numberModular = self.SpecificOID[1] 
                        self.numberPin = int(self.SpecificOID[2] / 10)
                        list_modular = []
                        with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
                            list_modular = json.load(json_data)

                        for i in range(len(list_modular)):
                            topic_pub = list_modular[i]["profile"]["topic"]
                            type_modular = topic_pub.split("/")[2]
                            number_modular = topic_pub.split("/")[3]
                            if "gpio" == type_modular and self.numberModular == int(number_modular):
                                fix_device = list_modular[i]["profile"]["part_number"]
                                fix_address = list_modular[i]["protocol_setting"]["address"]
                                fix_device_bus = list_modular[i]["protocol_setting"]["device_bus"]
                                
                                send_msg = {
                                    "mac":getmac.get_mac_address(),
                                    "protocol_type":"Modular",
                                    "device": fix_device,
                                    "function": "write",
                                    "value": {"pin": int(self.numberPin),"data": int(value)},
                                    "address": fix_address,
                                    "device_bus": fix_device_bus,
                                    "Timestamp": strftime("%Y-%m-%d %H:%M:%S", localtime())
                                    }
                                print("SNMP: " + json.dumps(send_msg))
                                Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                                
                            else:
                                print("SNMP: your modular not configure")
                        
                        #print(self.numberModular)
                        #print(self.numberPin)
                        #print(value)
                        return self.getSyntax().clone(int(value))

                    #--------------------------------------------------- Modular Drycontact ---------------------------------------------------
                    elif Category == 9:
                        self.numberModular = self.SpecificOID[1] 
                        self.numberPin = int(self.SpecificOID[2] / 10)
                        list_modular = []
                        with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
                            list_modular = json.load(json_data)

                        for i in range(len(list_modular)):
                            topic_pub = list_modular[i]["profile"]["topic"]
                            type_modular = topic_pub.split("/")[2]
                            number_modular = topic_pub.split("/")[3]
                            if "drycontact" == type_modular and self.numberModular == int(number_modular):
                                fix_device = list_modular[i]["profile"]["part_number"]
                                fix_address = list_modular[i]["protocol_setting"]["address"]
                                fix_device_bus = list_modular[i]["protocol_setting"]["device_bus"]
                                
                                send_msg = {
                                    "mac":getmac.get_mac_address(),
                                    "protocol_type":"Modular",
                                    "device": fix_device,
                                    "function": "write",
                                    "value": {"pin": int(self.numberPin),"data": int(value)},
                                    "address": fix_address,
                                    "device_bus": fix_device_bus,
                                    "Timestamp": strftime("%Y-%m-%d %H:%M:%S", localtime())
                                    }
                                print("SNMP: " + json.dumps(send_msg))
                                Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                                
                            else:
                                print("SNMP: your modular not configure")
                        
                        #print(self.numberModular)
                        #print(self.numberPin)
                        #print(value)
                        return self.getSyntax().clone(int(value))

                    #--------------------------------------------------- Modular Relay ---------------------------------------------------
                    elif Category == 10:
                        self.numberModular = self.SpecificOID[1] 
                        self.numberPin = int(self.SpecificOID[2] / 10)
                        list_modular = []
                        with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
                            list_modular = json.load(json_data)

                        for i in range(len(list_modular)):
                            topic_pub = list_modular[i]["profile"]["topic"]
                            type_modular = topic_pub.split("/")[2]
                            number_modular = topic_pub.split("/")[3]
                            if "relay" == type_modular and self.numberModular == int(number_modular):
                                fix_device = list_modular[i]["profile"]["part_number"]
                                fix_address = list_modular[i]["protocol_setting"]["address"]
                                fix_device_bus = list_modular[i]["protocol_setting"]["device_bus"]
                                
                                send_msg = {
                                    "mac":getmac.get_mac_address(),
                                    "protocol_type":"Modular",
                                    "device": fix_device,
                                    "function": "write",
                                    "value": {"pin": int(self.numberPin),"data": int(value)},
                                    "address": fix_address,
                                    "device_bus": fix_device_bus,
                                    "Timestamp": strftime("%Y-%m-%d %H:%M:%S", localtime())
                                    }
                                print("SNMP: " + json.dumps(send_msg))
                                Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                                
                            else:
                                print("SNMP: your modular not configure")
                        
                        #print(self.numberModular)
                        #print(self.numberPin)
                        #print(value)
                        return self.getSyntax().clone(int(value))
                    #--------------------------------------------------- Modular Relay Mini---------------------------------------------------
                    elif Category == 11:
                        self.numberModular = self.SpecificOID[1] 
                        self.numberPin = int(self.SpecificOID[2] / 10)
                        list_modular = []
                        with open(ParentFolder + '/MODULAR_I2C/JSON/Config/installed_devices.json') as json_data:
                            list_modular = json.load(json_data)

                        for i in range(len(list_modular)):
                            topic_pub = list_modular[i]["profile"]["topic"]
                            type_modular = topic_pub.split("/")[2]
                            number_modular = topic_pub.split("/")[3]
                            if "relay_mini" == type_modular and self.numberModular == int(number_modular):
                                fix_device = list_modular[i]["profile"]["part_number"]
                                fix_address = list_modular[i]["protocol_setting"]["address"]
                                fix_device_bus = list_modular[i]["protocol_setting"]["device_bus"]
                                
                                send_msg = {
                                    "mac":getmac.get_mac_address(),
                                    "protocol_type":"Modular",
                                    "device": fix_device,
                                    "function": "write",
                                    "value": {"pin": int(self.numberPin),"data": int(value)},
                                    "address": fix_address,
                                    "device_bus": fix_device_bus,
                                    "Timestamp": strftime("%Y-%m-%d %H:%M:%S", localtime())
                                    }
                                print("SNMP: " + json.dumps(send_msg))
                                Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                                
                            else:
                                print("SNMP: your modular not configure")
                        
                        #print(self.numberModular)
                        #print(self.numberPin)
                        #print(value)
                        return self.getSyntax().clone(int(value))
                    #--------------------------------------------------- Equipment Modbus RTU ---------------------------------------------------               
                    elif Category == 12:
                        self.number_equipment = self.SpecificOID[0]
                        self.number_data_equipment = self.SpecificOID[1]

                        lst_file_equipment_json = []
                        lst_file_equipment_json_raw = os.listdir(ParentFolder + '/PROTOCOL_OUT/SNMP_SERVER/json/Equipment/') # your directory path
                        for i in range(len(lst_file_equipment_json_raw)):
                            if lst_file_equipment_json_raw[i].endswith(".json"):
                                lst_file_equipment_json.append(lst_file_equipment_json_raw[i])
                        lst_file_equipment_json.sort()

                        for i in range(len(lst_file_equipment_json)):
                            with open(ParentFolder + '/PROTOCOL_OUT/SNMP_SERVER/json/Equipment/' + lst_file_equipment_json[i]) as json_data:
                                data_equipment = json.load(json_data)
                                try:
                                    del data_equipment["PollingDuration"]
                                    del data_equipment["Timestamp"]
                                except Exception as e:
                                    #print("SNMP: problem in delete " + str(e))
                                    pass
                                list_data_equipment = []
                                for item_data_equipment in data_equipment:
                                    list_data_equipment.append(item_data_equipment)

                                for j in range(len(data_equipment)):
                                    if (i + 1) == self.number_equipment and (j + 1) == self.number_data_equipment:
                                        self.varVal = data_equipment[list_data_equipment[j]]
                                        data_type_equipment_raw = lst_file_equipment_json[i].replace(".json","")
                                        data_type_equipment_number = data_type_equipment_raw.split("_")[-1:][0]
                                        data_type_equipment = data_type_equipment_raw.replace("_" + data_type_equipment_number, "")
                                        print("SNMP: Write " + list_data_equipment[j], " : ", str(value))

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
                                            if data_item["var_name"] == list_data_equipment[j]:
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
                                            "value":{"address": fix_register,"value": int(value)},
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
                        
                        return self.getSyntax().clone(int(1))

                def getValue(self, name, idx):
                    #print(self.name)
                    self._oid = list(self.name)[0:-1]
                    Category = self._oid[8]
                    self.SpecificOID = self._oid[9:]
                    #--------------------------------------------------- SNMP Setting ---------------------------------------------------
                    if Category == 5:
                        #print("SNMP Setting")
                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Comm.json') as json_data:
                                    dat = json.load(json_data)
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                        self.varName = SNMPSetting_oids[str(self.SpecificOID)]
                        self.varVal = dat[self.varName]
                        #print(str(self.SpecificOID))
                        #print(self.varName, " : ", self.varVal)
                        return self.getSyntax().clone(str(self.varVal))
                    #--------------------------------------------------- Modular Analaog Input Output ---------------------------------------------------
                    elif Category == 6:
                        self.numberModular = self.SpecificOID[1]
                        self.numberPin = self.SpecificOID[2]
                        #print(str(self.numberModular))
                        #print(str(self.numberPin))
                        #print("Modular analog input ouput")
                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Modular/analog_io/modular_analog_io_%d.json' %self.numberModular) as json_data:
                                    dat = json.load(json_data)
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                        self.varName = mod_analog_io['[' + str(self.numberPin) + ']']
                        self.varVal = dat[self.varName]
                        print("SNMP: " + self.varName, " : ", self.varVal)
                        return self.getSyntax().clone(int(self.varVal))
                    #--------------------------------------------------- Modular Optocoupler ---------------------------------------------------
                    elif Category == 7:
                        self.numberModular = self.SpecificOID[1]
                        self.numberPin = self.SpecificOID[2]
                        #print(str(self.numberModular))
                        #print(str(self.numberPin))
                        #print("Modular Optocoupler")
                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Modular/optocoupler/modular_optocoupler_%d.json' %self.numberModular) as json_data:
                                    dat = json.load(json_data)
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                        self.varName = mod_optocoupler['[' + str(self.numberPin) + ']']
                        self.varVal = dat[self.varName]
                        print("SNMP: " + self.varName, " : ", self.varVal)
                        return self.getSyntax().clone(int(self.varVal))
                    #--------------------------------------------------- Modular GPIO ---------------------------------------------------
                    elif Category == 8:
                        self.numberModular = self.SpecificOID[1]
                        self.numberPin = self.SpecificOID[2]
                        #print(str(self.numberModular))
                        #print(str(self.numberPin))
                        #print("Modular GPIO")
                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Modular/gpio/modular_gpio_%d.json' %self.numberModular) as json_data:
                                    dat = json.load(json_data)
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                        self.varName = mod_gpio['[' + str(self.numberPin) + ']']
                        self.varVal = dat[self.varName]
                        print("SNMP: " +self.varName, " : ", self.varVal)
                        return self.getSyntax().clone(int(self.varVal))
                    #--------------------------------------------------- Modular Drycontact ---------------------------------------------------
                    elif Category == 9:
                        self.numberModular = self.SpecificOID[1]
                        self.numberPin = self.SpecificOID[2]
                        #print(str(self.numberModular))
                        #print(str(self.numberPin))
                        #print("Modular Drycontact")
                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Modular/drycontact/modular_drycontact_%d.json' %self.numberModular) as json_data:
                                    dat = json.load(json_data)
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                        self.varName = mod_drycontact['[' + str(self.numberPin) + ']']
                        self.varVal = dat[self.varName]
                        print("SNMP: " + self.varName, " : ", self.varVal)
                        return self.getSyntax().clone(int(self.varVal))
                    #--------------------------------------------------- Modular Relay ---------------------------------------------------
                    elif Category == 10:
                        self.numberModular = self.SpecificOID[1]
                        self.numberPin = self.SpecificOID[2]
                        #print(str(self.numberModular))
                        #print(str(self.numberPin))
                        #print("Modular Relay")
                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Modular/relay/modular_relay_%d.json' %self.numberModular) as json_data:
                                    dat = json.load(json_data)
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                        self.varName = mod_relay['[' + str(self.numberPin) + ']']
                        self.varVal = dat[self.varName]
                        print("SNMP: " + self.varName, " : ", self.varVal)
                        return self.getSyntax().clone(int(self.varVal))
                    #--------------------------------------------------- Modular Relay Mini ---------------------------------------------------
                    elif Category == 11:
                        self.numberModular = self.SpecificOID[1]
                        self.numberPin = self.SpecificOID[2]
                        #print(str(self.numberModular))
                        #print(str(self.numberPin))
                        #print("Modular Relay Mini")
                        self.Trial = 0
                        while(self.Trial <= 150):
                            try:
                                with open(FolderPath + '/json/Modular/relay_mini/modular_relay_mini_%d.json' %self.numberModular) as json_data:
                                    dat = json.load(json_data)
                                break
                            except:
                                self.Trial += 1
                                time.sleep(0.05)
                        self.varName = mod_relay_mini['[' + str(self.numberPin) + ']']
                        self.varVal = dat[self.varName]
                        print("SNMP: " + self.varName, " : ", self.varVal)
                        return self.getSyntax().clone(int(self.varVal))
                    #--------------------------------------------------- Equipment Modbus RTU ---------------------------------------------------
                    elif Category == 12:
                        self.number_equipment = self.SpecificOID[0]
                        self.number_data_equipment = self.SpecificOID[1]
                        #---------------------------------- List Equipment in JSON  ----------------------------------------
                        lst_file_equipment_json = []
                        lst_file_equipment_json_raw = os.listdir(ParentFolder + '/PROTOCOL_OUT/SNMP_SERVER/json/Equipment/') # your directory path
                        for i in range(len(lst_file_equipment_json_raw)):
                            if lst_file_equipment_json_raw[i].endswith(".json"):
                                lst_file_equipment_json.append(lst_file_equipment_json_raw[i])
                        lst_file_equipment_json.sort()
                        
  
                        with open(ParentFolder + '/PROTOCOL_OUT/SNMP_SERVER/json/Equipment/' + lst_file_equipment_json[self.number_equipment]) as json_data:
                            data_equipment = json.load(json_data)
                            try:
                                del data_equipment["PollingDuration"]
                                del data_equipment["Timestamp"]
                            except Exception as e:
                                #print("SNMP: problem in delete " + str(e))
                                pass
                            list_data_equipment = []
                            for item_data_equipment in data_equipment:
                                list_data_equipment.append(item_data_equipment)
                            for j in range(len(data_equipment)):
                                if j == self.number_data_equipment-1:
                                    self.varVal = data_equipment[list_data_equipment[j]]
                                    print("SNMP: " + list_data_equipment[j], " : ", self.varVal)


                        return self.getSyntax().clone(int(self.varVal))
                    """
                    try:
                        print('requested: ' + self.varName + ' in Group ' + str(self.group) + ' Module ' + str(self.mod))
                    except:
                        print('requested: ' + self.varName)
                    """     
                    
            ###############################  SNMP Setting  ###################################
            pre = sysOID + (5,)

            #IP Address
            command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.OctetString()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.OctetString())
)""" %(pre+(10,),pre+(10,))
            exec(command)

            #Netmask
            command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.OctetString()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.OctetString())
)""" %(pre+(20,),pre+(20,))
            exec(command)

            #Gateway
            command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.OctetString()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.OctetString())
)""" %(pre+(30,),pre+(30,))
            exec(command)

            #SNMP Version
            command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.OctetString()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.OctetString())
)""" %(pre+(40,),pre+(40,))
            exec(command)

            #SNMP Community
            command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.OctetString()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.OctetString())
)""" %(pre+(50,),pre+(50,))
            exec(command)

            #SNMP Port
            command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.OctetString()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.OctetString())
)""" %(pre+(60,),pre+(60,))
            exec(command)

            #System OID
            command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.OctetString()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.OctetString())
)""" %(pre+(70,),pre+(70,))
            exec(command)

            ######################  MODULAR ANALOG INPUT OUTPUT  ###############################

            for numberModular in range(1,3):
                for number_pin in range(1,9):
                    pre = sysOID + (6,2, numberModular ,number_pin * 10,)
                    command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.Integer()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.Integer())
)""" %(pre,pre)
                    exec(command)

            ######################  MODULAR OPTOCPUPLER  ###############################

            for numberModular in range(1,9):
                for number_pin in range(1,15):
                    pre = sysOID + (7,8, numberModular ,number_pin * 10,)
                    command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.Integer()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.Integer())
)""" %(pre,pre)
                    exec(command)

            ######################  MODULAR GPIO  ###############################

            for numberModular in range(1,9):
                for number_pin in range(1,15):
                    pre = sysOID + (8,8, numberModular ,number_pin * 10,)
                    command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.Integer()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.Integer())
)""" %(pre,pre)
                    exec(command)

            ######################  MODULAR DRYCONTACT  ###############################

            for numberModular in range(1,9):
                for number_pin in range(1,15):
                    pre = sysOID + (9,8, numberModular ,number_pin * 10,)
                    command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.Integer()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.Integer())
)""" %(pre,pre)
                    exec(command)

            ######################  MODULAR RELAY  ###############################

            for numberModular in range(1,9):
                for number_pin in range(1,9):
                    pre = sysOID + (10, 8, numberModular ,number_pin * 10,)
                    command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.Integer()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.Integer())
)""" %(pre,pre)
                    exec(command)

            ######################  MODULAR RELAY MINI ###############################

            for numberModular in range(1,9):
                for number_pin in range(1,7):
                    pre = sysOID + (11, 8, numberModular ,number_pin * 10,)
                    command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.Integer()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.Integer())
)""" %(pre,pre)
                    exec(command)

            ######################  Equipment MODBUS RTU ###############################
            
            #---------------------------------- List Equipment in JSON  ----------------------------------------
            lst_file_equipment_json = []
            lst_file_equipment_json_raw = os.listdir(ParentFolder + '/PROTOCOL_OUT/SNMP_SERVER/json/Equipment/') # your directory path
            for i in range(len(lst_file_equipment_json_raw)):
                if lst_file_equipment_json_raw[i].endswith(".json"):
                    lst_file_equipment_json.append(lst_file_equipment_json_raw[i])
            lst_file_equipment_json.sort()
            
            for i in range(len(lst_file_equipment_json)):
                with open(ParentFolder + '/PROTOCOL_OUT/Lib/IOT_MODULAR_I2C.mib') as txt_file:
                    data_mib = txt_file.read()[:-3]
                
                list_data_mib_new = []
                list_data_mib_new.append("---12.1 Equipment_" + lst_file_equipment_json[i].replace(".json","") + " --------------------------------------")
                if i == len(lst_file_equipment_json)-1:
                    list_data_mib_new.append("Equipment_"+ lst_file_equipment_json[i].replace(".json","") +" OBJECT IDENTIFIER ::= {Equipment "+ str(0)+"}")
                else:
                    list_data_mib_new.append("Equipment_"+ lst_file_equipment_json[i].replace(".json","") +" OBJECT IDENTIFIER ::= {Equipment "+ str(i+1)+"}")

                with open(ParentFolder + '/PROTOCOL_OUT/SNMP_SERVER/json/Equipment/' + lst_file_equipment_json[i]) as json_data:
                    data_equipment = json.load(json_data)
                    try:
                        del data_equipment["PollingDuration"]
                        del data_equipment["Timestamp"]
                    except Exception as e:
                        #print("SNMP: problem in delete " + str(e))
                        pass
                    list_data_equipment = []
                    for item_data_equipment in data_equipment:
                        list_data_equipment.append(item_data_equipment)
                    #print(data_equipment)
                    for j in range(len(data_equipment)):
                        #i = i + 1
                        #j = j + 1
                        pre = sysOID + (12, i, j+1,)
                        name_var_raw = list_data_equipment[j].replace(" ", "_")
                        name_var = lst_file_equipment_json[i-1].replace(".json","") + "_" + name_var_raw
                        parent_oid = "Equipment_"+ lst_file_equipment_json[i-1].replace(".json","")
                        #print(name_var)
                        #print(parent_oid)
                        input_string = """
%s OBJECT-TYPE
    SYNTAX INT
    MAX-ACCESS read-write
    DESCRIPTION "Reading data from equipment"
    ::= {%s %d}

""" % (name_var, parent_oid, j+1 )
                        list_data_mib_new.append(input_string)
                        
                        command ="""
mibBuilder.exportSymbols(
'__MY_MIB', MibScalar(%s, v2c.Integer()).setMaxAccess('readwrite'),
            MyStaticMibScalarInstance(%s, (0,), v2c.Integer())
)""" %(pre,pre)
                        exec(command)
                
                    list_data_mib_new.append("END")
                    string_data_mib_new = '\n'.join(list_data_mib_new)
                    #print(string_data_mib_new)
                    data_mib = data_mib + string_data_mib_new
                    with open(ParentFolder + '/PROTOCOL_OUT/Lib/IOT_MODULAR_I2C.mib', 'w') as f2:
                        f2.writelines(data_mib)

            # --- end of Managed Object Instance initialization ----

            # Register SNMP Applications at the SNMP engine for particular SNMP context
            cmdrsp.GetCommandResponder(snmpEngine, snmpContext)
            cmdrsp.NextCommandResponder(snmpEngine, snmpContext)
            cmdrsp.BulkCommandResponder(snmpEngine, snmpContext)
            cmdrsp.SetCommandResponder(snmpEngine, snmpContext)

            # Register an imaginary never-ending job to keep I/O dispatcher running forever
            snmpEngine.transportDispatcher.jobStarted(1)

            # Run I/O dispatcher which would receive queries and send responses
            try:    
                print("SNMP: SNMP is Running.")
                snmpEngine.transportDispatcher.runDispatcher()
            except Exception as e:
                print("SNMP: " + str(e))
                snmpEngine.transportDispatcher.closeDispatcher()
                raise
        except KeyboardInterrupt:
            print("SNMP: SNMP Agent Interrupted")
            break
        except Exception as e:
            print("SNMP: " + str(e))
