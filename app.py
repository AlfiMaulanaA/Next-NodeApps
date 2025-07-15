import json
import os
import paho.mqtt.client as mqtt
import time
import datetime

ParentFolder = os.path.abspath('..')

AC_INPUT_THRESHOLD = 180    # Minimum 220VAC input voltage to be considered "normal"
DC_BATTERY_VOLTAGE = 110
DC_BATTERY_TOLERANCE = 40   # Acceptable deviation (+/-) for voltage battery
DC_OUTPUT_THRESHOLD = 10
DC_OUTPUT_THRESHOLD_NORMAL = 90
MIN_CURRENT_THRESHOLD = 0.1 # Small threshold to avoid noise in current readings

DISCHARGE_CYCLE_FILE = "battery_state.json"
THRESHOLD_CONFIG_FILE = "battery_threshold_config.json"
TOPIC_THRESHOLD_REQUEST = "batteryCharger/config/get"
TOPIC_THRESHOLD_RESPONSE = "batteryCharger/config/response"

threshold_config = {
    "AC_INPUT_THRESHOLD": 180,
    "DC_BATTERY_VOLTAGE": 110,
    "DC_BATTERY_TOLERANCE": 40,
    "DC_OUTPUT_THRESHOLD": 10,
    "DC_OUTPUT_THRESHOLD_NORMAL": 90,
    "MIN_CURRENT_THRESHOLD": 0.1
}


TOPIC_PZEM_1 = "pzem017/1"
TOPIC_PZEM_2 = "pzem017/2"
TOPIC_PZEM_INPUT = "pzem016/1"
TOPIC_BATTERY_CHARGER = "batteryCharger"
TOPIC_THRESHOLD_UPDATE = "batteryCharger/config/update"

dataPzem017_1 = {
    "voltage": 0.0,
    "current": 0.0,
    "power": 0.0,
    "energy": 0.0
}
dataPzem017_2 = {
    "voltage": 0.0,
    "current": 0.0,
    "power": 0.0,
    "energy": 0.0
}
dataPzem016_1 = {
    "voltage": 0.0,
    "current": 0.0,
    "power": 0.0,
    "energy": 0.0,
    "frequency": 0.0,
    "power_factor": 0.0
}
batteryCharger = {
    "voltageInput": 0,
    "currentInput": 0,
    "powerInput": 0,
    "energyInput": 0,
    "frequencyInput": 0,
    "powerFactorInput": 0,
    "voltageBattery": 0,
    "currentBattery": 0,
    "powerBattery": 0,
    "energyBattery": 0,
    "voltageOutput": 0,
    "currentOutput": 0,
    "powerOutput": 0,
    "energyOutput": 0,
    "chargingStatus": 0,
    "dischargingStatus": 0,
    "lineFaultAlarm": 0,
    "onOffStatus": 0,
    "powerSupplyFailure": 0,
    "batteryFaultAlarm": 0,
    "dischargeCicle": 0
}

def load_threshold_config():
    global threshold_config
    if os.path.exists(THRESHOLD_CONFIG_FILE):
        with open(THRESHOLD_CONFIG_FILE, "r") as f:
            threshold_config = json.load(f)

        # Optional: override global constants (if you want to)
        globals().update(threshold_config)

def save_threshold_config():
    with open(THRESHOLD_CONFIG_FILE, "w") as f:
        json.dump(threshold_config, f, indent=2)

