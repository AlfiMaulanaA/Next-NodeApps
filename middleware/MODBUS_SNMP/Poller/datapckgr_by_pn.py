from curses import raw
from pickle import NONE
import pprint
from re import L
import traceback
from unicodedata import decimal
pp = pprint.PrettyPrinter(indent=4)

####################################### DEVICE CLASS #######################################
# Function to read specific bit value of a binary data
def readbitval(data, bitnumber):
    dat = data
    mask = 2**bitnumber
    c = dat & mask
    c = c>>bitnumber
    return c

"""
MANU_PN_LIST = ["Envicool_DC03HDNC1A", "Eaton_EDPU", "Eaton_EFLXN04", "Tripplite_PDUMNV32HV2LX",
           "Tripplite_PDUMNH32HV", "Tripplite_SRXCOOL7KRM", "Eaton_SC200", "DPC_SC501", "Hitachi_HR11",
           "Socomec_NETYS", "Socomec_ITYS", "Socomec_MASTERYS", "Panasonic_DCB105ZK", "Pilot_PBAT600",
            "Pilot_SPM33", "Pilot_SPM91", "Pilot_SPM20", "Schneider_PM1200", "Schneider_PM2200", "ABB_M4M30", 
            "ABB_ATS022", "ABB_RVT", "Envicool_EIA05CPNC1E", "Envicool_EF20CDNC1B", "Kehua_KR3000RM", 
            "ABB_CMS700", "APC_AP8853", "IOT_CAN_SENSOR", "GPIO_Doorswitch"
           ]
"""
MANU_PN_LIST = ["STMicroelectronics_LIS3DHTR", "Shoto_SDA10_48100","Pilot_PBAT600","Pilot_DFPM971","Pilot_DFPM20D","Pilot_PMAC770","Pilot_SPM90_DFPM90","ABB_RVT", "ABB_ATS022", "ABB_CMS700","Schneider_Altivar71", "Socomec_DIRIS_A20", "Schneider_PM5100_PM5300", "PM800", "Deepsea_Electronic_DSE8610MKII", "Schneider_ATV320"]

class STMicroelectronics_LIS3DHTR(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}

        raw_data["Detect_movement"] = 0

        # Cek dan buat file JSON jika belum ada
        json_path = "JSON/Data/STMicroelectronics_LIS3DHTR.json"
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        if not os.path.isfile(json_path):
            with open(json_path, "w") as f:
                f.write(json.dumps(raw_data))
        else:
            THRESHOLD = 0.05
            with open(json_path, "r") as f:
                    old_data = json.load(f)
            print(old_data)
            ts1 = raw_data.get("Timestamp")
            ts2 = old_data.get("Timestamp")
            dt1 = datetime.strptime(ts1, "%Y-%m-%d %H:%M:%S")
            dt2 = datetime.strptime(ts2, "%Y-%m-%d %H:%M:%S")
            diff_sec = abs((dt1 - dt2).total_seconds())
            if diff_sec >= 3600:
                with open(json_path, "w") as f:
                    f.write(json.dumps(raw_data))
            else:
                if (
                    abs(raw_data.get("Accel_X", 0) - old_data.get("Accel_X", 0)) >= THRESHOLD or
                    abs(raw_data.get("Accel_Y", 0) - old_data.get("Accel_Y", 0)) >= THRESHOLD or
                    abs(raw_data.get("Accel_Z", 0) - old_data.get("Accel_Z", 0)) >= THRESHOLD
                ):
                    raw_data["Detect_movement"] = 1
                else:
                    raw_data["Detect_movement"] = 0

        data = dict(raw_data)
        return data

    def write(self):
        pass

class Shoto_SDA10_48100(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}
        System_Event = {
            "Over Voltage Protect" :0,
            "Under Voltage Protect" :0,
            "Charge over current Protect" :0,
            "Discharge over current Protect" :0,
            "Short/Reverse circuit Protect" :0,
            "High temperature Protect" :0,
            "SOC Low alarm" :0,
            "Discharging" :0,
            "Chargeing" :0,
            "Charge Online" :0
        }
        System_Event["Over Voltage Protect"] = readbitval(raw_data["System Event"], 0)
        System_Event["Under Voltage Protect"] = readbitval(raw_data["System Event"], 1)
        System_Event["Charge over current Protect"] = readbitval(raw_data["System Event"], 2)
        System_Event["Discharge over current Protect"] = readbitval(raw_data["System Event"], 3)
        System_Event["Short/Reverse circuit Protect"] = readbitval(raw_data["System Event"], 4)
        System_Event["High temperature Prtect"] = readbitval(raw_data["System Event"], 5)
        System_Event["SOC Low alarm"] = readbitval(raw_data["System Event"], 6)
        System_Event["Discharging"] = readbitval(raw_data["System Event"], 7)
        System_Event["Chargeing"] = readbitval(raw_data["System Event"], 8)
        System_Event["Charge Online"] = readbitval(raw_data["System Event"], 9)

        raw_data["System Event"] = System_Event

        data = dict(raw_data)
        return data

    def write(self):
        pass

class Pilot_DFPM971(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}
        
        alarm_status = {
            "Phase A voltage overvoltage" : 0, 
            "Phase B voltage overvoltage" : 0, 
            "Phase C voltage overvoltage" : 0, 
            "Phase A voltage undervoltage" : 0, 
            "Phase B voltage undervoltage" : 0, 
            "Phase C voltage undervoltage" : 0,
            "Voltage phase loss"           : 0, 
            "Phase A current overcurrent"   : 0, 
            "Phase B current overcurrent"   : 0, 
            "Phase C current overcurrent"   : 0, 
            "Phase A current undercurrent"  : 0, 
            "Phase B current undercurrent"  : 0,
            "Phase C current undercurrent"  : 0, 
            "Overload"                      : 0,
            "Frequency is too high"         : 0, 
            "Frequency is too low"          : 0, 
            "Leakage current overcurrent"   : 0, 
            "Temperature 1 over temperature": 0, 
            "Temperature 2 over temperature": 0,
            "Temperature 3 over temperature": 0, 
            "Temperature 4 over temperature": 0, 
            "Switch value 1 off"            : 0
            }
        
        alarm_status["Phase A voltage overvoltage"] = readbitval(raw_data["Alarm status"], 0)
        alarm_status["Phase B voltage overvoltage"] = readbitval(raw_data["Alarm status"], 1)
        alarm_status["Phase C voltage overvoltage"] = readbitval(raw_data["Alarm status"], 2)
        alarm_status["Phase A voltage undervoltage"] = readbitval(raw_data["Alarm status"], 3)
        alarm_status["Phase B voltage undervoltage"] = readbitval(raw_data["Alarm status"], 4)
        alarm_status["Phase C voltage undervoltage"] = readbitval(raw_data["Alarm status"], 5)
        alarm_status["Voltage phase loss"]           = readbitval(raw_data["Alarm status"], 6)
        alarm_status["Phase A current overcurrent"] = readbitval(raw_data["Alarm status"], 7)
        alarm_status["Phase B current overcurrent"] = readbitval(raw_data["Alarm status"], 8)
        alarm_status["Phase C current overcurrent"] = readbitval(raw_data["Alarm status"], 9)
        alarm_status["Phase A current undercurrent"] = readbitval(raw_data["Alarm status"], 10)
        alarm_status["Phase B current undercurrent"] = readbitval(raw_data["Alarm status"], 11)
        alarm_status["Phase C current undercurrent"] = readbitval(raw_data["Alarm status"], 12)
        alarm_status["Overloade"]                    = readbitval(raw_data["Alarm status"], 13)
        alarm_status["Frequency is too high"] = readbitval(raw_data["Alarm status"], 14)
        alarm_status["Frequency is too low"] = readbitval(raw_data["Alarm status"], 15)
        alarm_status["Leakage current overcurrent"] = readbitval(raw_data["Alarm status"], 16)
        alarm_status["Temperature 1 over temperature"] = readbitval(raw_data["Alarm status"], 17)
        alarm_status["Temperature 2 over temperature"] = readbitval(raw_data["Alarm status"], 18)
        alarm_status["Temperature 3 over temperature"] = readbitval(raw_data["Alarm status"], 19)
        alarm_status["Temperature 4 over temperature"] = readbitval(raw_data["Alarm status"], 20)
        alarm_status["Switch value 1 off"] = readbitval(raw_data["Alarm status"], 21)

        raw_data["Alarm status"] = alarm_status
        
        wiring_mode = ["Four-line star", ": Three-line triangle"]
        raw_data["Wiring mode"] = wiring_mode[raw_data["Wiring mode"]]

        phase = ["","Phase A", "Phase B", "Phase C"]
        raw_data["A phase current phase sequence adjustment"] = phase[raw_data["A phase current phase sequence adjustment"]]
        raw_data["B phase current phase sequence adjustment"] = phase[raw_data["B phase current phase sequence adjustment"]]
        raw_data["C phase current phase sequence adjustment"] = phase[raw_data["C phase current phase sequence adjustment"]]

        demand_mode = ["fixed_mode", "slip mode"]
        raw_data["Demand mode"] = demand_mode[raw_data["Demand mode"]]
      
        raw_data["Demand cycle"] = str(raw_data["Demand cycle"]) + " min"

        raw_data["Slip time"] = str(raw_data["Slip time"]) + " min"

        Whether_the_pulse_is_on = ["closed", "open"]
        raw_data["Whether the pulse is on"] = Whether_the_pulse_is_on[raw_data["Whether the pulse is on"]]

        Pulse_output_method = ["active pulse output", "Reactive pulse output"]
        raw_data["Pulse output method"] = Pulse_output_method[raw_data["Pulse output method"]]

        data = dict(raw_data)
        return data

    def write(self):
        pass

class Pilot_DFPM20D(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}

        Voltage_Over_Limit_Alarm_Status = {
            "Low Voltage Alarm" : 0,
            "High Voltage Alarm" : 0
        }
        Voltage_Over_Limit_Alarm_Status["Low Voltage Alarm"] = readbitval(raw_data["Voltage Over Limit Alarm Status"], 0)
        Voltage_Over_Limit_Alarm_Status["High Voltage Alarm"] = readbitval(raw_data["Voltage Over Limit Alarm Status"], 1)

        raw_data["Voltage Over Limit Alarm Status"] = Voltage_Over_Limit_Alarm_Status

        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status = {
            "Branch Circuit 1" : 0,
            "Branch Circuit 2" : 0,
            "Branch Circuit 3" : 0,
            "Branch Circuit 4" : 0,
            "Branch Circuit 5" : 0,
            "Branch Circuit 6" : 0,
            "Branch Circuit 7" : 0,
            "Branch Circuit 8" : 0,
            "Branch Circuit 9" : 0,
            "Branch Circuit 10" : 0,
            "Branch Circuit 11" : 0,
            "Branch Circuit 12" : 0,
        }
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 1"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 0)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 2"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 1)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 3"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 2)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 4"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 3)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 5"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 4)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 6"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 5)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 7"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 6)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 8"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 7)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 9"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 8)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 10"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 9)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 11"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 10)
        Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status["Branch Circuit 12"] = readbitval(raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"], 11)

        raw_data["Branch Circuit 1~12 Current Over Limit Alarm Status"] = Branch_Circuit_1_12_Current_Over_Limit_Alarm_Status

        Branch_Circuit_1_12_Communication_Failure_status = {
            "Branch Circuit 1" : 0,
            "Branch Circuit 2" : 0,
            "Branch Circuit 3" : 0,
            "Branch Circuit 4" : 0,
            "Branch Circuit 5" : 0,
            "Branch Circuit 6" : 0,
            "Branch Circuit 7" : 0,
            "Branch Circuit 8" : 0,
            "Branch Circuit 9" : 0,
            "Branch Circuit 10" : 0,
            "Branch Circuit 11" : 0,
            "Branch Circuit 12" : 0,
        }
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 1"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 0)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 2"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 1)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 3"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 2)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 4"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 3)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 5"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 4)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 6"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 5)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 7"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 6)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 8"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 7)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 9"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 8)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 10"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 9)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 11"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 10)
        Branch_Circuit_1_12_Communication_Failure_status["Branch Circuit 12"] = readbitval(raw_data["Branch Circuit 1~12 Communication Failure Status"], 11)

        raw_data["Branch Circuit 1~12 Communication Failure Status"] = Branch_Circuit_1_12_Communication_Failure_status

        baud_rate = ["4800","9600","19200"]
        raw_data["Communication Baudrate"] = baud_rate[raw_data["Communication Baudrate"]]

        data = dict(raw_data)
        return data

    def write(self):
        pass

class Pilot_PMAC770(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}

        Phase_voltage_deviation = ["Va", "Vb", "Vc"]

        #for i in range(30):
        #    print(raw_data["Phase voltage deviation " + str(i+1)])
        #    raw_data["Phase voltage deviation " + str(i+1)] = Phase_voltage_deviation[raw_data["Phase voltage deviation " + str(i+1)]]
        Connection_mode = ["3 phase 4 wire", "3 phase 3 wire", "single phase"]
        raw_data["Connection mode"] = Connection_mode[raw_data["Connection mode"]]

        Demand_calculation_mode = ["Fixed block", "Rolling block"]
        raw_data["Demand calculation mode"] = Demand_calculation_mode[raw_data["Demand calculation mode"]]

        Demand_interval = ["5min", "10min", "15min", "30min", "60min"] 
        raw_data["Demand interval"] = Demand_interval[raw_data["Demand interval"]]

        Subinterval = ["1min", "2min", "3min", "5min"] 
        raw_data["Subinterval"] = Subinterval[raw_data["Subinterval"]]

        Object_analog_output = ["Null", "Va", "Vb", "Vc", "Vab", "Vbc", "Vca", "Ia", "Ib", "Ic", "Ptot", "Qtot", "PFtot", "Frequency"]
        raw_data["Object, analog output-1"] = Object_analog_output[raw_data["Object, analog output-1"]]
        raw_data["Object, analog output-2"] = Object_analog_output[raw_data["Object, analog output-2"]]

        Control_mode_relay = ["Local", "Remote"]
        raw_data["Control mode, relay-1"] = Control_mode_relay[raw_data["Control mode, relay-1"]]
        raw_data["Control mode, relay-2"] = Control_mode_relay[raw_data["Control mode, relay-2"]]
        raw_data["Control mode, relay-3"] = Control_mode_relay[raw_data["Control mode, relay-3"]]
        raw_data["Control mode, relay-4"] = Control_mode_relay[raw_data["Control mode, relay-4"]]


        object_relay = ["Null", "Frequency", "Va", "Vb", "Vc", "Neutral voltage", "Average Vph-N", "Vab", "Vbc", "Vca", "Average Vph-ph", "Ia", "Ib", "Ic", "Neutral current", "Average current", "PFa", "PFb", 
                        "PFc", "PFtot", "Voltage unbalance", "THD for Va", "THD for Vb", "THD for VC", "THD for Ia", "THD for Ib", "THD for Ic"]
        raw_data["Object, relay-1"] = object_relay[raw_data["Object, relay-1"]]
        raw_data["Object, relay-2"] = object_relay[raw_data["Object, relay-2"]]
        raw_data["Object, relay-3"] = object_relay[raw_data["Object, relay-3"]]
        raw_data["Object, relay-4"] = object_relay[raw_data["Object, relay-4"]]

        running_mode = ["No", "Voltage", "Current", "Power"]
        raw_data["Running Mode"] = running_mode[raw_data["Running Mode"]]
        
        data = dict(raw_data)
        return data

    def write(self):
        pass

