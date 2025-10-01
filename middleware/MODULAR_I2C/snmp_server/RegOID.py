####################################
#### Modbus Register Dictionary ####
####################################

#1. Battery Measurement
Reg1 = {
        'CV'            : [5128],
        'CCL'           : [5129],
        'DCL'           : [5130],
        'EDV'           : [5131],
        
        'DC'            : [5135],
        'FCC'           : [5136],
        'RC'            : [5137],
        'SOC'           : [5138],
        'SOH'           : [5139],
        'Cycle_Count'   : [5140],
        'Voltage'       : [5144],
        'Max_Cell_Voltage' : [5145],
        'Min_Cell_Voltage' : [5146],
        'Current'       : [5148],
        'Max_Cell_Temp' : [5152],
        'Min_Cell_Temp' : [5153],
        'Max_FET_Temp' : [5154],
        'Max_PCB_Parts_Temp' : [5155],
        'Cell_Temp1'    : [5160],
        'Cell_Temp2'    : [5161],
        'Cell_Temp3'    : [5162],
        'FET_Temp'      : [5163],
        'PCB_Parts_Temp': [5164],
        'C1V'           : [5168],
        'C2V'           : [5169],
        'C3V'           : [5170],
        'C4V'           : [5171],
        'C5V'           : [5172],
        'C6V'           : [5173],
        'C7V'           : [5174],
        'C8V'           : [5175],
        'C9V'           : [5176],
        'C10V'          : [5177],
        'C11V'          : [5178],
        'C12V'          : [5179],
        'C13V'          : [5180],
        }

Reg1_Label = list(Reg1.keys())
Reg1_Val = []
for i in list(Reg1.values()):
    if len(Reg1_Val)==0:
        Reg1_Val.append(i)
    else:
        if (i[0]-Reg1_Val[-1][-1])==1:
            Reg1_Val[-1]+=i
        else:
            Reg1_Val.append(i)

#2. Identity
Reg2 = {
        'Manufacture_Name'          : 5184,
        'Device_Name'               : 5192,
        #'Manufacture_Date'          : 5200,
        'Serial_Number'             : 5201,
        #'Program_Version'           : 5204,
        #'DATA_Version'              : 5205,
        'BarCode'                   : 5208,
         }

Reg2_Label = list(Reg2.keys())
Reg2_Val = list(Reg2.values())

#3. Flags
Reg3 = {'Status'    : 5120,
        'Warning'   : 5121,
        'Alarm'     : 5122,
        'Error'     : 5123,
        }

Reg3_Label = list(Reg3.keys())
Reg3_Val = list(Reg3.values())

Regs = {**Reg1, **Reg2, **Reg3}
Regs_Label = list(Regs.keys())
Regs_Val = list(Regs.values())


#Bit_Position
#Module Status Flags
BitPos1 = {'Charge_Operation_Mode' : [[0,1],['Protection', 'Disable', 'Enable']],
           'Discharge_Operation_Mode' : [[2,3],['Protection', 'Disable', 'Enable']],
           'Charging' : 4,
           'Battery_Installed': 7,
           'Fully_Charged': 8,
           'Fully_Discharged': 9,
           'Charge_Warning': 10,
           'Discharge_Warning': 11,
           'Terminate_Charge_Alarm': 12,
           'Terminate_Discharge_Alarm': 13,
           'Permanent_Failure': 15,
          }

BitPos1_Label = list(BitPos1.keys())
BitPos1_Val = list(BitPos1.values())

#Module Warning Flags
BitPos2 = {'Over_Cell_Voltage_Warning' : 0,
           'Remaining_Capacity_Alarm' : 1,
           'Under_Voltage_Warning' : 2,
           'Cell_Imbalance_Warning' : 3,
           'Over_Charge_Current_Warning': 4,
           'Over_Discharge_Current_Warning' : 6,
           'Over_Cell_Temperature_Warning_For_Charge' : 8,
           'Under_Cell_Temperature_Warning_For_Charge' : 9,
           'Over_Cell_Temperature_Warning_For_Discharge' : 10,
           'Under_Cell_Temperature_Warning_For_Discharge' : 11,
           'FET_Overheat_Warning' : 12,
           'PCB_Overheat_Warning' : 13,
           }

BitPos2_Label = list(BitPos2.keys())
BitPos2_Val = list(BitPos2.values())

