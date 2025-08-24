#!/usr/bin/env python
from cgi import print_form
import json
import time
import serial
import minimalmodbus as mm
from paho.mqtt import client as mqtt_client

BE = "Big Endian"
LE = "Little Endian"

devAddress = 194

class Device():
    def __init__(self, port, deviceAddress, baudrate, parity, stopbit, bytesize, byteorder, timeout):
        import minimalmodbus as mm
        self.devAddress = deviceAddress
        mm.BAUDRATE = baudrate
        exec("""mm.PARITY = serial.PARITY_%s""" % parity)
        mm.BYTESIZE = bytesize
        mm.STOPBITS = stopbit
        mm.TIMEOUT = timeout
        mm.CLOSE_PORT_AFTER_EACH_CALL = True

        if byteorder == BE:
            self.big_endian = True
        else:
            self.big_endian = False

        self.dev = mm.Instrument(port, deviceAddress)
        self.dev.serial.baudrate = baudrate
        self.dev.serial.timeout = timeout
        self.dev.serial.bytesize = bytesize
        self.dev.serial.parity   = serial.PARITY_NONE
        self.dev.serial.stopbits = stopbit 
        
    def read_bits(self, VarNameList, addr, functioncode=1):
        result = self.dev.read_bit(addr, functioncode)
        return result

    def read_INT16(self, addr,  roundto=3, functioncode=3):
        result = self.dev.read_registers(addr, 1, functioncode)
        return result

    def write_bit(self, addr, value):
        result = self.dev.write_bit(addr, value)

    def write_num(self, addr, value):
        result = self.dev.write_register(addr , value, 0, 6)

def main():
    print("begin")
    for i in range(255):  
        try:        
            i = i +190
            print("try to read addres " + str(i))
            device = Device("/dev/ttyS1", i, 9600, "NONE", 1, 8, "Big Endian", 1)
            data = device.read_INT16(1)
            print(data)
            device.write_num(5,197)
            break
        except:
            print("error in addres "+ str(i))
            pass

main()
