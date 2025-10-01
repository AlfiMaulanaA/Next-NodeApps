import os
import json
import pprint
import sys


pp = pprint.PrettyPrinter(indent=4)

ParentFolder = os.path.abspath('..')

# CONSTANTS
UPS = "ups"
AIRCOND = "aircond"
PDU = "pdu"
BATTERY = "battery"
RECTIFIER = "rectifier"
POWERMETER = "power_meter"
SWITCH = "switch"
PFC = "pfc"
CONTROLLER = "Controller"
SENSOR_RS485 = "Sensor_RS485"
DEVICES = [UPS, AIRCOND, PDU, BATTERY, RECTIFIER, POWERMETER, SWITCH, PFC, CONTROLLER, SENSOR_RS485]

MODBUS_RTU = "Modbus RTU"
MODBUS_TCP = "Modbus TCP"
SNMP = "SNMP"
GPIO = "GPIO"
CANBUS = "CANBUS_SENSOR"

PROTOCOLS = [MODBUS_RTU, MODBUS_TCP, SNMP, GPIO, CANBUS]

# IMPORT DEVICES LIBRARY

ThisFolder = os.path.abspath('.')
ParentFolder = os.path.abspath('..')

LIB = {}
ALL_DATA_FORMAT = {"Modbus RTU":{}, "Modbus TCP": {}, "SNMP":{}}
with open(ThisFolder + '/JSON/Config/Library/devices.json') as json_data:
    LIB = json.load(json_data)

with open(ThisFolder + '/JSON/Config/Library/devices.json') as json_data:
    ALL_DATA = json.load(json_data)
for typeDevice in DEVICES:
    ALL_DATA_FORMAT["Modbus RTU"][typeDevice] = []
    ALL_DATA_FORMAT["Modbus TCP"][typeDevice] = []
    ALL_DATA_FORMAT["SNMP"][typeDevice] = []
    for nameDevice in ALL_DATA[typeDevice]:
        nameDevice.pop("data")
        if nameDevice["protocol"] == "Modbus RTU" :
            ALL_DATA_FORMAT["Modbus RTU"][typeDevice].append(nameDevice)
        elif nameDevice["protocol"] == "Modbus TCP" :
            ALL_DATA_FORMAT["Modbus TCP"][typeDevice].append(nameDevice)
        elif nameDevice["protocol"] == "SNMP" :
            ALL_DATA_FORMAT["SNMP"][typeDevice].append(nameDevice)

print(ALL_DATA_FORMAT)
with open(ThisFolder + '/JSON/Config/Library/devices_summary.json', "w") as outfile:
    outfile.write(json.dumps(ALL_DATA_FORMAT))

def get_device_data_lib(device_type, manufacturer, part_number, protocol):
    FIND_RESULTS = LIB[device_type]
    FOUND = None
    for item in FIND_RESULTS:
        if item["manufacturer"] == manufacturer and item["part_number"] == part_number \
                and item["protocol"] == protocol:
            FOUND = item["data"]
    return FOUND
