import os
import paho.mqtt.client as mqtt
import json
import uuid
from datetime import datetime
import logging
import time
import sys
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# Attempt to import NanoPi specific modules. Handle gracefully if not found.
try:
    import nanopi.duo
    from OPi import GPIO
    NANOPI_ENV = True
except ImportError:
    NANOPI_ENV = False
    logging.warning("NanoPi/OPi.GPIO modules not found. Running in simulation mode for GPIO.")
    # Define dummy GPIO functions for non-NanoPi environment
    class DummyGPIO:
        BCM = 0
        BOARD = 1
        IN = 1
        PUD_UP = 2
        def setmode(self, mode): pass
        def setwarnings(self, state): pass
        def setup(self, pin, mode, pull_up_down=None): 
            logging.info(f"SIMULATED: GPIO pin {pin} setup as input.")
        def input(self, pin): 
            # Simulate button not pressed by default
            return 1 
        def cleanup(self): pass
    GPIO = DummyGPIO()

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ButtonControlService")

# --- GLOBAL CONFIGURATION ---
DEBUG_MODE = True # Set to False to disable most debug prints from console.

# GPIO Setup
BUTTON_PIN = 7 # GPIO pin connected to the button

if NANOPI_ENV:
    try:
        GPIO.setmode(nanopi.duo.BOARD) # Use BOARD numbering for NanoPi Duo
        GPIO.setwarnings(False) # Disable GPIO warnings
        GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP) # Set as input, with pull-up resistor
        logger.info(f"GPIO pin {BUTTON_PIN} set up as input with pull-up.")
    except Exception as e:
        logger.critical(f"FATAL: Failed to set up GPIO pin {BUTTON_PIN}: {e}. Exiting.", exc_info=True)
        send_error_log("GPIO_setup", f"Failed to set up GPIO pin {BUTTON_PIN}: {e}", ERROR_TYPE_CRITICAL, {"pin": BUTTON_PIN})
        sys.exit(1) # Exit if GPIO cannot be set up
else:
    # In simulation mode, GPIO setup logs are handled by DummyGPIO
    GPIO.setmode(GPIO.BOARD) # Call dummy setup for consistency
    GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

# Constants for time thresholds (in seconds)
THRESHOLD_REBOOT_SEC = 5
THRESHOLD_RESET_CONFIG_SEC = 10

# MQTT Broker details for main operations
MQTT_BROKER = "18.143.215.113"
MQTT_PORT = 1883
MQTT_TOPIC_RESET_CONFIG = "command/reset_config"
QOS = 1

# MQTT Topic for centralized error logging
ERROR_LOG_TOPIC = "subrack/error/log"

# Variables to keep track of button state and timing
button_pressed_time = 0
is_button_pressed = False


# --- MAIN MQTT CLIENT SETUP (for commands) ---
main_mqtt_client = mqtt.Client(client_id=f"button-control-main-{uuid.uuid4()}", protocol=mqtt.MQTTv311, clean_session=True)

def on_main_mqtt_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to main MQTT Broker for commands.")
    else:
        send_error_log("on_main_mqtt_connect", f"Failed to connect to main MQTT Broker, return code {rc}", ERROR_TYPE_CRITICAL, {"return_code": rc})

def on_main_mqtt_publish(client, userdata, mid):
    if DEBUG_MODE:
        logger.debug(f"Message with MID {mid} published successfully.")

main_mqtt_client.on_connect = on_main_mqtt_connect
main_mqtt_client.on_publish = on_main_mqtt_publish
main_mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)
try:
    main_mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    main_mqtt_client.loop_start()
except Exception as e:
    send_error_log("main_mqtt_client_connect", f"Failed to connect or start main MQTT client: {e}", ERROR_TYPE_CRITICAL, {"broker": MQTT_BROKER, "port": MQTT_PORT})
    logger.critical(f"FATAL: Failed to connect or start main MQTT client: {e}", exc_info=True)
    # Exiting if main MQTT client fails at startup is reasonable if commands are critical
    sys.exit(1)

# --- SYSTEM COMMAND FUNCTIONS ---
def perform_reboot():
    logger.warning("Initiating system reboot...")
    if NANOPI_ENV: # Only execute actual reboot command on NanoPi
        try:
            os.system('sudo reboot')
        except Exception as e:
            send_error_log("perform_reboot", f"Failed to execute system reboot: {e}", ERROR_TYPE_CRITICAL)
            logger.error(f"Error during reboot: {e}")
    else:
        logger.info("SIMULATED: System reboot command.")

def send_reset_config_command():
    logger.warning("Publishing reset configuration command to MQTT...")
    payload = json.dumps({'action': 'reset_config', 'source': 'button_control', 'timestamp': datetime.now().isoformat()})
    try:
        if main_mqtt_client and main_mqtt_client.is_connected():
            result, mid = main_mqtt_client.publish(MQTT_TOPIC_RESET_CONFIG, payload, qos=QOS)
            if result == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Reset command published to {MQTT_TOPIC_RESET_CONFIG} with MID {mid}")
            else:
                send_error_log("send_reset_config_command", f"Failed to publish MQTT message, result code: {result}", ERROR_TYPE_MAJOR, {"topic": MQTT_TOPIC_RESET_CONFIG})
        else:
            logger.error("Main MQTT client not connected, cannot publish reset command.")
            send_error_log("send_reset_config_command", "Main MQTT client not connected, failed to publish reset command.", ERROR_TYPE_CRITICAL, {"topic": MQTT_TOPIC_RESET_CONFIG})
    except Exception as e:
        send_error_log("send_reset_config_command", f"Error publishing reset command: {e}", ERROR_TYPE_CRITICAL, {"topic": MQTT_TOPIC_RESET_CONFIG})