#Module Alarm Flags
BitPos3 = {'Over_Cell_Voltage_Protection': 0,
           'Over_Total_Voltage_Protection': 1,
           'Under_Voltage_Protection': 2,
           'Discharge_Cut_Off_Protection': 3,
           'Over_Charge_Current_SW_Protection': 4,
           'Over_Discharge_Current_SW_Protection': 6,
           'Over_Discharge_Current_HW_Protection': 7,
           'Over_Cell_Temperature_Protection_For_Charge': 8,
           'Under_Cell_Temperature_Protection_For_Charge': 9,
           'Over_Cell_Temperature_Protection_For_Discharge': 10,
           'Under_Cell_Temperature_Protection_For_Discharge': 11,
           'FET_Overheat_Protection': 12,
           'PCB_Overheat_Protection': 13,
           'Module_Isolated':1,
           }

BitPos3_Label = list(BitPos3.keys())
BitPos3_Val = list(BitPos3.values())

#Module Error Flags
BitPos4 = {'Over_Voltage_Error_SW': 0,
           'Over_Voltage_Error_HW': 1,
           'Low_Voltage_Error': 2,
           'Cell_Imbalance_Error': 3,
           'Charge_FET_Error': 4,
           'Discharge_FET_Error': 5,
           'Current_Fuse_Error': 6,
           'Scp_Error': 7,
           'Cell_Overheat_Error': 8,
           'Thermistor-Error': 10,
           'AFE_Communication_Error': 11,
           'Calibration_Data_Error': 12,
           'Firmware_Checksum_Error': 13,
           'PCB_System_Error': 14,
           'Cell_Permanent_Failure': 15,
           }

BitPos4_Label = list(BitPos4.keys())
BitPos4_Val = list(BitPos4.values())

###################################################
#### Variables List which need to be processed ####
###################################################
DivBy10_1 = []
DivBy10_2 = ['Min_Cell_Temp','Max_Cell_Temp','Max_FET_Temp','Max_PCB_Parts_Temp','FET_Temp','SOC','SOH', 'Cell_Temp1', 'Cell_Temp2', 'Cell_Temp3', 'PCB_Parts_Temp']

DivBy100_1 = ['CV', 'EDV','CCL', 'DCL']
DivBy100_2 = ['Current', 'Voltage']

DivBy1000_1 = []
DivBy1000_2 = ['Max_Cell_Voltage', 'Min_Cell_Voltage','C1V', 'C2V', 'C3V', 'C4V', 'C5V', 'C6V',
             'C7V', 'C8V', 'C9V', 'C10V', 'C11V', 'C12V', 'C13V', 'FCC', 'RC', 'DC']


#######################################
#### SNMP Specific OIDs Dictionary ####
#######################################

##### Overall Summary #####
OvSumm_oids = {'Bus_Volt'           : '[10]',
               'Bus_Curr'           : '[20]',
               'Capacity'           : '[30]',
               'BackupTime'         : '[40]',
               'Detected_Mod'       : '[50]',
               'ConnectedSlaves'    : '[60]',
               'ConnectedSlaveIDs'  : '[70]',
               'Status'             : '[80]',
               'Warning'            : '[90]',
               'Alarm'              : '[100]',
               'Error'              : '[110]'
               }
OvSumm_oids = {v: k for k, v in OvSumm_oids.items()}
OvSumm_oids_Label = list(OvSumm_oids.keys())
OvSumm_oids_Val = list(OvSumm_oids.values())
#print(OvSumm_oids)

##### SNMP Setting #####
SNMPSetting_oids = {'snmpIPaddress' : '[10]',
                    'snmpNetmask'   : '[20]',
                    'snmpGateway'   : '[30]',
                    'snmpVersion'   : '[40]',
                    'snmpCommunity' : '[50]',
                    'snmpPort'      : '[60]',
                    'sysOID'        : '[70]'
                    }
SNMPSetting_oids = {v: k for k, v in SNMPSetting_oids.items()}
SNMPSetting_oids_Label = list(SNMPSetting_oids.keys())
SNMPSetting_oids_Val = list(SNMPSetting_oids.values())
#print(SNMPSetting_oids)

##### Group Data #####
#1. Summary
LocSumm_oids = {'CV'            : '[10, 10]',
                'CCL'           : '[10, 20]',
                'DCL'           : '[10, 30]',
                'EDV'           : '[10, 40]',
                'Bus_Volt'      : '[10, 50]',
                'Bus_Curr'      : '[10, 60]',
                'Capacity'      : '[10, 70]',
                'BackupTime'    : '[10, 80]',
                'Detected_Mod'  : '[10, 90]',
                'Status'        : '[10, 100]',
                'Warning'       : '[10, 110]',
                'Alarm'         : '[10, 120]',
                'Error'         : '[10, 130]',
                }

