1. Buatkan fungsi wifi
2. Munculkan local time dan fungsi untuk set RTC sudo timedatectl set-timezone Asia/Jakarta

[INFO] Received message: {'action': 'set', 'data': {'id': 'fcfcf8bd-596c-4aed-a56f-c8f0bb2b96aa', 'customName': 'Control Kipas', 'deviceName': 'RelayMini1', 'name': 'RelayMini1', 'mac': '02:81:dd:6e:0f:11', 'address': 37, 'device_bus': 0, 'part_number': 'RELAYMINI', 'startDay': 'Mon', 'endDay': 'Sun', 'controls': [{'pin': 1, 'customName': 'tset', 'onTime': '08:30', 'offTime': '17:00'}, {'pin': 2, 'customName': 'giuh', 'onTime': '08:33', 'offTime': '17:00'}]}}
[INFO] Processing action: set
Updated device with ID: fcfcf8bd-596c-4aed-a56f-c8f0bb2b96aa
Configuration saved to ./JSON/automationSchedulerConfig.json
[CRITICAL] Error in restart_service: Failed to restart service: Failed to restart scheduler_control.service: Unit scheduler_control.service not found.
Failed to restart service: Failed to restart scheduler_control.service: Unit scheduler_control.service not found.
[INFO] === MQTT DEBUG === Topic: command_control_scheduler | Payload: '{"action":"get"}'
[INFO] Attempting to parse JSON message...
[INFO] Parsed JSON successfully: {'action': 'get'}
[INFO] Received message: {'action': 'get'}
[INFO] Processing action: get

hapuskan fungsi restart scheduler_control.service, dan modifikasi agar menjadi multiprocessing.service

kenapa saat kondisi terpenuhi, [
{
"id": "fcfcf8bd-596c-4aed-a56f-c8f0bb2b96aa",
"customName": "Control Kipas",
"deviceName": "RelayMini1",
"name": "RelayMini1",
"mac": "02:81:dd:6e:0f:11",
"address": 37,
"device_bus": 0,
"part_number": "RELAYMINI",
"startDay": "Mon",
"endDay": "Sun",
"controls": [
{
"pin": 1,
"customName": "tset",
"onTime": "08:30",
"offTime": "17:00"
},
{
"pin": 2,
"customName": "giuh",
"onTime": "08:33",
"offTime": "17:00"
}
]
}
]

kondiisi tersebut terpenuhi jika hari dan waktu sesuai dengan waktu dan hari yang diset realtme. Lalu seharusnya akan publish data control ini

def send_control_signal(client, device, pin, data):
if not config.get('autoControl', True):
logger.info(f"Auto control is disabled. Not sending signal to {device.get('name', device.get('id'))}, pin {pin}, data {data}.")
return

    try:
        # Basic validation for critical device info
        if not all(key in device for key in ['mac', 'part_number', 'address', 'device_bus']):
            logger.error(f"Missing critical device information for sending control signal: {device.get('id', 'unknown')}")
            send_error_log("send_control_signal", "Missing critical device information.", ERROR_TYPE_CRITICAL, {"device_data": device})
            return

        message = {
            "mac": device['mac'],
            "protocol_type": "Modular",
            "device": device['part_number'],
            "function": "write",
            "value": {
                "pin": pin,
                "data": data
            },
            "address": device['address'],
            "device_bus": device['device_bus'],
            "Timestamp": datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
        }
        publish_control(client, json.dumps(message), "modular")
        logger.info(f"Sent control signal to {device.get('customName', device.get('name', device['id']))}, pin {pin}, data {data}")
    except Exception as e:
        send_error_log("send_control_signal", f"Failed to send control signal: {e}", ERROR_TYPE_CRITICAL, {"device_id": device.get('id', 'unknown'), "pin": pin, "data": data})

tapi kenapa tidak tercontrol atau tidak terpublish?

Add Variable Button disable
