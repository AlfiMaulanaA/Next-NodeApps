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
from ErrorLogger import initialize_error_logger, send_error_log, ERROR_TYPE_MINOR, ERROR_TYPE_MAJOR, ERROR_TYPE_CRITICAL, ERROR_TYPE_WARNING

# Fungsi untuk menjalankan file Python
def run_script(script_name):
    try:
        subprocess.run(['python3', script_name])
    except Exception as e:
        send_error_log("run_script", f"Error while running {script_name}: {e}", ERROR_TYPE_MAJOR, {"script": script_name})

if __name__ == '__main__':
    # Initialize error logger
    initialize_error_logger("MultiprocessingService")

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
        'PayloadStatic.py',
        'BrokerTemplateManager.py',
        'ErrorLogger.py',
          'LibraryConfig.py',
         'Network.py',
         'RemapPayload.py',
          'Settings.py',
         'openvpn_service.py',
         'ikev2_service.py',
         'wireguard_service.py',
        # 'UiUpdater.py',
    ]

    # Membuat dan menjalankan proses untuk setiap file
    processes = []
    try:
        for script in scripts:
            try:
                process = multiprocessing.Process(target=run_script, args=(script,))
                processes.append(process)
                process.start()
            except Exception as e:
                send_error_log("__main__", f"Failed to start process for {script}: {e}", ERROR_TYPE_MAJOR, {"script": script})

        # Menunggu semua proses selesai
        for process in processes:
            process.join()

        print("All Scripts, Multi Threads is Running.")
    except Exception as e:
        send_error_log("__main__", f"Error in multiprocessing main loop: {e}", ERROR_TYPE_CRITICAL)
        print(f"[ERROR] Multiprocessing error: {e}")

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
