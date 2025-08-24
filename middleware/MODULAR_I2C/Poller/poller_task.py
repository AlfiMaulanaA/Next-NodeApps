from lib2to3.pgen2.driver import Driver
from sre_constants import SUCCESS
from telnetlib import STATUS
import Modular.aio as aio
import Modular.gpio as gpio
import Modular.optocoupler as optocoupler
import Modular.relay as relay
import Modular.drycontact as drycontact
import Modular.relay_mini as relay_mini
import json

from time import strftime, localtime
import time, os, traceback, pprint, psutil
import Poller.libs as libs

import I2Cout as I2Cout

AIO = "AIO"
GPIO = "GPIO"
OPTOCOUPLER = "OPTOCOUPLER"
RELAY = "RELAY"
DRYCONTACT ="DRYCONTACT"
RELAYMINI = "RELAYMINI"

SUCCESS = "Succes"


pp = pprint.PrettyPrinter(indent=4)
ParentFolder = os.path.abspath('..')

# Function to get current memory usage (only for development stage)
def get_process_memory():
    process = psutil.Process(os.getpid())
    return [process.memory_info().rss,process.memory_full_info().rss]

# Class for SNMP polling
class Modular(object):
    def __init__(self, profile, protocol_setting):
        # Get equipment profile
        self.name = profile['name']
        self.device_type = profile['device_type']
        self.manufacturer = profile['manufacturer']
        self.part_number = profile['part_number']

        # Get equipment settings
        self.protocol = protocol_setting['protocol']
        self.address = protocol_setting['address']
        self.device_bus = protocol_setting['device_bus']

        self.data_lib = libs.get_device_data_lib(self.device_type, self.manufacturer, self.part_number, self.protocol)


    def poll(self):
        raw_data = []
        var_name = []
        if self.part_number == GPIO:
            value, status = gpio.read_gpio_all(self.address, self.device_bus)
            for item in self.data_lib:
                if status == SUCCESS:
                    if 1 <= item["gpio_number"] <= 14: 
                        raw_data.append(value[item["gpio_number"]-1])
                    else:
                        raw_data.append("out of range gpio")
                else:
                    raw_data.append(9999)
                var_name.append(item["var_name"])
        
        if self.part_number == DRYCONTACT:
            value, status = drycontact.read_gpio_all(self.address, self.device_bus)
            for item in self.data_lib:
                if status == SUCCESS:
                    if 1 <= item["gpio_number"] <= 14: 
                        raw_data.append(value[item["gpio_number"]-1])
                    else:
                        raw_data.append("out of range gpio")
                else:
                    raw_data.append(9999)
                var_name.append(item["var_name"])

        elif self.part_number == AIO:
            for item in self.data_lib:
                value, status = aio.read_data_pin(item["gpio_number"], self.address, self.device_bus)
                if status == SUCCESS:
                    value = round(value * 100)
                    raw_data.append(value)
                else:
                    raw_data.append(9999)
                var_name.append(item["var_name"])

        elif self.part_number == OPTOCOUPLER:
            value, status = optocoupler.read_gpio_all(self.address, self.device_bus)
            for item in self.data_lib:
                if status == SUCCESS:
                    if 1 <= item["gpio_number"] <= 14: 
                        raw_data.append(value[item["gpio_number"]-1])
                    else:
                        raw_data.append("out of range gpio")
                else:
                    raw_data.append(9999)
                var_name.append(item["var_name"])

        elif self.part_number == RELAY:
            value, status = relay.read_gpio_all(self.address, self.device_bus)
            for item in self.data_lib:
                if status == SUCCESS:
                    if 1 <= item["gpio_number"] <= 8: 
                        raw_data.append(value[item["gpio_number"]-1])
                    else:
                        raw_data.append("out of range gpio")
                else:
                    raw_data.append(9999)
                var_name.append(item["var_name"])

        elif self.part_number == RELAYMINI:
            value, status = relay_mini.read_gpio_all(self.address, self.device_bus)
            for item in self.data_lib:
                if status == SUCCESS:
                    if 1 <= item["gpio_number"] <= 6: 
                        raw_data.append(value[item["gpio_number"]+ 1])
                    else:
                        raw_data.append("out of range gpio")
                else:
                    raw_data.append(9999)
                var_name.append(item["var_name"])

        result = dict(zip(var_name, raw_data))

        return result

class I2C_OUT(object):
    def __init__(self, profile, protocol_setting):
        # Get equipment profile
        self.name = profile['name']
        self.device_type = profile['device_type']
        self.manufacturer = profile['manufacturer']
        self.part_number = profile['part_number']

        # Get equipment settings
        self.protocol = protocol_setting['protocol']
        self.address = protocol_setting['address']
        self.device_bus = protocol_setting['device_bus']

        self.data_lib = libs.get_device_data_lib(self.device_type, self.manufacturer, self.part_number, self.protocol)


    def poll(self):
        raw_data = {}
        var_name = []

        command = """
data, status = I2Cout.%s.get_data(%d, %d)
raw_data["data"] = data
raw_data["status"] = status
        """ % (self.part_number, self.address, self.device_bus)
        exec(command)

        for item in self.data_lib:
            var_name.append(item["var_name"])
            
        result = dict(zip(var_name, raw_data["data"]))

        return result