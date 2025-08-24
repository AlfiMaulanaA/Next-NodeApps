from Converter import *
from pyModbusTCP.client import ModbusClient

# Byte Order
BE = "Big Endian"
LE = "Little Endian"

# Types of Register
DISCRETEIN = "Discrete Input"
DISCRETEOUT = "Discrete Output"
HOLDINGREG = "Holding Register"
INPUTREG = "Input Register"

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
    def __init__(self, host, port, timeout, byteorder=BE):
        # big_endian        :   Byte order of the device memory structure
        #                       True  >>  big endian
        #                       False >>  little endian
        if byteorder == BE:
            self.big_endian = True
        else:
            self.big_endian = False

        self.dev = ModbusClient()
        self.dev.host(host)
        self.dev.port(port)
        self.dev.timeout(timeout)
        self.dev.open()
        # self.dev.debug = True

    # ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ READ METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
    # Method to read binary variable
    def read_bits(self, VarNameList, AddressList, functioncode=2):
        # Arguments:
        # VarNameList       :   list of variable name
        # AddressList       :   list of variable register address in decimal (relative address)
        # functioncode      :   functioncode for modbus reading operation
        #                       1 >> for Discrete Output (Coils)
        #                       2 >> for Discrete Input
        # Return            :   dictionary of variable name and its value

        self.values = []
        if functioncode == 1:
            for address in AddressList:
                self.values.append(self.dev.read_coils(address[0], len(address)))
        elif functioncode == 2:
            for address in AddressList:
                self.values.append(self.dev.read_discrete_inputs(address[0], len(address)))
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

        if functioncode == 3:
            for address in AddressList:
                self.values.extend(self.dev.read_holding_registers(address[0], len(address)))
        elif functioncode == 4:
            for address in AddressList:
                self.values.extend(self.dev.read_input_registers(address[0], len(address)))

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

        if functioncode == 3:
            for address in AddressList:
                self.values.extend(self.dev.read_holding_registers(address[0], len(address)))
        elif functioncode == 4:
            for address in AddressList:
                self.values.extend(self.dev.read_input_registers(address[0], len(address)))

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

        if functioncode == 3:
            for address in AddressList:
                self.values.extend(self.dev.read_holding_registers(address[0], len(address)))
        elif functioncode == 4:
            for address in AddressList:
                self.values.extend(self.dev.read_input_registers(address[0], len(address)))

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

        if functioncode == 3:
            for address in AddressList:
                self.values.extend(self.dev.read_holding_registers(address[0], len(address)))
        elif functioncode == 4:
            for address in AddressList:
                self.values.extend(self.dev.read_input_registers(address[0], len(address)))

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

        if functioncode == 3:
            for address in AddressList:
                self.values.extend(self.dev.read_holding_registers(address[0], len(address)))
        elif functioncode == 4:
            for address in AddressList:
                self.values.extend(self.dev.read_input_registers(address[0], len(address)))

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

        if functioncode == 3:
            for address in AddressList:
                self.values.extend(self.dev.read_holding_registers(address[0], len(address)))
        elif functioncode == 4:
            for address in AddressList:
                self.values.extend(self.dev.read_input_registers(address[0], len(address)))

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
        if functioncode == 3:
            for address in AddressList:
                _uint16Val = self.dev.read_holding_registers(address[0], len(address))
                self.values.append(UINT16toSTRING(_uint16Val, self.big_endian))
        elif functioncode == 4:
            for address in AddressList:
                _uint16Val = self.dev.read_input_registers(address[0], len(address))
                self.values.append(UINT16toSTRING(_uint16Val, self.big_endian))

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ WRITE METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
    # Method to write binary value on discrete output register (Coil)
    def write_bit(self, registerAddress, value):
        # Arguments:
        # registerAddress   :   register address in decimal (relative address)
        # value             :   0 or 1

        self.dev.write_single_coil(registerAddress, value)

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

        # write multiple registers
        self.dev.write_multiple_registers(startAddress, val)

    def close(self):
        self.dev.close()