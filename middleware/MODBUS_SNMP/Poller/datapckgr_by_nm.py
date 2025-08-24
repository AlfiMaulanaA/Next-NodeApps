
# CLASS NAME LIST
"""""
NAME_LIST = ["String1", "AC1", "AC2", "AC3", "PDU1", "PDU2", "PDU3", "UPS1", "DOORSWITCH", 
             "PDU_TL_MNH", "PDU_TL_MNV", "PDU_APC", "AC_TL_SRX", "UPS_KEHUA", "AC_LT1_SPM33", "LIGHTING_LT1_SPM33", 
             "OUTLET_LT1_SPM33", "AC_LT1_SPM20", "LIGHTING_LT1_SPM20", "OUTLET_LT1_SPM20", "AC_LT2_SPM33", "LIGHTING_LT2_SPM33", 
             "OUTLET_LT2_SPM33", "AC_LT2_SPM20", "LIGHTING_LT2_SPM20", "OUTLET_LT2_SPM20", "AC_LT3_SPM33", "LIGHTING_LT3_SPM33", 
             "OUTLET_LT3_SPM33", "AC_LT3_SPM20", "LIGHTING_LT3_SPM20", "OUTLET_LT3_SPM20",
             "AC_ENV_EIA", "AC_ENV_EF", "CAN_SENSOR", "PowerMeter1_LT2", "PowerMeter2","PowerMeter3","PowerMeter4","PowerMeter5", "PowerMeter6"]
"""
NAME_LIST = []

# General Device Class
class Device(object):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        
        new_data = {}
        new_data["data"] = dict(raw_data)
        data.append(new_data)
        

        return data

    def write(self):
        pass

