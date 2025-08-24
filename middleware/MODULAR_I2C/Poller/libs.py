import os
import json
import pprint
import sys
import dotenv

pp = pprint.PrettyPrinter(indent=4)

ParentFolder = os.path.abspath('.')

# IMPORT DEVICES LIBRARY
LIB = {}
with open(ParentFolder + '/JSON/Config/Library/devices.json') as json_data:
    LIB = json.load(json_data)

def get_device_data_lib(device_type, manufacturer, part_number, protocol):
    FIND_RESULTS = LIB[device_type]
    FOUND = None
    for item in FIND_RESULTS:
        if item["manufacturer"] == manufacturer and item["part_number"] == part_number \
                and item["protocol"] == protocol:
            FOUND = item["data"]
    return FOUND