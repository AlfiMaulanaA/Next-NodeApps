import pprint
import traceback
pp = pprint.PrettyPrinter(indent=4)

####################################### DEVICE CLASS #######################################
# Function to read specific bit value of a binary data
def readbitval(data, bitnumber):
    dat = data
    mask = 2**bitnumber
    c = dat & mask
    c = c>>bitnumber
    return c

MANU_PN_LIST = ["Envicool_DC03HDNC1A", "Eaton_EDPU", "Eaton_EFLXN04", "Tripplite_PDUMNV32HV2LX",
           "Tripplite_PDUMNH32HV", "Tripplite_SRXCOOL7KRM", "Eaton_SC200", "DPC_SC501", "Hitachi_HR11",
           "Socomec_NETYS", "Socomec_ITYS", "Socomec_MASTERYS", "Panasonic_DCB105ZK", "Pilot_PBAT600",
            "Pilot_SPM33", "Pilot_SPM91", "Pilot_SPM20", "Schneider_PM1200", "Schneider_PM2200", "ABB_M4M30", 
            "ABB_ATS022", "ABB_RVT", "Envicool_EIA05CPNC1E", "Envicool_EF20CDNC1B", "Kehua_KR3000RM", 
            "ABB_CMS700", "APC_AP8853", "IOT_CAN_SENSOR", "GPIO_Doorswitch"
           ]

# General Device Class
class Device(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}

        data = dict(raw_data)
        return data

    def write(self):
        pass
####################################### CANBUS #######################################

