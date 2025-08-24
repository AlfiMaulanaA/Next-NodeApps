#!/usr/bin/env python
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
	

def connect_mqtt():
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print("Connected to MQTT Broker!")
        else:
            print("Failed to connect, return code %d\n", rc)

    client = mqtt_client.Client(client_id)
    client.username_pw_set(username, password)
    client.on_connect = on_connect
    client.connect(broker, port)
    return client

def process_data_subscribe(client, userdata, message):
	sub_data = message.payload.decode()
	#print(sub_data)
	if sub_data == "Open":
		print("Open Slow with turn on Relay")
		device.write_num(1, 1)
	elif sub_data == "Closed":
		print("Closed with turn off Relay")
		device.write_num(1, 0)
	elif sub_data == "GetState":
		print("Read State")
		data = device.read_INT16(1)
		datapub = ""
		if data[0] == 1:
			datapub = "Open"
		elif data[0] == 0:
			datapub = "Closed"
		print("Current Relay State " + datapub)
		client.publish(topic_pub, datapub)
	

device = Device("/dev/ttyUSB0", devAddress, 9600, "NONE", 1, 8, "Big Endian", 1)

broker = "broker.emqx.io"
port = 1883
passanduser = False
topic_sub = "sub_topic_modbusRTU"
topic_pub = "pub_topic_modbusRTU"
if passanduser:
	username = "mqtt-user"
	password = "Mha382QfnN8LD4RJ"
else:
	username = ""
	password = ""


client_id = "Testing1"
client = connect_mqtt()

client = connect_mqtt()
client.on_message=process_data_subscribe 
client.subscribe(topic_sub)
client.loop_forever()