# --- MAIN LOOP ---
def main_loop():
    global button_pressed_time, is_button_pressed

    logger.info("Button control service started. Waiting for button presses...")

    while True:
        try:
            button_state = GPIO.input(BUTTON_PIN)

            if not button_state: # Button is pressed (LOW, assuming pull-up)
                if not is_button_pressed: # Detect first press
                    is_button_pressed = True
                    button_pressed_time = time.time()
                    logger.info("Button pressed... starting timer.")

                button_held_duration = time.time() - button_pressed_time
                if DEBUG_MODE:
                    logger.debug(f"Button held for {button_held_duration:.2f} seconds")

                if button_held_duration >= THRESHOLD_RESET_CONFIG_SEC and not hasattr(main_loop, 'reset_msg_shown'):
                    logger.info(f"Button held for {THRESHOLD_RESET_CONFIG_SEC}+ seconds. Will trigger config reset on release.")
                    main_loop.reset_msg_shown = True
                elif button_held_duration >= THRESHOLD_REBOOT_SEC and not hasattr(main_loop, 'reboot_msg_shown'):
                    logger.info(f"Button held for {THRESHOLD_REBOOT_SEC}+ seconds. Will trigger reboot on release.")
                    main_loop.reboot_msg_shown = True

            else: # Button is released (HIGH)
                if is_button_pressed: # If button was pressed before
                    button_released_time = time.time()
                    button_held_duration = button_released_time - button_pressed_time

                    logger.info(f"Button released after {button_held_duration:.2f} seconds")

                    if THRESHOLD_REBOOT_SEC <= button_held_duration < THRESHOLD_RESET_CONFIG_SEC:
                        logger.info(f"Button held for {THRESHOLD_REBOOT_SEC}-{THRESHOLD_RESET_CONFIG_SEC-0.01} seconds, initiating system reboot.")
                        perform_reboot()

                    elif button_held_duration >= THRESHOLD_RESET_CONFIG_SEC:
                        logger.info(f"Button held for {THRESHOLD_RESET_CONFIG_SEC} seconds or more, sending reset configuration command via MQTT.")
                        send_reset_config_command()

                    is_button_pressed = False
                    if hasattr(main_loop, 'reboot_msg_shown'): del main_loop.reboot_msg_shown
                    if hasattr(main_loop, 'reset_msg_shown'): del main_loop.reset_msg_shown
                    logger.info("Button state reset.")

        except RuntimeError as e:
            send_error_log("main_loop", f"GPIO read error: {e}", ERROR_TYPE_CRITICAL, {"pin": BUTTON_PIN})
            logger.critical(f"GPIO read error: {e}. Exiting.", exc_info=True)
            break
        except Exception as e:
            send_error_log("main_loop", f"Unhandled error in main loop: {e}", ERROR_TYPE_MAJOR)
            logger.error(f"Unhandled error in main loop: {e}", exc_info=True)

        time.sleep(0.05)

# --- SCRIPT ENTRY POINT ---
if __name__ == "__main__":
    initialize_error_logger("button_control")

    try:
        main_loop()
    except KeyboardInterrupt:
        logger.info("Button control service stopped by user (KeyboardInterrupt).")
    except Exception as e:
        send_error_log("main", f"Unhandled exception before main loop exit: {e}", ERROR_TYPE_CRITICAL)
        logger.critical(f"Unhandled exception in main execution block: {e}", exc_info=True)
    finally:
        logger.info("Cleaning up GPIO resources and disconnecting MQTT clients...")
        GPIO.cleanup()
        
        if main_mqtt_client:
            main_mqtt_client.loop_stop()
            main_mqtt_client.disconnect()
            logger.info("Main MQTT client disconnected.")
        if error_logger_client:
            error_logger_client.loop_stop()
            error_logger_client.disconnect()
            logger.info("Error Logger MQTT client disconnected.")
        logger.info("Service terminated.")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Button Control ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Button Control ===========")
    print("Success To Running")
    print("")

def print_broker_status(**brokers):
    """Print MQTT broker connection status"""
    for broker_name, status in brokers.items():
        if status:
            print(f"MQTT Broker {broker_name.title()} is Running")
        else:
            print(f"MQTT Broker {broker_name.title()} connection failed")
    
    print("\n" + "="*34)
    print("Log print Data")
    print("")

def log_simple(message, level="INFO"):
    """Simple logging without timestamp for cleaner output"""
    if level == "ERROR":
        print(f"[ERROR] {message}")
    elif level == "SUCCESS":
        print(f"[OK] {message}")
    elif level == "WARNING":
        print(f"[WARN] {message}")
    else:
        print(f"[INFO] {message}")

# --- Connection Status Tracking ---
broker_connected = False
