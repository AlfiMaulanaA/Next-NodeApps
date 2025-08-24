##############################
#### Data Type Dictionary ####
##############################

############ Overall Summary ############
dict1 = {'Bus_Volt'           : 'Float',
         'Bus_Curr'           : 'Float',
         'Capacity'           : 'Float',
         'BackupTime'         : 'String',
         'Detected_Mod'       : 'Integer',
         'ConnectedSlaves'    : 'Integer',
         'ConnectedSlaveIDs'  : 'String',
         'Status'             : 'String',
         'Warning'            : 'String',
         'Alarm'              : 'String',
         'Error'              : 'String'
        }

############ SNMP Setting ############
dict2 = {'snmpIPaddress' : 'String',
         'snmpNetmask'   : 'String',
         'snmpGateway'   : 'String',
         'snmpVersion'   : 'Integer',
         'snmpCommunity' : 'String',
         'snmpPort'      : 'Integer',
         'sysOID'        : 'String'
        }

############ Group Data ############
#1. Overview
dict3 = {'CV'            : 'Float',
         'CCL'           : 'Float',
         'DCL'           : 'Float',
         'EDV'           : 'Float',
         'Bus_Volt'      : 'Float',
         'Bus_Curr'      : 'Float',
         'Capacity'      : 'Float',
         'BackupTime'    : 'String',
         'Detected_Mod'  : 'Integer',
         'Status'        : 'String',
         'Warning'       : 'String',
         'Alarm'         : 'String',
         'Error'         : 'String',
        }

#2. Communication
dict4 = {'InternalID'           : 'String',
         'Type'                 : 'String',
         'InternalIPaddress'    : 'String',
         'InternalNetmask'      : 'String',
         'InternalGateway'      : 'String',
         }


#3. Module
#General
dict5 = {'Voltage'    : 'Float',
         'Current'    : 'Float',
         'DC'         : 'Float',
         'FCC'        : 'Float',
         'RC'         : 'Float', 
         'SOC'        : 'Float',
         'SOH'        : 'Float',
         'Cycle_Count': 'Float',
        }

#Temperatures
dict6 = {'Max_Cell_Temp'        : 'Float',
         'Min_Cell_Temp'        : 'Float',
         'Max_FET_Temp'         : 'Float',
         'Max_PCB_Parts_Temp'   : 'Float',
         'Cell_Temp1'           : 'Float',
         'Cell_Temp2'           : 'Float',
         'Cell_Temp3'           : 'Float',
         'FET_Temp'             : 'Float',
         'PCB_Parts_Temp'       : 'Float',
        }

#Cell Voltage
dict7 = {'Max_Cell_Voltage'  : 'Float',
         'Min_Cell_Voltage'  : 'Float',
         'C1V'             : 'Float',
         'C2V'             : 'Float',
         'C3V'             : 'Float',
         'C4V'             : 'Float',
         'C5V'             : 'Float',
         'C6V'             : 'Float',
         'C7V'             : 'Float',
         'C8V'             : 'Float',
         'C9V'             : 'Float',
         'C10V'            : 'Float',
         'C11V'            : 'Float',
         'C12V'            : 'Float',
         'C13V'            : 'Float',
        }

#Notification
dict8 = {'Status'   : 'String',
         'Warning'  : 'String',
         'Alarm'    : 'String',
         'Error'    : 'String',
        }

#Profile
dict9 = {'Manufacture_Name'  : 'String',
         'Device_Name'       : 'String',
         'Serial_Number'     : 'Integer',
         'BarCode'           : 'String',
        }

dataType = {**dict1, **dict2, **dict3, **dict4, **dict5, **dict6, **dict7, **dict8, **dict9}