LocSumm_oids = {v: k for k, v in LocSumm_oids.items()}
LocSumm_oids_Label = list(LocSumm_oids.keys())
LocSumm_oids_Val = list(LocSumm_oids.values())
#print(LocSumm_oids)

#2. Communication
Comm_oids = {'InternalID'           : '[20, 10]',
             'Type'                 : '[20, 20]',
             'InternalIPaddress'    : '[20, 30]',
             'InternalNetmask'      : '[20, 40]',
             'InternalGateway'      : '[20, 50]',
            }

Comm_oids = {v: k for k, v in Comm_oids.items()}
Comm_oids_Label = list(Comm_oids.keys())
Comm_oids_Val = list(Comm_oids.values())
#print(Comm_oids)

#3. Module
#General
Mod_oids1 = {'Voltage'    : '[30, 10, 15, 1, 10]',
             'Current'    : '[30, 10, 15, 1, 20]',
             'DC'         : '[30, 10, 15, 1, 30]',
             'FCC'        : '[30, 10, 15, 1, 40]',
             'RC'         : '[30, 10, 15, 1, 50]',
             'SOC'        : '[30, 10, 15, 1, 60]',
             'SOH'        : '[30, 10, 15, 1, 70]',
             'Cycle_Count': '[30, 10, 15, 1, 80]',
             }

#Temperatures
Mod_oids2 = {'Max_Cell_Temp'        : '[30, 20, 15, 1, 10]',
             'Min_Cell_Temp'        : '[30, 20, 15, 1, 20]',
             'Max_FET_Temp'         : '[30, 20, 15, 1, 30]',
             'Max_PCB_Parts_Temp'   : '[30, 20, 15, 1, 40]',
             'Cell_Temp1'           : '[30, 20, 15, 1, 50]',
             'Cell_Temp2'           : '[30, 20, 15, 1, 60]',
             'Cell_Temp3'           : '[30, 20, 15, 1, 70]',
             'FET_Temp'             : '[30, 20, 15, 1, 80]',
             'PCB_Parts_Temp'       : '[30, 20, 15, 1, 90]',
             }
    
#Cell Voltage
Mod_oids3 = {'Max_Cell_Voltage' : '[30, 30, 15, 1, 10]',
             'Min_Cell_Voltage' : '[30, 30, 15, 1, 20]',
             'C1V'              : '[30, 30, 15, 1, 30]',
             'C2V'              : '[30, 30, 15, 1, 40]',
             'C3V'              : '[30, 30, 15, 1, 50]',
             'C4V'              : '[30, 30, 15, 1, 60]',
             'C5V'              : '[30, 30, 15, 1, 70]',
             'C6V'              : '[30, 30, 15, 1, 80]',
             'C7V'              : '[30, 30, 15, 1, 90]',
             'C8V'              : '[30, 30, 15, 1, 100]',
             'C9V'              : '[30, 30, 15, 1, 110]',
             'C10V'             : '[30, 30, 15, 1, 120]',
             'C11V'             : '[30, 30, 15, 1, 130]',
             'C12V'             : '[30, 30, 15, 1, 140]',
             'C13V'             : '[30, 30, 15, 1, 150]',
             }

#Notification
Mod_oids4 = {'Status'   : '[30, 40, 15, 1, 10]',
             'Warning'  : '[30, 40, 15, 1, 20]',
             'Alarm'    : '[30, 40, 15, 1, 30]',
             'Error'    : '[30, 40, 15, 1, 40]',
            }

#Profile
Mod_oids5 = {'Manufacture_Name'  : '[30, 50, 15, 1, 10]',
             'Device_Name'       : '[30, 50, 15, 1, 20]',
             'Serial_Number'     : '[30, 50, 15, 1, 30]',
             'BarCode'           : '[30, 50, 15, 1, 40]'
            }

Mod_oids = {**Mod_oids1, **Mod_oids2, **Mod_oids3, **Mod_oids4, **Mod_oids5}
Mod_oids = {v: k for k, v in Mod_oids.items()}
Mod_oids_Label = list(Mod_oids.keys())
Mod_oids_Val = list(Mod_oids.values())
#print(Mod_oids)

#-------------------------------------------------------------------- MODULAR ----------------------------------------------------------

##### MODULAR ANALOG IO #####
mod_analog_io = {'analogInputOutput0'           : '[10]',
                    'analogInputOutput1'        : '[20]',
                    'analogInputOutput2'        : '[30]',
                    'analogInputOutput3'        : '[40]',
                    'analogInputOutput4'        : '[50]',
                    'analogInputOutput5'        : '[60]',
                    'analogInputOutput6'        : '[70]',
                    'analogInputOutput7'        : '[80]'
                    }
