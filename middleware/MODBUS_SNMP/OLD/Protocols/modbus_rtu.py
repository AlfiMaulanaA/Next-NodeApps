from Converter import *
import serial
import time
from colorama import Fore, Style
import Protocols.alarm as _alarm

# Byte Order
BE = "Big Endian"
LE = "Little Endian"

# Types of Register
DISCRETEIN = "Discrete Input"
DISCRETEOUT = "Discrete Output"
HOLDINGREG = "Holding Register"
INPUTREG = "Input Register"
ALARM_RTU = "ALARMTYPE"
REGISTER_TYPE = [DISCRETEIN, DISCRETEOUT, HOLDINGREG, INPUTREG]

# Data Types
INT16 = "INT16"
INT32 = "INT32"
INT64 = "INT64"
UINT16 = "UINT16"
UINT32 = "UINT32"
UINT64 = "UINT64"
FLOAT16 = "FLOAT16"
FLOAT32 = "FLOAT32"
FLOAT64 = "FLOAT64"
STRING = "STRING"
BIT = "BIT"

DataTypes = [INT16, INT32, INT64,
             UINT16, UINT32, UINT64,
             FLOAT16, FLOAT32, FLOAT64,
             STRING]


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

        # big_endian        :   Byte order of the device memory structure
        #                       True  >>  big endian
        #                       False >>  little endian

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
        # self.dev.debug = True

    # ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ READ METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
    # Method to read binary variable
    def read_bits(self, VarNameList, AddressList, functioncode=1):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # functioncode      :   functioncode for modbus reading operation
        #                       1 >> for Discrete Output (Coils)
        #                       2 >> for Discrete Input
        # Return            :   dictionary of variable name and its value

        self.values = []
        for address in AddressList:
            if type(address) == list:
                self.values.append([])
                for addr in address:
                    self.values.append(self.dev.read_bit(addr, functioncode))
                    time.sleep(0.1)
            else:
               self.values.append(self.dev.read_bit(address, functioncode))
        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # Method to read INT16 or UINT16 variable
    def read_INT16(self, VarNameList, AddressList, MultiplierList, signed=False, roundto=3, functioncode=3):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # MultiplierList    :   list of multiplier
        # roundto           :   number of digits after decimal point
        #                       any positive integer number >> to limit the number of digits after decimal point
        #                       None                        >> to disable
        # signed            :   True  >> for signed values
        #                       False >> for unsigned values
        # functioncode      :   functioncode for modbus reading operation
        #                       3 >> for Holding Register
        #                       4 >> for Input Register
        # Return            :   dictionary of variable name and its value

        self.values = []
        for address in AddressList:
            for n in address:
                self.values.extend(self.dev.read_registers(n, 1, functioncode))
                #print("reading...")
                time.sleep(0.1)

        if signed:
            self.values = UINT16toINT16(self.values)

        for i in range(0, len(self.values)):
            self.values[i] = round(self.values[i] * MultiplierList[i], roundto)

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # Method to read INT32 or UINT32 variable
    def read_INT32(self, VarNameList, AddressList, MultiplierList, signed=False, roundto=3, functioncode=3):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # MultiplierList    :   list of multiplier
        # roundto           :   number of digits after decimal point
        #                       any positive integer number >> to limit the number of digits after decimal point
        #                       None                        >> to disable
        # signed            :   True  >> for signed values
        #                       False >> for unsigned values
        # functioncode      :   functioncode for modbus reading operation
        #                       3 >> for Holding Register
        #                       4 >> for Input Register
        # Return            :   dictionary of variable name and its value

        self.values = []
        for address in AddressList:
            for n in address:
                self.values.extend(self.dev.read_registers(n, 1, functioncode))
                #print("reading...")
                time.sleep(0.05)

        self.values = UINT16toINT32(self.values, self.big_endian, signed)
        for i in range(0, len(self.values)):
            self.values[i] = round(self.values[i] * MultiplierList[i], roundto)

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # Method to read INT64 or UINT64 variable
    def read_INT64(self, VarNameList, AddressList, MultiplierList, signed=False, roundto=3, functioncode=3):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # MultiplierList    :   list of multiplier
        # roundto           :   number of digits after decimal point
        #                       any positive integer number >> to limit the number of digits after decimal point
        #                       None                        >> to disable
        # signed            :   True  >> for signed values
        #                       False >> for unsigned values
        # functioncode      :   functioncode for modbus reading operation
        #                       3 >> for Holding Register
        #                       4 >> for Input Register
        # Return            :   dictionary of variable name and its value

        self.values = []
        for address in AddressList:
            for n in address:
                self.values.extend(self.dev.read_registers(n, 1, functioncode))
                #print("reading...")
                time.sleep(0.05)

        self.values = UINT16toINT64(self.values, self.big_endian, signed)
        for i in range(0, len(self.values)):
            self.values[i] = round(self.values[i] * MultiplierList[i], roundto)

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # Method to read FLOAT16 variable
    def read_FLOAT16(self, VarNameList, AddressList, MultiplierList, roundto=3, functioncode=3):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # MultiplierList    :   list of multiplier
        # roundto           :   number of digits after decimal point
        #                       any positive integer number >> to limit the number of digits after decimal point
        #                       None                        >> to disable
        # functioncode      :   functioncode for modbus reading operation
        #                       3 >> for Holding Register
        #                       4 >> for Input Register
        # Return            :   dictionary of variable name and its value

        self.values = []
        for address in AddressList:
            for n in address:
                self.values.extend(self.dev.read_registers(n, 1, functioncode))
                #print("reading...")
                time.sleep(0.05)

        self.values = UINT16toFLOAT16(self.values)

        for i in range(0, len(self.values)):
            self.values[i] = round(self.values[i] * MultiplierList[i], roundto)

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # Method to read FLOAT32 variable
    def read_FLOAT32(self, VarNameList, AddressList, MultiplierList, roundto=3, functioncode=3):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # MultiplierList    :   list of multiplier
        # roundto           :   number of digits after decimal point
        #                       any positive integer number >> to limit the number of digits after decimal point
        #                       None                        >> to disable
        # functioncode      :   functioncode for modbus reading operation
        #                       3 >> for Holding Register
        #                       4 >> for Input Register
        # Return            :   dictionary of variable name and its value

        self.values = []
        for address in AddressList:
            for n in address:
                self.values.extend(self.dev.read_registers(n, 1, functioncode))
                #print("reading...")
                time.sleep(0.05)

        self.values = UINT16toFLOAT32(self.values, self.big_endian)
        for i in range(0, len(self.values)):
            self.values[i] = round(self.values[i] * MultiplierList[i], roundto)

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # Method to read FLOAT64 variable
    def read_FLOAT64(self, VarNameList, AddressList, MultiplierList, roundto=3, functioncode=3):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # MultiplierList    :   list of multiplier
        # roundto           :   number of digits after decimal point
        #                       any positive integer number >> to limit the number of digits after decimal point
        #                       None                        >> to disable
        # functioncode      :   functioncode for modbus reading operation
        #                       3 >> for Holding Register
        #                       4 >> for Input Register
        # Return            :   dictionary of variable name and its value

        self.values = []
        for address in AddressList:
            for n in address:
                self.values.extend(self.dev.read_registers(n, 1, functioncode))
                #print("reading...")
                time.sleep(0.05)

        self.values = UINT16toFLOAT64(self.values, self.big_endian)
        for i in range(0, len(self.values)):
            self.values[i] = round(self.values[i] * MultiplierList[i], roundto)

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # Method to read STRING variable
    def read_STRING(self, VarNameList, AddressList, functioncode=3):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # functioncode      :   functioncode for modbus reading operation
        #                       3 >> for Holding Register
        #                       4 >> for Input Register
        # Return            :   dictionary of variable name and its value

        self.values = []
        for address in AddressList:
            _uint16Val = self.dev.read_registers(address[0], len(address), functioncode)
            self.values.append(UINT16toSTRING(_uint16Val, self.big_endian))

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result
    def read_ALARM(self, VarNameList, AddressList, MultiplierList, roundto, alarm_type, functioncode, data_type):
        
        if alarm_type[0] == "Envicool":
            data = _alarm.ENVICOOL_RTU(self.dev, VarNameList, AddressList, functioncode, data_type)   
        else:
            print(Fore.RED + "\n=============================== Alarm Not Registered =================================="+ Fore.WHITE)
        
        self.Result = data
        return self.Result

    # ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ WRITE METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
    # Method to write binary value on discrete output register (Coil)
    def write_bit(self, registerAddress, value):
        # Arguments:
        # registerAddress   :   register address in decimal (relative address)
        # value             :   0 or 1

        self.dev.write_bit(registerAddress, value)

    # Method to write numeric value on holding register
    def write_num(self, registerAddress, value, valueType):
        # Arguments:
        # registerAddress   :   register START address in decimal (relative address)
        # value             :   numerical value
        # valueType         :   UINT16, UINT32, UINT64, INT16, INT32, INT64, FLOAT16,
        #                       FLOAT32, FLOAT64, STRING

        startAddress = registerAddress
        val = None

        if valueType == UINT16:
            val = [value]
        elif valueType == INT16:
            val = INT16toUINT16([value])
        elif valueType == UINT32:
            val = INT32toUINT16(value, self.big_endian, signed=False)
        elif valueType == INT32:
            val = INT32toUINT16(value, self.big_endian, signed=True)
        elif valueType == UINT64:
            val = INT64toUINT16(value, self.big_endian, signed=False)
        elif valueType == INT64:
            val = INT64toUINT16(value, self.big_endian, signed=True)
        elif valueType == FLOAT16:
            val = FLOAT16toUINT16([value])
        elif valueType == FLOAT32:
            val = FLOAT32toUINT16(value, self.big_endian)
        elif valueType == FLOAT64:
            val = FLOAT64toUINT16(value, self.big_endian)
        elif valueType == STRING:
            val = STRINGtoUINT16(value, self.big_endian)

        for i, item in enumerate(val):
            self.dev.write_register(startAddress + i, item, 0, 6)

        # write multiple registers selalu bermasalah
        # self.dev.write_registers(startAddress, val)