class Pilot_SPM90_DFPM90(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}

        measurement_voltage_direction = ["measurement voltage is positive", "measurement voltage is reversed"]
        raw_data["Measuring voltage direction"] =  measurement_voltage_direction[raw_data["Measuring voltage direction"]]

        baud_rate = ["2400","4800","9600","19200"]
        raw_data["Baud rate"] = baud_rate[raw_data["Baud rate"]]

        wiring = ["Standart Wiring", "Non Standart Wiring"]
        raw_data["Wiring"] = wiring[raw_data["Wiring"]]

        Communication_default= ["modbus", "DLT645"]
        raw_data["Communication default"] = Communication_default[raw_data["Communication default"]]

        data = dict(raw_data)
        return data

    def write(self):
        pass

# General Device Class
class Pilot_SPM206(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}

        Alarm_Info_of_Main_circuit = {
            "current low-low-limit alarm" :0,
            "current low-limit alarm" : 0,
            "current high-limit alarm" : 0,
            "current high-high-limit alarm" : 0,
            "neutral current high-limit alarm" : 0,
            "current unbalance alarm" : 0,
            "frequency low-limit alarm": 0,
            "frequency high-limit alarm": 0,
            "low voltage alarm": 0,
            "high voltage alarm": 0,
            "leakage current high-limit alarm": 0,
            "temperature high-limit alarm": 0,
            "neutral-earth voltage high-limit alarm" : 0,
            "main circuit voltage phase loss alarm" : 0,
            "main circuit voltage phase sequence error alarm": 0
        }

        Alarm_Info_of_Main_circuit["current low-low-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 0)
        Alarm_Info_of_Main_circuit["current low-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 1)
        Alarm_Info_of_Main_circuit["current high-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 2)
        Alarm_Info_of_Main_circuit["current high-high-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 3)
        Alarm_Info_of_Main_circuit["neutral current high-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 4)
        Alarm_Info_of_Main_circuit["current unbalance alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 5)
        Alarm_Info_of_Main_circuit["frequency low-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 6)
        Alarm_Info_of_Main_circuit["frequency high-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 7)
        Alarm_Info_of_Main_circuit["low voltage alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 8)
        Alarm_Info_of_Main_circuit["high voltage alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 9)
        Alarm_Info_of_Main_circuit["leakage current high-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 10)
        Alarm_Info_of_Main_circuit["temperature high-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 11)
        Alarm_Info_of_Main_circuit["neutral-earth voltage high-limit alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 12)
        Alarm_Info_of_Main_circuit["main circuit voltage phase loss alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 13)
        Alarm_Info_of_Main_circuit["main circuit voltage phase sequence error alarm"] = readbitval(raw_data["Alarm Info of Main circuit"], 14)
        
        raw_data["Alarm Info of Main circuit"] = Alarm_Info_of_Main_circuit

        switch_off_alarm_main_circuit = {
            "S1 Status" : 0,
            "S2 Status" : 0,
            "S3 Status" : 0,
            "S4 Status" : 0
        }
        switch_off_alarm_main_circuit["S1 Status"] = readbitval(raw_data["Switch off alarm of Main circuit"], 0)
        switch_off_alarm_main_circuit["S2 Status"] = readbitval(raw_data["Switch off alarm of Main circuit"], 1)
        switch_off_alarm_main_circuit["S3 Status"] = readbitval(raw_data["Switch off alarm of Main circuit"], 2)
        switch_off_alarm_main_circuit["S4 Status"] = readbitval(raw_data["Switch off alarm of Main circuit"], 3)
        
        raw_data["Switch off alarm of Main circuit"] = switch_off_alarm_main_circuit

        di_and_relay_main_module = {
            "DI 1 Status" : 0,
            "DI 2 Status" : 0,
            "DI 3 Status" : 0,
            "DI 4 Status" : 0,
            "Relay 1 Status" : 0,
            "Relay 2 Status" : 0
        }
        di_and_relay_main_module["DI 1 Status"] = readbitval(raw_data["DI and relay output status of main module"], 0)
        di_and_relay_main_module["DI 2 Status"] = readbitval(raw_data["DI and relay output status of main module"], 1)
        di_and_relay_main_module["DI 3 Status"] = readbitval(raw_data["DI and relay output status of main module"], 2)
        di_and_relay_main_module["DI 4 Status"] = readbitval(raw_data["DI and relay output status of main module"], 3)
        di_and_relay_main_module["Relay 1 Status"] = readbitval(raw_data["DI and relay output status of main module"], 8)
        di_and_relay_main_module["Relay 2 Status"] = readbitval(raw_data["DI and relay output status of main module"], 9)
        raw_data["DI and relay output status of main module"] = di_and_relay_main_module

        alarm_info_of_branch_circuit = {
            "current low-low-limit alarm" : 0,
            "current low-limit alarm" : 0,
            "current high-limit alarm" : 0,
            "current high-high-limit alarm" : 0,
            "branch circuit switch off alarm" : 0,
            "branch circuit switch fault alarm" : 0 
        }

        for i in range(42):
            keyvalue = "Alarm info of branch circuit " + str(i+1)
            alarm_info_of_branch_circuit["current low-low-limit alarm"] = readbitval(raw_data[keyvalue], 0)
            alarm_info_of_branch_circuit["current low-limit alarm"] = readbitval(raw_data[keyvalue], 1)
            alarm_info_of_branch_circuit["current high-limit alarm"] = readbitval(raw_data[keyvalue], 3)
            alarm_info_of_branch_circuit["current high-high-limit alarm"] = readbitval(raw_data[keyvalue], 3)
            alarm_info_of_branch_circuit["branch circuit switch off alarm"] = readbitval(raw_data[keyvalue], 14)
            alarm_info_of_branch_circuit["branch circuit switch fault alarm"] = readbitval(raw_data[keyvalue], 15)

            raw_data[keyvalue] = alarm_info_of_branch_circuit

            
        relay_function = ["means universal relay", "means working indicate", "means alarm output", "means main circuit alarm output", 
                                "means branch circuit alarm output", "means temperature alarm output"]

        raw_data["Relay 1 function"] = relay_function[raw_data["Relay 1 function"]]
        raw_data["Relay 2 function"] = relay_function[raw_data["Relay 2 function"]]

        DI_function = ["universal switch signal", "digital input of Main circuit", "spare/surge protection switch/SPD"]

        raw_data["DI 1 function of main module"] = DI_function[raw_data["DI 1 function of main module"]]
        raw_data["DI 2 function of main module"] = DI_function[raw_data["DI 2 function of main module"]]
        raw_data["DI 3 function of main module"] = DI_function[raw_data["DI 3 function of main module"]]
        raw_data["DI 4 function of main module"] = DI_function[raw_data["DI 4 function of main module"]]

        if raw_data["Energy pulse output circuit selection"] == 0:
            raw_data["Energy pulse output circuit selection"] = "Main circuit"
        else:
            raw_data["Energy pulse output circuit selection"] = "Branch circuit " + str(raw_data["Energy pulse output circuit selection"])

        DI_alarm = {
            "main circuit DI function" : 0,
            "fault alarm function" : 0
        }
        DI_alarm["main circuit DI function"] = readbitval(raw_data["DI alarm"], 0)
        DI_alarm["fault alarm function"] = readbitval(raw_data["DI alarm"], 1)
        raw_data["DI alarm"] = DI_alarm

        Main_circuit_digital_input_alarm_mode = {
            "DI 1 alarm mode alarm for switch" : 0,
            "DI 2 alarm mode alarm for switch" : 0,
            "DI 3 alarm mode alarm for switch" : 0,
            "DI 4 alarm mode alarm for switch" : 0 
        }
        Main_circuit_digital_input_alarm_mode["DI 1 alarm mode alarm for switch"] = readbitval(raw_data["Main circuit digital input alarm mode"], 0)
        Main_circuit_digital_input_alarm_mode["DI 2 alarm mode alarm for switch"] = readbitval(raw_data["Main circuit digital input alarm mode"], 1)
        Main_circuit_digital_input_alarm_mode["DI 3 alarm mode alarm for switch"] = readbitval(raw_data["Main circuit digital input alarm mode"], 2)
        Main_circuit_digital_input_alarm_mode["DI 4 alarm mode alarm for switch"] = readbitval(raw_data["Main circuit digital input alarm mode"], 3)
        raw_data["Main circuit digital input alarm mode"] = Main_circuit_digital_input_alarm_mode

        CT_onfig = ["50A", "100A", "200A", "400A", "600A", "25A"]
        raw_data["1st group CT config"] = CT_onfig[raw_data["1st group CT config"]]
        raw_data["2nd group CT config"] = CT_onfig[raw_data["2nd group CT config"]]
        raw_data["3rd group CT config"] = CT_onfig[raw_data["3rd group CT config"]]
        raw_data["4th group CT config"] = CT_onfig[raw_data["4th group CT config"]]
        raw_data["5th group CT config"] = CT_onfig[raw_data["5th group CT config"]]
        raw_data["6th group CT config"] = CT_onfig[raw_data["6th group CT config"]]
        raw_data["7th group CT config"] = CT_onfig[raw_data["7th group CT config"]]
        raw_data["8th group CT config"] = CT_onfig[raw_data["8th group CT config"]]
        raw_data["9th group CT config"] = CT_onfig[raw_data["9th group CT config"]]
        raw_data["10th group CT config"] = CT_onfig[raw_data["10th group CT config"]]
        raw_data["11th group CT config"] = CT_onfig[raw_data["11th group CT config"]]
        raw_data["12th group CT config"] = CT_onfig[raw_data["12th group CT config"]]
        raw_data["13th group CT config"] = CT_onfig[raw_data["13th group CT config"]]
        raw_data["14th group CT config"] = CT_onfig[raw_data["14th group CT config"]]

        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16 = {
            "Alarm for branch circuit 1" : 0,
            "Alarm for branch circuit 2" : 0,
            "Alarm for branch circuit 3" : 0,
            "Alarm for branch circuit 4" : 0,
            "Alarm for branch circuit 5" : 0,
            "Alarm for branch circuit 6" : 0,
            "Alarm for branch circuit 7" : 0,
            "Alarm for branch circuit 8" : 0,
            "Alarm for branch circuit 9" : 0,
            "Alarm for branch circuit 10" : 0,
            "Alarm for branch circuit 11" : 0,
            "Alarm for branch circuit 12" : 0,
            "Alarm for branch circuit 13" : 0,
            "Alarm for branch circuit 14" : 0,
            "Alarm for branch circuit 15" : 0,
            "Alarm for branch circuit 16" : 0
        }
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 1"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 0)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 2"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 1)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 3"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 2)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 4"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 3)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 5"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 4)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 6"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 5)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 7"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 6)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 8"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 7)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 9"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 8)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 10"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 9)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 11"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 10)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 12"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 11)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 13"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 12)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 14"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 13)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 15"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 14)
        Enable_Alarm_for_branch_switch_off_branch_circuit_1_16["Alarm for branch circuit 16"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 1-16"], 15)
        
        raw_data["Enable Alarm for branch switch off, branch circuit 1-16"] = Enable_Alarm_for_branch_switch_off_branch_circuit_1_16

        Enable_Alarm_for_branch_switch_off_branch_circuit_17_21 = {
            "Alarm for branch circuit 17" : 0,
            "Alarm for branch circuit 18" : 0,
            "Alarm for branch circuit 19" : 0,
            "Alarm for branch circuit 20" : 0,
            "Alarm for branch circuit 21" : 0
        }
        Enable_Alarm_for_branch_switch_off_branch_circuit_17_21["Alarm for branch circuit 17"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 17-21 "], 0)
        Enable_Alarm_for_branch_switch_off_branch_circuit_17_21["Alarm for branch circuit 18"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 17-21 "], 1)
        Enable_Alarm_for_branch_switch_off_branch_circuit_17_21["Alarm for branch circuit 19"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 17-21 "], 2)
        Enable_Alarm_for_branch_switch_off_branch_circuit_17_21["Alarm for branch circuit 20"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 17-21 "], 3)
        Enable_Alarm_for_branch_switch_off_branch_circuit_17_21["Alarm for branch circuit 21"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 17-21 "], 4)
        
        raw_data["Enable Alarm for branch switch off, branch circuit 17-21 "] = Enable_Alarm_for_branch_switch_off_branch_circuit_17_21

        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37 = {
            "Alarm for branch circuit 22" : 0,
            "Alarm for branch circuit 23" : 0,
            "Alarm for branch circuit 24" : 0,
            "Alarm for branch circuit 25" : 0,
            "Alarm for branch circuit 26" : 0,
            "Alarm for branch circuit 27" : 0,
            "Alarm for branch circuit 28" : 0,
            "Alarm for branch circuit 29" : 0,
            "Alarm for branch circuit 30" : 0,
            "Alarm for branch circuit 31" : 0,
            "Alarm for branch circuit 32" : 0,
            "Alarm for branch circuit 33" : 0,
            "Alarm for branch circuit 34" : 0,
            "Alarm for branch circuit 35" : 0,
            "Alarm for branch circuit 36" : 0,
            "Alarm for branch circuit 37" : 0
        }
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 22"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 0)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 23"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 1)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 24"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 2)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 25"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 3)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 26"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 4)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 27"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 5)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 28"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 6)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 29"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 7)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 30"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 8)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 31"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 9)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 32"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 10)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 33"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 11)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 34"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 12)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 35"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 13)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 36"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 14)
        Enable_Alarm_for_branch_switch_off_branch_circuit_22_37["Alarm for branch circuit 37"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "], 15)
        
        raw_data["Enable Alarm for branch switch off, branch circuit 22-37 "] = Enable_Alarm_for_branch_switch_off_branch_circuit_22_37

        Enable_Alarm_for_branch_switch_off_branch_circuit_38_42 = {
            "Alarm for branch circuit 38" : 0,
            "Alarm for branch circuit 39" : 0,
            "Alarm for branch circuit 40" : 0,
            "Alarm for branch circuit 41" : 0,
            "Alarm for branch circuit 42" : 0
        }
        Enable_Alarm_for_branch_switch_off_branch_circuit_38_42["Alarm for branch circuit 38"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 38-42 "], 0)
        Enable_Alarm_for_branch_switch_off_branch_circuit_38_42["Alarm for branch circuit 39"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 38-42 "], 1)
        Enable_Alarm_for_branch_switch_off_branch_circuit_38_42["Alarm for branch circuit 40"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 38-42 "], 2)
        Enable_Alarm_for_branch_switch_off_branch_circuit_38_42["Alarm for branch circuit 41"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 38-42 "], 3)
        Enable_Alarm_for_branch_switch_off_branch_circuit_38_42["Alarm for branch circuit 42"] = readbitval(raw_data["Enable Alarm for branch switch off, branch circuit 38-42 "], 4)
        
        raw_data["Enable Alarm for branch switch off, branch circuit 38-42 "] = Enable_Alarm_for_branch_switch_off_branch_circuit_38_42

        
        sequences = ["A","B", "C"]

        statval = raw_data['1st group CT phase position config']
        raw_data['1st group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['2nd group CT phase position config']
        raw_data['2nd group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['3rd group CT phase position config']
        raw_data['3rd group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['4th group CT phase position config']
        raw_data['4th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['5th group CT phase position config']
        raw_data['5th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['6th group CT phase position config']
        raw_data['6th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['7th group CT phase position config']
        raw_data['7th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['8th group CT phase position config']
        raw_data['8th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['9th group CT phase position config']
        raw_data['9th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['10th group CT phase position config']
        raw_data['10th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['11th group CT phase position config']
        raw_data['11th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['12th group CT phase position config']
        raw_data['12th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['13th group CT phase position config']
        raw_data['13th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"
        statval = raw_data['14th group CT phase position config']
        raw_data['14th group CT phase position config'] = sequences[(statval & 0xF00) >> 8] + sequences[(statval & 0xF0) >> 4] +  sequences[(statval & 0xF)] + " sequence"


        data = dict(raw_data)
        print("testing")
        return data

    def write(self):
        pass

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

####################################### Controller #######################################
class ABB_CMS700(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            ListBranchesAlarmStatus = [ "No Alarm",
                                    None, None, None, None, None, None, None, None, None, None,
                                    "Over Current TRMS", "Under Current TRMS",
                                    None, None, None, None, None, None, None ,None,
                                    "Over Active power P", "Under Active power P"
                                    ]

            raw_data["Alarm Status Branch 1"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 1"]]
            raw_data["Alarm Status Branch 2"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 2"]]
            raw_data["Alarm Status Branch 3"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 3"]]
            raw_data["Alarm Status Branch 4"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 4"]]
            raw_data["Alarm Status Branch 5"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 5"]]
            raw_data["Alarm Status Branch 6"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 6"]]
            raw_data["Alarm Status Branch 7"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 7"]]
            raw_data["Alarm Status Branch 8"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 8"]]
            raw_data["Alarm Status Branch 9"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 9"]]
            raw_data["Alarm Status Branch 10"] = ListBranchesAlarmStatus[raw_data["Alarm Status Branch 10"]]


            ListMainAlarmStatus = [ "No Alarm",
                                    None, None, None, None, None, None, None, None, None, None,
                                    "Over Current", "Under Current",
                                    None, None, None, None, None, None, None ,None,
                                    "Over THD Current", "Under THD Current",
                                    None, None, None, None, None, None, None ,None,
                                    "Over Voltage", "Under Voltage",
                                    None, None, None, None, None, None, None ,None,
                                    "Over THD Voltage", "Under THD Voltage",
                                    None, None, None, None, None, None, None ,None,
                                    "Over Active Power", "Under Active Power",
                                    None, None, None, None, None, None, None ,None,
                                    "Over Apparent Power", "Under Apparent Power",
                                    None, None, None, None, None, None, None ,None,
                                    "Over Reactive Power", "Under Reactive Power",
                                    None, None, None, None, None, None, None ,None,
                                    "Over Power factor", "Under Power factor",
                                    None, None, None, None, None, None, None ,None,
                                    None, None, None, None, None, None, None ,None, None, None,
                                    None, None, None, None, None, None, None ,None, None, None,
                                    None, None, None, None, None, None, None ,None, None, None,
                                    "Over Active Energy", "Under Active Energy"
                                    ]

            raw_data["Alarm Status Line L1"] = ListMainAlarmStatus[raw_data["Alarm Status Line L1"]]
            raw_data["Alarm Status Line L2"] = ListMainAlarmStatus[raw_data["Alarm Status Line L2"]]
            raw_data["Alarm Status Line L3"] = ListMainAlarmStatus[raw_data["Alarm Status Line L3"]]
            raw_data["Alarm Status Line  L4/N"] = ListMainAlarmStatus[raw_data["Alarm Status Line  L4/N"]]

            

            data = raw_data
            return data
        else:
            return -1

class Schneider_ATV320(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}

        #----------------------------------------------- Extended control word ----------------------------------------------------------------
        
        CMI  = ['Factory setting command (active at 1)', 'Save configuration to EEPROM non-volatile memory command (active at 1).', 'This Bit automatically changes to 0 after the request is taken into account. The command is only active if the drive is stopped, and not in "5-Operation enabled" state.',
                'Note: If CMI is a periodic network variable, the PLC program must write it to 0 after the first request is taken into account. The life of the EEPROM memory is limited to 100,000 write operations.', None, None, 
                None, None, None, 
                None,None, None, 
                "Definition of the frequency reference (LFr) and output frequency (rFr) unit: 0: 0.1 Hz", None, None, 
                None,None, None, 
                "Parameter consistency check deactivated"
                ]

        Extendedcontrolword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended control word"], each_bit)
            if bit_value == 1 and CMI[each_bit] != None:
                Extendedcontrolword.append(CMI[each_bit])
        
        if len(Extendedcontrolword) != 0:
            raw_data["Extended control word"] = ', '.join(Extendedcontrolword)
        else:
            raw_data["Status word frequency"] = None

        #---------------------------------------------------------DrivecomCmdReg-----------------------------------------------------------    

        CMD = ['Switch on/Contactor command.', 'Disable voltage/Authorization to supply AC power.', 'Quick stop.'
                'Enable operation/Run command.', None, None,
                None, 'Fault reset/error cleared on transition 0 to 1 .', 'Halt Stop according to the [Type of stop] (Stt) parameter without leaving the Operation enabled state.',
                None, None, None,
                None, None, None, 
                None
                ]

        DrivecomCmdReg = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["DrivecomCmdReg"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                DrivecomCmdReg.append(CMD[each_bit])
        
        if len(DrivecomCmdReg) != 0:
            raw_data["DrivecomCmdReg"] = ', '.join(DrivecomCmdReg)
        else:
            raw_data["DrivecomCmdReg"] = None

        Cmdword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Cmd word 0"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                Cmdword.append(CMD[each_bit])
        
        if len(Cmdword) != 0:
            raw_data["Cmd word 0"] = ', '.join(Cmdword)
        else:
            raw_data["Cmd word 0"] = None

        Cmdword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Cmd word 1"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                Cmdword.append(CMD[each_bit])
        
        if len(Cmdword) != 0:
            raw_data["Cmd word 1"] = ', '.join(Cmdword)
        else:
            raw_data["Cmd word 1"] = None

        Cmdword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Cmd word 2"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                Cmdword.append(CMD[each_bit])
        
        if len(Cmdword) != 0:
            raw_data["Cmd word 2"] = ', '.join(Cmdword)
        else:
            raw_data["Cmd word 2"] = None

        Cmdword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Cmd word 3"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                Cmdword.append(CMD[each_bit])
        
        if len(Cmdword) != 0:
            raw_data["Cmd word 3"] = ', '.join(Cmdword)
        else:
            raw_data["Cmd word 3"] = None

        Cmdword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Cmd word 4"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                Cmdword.append(CMD[each_bit])
        
        if len(Cmdword) != 0:
            raw_data["Cmd word 4"] = ', '.join(Cmdword)
        else:
            raw_data["Cmd word 4"] = None

        Cmdword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Cmd word 6"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                Cmdword.append(CMD[each_bit])
        
        if len(Cmdword) != 0:
            raw_data["Cmd word 6"] = ', '.join(Cmdword)
        else:
            raw_data["Cmd word 6"] = None

        Cmdword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Cmd word 7"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                Cmdword.append(CMD[each_bit])
        
        if len(Cmdword) != 0:
            raw_data["Cmd word 7"] = ', '.join(Cmdword)
        else:
            raw_data["Cmd word 7"] = None

        Cmdword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Cmd word 8"], each_bit)
            if bit_value == 1 and CMD[each_bit] != None:
                Cmdword.append(CMD[each_bit])
        
        if len(Cmdword) != 0:
            raw_data["Cmd word 8"] = ', '.join(Cmdword)
        else:
            raw_data["Cmd word 8"] = None

        #---------------------------------------------------------------Drive state------------------------------------------------------
        HMIS = ['Drive automatic tuning', 'Drive DC inj braking', 'Drive ready',
                'Drive freewheel stopping', 'Drive running', 'Drive accelerating',
                'Drive decelerating', 'Drive in current limit', 'Drive fast stopping',
                'Drive fluxing motor', 'Drive no line voltage', 'Drive in power removal', 
                'Drive control stopping', 'Drive dec ramp adaption', 'Drive cutting output',
                'Drive undervoltage alarm', 'Drive test in progress', 'In autotest',
                'Autotest err', 'Autotest OK', 'Eeprom test', 
                'Product in fault', 'DCP', 'SS1 active',
                'SLS active', 'STO active', None,
                None
                ]
        raw_data["Drive State"]= HMIS[raw_data["Drive state"]]

        #---------------------------------------------------------Extended state register-----------------------------------------------------------    

        ETI_1  = ['Access to the EEPROM non-volatile memory in progress', 'Parameter consistency check', 'The drive is in operating state "Fault" and the error is no longer active (not reset))',
                    None, 'The drive is in speed mode', 'DC injection active',
                    'Drive in transient state', 'Motor thermal state threshold reached for the active motor', 'DC bus overvoltage',
                    'Acceleration active', 'Deceleration active', 'Current limit active',
                    'Fast stop active', None, None,
                    'Reverse operation applied before the ramp'
                ]
        ETI_0  = [ None, 'No parameter consistency check', 'The drive is not in operating state "Fault" or in operating state "Fault" and the error is active',
                    None, None, None,
                    'Drive in steady state', None, None,
                    None, None, None,
                    None, None, None,
                    "Forward operation applied before the ramp"
                ]

        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended state register"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["Extended state register"] = ', '.join(Extendedstateregister)
        else:
            raw_data["Extended state register"] = None

        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 0"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 0"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 0"] = None
        
        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 1"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 1"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 1"] = None
        
        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 2"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 2"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 2"] = None

        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 3"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 3"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 3"] = None

        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 4"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 4"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 4"] = None

        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 5"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 5"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 5"] = None

        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 6"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 6"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 6"] = None

        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 7"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 7"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 7"] = None
        
        Extendedstateregister = []
        Extendedstateregister_13 = 0
        Extendedstateregister_14 = 0
        for each_bit in range(16):
            bit_value = readbitval(raw_data["ETI state word 8"], each_bit)
            if bit_value == 1 and ETI_1 [each_bit] != None:
                Extendedstateregister.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0 [each_bit] != None:
                Extendedstateregister.append(ETI_0[each_bit])
            
            if each_bit == 13:
                Extendedstateregister_13 = bit_value
            if each_bit == 14:
                Extendedstateregister_14 = bit_value
        
        if not Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by terminal")
        elif Extendedstateregister_13 and not Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by remote keypad")
        elif not Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by Modbus")
        elif Extendedstateregister_13 and  Extendedstateregister_14:
            Extendedstateregister.append("Drive controled by CANopen or the network card")
        
        if len(Extendedstateregister) != 0:
            raw_data["ETI state word 8"] = ', '.join(Extendedstateregister)
        else:
            raw_data["ETI state word 8"] = None

        #---------------------------------------------------------Logic inputs states-----------------------------------------------------------    

        IL1R  = ['"LI1" logic inputs real image', '"LI2" logic inputs real image', '"LI3" logic inputs real image',
                    '"LI4" logic inputs real image', '"LI5" logic inputs real image', '"LI6" logic inputs real image',
                    '"AI1" as logic input real image', '"AI2" as logic input real image', None,
                    None, None,None,
                    None, None, None,
                    None
                ]

        Logicinputsstates = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Logic inputs states"], each_bit)
            if bit_value == 1 and IL1R [each_bit] != None:
                Logicinputsstates.append(IL1R[each_bit])
        
        if len(Logicinputsstates) != 0:
            raw_data["Logic inputs states"] = ', '.join(Logicinputsstates)
        else:
            raw_data["Logic inputs states"] = None

        #---------------------------------------------------------Logic outputs states-----------------------------------------------------------    

        OL1R = ['"R1" relay real image', '"R2" relay real image', None,
                None, None, None,
                None, None, '"L01" logic outputs real image',
                None, None,None,
                None, None, None,
                None
                ]

        Logicoutputsstates = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Logic outputs states"], each_bit)
            if bit_value == 1 and OL1R [each_bit] != None:
                Logicoutputsstates.append(OL1R[each_bit])
        
        if len(Logicoutputsstates) != 0:
            raw_data["Logic outputs states"] = ', '.join(Logicoutputsstates)
        else:
            raw_data["Logic outputs states"] = None

        #---------------------------------------------------------Last fault occurred-----------------------------------------------------------    

        LFT  = ['No fault saved', None, "EEprom control fault",
                'Incorrect configuration', 'Invalid config parameters', 'Modbus coms fault',
                'Com Internal link fault', 'Network fault', 'External fault logic input',
                'Overcurrent fault', 'Precharge', 'Speed feedback loss',
                'Output speed <> ref', 'Drive overheating fault', 'Motor overload fault',
                'DC bus overvoltage fault', 'Supply overvoltage fault', '1 motor phase loss fault',
                'Supply phase loss fault', 'Supply undervolt fault', 'Motor short circuit',
                'Motor overspeed fault', 'Auto-tuning fault', 'Rating error',
                'Incompatible control card', 'Internal coms link fault', 'Internal manu zone fault',
                'EEprom power fault', 'Ground short circuit', '3 motor phase loss fault',
                'Comms fault CANopen', 'Brake control fault', 'External fault comms',
                'Brake feedback fault', 'PC coms fault', 'Torque/current limit fault',
                'HMI coms fault', 'LI6=PTC failed', 'LI6=PTC overheat fault', 
                'Internal I measure fault', 'Internal i/p volt circuit flt', 'Internal temperature fault',
                'IGBT overheat fault', 'IGBT short circuit fault', 'motor short circuit',
                'Output cont close fault', 'Output cont open fault', 'input contactor',
                'IGBT desaturation', 'Internal option fault', 'internal- CPU',
                'AI3 4-20mA loss', 'Cards pairing', 'Dynamic load fault', 
                'Interrupted config.', 'Channel switching fault', 'Process Underlaod Fault',
                'Process Overload Fault', 'Angle error', 'Safety fault',
                'FB fault', 'FB stop fault'
                ]

        raw_data["Last fault occurred"]= LFT[raw_data["Last fault occurred"]]
        raw_data["Fault code on fault n-0"]= LFT[raw_data["Fault code on fault n-0"]]
        raw_data["Fault code on fault n-1"]= LFT[raw_data["Fault code on fault n-1"]]
        raw_data["Fault code on fault n-2"]= LFT[raw_data["Fault code on fault n-2"]]
        raw_data["Fault code on fault n-3"]= LFT[raw_data["Fault code on fault n-3"]]
        raw_data["Fault code on fault n-4"]= LFT[raw_data["Fault code on fault n-4"]]
        raw_data["Fault code on fault n-5"]= LFT[raw_data["Fault code on fault n-5"]]
        raw_data["Fault code on fault n-6"]= LFT[raw_data["Fault code on fault n-6"]]
        raw_data["Fault code on fault n-7"]= LFT[raw_data["Fault code on fault n-7"]]
        raw_data["Fault code on fault n-8"]= LFT[raw_data["Fault code on fault n-8"]]





        #---------------------------------------------------------Logic inputs states-----------------------------------------------------------    

        IL1R  = ['"LI1" logic inputs real image', '"LI2" logic inputs real image', '"LI3" logic inputs real image',
                    '"LI4" logic inputs real image', '"LI5" logic inputs real image', '"LI6" logic inputs real image',
                    '"AI1" as logic input real image', '"AI2" as logic input real image', None,
                    None, None,None,
                    None, None, None,
                    None
                ]

        Logicinputsstates = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Logic inputs states"], each_bit)
            if bit_value == 1 and IL1R [each_bit] != None:
                Logicinputsstates.append(IL1R[each_bit])
        
        if len(Logicinputsstates) != 0:
            raw_data["Logic inputs states"] = ', '.join(Logicinputsstates)
        else:
            raw_data["Logic inputs states"] = None

        #---------------------------------------------------------Fault counter-----------------------------------------------------------    

        CIC = ['Change of rating.', 'The fielbus module has been added.', 'The fielbus module has been removed.',
                'Loaded config invalid.', 'The fielbus module has been changed.', None,
                None, None, 'The IO module has been added',
                'The IO module has been removed.', 'The IO module has been changed.', 'The encoder module has been added',
                'The encoder module has been removed.', 'The encoder module has been changed.', 'The control board has been changed.',
                None
                ]

        Faultcounter = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Fault counter"], each_bit)
            if bit_value == 1 and CIC [each_bit] != None:
                Faultcounter.append(CIC[each_bit])
        
        if len(Faultcounter) != 0:
            raw_data["Fault counters"] = ', '.join(Faultcounter)
        else:
            raw_data["Fault counter"] = None

        #---------------------------------------------------------State word -----------------------------------------------------------    

        ETA_1 = ['"Ready to switch on", awaiting power section line supply', '"Switched on", ready', '"Operation enabled", running',
                'Fault detection', 'Power part connected to supply mains', None,
                '"Switched on disabled", power section line supply locked', 'Warning active', None,
                'Command or reference via fieldbus', 'The reference has been reached', 'The reference has been reached',
                None, None, 'Stop triggered by the STOP key on the graphic display terminal or the remote display terminal',
                'Reverse rotation at output'
                ]
        ETA_0 = [None, None, None,
                    None, 'Power part not connected to supply mains', 'Quick stop', None,
                    'No warning', None, 'Command or reference given via the graphic display terminal or remote display terminal',
                    'The reference is not reached', 'The reference is within the limits', None,
                    None, 'STOP key not active', 'Forward rotation at output'

                ]

        Stateword0 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 0"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword0.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword0.append(ETA_0[each_bit])
        
        if len(Stateword0) != 0:
            raw_data["State word 0"] = ', '.join(Stateword0)
        else:
            raw_data["State word 0"] = None

        Stateword1 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 1"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword1.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword1.append(ETA_0[each_bit])
        
        if len(Stateword1) != 0:
            raw_data["State word 1"] = ', '.join(Stateword1)
        else:
            raw_data["State word 1"] = None

        Stateword2 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 2"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword2.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword2.append(ETA_0[each_bit])
        
        if len(Stateword2) != 0:
            raw_data["State word 2"] = ', '.join(Stateword2)
        else:
            raw_data["State word 2"] = None

        Stateword3 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 3"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword3.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword3.append(ETA_0[each_bit])
        
        if len(Stateword3) != 0:
            raw_data["State word 3"] = ', '.join(Stateword3)
        else:
            raw_data["State word 3"] = None

        Stateword4 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 4"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword4.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword4.append(ETA_0[each_bit])
        
        if len(Stateword4) != 0:
            raw_data["State word 4"] = ', '.join(Stateword4)
        else:
            raw_data["State word 4"] = None

        Stateword5 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 5"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword5.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword5.append(ETA_0[each_bit])
        
        if len(Stateword5) != 0:
            raw_data["State word 5"] = ', '.join(Stateword5)
        else:
            raw_data["State word 5"] = None

        Stateword6 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 6"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword6.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword6.append(ETA_0[each_bit])
        
        if len(Stateword6) != 0:
            raw_data["State word 6"] = ', '.join(Stateword6)
        else:
            raw_data["State word 6"] = None

        Stateword7 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 7"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword7.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword7.append(ETA_0[each_bit])
        
        if len(Stateword7) != 0:
            raw_data["State word 7"] = ', '.join(Stateword7)
        else:
            raw_data["State word 7"] = None

        Stateword8 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["State word 8"], each_bit)
            if bit_value == 1 and ETA_1 [each_bit] != None:
                Stateword8.append(ETA_1[each_bit])
            elif bit_value == 0 and ETA_0 [each_bit] != None:
                Stateword8.append(ETA_0[each_bit])
        
        if len(Stateword8) != 0:
            raw_data["State word 8"] = ', '.join(Stateword8)
        else:
            raw_data["State word 8"] = None

        #---------------------------------------------------------Command channel-----------------------------------------------------------    

        CNL = ['Terminal block', 'Local', 'Local HMI',
                'Modbus communication 1', None, None,
                'CANopen communication', 'Increase/Decrease speed', 'LUD->NotDef', 
                'Ext. communication card', None, None,
                None, None, 'Indus',
                'PC tool'
                ]

        raw_data["Command channel 0"]= CNL[raw_data["Command channel 0"]]
        raw_data["Reference channel 0"]= CNL[raw_data["Reference channel 0"]]
        raw_data["Command channel 1"]= CNL[raw_data["Command channel 1"]]
        raw_data["Reference channel 1"]= CNL[raw_data["Reference channel 1"]]
        raw_data["Command channel 2"]= CNL[raw_data["Command channel 2"]]
        raw_data["Reference channel 2"]= CNL[raw_data["Reference channel 2"]]
        raw_data["Command channel 3"]= CNL[raw_data["Command channel 3"]]
        raw_data["Reference channel 3"]= CNL[raw_data["Reference channel 3"]]
        raw_data["Command channel 4"]= CNL[raw_data["Command channel 4"]]
        raw_data["Reference channel 4"]= CNL[raw_data["Reference channel 4"]]
        raw_data["Command channel 5"]= CNL[raw_data["Command channel 5"]]
        raw_data["Reference channel 5"]= CNL[raw_data["Reference channel 5"]]
        raw_data["Command channel 6"]= CNL[raw_data["Command channel 6"]]
        raw_data["Reference channel 6"]= CNL[raw_data["Reference channel 6"]]
        raw_data["Command channel 7"]= CNL[raw_data["Command channel 7"]]
        raw_data["Reference channel 7"]= CNL[raw_data["Reference channel 7"]]
        raw_data["Command channel 8"]= CNL[raw_data["Command channel 8"]]
        raw_data["Reference channel 8"]= CNL[raw_data["Reference channel 8"]]


        data = raw_data
        return data

    def write(self):
        pass


class Deepsea_Electronic_DSE8610MKII(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}
        alarm = {}

        ### Alarm Condition
        AlarmCondition = ['Disabled digital input','Not active alarm','Warning alarm',
                           'Shutdown alarm','Electrical trip alarm','Reserved',
                            'Reserved', 'Reserved', 'Inactive indication (no string) ',
                            'Inactive indication (displayed string)', 'Active indication', 'Reserved',
                            'Reserved', 'Reserved', 'Reserved',
                            'Unimplemented alarm ']
        
        statval = raw_data['Alarm1']
        alarm['Low coolant temperature '] = AlarmCondition[(statval & 0xF)]
        alarm['High coolant temperature'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Low oil pressure'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Emergency stop'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm2']
        alarm['Generator Over frequency'] = AlarmCondition[(statval & 0xF)]
        alarm['Generator Under frequency'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Over speed'] = AlarmCondition[(statval & 0xF00) >> 8]
        raw_data['Under speed'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm3']
        alarm['Battery high voltage'] = AlarmCondition[(statval & 0xF)]
        alarm['Battery low voltage'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Generator high voltage'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Generator low voltage '] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm4']
        alarm['Charge alternator failure'] = AlarmCondition[(statval & 0xF)]
        alarm['Fail to start'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Fail to stop'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Generator fail to close'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm5']
        alarm['Magnetic pick up open circuit'] = AlarmCondition[(statval & 0xF)]
        alarm['Loss of magnetic pick up'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Oil pressure sender fault'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Mains fail to close'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm6']
        alarm['CAN ECU Warning'] = AlarmCondition[(statval & 0xF)]
        alarm['Low fuel level'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Calibration lost'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Generator high current'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm7']
        alarm['High temperature switch '] = AlarmCondition[(statval & 0xF)]
        alarm['Low oil level switch'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['CAN ECU Data fail'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['CAN ECU Shutdown'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm8']
        alarm['Negative phase sequence current alarm'] = AlarmCondition[(statval & 0xF)]
        alarm['kW overload alarm '] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Expansion unit watchdog alarm'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Low fuel level switch'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm9']
        alarm['Maintenance alarm'] = AlarmCondition[(statval & 0xF)]
        alarm['Auto Voltage Sense Fail'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Generator phase rotation alarm'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Earth fault trip alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm10']
        alarm['Fuel usage stopped'] = AlarmCondition[(statval & 0xF)]
        alarm['Fuel usage running'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Loading voltage alarm'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Loading frequency alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm11']
        alarm['Mains breaker failed to open'] = AlarmCondition[(statval & 0xF)]
        alarm['Generator breaker failed to open'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Protections blocked'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Protections disabled'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm12']
        alarm['Short circuit alarm'] = AlarmCondition[(statval & 0xF)]
        alarm['Generator reverse power alarm'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Bus breaker failed to open'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Bus breaker failed to close'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm13']
        alarm['Bus not live'] = AlarmCondition[(statval & 0xF)]
        alarm['Bus live'] = AlarmCondition[(statval & 0xF0) >> 4]
        raw_data['Failure to sync'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Air flap closed alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm14']
        alarm['MSC ID error'] = AlarmCondition[(statval & 0xF)]
        alarm['MSC data error'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Priority selection error'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Bus phase rotation'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm15']
        alarm['Bus high frequency'] = AlarmCondition[(statval & 0xF)]
        alarm['Bus low frequency'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Bus high voltage'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Bus low voltage'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm16']
        alarm['MSC old version units on the bus'] = AlarmCondition[(statval & 0xF)]
        alarm['MSC alarms inhibited'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['MSC too few sets'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['MSC failure'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm17']
        alarm['Out of sync'] = AlarmCondition[(statval & 0xF)]
        alarm['Insufficient capacity'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Minimum sets not reached'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Mains reverse power alarm/mains export alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm18']
        alarm['Mains vector shift'] = AlarmCondition[(statval & 0xF)]
        alarm['Mains ROCOF'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Loss of excitation'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Alternative aux mains fail'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm19']
        alarm['Mains decoupling high voltage stage 1'] = AlarmCondition[(statval & 0xF)]
        alarm['Mains decoupling low voltage stage 1'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Mains decoupling high frequency stage 1'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Mains decoupling low frequency stage 1'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm20']
        alarm['AVR Max Trim Limit alarm'] = AlarmCondition[(statval & 0xF)]
        alarm['Mains phase rotation alarm identifier'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Inlet Temperature'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Mains decoupling combined alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm21']
        alarm['Out of sync Mains'] = AlarmCondition[(statval & 0xF)]
        alarm['Out of sync Bus'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Temperature sender open circuit alarm'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['High coolant temperature electrical trip alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm22']
        alarm['Bus 2 Phase Rotation'] = AlarmCondition[(statval & 0xF)]
        alarm['Bus 2 Live'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Bus 1 Phase Rotation'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Bus 1 Live'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm23']
        alarm['Indication'] = AlarmCondition[(statval & 0xF)]
        alarm['ECU Malfunction'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['ECU Protect'] = AlarmCondition[(statval & 0xF00) >> 8]
        statval = raw_data['Alarm24']
        alarm['DPTC Filter'] = AlarmCondition[(statval & 0xF)]
        alarm['HEST Active'] = AlarmCondition[(statval & 0xF0) >> 4]
        statval = raw_data['Alarm25']
        alarm['ECU Cooler'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['ECU Heate'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Water In Fuel'] = AlarmCondition[(statval & 0xF000) >> 12]
        
        """
        statval = raw_data['Alarm28']
        alarm['Bus Module Warning (8661) '] = AlarmCondition[(statval & 0xF)]
        alarm['Module Communication Fail (8661)'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['High fuel level'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm29']
        alarm['Load Live (8661)'] = AlarmCondition[(statval & 0xF)]
        alarm['Mains Module Trip (8661)'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Mains Module Warning (8661)'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Bus Module Trip (8661)'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm30']
        alarm['SCR Inducement'] = AlarmCondition[(statval & 0xF)]
        alarm['DEF Level Low'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Load Phase Rotation (8661)'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Load Not Live (8661)'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm31']
        alarm['Mains Over Negative Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF)]
        alarm['Mains Under Positive Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Mains Over Zero Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Heater Sensor Failure Alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm32']
        alarm['Bus Over Negative Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF)]
        alarm['Bus Under Positive Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Bus Over Zero Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Mains Asymmetry High Alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm33']
        alarm['MSC Link 1 Data Error'] = AlarmCondition[(statval & 0xF)]
        alarm['Fuel Tank Bund Level High'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['E-Trip Stop Inhibited'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Bus Asymmetry High Alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm34']
        alarm['Bus 2 Low Frequency'] = AlarmCondition[(statval & 0xF)]
        alarm['Bus 2 High Voltage'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Bus 2 Low Voltage'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['MSC Link 2 Data Error'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm35']
        alarm['MSC Link 1 Too Few Sets'] = AlarmCondition[(statval & 0xF)]
        alarm['MSC Link 2Failure'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['MSC Link 1 Failure '] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Bus 2 High Frequency'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm36']
        alarm['AVR CAN DM1 Red Stop Lamp Fault'] = AlarmCondition[(statval & 0xF)]
        alarm['Electrical Trip from 8660'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['MSC Link 1 and 2 Failure'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['MSC Link 2Too Few Sets'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm37']
        alarm['Gen Asymmetry High Alarm'] = AlarmCondition[(statval & 0xF)]
        alarm['Gen Over Negative Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Gen Under Positive Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Gen Over Zero Sequence Volts Alarm'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm38']
        alarm['Mains decoupling high voltage stage 2'] = AlarmCondition[(statval & 0xF)]
        alarm['Mains decoupling low voltage stage 2'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['Mains decoupling high frequency stage 2'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Mains decoupling low frequency stage 2'] = AlarmCondition[(statval & 0xF000) >> 12]
        statval = raw_data['Alarm39']
        alarm['AVR Red Lamp'] = AlarmCondition[(statval & 0xF0) >> 4]
        alarm['AVR Data Fail'] = AlarmCondition[(statval & 0xF00) >> 8]
        alarm['Fault Ride Through event'] = AlarmCondition[(statval & 0xF000) >> 12]
        """
        """
        for i in range(39):
            del raw_data['Alarm' + str(i+1)]
        raw_data['List Alarm'] = alarm

        digitalinputcode = ['Open', "Closed", "Reserved", "Unimplemented"]
        ### digital input 1
        digitalinput1 = {}
        statval = raw_data['Digital Input 1']
        digitalinput1['Panel lock input'] = digitalinputcode[(statval & 3)]
        digitalinput1['Reset inputt'] = digitalinputcode[(statval & 0xC) >> 2]
        digitalinput1['Lamp test input'] = digitalinputcode[(statval & 30) >> 4]
        digitalinput1['Remote fuel on input'] = digitalinputcode[(statval & 0xC0) >> 6]
        digitalinput1['Remote start input'] = digitalinputcode[(statval & 300) >> 8]
        digitalinput1['High engine temp. switch input'] = digitalinputcode[(statval & 0xC00) >> 10]
        digitalinput1['Low oil pressure switch input'] = digitalinputcode[(statval & 3000) >> 12]
        digitalinput1['Emergency stop input'] = digitalinputcode[(statval & 0xC000) >> 14]

        raw_data['Digital Input 1'] = digitalinput1
        
        ### digital input 2
        digitalinput2 = {}
        statval = raw_data['Digital Input 2']
        digitalinput2['Transfer to mains button input'] = digitalinputcode[(statval & 300) >> 8]
        digitalinput2['Transfer to generator button input'] = digitalinputcode[(statval & 0xC00) >> 10]
        digitalinput2['Stop button input'] = digitalinputcode[(statval & 3000) >> 12]
        digitalinput2['Start button input'] = digitalinputcode[(statval & 0xC000) >> 14]

        raw_data['Digital Input 2'] = digitalinput2
        """
        """"
        ### Auxiliary sender
        AuxiliaryFlexiblesender = ["Unused", "Pressure", "Temperature", "Level", "Reserved"]
        if raw_data["Auxiliary sender 1 value"] > 3:
            raw_data["Auxiliary sender 1 value"] = AuxiliaryFlexiblesender[4]
        else:
            raw_data["Auxiliary sender 1 value"] = AuxiliaryFlexiblesender[raw_data["Auxiliary sender 1 value"]]
        
        if raw_data["Auxiliary sender 2 value"] > 3:
            raw_data["Auxiliary sender 2 value"] = AuxiliaryFlexiblesender[4]
        else:
            raw_data["Auxiliary sender 2 value"] = AuxiliaryFlexiblesender[raw_data["Auxiliary sender 2 value"]]
        
        if raw_data["Auxiliary sender 3 value"] > 3:
            raw_data["Auxiliary sender 3 value"] = AuxiliaryFlexiblesender[4]
        else:
            raw_data["Auxiliary sender 3 value"] = AuxiliaryFlexiblesender[raw_data["Auxiliary sender 3 value"]]
        
        if raw_data["Auxiliary sender 4 value"] > 3:
            raw_data["Auxiliary sender 4 value"] = AuxiliaryFlexiblesender[4]
        else:
            raw_data["Auxiliary sender 4 value"] = AuxiliaryFlexiblesender[raw_data["Auxiliary sender 4 value"]]
        """
        
        """
        ### Fuel Level
        FuelLevel = ["Litres", "Imperial Gallons", "US Gallons", "Reserved"]
        if raw_data["Fuel level"] > 2:
            raw_data["Fuel level"] = FuelLevel[4]
        else:
            raw_data["Fuel level"] = FuelLevel[raw_data["Fuel level"]]
        """
        
        """
        ### Engine operating state
        Engineoperatingstate = ["Engine stopped", "Pre-start", "Warming Up", "Running",
                                "Cooling down", "Engine Stopped", "Post run", "Reserved"
                                "Available for SAE assignment", "Available for SAE assignment", "Available for SAE assignment", "Available for SAE assignment",
                                "Available for SAE assignment", "Reserved", "Not available"]
       
        raw_data["Engine operating state"] = Engineoperatingstate[raw_data["Engine operating state"]]
        """
        
        """
        ### DPTC filter lamp
        DPTCfilterlamp = ["Off", "On - solid", "Reserved", "On Fast blink",
                            "Reserved", "Not available" ]
        raw_data["DPTC filter lamp command"] = DPTCfilterlamp[raw_data["DPTC filter lamp command"]]                     
        """

        """
        ### Exhaust system high temperature lamp
        Exhaustsystemhightemperaturelamp = ["Engine stopped", "Pre-Start", "Available for SAE assignment",
                                            "Available for SAE assignment", "Available for SAE assignment", "Available for SAE assignment",
                                            "Available for SAE assignment", "Not available"]
        raw_data["Exhaust system high temperature lamp"] = Exhaustsystemhightemperaturelamp[raw_data["Exhaust system high temperature lamp"]]
        """

        ### Auto DPF Regeneration Inhibit
        AutoDPFRegenerationInhibit = ["Auto regeneration permitted", "Auto regeneration inhibited", "Reserved"]
        if raw_data["Auto DPF Regeneration Inhibit"] > 1:
            raw_data["Auto DPF Regeneration Inhibit"] = AutoDPFRegenerationInhibit[2]
        else:
            raw_data["Auto DPF Regeneration Inhibit"] = AutoDPFRegenerationInhibit[raw_data["Auto DPF Regeneration Inhibit"]]
        """
        ### DC Charge Mode
        DCChargeMode = ["Discharging", "Charging", "Floating", "Reserved"]
        if raw_data["DC Charge Mode"] > 2:
            raw_data["DC Charge Mode"] = DCChargeMode[2]
        else:
            raw_data["DC Charge Mode"] = DCChargeMode[raw_data["DC Charge Mode"]]
        """
        """
        ### DC Battery Cycle State
        DCBatteryCycleState = ["Unknown", "Full Discharged Reached", "Full Charge Reached", "Reserved"]
        if raw_data["DC Battery Cycle State"] > 2:
            raw_data["DC Battery Cycle State"] = DCBatteryCycleState[2]
        else:
            raw_data["DC Battery Cycle State"] = DCBatteryCycleState[raw_data["DC Battery Cycle State"]]
        """
        ### Control mode
        Controlmode =["Stop mode", "Auto mode", "Manual mode", "Test on load mode", "Auto with manual restore mode/Prohibit Return",
                    "User configuration mode", "Test off load mode", "Off Mode", "Reserved"] 
        if raw_data["Control mode"] > 6:
            raw_data["Control mode"] = Controlmode[2]
        else:
            raw_data["Control mode"] = Controlmode[raw_data["Control mode"]]
        """"
        ### Battery Charger Mode
        BatteryChargerMode = ["Start Up", "Initialisation", "Boost/Bulk Charge", "Absorption/Boost Run On Charge",
                                "Float/Trickle Charge", "Storage Charge", "Battery Test Mode", "DC Alarm",
                                "Mains Alarm", "Temperature Alarm", "Lamp Test", "Charging Stopped"] 
        raw_data["Battery Charger Mode"] = BatteryChargerMode[raw_data["Battery Charger Mode"]]

        ### Battery Charger De Rating Mode
        BatteryChargerDeRatingMode = ["Reserved", "Standard De-Rating", "Low Mains Voltage DeRating"]
        raw_data["Battery Charger De-Rating Mode"] = BatteryChargerDeRatingMode[raw_data["Battery Charger De-Rating Mode"]]
        """
        data = raw_data
        return data

    def write(self):
        pass

# General Device Class
class Schneider_Altivar71(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def process_raw_data(self, raw_data):
        data = {}

        ### Status word
        ETA = [None, 'Ready', 'Running', 'Fault', 'Power section line supply present',
                     None, None, 'Alarm', None, "Command via a network", "The reference has been reached", "The reference is not within the limits", 
                     None, None,
                     "Stop triggered by the STOP key on the graphic display terminal", "Reverse rotation at output"]

        StatusWordFrequency = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Status word frequency"], each_bit)
            if bit_value == 1 and ETA[each_bit] != None:
                StatusWordFrequency.append(ETA[each_bit])

        if len(StatusWordFrequency) != 0:
            raw_data["Status word frequency"] = ', '.join(StatusWordFrequency)
        else:
            raw_data["Status word frequency"] = None

        Statuswordspeed = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Status word speed"], each_bit)
            if bit_value == 1 and ETA[each_bit] != None:
                Statuswordspeed.append(ETA[each_bit])

        if len(Statuswordspeed) != 0:
            raw_data["Status word speed"] = ', '.join(Statuswordspeed)
        else:
            raw_data["Status word speed"] = None

        ### Drive State
        HMIS = ["Auto-tuning", "IN DC Inject", "Ready", "Freewheel", "Drv running", "In accel", "In decel",
                "Current lim", "Fast stop", "Mot fluxing", "no mains V", "Active PWR", "Control stop", "Dec adapt", "Output Cut", 
                "Under V al", "in mfg test", "in autotest", "autotest error", "autotest ok", "eeprom test", "in fault", "DCP"]
        raw_data["Drive State"]= HMIS[raw_data["Drive State"]]
        ### Extended status word
        ETI_1 = ["Access to the EEPROM non-volatile memory in progress", "Parameter consistency check", "The drive is in fault state but the fault is no longer present (not reset)",
                None, "The drive is in speed mode", "DC Injection braking",
                "Drive in transient state", "Motor thermal state threshold reached for the active motor", "Overbraking",
                "Acceleration in progress", "Deceleration in progreess", "Current or torque limiting in progress",
                "Fast stop in progress", None, None,
                "Reverse operation applied before the ramp"]
        ETI_0 = [None, "No parameter consistency check", "The drive is not in fault state or a fault is present",
                None, None, None,
                "Drive in steady state", None, None,
                None, None, None,
                None, None, None, 
                "Forward operation applied before the ramp"]
        Extendedstatusword = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word"], each_bit)
            if bit_value == 1 and ETI_1[each_bit] != None:
                Extendedstatusword.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0[each_bit] != None:
                Extendedstatusword.append(ETI_0[each_bit])
        if len(Extendedstatusword) != 0:
            raw_data["Extended status word"] = ', '.join(Extendedstatusword)
        else:
            raw_data["Extended status word"] = None

        ### Extended status word 1
        LRS1_0 = [None, None, "The drive is locked, the motor is not powered", 
                None, None, None,
                None, None, None,
                None, None, None,
                None, None, None,
                None]
        LRS1_1 = [None, "The drive is in fault state", "The drive is unlocked, power can be supplied to the motor (RUN state)",
                "The output contactor is controlled", "Frequency threshold (ftd) reached", "High speed (HSP) reached",
                "Current threshold (Ctd) reached", "Frequency reference reached", "Motor 1 thermal state threshold"
                "Brake contactor command", "PID regulator error alarm", "PID regulator feedback alarm"
                "4-20 mA alarm on analog input AI2", "Second frequency threshold (ftd) reached", " Drive thermal state threshold [Drv therm. state al] (tHA) reached",
                "The traverse control function is active"]
        Extendedstatusword1 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word 1"], each_bit)
            if bit_value == 1 and LRS1_1[each_bit] != None:
                Extendedstatusword1.append(LRS1_1[each_bit])
            elif bit_value == 0 and LRS1_0[each_bit] != None:
                Extendedstatusword1.append(LRS1_0[each_bit])
        
        if len(Extendedstatusword1) != 0:
            raw_data["Extended status word 1"] = ', '.join(Extendedstatusword1)
        else:
            raw_data["Extended status word 1"] = None

        ### Extended status word 2
        LRS2_0 = [None, None, None,
                None, None, None,
                None, None, None,
                None, None, None,
                None, None, None,
                None]
        LRS2_1 = [None, None, None,
                None, None, None,
                None, None , None,
                None, None, "Rope slack", "High torque threshold reached",
                "Low torque threshold reached", "Motor direction Forward", "Motor direction Reverse"]
        Extendedstatusword2 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word 2"], each_bit)
            if bit_value == 1 and LRS2_1[each_bit] != None:
                Extendedstatusword2.append(LRS2_1[each_bit])
            elif bit_value == 0 and LRS2_0[each_bit] != None:
                Extendedstatusword2.append(LRS2_0[each_bit])

        if len(Extendedstatusword2) != 0:
            raw_data["Extended status word 2"] = ', '.join(Extendedstatusword2)
        else:
            raw_data["Extended status word 2"] = None

        ### Extended status word 3
        LRS3_0 = ["Reference channel 1 or 1B (Fr1) or (Fr1b) is active", " Command channel 1 (Cd1) is active", "Ramp set 1 (ACC) and (dEC)",
                "Current limit 1 (CLI) is active", None, None,
                None, None, None,
                None, None, None,
                None, None, None,
                "The output torque is positive (forward)"]
        LRS3_1 = ["Reference channel 2 (Fr2) is active", "Command channel 2 (Cd2) is active", "Ramp set 2 (AC2) and (dE2)",
                "Current limit 2 (CL2) is active", None, "Motor 2 thermal state threshold",
                "Motor 3 thermal state threshold", None, None,
                " Stop on low speed time limit function", None, None,
                None, None, None,
                "The output torque is negative (reverse)"]
        Extendedstatusword3 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word 3"], each_bit)
            if bit_value == 1 and LRS3_1[each_bit] != None:
                Extendedstatusword3.append(LRS3_1[each_bit])
            elif bit_value == 0 and LRS3_0[each_bit] != None:
                Extendedstatusword3.append(LRS3_0[each_bit])
        
        if len(Extendedstatusword3) != 0:
            raw_data["Extended status word 3"] = ', '.join(Extendedstatusword3)
        else:
            raw_data["Extended status word 3"] = None

        ### Extended status word 4
        LRS4_0 = [None, None, None,
                None, None, None,
                None, None, "Power section line supply present",
                None, None, None, 
                None, None, None,
                None]
        LRS4_1 = ["Configuration 0 is active", "Configuration 1 is active [Cnfg.1 act.] (CnF1)", "Configuration 2 is active [Cnfg.2 act.] (CnF2)",
                None, "Parameter set 1 is active: [Set 1 active] (CFP1)", "Parameter set 2 is active: [Set 2 active] (CFP2)",
                "Parameter set 3 is active: [Set 3 active] (CFP3)", None, "Power section line supply absent",
                "Motor fluxing in progress", "The motor is fluxed", "DC injection braking"
                "Current limiting in progress", "Acceleration in progress", "Deceleration in progress"
                "Fast stop in progress"]
        Extendedstatusword4 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word 4"], each_bit)
            if bit_value == 1 and LRS4_1[each_bit] != None:
                Extendedstatusword4.append(LRS4_1[each_bit])
            elif bit_value == 0 and LRS4_0[each_bit] != None:
                Extendedstatusword4.append(LRS4_0[each_bit])
        
        if len(Extendedstatusword4) != 0:
            raw_data["Extended status word 4"] = ', '.join(Extendedstatusword4)
        else:
            raw_data["Extended status word 4"] = None
        
        ### Extended status word 5
        LRS5_0 = []
        LRS5_1 = ["Drive DC bus loading: [DC bus loading] (dbL)", "Drive braking [In braking] (brS)", "The Power removal function is active",
                "Automatic restart attempts in progress: [Auto restart] (AUtO)", "Auto-tuning in progress: [Auto-tuning] (tUn)", "Controlled stop in progress following loss of power section line supply (CTL)",
                "The drive cannot follow the configured deceleration ramp, deceleration automatically adapted (OBR)", "Controlled output cut in progress (SOC)", "Freq. meter Alarm] (FqLA): Measured speed threshold reached: [Pulse warning thd.] (FqL).",
                "The line contactor is active", None, None,
                None, "Current present in the motor (MCP)", "If the limit switch management [LIMIT SWITCHES] function is activated. The [Stop FW limit sw.] or [Stop RV limit sw.] stops are reached",
                "[Dynamic load alarm] (dLdA): Detection dynamic load alarm (see [DYNAMIC LOAD DETECT.] (dLd-))"]
        Extendedstatusword5 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word 5"], each_bit)
            if bit_value == 1 and LRS5_1[each_bit] != None:
                Extendedstatusword5.append(LRS5_1[each_bit])
        
        if len(Extendedstatusword5) != 0:
            raw_data["Extended status word 5"] = ', '.join(Extendedstatusword5)
        else:
            raw_data["Extended status word 5"] = None
        
        ### Extended status word 6
        LRS6_0 = []
        LRS6_1 = ["Alarm group 1 is active", "Alarm group 2 is active", "Alarm group 3 is active",
                "Probe 1 alarm: [PTC1 alarm] (PtC1)", "Probe 2 alarm: [PTC2 alarm] (PtC2)", "LI6 PTC probe alarm: [LI6 =PTC alarm] (PtC3)",
                None, "External fault [External fault alarm] (EtF)", "Undervoltage alarm [Undervoltage] (USA)",
                None, "Slipping alarm: [Load slipping] (AnA)", "Drive overheat alarm (tHA)",
                None, "Speed alarm in the brake control sequence (BSA)", "Brake contact alarm in the brake control sequence (BCA)", 
                "Current or torque limit alarm after time-out [Trq/I limit. time out] (StO)"]

        Extendedstatusword6 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word 6"], each_bit)
            if bit_value == 1 and LRS6_1[each_bit] != None:
                Extendedstatusword6.append(LRS6_1[each_bit])
        
        if len(Extendedstatusword6) != 0:
            raw_data["Extended status word 6"] = ', '.join(Extendedstatusword6)
        else:
            raw_data["Extended status word 6"] = None
        
        ### Extended status word 7
        LRS7_0 = []
        LRS7_1 = ["Reference channel 1 or 1B (Fr1) or (Fr1b) is active", "Reference channel 2 (Fr2) is active", " Command channel 1 (Cd1) is active",
                "Command channel 2 (Cd2) is active", "Reference channel 1B (Fr1b) is active", "Spool end (traverse control function)",
                "Master-slave synchronization (traverse control function)", "Torque regulation alarm", "IGBT thermal state alarm",
                "Braking resistor overload alarm", "Alarm sent by the Controller Inside card", "4-20 mA alarm on analog input AI3: [AI3 4-20 mA loss] (LFF3)",
                "4-20 mA alarm on analog input AI4: [AI4 4-20 mA loss] (LFF4)", None, None,
                None]

        Extendedstatusword7 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word 7"], each_bit)
            if bit_value == 1 and LRS7_1[each_bit] != None:
                Extendedstatusword7.append(LRS7_1[each_bit])
        
        if len(Extendedstatusword7) != 0:
            raw_data["Extended status word 7"] = ', '.join(Extendedstatusword7)
        else:
            raw_data["Extended status word 7"] = None
        
        ### Extended status word 8
        LRS8_0 = []
        LRS8_1 = [ None, None, None,
                None, None, None,
                None, None, None,
                None, None, None,
                None, None, None,
                "Drive ready(rdY)"]

        Extendedstatusword8 = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word 8"], each_bit)
            if bit_value == 1 and LRS8_1[each_bit] != None:
                Extendedstatusword8.append(LRS8_1[each_bit])
        
        if len(Extendedstatusword8) != 0:
            raw_data["Extended status word 8"] = ', '.join(Extendedstatusword8)
        else:
            raw_data["Extended status word 8"] = None

        
        ### EtherCAT Slave Status
        ETST = ["Init", "PreOp", "Boot", "SafeOp", "Op"]
        raw_data["EtherCAT Slave Status"]= ETST[raw_data["EtherCAT Slave Status"]]
        """"
        ### CiA402 fault code
        ERRD = ["Internal- th. sensor", "Control Eeprom", "Power Eeprom", "Calibration error", "Rating error"
                "PWR Calib", "Int.serial link", "Int.Mfg area", "Cards pairing", "Incorrect config", "Invalid config",
                "Internal-option", "Brake feedback", "Load slipping", "AI2 4-20mA loss", "PTC1 probe", "PTC2 probe",
                "LI6=PTC probe", "AI2 input", "AI3 4-20mA loss", "AI4 4-20mA loss", "Speed fdback loss", "Enc. coupl", 
                "Encoder", "Modbus", "HMI Comm", "Int com link", "Com Network", "PC Com", "Can Com", "External flt-LI/Bit",
                "External fault com.", "Application fault", "Auto-tuning", "Brake control", "Torque/current lim", "Torque time-out",
                "Power removal", "Load fault"]
        raw_data["CiA402 fault code"]= ERRD[raw_data["CiA402 fault code"]]
        """
        
        LFT = ["No fault", "Calibration error", "Control Eeprom", "Incorrect config", "Invalid config", "Modbus com.", "int. com.link"
                "Com. network","External flt-LI/Bit","Overcurrent","Precharge","Speed fdback loss","Load slipping","AI2 4-20mA loss",
                "PTC1 probe","PTC1 overheat","Drive overheat","Motor overload","Overbraking","Mains overvoltage","1 output phase loss",
                "Input phase loss","Undervoltage","Motor short circuit","Overspeed","Auto-tuning","Rating error","PWR Calib" , "Int.serial link",
                "Int.Mfg area","Power Eeprom","Impedant sh. circuit","Ground short circuit","3out ph loss","CAN com.","Brake control","Internal-hard init.","External fault com.",
                "Application fault","Internal-ctrl supply", "Brake feedback", "PC com.", "Enc. coupl.", "Torque/current lim", "HMI com.", "Power removal", 
                "PTC2 probe", "PTC2 overheat", "LI6=PTC probe", "PTC fault", "Internal- I measure", "Internal-mains circuit", "Internal- th. sensor", "IGBT overheat" ,"IGBT short circuit",
                "Motor short circuit", "Torque time-out", "Out. contact. stuck", "Out. contact. open.", "Int. T meas.", "AI2 input", "Encoder",
                "Thyr. soft charge", "input contactor", "DB unit sh. circuit", "Diff. I fault" ,"IGBT desaturation" , "Internal-option", "internal- CPU", "BR overload",
                "AI3 4-20mA loss", "AI4 4-20mA loss", "Cards pairing"]
        LFT76 = "Loaf fault"
        LFT99 = "Ch sw fault"
        
        ### Altivar fault code
        try:
            raw_data["Altivar fault code"]= LFT[raw_data["Altivar fault code"]]
        except Exception as e:
            if raw_data["Altivar fault code"] == 76:
                raw_data["Altivar fault code"] = LFT76
            elif raw_data["Altivar fault code"] == 99:
                raw_data["Altivar fault code"] = LFT99
            else:
                raw_data["Altivar fault code"] = None

        ### Fault code on last fault
        try:
            raw_data["Fault code on last fault"]= LFT[raw_data["Fault code on last fault"]]
        except Exception as e:
            if raw_data["Altivar fault code"] == 76:
                raw_data["Altivar fault code"] = LFT76
            elif raw_data["Altivar fault code"] == 99:
                raw_data["Altivar fault code"] = LFT99
            else:
                raw_data["Altivar fault code"] = None

        ### Status word on last fault
        Statuswordonlastfault = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Status word on last fault"], each_bit)
            if bit_value == 1 and ETA[each_bit] != None:
                Statuswordonlastfault.append(ETA[each_bit])

        if len(Statuswordonlastfault) != 0:
            raw_data["Status word on last fault"] = ', '.join(Statuswordonlastfault)
        else:
            raw_data["Status word on last fault"] = None

        ### Extended status word on last fault
        Extendedstatuswordonlastfault = []
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Extended status word on last fault"], each_bit)
            if bit_value == 1 and ETI_1[each_bit] != None:
                Extendedstatuswordonlastfault.append(ETI_1[each_bit])
            elif bit_value == 0 and ETI_0[each_bit] != None:
                Extendedstatuswordonlastfault.append(ETI_0[each_bit])
        if len(Extendedstatuswordonlastfault) != 0:
            raw_data["Extended status word on last fault"] = ', '.join(Extendedstatuswordonlastfault)
        else:
            raw_data["Extended status word on last fault"] = None

        
        data = raw_data
        return data

    def write(self):
        pass

####################################### pfc #######################################

# General Device Class
class ABB_RVT(object):
    def __init__(self, protocol):
        self.protocol = protocol

    def get_date_alarm(self, data1, data2, data3):
        bit1 = data1 & 0xff
        bit2 = (data1 >> 8) & 0xff
        bit3 = data2 & 0xff
        bit4 = (data2 >> 8) & 0xff
        bit5 = data3 & 0xff
        bit6 = (data3 >> 8) & 0xff

        #data = str(bit1) + ":" + str(bit2) + ":" + str(bit3) + ":" + str(bit4) + ":" + str(bit5) + ":" + str(bit5) 
        data = "%d:%d:%d:%d:%d:%d" %(bit1, bit2, bit3, bit4, bit5, bit6)  
        return data
        

    def process_raw_data(self, raw_data):
        data = {}
        #Buffer Alarm
        BufferAlarm = ["No alarm", "Protection cos j", "Protection Temp Sensor", "Protection U Max", "Protection T Max", "Protection External T Max", "Protection I Max", "Protection THDU", "Protection External", "Protection U Min"]
        OutputStatus = ["Fixed OFF","1Ph L1","1Ph L2","1Ph L3","3Ph", "Fixed ON"]
        

        TemperatureStatus = ["Reset","Set"]
        AlarmStatus = ["Reset","Set"]

        raw_data["Alarm buffer 0"] = BufferAlarm[raw_data["Alarm buffer 0"]]
        raw_data["Alarm buffer 1"] = BufferAlarm[raw_data["Alarm buffer 1"]]
        raw_data["Alarm buffer 2"] = BufferAlarm[raw_data["Alarm buffer 2"]]
        raw_data["Alarm buffer 3"] = BufferAlarm[raw_data["Alarm buffer 3"]]
        raw_data["Alarm buffer 4"] = BufferAlarm[raw_data["Alarm buffer 4"]]
        raw_data["Time stamp of alarm in buffer 0"] = self.get_date_alarm(raw_data["Time stamp of alarm in buffer 0 1"],raw_data["Time stamp of alarm in buffer 0 2"],raw_data["Time stamp of alarm in buffer 0 3"])
        raw_data["Time stamp of alarm in buffer 1"] = self.get_date_alarm(raw_data["Time stamp of alarm in buffer 1 1"],raw_data["Time stamp of alarm in buffer 1 2"],raw_data["Time stamp of alarm in buffer 1 3"])
        raw_data["Time stamp of alarm in buffer 2"] = self.get_date_alarm(raw_data["Time stamp of alarm in buffer 2 1"],raw_data["Time stamp of alarm in buffer 2 2"],raw_data["Time stamp of alarm in buffer 2 3"])
        raw_data["Time stamp of alarm in buffer 3"] = self.get_date_alarm(raw_data["Time stamp of alarm in buffer 3 1"],raw_data["Time stamp of alarm in buffer 3 2"],raw_data["Time stamp of alarm in buffer 3 3"])
        raw_data["Time stamp of alarm in buffer 4"] = self.get_date_alarm(raw_data["Time stamp of alarm in buffer 4 1"],raw_data["Time stamp of alarm in buffer 4 2"],raw_data["Time stamp of alarm in buffer 4 3"])
        
        raw_data["Status output 1"] = OutputStatus[raw_data["Status output 1"]]
        raw_data["Status output 2"] = OutputStatus[raw_data["Status output 2"]]
        raw_data["Status output 3"] = OutputStatus[raw_data["Status output 3"]]
        raw_data["Status output 4"] = OutputStatus[raw_data["Status output 4"]]
        raw_data["Status output 5"] = OutputStatus[raw_data["Status output 5"]]
        raw_data["Status output 6"] = OutputStatus[raw_data["Status output 6"]]
        raw_data["Status output 7"] = OutputStatus[raw_data["Status output 7"]]
        raw_data["Status output 8"] = OutputStatus[raw_data["Status output 8"]]
        raw_data["Status output 9"] = OutputStatus[raw_data["Status output 9"]]
        raw_data["Status output 10"] = OutputStatus[raw_data["Status output 10"]]
        raw_data["Status output 11"] = OutputStatus[raw_data["Status output 11"]]
        raw_data["Status output 12"] = OutputStatus[raw_data["Status output 12"]]

        #raw_data["Relay status"] = RelayStatus[raw_data["Relay status"]]
        RelayStatus = [ "Relay 0","Relay 1", "Relay 2", "Relay 3",
                        "Relay 4", "Relay 5", "Relay 6",
                        "Relay 7", "Relay 8", "Relay 9",
                        "Relay 10", "Relay 11", "Alarm ",
                        "Fan", None , None]
        for each_bit in range(16):
            bit_value = readbitval(raw_data["Relay status"], each_bit)
            if bit_value == 1 and RelayStatus[each_bit] != None:
                raw_data[RelayStatus[each_bit]] = "Relay to close"
            elif bit_value == 0 and RelayStatus[each_bit] != None:
                raw_data[RelayStatus[each_bit]] = "Relay to open"

        ExternalInputStatus = ["External Input 1 ", "External Input 2", None,
                                None, None, None,
                                None, None, None,
                                None, None, None,
                                None, None, None,
                                None]

        for each_bit in range(16):
            bit_value = readbitval(raw_data["Relay status"], each_bit)
            if bit_value == 1 and ExternalInputStatus[each_bit] != None:
                raw_data[ExternalInputStatus[each_bit]] = "External input set"
            elif bit_value == 0 and ExternalInputStatus[each_bit] != None:
                raw_data[ExternalInputStatus[each_bit]] = "External input reset"


        raw_data["External input status"] = ExternalInputStatus[raw_data["External input status"]]
        raw_data["Temperature status"] = TemperatureStatus[raw_data["Temperature status"]]
        #raw_data["Alarm Status"] = AlarmStatus[raw_data["Alarm Status"]]

        data = raw_data
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

class M4M30(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}
            data = raw_data
            return data
        else:
            return -1
class Socomec_DIRIS_A20(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            TotalPowerFactorType = ["undefined", "leading", "lagging"]
            raw_data["Total Power Factor Type"] = TotalPowerFactorType[raw_data["Total Power Factor Type"]]
            raw_data["Power factor type : sPF1"] = TotalPowerFactorType[raw_data["Power factor type : sPF1"]]
            raw_data["Power factor type : sPF2"] = TotalPowerFactorType[raw_data["Power factor type : sPF2"]]
            raw_data["Power factor type : sPF3"] = TotalPowerFactorType[raw_data["Power factor type : sPF3"]]
             
            alarmonthreshold =  ["No Alarm", "I1", "I2", "I3", "IN", "V L1-L2", "V L2-L3", "V L3-L4",
                                    "?P+", "?Q+", "?S", "F", "?PFL", None, None, "thdl1", "thdl2", "thdl3", "thd V L1-L2",
                                    "thd V L2-L3", "thd V L3-L1", "Hour", "V1", "V2", "V3", None, "thd V1", "thd V2",
                                    "thd V3", None, None, "?PFC"]
            raw_data["Current alarm on lower threshold cause"] = alarmonthreshold[raw_data["Current alarm on lower threshold cause"]]
            raw_data["Current alarm on upper threshold cause"] = alarmonthreshold[raw_data["Current alarm on upper threshold cause"]]

            data = raw_data
            return data
        else:
            return -1

class Schneider_PM5100_PM5300(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}
            
            ### Total Power Factor Type
            TotalPowerFactorType = ["1ph 2W, LN", "1ph 2W, LL", "1ph, 3w, LL with N ( 2phase)", "3ph, 3w, Delta, Ungrounded",
                                    "3ph, 3w, Delta, Corner Grounded", "3ph, 3w, Wye, Ungrounded", "3ph, 3w, Wye Grounded", "3ph, 3w, Wye, Resistance Grounded",
                                    "3ph, 4w, Open Delta, Center-Tapped", "3ph, 4w, Delta, Center-Tapped", "3ph, 4w, Wye, Ungrounded",
                                    "3ph, 4w, Wye Grounded", "3ph, 4w, Wye, Resistance Grounded", "Multi-Circuit 3 circuit LN",
                                    "Multi-Circuit 2 Circuit LN ( Not used )", "Multi-Circuit 1 Cicuit LN ( Not used )", "Multi-Circuit 3 Circuit LL ( Not used )",
                                    "Multi-Circuit 2 Circuit LL ( Not used )", "Multi-Circuit 1 Circuit LL ( Not used )",
                                    "Multi-Circuit 1 Circuit LL 1 Circuit LN ( Not used )", "Multi-Circuit Wye"]
            raw_data["Power System Configuration"] = TotalPowerFactorType[raw_data["Power System Configuration"]]

            ### CT Location for 1  or 2 CT Metering
            CTLocationfor1or2CTMetering = ["Phase A", "Phase B", "Phase C"]
            raw_data["CT Location for 1  or 2 CT Metering"] = CTLocationfor1or2CTMetering[raw_data["CT Location for 1  or 2 CT Metering"]]

            ### VT Connection Type
            VTConnectionType = ["Direct Connect", "Delata", "Wye", "L-N", "L-L", "l-l W/N"]
            raw_data["VT Connection Type"] = VTConnectionType[raw_data["VT Connection Type"]]
             
            ### Energy Channel Channel 1
            EnergyChannelChannel1 = ["Not Used", "Active Energy Delivered (Into Load)", "Active Energy Received (Out of Load)",
                                    "Active Energy Delivered + Received", "Reactive Energy Delivered", "Reactive Energy Received", 
                                    "Reactive Energy Delivered + Received", "Apparent Energy Delivered", "Apparent Energy Received", 
                                    "Apparent Energy Delivered + Received", "Active Energy Delivered Phase A", "Active Energy Delivered Phase B"
                                    "Active Energy Delivered Phase C", "Reactive Energy Delivered Phase A", "Reactive Energy Delivered Phase B",
                                    "Reactive Energy Delivered Phase C", "Apparent Energy Delivered Phase A", "Apparent Energy Delivered Phase B",
                                    "Apparent Energy Delivered Phase C"]
            raw_data["Energy Channel Channel 1"] = EnergyChannelChannel1[raw_data["Energy Channel Channel 1"]]

            ### Energy Channel Channel 2
            EnergyChannelChannel2 = ["Not Used", "Active Energy Delivered (Into Load)", "Active Energy Received (Out of Load)",
                                    "Active Energy Delivered + Received", "Reactive Energy Delivered", "Reactive Energy Received", 
                                    "Reactive Energy Delivered + Received", "Apparent Energy Delivered", "Apparent Energy Received", 
                                    "Apparent Energy Delivered + Received", "Active Energy Delivered Phase A", "Active Energy Delivered Phase B"
                                    "Active Energy Delivered Phase C", "Reactive Energy Delivered Phase A", "Reactive Energy Delivered Phase B",
                                    "Reactive Energy Delivered Phase C", "Apparent Energy Delivered Phase A", "Apparent Energy Delivered Phase B",
                                    "Apparent Energy Delivered Phase C"]
            raw_data["Energy Channel Channel 2"] = EnergyChannelChannel2[raw_data["Energy Channel Channel 2"]]

            ### Energy Channel Channel 3
            EnergyChannelChannel3 = ["Not Used", "Active Energy Delivered (Into Load)", "Active Energy Received (Out of Load)",
                                    "Active Energy Delivered + Received", "Reactive Energy Delivered", "Reactive Energy Received", 
                                    "Reactive Energy Delivered + Received", "Apparent Energy Delivered", "Apparent Energy Received", 
                                    "Apparent Energy Delivered + Received", "Active Energy Delivered Phase A", "Active Energy Delivered Phase B"
                                    "Active Energy Delivered Phase C", "Reactive Energy Delivered Phase A", "Reactive Energy Delivered Phase B",
                                    "Reactive Energy Delivered Phase C", "Apparent Energy Delivered Phase A", "Apparent Energy Delivered Phase B",
                                    "Apparent Energy Delivered Phase C"]
            raw_data["Energy Channel Channel 3"] = EnergyChannelChannel2[raw_data["Energy Channel Channel 3"]]

            data = raw_data
            return data
        else:
            return -1

class PM800(Device):
    def process_raw_data(self, raw_data):
        if self.protocol == "Modbus RTU":
            data = {}

            ### Metering System Type
            if raw_data["Metering System Type"] == 10:
                raw_data["Metering System Type"] = "1PH2W1CT (L-N)"
            elif raw_data["Metering System Type"] == 11:
                raw_data["Metering System Type"] = "1PH2W1CT (L-L)"
            elif raw_data["Metering System Type"] == 12:
                raw_data["Metering System Type"] = "1PH3W2CT"
            elif raw_data["Metering System Type"] == 30:
                raw_data["Metering System Type"] = "3PH3W2CT"
            elif raw_data["Metering System Type"] == 31:
                raw_data["Metering System Type"] = "3PH3W3CT"
            elif raw_data["Metering System Type"] == 32:
                raw_data["Metering System Type"] = "3PH3W1CT"
            elif raw_data["Metering System Type"] == 40:
                raw_data["Metering System Type"] = "3PH4W3CT (default)"
            elif raw_data["Metering System Type"] == 42:
                raw_data["Metering System Type"] = "3PH4W3CT2PT"
            elif raw_data["Metering System Type"] == 44:
                raw_data["Metering System Type"] = "3PH4W1CT3PT"

            ### CT Phase Selection
            CTPhaseSelection = ["Phase A", "Phase B", "Phase C"]
            raw_data["CT Phase Selection"] = CTPhaseSelection[raw_data["CT Phase Selection"]]
            
            ### Operating Mode Parameters 
            OperatingModeParameters_List0 = [None, "Reactive Energy & Demand Accumulation Fund", "IEEE Convention",
                                            None, None, None, 
                                            "Conditional Energy Accumulation Control Input", None, "Display Setup Enabled",
                                            "Normal Phase Rotation ABC", "THD (Fundamental)", None]
            OperatingModeParameters_List1 = [None, "Reactive Energy & Demand Accumulation Harmonics Included", "IEC Convention",
                                            None, None, None,
                                            "Conditional Energy Accumulation Control Command", None, "Display Setup Disabled",
                                            "Normal Phase Rotation CBA", "thd (% Total RMS)", None]

            OperatingModeParameters = []
            for each_bit in range(16):
                bit_value = readbitval(raw_data["Operating Mode Parameters"], each_bit)
                if bit_value == 1 and OperatingModeParameters_List1[each_bit] != None:
                    OperatingModeParameters.append(OperatingModeParameters_List1[each_bit])
                elif bit_value == 0 and OperatingModeParameters_List0[each_bit] != None:
                    OperatingModeParameters.append(OperatingModeParameters_List0[each_bit])

            if len(OperatingModeParameters) != 0:
                raw_data["Operating Mode Parameters"] = ', '.join(OperatingModeParameters)
            else:
                raw_data["Operating Mode Parameters"] = None
            
            ### CT Phase Selection
            PhaseRotationDirection = ["ABC", "CBA"]
            raw_data["Phase Rotation Direction"] = PhaseRotationDirection[raw_data["Phase Rotation Direction"]]
            
            ### Active Alarm Status
            ActiveAlarmStatus_list1 = ["any priority 1-3 alarm is active", "a “High” (1) priority alarm is active",
                                "a “Medium” (2) priority alarm is active", "a “Low” (3) priority alarm is active"]
            ActiveAlarmStatus = []
            for each_bit in range(16):
                bit_value = readbitval(raw_data["Active Alarm Status"], each_bit)
                if bit_value == 1 and ActiveAlarmStatus_list1[each_bit] != None:
                    ActiveAlarmStatus.append(ActiveAlarmStatus_list1[each_bit])

            if len(ActiveAlarmStatus) != 0:
                raw_data["Active Alarm Status"] = ', '.join(ActiveAlarmStatus)
            else:
                raw_data["Active Alarm Status"] = None
            
            ### Latched Active Alarm Status
            LatchedActiveAlarmStatus_list1 = ["any priority 1-3 alarm is active", "a “High” (1) priority alarm is active",
                                "a “Medium” (2) priority alarm is active", "a “Low” (3) priority alarm is active"]
            LatchedActiveAlarmStatus = []
            for each_bit in range(16):
                bit_value = readbitval(raw_data["Latched Active Alarm Status"], each_bit)
                if bit_value == 1 and LatchedActiveAlarmStatus_list1[each_bit] != None:
                    LatchedActiveAlarmStatus.append(LatchedActiveAlarmStatus_list1[each_bit])

            if len(LatchedActiveAlarmStatus) != 0:
                raw_data["Latched Active Alarm Statuss"] = ', '.join(LatchedActiveAlarmStatus)
            else:
                raw_data["Latched Active Alarm Status"] = None

            data = raw_data
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
            
            statval = raw_data['Status']
            raw_data['L1 Status'] = LINE_STATUS[(statval & 0x7)]
            raw_data['L2 Status'] = LINE_STATUS[(statval & 0x38) >> 3]
            raw_data['Switch Status'] = SWITCH_STATUS[(statval & 0x1c0) >> 6]
            raw_data['Generator Status'] = GEN_STATUS[(statval & 0x200) >> 9]

            #Alarm
            AlarmOrNoAlarm = ["No Alarm", "Alarm"]
            alarmval = raw_data['Alarms']
            raw_data['CB1 Open Fail Alarm'] = AlarmOrNoAlarm[alarmval & 0b1]
            raw_data['CB2 Open Fail Alarm'] = AlarmOrNoAlarm[(alarmval & 0b10)>>1]
            raw_data['CB3 Open Fail Alarm'] = AlarmOrNoAlarm[(alarmval & 0b100)>>2]
            raw_data['CB1 Close Fail Alarm'] = AlarmOrNoAlarm[(alarmval & 0b1000)>>3]
            raw_data['CB2 Close Fail Alarm'] = AlarmOrNoAlarm[(alarmval & 0b10000)>>4]
            raw_data['CB3 Close Fail Alarm'] = AlarmOrNoAlarm[(alarmval & 0b100000)>>5]
            raw_data['CB1 Extracted Alarm'] = AlarmOrNoAlarm[(alarmval & 0b1000000)>>6]
            raw_data['CB2 Extracted Alarm'] =AlarmOrNoAlarm[ (alarmval & 0b10000000)>>7]
            raw_data['Logic Locked Alarm'] = AlarmOrNoAlarm[(alarmval & 0b100000000)>>8]
            raw_data['External Fault Alarm'] = AlarmOrNoAlarm[(alarmval & 0b1000000000)>>9]
            raw_data['CB1 Trip Alarm'] = AlarmOrNoAlarm[(alarmval & 0b10000000000)>>10]
            raw_data['CB2 Trip Alarm'] = AlarmOrNoAlarm[(alarmval & 0b100000000000)>>11]
            raw_data['Generator Alarm Alarm'] = AlarmOrNoAlarm[(alarmval & 0b1000000000000)>>12]
            raw_data.pop('Alarms')

            OpenClose = ["Open", "Closed"]
            InsertedWithdrawn = ["Inserted","Withdrawn"]
            NottrippedTripped = ["Not tripped","Tripped"]
            NotalaramAlarm = ["Not tripped","Tripped"]
            EnabledLocked = ["Enabled", "Locked"]
            InactiveActive = ["Inactive", "Active"]
            EnabledDisabled = ["Enabled", "Disabled"]

            for each_bit in range(3):
                bit_value = readbitval(raw_data['CB1 Status'], each_bit)
                if each_bit == 0:
                    raw_data["CB1 Status 1"] = OpenClose[bit_value]
                if each_bit == 1:
                    raw_data["CB1 Status 2"] = InsertedWithdrawn[bit_value]
                if each_bit == 2:
                    raw_data["CB1 Status 3"] = NottrippedTripped[bit_value]
            raw_data.pop('CB1 Status')
            
            for each_bit in range(3):
                bit_value = readbitval(raw_data['CB2 Status'], each_bit)
                if each_bit == 0:
                    raw_data["CB1 Status 1"] = OpenClose[bit_value]
                if each_bit == 1:
                    raw_data["CB1 Status 2"] = InsertedWithdrawn[bit_value]
                if each_bit == 2:
                    raw_data["CB1 Status 3"] = NottrippedTripped[bit_value]
            raw_data.pop('CB2 Status')

            raw_data["Generator Alarm"] = NotalaramAlarm[raw_data["Generator Alarm"]]
            raw_data["Logic Locked"] = EnabledLocked[raw_data["Logic Locked"]]
            raw_data["Force Commutation"] = InactiveActive[raw_data["Force Commutation"]]
            raw_data["Generator Start"] = InactiveActive[raw_data["Generator Start"]]
            raw_data["Switching Enabled"] = EnabledDisabled[raw_data["Switching Enabled"]]
            raw_data["Remote Reset"] = InactiveActive[raw_data["Remote Reset"]]
            raw_data["Emergency Lock"] = InactiveActive[raw_data["Emergency Lock"]]

           
            LastAlarm = ["CB1 open failure", "CB2 open failure", "CB3 open failure", "CB1 close failure", "CB2 close failure",
                        "CB3 close failure", "CB1 extracted", "CB2 extracted", "Logic locked", "External fault", "CB1 tripped",
                        "CB2 tripped", "Generator alarm"]

            Event_1 = ["not significant", "manual", "auto", "test", "external command", "fieldbus", "digital input"]
            Event_2 = ["LN1 no voltage", "LN1 undervoltage", "LN1 overvoltage", "LN1 phase missing", "LN1 voltage unbalance",
                        "LN1 incorrect phase sequence", "LN1 invalid frequency", "LN2 no voltage", "LN2 undervoltage", "LN2 overvoltage",
                        "LN2 phase missing", "LN2 voltage unbalance", "LN2 incorrect phase sequence", "LN2 invalid frequency", "Opening CB1",
                        "Closing CB2", "Opening CB2", "Closing CB1", "CB1 open", "CB2 open", "CB3 open", "CB1 closed", "CB2 closed", "CB3 closed",
                        "Generator started", "Generator stopped", "Logic enabled", "Logic disabled", " Force commutation on", "Force commutation off", "Generator start on",
                        "Generator start off", "Switching enabled", "Switching disabled", "Remote reset on", "Remote reset off", "Manual to auto", "Auto to manual", 
                        "Manual to test", "Test to manual", "Opening CB3", "Closing CB3", "Emergency lock on", "Emergency lock off", "Safety Load On (SLC ON)", 
                        "Safety Load Off (SLC OFF)"]

            if readbitval(raw_data["Alarm/Event 1 (newest)"], 15) == 1:
                print("Event")
                bit1 = raw_data["Alarm/Event 1 (newest)"] & 0xff
                bit2 = (raw_data["Alarm/Event 1 (newest)"] >> 8) & 0x7f
                raw_data["Alarm/Event 1 (newest)"] = Event_1[bit1]
                raw_data["Event code 1 newest"] = Event_2[bit2]
            elif readbitval(raw_data["Alarm/Event 1 (newest)"], 15) == 0:
                print("alarm")
                alarm = []
                for each_bit in range(16):
                    bit_value = readbitval(raw_data['Alarm/Event 1 (newest)'], each_bit)
                    if bit_value == 1 and LastAlarm[each_bit] != None:
                        alarm.append(LastAlarm[each_bit])
                if len(alarm) != 0:
                    raw_data['Alarm/Event 1 (newest)'] = ', '.join(alarm)
                else:
                    raw_data['Alarm/Event 1 (newest)'] = None
            

            if readbitval(raw_data["Alarm/Event 2"], 15) == 1:
                print("Event")
                bit1 = raw_data["Alarm/Event 2"] & 0xff
                bit2 = (raw_data["Alarm/Event 2"] >> 8) & 0x7f
                raw_data["Alarm/Event 2"] = Event_1[bit1]
                raw_data["Event code 2"] = Event_2[bit2]
            elif readbitval(raw_data["Alarm/Event 2"], 15) == 0:
                print("alarm")
                alarm = []
                for each_bit in range(16):
                    bit_value = readbitval(raw_data['Alarm/Event 2'], each_bit)
                    if bit_value == 1 and LastAlarm[each_bit] != None:
                        alarm.append(LastAlarm[each_bit])
                if len(alarm) != 0:
                    raw_data['Alarm/Event 2'] = ', '.join(alarm)
                else:
                    raw_data['Alarm/Event 2'] = None
      

            if readbitval(raw_data["Alarm/Event 3"], 15) == 1:
                print("Event")
                bit1 = raw_data["Alarm/Event 3"] & 0xff
                bit2 = (raw_data["Alarm/Event 3"] >> 8) & 0x7f
                raw_data["Alarm/Event 3"] = Event_1[bit1]
                raw_data["Event code 3"] = Event_2[bit2]
            elif readbitval(raw_data["Alarm/Event 3"], 15) == 0:
                print("alarm")
                alarm = []
                for each_bit in range(16):
                    bit_value = readbitval(raw_data['Alarm/Event 3'], each_bit)
                    if bit_value == 1 and LastAlarm[each_bit] != None:
                        alarm.append(LastAlarm[each_bit])
                if len(alarm) != 0:
                    raw_data['Alarm/Event 3'] = ', '.join(alarm)
                else:
                    raw_data['Alarm/Event 3'] = None
       

            if readbitval(raw_data["Alarm/Event 4"], 15) == 1:
                print("Event")
                bit1 = raw_data["Alarm/Event 4"] & 0xff
                bit2 = (raw_data["Alarm/Event 4"] >> 8) & 0x7f
                raw_data["Alarm/Event 4"] = Event_1[bit1]
                raw_data["Event code 4"] = Event_2[bit2]
            elif readbitval(raw_data["Alarm/Event 4"], 15) == 0:
                print("alarm")
                alarm = []
                for each_bit in range(16):
                    bit_value = readbitval(raw_data['Alarm/Event 4'], each_bit)
                    if bit_value == 1 and LastAlarm[each_bit] != None:
                        alarm.append(LastAlarm[each_bit])
                if len(alarm) != 0:
                    raw_data['Alarm/Event 4'] = ', '.join(alarm)
                else:
                    raw_data['Alarm/Event 4'] = None
         

            if readbitval(raw_data["Alarm/Event 5"], 15) == 1:
                print("Event")
                bit1 = raw_data["Alarm/Event 5"] & 0xff
                bit2 = (raw_data["Alarm/Event 5"] >> 8) & 0x7f
                raw_data["Alarm/Event 5"] = Event_1[bit1]
                raw_data["Event code 5"] = Event_2[bit2]
            elif readbitval(raw_data["Alarm/Event 5"], 15) == 0:
                print("alarm")
                alarm = []
                for each_bit in range(16):
                    bit_value = readbitval(raw_data['Alarm/Event 5'], each_bit)
                    if bit_value == 1 and LastAlarm[each_bit] != None:
                        alarm.append(LastAlarm[each_bit])
                if len(alarm) != 0:
                    raw_data['Alarm/Event 5'] = ', '.join(alarm)
                else:
                    raw_data['Alarm/Event 5'] = None
         


            DeviceStatus = ["auto", "manual", "test", "powersave", "generator test"]
            raw_data["Device Status"] = DeviceStatus[raw_data["Device Status"]]

            ProtectionStatus = ["cbs", "bus tie", "NPL bus tie", "NPL feeder open & close", "NPL feeder only open"]
            raw_data["Protection Devices"] = ProtectionStatus[raw_data["Protection Devices"]]

            NominalVoltage = ["100/57", "115/66", "120/70", "208/120", "220/127", "230/132", "240/138", "277/160", "347/200", "380/220", "400/230", "415/240", "440/254", "480/277"]
            raw_data["Nominal Voltage"] = NominalVoltage[raw_data["Nominal Voltage"]]

            data = raw_data
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





