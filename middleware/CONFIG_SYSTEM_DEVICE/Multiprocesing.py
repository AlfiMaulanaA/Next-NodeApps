import multiprocessing
import subprocess
import signal
import time
import os
import sys
import psutil
import threading
from datetime import datetime
import json

# Fungsi untuk menjalankan file Python
def run_script(script_name):
    try:
        subprocess.run(['python3', script_name])
    except Exception as e:
        print(f"Error while running {script_name}: {e}")

if __name__ == '__main__':
    # Daftar file Python yang ingin dijalankan
    scripts = [
        'ApiCombined.py',
        'AutomationLogic.py',
        'AutomationSchedule.py',
        'AutomationUnified.py',
        'AutomationValue.py',
        'AutomationVoice.py',
        'Button.py',
        'DeviceConfig.py',
        'ErrorLogger.py',
        'LibraryConfig.py',
        'Network.py',
        'RemapPayload.py',
        'Settings.py',
        'openvpn_service.py',
        'ikev2_service.py',
        'wireguard_service.py',
    ]

    # Membuat dan menjalankan proses untuk setiap file
    processes = []
    for script in scripts:
        process = multiprocessing.Process(target=run_script, args=(script,))
        processes.append(process)
        process.start()

    # Menunggu semua proses selesai
    for process in processes:
        process.join()

    print("All Scripts, Multi Threads is Running.")

# --- Startup Banner Functions ---
def print_startup_banner():
    """Print standardized startup banner"""
    print("\n" + "="*50)
    print("=========== Multiprocessing ===========")
    print("Initializing System...")
    print("="*50)

def print_success_banner():
    """Print success status banner"""
    print("\n" + "="*50)
    print("=========== Multiprocessing ===========")
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