# String 1
class String1(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

class PDU_TL_MNV(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        print("pdu panjang")
        new_data = {}
        new_data["username"] = "Gw8fruFXYBQDietoP5kW"
        new_data["password"] = None
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

class PDU_TL_MNH(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        print("PDU kotak")
        new_data = {}
        new_data["username"] = "PxR2JpPCJhKLxSAj4Kto"
        new_data["password"] = None
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

class PDU_APC(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        print("pdu panjang yg lain")
        new_data = {}
        new_data["username"] = "kUOCCieLsxXvvOvTFNva"
        new_data["password"] = None
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

class AC_TL_SRX(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        print("ac tripplite")
        new_data = {}
        new_data["username"] = "wWi4grDwUguYGYUldkzE"
        new_data["password"] = None
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

class UPS_KEHUA(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        print("ups kehua")
        new_data = {}
        new_data["username"] = "hQPbkjzIQeBfr2RlX8Z5"
        new_data["password"] = None
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

class AC_ENV_EIA(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        print("envicool 1")
        new_data = {}
        new_data["username"] = "OH6DmEvqwh5dSmBjPFfW"
        new_data["password"] = None
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

class AC_ENV_EF(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        print("envicool 2")
        new_data = {}
        new_data["username"] = "6IfvUQHgTMMfbcJXJ4hu"
        new_data["password"] = None
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

####################################### SMARTRACK #######################################

class PDU1(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        intermediate = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        for item in raw_data:
            if item == "PollingDuration" or item == "Timestamp":
                intermediate[item] = raw_data[item]
            else:
                intermediate["PDU1_" + item] = raw_data[item]
        new_data["data"] = dict(intermediate)
        data.append(new_data)
        print(data)

        return data

    def write(self):
        pass

class PDU2(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        intermediate = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        for item in raw_data:
            if item == "PollingDuration" or item == "Timestamp":
                intermediate[item] = raw_data[item]
            else:
                intermediate["PDU2_" + item] = raw_data[item]
        new_data["data"] = dict(intermediate)
        data.append(new_data)
        print(data)

        return data

    def write(self):
        pass

class PDU3(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        intermediate = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        for item in raw_data:
            if item == "PollingDuration" or item == "Timestamp":
                intermediate[item] = raw_data[item]
            else:
                intermediate["PDU3_" + item] = raw_data[item]
        new_data["data"] = dict(intermediate)
        data.append(new_data)
        print(data)

        return data

    def write(self):
        pass

class AC1(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        intermediate = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        for item in raw_data:
            if item == "PollingDuration" or item == "Timestamp":
                intermediate[item] = raw_data[item]
            else:
                intermediate["AC1_" + item] = raw_data[item]
        new_data["data"] = dict(intermediate)
        data.append(new_data)
        print(data)

        return data

    def write(self):
        pass

class AC2(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        intermediate = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        for item in raw_data:
            if item == "PollingDuration" or item == "Timestamp":
                intermediate[item] = raw_data[item]
            else:
                intermediate["AC2_" + item] = raw_data[item]
        new_data["data"] = dict(intermediate)
        data.append(new_data)
        print(data)

        return data

    def write(self):
        pass

class AC3(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        intermediate = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        for item in raw_data:
            if item == "PollingDuration" or item == "Timestamp":
                intermediate[item] = raw_data[item]
            else:
                intermediate["AC3_" + item] = raw_data[item]
        new_data["data"] = dict(intermediate)
        data.append(new_data)
        print(data)

        return data

    def write(self):
        pass

class UPS1(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        intermediate = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        for item in raw_data:
            if item == "PollingDuration" or item == "Timestamp":
                intermediate[item] = raw_data[item]
            else:
                intermediate["UPS1_" + item] = raw_data[item]
        new_data["data"] = dict(intermediate)
        data.append(new_data)
        print(data)

        return data

    def write(self):
        pass

class DOORSWITCH(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []

        new_data = {}
        intermediate = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        for item in raw_data:
            if item == "PollingDuration" or item == "Timestamp":
                intermediate[item] = raw_data[item]
            else:
                intermediate["DOOR_" + item] = raw_data[item]
        new_data["data"] = dict(intermediate)
        data.append(new_data)
        print(data)

        return data

    def write(self):
        pass

####################################### CAN SENSOR #######################################
class CAN_SENSOR(Device):
    def __init__(self):
        pass

    def process_raw_data(self, raw_data):
        data = []
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = dict(raw_data)
        data.append(new_data)

        return data

    def write(self):
        pass

####################################### LANTAI 1 #######################################
### SPM33
class AC_LT1_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []
        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] =  {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        
        }
        data.append(new_data)
        print()
        return data

class LIGHTING_LT1_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        }
        data.append(new_data)

        return data

class OUTLET_LT1_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        }
        data.append(new_data)

        return data

### SPM20
class AC_LT1_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []

        ### ALL AC
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "ac_1_power_table_staff_2" : raw_data["Branch1_S"] if "Branch1_S" in raw_data else None,  # meja 2
            "ac_1_energy_table_staff_2" :raw_data["Branch1_E_Active"] if "Branch1_E_Active" in raw_data else None,  # meja 2
            "ac_1_current_table_staff_2" :raw_data["Branch1_Current"] if "Branch1_Current" in raw_data else None,  # meja 2
            "ac_2_power_table_staff_1": raw_data["Branch19_S"] if "Branch19_S" in raw_data else None, # meja 1
            "ac_2_energy_table_staff_1": raw_data["Branch19_E_Active"] if "Branch19_E_Active" in raw_data else None,  # meja 1
            "ac_2_current_table_staff_1" :raw_data["Branch19_Current"] if "Branch19_Current" in raw_data else None,  # meja 1
            
            "ac_1_power_small_meeting": raw_data["Branch4_S"] if "Branch4_S" in raw_data else None,
            "ac_1_energy_small_meeting": raw_data["Branch4_E_Active"] if "Branch4_E_Active" in raw_data else None,
            "ac_2_current_small_meeting" :raw_data["Branch4_Current"] if "Branch4_Current" in raw_data else None,  

            "ac_1_power_Receptionist": raw_data["Branch5_S"] if "Branch5_S" in raw_data else None,
            "ac_1_energy_Receptionist": raw_data["Branch5_E_Active"] if "Branch5_E_Active" in raw_data else None,
            "ac_1_current_Receptionist" :raw_data["Branch5_Current"] if "Branch5_Current" in raw_data else None,  

            "ac_1_power_Workshop_1": raw_data["Branch7_S"] if "Branch7_S" in raw_data else None,
            "ac_1_energy_Workshop_1": raw_data["Branch7_E_Active"] if "Branch7_E_Active" in raw_data else None,
            "ac_1_current_Workshop_1" :raw_data["Branch7_Current"] if "Branch7_Current" in raw_data else None,  

            "ac_1_power_Pantry": raw_data["Branch9_S"] if "Branch9_S" in raw_data else None,
            "ac_1_energy_Pantry": raw_data["Branch9_E_Active"] if "Branch9_E_Active" in raw_data else None,
            "ac_1_current_Pantry" :raw_data["Branch9_Current"] if "Branch9_Current" in raw_data else None, 

            "ac_1_power_director_1": raw_data["Branch11_S"] if "Branch11_S" in raw_data else None,
            "ac_1_energy_director_1": raw_data["Branch11_E_Active"] if "Branch11_E_Active" in raw_data else None,
            "ac_1_current_director_1" :raw_data["Branch11_Current"] if "Branch11_Current" in raw_data else None, 

            "ac_1_power_Workshop_2": raw_data["Branch13_S"] if "Branch13_S" in raw_data else None,
            "ac_1_energy_Workshop_2": raw_data["Branch13_E_Active"] if "Branch13_E_Active" in raw_data else None,
            "ac_1_current_Workshop_2" :raw_data["Branch13_Current"] if "Branch13_Current" in raw_data else None,  

            "ac_1_power_big_Meeting": raw_data["Branch15_S"] if "Branch15_S" in raw_data else None,
            "ac_1_energy_big_Meeting": raw_data["Branch15_E_Active"] if "Branch15_E_Active" in raw_data else None,
            "ac_1_current_big_Meeting" :raw_data["Branch15_Current"] if "Branch15_Current" in raw_data else None, 

            "ac_1_power_director_2": raw_data["Branch17_S"] if "Branch17_S" in raw_data else None,
            "ac_1_energy_director_2": raw_data["Branch17_E_Active"] if "Branch17_E_Active" in raw_data else None,
            "ac_1_current_director_2" :raw_data["Branch17_Current"] if "Branch17_Current" in raw_data else None,  

            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,
            

        }
        new_data["data"]["total_ac_power_table_staff"] = new_data["data"]["ac_1_power_table_staff_2"] + new_data["data"]["ac_2_power_table_staff_1"]
        new_data["data"]["total_ac_energy_table_staff"] = new_data["data"]["ac_1_energy_table_staff_2"] + new_data["data"]["ac_2_power_table_staff_1"]

        new_data["data"]["total_ac_power_small_meeting"] = new_data["data"]["ac_1_power_small_meeting"]
        new_data["data"]["total_ac_energy_small_meeting"] = new_data["data"]["ac_1_energy_small_meeting"]

        new_data["data"]["total_ac_power_Receptionist"] = new_data["data"]["ac_1_power_Receptionist"]
        new_data["data"]["total_ac_energy_Receptionist"] = new_data["data"]["ac_1_energy_Receptionist"]

        new_data["data"]["total_ac_power_Workshop_1"] = new_data["data"]["ac_1_power_Workshop_1"]
        new_data["data"]["total_ac_energy_Workshop_1"] = new_data["data"]["ac_1_energy_Workshop_1"]

        new_data["data"]["total_ac_power_Pantry"] = new_data["data"]["ac_1_power_Pantry"]
        new_data["data"]["total_ac_energy_Pantry"] = new_data["data"]["ac_1_energy_Pantry"]

        new_data["data"]["total_ac_power_director_1"] = new_data["data"]["ac_1_power_director_1"]
        new_data["data"]["total_ac_energy_director_1"] = new_data["data"]["ac_1_energy_director_1"]

        new_data["data"]["total_ac_power_Workshop_2"] = new_data["data"]["ac_1_power_Workshop_2"]
        new_data["data"]["total_ac_energy_Workshop_2"] = new_data["data"]["ac_1_energy_Workshop_2"]

        new_data["data"]["total_ac_power_big_Meeting"] = new_data["data"]["ac_1_power_big_Meeting"]
        new_data["data"]["total_ac_energy_big_Meeting"] = new_data["data"]["ac_1_energy_big_Meeting"]

        new_data["data"]["total_ac_power_director_2"] = new_data["data"]["ac_1_power_director_2"]
        new_data["data"]["total_ac_energy_director_2"] = new_data["data"]["ac_1_energy_director_2"]

        data.append(new_data)

        return data

class LIGHTING_LT1_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []
        Mark = ["_Workshop_1","_Workshop_2","_Director_1", "_Corridor", "_Director_2", "_Bathroom", "_Toilet", "_Pantry", "_Receptionist"]

        ### Workshop 1
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "ll_1_power" + Mark[0]: raw_data["Branch1_S"]/2 if "Branch1_S" in raw_data else None,
            "ll_1_energy" + Mark[0]: raw_data["Branch1_E_Active"]/2 if "Branch1_E_Active" in raw_data else None,
            "ll_1_current" + Mark[0]: raw_data["Branch1_Current"]/2 if "Branch1_Current" in raw_data else None,

            "ll_1_power" + Mark[1]: raw_data["Branch1_S"] / 2 if "Branch1_S" in raw_data else None,
            "ll_1_energy"+ Mark[1]: raw_data["Branch1_E_Active"] / 2 if "Branch1_E_Active" in raw_data else None,
            "ll_1_current" + Mark[1]: raw_data["Branch1_Current"]/2 if "Branch1_Current" in raw_data else None,

            "ll_1_power" + Mark[2]: raw_data["Branch2_S"] if "Branch2_S" in raw_data else None,
            "ll_1_energy"+ Mark[2]: raw_data["Branch2_E_Active"] if "Branch2_E_Active" in raw_data else None,
            "ll_1_current" + Mark[2]: raw_data["Branch2_Current"]/2 if "Branch2_Current" in raw_data else None,

            "ll_1_power" + Mark[3]: raw_data["Branch4_S"] if "Branch4_S" in raw_data else None, # lorong arah ke lobby
            "ll_1_energy"+ Mark[3]: raw_data["Branch4_E_Active"] if "Branch4_E_Active" in raw_data else None, # lorong arah ke lobby
            "ll_1_current" + Mark[3]: raw_data["Branch4_Current"] if "Branch4_Current" in raw_data else None,
            "ll_2_power"+ Mark[3]: raw_data["Branch7_S"] if "Branch7_S" in raw_data else None, # tangga
            "ll_2_energy"+ Mark[3]: raw_data["Branch7_E_Active"] if "Branch7_E_Active" in raw_data else None, # tangga
            "ll_2_current" + Mark[3]: raw_data["Branch7_Current"] if "Branch7_Current" in raw_data else None,
            "ll_3_power"+ Mark[3]: raw_data["Branch12_S"] if "Branch12_S" in raw_data else None, # lorong 1
            "ll_3_energy"+ Mark[3]: raw_data["Branch12_E_Active"] if "Branch12_E_Active" in raw_data else None, # lorong 1
            "ll_1_current" + Mark[3]: raw_data["Branch12_Current"] if "Branch12_Current" in raw_data else None,
            "ll_4_power"+ Mark[3]: raw_data["Branch19_S"] if "Branch19_S" in raw_data else None, # lorong 2
            "ll_4_energy"+ Mark[3]: raw_data["Branch19_E_Active"] if "Branch19_E_Active" in raw_data else None, # lorong 2
            "ll_4_current" + Mark[3]: raw_data["Branch19_Current"] if "Branch19_Current" in raw_data else None,
            "ll_5_power"+ Mark[3]: raw_data["Branch11_S"] if "Branch11_S" in raw_data else None, # lampu hias dinding utama / tplink
            "ll_5_energy"+ Mark[3]: raw_data["Branch11_E_Active"] if "Branch11_E_Active" in raw_data else None, # lampu hias dinding utama / tplink
            "ll_5_current" + Mark[3]: raw_data["Branch11_Current"] if "Branch11_Current" in raw_data else None,

            "ll_1_power" + Mark[4]: raw_data["Branch5_S"] if "Branch5_S" in raw_data else None,
            "ll_1_energy" + Mark[4]: raw_data["Branch5_E_Active"] if "Branch5_E_Active" in raw_data else None,
            "ll_1_current" + Mark[4]: raw_data["Branch5_Current"] if "Branch5_Current" in raw_data else None,

            "ll_1_power" + Mark[5]: raw_data["Branch9_S"] if "Branch9_S" in raw_data else None,
            "ll_1_energy" + Mark[5]: raw_data["Branch9_E_Active"] if "Branch9_E_Active" in raw_data else None,
            "ll_1_current" + Mark[5]: raw_data["Branch9_Current"] if "Branch9_Current" in raw_data else None,

            "ll_1_power" + Mark[6]: raw_data["Branch10_S"] if "Branch10_S" in raw_data else None,
            "ll_1_energy" + Mark[6]: raw_data["Branch10_E_Active"] if "Branch10_E_Active" in raw_data else None,
            "ll_1_current" + Mark[6]: raw_data["Branch10_Current"] if "Branch10_Current" in raw_data else None,

            "ll_1_power" + Mark[7]: raw_data["Branch16_S"] if "Branch16_S" in raw_data else None, #pantry
            "ll_1_energy"+ Mark[7]: raw_data["Branch16_E_Active"] if "Branch16_E_Active" in raw_data else None, #pantry
            "ll_1_current" + Mark[7]: raw_data["Branch16_Current"] if "Branch16_Current" in raw_data else None,
            "ll_2_power"+ Mark[7]: raw_data["Branch17_S"] if "Branch17_S" in raw_data else None, #dapur
            "ll_2_energy"+ Mark[7]: raw_data["Branch17_E_Active"] if "Branch17_E_Active" in raw_data else None, #dapur
            "ll_2_current" + Mark[7]: raw_data["Branch17_Current"] if "Branch17_Current" in raw_data else None,

            "ll_1_power" + Mark[8]: raw_data["Branch18_S"] if "Branch18_S" in raw_data else None,
            "ll_1_energy"+ Mark[8]: raw_data["Branch18_E_Active"] if "Branch18_E_Active" in raw_data else None,
            "ll_1_current" + Mark[8]: raw_data["Branch8_Current"] if "Branch18_Current" in raw_data else None,
            
            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,
        }
        new_data["data"]["total_ll_power"+ Mark[0]] = new_data["data"]["ll_1_power" + Mark[0]]
        new_data["data"]["total_ll_energy"+ Mark[0]] = new_data["data"]["ll_1_energy"+ Mark[0]]

        new_data["data"]["total_ll_power"+ Mark[1]] = new_data["data"]["ll_1_power" + Mark[1]]
        new_data["data"]["total_ll_energy"+ Mark[1]] = new_data["data"]["ll_1_energy"+ Mark[1]]

        new_data["data"]["total_ll_power"+ Mark[2]] = new_data["data"]["ll_1_power" + Mark[2]]
        new_data["data"]["total_ll_energy"+ Mark[2]] = new_data["data"]["ll_1_energy"+ Mark[2]]

        new_data["data"]["total_ll_power"+ Mark[3]] = new_data["data"]["ll_1_power" + Mark[3]] + new_data["data"]["ll_2_power"+ Mark[3]] + new_data["data"]["ll_3_power"+ Mark[3]]\
                                             + new_data["data"]["ll_4_power"+ Mark[3]] + new_data["data"]["ll_5_power"+ Mark[3]]
        new_data["data"]["total_ll_energy"+ Mark[3]] = new_data["data"]["ll_1_energy"+ Mark[3]] + new_data["data"]["ll_2_energy"+ Mark[3]] + new_data["data"]["ll_3_energy"+ Mark[3]] \
                                              + new_data["data"]["ll_4_energy"+ Mark[3]] + new_data["data"]["ll_5_energy"+ Mark[3]]

        new_data["data"]["total_ll_power"+ Mark[4]] = new_data["data"]["ll_1_power" + Mark[4]]
        new_data["data"]["total_ll_energy"+ Mark[4]] = new_data["data"]["ll_1_energy"+ Mark[4]]

        new_data["data"]["total_ll_power"+ Mark[5]] = new_data["data"]["ll_1_power" + Mark[5]]
        new_data["data"]["total_ll_energy"+ Mark[5]] = new_data["data"]["ll_1_energy"+ Mark[5]]

        new_data["data"]["total_ll_power"+ Mark[6]] = new_data["data"]["ll_1_power" + Mark[6]]
        new_data["data"]["total_ll_energy"+ Mark[6]] = new_data["data"]["ll_1_energy"+ Mark[6]]

        new_data["data"]["total_ll_power"+ Mark[7]] = new_data["data"]["ll_1_power" + Mark[7]] + new_data["data"]["ll_2_power"+ Mark[7]]
        new_data["data"]["total_ll_energy"+ Mark[7]] = new_data["data"]["ll_1_energy"+ Mark[7]] + new_data["data"]["ll_2_energy"+ Mark[7]]
        
        new_data["data"]["total_ll_power"+ Mark[8]] = new_data["data"]["ll_1_power" + Mark[8]]
        new_data["data"]["total_ll_energy"+ Mark[8]] = new_data["data"]["ll_1_energy"+ Mark[8]]
        data.append(new_data)

        return data

class OUTLET_LT1_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []

        ### Toilet
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "outlet_1_power_Toilet": raw_data["Branch2_S"] if "Branch2_S" in raw_data else None, #toilet pria
            "outlet_1_energy_Toilet": raw_data["Branch2_E_Active"] if "Branch2_E_Active" in raw_data else None, #toilet pria
            "outlet_1_current_Toilet": raw_data["Branch2_Current"] if "Branch2_Current" in raw_data else None, #toilet pria
            "outlet_2_power_Toilet": raw_data["Branch4_S"] if "Branch4_S" in raw_data else None,  # toilet wanita
            "outlet_2_energy_Toilet": raw_data["Branch4_E_Active"] if "Branch4_E_Active" in raw_data else None,  # toilet wanita
            "outlet_2_current_Toilet": raw_data["Branch4_Current"] if "Branch4_Current" in raw_data else None, #toilet wanita

            "outlet_1_power_Pantry": raw_data["Branch5_S"] if "Branch5_S" in raw_data else None,
            "outlet_1_energy_Pantry": raw_data["Branch5_E_Active"] if "Branch5_E_Active" in raw_data else None,
            "outlet_1_current_Pantry": raw_data["Branch5_Current"] if "Branch5_Current" in raw_data else None,
            "outlet_2_power_Pantry": raw_data["Branch18_S"] if "Branch18_S" in raw_data else None,  # meja pantry
            "outlet_2_energy_Pantry": raw_data["Branch18_E_Active"] if "Branch18_E_Active" in raw_data else None,  # meja pantry
            "outlet_3_current_Pantry": raw_data["Branch18_Current"] if "Branch18_Current" in raw_data else None, # meja pantry

            "outlet_1_power_Corridor": raw_data["Branch6_S"] if "Branch6_S" in raw_data else None, #bawah tangga
            "outlet_1_energy_Corridor": raw_data["Branch6_E_Active"] if "Branch6_E_Active" in raw_data else None, #bawah tangga
            "outlet_1_current_Corridor": raw_data["Branch6_Current"] if "Branch6_Current" in raw_data else None,

            "outlet_1_power_Genset_Room": raw_data["Branch7_S"] if "Branch7_S" in raw_data else None,
            "outlet_1_energy_Genset_Room": raw_data["Branch7_E_Active"] if "Branch7_E_Active" in raw_data else None,
            "outlet_1_current_Genset_Room": raw_data["Branch7_Current"] if "Branch7_Current" in raw_data else None,

            "outlet_1_power_Director_1": raw_data["Branch8_S"] if "Branch8_S" in raw_data else None,
            "outlet_1_energy_Director_1": raw_data["Branch8_E_Active"] if "Branch8_E_Active" in raw_data else None,
            "outlet_1_current_Director_1": raw_data["Branch8_Current"] if "Branch8_Current" in raw_data else None,

            "outlet_1_power_Staff": raw_data["Branch9_S"] if "Branch9_S" in raw_data else None, #meja 1
            "outlet_1_energy_Staff": raw_data["Branch9_E_Active"] if "Branch9_E_Active" in raw_data else None, #meja 1
            "outlet_1_current_Staff": raw_data["Branch9_Current"] if "Branch9_Current" in raw_data else None,
            "outlet_2_power_Staff": raw_data["Branch10_S"] if "Branch10_S" in raw_data else None, #meja2
            "outlet_2_energy_Staff": raw_data["Branch10_E_Active"] if "Branch10_E_Active" in raw_data else None, #meja2
            "outlet_2_current_Staff": raw_data["Branch10_Current"] if "Branch10_Current" in raw_data else None,

            "outlet_1_power_Workshop_1": raw_data["Branch11_S"]/2 if "Branch11_S" in raw_data else None,
            "outlet_1_energy_Workshop_1": raw_data["Branch11_E_Active"]/2 if "Branch11_E_Active" in raw_data else None,
            "outlet_1_current_Workshop_1": raw_data["Branch11_Current"]/2 if "Branch11_Current" in raw_data else None,

            "outlet_1_power_Workshop_2": raw_data["Branch11_S"]/2 if "Branch11_S" in raw_data else None,
            "outlet_1_energy_Workshop_2": raw_data["Branch11_E_Active"]/2 if "Branch11_E_Active" in raw_data else None,
            "outlet_1_current_Workshop_2": raw_data["Branch11_Current"]/2 if "Branch11_Current" in raw_data else None,

            "outlet_1_power_Meeting_1": raw_data["Branch12_S"] *0.4 if "Branch12_S" in raw_data else None,
            "outlet_1_energy_Meeting_1": raw_data["Branch12_E_Active"] *0.4 if "Branch12_E_Active" in raw_data else None,
            "outlet_1_current_Meeting_1": raw_data["Branch12_Current"]*0.4 if "Branch12_Current" in raw_data else None,

            "outlet_1_power_Meeting_2": raw_data["Branch12_S"] * 0.6 if "Branch12_S" in raw_data else None,
            "outlet_1_energy_Meeting_2": raw_data["Branch12_E_Active"] * 0.6 if "Branch12_E_Active" in raw_data else None,
            "outlet_1_current_Meeting_2": raw_data["Branch12_Current"]*0.6 if "Branch12_Current" in raw_data else None,

            "outlet_1_power_Bathroom": raw_data["Branch14_S"]if "Branch14_S" in raw_data else None, #air panas 1
            "outlet_1_energy_Bathroom": raw_data["Branch14_E_Active"] if "Branch14_E_Active" in raw_data else None, #air panas 1
            "outlet_1_current_Bathroom": raw_data["Branch14_Current"] if "Branch14_Current" in raw_data else None,
            "outlet_2_power_Bathroom": raw_data["Branch20_S"] if "Branch20_S" in raw_data else None, #air panas 2
            "outlet_2_energy_Bathroom": raw_data["Branch20_E_Active"] if "Branch20_E_Active" in raw_data else None, #air panas 2
            "outlet_2_current_Bathroom": raw_data["Branch20_Current"] if "Branch20_Current" in raw_data else None,

            "outlet_1_power_Receptionist": raw_data["Branch15_S"] if "Branch15_S" in raw_data else None,
            "outlet_1_energy_Receptionist": raw_data["Branch15_E_Active"] if "Branch15_E_Active" in raw_data else None,
            "outlet_1_current_Receptionist": raw_data["Branch15_Current"] if "Branch15_Current" in raw_data else None,

            "outlet_1_power_director_2": raw_data["Branch16_S"] if "Branch16_S" in raw_data else None,
            "outlet_1_energy_director_2": raw_data["Branch16_E_Active"] if "Branch16_E_Active" in raw_data else None,
            "outlet_1_current_director_2": raw_data["Branch16_Current"] if "Branch16_Current" in raw_data else None,

            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,
        }
        new_data["data"]["total_outlet_power_Toilet"] = new_data["data"]["outlet_1_power_Toilet"] + new_data["data"]["outlet_2_power_Toilet"]
        new_data["data"]["total_outlet_energy_Toilet"] = new_data["data"]["outlet_1_energy_Toilet"] + new_data["data"]["outlet_2_energy_Toilet"]
        
        new_data["data"]["total_outlet_power_Pantry"] = new_data["data"]["outlet_1_power_Pantry"] + new_data["data"]["outlet_2_power_Pantry"]
        new_data["data"]["total_outlet_energy_Pantry"] = new_data["data"]["outlet_1_energy_Pantry"] + new_data["data"]["outlet_2_energy_Pantry"]
        
        new_data["data"]["total_outlet_power_Corridor"] = new_data["data"]["outlet_1_power_Corridor"] 
        new_data["data"]["total_outlet_energy_Corridor"] = new_data["data"]["outlet_1_energy_Corridor"] 

        new_data["data"]["total_outlet_power_Genset_Room"] = new_data["data"]["outlet_1_power_Genset_Room"]
        new_data["data"]["total_outlet_energy_Genset_Room"] = new_data["data"]["outlet_1_energy_Genset_Room"]

        new_data["data"]["total_outlet_power_Director_1"] = new_data["data"]["outlet_1_power_Director_1"]
        new_data["data"]["total_outlet_energy_Director_1"] = new_data["data"]["outlet_1_energy_Director_1"]

        new_data["data"]["total_outlet_power_Staff"] = new_data["data"]["outlet_1_power_Staff"] + new_data["data"]["outlet_2_power_Staff"]
        new_data["data"]["total_outlet_energy_Staff"] = new_data["data"]["outlet_1_energy_Staff"] + new_data["data"]["outlet_2_energy_Staff"]

        new_data["data"]["total_outlet_power_Workshop_1"] = new_data["data"]["outlet_1_power_Workshop_1"]
        new_data["data"]["total_outlet_energy_Workshop_1"] = new_data["data"]["outlet_1_energy_Workshop_1"]

        new_data["data"]["total_outlet_power_Workshop_2"] = new_data["data"]["outlet_1_power_Workshop_2"]
        new_data["data"]["total_outlet_energy_Workshop_2"] = new_data["data"]["outlet_1_energy_Workshop_2"]

        new_data["data"]["total_outlet_power_Meeting_1"] = new_data["data"]["outlet_1_power_Meeting_1"]
        new_data["data"]["total_outlet_energy_Meeting_1"] = new_data["data"]["outlet_1_energy_Meeting_1"]

        new_data["data"]["total_outlet_power_Meeting_2"] = new_data["data"]["outlet_1_power_Meeting_2"]
        new_data["data"]["total_outlet_energy_Meeting_2"] = new_data["data"]["outlet_1_energy_Meeting_2"]

        new_data["data"]["total_outlet_power_Bathroom"] = new_data["data"]["outlet_1_power_Bathroom"] + new_data["data"]["outlet_2_power_Bathroom"]
        new_data["data"]["total_outlet_energy_Bathroom"] = new_data["data"]["outlet_1_energy_Bathroom"] + new_data["data"]["outlet_2_energy_Bathroom"]

        new_data["data"]["total_outlet_power_Receptionist"] = new_data["data"]["outlet_1_power_Receptionist"]
        new_data["data"]["total_outlet_energy_Receptionist"] = new_data["data"]["outlet_1_energy_Receptionist"]

        new_data["data"]["total_outlet_power_director_2"] = new_data["data"]["outlet_1_power_director_2"]
        new_data["data"]["total_outlet_energy_director_2"] = new_data["data"]["outlet_1_energy_director_2"]

        data.append(new_data)

        return data

####################################### LANTAI 2 #######################################
### SPM33
class AC_LT2_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] =  {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        
        }
        data.append(new_data)

        return data


class LIGHTING_LT2_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] =  {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        
        }
        data.append(new_data)

        return data

class OUTLET_LT2_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] =  {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        
        }
        data.append(new_data)

        return data

class PowerMeter1_LT2(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] =  {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        
        }
        data.append(new_data)

        return data

### SPM20
class AC_LT2_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []

        Mark = ["_director_2", "_Server", "_Mushalla", "_Meeting", "_President_director", "_Manager_1", "_Staff", "_Manager_2", "_Manager_3", "_Corridor"]
        ### director 2
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "ac_1_power" + Mark[0]: raw_data["Branch1_S"] if "Branch1_S" in raw_data else None,
            "ac_1_energy"+ Mark[0]: raw_data["Branch1_E_Active"] if "Branch1_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[0] :raw_data["Branch1_Current"] if "Branch1_Current" in raw_data else None,

            "ac_1_power"+ Mark[1]: raw_data["Branch16_S"] if "Branch16_S" in raw_data else None,
            "ac_1_energy"+ Mark[1]: raw_data["Branch16_E_Active"] if "Branch16_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[1] :raw_data["Branch16_Current"] if "Branch16_Current" in raw_data else None,
            "ac_2_power"+ Mark[1]: raw_data["Branch2_S"] if "Branch2_S" in raw_data else None,
            "ac_2_energy"+ Mark[1]: raw_data["Branch2_E_Active"] if "Branch2_E_Active" in raw_data else None,
            "ac_2_current"+ Mark[2] :raw_data["Branch2_Current"] if "Branch2_Current" in raw_data else None,

            "ac_1_power"+ Mark[2]: raw_data["Branch3_S"] if "Branch3_S" in raw_data else None,
            "ac_1_energy"+ Mark[2]: raw_data["Branch3_E_Active"] if "Branch3_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[2] :raw_data["Branch3_Current"] if "Branch3_Current" in raw_data else None,
            
            "ac_1_power"+ Mark[3]: raw_data["Branch4_S"] if "Branch4_S" in raw_data else None,
            "ac_1_energy"+ Mark[3]: raw_data["Branch4_E_Active"] if "Branch4_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[3] :raw_data["Branch4_Current"] if "Branch4_Current" in raw_data else None,

            "ac_1_power"+ Mark[4]: raw_data["Branch5_S"] if "Branch5_S" in raw_data else None,
            "ac_1_energy"+ Mark[4]: raw_data["Branch5_E_Active"] if "Branch5_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[4] :raw_data["Branch5_Current"] if "Branch5_Current" in raw_data else None,

            "ac_1_power"+ Mark[5]: raw_data["Branch7_S"] if "Branch7_S" in raw_data else None,
            "ac_1_energy"+ Mark[5]: raw_data["Branch7_E_Active"] if "Branch7_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[5] :raw_data["Branch7_Current"] if "Branch7_Current" in raw_data else None,

            "ac_1_power"+ Mark[6]: raw_data["Branch9_S"] if "Branch9_S" in raw_data else None,
            "ac_1_energy"+ Mark[6]: raw_data["Branch9_E_Active"] if "Branch9_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[6] :raw_data["Branch9_Current"] if "Branch9_Current" in raw_data else None,
            "ac_2_power"+ Mark[6]: raw_data["Branch18_S"] if "Branch18_S" in raw_data else None,
            "ac_2_energy"+ Mark[6]: raw_data["Branch18_E_Active"] if "Branch18_E_Active" in raw_data else None,
            "ac_2_current"+ Mark[6] :raw_data["Branch18_Current"] if "Branch18_Current" in raw_data else None,
            "ac_3_power"+ Mark[6]: raw_data["Branch17_S"] if "Branch17_S" in raw_data else None,
            "ac_3_energy"+ Mark[6]: raw_data["Branch17_E_Active"] if "Branch17_E_Active" in raw_data else None,
            "ac_3_current"+ Mark[6] :raw_data["Branch17_Current"] if "Branch17_Current" in raw_data else None,

            "ac_1_power"+ Mark[7]: raw_data["Branch11_S"] if "Branch11_S" in raw_data else None,
            "ac_1_energy"+ Mark[7]: raw_data["Branch11_E_Active"] if "Branch11_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[7] :raw_data["Branch11_Current"] if "Branch11_Current" in raw_data else None,

            "ac_1_power"+ Mark[8]: raw_data["Branch14_S"] if "Branch14_S" in raw_data else None,
            "ac_1_energy"+ Mark[8]: raw_data["Branch14_E_Active"] if "Branch14_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[8] :raw_data["Branch14_Current"] if "Branch14_Current" in raw_data else None,

            "ac_1_power"+ Mark[9]: raw_data["Branch13_S"] if "Branch13_S" in raw_data else None, # depan ruang server
            "ac_1_energy"+ Mark[9]: raw_data["Branch13_E_Active"] if "Branch13_E_Active" in raw_data else None, # depan ruang server
            "ac_1_current"+ Mark[9] :raw_data["Branch13_Current"] if "Branch13_Current" in raw_data else None,
            "ac_2_power"+ Mark[9]: raw_data["Branch15_S"] if "Branch15_S" in raw_data else None, # depan ruang mushalla
            "ac_2_energy"+ Mark[9]: raw_data["Branch15_E_Active"] if "Branch15_E_Active" in raw_data else None, # depan ruang mushalla
            "ac_2_current"+ Mark[9] :raw_data["Branch15_Current"] if "Branch15_Current" in raw_data else None,
        
            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,
        }
        new_data["data"]["total_ac_power"+ Mark[0]] = new_data["data"]["ac_1_power"+ Mark[0]]
        new_data["data"]["total_ac_energy"+ Mark[0]] = new_data["data"]["ac_1_energy"+ Mark[0]]
        
        new_data["data"]["total_ac_power"+ Mark[1]] = new_data["data"]["ac_1_power"+ Mark[1]] + new_data["data"]["ac_2_power"+ Mark[1]]
        new_data["data"]["total_ac_energy"+ Mark[1]] = new_data["data"]["ac_1_energy"+ Mark[1]] + new_data["data"]["ac_2_energy"+ Mark[1]]
        
        new_data["data"]["total_ac_power"+ Mark[2]] = new_data["data"]["ac_1_power"+ Mark[2]]
        new_data["data"]["total_ac_energy"+ Mark[2]] = new_data["data"]["ac_1_energy"+ Mark[2]]

        new_data["data"]["total_ac_power"+ Mark[3]] = new_data["data"]["ac_1_power"+ Mark[3]]
        new_data["data"]["total_ac_energy"+ Mark[3]] = new_data["data"]["ac_1_energy"+ Mark[3]]

        new_data["data"]["total_ac_power"+ Mark[4]] = new_data["data"]["ac_1_power"+ Mark[4]]
        new_data["data"]["total_ac_energy"+ Mark[4]] = new_data["data"]["ac_1_energy"+ Mark[4]]

        new_data["data"]["total_ac_power"+ Mark[5]] = new_data["data"]["ac_1_power"+ Mark[5]]
        new_data["data"]["total_ac_energy"+ Mark[5]] = new_data["data"]["ac_1_energy"+ Mark[5]]

        new_data["data"]["total_ac_power"+ Mark[6]] = new_data["data"]["ac_1_power"+ Mark[6]] + new_data["data"]["ac_2_power"+ Mark[6]] + new_data["data"]["ac_3_power"+ Mark[6]]
        new_data["data"]["total_ac_energy"+ Mark[6]] = new_data["data"]["ac_1_energy"+ Mark[6]] + new_data["data"]["ac_2_energy"+ Mark[6]] + new_data["data"]["ac_3_energy"+ Mark[6]]

        new_data["data"]["total_ac_power"+ Mark[7]] = new_data["data"]["ac_1_power"+ Mark[7]]
        new_data["data"]["total_ac_energy"+ Mark[7]] = new_data["data"]["ac_1_energy"+ Mark[7]]

        new_data["data"]["total_ac_power"+ Mark[8]] = new_data["data"]["ac_1_power"+ Mark[8]]
        new_data["data"]["total_ac_energy"+ Mark[8]] = new_data["data"]["ac_1_energy"+ Mark[8]]

        new_data["data"]["total_ac_power"+ Mark[9]] = new_data["data"]["ac_1_power"+ Mark[9]] + new_data["data"]["ac_2_power"+ Mark[9]]
        new_data["data"]["total_ac_energy"+ Mark[9]] = new_data["data"]["ac_1_energy"+ Mark[9]] + new_data["data"]["ac_2_energy"+ Mark[9]]
        data.append(new_data)

       
        return data

class LIGHTING_LT2_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []

        Mark = ["_director_2", "_Server", "_Mushalla", "_Meeting", "_President_director", "_Manager_1", "_Manager_2", "_Manager_3", "_Staff", "_Corridor", "_Toilet"]
        ### director 2
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "ll_1_power" + Mark[0]: raw_data["Branch16_S"]/2 if "Branch16_S" in raw_data else None,
            "ll_1_energy"+ Mark[0]: raw_data["Branch16_E_Active"]/2 if "Branch16_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[0]: raw_data["Branch16_Current"]/2 if "Branch16_Current" in raw_data else None,

            "ll_1_power" + Mark[1]: raw_data["Branch8_S"] if "Branch8_S" in raw_data else None,
            "ll_1_energy"+ Mark[1]: raw_data["Branch8_E_Active"] if "Branch8_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[1]: raw_data["Branch8_Current"] if "Branch8_Current" in raw_data else None,

            "ll_1_power" + Mark[2]: raw_data["Branch13_S"] if "Branch13_S" in raw_data else None,
            "ll_1_energy"+ Mark[2]: raw_data["Branch13_E_Active"] if "Branch13_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[2]: raw_data["Branch13_Current"] if "Branch13_Current" in raw_data else None,

            "ll_1_power" + Mark[3]: raw_data["Branch4_S"] if "Branch4_S" in raw_data else None,
            "ll_1_energy"+ Mark[3]: raw_data["Branch4_E_Active"] if "Branch4_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[3]: raw_data["Branch4_Current"] if "Branch4_Current" in raw_data else None,
            "outlet_1_power"+ Mark[3]: raw_data["Branch17_S"] if "Branch17_S" in raw_data else None,
            "outlet_1_energy"+ Mark[3]: raw_data["Branch17_E_Active"] if "Branch17_E_Active" in raw_data else None,
            "outlet_1_current"+ Mark[3]: raw_data["Branch17_Current"] if "Branch17_Current" in raw_data else None,

            "ll_1_power" + Mark[4]: raw_data["Branch16_S"]/2 if "Branch16_S" in raw_data else None,
            "ll_1_energy"+ Mark[4]: raw_data["Branch16_E_Active"]/2 if "Branch16_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[4]: raw_data["Branch16_Current"]/2 if "Branch16_Current" in raw_data else None,
            
            "ll_1_power" + Mark[5]: raw_data["Branch10_S"] / 3 if "Branch10_S" in raw_data else None,
            "ll_1_energy"+ Mark[5]: raw_data["Branch10_E_Active"] / 3 if "Branch10_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[5]: raw_data["Branch10_Current"]/3 if "Branch10_Current" in raw_data else None,
        
            "ll_1_power" + Mark[6]: raw_data["Branch10_S"] / 3 if "Branch10_S" in raw_data else None,
            "ll_1_energy"+ Mark[6]: raw_data["Branch10_E_Active"] / 3 if "Branch10_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[6]: raw_data["Branch10_Current"]/3 if "Branch10_Current" in raw_data else None,

            "ll_1_power" + Mark[7]: raw_data["Branch10_S"] / 3 if "Branch10_S" in raw_data else None,
            "ll_1_energy"+ Mark[7]: raw_data["Branch10_E_Active"] / 3 if "Branch10_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[7]: raw_data["Branch10_Current"] if "Branch10_Current" in raw_data else None,

            "ll_1_power" + Mark[8]: raw_data["Branch20_S"]*0.8 if "Branch20_S" in raw_data else None,
            "ll_1_energy"+ Mark[8]: raw_data["Branch20_E_Active"]*0.8 if "Branch20_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[8]: raw_data["Branch20_Current"]*0.8 if "Branch20_Current" in raw_data else None,
        
            "ll_1_power" + Mark[9]: raw_data["Branch20_S"]*0.2 if "Branch20_S" in raw_data else None,
            "ll_1_energy"+ Mark[9]: raw_data["Branch20_E_Active"]*0.2 if "Branch20_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[9]: raw_data["Branch20_Current"]*0.2 if "Branch20_Current" in raw_data else None,
            "ll_2_power"+ Mark[9]: raw_data["Branch14_S"] if "Branch14_S" in raw_data else None, # lorong director
            "ll_2_energy"+ Mark[9]: raw_data["Branch14_E_Active"] if "Branch14_E_Active" in raw_data else None, # lorong director
            "ll_2_current"+ Mark[9]: raw_data["Branch14_Current"] if "Branch14_Current" in raw_data else None,
            "ll_3_power"+ Mark[9]: raw_data["Branch12_S"] if "Branch12_S" in raw_data else None, # lorong pantry, rapat, server
            "ll_3_energy"+ Mark[9]: raw_data["Branch12_E_Active"] if "Branch12_E_Active" in raw_data else None, # lorong pantry, rapat, server
            "ll_3_current"+ Mark[9]: raw_data["Branch12_Current"] if "Branch12_Current" in raw_data else None,
            "ll_4_power"+ Mark[9]: raw_data["Branch2_S"] if "Branch2_S" in raw_data else None, # area panel
            "ll_4_energy"+ Mark[9]: raw_data["Branch2_E_Active"] if "Branch2_E_Active" in raw_data else None, # area panel
            "ll_4_current"+ Mark[9]: raw_data["Branch2_Current"] if "Branch2_Current" in raw_data else None,
        
            "ll_1_power" + Mark[10]: raw_data["Branch3_S"] if "Branch3_S" in raw_data else None, # toilet pria
            "ll_1_energy"+ Mark[10]: raw_data["Branch3_E_Active"] if "Branch3_E_Active" in raw_data else None, #toilet pria
            "ll_1_current"+ Mark[10]: raw_data["Branch3_Current"] if "Branch3_Current" in raw_data else None,
            "ll_2_power"+ Mark[10]: raw_data["Branch11_S"] if "Branch11_S" in raw_data else None,  # toilet wanita
            "ll_2_energy"+ Mark[10]: raw_data["Branch11_E_Active"] if "Branch11_E_Active" in raw_data else None,  # toilet wanita
            "ll_2_current"+ Mark[10]: raw_data["Branch11_Current"] if "Branch11_Current" in raw_data else None,
            
            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,
        }
        new_data["data"]["total_ll_power"+ Mark[0]] = new_data["data"]["ll_1_power" + Mark[0]]
        new_data["data"]["total_ll_energy"+ Mark[0]] = new_data["data"]["ll_1_energy"+ Mark[0]]

        new_data["data"]["total_ll_power"+ Mark[1]] = new_data["data"]["ll_1_power" + Mark[1]]
        new_data["data"]["total_ll_energy"+ Mark[1]] = new_data["data"]["ll_1_energy"+ Mark[1]]

        new_data["data"]["total_ll_power"+ Mark[2]] = new_data["data"]["ll_1_power" + Mark[2]]
        new_data["data"]["total_ll_energy"+ Mark[2]] = new_data["data"]["ll_1_energy"+ Mark[2]]

        new_data["data"]["total_ll_power"+ Mark[3]] = new_data["data"]["ll_1_power" + Mark[3]]
        new_data["data"]["total_ll_energy"+ Mark[3]] = new_data["data"]["ll_1_energy"+ Mark[3]]

        new_data["data"]["total_ll_power"+ Mark[4]] = new_data["data"]["ll_1_power" + Mark[4]]
        new_data["data"]["total_ll_energy"+ Mark[4]] = new_data["data"]["ll_1_energy"+ Mark[4]]

        new_data["data"]["total_ll_power"+ Mark[5]] = new_data["data"]["ll_1_power" + Mark[5]]
        new_data["data"]["total_ll_energy"+ Mark[5]] = new_data["data"]["ll_1_energy"+ Mark[5]]

        new_data["data"]["total_ll_power"+ Mark[6]] = new_data["data"]["ll_1_power" + Mark[6]]
        new_data["data"]["total_ll_energy"+ Mark[6]] = new_data["data"]["ll_1_energy"+ Mark[6]]

        new_data["data"]["total_ll_power"+ Mark[7]] = new_data["data"]["ll_1_power" + Mark[7]]
        new_data["data"]["total_ll_energy"+ Mark[7]] = new_data["data"]["ll_1_energy"+ Mark[7]]

        new_data["data"]["total_ll_power"+ Mark[8]] = new_data["data"]["ll_1_power" + Mark[8]]
        new_data["data"]["total_ll_energy"+ Mark[8]] = new_data["data"]["ll_1_energy"+ Mark[8]]

        new_data["data"]["total_ll_power"+ Mark[9]] = new_data["data"]["ll_1_power" + Mark[9]] + new_data["data"]["ll_2_power"+ Mark[9]]\
                                             + new_data["data"]["ll_3_power"+ Mark[9]] + new_data["data"]["ll_4_power"+ Mark[9]]
        new_data["data"]["total_ll_energy"+ Mark[9]] = new_data["data"]["ll_1_energy"+ Mark[9]] + new_data["data"]["ll_2_energy"+ Mark[9]] \
                                              + new_data["data"]["ll_1_energy"+ Mark[9]] + new_data["data"]["ll_4_energy"+ Mark[9]]
        
        new_data["data"]["total_ll_power"+ Mark[10]] = new_data["data"]["ll_1_power" + Mark[10]] + new_data["data"]["ll_2_power"+ Mark[10]]
        new_data["data"]["total_ll_energy"+ Mark[10]] = new_data["data"]["ll_1_energy"+ Mark[10]] + new_data["data"]["ll_2_energy"+ Mark[10]]
        data.append(new_data)

        return data

class OUTLET_LT2_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []
        Mark = ["_director_2", "_Meeting", "_president_director", "_Manager_1", "_Manager_2", "_Manager_3", "_Staff", "_Corridor", "_Toilet"]

        ### director 2
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "outlet_1_power" + Mark[0]: raw_data["Branch9_S"] if "Branch9_S" in raw_data else None,
            "outlet_1_energy" + Mark[0]: raw_data["Branch9_E_Active"] if "Branch9_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[0]: raw_data["Branch9_Current"] if "Branch9_Current" in raw_data else None,

            "outlet_1_power" + Mark[1]: raw_data["Branch16_S"] if "Branch16_S" in raw_data else None,
            "outlet_1_energy" + Mark[1]: raw_data["Branch16_E_Active"] if "Branch16_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[1]: raw_data["Branch16_Current"] if "Branch16_Current" in raw_data else None,
        
            "outlet_1_power" + Mark[2]: raw_data["Branch12_S"] if "Branch12_S" in raw_data else None,
            "outlet_1_energy" + Mark[2]: raw_data["Branch12_E_Active"] if "Branch12_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[2]: raw_data["Branch12_Current"] if "Branch12_Current" in raw_data else None,

            "outlet_1_power" + Mark[3]: raw_data["Branch3_S"] if "Branch3_S" in raw_data else None,
            "outlet_1_energy"+ Mark[3]: raw_data["Branch3_E_Active"] if "Branch3_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[3]: raw_data["Branch3_Current"] if "Branch3_Current" in raw_data else None,
        
            "outlet_1_power"+ Mark[4]: raw_data["Branch15_S"]/2 if "Branch15_S" in raw_data else None,
            "outlet_1_energy"+ Mark[4]: raw_data["Branch15_E_Active"]/2 if "Branch15_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[4]: raw_data["Branch15_Current"]/2 if "Branch15_Current" in raw_data else None,

            "outlet_1_power"+ Mark[5]: raw_data["Branch15_S"]/2 if "Branch15_S" in raw_data else None,
            "outlet_1_energy"+ Mark[5]: raw_data["Branch15_E_Active"]/2 if "Branch15_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[5]: raw_data["Branch15_Current"]/2 if "Branch15_Current" in raw_data else None,
        
            "outlet_1_power"+ Mark[6]: raw_data["Branch7_S"] if "Branch7_S" in raw_data else None, # meja 1,2,3
            "outlet_1_energy"+ Mark[6]: raw_data["Branch7_E_Active"] if "Branch7_E_Active" in raw_data else None, # meja 1,2,3
            "outlet_1_current" + Mark[6]: raw_data["Branch7_Current"] if "Branch7_Current" in raw_data else None,
            "outlet_2_power"+ Mark[6]: raw_data["Branch13_S"] if "Branch13_S" in raw_data else None,  # meja 4,5,6
            "outlet_2_energy"+ Mark[6]: raw_data["Branch13_E_Active"] if "Branch13_E_Active" in raw_data else None,  # meja 4,5,6
            "outlet_2_current" + Mark[6]: raw_data["Branch13_Current"] if "Branch13_Current" in raw_data else None,
            "outlet_3_power"+ Mark[6]: raw_data["Branch10_S"] if "Branch10_S" in raw_data else None,  # tirai kaca
            "outlet_3_energy"+ Mark[6]: raw_data["Branch10_E_Active"] if "Branch10_E_Active" in raw_data else None,  # tirai kaca
            "outlet_3_current" + Mark[6]: raw_data["Branch10_Current"] if "Branch10_Current" in raw_data else None,
        
            "outlet_1_power"+ Mark[7]: raw_data["Branch8_S"] if "Branch8_S" in raw_data else None,  # pantry
            "outlet_1_energy"+ Mark[7]: raw_data["Branch8_E_Active"] if "Branch8_E_Active" in raw_data else None,  # pantry
            "outlet_1_current" + Mark[7]: raw_data["Branch8_Current"] if "Branch8_Current" in raw_data else None,
            "outlet_2_power"+ Mark[7]: raw_data["Branch11_S"] if "Branch11_S" in raw_data else None,  # 2 meja samping ruang meeting
            "outlet_2_energy"+ Mark[7]: raw_data["Branch11_E_Active"] if "Branch11_E_Active" in raw_data else None,  # 2 meja samping ruang meeting
            "outlet_2_current" + Mark[7]: raw_data["Branch11_Current"] if "Branch11_Current" in raw_data else None,
        
            "outlet_1_power"+ Mark[8]: raw_data["Branch4_S"] if "Branch4_S" in raw_data else None,  # toilet pria
            "outlet_1_energy"+ Mark[8]: raw_data["Branch4_E_Active"] if "Branch4_E_Active" in raw_data else None,  # toilet pria
            "outlet_1_current" + Mark[8]: raw_data["Branch4_Current"] if "Branch4_Current" in raw_data else None,
            "outlet_2_power"+ Mark[8]: raw_data["Branch14_S"] if "Branch14_S" in raw_data else None,  # toilet wanita
            "outlet_2_energy"+ Mark[8]: raw_data["Branch14_E_Active"] if "Branch14_E_Active" in raw_data else None,  # toilet wanita
            "outlet_2_current" + Mark[8]: raw_data["Branch14_Current"] if "Branch14_Current" in raw_data else None,

            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,

        }
        new_data["data"]["total_outlet_power"+ Mark[0]] = new_data["data"]["outlet_1_power"+ Mark[0]]
        new_data["data"]["total_outlet_energy"+ Mark[0]] = new_data["data"]["outlet_1_energy"+ Mark[0]]

        new_data["data"]["total_outlet_power"+ Mark[1]] = new_data["data"]["outlet_1_power"+ Mark[1]]
        new_data["data"]["total_outlet_energy"+ Mark[1]] = new_data["data"]["outlet_1_energy"+ Mark[1]]

        new_data["data"]["total_outlet_power"+ Mark[2]] = new_data["data"]["outlet_1_power"+ Mark[2]]
        new_data["data"]["total_outlet_energy"+ Mark[2]] = new_data["data"]["outlet_1_energy"+ Mark[2]]

        new_data["data"]["total_outlet_power"+ Mark[3]] = new_data["data"]["outlet_1_power"+ Mark[3]]
        new_data["data"]["total_outlet_energy"+ Mark[3]] = new_data["data"]["outlet_1_energy"+ Mark[3]]

        new_data["data"]["total_outlet_power"+ Mark[4]] = new_data["data"]["outlet_1_power"+ Mark[4]]
        new_data["data"]["total_outlet_energy"+ Mark[4]] = new_data["data"]["outlet_1_energy"+ Mark[4]]

        new_data["data"]["total_outlet_power"+ Mark[5]] = new_data["data"]["outlet_1_power"+ Mark[5]]
        new_data["data"]["total_outlet_energy"+ Mark[5]] = new_data["data"]["outlet_1_energy"+ Mark[5]]

        new_data["data"]["total_outlet_power"+ Mark[6]] = new_data["data"]["outlet_1_power"+ Mark[6]] + new_data["data"]["outlet_2_power"+ Mark[6]]\
                                                 + new_data["data"]["outlet_3_power"+ Mark[6]]
        new_data["data"]["total_outlet_energy"+ Mark[6]] = new_data["data"]["outlet_1_energy"+ Mark[6]] + new_data["data"]["outlet_2_energy"+ Mark[6]]\
                                                  + new_data["data"]["outlet_3_energy"+ Mark[6]]
        
        
        new_data["data"]["total_outlet_power"+ Mark[7]] = new_data["data"]["outlet_1_power"+ Mark[7]] + new_data["data"]["outlet_2_power"+ Mark[7]]
        new_data["data"]["total_outlet_energy"+ Mark[7]] = new_data["data"]["outlet_1_energy"+ Mark[7]] + new_data["data"]["outlet_2_energy"+ Mark[7]]
        
        new_data["data"]["total_outlet_power"+ Mark[8]] = new_data["data"]["outlet_1_power"+ Mark[8]] + new_data["data"]["outlet_2_power"+ Mark[8]]
        new_data["data"]["total_outlet_energy"+ Mark[8]] = new_data["data"]["outlet_1_energy"+ Mark[8]] + new_data["data"]["outlet_2_energy"+ Mark[8]]
        data.append(new_data)

        return data

####################################### LANTAI 3 #######################################
### SPM33
class AC_LT3_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] =  {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        }
        data.append(new_data)

        return data

class LIGHTING_LT3_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] =  {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        }
        data.append(new_data)

        return data

class OUTLET_LT3_SPM33(Device):
    def process_raw_data(self, raw_data):
        data = []

        # Data
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] =  {
            "Neutral_current": raw_data["I_neutral"] if "I_neutral" in raw_data else None,
            "Current_phase_A": raw_data["I_1"] if "I_1" in raw_data else None,
            "Current_phase_B": raw_data["I_2"] if "I_2" in raw_data else None,
            "Current_phase_C": raw_data["I_3"] if "I_3" in raw_data else None,

            "Line_AB_voltage": raw_data["V_12"] if "V_12" in raw_data else None,
            "Line_BC_voltage": raw_data["V_23"] if "V_23" in raw_data else None,
            "Line_CA_voltage": raw_data["V_31"] if "V_31" in raw_data else None,

            "Voltage_phase_A": raw_data["V_1"] if "V_1" in raw_data else None,
            "Voltage_phase_B": raw_data["V_2"] if "V_2" in raw_data else None,
            "Voltage_phase_C": raw_data["V_3"] if "V_3" in raw_data else None,

            "Total_energy": raw_data["E_Active"] if "E_Active" in raw_data else None,
            "Total_power": raw_data["P_Total"] if "P_Total" in raw_data else None,
            "Total_reactive_power": raw_data["Q_Total"] if "Q_Total" in raw_data else None,
            "Total_apparent_power": raw_data["S_Total"] if "S_Total" in raw_data else None,

            "Total_harmonic_distortion_voltage_phase_A": raw_data["VTHD1"] if "VTHD1" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_B": raw_data["VTHD2"] if "VTHD2" in raw_data else None,
            "Total_harmonic_distortion_voltage_phase_c": raw_data["VTHD3"] if "VTHD3" in raw_data else None,

            "Total_harmonic_distortion_current_phase_A": raw_data["ITHD1"] if "ITHD1" in raw_data else None,
            "Total_harmonic_distortion_current_phase_B": raw_data["ITHD2"] if "ITHD2" in raw_data else None,
            "Total_harmonic_distortion_current_phase_c": raw_data["ITHD3"] if "ITHD3" in raw_data else None,

            "Power_faktor_average": raw_data["PF_avg"] if "PF_avg" in raw_data else None,
            "Total_energy_reactive": raw_data["E_Reactive"] if "E_Reactive" in raw_data else None,

            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,
        }
        data.append(new_data)

        return data

### SPM20
class AC_LT3_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []
        Mark = ["_Kasette_1", "_Ventry/Panel", "_Metting", "_Manager_2", "_Kasette_2", "_Kasette_3","_Director", "_Manager_1"]

        # Room
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "ac_1_power" + Mark[0]: raw_data["Branch1_S"] if "Branch1_S" in raw_data else None,
            "ac_1_energy"+ Mark[0]: raw_data["Branch1_E_Active"] if "Branch1_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[0] :raw_data["Branch1_Current"] if "Branch1_Current" in raw_data else None,

            "ac_1_power"+ Mark[1]: raw_data["Branch3_S"] if "Branch3_S" in raw_data else None,
            "ac_1_energy"+ Mark[1]: raw_data["Branch3_E_Active"] if "Branch3_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[1] :raw_data["Branch3_Current"] if "Branch3_Current" in raw_data else None,

            "ac_1_power"+ Mark[2]: raw_data["Branch5_S"] if "Branch5_S" in raw_data else None,
            "ac_1_energy"+ Mark[2]: raw_data["Branch5_E_Active"] if "Branch5_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[2] :raw_data["Branch5_Current"] if "Branch5_Current" in raw_data else None,
            
            "ac_1_power"+ Mark[3]: raw_data["Branch7_S"] if "Branch7_S" in raw_data else None,
            "ac_1_energy"+ Mark[3]: raw_data["Branch7_E_Active"] if "Branch7_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[3] :raw_data["Branch7_Current"] if "Branch7_Current" in raw_data else None,

            "ac_1_power"+ Mark[4]: raw_data["Branch8_S"] if "Branch8_S" in raw_data else None,
            "ac_1_energy"+ Mark[4]: raw_data["Branch8_E_Active"] if "Branch8_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[4] :raw_data["Branch8_Current"] if "Branch8_Current" in raw_data else None,

            "ac_1_power"+ Mark[5]: raw_data["Branch14_S"] if "Branch14_S" in raw_data else None,
            "ac_1_energy"+ Mark[5]: raw_data["Branch14_E_Active"] if "Branch14_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[5] :raw_data["Branch14_Current"] if "Branch14_Current" in raw_data else None,

            "ac_1_power"+ Mark[6]: raw_data["Branch15_S"] if "Branch15_S" in raw_data else None,
            "ac_1_energy"+ Mark[6]: raw_data["Branch15_E_Active"] if "Branch15_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[6] :raw_data["Branch15_Current"] if "Branch15_Current" in raw_data else None,
            

            "ac_1_power"+ Mark[7]: raw_data["Branch17_S"] if "Branch17_S" in raw_data else None,
            "ac_1_energy"+ Mark[7]: raw_data["Branch17_E_Active"] if "Branch17_E_Active" in raw_data else None,
            "ac_1_current"+ Mark[7] :raw_data["Branch17_Current"] if "Branch17_Current" in raw_data else None,

        
            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,
        }
        new_data["data"]["total_ac_power"+ Mark[0]] = new_data["data"]["ac_1_power"+ Mark[0]]
        new_data["data"]["total_ac_energy"+ Mark[0]] = new_data["data"]["ac_1_energy"+ Mark[0]]
        
        new_data["data"]["total_ac_power"+ Mark[1]] = new_data["data"]["ac_1_power"+ Mark[1]]
        new_data["data"]["total_ac_energy"+ Mark[1]] = new_data["data"]["ac_1_energy"+ Mark[1]]
        
        new_data["data"]["total_ac_power"+ Mark[2]] = new_data["data"]["ac_1_power"+ Mark[2]]
        new_data["data"]["total_ac_energy"+ Mark[2]] = new_data["data"]["ac_1_energy"+ Mark[2]]

        new_data["data"]["total_ac_power"+ Mark[3]] = new_data["data"]["ac_1_power"+ Mark[3]]
        new_data["data"]["total_ac_energy"+ Mark[3]] = new_data["data"]["ac_1_energy"+ Mark[3]]

        new_data["data"]["total_ac_power"+ Mark[4]] = new_data["data"]["ac_1_power"+ Mark[4]]
        new_data["data"]["total_ac_energy"+ Mark[4]] = new_data["data"]["ac_1_energy"+ Mark[4]]

        new_data["data"]["total_ac_power"+ Mark[5]] = new_data["data"]["ac_1_power"+ Mark[5]]
        new_data["data"]["total_ac_energy"+ Mark[5]] = new_data["data"]["ac_1_energy"+ Mark[5]]

        new_data["data"]["total_ac_power"+ Mark[6]] = new_data["data"]["ac_1_power"+ Mark[6]] 
        new_data["data"]["total_ac_energy"+ Mark[6]] = new_data["data"]["ac_1_energy"+ Mark[6]] 

        new_data["data"]["total_ac_power"+ Mark[7]] = new_data["data"]["ac_1_power"+ Mark[7]]
        new_data["data"]["total_ac_energy"+ Mark[7]] = new_data["data"]["ac_1_energy"+ Mark[7]]

        data.append(new_data)

        return data

