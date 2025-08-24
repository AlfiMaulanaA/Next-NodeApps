import sys
import pysnmp
from pysnmp.smi.mibs.instances import *
from pysnmp.entity import engine, config
from pysnmp.entity.rfc3413 import cmdrsp, context
from pysnmp.carrier.asynsock.dgram import udp
from pysnmp.proto.api import v2c
import random, traceback
from RegOID import *
#from GSPE_DCB105ZK import *
import time, os, inspect, json
from DataType import dataType
import getmac
from time import strftime, localtime
import paho.mqtt.client as mqtt

FolderPath = os.path.dirname(os.path.abspath(inspect.getfile(inspect.currentframe())))

MQTT_CONFIG = {}
with open(FolderPath.replace('/snmp_server', '') + '/JSON/Config/mqtt_config.json') as json_data:
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

        print("SNMP Agent IP Address: ", Comm['snmpIPaddress'])
        print("SNMP Port: ", Comm['snmpPort'])
        print("SNMP Version: ", Comm['snmpVersion'])
        print("SNMP Community: ", Comm['snmpCommunity'])
        
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
                    print(str(self.SpecificOID))
                    print(self.varName)
                    
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
                              
                    print('changed: ' + self.varName)
                    return self.getSyntax().clone(str(value))

                #--------------------------------------------------- Analog Input Output -----------------------------------------------------
                elif Category == 6:
                    self.numberModular = self.SpecificOID[1] 
                    self.numberPin = int(self.SpecificOID[2] / 10)
                    list_modular = []
                    with open(FolderPath.replace('/snmp_server', '') + '/JSON/Config/installed_devices.json') as json_data:
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
                            print(send_msg)
                        else:
                            print("your modular not configure")
                    
                    #print(self.numberModular)
                    #print(self.numberPin)
                    #print(value)
                    return self.getSyntax().clone(int(value))

                #--------------------------------------------------- Modular Optocoupler ---------------------------------------------------
                elif Category == 7:
                    self.numberModular = self.SpecificOID[1] 
                    self.numberPin = int(self.SpecificOID[2] / 10)
                    list_modular = []
                    with open(FolderPath.replace('/snmp_server', '') + '/JSON/Config/installed_devices.json') as json_data:
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
                            print(send_msg)
                            Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                            
                        else:
                            print("your modular not configure")
                    
                    #print(self.numberModular)
                    #print(self.numberPin)
                    #print(value)
                    return self.getSyntax().clone(int(value))

                #--------------------------------------------------- Modular GPIO ---------------------------------------------------
                elif Category == 8:
                    self.numberModular = self.SpecificOID[1] 
                    self.numberPin = int(self.SpecificOID[2] / 10)
                    list_modular = []
                    with open(FolderPath.replace('/snmp_server', '') + '/JSON/Config/installed_devices.json') as json_data:
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
                            print(send_msg)
                            Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                            
                        else:
                            print("your modular not configure")
                    
                    #print(self.numberModular)
                    #print(self.numberPin)
                    #print(value)
                    return self.getSyntax().clone(int(value))

                #--------------------------------------------------- Modular Drycontact ---------------------------------------------------
                elif Category == 9:
                    self.numberModular = self.SpecificOID[1] 
                    self.numberPin = int(self.SpecificOID[2] / 10)
                    list_modular = []
                    with open(FolderPath.replace('/snmp_server', '') + '/JSON/Config/installed_devices.json') as json_data:
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
                            print(send_msg)
                            Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                            
                        else:
                            print("your modular not configure")
                    
                    #print(self.numberModular)
                    #print(self.numberPin)
                    #print(value)
                    return self.getSyntax().clone(int(value))

                #--------------------------------------------------- Modular Relay ---------------------------------------------------
                elif Category == 10:
                    self.numberModular = self.SpecificOID[1] 
                    self.numberPin = int(self.SpecificOID[2] / 10)
                    list_modular = []
                    with open(FolderPath.replace('/snmp_server', '') + '/JSON/Config/installed_devices.json') as json_data:
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
                            print(send_msg)
                            Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                            
                        else:
                            print("your modular not configure")
                    
                    #print(self.numberModular)
                    #print(self.numberPin)
                    #print(value)
                    return self.getSyntax().clone(int(value))
                 #--------------------------------------------------- Modular Relay Mini---------------------------------------------------
                elif Category == 11:
                    self.numberModular = self.SpecificOID[1] 
                    self.numberPin = int(self.SpecificOID[2] / 10)
                    list_modular = []
                    with open(FolderPath.replace('/snmp_server', '') + '/JSON/Config/installed_devices.json') as json_data:
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
                            print(send_msg)
                            Pubsclient.publish(topic_pub_write, payload=json.dumps(send_msg))
                            
                        else:
                            print("your modular not configure")
                    
                    #print(self.numberModular)
                    #print(self.numberPin)
                    #print(value)
                    return self.getSyntax().clone(int(value))
                    
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
                    print(self.varName, " : ", self.varVal)
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
                    print(self.varName, " : ", self.varVal)
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
                    print(self.varName, " : ", self.varVal)
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
                    print(self.varName, " : ", self.varVal)
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
                    print(self.varName, " : ", self.varVal)
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
                    print(self.varName, " : ", self.varVal)
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
            print("SNMP is Running.")
            snmpEngine.transportDispatcher.runDispatcher()
        except Exception as e:
            print(e)
            snmpEngine.transportDispatcher.closeDispatcher()
            raise
    except KeyboardInterrupt:
        print("SNMP Agent Interrupted")
        break
    except Exception as e:
        print(e)
