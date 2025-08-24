from multiprocessing.sharedctypes import Value
from pickle import FALSE
from socket import timeout
import Protocols.snmp as MySNMP
import Protocols.modbus_rtu as MyModbusRTU
import Protocols.modbus_tcp as MyModbusTCP
from time import strftime, localtime
import time, os, traceback, pprint, psutil

#from middleware.Protocols.snmp import OID

def ModbusRTU_Control(data):
	#to do create write data to modbus RTU
	try:
		addres 	= data["number_address"]
		value 	= data["value"]
		port	= data["port"]
		baudrate= data["baudrate"]
		parity	= data["parity"]
		bytesize= data["bytesize"]
		stop_bit= data["stop_bit"]
		timeout	= data["timeout"]
		endianness = data["endianness"]
		data_type	= data["data_type"]
		function	= data["function"]

	
		device = MyModbusRTU.Device(port, addres, baudrate, parity, stop_bit, bytesize, endianness, timeout)
		if data_type == "Coil":
			device.write_bit(value["address"], value["value"], function)	
		else:
			device.write_num(value["address"], value["value"], data_type, function)
		return True	
	except Exception as e:
		print(e)
		return False

def ModbusTCP_Control(data):
	#to do create write data to modbus TCP
	try:
		host 		= data["host"]
		port		= data["port"]
		timeout		= data["timeout"]
		byteorder 	= data["byteorder"]
		value 		= data["value"]
		data_type	= data["data_type"]
	

		device = MyModbusTCP.Device(host, port, timeout, byteorder)
		if data_type == "Coil":
			device.write_bit(value["address"], value["value"])	
		else:
			device.write_num(value["address"], value["value"], data_type)
		return True	
	except Exception as e:
		print(e)
		return False
	
def SNMP(data):
	#to do create write data to SNMP
	try:
		ip_address 		= data["ip_address"]
		port			= data["port"]
		snmp_version 	= data["snmp_version"]
		read_community	= data["read_community"]
		data_type		= data["data_type"]
		timeout			= data["timeout"]
		value			= data["value"]
		
		device = MySNMP.Device(ip_address, port, read_community, snmp_version, 	timeout)
		device.write(value["OID"], value["value"], data_type)
		return True
	except Exception as e:
		print(e)
		return False