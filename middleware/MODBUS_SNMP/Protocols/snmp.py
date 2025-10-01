import math
from easysnmp import Session
import Protocols.alarm as _alarm
import colorama
from colorama import Fore, Style


# Data Types
INTEGER = "INTEGER"
INTEGER32 = "INTEGER32"
UINTEGER32 = "UINTEGER32"
OCTETSTRING = "OCTETSTRING"
OID = "OID"
IPADDRESS = "IPADDRESS"
ALARMTYPE = "ALARMTYPE"

DataTypes = [INTEGER, INTEGER32, UINTEGER32, OCTETSTRING, OID, IPADDRESS, ALARMTYPE]
NUMERIC = [INTEGER, INTEGER32, UINTEGER32]
STRING = [OCTETSTRING, OID, IPADDRESS]
ALARM_SNMP = [ALARMTYPE]

dataPerAccess = 22
debug = False

class Device():
    def __init__(self, IPaddress, Port, Community, Version, Timeout):
        self.dev = Session(hostname=IPaddress, remote_port=Port, community=Community, version=Version, timeout=Timeout)

    # ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ READ METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
    # Method to numeric variable from regular OID
    def read_num(self, VarNameList, OIDList, MultiplierList):
        # Arguments:
        # VarNameList       :   list of variable name
        # OIDList           :   list of variable OID address
        # MultiplierList    :   list of multiplier
        # Return            :   dictionary of variable name and its value

        self.values = []
        
        self.operation = math.ceil(len(OIDList) / dataPerAccess)
        i = 0
        for opr in range(self.operation):
            try:
                data = self.dev.get(OIDList[i:i + dataPerAccess])
            except:
                data = self.dev.get(OIDList[i:])

            for item in data:
                self.values.append(int(item.value))

            i += dataPerAccess

        for i in range(0, len(self.values)):
            self.values[i] = round(self.values[i] * MultiplierList[i], 3)

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    # Method to string variable from regular OID
    def read_string(self, VarNameList, OIDList):
        # Arguments:
        # VarNameList       :   list of variable name
        # OIDList           :   list of variable OID address
        # Return            :   dictionary of variable name and its value

        self.values = []

        self.operation = math.ceil(len(OIDList) / dataPerAccess)
        i = 0
        for opr in range(self.operation):
            try:
                data = self.dev.get(OIDList[i:i + dataPerAccess])
            except:
                data = self.dev.get(OIDList[i:])

            for item in data:
                self.values.append(str(item.value))

            i += dataPerAccess

        self.Result = dict(zip(VarNameList, self.values))
        return self.Result

    def read_alarm(self, VarNameList, OIDList, typeAlarm):
        # Arguments:
        # VarNameList       :   list of variable name
        # OIDList           :   list of variable OID address
        # Return            :   dictionary of variable name and its value
        
        if typeAlarm[0] == "Tripplite":
            data = _alarm.Tripplite_SNMP(self.dev, OIDList)
        elif typeAlarm[0] == "APC":
            data = _alarm.APC_SNMP(self.dev, OIDList)
        elif typeAlarm[0] == "KEHUA":
            data = _alarm.KEHUA_SNMP(self.dev, VarNameList, OIDList)
        else:
            print(Fore.RED + "\n=============================== Alarm Not Registered =================================="+ Fore.WHITE)
                

        self.Result = data
        return self.Result

    # Method to string variable from Table OID
    def read_num_tab(self, VarNameList, OIDList, rowList, MultiplierList):
        # Arguments:
        # VarNameList       :   list of variable name
        # OIDList           :   list of variable OID address
        # rowList           :   list of total row that we want to get from table column (max repetition in getBulk operation)
        # MultiplierList    :   list of multiplier
        # Return            :   dictionary of variable name and its value

        self.values = []
        self.Result = {}
        i = 0

        for oid in OIDList:
            if debug:
                print(oid)
            if isinstance(rowList[i], str):
                if debug:
                    print(rowList[i])
                number_of_tables = self.dev.get(rowList[i])
                for k in range(int(number_of_tables.value)):
                    if "+" in oid:
                        split_char = oid.split(".")
                        split_char[len(split_char)-2] = str(eval(split_char[len(split_char)-2].replace("x", str(k+1))))
                        new_oid = '.'.join(split_char)
                        if debug:
                            print(new_oid)
                        data = self.dev.get(new_oid)
                        if debug:
                            print(data)
                        self.Result[VarNameList[i] + "_" + str(k+1)] = round(int(data.value) * MultiplierList[i], 3)
                    else:    
                        if debug:
                            print(oid.replace("x", str(k+1)))
                        data = self.dev.get(oid.replace("x", str(k+1)))
                        if debug:
                            print(data)
                        self.Result[VarNameList[i] + "_" + str(k+1)] = round(int(data.value) * MultiplierList[i], 3)
                i += 1
            else:
                for k in range(rowList[i]):
                    if "+" in oid:
                        split_char = oid.split(".")
                        split_char[len(split_char)-2] = str(eval(split_char[len(split_char)-2].replace("x", str(k+1))))
                        new_oid = '.'.join(split_char)
                        if debug:
                            print(new_oid)
                        data = self.dev.get(new_oid)
                        if debug:
                            print(data)
                        self.Result[VarNameList[i] + "_" + str(k+1)] = round(int(data.value) * MultiplierList[i], 3)
                    else:    
                        if debug:
                            print(oid.replace("x", str(k+1)))
                        data = self.dev.get(oid.replace("x", str(k+1)))
                        if debug:
                            print(data)
                        self.Result[VarNameList[i] + "_" + str(k+1)] = round(int(data.value) * MultiplierList[i], 3)
                i += 1

        return self.Result

    # Method to string variable from Table OID
    def read_string_tab(self, VarNameList, OIDList, rowList):
        # Arguments:
        # VarNameList       :   list of variable name
        # OIDList           :   list of variable OID address
        # rowList           :   list of total row that we want to get from table column (max repetition in getBulk operation)
        # Return            :   dictionary of variable name and its value

        self.values = []
        self.Result = {}
        i = 0
        for oid in OIDList:
            if isinstance(rowList[i], str):
                if debug:
                    print(rowList[i])
                number_of_tables = self.dev.get(rowList[i])
                for k in range(int(number_of_tables.value)):
                    if debug:
                        print(oid.replace("x", str(k+1)))
                    data = self.dev.get(oid.replace("x", str(k+1)))
                    if debug:
                        print(data)
                    self.Result[VarNameList[i] + "_" + str(k+1)] = round(int(data.value) * MultiplierList[i], 3)
                i += 1
            else:
                for k in range(rowList[i]):
                    if debug:
                        print(oid.replace("x", str(k+1)))
                    data = self.dev.get(oid.replace("x", str(k+1)))
                    if debug:
                        print(data)
                    self.Result[VarNameList[i] + "_" + str(k+1)] = round(int(data.value) * MultiplierList[i], 3)
                i += 1

        return self.Result


    # ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ WRITE METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
    # Method to write a value in single OID
    def write(self, OID, value, snmp_type=None):
        # Arguments:
        # OID       :   object identifier of a variable
        # value     :   value that you want to write in the OID
        # snmp_type :   data type in object
        #

        if snmp_type == None:
            self.dev.set(OID, value)
        else:
            self.dev.set(OID, value, snmp_type)

    # Method to write values in multiple OIDs
    def write_multiple(self, OIDList, valueList, snmp_type=None):
        # Arguments:
        # OIDList   :   list of object identifier
        # valueList :   list of value

        if snmp_type == None:
            oid_val = list(zip(OIDList, valueList))
            self.dev.set_multiple(oid_val)
        else:
            oid_val = list(zip(OIDList, valueList, snmp_type))
            self.dev.set_multiple(oid_val)
