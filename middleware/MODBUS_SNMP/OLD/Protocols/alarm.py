import Protocols.SpecialFunction.Tripplite_srxcool as Tripplite_srxcool
from colorama import Fore, Style
from Converter import *
ListofAlarm = ["Tripplite_SNMP", "APC_SNMP", "KEHUA_SNMP", "ENVICOOL_RTU"]

def Tripplite_SNMP(snmp_dev, oid_alarm):

    oid_time_alarm      = ".1.3.6.1.4.1.850.1.3.2.1.3"
    oid_detail_alarm    = ".1.3.6.1.4.1.850.1.3.2.1.6"
    oid_type_alarm      = ".1.3.6.1.4.1.850.1.3.2.1.7"
    oid_state_alarm     = ".1.3.6.1.4.1.850.1.3.2.1.8"
    oid_id_alarm        = ".1.3.6.1.4.1.850.1.3.2.1.1"

    VarNameList         = []
    values              = []

    Number_of_alarm = snmp_dev.get(oid_alarm[0]).value
    walk_alarm_id = snmp_dev.walk(oid_id_alarm)
    
    count_critical = 0
    count_major    = 0
    count_minor    = 0

    if Number_of_alarm != "0":
        for item in walk_alarm_id:
            id_alarm = str(item.value)
            VarNameList.append(snmp_dev.get(oid_detail_alarm + "." + id_alarm).value)
            state = int(snmp_dev.get(oid_type_alarm + "." + id_alarm).value)
            if state == 1:
                count_critical += 1
                values.append("Critical")
            elif state == 2:
                count_major += 1
                values.append("Major")
            elif state == 3:
                count_minor += 1
                values.append("Minor")
            elif state == 4:
                values.append("Status")
            elif state == 5:
                values.append("Offline")
            elif state == 6:
                values.append("Custom")
    
    data = str()
    for i in range(len(VarNameList)):
        data += VarNameList[i] + ": " + values[i] +" \n"

    VarNameList         = []
    values              = []


    VarNameList.append("Number_of_alarm")
    values.append(Number_of_alarm)
    VarNameList.append("List_of_Alarm")
    values.append(data)

    VarNameList.append("Count of Critical")
    values.append(count_critical)
    VarNameList.append("Count of Major")
    values.append(count_major)
    VarNameList.append("Count of Minor")
    values.append(count_minor)

    #Special Function of Triplite AIRCON
    if snmp_dev.get(".1.3.6.1.4.1.850.1.1.1.2.1.5.1").value == "SR(X)COOL":
        Tripplite_srxcool.getSpecialData(snmp_dev, VarNameList, values)

    Result = dict(zip(VarNameList, values))    
    return Result

def APC_SNMP(snmp_dev, oid_alarm):
    VarNameList         = []
    values              = []

    count_critical = 0
    count_major    = 0
    count_minor    = 0

    Load_State_Alarm = [None, "No Alarm", "Minor", "Major", "Critical"]

    VarNameList.append("Load_State_Alarm")
    values.append(Load_State_Alarm[int(snmp_dev.get(".1.3.6.1.4.1.318.1.1.12.2.2.1.1.5.1").value)])
    VarNameList.append("Load_Bank_1_Alarm")
    values.append(Load_State_Alarm[int(snmp_dev.get(".1.3.6.1.4.1.318.1.1.12.2.4.1.1.5.1").value)])
    VarNameList.append("Load_Bank_2_Alarm")
    values.append(Load_State_Alarm[int(snmp_dev.get(".1.3.6.1.4.1.318.1.1.12.2.4.1.1.5.2").value)])

    count_minor = values.count("Minor")
    count_major = values.count("Major")
    count_critical = values.count("Critical")
    total_alarm = count_critical + count_major + count_minor

    data = str()
    for i in range(len(VarNameList)):
        data += VarNameList[i] + ": " + values[i] +" \n"

    VarNameList         = []
    values              = []

    VarNameList.append("Number_of_alarm")
    values.append(total_alarm)
    VarNameList.append("List_of_Alarm")
    values.append(data)


    VarNameList.append("Count of Critical")
    values.append(count_critical)
    VarNameList.append("Count of Major")
    values.append(count_major)
    VarNameList.append("Count of Minor")
    values.append(count_minor)

    Result = dict(zip(VarNameList, values))    
    return Result

def KEHUA_SNMP(snmp_dev, varname_alarm, oid_alarm):
    upsAlarmPresent = ".1.3.6.1.2.1.33.1.6.1.0"
    upsAlarmDescr   = ".1.3.6.1.2.1.33.1.6.2.1.2"

    total_of_alarm = snmp_dev.get(upsAlarmPresent).value
    alarmActive = []
    VarNameList = []
    values      = []
    for i in range (int(total_of_alarm)):
        alarmActive.append(snmp_dev.get(upsAlarmDescr + "." + str(i+1)).value)

    for j in range(len(alarmActive)):  
        VarNameList.append(varname_alarm[oid_alarm.index(alarmActive[j])])
        values.append("Critical")
    data = str()
    for i in range(len(VarNameList)):
        data += VarNameList[i] + ": " + values[i] +" \n"


    VarNameList         = []
    values              = []


    VarNameList.append("Number_of_alarm")
    values.append(total_of_alarm)
    VarNameList.append("List_of_Alarm")
    values.append(data)

    VarNameList.append("Count of Critical")
    values.append(total_of_alarm)
    VarNameList.append("Count of Major")
    values.append(0)
    VarNameList.append("Count of Minor")
    values.append(0)

    Result = dict(zip(VarNameList, values))    
    return Result
    


def ENVICOOL_RTU(modbus_dev, VarNameList, AddressList, functioncode, data_type): 
    print(Fore.RED + "\n=============================== Testing =================================="+ Fore.WHITE)

    Alarm_active_list   = []
    values              = []
    for i in range(len(VarNameList)):
        data = modbus_dev.read_registers(AddressList[i], 1, functioncode[i])
        if data_type != "INT16":
            command = "data = " + data_type +"toINT16(data)"
            exec(command)
        if int(data[0]) == 1:
            Alarm_active_list.append(VarNameList[i])
            values.append("Critical")

    total_alarm = len(Alarm_active_list)
    data = str()
    for i in range(len(Alarm_active_list)):
        data += Alarm_active_list[i] + ": " + values[i] +" \n"

    VarNameList         = []
    values              = []

    VarNameList.append("Number_of_alarm")
    values.append(total_alarm)
    VarNameList.append("List_of_Alarm")
    values.append(data)


    VarNameList.append("Count of Critical")
    values.append(total_alarm)
    VarNameList.append("Count of Major")
    values.append(0)
    VarNameList.append("Count of Minor")
    values.append(0)

    Result = dict(zip(VarNameList, values)) 
    print(Result)   
    return Result


