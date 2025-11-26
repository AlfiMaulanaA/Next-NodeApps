#!/usr/bin/env python3
"""
SNMP Operations Handler
Handles on-demand SNMP get/walk operations
Located in CONFIG_SYSTEM_DEVICE as per project structure
"""

import paho.mqtt.client as mqtt
import json
import subprocess
import os
import logging
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# MQTT Topics for SNMP data operations
MQTT_COMMAND_TOPIC = "snmp/data/command"
MQTT_RESPONSE_TOPIC = "snmp/data/response"

# SNMP CLI commands
SNMPWALK_CMD = "/usr/bin/snmpwalk"
SNMPGET_CMD = "/usr/bin/snmpget"
SNMPSET_CMD = "/usr/bin/snmpset"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def parse_snmp_output(output: str) -> list:
    """Parse SNMP GET output into list of dicts"""
    results = []
    lines = output.strip().split('\n')
    for line in lines:
        if not line.strip():
            continue
        try:
            # SNMP GET format: OID type value
            parts = line.split('=', 1)
            if len(parts) < 2:
                continue

            oid_part = parts[0].strip()
            value_part = parts[1].strip()

            # OID might contain spaces, get actual OID
            oid = oid_part.split()[-1]

            # Parse type and value
            value_parts = value_part.split()
            if len(value_parts) >= 2:
                type_code = value_parts[0]
                value = ' '.join(value_parts[1:])

                # Map SNMP types (simplified)
                type_map = {
                    'STRING': 4,
                    'INTEGER': 2,
                    'OCTET': 4,
                    'OBJID': 6,
                    'IPADDRESS': 64,
                    'COUNTER': 65,
                    'GAUGE': 66,
                    'TIMETICKS': 67
                }
                type_num = type_map.get(type_code.strip(':'), 4)

                results.append({
                    'oid': oid,
                    'type': type_num,
                    'value': value
                })
        except Exception as e:
            send_error_log("parse_snmp_output", f"Failed to parse line: {line}, error: {e}", ERROR_TYPE_WARNING, {"line": line})
            continue

    return results

def parse_snmp_walk(output: str) -> list:
    """Parse SNMP WALK output (multi-line)"""
    results = []
    lines = output.strip().split('\n')
    for line in lines:
        if not line.strip():
            continue
        try:
            # SNMP WALK format: OID type value
            parts = line.split('=', 1)
            if len(parts) < 2:
                continue

            oid_part = parts[0].strip()
            value_part = parts[1].strip()

            oid = oid_part
            value_parts = value_part.split()

            if len(value_parts) >= 2:
                type_code = value_parts[0]
                value = ' '.join(value_parts[1:])

                type_map = {
                    'STRING': 4,
                    'INTEGER': 2,
                    'OCTET': 4,
                    'OBJID': 6,
                    'IPADDRESS': 64,
                    'COUNTER': 65,
                    'GAUGE': 66,
                    'TIMETICKS': 67
                }
                type_num = type_map.get(type_code.strip(':'), 4)

                results.append({
                    'oid': oid,
                    'type': type_num,
                    'value': value
                })
        except Exception as e:
            send_error_log("parse_snmp_walk", f"Failed to parse walk line: {line}, error: {e}", ERROR_TYPE_WARNING, {"line": line})
            continue

    return results

def perform_snmp_get(host: str, community: str, oid: str, version: str = "v2c", port: int = 161) -> list:
    """Perform SNMP GET operation"""
    try:
        version_flag = "-v1" if version == "v1" else "-v2c"
        cmd = [SNMPGET_CMD, version_flag, '-c', community, f'{host}:{port}', oid]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

        if result.returncode == 0:
            return parse_snmp_output(result.stdout)
        else:
            send_error_log("perform_snmp_get", f"SNMP GET failed: {result.stderr}", ERROR_TYPE_MAJOR, {"host": host, "oid": oid})
            return []
    except subprocess.TimeoutExpired:
        send_error_log("perform_snmp_get", "SNMP GET timeout", ERROR_TYPE_MAJOR, {"host": host, "oid": oid})
        return []

def perform_snmp_walk(host: str, community: str, oid: str, version: str = "v2c", port: int = 161) -> list:
    """Perform SNMP WALK operation"""
    try:
        version_flag = "-v1" if version == "v1" else "-v2c"
        cmd = [SNMPWALK_CMD, version_flag, '-c', community, f'{host}:{port}', oid]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            return parse_snmp_walk(result.stdout)
        else:
            send_error_log("perform_snmp_walk", f"SNMP WALK failed: {result.stderr}", ERROR_TYPE_MAJOR, {"host": host, "oid": oid})
            return []
    except subprocess.TimeoutExpired:
        send_error_log("perform_snmp_walk", "SNMP WALK timeout", ERROR_TYPE_MAJOR, {"host": host, "oid": oid})
        return []

def perform_snmp_set(host: str, community: str, oid: str, value: str, type_str: str = "s", version: str = "v2c", port: int = 161) -> bool:
    """Perform SNMP SET operation"""
    try:
        version_flag = "-v1" if version == "v1" else "-v2c"

        # Format: OID type value (e.g., "sysContact.0 s 'New Contact'")
        oid_value = f"{oid} {type_str} {value}"

        cmd = [SNMPSET_CMD, version_flag, '-c', community, f'{host}:{port}', oid_value]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)

        if result.returncode == 0:
            logger.info(f"SNMP SET successful: {oid} = {value} (type: {type_str})")
            return True
        else:
            send_error_log("perform_snmp_set", f"SNMP SET failed: {result.stderr}", ERROR_TYPE_MAJOR, {"host": host, "oid": oid, "value": value})
            return False
    except subprocess.TimeoutExpired:
        send_error_log("perform_snmp_set", "SNMP SET timeout", ERROR_TYPE_MAJOR, {"host": host, "oid": oid})
        return False
    except Exception as e:
        send_error_log("perform_snmp_set", f"SNMP SET error: {e}", ERROR_TYPE_MAJOR, {"host": host, "oid": oid})
        return False