def load_battery_state():
    """Load last known state of battery."""
    if os.path.exists(DISCHARGE_CYCLE_FILE):
        try:
            with open(DISCHARGE_CYCLE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to load battery state, using default: {e}")
            pass
    return {
        "dischargeCicle": 0,
        "wasDischarging": 0,
        "wasCharging": 0
    }

def save_battery_state(state: dict):
    """Save current state of battery."""
    with open(DISCHARGE_CYCLE_FILE, "w") as f:
        json.dump(state, f)

def safe_json_parse(payload):
    try:
        data = json.loads(payload)
        if isinstance(data, str):  # still a JSON string?
            data = json.loads(data)
        return data
    except Exception as e:
        print(f"JSON parsing error: {e}")
        return {}

def process_data_subscribe(client, userdata, message):
    global dataPzem017_1, dataPzem017_2, dataPzem016_1
    print("Pull data to JSON : Get Subscribe data for Modular and Equipment with topic: "+ message.topic)

    try:
        if message.topic == TOPIC_PZEM_1:
            sub_data = json.loads(message.payload)
            real_data = json.loads(sub_data['value'])
            dataPzem017_1['voltage'] = real_data['voltage']
            dataPzem017_1['current'] = real_data['current']
            dataPzem017_1['power'] = real_data['power']
            dataPzem017_1['energy'] = real_data['energy']
        elif message.topic == TOPIC_PZEM_2:
            sub_data = json.loads(message.payload)
            real_data = json.loads(sub_data['value'])
            dataPzem017_2['voltage'] = real_data['voltage']
            dataPzem017_2['current'] = real_data['current']
            dataPzem017_2['power'] = real_data['power']
            dataPzem017_2['energy'] = real_data['energy']
        elif message.topic == TOPIC_PZEM_INPUT:
            sub_data = json.loads(message.payload)
            real_data = json.loads(sub_data['value'])
            dataPzem016_1['voltage'] = real_data['voltage']
            dataPzem016_1['current'] = real_data['current']
            dataPzem016_1['power'] = real_data['power']
            dataPzem016_1['energy'] = real_data['energy']
            dataPzem016_1['frequency'] = real_data['frequency']
            dataPzem016_1['power_factor'] = real_data['power_factor']

            batteryCharger['voltageInput'] = dataPzem016_1['voltage']
            batteryCharger['currentInput'] = dataPzem016_1['current']
            batteryCharger['powerInput'] = dataPzem016_1['power']
            batteryCharger['energyInput'] = dataPzem016_1['energy']
            batteryCharger['frequencyInput'] = dataPzem016_1['frequency']
            batteryCharger['powerFactorInput'] = dataPzem016_1['power_factor']
            batteryCharger['voltageBattery'] = dataPzem017_1['voltage']
            batteryCharger['currentBattery'] = dataPzem017_1['current']
            batteryCharger['powerBattery'] = dataPzem017_1['power']
            batteryCharger['energyBattery'] = dataPzem017_1['energy']
            batteryCharger['voltageOutput'] = dataPzem017_2['voltage']
            batteryCharger['currentOutput'] = dataPzem017_2['current']
            batteryCharger['powerOutput'] = dataPzem017_2['power']
            batteryCharger['energyOutput'] = dataPzem017_2['energy']

            # Charging status: 1 if battery current is positive
            batteryCharger['chargingStatus'] = 1 if batteryCharger['currentBattery'] > MIN_CURRENT_THRESHOLD  else 0
            # Discharging status: 1 if current flows out from battery (negative current)
            batteryCharger['dischargingStatus'] = 1 if batteryCharger['currentBattery'] < -MIN_CURRENT_THRESHOLD  else 0
            # Line fault: if there's input voltage/power problem
            batteryCharger['lineFaultAlarm'] = 1 if batteryCharger['voltageInput'] < AC_INPUT_THRESHOLD else 0
            # On/Off status: assume ON if input voltage is available
            if batteryCharger['voltageOutput'] > DC_OUTPUT_THRESHOLD_NORMAL:
                batteryCharger['onOffStatus'] = 1
            elif batteryCharger['voltageOutput'] < DC_OUTPUT_THRESHOLD:
                batteryCharger['onOffStatus'] = 0
            # Power supply failure: if powerInput is 0 but system is supposed to be ON
            batteryCharger['powerSupplyFailure'] = 1 if batteryCharger['voltageOutput'] < DC_OUTPUT_THRESHOLD_NORMAL else 0
            # Battery fault alarm: voltage out of expected range
            batteryCharger['batteryFaultAlarm'] = 1 if abs(batteryCharger['voltageBattery'] - DC_BATTERY_VOLTAGE) > DC_BATTERY_TOLERANCE else 0

            # Only count discharge cycle if state changes from 1 -> 0
            state = load_battery_state()
            last_cicle = state.get("dischargeCicle", 0)
            was_discharging = state.get("wasDischarging", 0)

            if was_discharging == 0 and batteryCharger['dischargingStatus']:
                state["wasDischarging"] = 1
            elif was_discharging == 1 and batteryCharger['dischargingStatus'] == 0:
                last_cicle += 1
                state["dischargeCicle"] = last_cicle
                state["wasDischarging"] = 0
                state['lastDischargeTime'] = datetime.datetime.now().isoformat()

            batteryCharger['dischargeCicle'] = last_cicle
            save_battery_state(state)

            # Save output JSON
            output_paths = [
                os.path.join(ParentFolder, 'PROTOCOL_OUT/MODBUS_TCP_SERVER/JSON/Data/Equipment/batteryCharger.json'),
                os.path.join(ParentFolder, 'PROTOCOL_OUT/SNMP_SERVER/json/Equipment/batteryCharger.json'),
            ]

            for path in output_paths:
                try:
                    with open(path, "w") as outfile:
                        json.dump(batteryCharger, outfile, indent=2)
                except Exception as e:
                    print(f"Failed to write {path}: {e}")

            alarm_data = {
                "powerSupplyFailure": batteryCharger["powerSupplyFailure"],
                "batteryFaultAlarm": batteryCharger["batteryFaultAlarm"],
                "lineFaultAlarm": batteryCharger["lineFaultAlarm"]
            }
            alarm_output_path = os.path.join(ParentFolder, 'PROTOCOL_OUT/SNMP_SERVER/json/Equipment/snmpTrapData.json')
            try:
                with open(alarm_output_path, "w") as alarm_file:
                    json.dump(alarm_data, alarm_file, indent=2)
                print(f"Alarm data saved to {alarm_output_path}")
            except Exception as e:
                print(f"Failed to write alarm data: {e}")
            try:
                Subsclient.publish(TOPIC_BATTERY_CHARGER, json.dumps(batteryCharger))
                print(f"Published batteryCharger to {TOPIC_BATTERY_CHARGER}")
            except Exception as e:
                print(f"Failed to publish batteryCharger: {e}")
        elif message.topic == TOPIC_THRESHOLD_UPDATE:
            print("[MQTT] Threshold update received")
            try:
                updated_config = json.loads(message.payload)
                # Only update known keys
                for key in threshold_config:
                    if key in updated_config:
                        threshold_config[key] = updated_config[key]
                # Save the updated config to file
                save_threshold_config()
                # Update globals if used directly
                globals().update(threshold_config)

                client.publish(TOPIC_THRESHOLD_RESPONSE, json.dumps({
                    "status": "updated",
                    "updated": updated_config
                }), qos=1)
                print("[OK] Thresholds updated:", threshold_config)
            except Exception as e:
                print(f"[ERROR] Failed to update thresholds: {e}")
        elif message.topic == TOPIC_THRESHOLD_REQUEST:
            print("[MQTT] Threshold config requested")
            try:
                # Load latest config from file (optional)
                # Load threshold configuration after defining threshold_config and THRESHOLD_CONFIG_FILE
                load_threshold_config()

                # Publish config back to response topic
                client.publish(
                    TOPIC_THRESHOLD_RESPONSE,
                    json.dumps(threshold_config),
                    qos=1,
                    retain=False
                )
                print("[OK] Sent threshold config")
            except Exception as e:
                print(f"[ERROR] Failed to send threshold config: {e}")

#--------------------------------------------------- SNMP CONTAINMENT ---------------------------------------------------
        if  message.topic == "IOT/Containment/snmp/setting/command":
            sub_data = json.loads(message.payload)
            command = sub_data["command"]
            if command == "read":
                with open(os.getcwd()  + '/SNMP_SERVER/json/Comm.json') as json_data:
                    data= json.load(json_data)
                    client.publish("IOT/Containment/snmp/setting/data", json.dumps(data))
            elif command == "write":
                try:
                    with open(os.getcwd()  + '/SNMP_SERVER/json/Comm.json') as json_data:
                        data= json.load(json_data)
                except Exception as e:
                    with open(os.getcwd()  + '/JSON/Config/Comm.json') as json_data:
                        data= json.load(json_data)
                data["snmpIPaddress"] = sub_data["snmpIPaddress"]
                data["snmpNetmask"] = sub_data["snmpNetmask"]
                data["snmpGateway"] = sub_data["snmpGateway"]
                data["snmpVersion"] = sub_data["snmpVersion"]
                data["authKey"] = sub_data["authKey"]
                data["privKey"] = sub_data["privKey"]
                data["securityName"] = sub_data["securityName"]
                data["securityLevel"] = sub_data["securityLevel"]
                data["snmpCommunity"] = sub_data["snmpCommunity"]
                data["snmpPort"] = sub_data["snmpPort"]
                data["sysOID"] = sub_data["sysOID"]
                data["DeviceName"] = sub_data["DeviceName"]
                data["Site"] = sub_data["Site"]
                data["snmpTrapEnabled"] = sub_data["snmpTrapEnabled"]
                data["ipSnmpManager"] = sub_data["ipSnmpManager"]
                data["portSnmpManager"] = sub_data["portSnmpManager"]
                data["snmpTrapComunity"] = sub_data["snmpTrapComunity"]
                data["snmpTrapVersion"] = sub_data["snmpTrapVersion"]
                data["timeDelaySnmpTrap"] = sub_data["timeDelaySnmpTrap"]

                with open(os.getcwd() + '/SNMP_SERVER/json/Comm.json', "w") as outfile:
                    outfile.write(json.dumps(data))

#--------------------------------------------------- MODBUS TCP CONTAINMENT ---------------------------------------------------
        if  message.topic == "IOT/Containment/modbustcp/setting/command":
            sub_data = json.loads(message.payload)
            command = sub_data["command"]
            if command == "read":
                with open(os.getcwd()  + '/MODBUS_TCP_SERVER/JSON/Config/modbus_tcp.json') as json_data:
                    data= json.load(json_data)
                    client.publish("IOT/Containment/modbustcp/setting/data", json.dumps(data))
            elif command == "write":
                with open(os.getcwd()  + '/MODBUS_TCP_SERVER/JSON/Config/modbus_tcp.json') as json_data:
                    data= json.load(json_data)
                data["modbus_tcp_ip"] = sub_data["modbus_tcp_ip"]
                data["modbus_tcp_port"] = sub_data["modbus_tcp_port"]
                with open(os.getcwd() + '/MODBUS_TCP_SERVER/JSON/Config/modbus_tcp.json', "w") as outfile:
                    outfile.write(json.dumps(data))
    except Exception as e:
        print(f"Error processing message: {e}")



load_threshold_config()
MQTT_CONFIG = {}
with open(os.getcwd() + '/JSON/Config/mqtt_config.json') as json_data:
    MQTT_CONFIG = json.load(json_data)

mqtt_enable = MQTT_CONFIG['enable']
broker_address = MQTT_CONFIG['broker_address']
broker_port = MQTT_CONFIG['broker_port']
retain = MQTT_CONFIG['retain']
qos = MQTT_CONFIG['qos']

username = MQTT_CONFIG['username']
password = MQTT_CONFIG['password']

Subsclient = mqtt.Client()
if username and password:
    Subsclient.username_pw_set(username, password)
Subsclient.on_message=process_data_subscribe
Subsclient.connect(MQTT_CONFIG["broker_address"], MQTT_CONFIG["broker_port"])
Subsclient.loop_start()
Subsclient.subscribe(TOPIC_THRESHOLD_UPDATE)
Subsclient.subscribe(TOPIC_THRESHOLD_REQUEST)
Subsclient.subscribe("IOT/Containment/snmp/setting/command")
Subsclient.subscribe("IOT/Containment/modbustcp/setting/command")


#Subsclient.subscribe(MQTT_CONFIG['sub_topic_system'])

with open(ParentFolder + '/MODBUS_SNMP/JSON/Config/installed_devices.json') as json_data:
    list_modular = json.load(json_data)
    for i in range(len(list_modular)):
        Subsclient.subscribe(list_modular[i]["profile"]["topic"])