class IOT_CAN_SENSOR(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "CANBUS_SENSOR":
            data = {}
            raw_data["deviceid"] = "1"
            raw_data["topic_name"] = "modular/device/1/humidity"

            data = dict(raw_data)
            return data
        else:
            return -1


####################################### AIRCONDS #######################################
class Envicool_DC03HDNC1A(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            # STATUS
            status_list = ['unit_status', 'internal_fan_status', 'external_fan_status', 'compressor_status', 'pump_status']
            STATUS = ["Standby","Running","Fault"]

            for item in status_list:
                try:
                    data[item] = STATUS[raw_data[item]-1]
                except:
                    data[item] = "-"

            # ALARMS
            ALARM_MAP = [["alarm_high_temp", "High Temperature"],
                         ["alarm_internal_fan_failure","Internal Fan Failure"],
                         ["alarm_external_fan_failure","External Fan Failure"],
                         ["alarm_compressor_failure","Compressor Failure"],
                         ["alarm_int_temp_sensor_fail","Internal Temperature Sensor Fail"],
                         ["alarm_high_system_pressure","High System Pressure"],
                         ["alarm_low_temp","Low Temperature"],
                         ["alarm_dc_overvoltage","DC Overvoltage"],
                         ["alarm_dc_undervoltage","DC Undervoltage"],
                         ["alarm_ac_overvoltage","AC Overvoltage"],
                         ["alarm_ac_undervoltage","AC Undervoltage"],
                         ["alarm_ac_supply_fail","AC Power Supply Fail"],
                         ["alarm_evap_temp_fail","Evaporator Temperature Sensor Fail"],
                         ["alarm_cond_temp_fail","Condenser Temperature Sensor Fail"],
                         ["alarm_amb_temp_fail","Ambient Temperature Sensor Fail"],
                         ["alarm_coil_freeze_prot","Coil Freeze Protection"],
                         ["alarm_freq_high_pressure","Frequent High System Pressure"]]

            alarm = []

            for item in ALARM_MAP:
                if raw_data[item[0]] == 1:
                    alarm.append(item[1])

            if len(alarm) != 0:
                data['alarm'] = ', '.join(alarm)
            else:
                data['alarm'] = None

            int16_data_list = ["condenser_temp", "evaporator_temp", "internal_temp", "ambient_temp"]
            uint16_data_list = ["internal_fan_speed", "external_fan_speed", "ac_input_voltage",
                                "dc_input_voltage", "ac_running_current"]
            uint32_data_list = ["unit_running_time"]

            for item in int16_data_list:
                #checking value if it is not invalid value (0xFFFF)
                value = raw_data[item]

                if value*10 == 0xFFFF or value*10 == 32767:
                    data[item] = "-"
                else:
                    data[item] = value

            for item in uint16_data_list:
                #checking value if it is not invalid value (0xFFFF)
                value = raw_data[item]

                if value*10 == 0xFFFF:
                    data[item] = "-"
                else:
                    data[item] = value

            for item in uint32_data_list:
                #checking value if it is not invalid value (0xFFFF)
                value = raw_data[item]

                if value*10 == 0xFFFF:
                    data[item] = "-"
                else:
                    data[item] = value

            return data
        else:
            return -1

class Envicool_EF20CDNC1B(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            raw_data["Device_Manufacture"] = "ENVICOOL"
            raw_data["Device_Model"] = "EF20CDNC1B"

            # STATUS
            status_list = ['Running_Status', 'Internal_Fan_Status', 'External_Fan_Status', 'Compresor_Status']
            STATUS = ["Standby","Running","Fault"]

            for item in status_list:
                try:
                    raw_data[item] = STATUS[raw_data[item]-1]
                except:
                    raw_data[item] = "-"


            int16_data_list = ["Condensor_Temperature", "Evaporator_Temperature", "Return_Air_Temperature", "Environtment_Temperature"]
            uint16_data_list = ["internal_fan_speed", "external_fan_speed", "ac_input_voltage",
                                "dc_input_voltage", "ac_running_current"]

            for item in int16_data_list:
                #checking value if it is not invalid value (0xFFFF)
                value = raw_data[item]

                if value*10 == 0xFFFF or value*10 == 32767 or value == 0:
                    raw_data[item] = "Invalid"
                else:
                    raw_data[item] = value
            """
            for item in uint16_data_list:
                #checking value if it is not invalid value (0xFFFF)
                value = raw_data[item]

                if value*10 == 0xFFFF:
                    raw_data[item] = "Invalid"
                else:
                    raw_data[item] = value
            """

            data = raw_data
            return data
        else:
            return -1

class Envicool_EIA05CPNC1E(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            raw_data["Device_Manufacture"] = "ENVICOOL"
            raw_data["Device_Model"] = "EIA05CPNC1E"
            
            # STATUS
            status_list = ['Running_Status', 'Internal_Fan_Status', 'External_Fan_Status', 'Compresor_Status', 'Heater_Status', 'Emergency_Fan_Status']
            STATUS = ["Standby","Running","Invalid"]

            for item in status_list:
                try:
                    raw_data[item] = STATUS[raw_data[item]-1]
                except:
                    raw_data[item] = "-"

            int16_data_list = ["Condensor_Temperature", "Evaporator_Temperature", "Return_Air_Temperature", "Environtment_Temperature"]
            uint16_data_list = ["Humidity"]

            for item in int16_data_list:
                #checking value if it is not invalid value (0xFFFF)
                value = raw_data[item]

                if value*10 == 0xFFFF or value*10 == 32767 or value == 200.0:
                    raw_data[item] = "Invalid"
                else:
                    raw_data[item] = value

            for item in uint16_data_list:
                #checking value if it is not invalid value (0xFFFF)
                value = raw_data[item]

                if value*10 == 0xFFFF or value == 0:
                    raw_data[item] = "invalid"
                else:
                    raw_data[item] = value
            
            data = raw_data
            return data
        else:
            return -1

class Tripplite_SRXCOOL7KRM(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}

            # Insert code here to process raw data into real data

            #STATUS AND ALARM
            OP_MODE = ["Off", "Idle", "Cooling", "Shutting Down", "Dehumidifying", "Defrosting", "Not Connected"]
            GENERAL_STATUS = ["Disabled", "Enabled"]
            WATER_STATUS = ["Not Full", "Full"]
            COOLING_STATUS = ["Off", "On"]
            FAN_SPEED = ["Off", "Low", "Medium Low", "Medium", "Medium High", "High", "Auto"]
            ALARM = ["", "Lost Communication", "Disconnected from Device", "Power Button Pressed", "Water Full", "Ping Watchdog Ping Probe Failed", "NTP Watchdog NTP Probe Failed"]

            #data[""] = raw_data[""]
            raw_data["Return_Air_Temperature"] = raw_data["Return_Air_Temperature"]
            raw_data["Running_Status"] = OP_MODE[raw_data["Running_Status"]]
            #raw_data["water_status"] = WATER_STATUS[raw_data["water_status"]]
            raw_data["cooling_status"] = COOLING_STATUS[raw_data["cooling_status"]]
            raw_data["Internal Fan Status"] = FAN_SPEED[raw_data["Internal Fan Status"]]
            #data["alarm"] = ALARM[raw_data["alarm"]]
            #data["autospeed"] = GENERAL_STATUS[raw_data["autospeed"]]
            #raw_data["dehumidifying_mode"] = GENERAL_STATUS[raw_data["dehumidifying_mode"]]
            #raw_data["quiet_mode"] = GENERAL_STATUS[raw_data["quiet_mode"]]

            data = raw_data

            return data
        else:
            return -1


####################################### PDU #######################################
class Eaton_EDPU(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}

            # Insert code here to process raw data into real data
            # ...
            # ...

            return data
        else:
            return -1

class Eaton_EFLXN04(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}

            # Insert code here to process raw data into real data
            data["output_voltage"] = raw_data["output_voltage_1"]
            data["output_current"] = raw_data["output_current_1"]
            data["output_energy"] = raw_data["output_energy_1"]

            return data
        else:
            return -1

class Tripplite_PDUMNV32HV2LX(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}
            
            Bank_Breaker_Status = ["Open", "Closed"]

            #Not Available Data
            raw_data["Input_Power"] = "Not Available"
            raw_data["Power_Factor"] = "Not Available"
            raw_data["Energy"] = "Not Available"
            raw_data["Energy_Date"] = None
            raw_data["Peak_Power"] = "Not Available"
            raw_data["Peak_Power_Date"] = None
            raw_data["Apparent_Power"] = "Not Available"
            raw_data["Orientation"] = "Not Available"
            raw_data["Bank_Breaker_1_Status"] = Bank_Breaker_Status[raw_data["Bank_Breaker_1_Status"]]
            raw_data["Bank_Breaker_2_Status"] = Bank_Breaker_Status[raw_data["Bank_Breaker_2_Status"]]

            raw_data["Total_Output_Current"] = raw_data["Output_Current_Bank_1"] + raw_data["Output_Current_Bank_2"]
            raw_data["Output_Power"] = raw_data["Total_Output_Current"] * raw_data["Output_Voltage"]

            data = raw_data
            return data
        else:
            tb = traceback.format_exc()
            print(tb)
            return -1

class Tripplite_PDUMNH32HV(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}
    
            #Not Available Data
            raw_data["Input_Power"] = "Not Available"
            raw_data["Power_Factor"] = "Not Available"
            raw_data["Energy"] = "Not Available"
            raw_data["Energy_Date"] = None
            raw_data["Peak_Power"] = "Not Available"
            raw_data["Peak_Power_Date"] = None
            raw_data["Apparent_Power"] = "Not Available"
            raw_data["Orientation"] = "Not Available"
            raw_data["Bank Breaker 1 Status"] = "Not Available"
            raw_data["Bank Breaker 2 Status"] = "Not Available"

            raw_data["Total_Output_Current"] = raw_data["Output_Current_Bank_1"] + raw_data["Output_Current_Bank_2"]
            raw_data["Output_Power"] = raw_data["Total_Output_Current"] * raw_data["Output_Voltage"]

            data = raw_data
            return data
        else:
            tb = traceback.format_exc()
            print(tb)
            return -1

class APC_AP8853(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}
            
            #Not Available Data
            raw_data["Bank_Breaker_1_Status"] = "Not Available"
            raw_data["Bank_Breaker_2_Status"] = "Not Available"
            raw_data["Input_Frequency"] = "Not Available"
            raw_data["Voltage Minimum"] = "Not Available"
            raw_data["Voltage Maximum"] = "Not Available"

            Orientation = [None, "Horizontal", "Vertical", "VerticalISXv2", "VerticalISXv2"]
            raw_data["Manufacature_Device"] = "APC"
            raw_data["Total Output Current "] = raw_data["Output_Current_Bank_1"] + raw_data["Output_Current_Bank_2"]
            raw_data["Orientation"] = Orientation[raw_data["Orientation"]]

            data = raw_data
            return data
        else:
            return -1

####################################### RECTIFIER #######################################
class Eaton_SC200(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus TCP":
            data = {}

            # Summary Alarm
            data['summary_alarm_critical'] = raw_data['summary_alarm'][0]
            data['summary_alarm_minor'] = raw_data['summary_alarm'][2]
            data['summary_alarm_major'] = raw_data['summary_alarm'][1]
            data['summary_alarm_warning'] = raw_data['summary_alarm'][3]

            # Detailed Alarm
            MAIN_ALARM = ['Fan-Fail', 'Mains-Fail', 'MOV-Fail', 'Load-Fuse-Fail', 'Battery-Fuse-Fail',
                       'Cabinet-Fan-Fail', 'Phase-Fail']
            main_alarm = []

            for i, item in enumerate(raw_data['main_alarm']):
                if item == True:
                    main_alarm.append(MAIN_ALARM[i])
            if len(main_alarm) != 0:
                data['main_alarm'] = ', '.join(main_alarm)
            else:
                data['main_alarm'] = None

            DETAILED_ALARM = ['Low-Float', 'Low-Load', 'High-Float', 'High-Load', 'Rectifier-Fail',
                              'Multiple-Rectifier-Fail', 'Rectifier-Comms-Lost', 'Multiple-Rectifier-Comms-Lost',
                              'Partial-AC-Fail', 'AC-Fail', 'System-Overload', 'Load-Fuse-Fail', 'Battery-Fuse-Fail',
                              'Battery-Test-Fail', 'MOV-Fail', 'ACD-Fan-Fail', 'LVD1-Disconnected', 'LVD1-Fail', 'LVD1-Manual',
                              'LVD2-Disconnected', 'LVD2-Fail', 'LVD2-Manual', 'Battery-Temperature-Low',
                              'Battery-Temperature-High', 'Sensor-Fail', 'Equalize', 'Fast-Charge', 'Battery-Test',
                              'Auxiliary-Sensor-Fail', 'In-Discharge', 'Battery-Current-Limit', 'Rectifier-No-Load',
                              'Rectifier-Current-Limit', 'Rectifier-Over-Temperature', 'AC-Phase1-Fail',
                              'AC-Phase1-Voltage', 'AC-Phase2-Fail', 'AC-Phase2-Voltage', 'AC-Phase3-Fail', 'AC-Phase3-Voltage',
                              'AC-Frequency', 'Generator-Enable', 'Cabinet-Fan-Fail', 'New-Hardware', 'Unknown-Hardware',
                              'Missing-Hardware', 'Standby-Mode', 'LVD1-Characterization-Error', 'LVD2-Characterization-Error',
                              'String-Fail', 'Generator-Fail', 'LVD-Disconnected', 'LVD-Fail', 'LVD-Manual', 'LVD-Characterization-Error',
                              'Configuration-Error', 'Wrong-Battery-Polarity', 'Characterizing-Battery', 'DO-Manual']

            detailed_alarm = []
            for i,item in enumerate(raw_data['detailed_alarm']):
                if item == True:
                    detailed_alarm.append(DETAILED_ALARM[i])
            if len(detailed_alarm) != 0:
                data['detailed_alarm'] = ', '.join(detailed_alarm)
            else:
                data['detailed_alarm'] = None

            #Other Data
            data['battery_current'] = raw_data['battery_current']
            data['battery_temperature'] = raw_data['battery_temperature']
            data['dc_voltage'] = raw_data['dc_voltage']
            data['load_current'] = raw_data['load_current']
            data['load_power'] = raw_data['load_power']
            data['rectifier_module'] = raw_data['rectifier_module']
            data['system_power'] = raw_data['system_power']
            data['total_dc_current'] = raw_data['total_dc_current']
            data['ac_voltage'] = raw_data['ac_voltage']

            return data
        else:
            return -1

class DPC_SC501(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}

            # Insert code here to process raw data into real data
            # ...
            # ...

            return data
        else:
            return -1

####################################### UPS #######################################
class Hitachi_HR11(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}

            # Battery Status
            BATTERY_STATUS = [None, "Unknown", "Normal", "Low"]
            data['battery_status'] = BATTERY_STATUS[raw_data['battery_status']]

            # Output Status
            OUTPUT_STATUS = [None, "Unknown", "On Line", "On Battery", "On Boost",
                             "Sleeping", "On Bypass", "Rebooting", "StandBy", "On Buck"]
            data['output_status'] = OUTPUT_STATUS[raw_data['output_status']]

            # Measurements
            data['ups_model'] = raw_data['ups_model']
            data['ups_firmware_version'] = raw_data['ups_firmware_version']
            data['battery_full_charge_voltage'] = raw_data['battery_full_charge_voltage']
            data['input_voltage'] = raw_data['input_voltage']
            data['frequency'] = raw_data['frequency']
            data['load_percentage'] = raw_data['load_percentage']
            data['battery_voltage'] = raw_data['battery_voltage']
            data['battery_temperature'] = raw_data['battery_temperature']

            return data
        else:
            return -1

class Socomec_NETYS(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            # Status
            STATUS = ['Input Mains present (Mains OK)', 'Inverter ON', 'Rectifier ON',
                      'Load on Inverter (normal mode)', 'Load on Mains/Load on Bypass', 'Load on Battery/Batery Discharging (UPS in backup mode)',
                      None, 'Eco Mode ON', 'UPS in Stand-by mode', 'Buzzer ON', 'Battery Test in progress',
                      None, None, 'Battery Test supported (test possible)', 'Battery test failed (not concluded, ...)',
                      'Battery near end of Back-up (Low Battery)', 'Battery discharged', ['Battery not OK', 'Battery OK'],
                      None, None, None, None, None, 'Inverter synchronised with Mains', 'Boost ON', None,
                      'Auxiliary mains OK', 'Battery charger ON', 'Auxiliary input frequency out of tolerance',
                      None, None, 'Battery extension present']

            status = []
            for each_bit in range(32):
                bit_value = readbitval(raw_data['status'], each_bit)
                if type(STATUS[each_bit]) == list:
                    status.append(STATUS[each_bit][bit_value])
                else:
                    if bit_value == 1 and STATUS[each_bit] != None:
                        status.append(STATUS[each_bit])

            if len(status) != 0:
                data['status'] = ', '.join(status)
            else:
                data['status'] = None

            # Alarm
            ALARM = [None, 'Battery Failure/Battery fuse open', 'UPS overload',
                     'Output voltage out of tolerance', 'Digital power supply fault (Vcc)',
                     'Input voltage out of tolerance', 'Auxiliary mains out of tolerance',
                     'Internal over-temperature alarm', None, None, None, None, None, None,
                     None, None, None, None, 'Overload timeout blocking inverter', None, None,
                     None, 'Input mains general alarm', None, None, None, None, None, None, None,
                     'UPS stopped for overload','Imminent Stop']

            alarm = []
            for each_bit in range(32):
                bit_value = readbitval(raw_data['alarm'], each_bit)
                if bit_value == 1 and ALARM[each_bit] != None:
                    alarm.append(ALARM[each_bit])

            if len(alarm) != 0:
                data['alarm'] = ', '.join(alarm)
            else:
                data['alarm'] = None

            # Measurements
            data['load'] = raw_data['load']
            data['total_load'] = raw_data['total_load']
            data['battery_capacity'] = raw_data['battery_capacity']
            data['aux_mains_star_voltage'] = raw_data['aux_mains_star_voltage']
            data['output_star_voltage'] = raw_data['output_star_voltage']
            data['output_current'] = raw_data['output_current']
            data['aux_frequency'] = raw_data['aux_frequency']
            data['output_frequency'] = raw_data['output_frequency']
            data['positive_battery_voltage'] = raw_data['positive_battery_voltage']
            data['internal_ups_temperature'] = raw_data['internal_ups_temperature']
            if raw_data['remaining_backup_time'] == 0xFFFF:
                data['remaining_backup_time'] = None
            else:
                data['remaining_backup_time'] = raw_data['remaining_backup_time']
            data['input_mains_star_voltage'] = raw_data['input_mains_star_voltage']

            return data
        else:
            return -1

class Socomec_ITYS(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            # Status
            STATUS = ['Input Mains present (Mains OK)', 'Inverter ON', 'Rectifier ON',
                      'Load on Inverter (normal mode)', 'Load on Mains/Load on Bypass',
                      'Load on Battery/Batery Discharging (UPS in backup mode)',
                      None, 'Eco Mode ON', 'UPS in Stand-by mode', 'Buzzer ON', 'Battery Test in progress',
                      None, None, 'Battery Test supported (test possible)', 'Battery test failed (not concluded, ...)',
                      'Battery near end of Back-up (Low Battery)', 'Battery discharged',
                      ['Battery not OK', 'Battery OK'],
                      None, None, None, None, None, 'Inverter synchronised with Mains', 'Boost ON', None,
                      'Auxiliary mains OK', 'Battery charger ON', 'Auxiliary input frequency out of tolerance',
                      None, None, 'Battery extension present']

            status = []
            for each_bit in range(32):
                bit_value = readbitval(raw_data['status'], each_bit)
                if type(STATUS[each_bit]) == list:
                    status.append(STATUS[each_bit][bit_value])
                else:
                    if bit_value == 1 and STATUS[each_bit] != None:
                        status.append(STATUS[each_bit])

            if len(status) != 0:
                data['status'] = ', '.join(status)
            else:
                data['status'] = None

            # Alarm
            ALARM = [None, 'Battery Failure/Battery fuse open', 'UPS overload',
                     'Output voltage out of tolerance', 'Digital power supply fault (Vcc)',
                     'Input voltage out of tolerance', 'Auxiliary mains out of tolerance',
                     'Internal over-temperature alarm', None, None, None, None, None, None,
                     None, None, None, None, 'Overload timeout blocking inverter', None, None,
                     None, 'Input mains general alarm', None, None, None, None, None, None, None,
                     'UPS stopped for overload', 'Imminent Stop']

            alarm = []
            for each_bit in range(32):
                bit_value = readbitval(raw_data['alarm'], each_bit)
                if bit_value == 1 and ALARM[each_bit] != None:
                    alarm.append(ALARM[each_bit])

            if len(alarm) != 0:
                data['alarm'] = ', '.join(alarm)
            else:
                data['alarm'] = None

            # Measurements
            data['load'] = raw_data['load']
            data['total_load'] = raw_data['total_load']
            data['battery_capacity'] = raw_data['battery_capacity']
            data['aux_mains_star_voltage'] = raw_data['aux_mains_star_voltage']
            data['output_star_voltage'] = raw_data['output_star_voltage']
            data['output_current'] = raw_data['output_current']
            data['aux_frequency'] = raw_data['aux_frequency']
            data['output_frequency'] = raw_data['output_frequency']
            data['positive_battery_voltage'] = raw_data['positive_battery_voltage']
            data['internal_ups_temperature'] = raw_data['internal_ups_temperature']
            if raw_data['remaining_backup_time'] == 0xFFFF:
                data['remaining_backup_time'] = None
            else:
                data['remaining_backup_time'] = raw_data['remaining_backup_time']
            data['input_mains_star_voltage'] = raw_data['input_mains_star_voltage']

            return data
        else:
            return -1

class Socomec_MASTERYS(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU" or self.protocol == "Modbus TCP":
            data = {}

            # Status
            STATUS = ['Input Mains present (Mains OK)', 'Inverter ON', 'Rectifier ON',
                      'Load on Inverter (normal mode)', 'Load on Mains/Load on Bypass', 'Load on Battery/Batery Discharging (UPS in backup mode)',
                      'No remote command permission', 'Eco Mode ON', 'UPS in Stand-by mode', 'Buzzer ON', 'Battery Test in progress',
                      'Battery Test programmed', 'Battery Test on stand-by', 'Battery Test supported (test possible)',
                      'Battery test failed (not concluded, ...)',
                      'Battery near end of Back-up (Low Battery)', 'Battery discharged', ['Battery not OK', 'Battery OK'],
                      None, None, None, None, None, 'Inverter synchronised with Mains', 'Boost ON', None,
                      'Auxiliary mains OK', 'Battery charger ON', 'Auxiliary input frequency out of tolerance',
                      ['No scheduling permission', 'scheduling permitted'], 'UPS on parallel system', 'Battery extension present',
                      'Module 1 in parallel present', 'Module 2 in parallel present', 'Module 3 in parallel present',
                      'Module 4 in parallel present', 'Module 5 in parallel present', 'Module 6 in parallel present',
                      'External state 1', 'External state 2', 'External state 3', 'External state 4',
                      None, 'Power share capability available', None, 'Automatic E-service report', 'Operating on generator set',
                      None, 'Maintenance mode active', 'Firstmaintenance period']

            status = []
            for each_bit in range(32):
                bit_value = readbitval(raw_data['status'], each_bit)
                if type(STATUS[each_bit]) == list:
                    status.append(STATUS[each_bit][bit_value])
                else:
                    if bit_value == 1 and STATUS[each_bit] != None:
                        status.append(STATUS[each_bit])

            if len(status) != 0:
                data['status'] = ', '.join(status)
            else:
                data['status'] = None

            # Alarm
            ALARM = [None, 'Battery Failure/Battery fuse open', 'UPS overload',
                     'Output voltage out of tolerance', 'Digital power supply fault (Vcc)',
                     'Input voltage out of tolerance', 'Auxiliary mains out of tolerance',
                     'Internal over-temperature alarm', 'Manual Bypass closed', None, 'Battery charger failure', None, None,
                     'Precharge voltage out of tolerance', 'BOOST output voltage too low',
                     'BOOST output voltage too high', 'Battery voltage too high', None, 'Overload timeout blocking inverter',
                     None, 'Configuration data map corrupted', 'PLL Fault', 'Input mains general alarm',
                     'Rectifier general alarm', None, 'Inverter general alarm', 'Battery charger general alarm',
                     'Output voltage over limits', None, None, 'UPS stopped for overload','Imminent Stop',
                     'Module 1 in parallel general alarm', 'Module 2 in parallel general alarm', 'Module 3 in parallel general alarm',
                     'Module 2 in parallel general alarm', 'Module 4 in parallel general alarm', 'Module 6 in parallel general alarm',
                     'External Alarm 1', 'External Alarm 2', 'External Alarm 3', 'External Alarm 4',
                     'REMOTE SERVICE ALARM', 'Redundancy Lost', 'Maintenance alarm', None, None, None, None,
                     'Battery discharged', 'Insufficient resources', 'Option board general alarm', 'Rectifier fault', None,
                     'Inverter fault', 'Parallel fault', 'Generator set general alarm', 'Generator set fault', 'Emergency STOP',
                     'Battery circuit open', 'Fan failure', 'Phase detection fault']

            alarm = []
            for each_bit in range(32):
                bit_value = readbitval(raw_data['alarm'], each_bit)
                if bit_value == 1 and ALARM[each_bit] != None:
                    alarm.append(ALARM[each_bit])

            if len(alarm) != 0:
                data['alarm'] = ', '.join(alarm)
            else:
                data['alarm'] = None

            # Measurements
            data['load_1'] = raw_data['load_1']
            data['load_2'] = raw_data['load_2']
            data['load_3'] = raw_data['load_3']
            data['total_load'] = raw_data['total_load']
            data['battery_capacity_percent'] = raw_data['battery_capacity_percent']
            data['battery_capacity_ah'] = raw_data['battery_capacity_ah']
            data['aux_mains_star_voltage_1'] = raw_data['aux_mains_star_voltage_1']
            data['aux_mains_star_voltage_2'] = raw_data['aux_mains_star_voltage_2']
            data['aux_mains_star_voltage_3'] = raw_data['aux_mains_star_voltage_3']
            data['output_star_voltage_1'] = raw_data['output_star_voltage_1']
            data['output_star_voltage_2'] = raw_data['output_star_voltage_2']
            data['output_star_voltage_3'] = raw_data['output_star_voltage_3']
            data['input_current_1'] = raw_data['input_current_1']
            data['input_current_2'] = raw_data['input_current_2']
            data['input_current_3'] = raw_data['input_current_3']
            data['output_current_1'] = raw_data['output_current_1']
            data['output_current_2'] = raw_data['output_current_2']
            data['output_current_3'] = raw_data['output_current_3']
            data['aux_frequency'] = raw_data['aux_frequency']
            data['output_frequency'] = raw_data['output_frequency']
            data['positive_battery_voltage'] = raw_data['positive_battery_voltage']
            data['negative_battery_voltage'] = raw_data['negative_battery_voltage']
            data['internal_ups_temperature'] = raw_data['internal_ups_temperature']
            data['remaining_backup_time'] = raw_data['remaining_backup_time']
            data['battery_current'] = raw_data['battery_current']
            data['inverter_current_1'] = raw_data['inverter_current_1']
            data['inverter_current_2'] = raw_data['inverter_current_2']
            data['inverter_current_3'] = raw_data['inverter_current_3']
            data['positive_rectifier_voltage'] = raw_data['positive_rectifier_voltage']
            data['negative_rectifier_voltage'] = raw_data['negative_rectifier_voltage']
            data['input_mains_star_voltage_1'] = raw_data['input_mains_star_voltage_1']
            data['input_mains_star_voltage_2'] = raw_data['input_mains_star_voltage_2']
            data['input_mains_star_voltage_3'] = raw_data['input_mains_star_voltage_3']
            data['output_active_power'] = raw_data['output_active_power']
            data['output_power_1'] = raw_data['output_power_1']
            data['output_power_2'] = raw_data['output_power_2']
            data['output_power_3'] = raw_data['output_power_3']
            data['input_power_1'] = raw_data['input_power_1']
            data['input_power_2'] = raw_data['input_power_2']
            data['input_power_3'] = raw_data['input_power_3']
            data['input_mains_frequency'] = raw_data['input_mains_frequency']

            return data
        else:
            return -1

class Kehua_KR3000RM(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "SNMP":
            data = {}

            SRC = ["", "Other", "None", "Normal", "Bypass", "Battery", "Booster", "Reducer"]
            ALARM_INPUT = ["", "No Transfer", "High Line Voltage", "Brownout", "Blackout", 
                            "Small Momentary Sag", "Deep Momentary Sag", "Small Momentary Spike",
                            "Large Momentary Spike"
                            ]
            STATUS_OUTPUT = ["", "Unknown", "On Line", "On Battery", "On Boost", "Sleeping", "On Bypass", "Rebooting", "Standby", "On Buck"]
            YN = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "Yes", "", "No"]
            STATUS_BATTERY = ["", "Unknown", "Battery Normal", "Battery Low Voltage", "Battery Depleted"]

            raw_data["Device_Manufacture"] = "KEHUA"
            raw_data["Device_Model"] = "KR3000RM"
            raw_data["Output_Source"] = SRC[raw_data["Output_Source"]]
            raw_data["Output_Status"] = STATUS_OUTPUT[raw_data["Output_Status"]]
            raw_data["Input_Status"] = ALARM_INPUT[raw_data["Input_Status"]]
            raw_data["Battery_Status"] = STATUS_BATTERY[raw_data["Battery_Status"]]
            raw_data["Output_Overload"] = YN[raw_data["Output_Overload"]]
            raw_data["Baypass_Abnormal_Status"] = YN[raw_data["Baypass_Abnormal_Status"]]


            data = raw_data
            return data
        else:
            return -1

####################################### BATTERY #######################################
class Panasonic_DCB105ZK(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            # Battery Status
            STATUS = [None, None, None, None, 'Charging', 'ID Fixed', None, 'Battery Installed',
                      'Fully Charged', 'Fully Discharged', 'Charge Warning',
                      'Discharge Warning', 'Terminate Charge Alarm', 'Terminate Discharge Alarm',
                      None, 'Permanent Failure']
            status = []
            for each_bit in range(16):
                bit_value = readbitval(raw_data['status'], each_bit)
                if bit_value == 1 and STATUS[each_bit] != None:
                    status.append(STATUS[each_bit])

            if len(status) != 0:
                data['status'] = ', '.join(status)
            else:
                data['status'] = None

            # Battery Warning
            WARNING = ['Over cell voltage', 'Remaining Capacity Alarm', 'Under Voltage Warning',
                       'Cell Imbalance Warning', 'Over Charge CUrrent Warning', None,
                       'Over Discharge Current Warning', None, 'Over Cell Temperature Warning for Charge',
                       'Under Cell Temperature Warning for Charge', 'Over Cell Temperature Warning for Discharge',
                       'Under Cell Temperature Warning for Discharge', 'FET Overheat Warning',
                       'PCB Overheat Warning', None, None]
            warning = []
            for each_bit in range(16):
                bit_value = readbitval(raw_data['warning'], each_bit)
                if bit_value == 1 and WARNING[each_bit] != None:
                    warning.append(WARNING[each_bit])
            if len(warning) != 0:
                data['warning'] = ', '.join(warning)
            else:
                data['warning'] = None

            # Battery Alarm
            ALARM = ['Over Cell Voltage Protection', 'Over Total Voltage Protection',
                     'Under Voltage Protection', 'Discharge Cut Off Protection',
                     'Over Charge Current Sw Protection', None, 'Over Discharge Current Sw Protection',
                     'Over Discharge Current Hw Protection', 'Over Cell Temperature Protection for Charge',
                     'Under Cell Temperature Protection For Charge', 'Over Cell Temperature Protection for Discharge',
                     'Under Cell Temperature Protection for Discharge', 'FET Overheat Protection', 'PCB Overheat Protection',
                     None, None]
            alarm = []
            for each_bit in range(16):
                bit_value = readbitval(raw_data['alarm'], each_bit)
                if bit_value == 1 and ALARM[each_bit] != None:
                    alarm.append(ALARM[each_bit])
            if len(alarm) != 0:
                data['alarm'] = ', '.join(alarm)
            else:
                data['alarm'] = None

            # Battery Error
            ERROR = ['Over Voltage Error SW', 'Over VOltage Error HW', 'Low Voltage Error',
                     'Cell Imbalance Error', 'Charge Imbalance Error', 'Charge FET Error',
                     'Discharge FET Error','Current Fuse Error', 'SCP Error', 'Cell Overheat Error',
                     None, 'Thermistor Error', 'AFE Communication Error', 'Calibration Data Error',
                     'Firmware Checksum Error', 'PCB System Error', 'Cell Permanent Failure']
            error = []
            for each_bit in range(16):
                bit_value = readbitval(raw_data['error'], each_bit)
                if bit_value == 1 and ERROR[each_bit] != None:
                    error.append(ERROR[each_bit])
            if len(error) != 0:
                data['error'] = ', '.join(error)
            else:
                data['error'] = None

            # Others
            data['serial_number'] = raw_data['serial_number']
            data['barcode'] = raw_data['barcode']
            data['voltage'] = raw_data['voltage']
            data['current'] = raw_data['current']
            data['dc'] = raw_data['dc']
            data['fcc'] = raw_data['fcc']
            data['rc'] = raw_data['rc']
            data['soc'] = raw_data['soc']
            data['soh'] = raw_data['soh']
            data['cycle_count'] = raw_data['cycle_count']
            data['cell_1_voltage'] = raw_data['cell_1_voltage']
            data['cell_2_voltage'] = raw_data['cell_2_voltage']
            data['cell_3_voltage'] = raw_data['cell_3_voltage']
            data['cell_4_voltage'] = raw_data['cell_4_voltage']
            data['cell_5_voltage'] = raw_data['cell_5_voltage']
            data['cell_6_voltage'] = raw_data['cell_6_voltage']
            data['cell_7_voltage'] = raw_data['cell_7_voltage']
            data['cell_8_voltage'] = raw_data['cell_8_voltage']
            data['cell_9_voltage'] = raw_data['cell_9_voltage']
            data['cell_10_voltage'] = raw_data['cell_10_voltage']
            data['cell_11_voltage'] = raw_data['cell_11_voltage']
            data['cell_12_voltage'] = raw_data['cell_12_voltage']
            data['cell_13_voltage'] = raw_data['cell_13_voltage']

            return data
        else:
            return -1

class Pilot_PBAT600(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = dict(raw_data)

            # String Status
            STRING_STATUS = ["Floating Charge", "Equalizing Charge", "Discharge",
                      "Standing", "Abnormal"]

            data['string_status'] = STRING_STATUS[raw_data["string_status"]]

            # String Alarm
            STRING_ALARM = ["String overcurrent", "String undercurrent", "String overvoltage",
                            "String undervoltage", "String Low SOC", "String Low SOH", "Hall Sensor Disconnected"]
            string_alarm = []
            for each_bit in range(16):
                bit_value = readbitval(raw_data['string_alarm'], each_bit)
                if bit_value == 1 and STRING_ALARM[each_bit] != None:
                    string_alarm.append(STRING_ALARM[each_bit])

            if len(string_alarm) != 0:
                data['string_alarm'] = ', '.join(string_alarm)
            else:
                data['string_alarm'] = ""

            # Filter only available cells
            cell_quantity = data["string_cell_quantity"]
            for i in range(cell_quantity, 240):
                try:
                    del data["cell_%d_voltage" % (i + 1)]
                    del data["cell_%d_ohmic" % (i + 1)]
                    del data["cell_%d_soh" % (i + 1)]
                    del data["cell_%d_soc" % (i + 1)]
                    del data["cell_%d_temperature" % (i + 1)]
                    del data["cell_%d_alarm" % (i + 1)]
                    del data["cell_%d_serial_number" % (i + 1)]
                except:
                    pass

            # Cell Alarm
            CELL_ALARM = ["Cell Overvoltage", "Cell Undervoltage", "High Internal Resistance",
                            "Cell Low SOC", "Cell Low SOH", "Cell High Temperature"]

            for i in range(cell_quantity):
                cell_alarm = []
                for each_bit in range(16):
                    bit_value = readbitval(raw_data['cell_%d_alarm'%(i+1)], each_bit)
                    if bit_value == 1 and CELL_ALARM[each_bit] != None:
                        cell_alarm.append(CELL_ALARM[each_bit])
                if len(cell_alarm) != 0:
                    data['cell_%d_alarm' %(i+1)] = ', '.join(string_alarm)
                else:
                    data['cell_%d_alarm' %(i+1)] = ""

            return data
        else:
            return -1

####################################### POWERMETER #######################################
class Pilot_SPM33(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            data = dict(raw_data)
            return data
        else:
            return -1

class Pilot_SPM91(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            data = dict(raw_data)
            return data
        else:
            return -1

class Pilot_SPM20(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}
            data = dict(raw_data)

            #pp.pprint(raw_data)
            return data
        else:
            return -1

class Schneider_PM1200(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            data = dict(raw_data)
            return data
        else:
            return -1

class Schneider_PM2200(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            data = dict(raw_data)
            return data
        else:
            return -1

class ABB_M4M30(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            #Power
            try:
                buff = (raw_data['P_1_1'] << 16) + raw_data['P_1_2']
                if buff & 0xf0000000:
                    buff = buff - 0xffffffff
                data['P_1'] = buff * 0.01
            except:
                pass

            try:
                buff = (raw_data['P_2_1'] << 16) + raw_data['P_2_2']
                if buff & 0xf0000000:
                    buff = buff - 0xffffffff
                data['P_2'] = buff * 0.01
            except:
                pass

            try:
                buff = (raw_data['P_3_1'] << 16) + raw_data['P_3_2']
                if buff & 0xf0000000:
                    buff = buff - 0xffffffff
                data['P_3'] = buff * 0.01
            except:
                pass

            try:
                data['P_TOT'] = data['P_1'] + data['P_2'] + data['P_3']  
            except:
                pass

            try:
                buff = (raw_data['Q_1_1'] << 16) + raw_data['Q_1_2']
                if buff & 0xf0000000:
                    buff = buff - 0xffffffff
                data['Q_1'] = buff * 0.01
            except:
                pass

            try:
                buff = (raw_data['Q_2_1'] << 16) + raw_data['Q_2_2']
                if buff & 0xf0000000:
                    buff = buff - 0xffffffff
                data['Q_2'] = buff * 0.01
            except:
                pass

            try:
                buff = (raw_data['Q_3_1'] << 16) + raw_data['Q_3_2']
                if buff & 0xf0000000:
                    buff = buff - 0xffffffff
                data['Q_3'] = buff * 0.01
            except:
                pass

            try:
                data['Q_TOT'] = data['Q_1'] + data['Q_2'] + data['Q_3']  
            except:
                pass

            try:
                data['S_1'] = raw_data['V_1'] * raw_data['I_1']
            except:
                pass

            try:
                data['S_2'] = raw_data['V_2'] * raw_data['I_3']
            except:
                pass

            try:
                data['S_3'] = raw_data['V_3'] * raw_data['I_3']
            except:
                pass

            try:
                data['S_TOT'] = data['S_1'] + data['S_2'] + data['S_3']  
            except:
                pass

            #Energy
            try:
                buff = (raw_data['EPTI1'] << 16) + raw_data['EPTI2']
                data['E_ACT_TOT_IMPORT'] = buff * 0.01
            except:
                pass

            try:
                buff = (raw_data['EPTE1'] << 16) + raw_data['EPTE2']
                data['E_ACT_TOT_EXPORT'] = buff * 0.01
            except:
                pass

            try:
                data['E_ACT_TOT_NET'] = data['E_ACT_TOT_IMPORT'] - data['E_ACT_TOT_EXPORT']  
            except:
                pass

            try:
                buff = (raw_data['EQTI1'] << 16) + raw_data['EQTI2']
                data['E_REACT_TOT_IMPORT'] = buff * 0.01
            except:
                pass

            try:
                buff = (raw_data['EQTE1'] << 16) + raw_data['EQTE2']
                data['E_REACT_TOT_EXPORT'] = buff * 0.01
            except:
                pass

            try:
                data['E_REACT_TOT_NET'] = data['E_REACT_TOT_IMPORT'] - data['E_REACT_TOT_EXPORT']  
            except:
                pass

            try:
                buff = (raw_data['ESTI1'] << 16) + raw_data['ESTI2']
                data['E_APP_TOT_IMPORT'] = buff * 0.01
            except:
                pass

            try:
                buff = (raw_data['ESTE1'] << 16) + raw_data['ESTE2']
                data['E_APP_TOT_EXPORT'] = buff * 0.01
            except:
                pass

            try:
                data['E_APP_TOT_NET'] = data['E_APP_TOT_IMPORT'] - data['E_APP_TOT_EXPORT']  
            except:
                pass

            try: 
                data['V_SYS'] = raw_data['V_SYS']
                data['V_1'] = raw_data['V_1']
                data['V_2'] = raw_data['V_2']
                data['V_3'] = raw_data['V_3']
            except:
                pass

            try:
                data['V_12'] = raw_data['V_12']
                data['V_23'] = raw_data['V_23']
                data['V_31'] = raw_data['V_31']
            except: 
                pass

            try: 
                data['I_N'] = raw_data['I_N']
                data['I_1'] = raw_data['I_1']
                data['I_2'] = raw_data['I_2']
                data['I_3'] = raw_data['I_3']
                data['I_SYS'] = raw_data['I_SYS']
            except:
                pass

            try: 
                data['PF_TOT'] = raw_data['PF_TOT']
                data['PF_1'] = raw_data['PF_1']
                data['PF_2'] = raw_data['PF_2']
                data['PF_3'] = raw_data['PF_3']
            except:
                pass

            try: 
                data['COSPHI_TOT'] = raw_data['COSPHI_TOT']
                data['COSPHI_1'] = raw_data['COSPHI_1']
                data['COSPHI_2'] = raw_data['COSPHI_2']
                data['COSPHI_3'] = raw_data['COSPHI_3']
            except:
                pass

            try: 
                data['FREQ'] = raw_data['FREQ']
                data['UNB_VLL'] = raw_data['UNB_VLL']
                data['UNB_VLN'] = raw_data['UNB_VLN']
                data['UNB_I'] = raw_data['UNB_I']
            except:
                pass

            try: 
                data['VTHD_1'] = raw_data['VTHD_1']
                data['VTHD_2'] = raw_data['VTHD_2']
                data['VTHD_3'] = raw_data['VTHD_3']
            except:
                pass

            try: 
                data['VTHD_12'] = raw_data['VTHD_12']
                data['VTHD_23'] = raw_data['VTHD_23']
                data['VTHD_31'] = raw_data['VTHD_31']
            except:
                pass

            try: 
                data['ITHD_1'] = raw_data['ITHD_1']
                data['ITHD_2'] = raw_data['ITHD_2']
                data['ITHD_3'] = raw_data['ITHD_3']
                data['ITHD_N'] = raw_data['ITHD_N']
            except:
                pass

            print(data)
            return data
        else:
            return -1

####################################### SWITCH #######################################

class ABB_ATS022(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}
            
            #Status
            LINE_STATUS = ['Voltage OK','No Voltage','Undervoltage',
                           'Overvoltage','Phase Missing','Phase Unbalance',
                           'Invalid Phase Order','Frequency Out of Range']
            SWITCH_STATUS = ['Sequence not required','Sequence in progress','Sequence completed',
                             'Sequence rev in progress','Sequence failed','INVALID',
                             'INVALID','INVALID']
            GEN_STATUS = ['Stopped', 'Started']
            
            statval = raw_data['status']
            data['ln1_status'] = LINE_STATUS[(statval & 0x7)]
            data['ln2_status'] = LINE_STATUS[(statval & 0x38) >> 3]
            data['switch_status'] = SWITCH_STATUS[(statval & 0x1c0) >> 6]
            data['gen_status'] = GEN_STATUS[(statval & 0x200) >> 9]

            #Alarm
            alarmval = raw_data['alarm']
            data['cb1_open_fail'] = alarmval & 0b1
            data['cb2_open_fail'] = (alarmval & 0b10)>>1
            data['cb3_open_fail'] = (alarmval & 0b100)>>2
            data['cb1_close_fail'] = (alarmval & 0b1000)>>3
            data['cb2_close_fail'] = (alarmval & 0b10000)>>4
            data['cb3_close_fail'] = (alarmval & 0b100000)>>5
            data['cb1_extracted'] = (alarmval & 0b1000000)>>6
            data['cb2_extracted'] = (alarmval & 0b10000000)>>7
            data['logiclock'] = (alarmval & 0b100000000)>>8
            data['extfault'] = (alarmval & 0b1000000000)>>9
            data['cb1_trip'] = (alarmval & 0b10000000000)>>10
            data['cb2_trip'] = (alarmval & 0b100000000000)>>11
            data['gen_alarm'] = (alarmval & 0b1000000000000)>>12
            
            data['LN1_V1_voltage'] = raw_data['LN1_V1_voltage']
            data['LN1_V2_voltage'] = raw_data['LN1_V2_voltage']
            data['LN1_V3_voltage'] = raw_data['LN1_V3_voltage']
            data['LN2_V1_voltage'] = raw_data['LN2_V1_voltage']
            data['LN2_V2_voltage'] = raw_data['LN2_V2_voltage']
            data['LN2_V3_voltage'] = raw_data['LN2_V3_voltage']
            data['LN1_V12_voltage'] = raw_data['LN1_V12_voltage']
            data['LN1_V23_voltage'] = raw_data['LN1_V23_voltage']
            data['LN1_V31_voltage'] = raw_data['LN1_V31_voltage']
            data['LN2_V12_voltage'] = raw_data['LN2_V12_voltage']
            data['LN2_V23_voltage'] = raw_data['LN2_V23_voltage']
            data['LN2_V31_voltage'] = raw_data['LN2_V31_voltage']
            data['LN1_freq'] = raw_data['LN1_freq']
            data['LN2_freq'] = raw_data['LN2_freq']
            
            return data
        else:
            return -1

####################################### MISC #######################################
class GPIO_Doorswitch(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "GPIO":
            data = {}

            # STATUS
            STATUS = ['Open', 'Closed']
            
            # Measurements
            raw_data['status'] = STATUS[raw_data['status']]
            data = raw_data
            
            return data
        else:
            return -1