mod_analog_io = {v: k for k, v in mod_analog_io.items()}
mod_analog_io_Label = list(mod_analog_io.keys())
mod_analog_io_Val = list(mod_analog_io.values())
#print(mod_analog_io)

##### MODULAR OPTOCOUPLER #####
mod_optocoupler = {'optocouplerInput1'           : '[10]',
                    'optocouplerInput2'        : '[20]',
                    'optocouplerInput3'        : '[30]',
                    'optocouplerInput4'        : '[40]',
                    'optocouplerInput5'        : '[50]',
                    'optocouplerInput6'        : '[60]',
                    'optocouplerInput7'        : '[70]',
                    'optocouplerOutput1'       : '[80]',
                    'optocouplerOutput2'       : '[90]',
                    'optocouplerOutput3'       : '[100]',
                    'optocouplerOutput4'       : '[110]',
                    'optocouplerOutput5'       : '[120]',
                    'optocouplerOutput6'       : '[130]',
                    'optocouplerOutput7'       : '[140]'
                    }
mod_optocoupler = {v: k for k, v in mod_optocoupler.items()}
mod_optocoupler_Label = list(mod_optocoupler.keys())
mod_optocoupler_Val = list(mod_optocoupler.values())
#print(mod_optocoupler)

##### MODULAR GPIO #####
mod_gpio = {'gpioInputOutput1'                  : '[10]',
                    'gpioInputOutput2'          : '[20]',
                    'gpioInputOutput3'          : '[30]',
                    'gpioInputOutput4'          : '[40]',
                    'gpioInputOutput5'          : '[50]',
                    'gpioInputOutput6'          : '[60]',
                    'gpioInputOutput7'          : '[70]',
                    'gpioInputOutput8'          : '[80]',
                    'gpioInputOutput9'          : '[90]',
                    'gpioInputOutput10'         : '[100]',
                    'gpioInputOutput11'         : '[110]',
                    'gpioInputOutput12'         : '[120]',
                    'gpioInputOutput13'         : '[130]',
                    'gpioInputOutput14'         : '[140]'
                    }
mod_gpio = {v: k for k, v in mod_gpio.items()}
mod_gpio_Label = list(mod_gpio.keys())
mod_gpio_Val = list(mod_gpio.values())
#print(mod_gpio)

##### MODULAR DRYCONTACT #####
mod_drycontact = {'drycontactInput1'            : '[10]',
                    'drycontactInput2'          : '[20]',
                    'drycontactInput3'          : '[30]',
                    'drycontactInput4'          : '[40]',
                    'drycontactInput5'          : '[50]',
                    'drycontactInput6'          : '[60]',
                    'drycontactInput7'          : '[70]',
                    'drycontactInput8'          : '[80]',
                    'drycontactInput9'          : '[90]',
                    'drycontactInput10'         : '[100]',
                    'drycontactInput11'         : '[110]',
                    'drycontactInput12'         : '[120]',
                    'drycontactInput13'         : '[130]',
                    'drycontactInput14'         : '[140]'
                    }
mod_drycontact = {v: k for k, v in mod_drycontact.items()}
mod_drycontact_Label = list(mod_drycontact.keys())
mod_drycontact_Val = list(mod_drycontact.values())
#print(mod_drycontact)

##### MODULAR RELAY #####
mod_relay = {'relayOutput1'            : '[10]',
                    'relayOutput2'          : '[20]',
                    'relayOutput3'          : '[30]',
                    'relayOutput4'          : '[40]',
                    'relayOutput5'          : '[50]',
                    'relayOutput6'          : '[60]',
                    'relayOutput7'          : '[70]',
                    'relayOutput8'          : '[80]'
                    }
mod_relay = {v: k for k, v in mod_relay.items()}
mod_relay_Label = list(mod_relay.keys())
mod_relay_Val = list(mod_relay.values())
#print(mod_relay)

##### MODULAR RELAY MINI #####
mod_relay_mini = {'relayMiniOutput1'            : '[10]',
                    'relayMiniOutput2'          : '[20]',
                    'relayMiniOutput3'          : '[30]',
                    'relayMiniOutput4'          : '[40]',
                    'relayMiniOutput5'          : '[50]',
                    'relayMiniOutput6'          : '[60]'
                    }
mod_relay_mini = {v: k for k, v in mod_relay_mini.items()}
mod_relay_mini_Label = list(mod_relay_mini.keys())
mod_relay_mini_Val = list(mod_relay_mini.values())
#print(mod_relay_mini)
