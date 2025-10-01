import os
import json
import pprint
import sys
import dotenv

from helper import get_devices_list

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
DEVICES = [UPS, AIRCOND, PDU, BATTERY, RECTIFIER, POWERMETER, SWITCH, PFC]

MODBUS_RTU = "Modbus RTU"
MODBUS_TCP = "Modbus TCP"
SNMP = "SNMP"
GPIO = "GPIO"
CANBUS = "CANBUS_SENSOR"

PROTOCOLS = [MODBUS_RTU, MODBUS_TCP, SNMP, GPIO, CANBUS]

# IMPORT DEVICES LIBRARY
LIB = get_devices_list()

def get_device_data_lib(device_type, manufacturer, part_number, protocol):
    FIND_RESULTS = LIB[device_type]
    FOUND = None
    for item in FIND_RESULTS:
        if item["manufacturer"] == manufacturer and item["part_number"] == part_number \
                and item["protocol"] == protocol:
            FOUND = item["data"]
    return FOUND