def on_message(client, userdata, message):
    """Handle incoming MQTT commands for SNMP data operations"""
    try:
        payload = json.loads(message.payload.decode('utf-8'))
        logger.info(f"Received command on {message.topic}: {payload}")

        # Handle SNMP Data commands (get/walk/set)
        if message.topic == MQTT_COMMAND_TOPIC:
            operation = payload.get('operation')
            host = payload.get('host')
            community = payload.get('community', 'public')
            oid = payload.get('oid')
            version = payload.get('version', 'v2c')  # Default to v2c if not specified
            port = payload.get('port', 161)  # Default to 161 if not specified

            # Additional parameters for SET operation
            value = payload.get('value')  # Required for set
            type_str = payload.get('type', 's')  # SNMP type, default string

            if not all([operation, host]):
                response = {
                    'success': False,
                    'error': 'Missing required parameters: operation, host'
                }
            elif operation not in ['get', 'walk', 'set']:
                response = {
                    'success': False,
                    'error': 'Invalid operation. Must be "get", "walk", or "set"'
                }
            elif version not in ['v1', 'v2c']:
                response = {
                    'success': False,
                    'error': 'Invalid SNMP version. Supported: v1, v2c'
                }
            elif operation in ['get', 'walk'] and not oid:
                response = {
                    'success': False,
                    'error': 'OID required for get/walk operations'
                }
            elif operation == 'set' and (not oid or value is None):
                response = {
                    'success': False,
                    'error': 'OID and value required for set operation'
                }
            else:
                try:
                    if operation == 'get':
                        results = perform_snmp_get(host, community, oid, version, port)
                    elif operation == 'walk':
                        results = perform_snmp_walk(host, community, oid, version, port)
                    elif operation == 'set':
                        success = perform_snmp_set(host, community, oid, value, type_str, version, port)
                        if success:
                            response = {
                                'success': True,
                                'message': f'Successfully set {oid} to {value}'
                            }
                        else:
                            response = {
                                'success': False,
                                'error': 'SNMP SET operation failed'
                            }
                        logger.info(f"Operation {operation} (v{version}) completed, success: {success}")
                        # Publish response and exit early for SET
                        client.publish(MQTT_RESPONSE_TOPIC, json.dumps(response))
                        return

                    response = {
                        'success': True,
                        'results': results
                    }
                    logger.info(f"Operation {operation} (v{version}) completed, {len(results)} results")
                except Exception as e:
                    send_error_log("on_message", f"Error performing {operation}: {e}", ERROR_TYPE_MAJOR, {"operation": operation, "host": host})
                    response = {
                        'success': False,
                        'error': str(e)
                    }
        else:
            # Unknown topic
            send_error_log("on_message", f"Received message on unknown topic: {message.topic}", ERROR_TYPE_WARNING, {"topic": message.topic})
            return

        # Publish response
        client.publish(MQTT_RESPONSE_TOPIC, json.dumps(response))
        logger.info(f"Published response to {MQTT_RESPONSE_TOPIC}")

    except json.JSONDecodeError as e:
        send_error_log("on_message", f"Invalid JSON payload: {e}", ERROR_TYPE_WARNING, {"topic": message.topic})
        error_response = {
            'success': False,
            'error': 'Invalid JSON payload'
        }
        client.publish(MQTT_RESPONSE_TOPIC, json.dumps(error_response))
    except Exception as e:
        send_error_log("on_message", f"Unexpected error: {e}", ERROR_TYPE_MAJOR, {"topic": message.topic})
        error_response = {
            'success': False,
            'error': 'Internal server error'
        }
        client.publish(MQTT_RESPONSE_TOPIC, json.dumps(error_response))

def main():
    """Main function"""
    # Initialize error logger
    initialize_error_logger("SNMPHandlerService")

    logger.info("Starting SNMP Handler Service (CONFIG_SYSTEM_DEVICE)...")

    # Check if SNMP tools are available
    missing_tools = []
    if not os.path.exists(SNMPGET_CMD):
        missing_tools.append("snmpget")
    if not os.path.exists(SNMPWALK_CMD):
        missing_tools.append("snmpwalk")
    if not os.path.exists(SNMPSET_CMD):
        missing_tools.append("snmpset")

    if missing_tools:
        send_error_log("main", f"Required SNMP tools not found: {', '.join(missing_tools)}. Please install net-snmp package.", ERROR_TYPE_CRITICAL, {"missing_tools": missing_tools})
        return

    client = mqtt.Client()
    client.on_message = on_message

    try:
        client.connect("18.143.215.113", 1883, 60)
        client.subscribe([(MQTT_COMMAND_TOPIC, 0)])
        logger.info(f"Subscribed to {MQTT_COMMAND_TOPIC}")
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Stopping SNMP Handler Service...")
    except Exception as e:
        send_error_log("main", f"Failed to start SNMP Handler: {e}", ERROR_TYPE_CRITICAL)

if __name__ == "__main__":
    main()
