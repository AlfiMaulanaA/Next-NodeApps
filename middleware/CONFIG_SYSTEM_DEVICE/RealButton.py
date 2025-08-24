import nanopi.duo
from OPi import GPIO
import time
import os
import paho.mqtt.client as mqtt

# Setup GPIO
GPIO.setmode(nanopi.duo.BOARD)
GPIO.setwarnings(False)
GPIO.setup(7, GPIO.IN)

# Constants for time thresholds (in seconds)
THRESHOLD_5_SEC = 5
THRESHOLD_10_SEC = 10

# MQTT Broker details
MQTT_BROKER = "localhost"  # Replace with your MQTT broker address
MQTT_PORT = 1883  # Replace with your MQTT broker port if necessary
MQTT_TOPIC = "command/reset_config"  # Topic for reset command

# Variables to keep track of time
button_pressed_time = 0
button_released_time = 0
button_held_duration = 0
is_button_pressed = False

# MQTT Client setup
client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT Broker!")
    else:
        print("Failed to connect, return code %d" % rc)

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Real Button ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Real Button ===========")
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

", rc)

def on_publish(client, userdata, result):
    print("Message published")

# Connect to MQTT broker
client.on_connect = on_connect
client.on_publish = on_publish
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

# Function to reset system via MQTT (publishing to the reset topic)
def reset_system():
    print("Publishing reset command to MQTT...")
    payload = '{"action": "reset"}'
    client.publish(MQTT_TOPIC, payload)

while True:
    if not GPIO.input(7):  # Button is pressed (pin 7 is LOW)
        if not is_button_pressed:  # Detect first press
            is_button_pressed = True
            button_pressed_time = time.time()  # Record the time when button is pressed
            print("Button pressed... starting timer.")

        button_held_duration = time.time() - button_pressed_time  # Calculate held duration
        print(f"Button held for {button_held_duration:.2f} seconds")  # Log the held duration

    else:  # Button is released (pin 7 is HIGH)
        if is_button_pressed:  # If button was pressed before
            button_released_time = time.time()  # Record the time when button is released
            button_held_duration = button_released_time - button_pressed_time  # Calculate total duration held

            print(f"Button released after {button_held_duration:.2f} seconds")

            # If button was held between 5 and 9.99 seconds, execute the 5-second function (reboot)
            if THRESHOLD_5_SEC <= button_held_duration < THRESHOLD_10_SEC:
                print("Button held for 5-9 seconds, rebooting system")
                os.system('sudo reboot')  # Reboot the system

            # Iffor 10 seconds or more, execute the 10-second function (MQTT reset)
            elif button_held_duration >= THRESHOLD_10_SEC:
                print("Button held for 10 seconds or more, resetting system configuration via MQTT")
                reset_system()  # Call the reset system function to publish to MQTT

            # Reset the state after releasing the button
            is_button_pressed = False
            button_held_duration = 0  # Reset held duration
            print("Timer reset.")