class LIGHTING_LT3_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []
        Mark = ["_Pantry", "_Staff", "_Toilet", "_Corridor", "_Director", "_Manager_1", "_Manager_2","_Meeting"]
        ### director 2
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "ll_1_power" + Mark[0]: raw_data["Branch1_S"] if "Branch1_S" in raw_data else None,
            "ll_1_energy"+ Mark[0]: raw_data["Branch1_E_Active"] if "Branch1_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[0]: raw_data["Branch1_Current"] if "Branch1_Current" in raw_data else None,
            "ll_2_power" + Mark[0]: raw_data["Branch14_S"] if "Branch14_S" in raw_data else None,
            "ll_2_energy"+ Mark[0]: raw_data["Branch14_E_Active"] if "Branch14_E_Active" in raw_data else None,
            "ll_2_current"+ Mark[0]: raw_data["Branch14_Current"] if "Branch14_Current" in raw_data else None,
            "ll_3_power" + Mark[0]: raw_data["Branch15_S"] if "Branch15_S" in raw_data else None,
            "ll_3_energy"+ Mark[0]: raw_data["Branch15_E_Active"] if "Branch15_E_Active" in raw_data else None,
            "ll_3_current"+ Mark[0]: raw_data["Branch15_Current"] if "Branch15_Current" in raw_data else None,

            "ll_1_power" + Mark[1]: raw_data["Branch2_S"] if "Branch2_S" in raw_data else None,
            "ll_1_energy"+ Mark[1]: raw_data["Branch2_E_Active"] if "Branch2_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[1]: raw_data["Branch2_Current"] if "Branch2_Current" in raw_data else None,
            "ll_2_power" + Mark[1]: raw_data["Branch3_S"] if "Branch3_S" in raw_data else None,
            "ll_2_energy"+ Mark[1]: raw_data["Branch3_E_Active"] if "Branch3_E_Active" in raw_data else None,
            "ll_2_current"+ Mark[1]: raw_data["Branch3_Current"] if "Branch3_Current" in raw_data else None,

            "Women_Closed_1_power" + Mark[2]: raw_data["Branch4_S"] if "Branch4_S" in raw_data else None,
            "Women_Closed_1_energy"+ Mark[2]: raw_data["Branch4_E_Active"] if "Branch4_E_Active" in raw_data else None,
            "Women_Closed_current"+ Mark[2]: raw_data["Branch4_Current"] if "Branch4_Current" in raw_data else None,
            "Urinoir_1_power" + Mark[2]: raw_data["Branch5_S"] if "Branch5_S" in raw_data else None,
            "Urinoir_1_energy"+ Mark[2]: raw_data["Branch5_E_Active"] if "Branch5_E_Active" in raw_data else None,
            "Urinoir_1_current"+ Mark[2]: raw_data["Branch5_Current"] if "Branch5_Current" in raw_data else None,
            "ll_1_power" + Mark[2]: raw_data["Branch9_S"]/2 if "Branch9_S" in raw_data else None,
            "ll_1_energy"+ Mark[2]: raw_data["Branch9_E_Active"]/2 if "Branch9_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[2]: raw_data["Branch9_Current"]/2 if "Branch9_Current" in raw_data else None,
            "ll_2_power" + Mark[2]: raw_data["Branch5_S"] if "Branch4_S" in raw_data else None,
            "ll_2_energy"+ Mark[2]: raw_data["Branch5_E_Active"] if "Branch4_E_Active" in raw_data else None,
            "ll_2_current"+ Mark[2]: raw_data["Branch5_Current"] if "Branch4_Current" in raw_data else None,

            "ll_1_power" + Mark[3]: raw_data["Branch6_S"] if "Branch6_S" in raw_data else None,
            "ll_1_energy"+ Mark[3]: raw_data["Branch6_E_Active"] if "Branch6_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[3]: raw_data["Branch6_Current"] if "Branch6_Current" in raw_data else None,
            "ll_2_power" + Mark[3]: raw_data["Branch9_S"]/2 if "Branch9_S" in raw_data else None,
            "ll_2_energy"+ Mark[3]: raw_data["Branch9_E_Active"]/2 if "Branch9_E_Active" in raw_data else None,
            "ll_2_current"+ Mark[3]: raw_data["Branch9_Current"]/2 if "Branch9_Current" in raw_data else None,
            "ll_3_power" + Mark[3]: raw_data["Branch11_S"] if "Branch11_S" in raw_data else None,
            "ll_3_energy"+ Mark[3]: raw_data["Branch11_E_Active"] if "Branch11_E_Active" in raw_data else None,
            "ll_3_current"+ Mark[3]: raw_data["Branch11_Current"] if "Branch11_Current" in raw_data else None,
            "ll_4_power" + Mark[3]: raw_data["Branch12_S"]/2 if "Branch12_S" in raw_data else None,
            "ll_4_energy"+ Mark[3]: raw_data["Branch12_E_Active"]/2 if "Branch12_E_Active" in raw_data else None,
            "ll_4_current"+ Mark[3]: raw_data["Branch12_Current"]/2 if "Branch12_Current" in raw_data else None,
            "ll_5_power" + Mark[3]: raw_data["Branch20_S"]/5 if "Branch12_S" in raw_data else None,
            "ll_5_energy"+ Mark[3]: raw_data["Branch20_E_Active"]/5 if "Branch12_E_Active" in raw_data else None,
            "ll_5_current"+ Mark[3]: raw_data["Branch20_Current"]/5 if "Branch12_Current" in raw_data else None,

            "ll_1_power" + Mark[4]: raw_data["Branch20_S"]/5 if "Branch12_S" in raw_data else None,
            "ll_1_energy"+ Mark[4]: raw_data["Branch20_E_Active"]/5 if "Branch12_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[4]: raw_data["Branch20_Current"]/5 if "Branch12_Current" in raw_data else None,

            "ll_1_power" + Mark[5]: raw_data["Branch20_S"]/5 if "Branch12_S" in raw_data else None,
            "ll_1_energy"+ Mark[5]: raw_data["Branch20_E_Active"]/5 if "Branch12_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[5]: raw_data["Branch20_Current"]/5 if "Branch12_Current" in raw_data else None,

            "ll_1_power" + Mark[6]: raw_data["Branch20_S"]/5 if "Branch12_S" in raw_data else None,
            "ll_1_energy"+ Mark[6]: raw_data["Branch20_E_Active"]/5 if "Branch12_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[6]: raw_data["Branch20_Current"]/5 if "Branch12_Current" in raw_data else None,

            "ll_1_power" + Mark[7]: raw_data["Branch20_S"]/5 if "Branch12_S" in raw_data else None,
            "ll_1_energy"+ Mark[7]: raw_data["Branch20_E_Active"]/5 if "Branch12_E_Active" in raw_data else None,
            "ll_1_current"+ Mark[7]: raw_data["Branch20_Current"]/5 if "Branch12_Current" in raw_data else None,
            
            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,
        }
        new_data["data"]["total_ll_power" + Mark[0]] = new_data["data"]["ll_1_power" + Mark[0]] + new_data["data"]["ll_2_power" + Mark[0]] + new_data["data"]["ll_3_power" + Mark[0]]
        new_data["data"]["total_ll_energy" + Mark[0]] = new_data["data"]["ll_1_energy"+ Mark[0]] + new_data["data"]["ll_3_energy"+ Mark[0]] + new_data["data"]["ll_3_energy"+ Mark[0]]

        new_data["data"]["total_ll_power"+ Mark[1]] = new_data["data"]["ll_1_power" + Mark[1]] + new_data["data"]["ll_2_power" + Mark[1]]
        new_data["data"]["total_ll_energy"+ Mark[1]] = new_data["data"]["ll_1_energy"+ Mark[1]] + new_data["data"]["ll_2_energy"+ Mark[1]]

        new_data["data"]["total_ll_power"+ Mark[2]] = new_data["data"]["ll_1_power" + Mark[2]] + new_data["data"]["ll_2_power" + Mark[2]]
        new_data["data"]["total_ll_energy"+ Mark[2]] = new_data["data"]["ll_1_energy"+ Mark[2]] + new_data["data"]["ll_2_energy"+ Mark[2]]

        new_data["data"]["total_ll_power"+ Mark[3]] = new_data["data"]["ll_1_power" + Mark[3]] + new_data["data"]["ll_2_power" + Mark[3]] + new_data["data"]["ll_3_power" + Mark[3]] + new_data["data"]["ll_4_power" + Mark[3]] + new_data["data"]["ll_5_power" + Mark[3]]
        new_data["data"]["total_ll_energy"+ Mark[3]] = new_data["data"]["ll_1_energy"+ Mark[3]] + new_data["data"]["ll_2_energy"+ Mark[3]] + new_data["data"]["ll_3_energy"+ Mark[3]] + new_data["data"]["ll_4_energy"+ Mark[3]] + new_data["data"]["ll_5_energy"+ Mark[3]]

        new_data["data"]["total_ll_power"+ Mark[4]] = new_data["data"]["ll_1_power" + Mark[4]]
        new_data["data"]["total_ll_energy"+ Mark[4]] = new_data["data"]["ll_1_energy"+ Mark[4]]

        new_data["data"]["total_ll_power"+ Mark[5]] = new_data["data"]["ll_1_power" + Mark[5]]
        new_data["data"]["total_ll_energy"+ Mark[5]] = new_data["data"]["ll_1_energy"+ Mark[5]]

        new_data["data"]["total_ll_power"+ Mark[6]] = new_data["data"]["ll_1_power" + Mark[6]]
        new_data["data"]["total_ll_energy"+ Mark[6]] = new_data["data"]["ll_1_energy"+ Mark[6]]

        new_data["data"]["total_ll_power"+ Mark[7]] = new_data["data"]["ll_1_power" + Mark[7]]
        new_data["data"]["total_ll_energy"+ Mark[7]] = new_data["data"]["ll_1_energy"+ Mark[7]]



        data.append(new_data)

        return data

class OUTLET_LT3_SPM20(Device):
    def process_raw_data(self, raw_data):
        data = []
        Mark = ["_Staff", "_Manager_2", "_Pentry", "_Director", "_Manager_1", "_Floor_4", "Toilet"]

        ### director 2
        new_data = {}
        new_data["username"] = "dcim_modular_mqtt"
        new_data["password"] = "Pws212121"
        new_data["data"] = {
            "outlet_1_power" + Mark[0]: raw_data["Branch1_S"] if "Branch1_S" in raw_data else None,
            "outlet_1_energy" + Mark[0]: raw_data["Branch1_E_Active"] if "Branch1_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[0]: raw_data["Branch1_Current"] if "Branch1_Current" in raw_data else None,
            "outlet_2_power" + Mark[0]: raw_data["Branch5_S"] if "Branch5_S" in raw_data else None,
            "outlet_2_energy" + Mark[0]: raw_data["Branch5_E_Active"] if "Branch5_E_Active" in raw_data else None,
            "outlet_2_current" + Mark[0]: raw_data["Branch5_Current"] if "Branch5_Current" in raw_data else None,
            "outlet_3_power" + Mark[0]: raw_data["Branch6_S"] if "Branch6_S" in raw_data else None,
            "outlet_3_energy" + Mark[0]: raw_data["Branch6_E_Active"] if "Branch6_E_Active" in raw_data else None,
            "outlet_3_current" + Mark[0]: raw_data["Branch6_Current"] if "Branch6_Current" in raw_data else None,
            "outlet_4_power" + Mark[0]: raw_data["Branch20_S"] if "Branch20_S" in raw_data else None,
            "outlet_4_energy" + Mark[0]: raw_data["Branch20_E_Active"] if "Branch20_E_Active" in raw_data else None,
            "outlet_4_current" + Mark[0]: raw_data["Branch20_Current"] if "Branch20_Current" in raw_data else None,
            "outlet_5_power" + Mark[0]: raw_data["Branch17_S"] if "Branch17_S" in raw_data else None,
            "outlet_5_energy" + Mark[0]: raw_data["Branch17_E_Active"] if "Branch17_E_Active" in raw_data else None,
            "outlet_5_current" + Mark[0]: raw_data["Branch17_Current"] if "Branch17_Current" in raw_data else None,

            "outlet_1_power" + Mark[1]: raw_data["Branch2_S"] if "Branch2_S" in raw_data else None,
            "outlet_1_energy" + Mark[1]: raw_data["Branch2_E_Active"] if "Branch2_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[1]: raw_data["Branch2_Current"] if "Branch2_Current" in raw_data else None,
            "outlet_2_power" + Mark[1]: raw_data["Branch11_S"] if "Branch11_S" in raw_data else None,
            "outlet_2_energy" + Mark[1]: raw_data["Branch11_E_Active"] if "Branch11_E_Active" in raw_data else None,
            "outlet_2_current" + Mark[1]: raw_data["Branch11_Current"] if "Branch11_Current" in raw_data else None,
            "outlet_3_power" + Mark[1]: raw_data["Branch7_S"] /3 if "Branch7_S" in raw_data else None,
            "outlet_3_energy" + Mark[1]: raw_data["Branch7_E_Active"]/3 if "Branch7_E_Active" in raw_data else None,
            "outlet_3_current" + Mark[1]: raw_data["Branch7_Current"]/3 if "Branch7_Current" in raw_data else None,

            "outlet_1_power" + Mark[2]: raw_data["Branch3_S"] if "Branch3_S" in raw_data else None,
            "outlet_1_energy" + Mark[2]: raw_data["Branch3_E_Active"] if "Branch3_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[2]: raw_data["Branch3_Current"] if "Branch3_Current" in raw_data else None,
            "outlet_2_power" + Mark[2]: raw_data["Branch4_S"] if "Branch4_S" in raw_data else None,
            "outlet_2_energy" + Mark[2]: raw_data["Branch4_E_Active"] if "Branch4_E_Active" in raw_data else None,
            "outlet_2_current" + Mark[2]: raw_data["Branch4_Current"] if "Branch4_Current" in raw_data else None,
            "outlet_3_power" + Mark[2]: raw_data["Branch10_S"] if "Branch10_S" in raw_data else None,
            "outlet_3_energy" + Mark[2]: raw_data["Branch10_E_Active"] if "Branch10_E_Active" in raw_data else None,
            "outlet_3_current" + Mark[2]: raw_data["Branch10_Current"] if "Branch10_Current" in raw_data else None,
            "outlet_4_power" + Mark[2]: raw_data["Branch12_S"] if "Branch12_S" in raw_data else None,
            "outlet_4_energy" + Mark[2]: raw_data["Branch12_E_Active"] if "Branch12_E_Active" in raw_data else None,
            "outlet_4_current" + Mark[2]: raw_data["Branch12_Current"] if "Branch12_Current" in raw_data else None,
            "outlet_5_power" + Mark[2]: raw_data["Branch15_S"] if "Branch15_S" in raw_data else None,
            "outlet_5_energy" + Mark[2]: raw_data["Branch15_E_Active"] if "Branch15_E_Active" in raw_data else None,
            "outlet_5_current" + Mark[2]: raw_data["Branch15_Current"] if "Branch15_Current" in raw_data else None,
            "outlet_6_power" + Mark[2]: raw_data["Branch16_S"] if "Branch16_S" in raw_data else None,
            "outlet_6_energy" + Mark[2]: raw_data["Branch16_E_Active"] if "Branch16_E_Active" in raw_data else None,
            "outlet_6_current" + Mark[2]: raw_data["Branch16_Current"] if "Branch16_Current" in raw_data else None,
            "outlet_7_power" + Mark[2]: raw_data["Branch18_S"] if "Branch18_S" in raw_data else None,
            "outlet_7_energy" + Mark[2]: raw_data["Branch18_E_Active"] if "Branch18_E_Active" in raw_data else None,
            "outlet_7_current" + Mark[2]: raw_data["Branch18_Current"] if "Branch18_Current" in raw_data else None,

            "outlet_1_power" + Mark[3]: raw_data["Branch7_S"]/3 if "Branch7_S" in raw_data else None,
            "outlet_1_energy"+ Mark[3]: raw_data["Branch7_E_Active"]/3 if "Branch7_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[3]: raw_data["Branch7_Current"]/3 if "Branch7_Current" in raw_data else None,
        
            "outlet_1_power"+ Mark[4]: raw_data["Branch7_S"]/3 if "Branch7_S" in raw_data else None,
            "outlet_1_energy"+ Mark[4]: raw_data["Branch7_E_Active"]/3 if "Branch7_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[4]: raw_data["Branch7_Current"]/3 if "Branch7_Current" in raw_data else None,

            "outlet_1_power"+ Mark[5]: raw_data["Branch13_S"] if "Branch13_S" in raw_data else None,
            "outlet_1_energy"+ Mark[5]: raw_data["Branch13_E_Active"] if "Branch13_E_Active" in raw_data else None,
            "outlet_1_current" + Mark[5]: raw_data["Branch13_Current"] if "Branch13_Current" in raw_data else None,
        
            "outlet_1_power"+ Mark[6]: raw_data["Branch9_S"] if "Branch9_S" in raw_data else None, # meja 1,2,3
            "outlet_1_energy"+ Mark[6]: raw_data["Branch9_E_Active"] if "Branch9_E_Active" in raw_data else None, # meja 1,2,3
            "outlet_1_current" + Mark[6]: raw_data["Branch9_Current"] if "Branch9_Current" in raw_data else None,
            "outlet_2_power"+ Mark[6]: raw_data["Branch19_S"] if "Branch19_S" in raw_data else None,  # meja 4,5,6
            "outlet_2_energy"+ Mark[6]: raw_data["Branch19_E_Active"] if "Branch19_E_Active" in raw_data else None,  # meja 4,5,6
            "outlet_2_current" + Mark[6]: raw_data["Branch19_Current"] if "Branch19_Current" in raw_data else None,

            "voltage_1": raw_data["V_1"] if "V_1" in raw_data else None,
            "voltage_2": raw_data["V_2"] if "V_2" in raw_data else None,
            "voltage_3": raw_data["V_3"] if "V_3" in raw_data else None,
            "Frequency": raw_data["Freq"] if "Freq" in raw_data else None,

            "Overvoltage_Alarm": raw_data["Overvoltage_Alarm"] if "Overvoltage_Alarm" in raw_data else None,
            "Overcurrent_1_16_Alarm": raw_data["Overcurrent_1_16_Alarm"] if "Overcurrent_1_16_Alarm" in raw_data else None,
            "Overcurrent_17_30_Alarm": raw_data["Overcurrent_17_30_Alarm"] if "Overcurrent_17_30_Alarm" in raw_data else None,
        }
        new_data["data"]["total_outlet_power"+ Mark[0]] = new_data["data"]["outlet_1_power"+ Mark[0]] + new_data["data"]["outlet_2_power"+ Mark[0]] + new_data["data"]["outlet_3_power"+ Mark[0]] + new_data["data"]["outlet_4_power"+ Mark[0]] + new_data["data"]["outlet_5_power"+ Mark[0]]
        new_data["data"]["total_outlet_energy"+ Mark[0]] = new_data["data"]["outlet_1_energy"+ Mark[0]] + new_data["data"]["outlet_2_energy"+ Mark[0]] + new_data["data"]["outlet_3_energy"+ Mark[0]] + new_data["data"]["outlet_4_energy"+ Mark[0]] + new_data["data"]["outlet_5_energy"+ Mark[0]]

        new_data["data"]["total_outlet_power"+ Mark[1]] = new_data["data"]["outlet_1_power"+ Mark[1]]+ new_data["data"]["outlet_2_power"+ Mark[1]] + new_data["data"]["outlet_3_power"+ Mark[1]]
        new_data["data"]["total_outlet_energy"+ Mark[1]] = new_data["data"]["outlet_1_energy"+ Mark[1]]+ new_data["data"]["outlet_2_energy"+ Mark[1]] + new_data["data"]["outlet_3_energy"+ Mark[1]]

        new_data["data"]["total_outlet_power"+ Mark[2]] = new_data["data"]["outlet_1_power"+ Mark[2]] + new_data["data"]["outlet_2_power"+ Mark[2]] + new_data["data"]["outlet_3_power"+ Mark[2]] + new_data["data"]["outlet_4_power"+ Mark[2]] + new_data["data"]["outlet_5_power"+ Mark[2]]+ new_data["data"]["outlet_6_power"+ Mark[2]] + new_data["data"]["outlet_7_power"+ Mark[2]]
        new_data["data"]["total_outlet_energy"+ Mark[2]] = new_data["data"]["outlet_1_energy"+ Mark[2]]+ new_data["data"]["outlet_2_energy"+ Mark[2]] + new_data["data"]["outlet_3_energy"+ Mark[2]] + new_data["data"]["outlet_4_energy"+ Mark[2]] + new_data["data"]["outlet_5_energy"+ Mark[2]]+ new_data["data"]["outlet_7_energy"+ Mark[2]] + new_data["data"]["outlet_7_energy"+ Mark[2]]

        new_data["data"]["total_outlet_power"+ Mark[3]] = new_data["data"]["outlet_1_power"+ Mark[3]]
        new_data["data"]["total_outlet_energy"+ Mark[3]] = new_data["data"]["outlet_1_energy"+ Mark[3]]

        new_data["data"]["total_outlet_power"+ Mark[4]] = new_data["data"]["outlet_1_power"+ Mark[4]]
        new_data["data"]["total_outlet_energy"+ Mark[4]] = new_data["data"]["outlet_1_energy"+ Mark[4]]

        new_data["data"]["total_outlet_power"+ Mark[5]] = new_data["data"]["outlet_1_power"+ Mark[5]]
        new_data["data"]["total_outlet_energy"+ Mark[5]] = new_data["data"]["outlet_1_energy"+ Mark[5]]

        new_data["data"]["total_outlet_power"+ Mark[6]] = new_data["data"]["outlet_1_power"+ Mark[6]] + new_data["data"]["outlet_2_power"+ Mark[6]]
        new_data["data"]["total_outlet_energy"+ Mark[6]] = new_data["data"]["outlet_1_energy"+ Mark[6]] + new_data["data"]["outlet_2_energy"+ Mark[6]]
        data.append(new_data)

        return data
