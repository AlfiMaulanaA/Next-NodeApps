 sudo python3 Multiprocesing.py

==================================================
======= Automation Voice Control =======
Initializing System...
==================================================
[INFO] Testing MAC address detection...
[INFO] Checking network interfaces with ifconfig
[OK] Found active MAC address from wlan0 (sysfs): 70:f7:54:cb:7a:93
[INFO] MAC address detection test result: 70:f7:54:cb:7a:93
[INFO] Loading configurations...
[INFO] Voice configuration loaded from ./JSON/automationVoiceConfig.json
[INFO] Modular devices loaded: 2 devices
[WARN] Cannot publish available modular devices - CRUD client not connected
[INFO] Initializing unified error logger...
Error logger connected for AutomationVoiceService
Error logger initialized for AutomationVoiceService
[INFO] Connecting to CRUD MQTT broker...
[INFO] Connecting to Control MQTT broker...
[OK] CRUD MQTT broker connected
[OK] Published 2 available MODULAR devices
[OK] Control MQTT broker connected

==================================================
======= Automation Logic Control =======
Initializing System...
==================================================
[INFO] Testing MAC address detection...
[INFO] Checking network interfaces with ifconfig

==================================================
2025-10-01 17:14:07,284 - DeviceLibraryService - INFO - Starting Device Library Service...
======= Automation Value Control =======
Initializing System...
==================================================
[INFO] Testing MAC address detection...
[INFO] Checking network interfaces with ifconfig
[OK] Found active MAC address from wlan0 (sysfs): 70:f7:54:cb:7a:93
[INFO] MAC address detection test result: 70:f7:54:cb:7a:93
[INFO] Loading configurations...
[INFO] Logic configuration loaded from ./JSON/automationLogicConfig.json
[INFO] Modular devices loaded: 2 devices
[WARN] Cannot publish available devices - CRUD client not connected
[INFO] Initializing unified error logger...
[OK] Found active MAC address from wlan0 (sysfs): 70:f7:54:cb:7a:93
[INFO] MAC address detection test result: 70:f7:54:cb:7a:93
[INFO] Loading configurations...
[INFO] Value configuration loaded from ./JSON/automationValueConfig.json
[INFO] MODBUS devices loaded: 2 devices
[WARN] Cannot publish available devices - CRUD client not connected
[INFO] Modular devices loaded: 2 devices
[WARN] Cannot publish available modular devices - CRUD client not connected
[INFO] Initializing unified error logger...
2025-10-01 17:14:07,429 - DeviceLibraryService - INFO - Connected to dedicated Error Log MQTT Broker (localhost).
2025-10-01 17:14:07,431 - DeviceLibraryService - INFO - Dedicated error logger client initialized and started loop to localhost:1883
[WARNING] Error decoding MQTT config file: Expecting value: line 1 column 1 (char 0). Using default configuration.
[WARNING] Error in load_mqtt_config: Error decoding MQTT config file: Expecting value: line 1 column 1 (char 0)

==================================================
======= Automation Schedule =======
Initializing System...
==================================================
[INFO] Initializing error logger...
2025-10-01 17:14:07,477 - DeviceLibraryService - INFO - Connected to MQTT Broker!
2025-10-01 17:14:07,495 - DeviceLibraryService - INFO - Subscribed to topics: library/devices/summary/search, library/devices/command
Error logger connected for AutomationLogicService
2025-10-01 17:14:07,498 - DeviceLibraryService - INFO - Device summary publishing thread started.
Error logger initialized for AutomationLogicService
[INFO] Connecting to CRUD MQTT broker...
[INFO] Connecting to Control MQTT broker...
2025-10-01 17:14:07,571 - ButtonControlService - INFO - GPIO pin 7 set up as input with pull-up.
2025-10-01 17:14:07,698 - NetworkManagerService - INFO - Starting Network Manager Service...
Error logger initialized for AutomationValueService
[INFO] Connecting to CRUD MQTT broker...
[INFO] Connecting to Control MQTT broker...
2025-10-01 17:14:07,793 - ButtonControlService - INFO - Connected to main MQTT Broker for commands.
Error logger connected for AutomationValueService
2025-10-01 17:14:07,813 - ButtonControlService - INFO - Connected to dedicated Error Log MQTT Broker (localhost).
[OK] CRUD MQTT broker connected
2025-10-01 17:14:07,814 - ButtonControlService - INFO - Dedicated error logger client initialized and started loop to localhost:1883
2025-10-01 17:14:07,820 - ButtonControlService - INFO - Button control service started. Waiting for button presses...
2025-10-01 17:14:07,825 - NetworkManagerService - INFO - Error logger connected.
2025-10-01 17:14:07,827 - NetworkManagerService - INFO - Error logger initialized.
[OK] Published 2 available MODBUS devices
[OK] CRUD MQTT broker connected
[OK] Published 2 available MODULAR devices
[OK] Control MQTT broker connected
[INFO] Total device topics subscribed: 0
Initialized dedicated error logger client to localhost:1883
[INFO] Loading configurations...
[OK] Published 2 available devices
Configuration loaded as array from ./JSON/automationSchedulerConfig.json
Installed devices loaded from ../MODULAR_I2C/JSON/Config/installed_devices.json
[OK] Error Logger MQTT broker connected
[INFO] Connecting to Control MQTT broker...
[WARN] Invalid device data format for topic 'MODULAR_DEVICE/AVAILABLES': expected dict, got list
[INFO] Connecting to CRUD MQTT broker...
[OK] Control MQTT broker connected
[OK] Control MQTT broker connected
[INFO] Total device topics subscribed: 0
[OK] CRUD MQTT broker connected
[INFO] Subscribing to command topic: command_control_scheduler
[INFO] Subscribing to MAC address topic: mqtt_config/get_mac_address

==================================================
========== Device Config ==========
Initializing System...
==================================================
[INFO] Initializing error logger...
Dedicated error logger client initialized and started loop to localhost:1883
[INFO] Setting up MQTT clients...
Mencoba menyambungkan ke broker MQTT di localhost:1883...
Koneksi ke broker MQTT di localhost:1883 BERHASIL.
Mencoba menyambungkan ke broker MQTT di localhost:1883...
Koneksi ke broker MQTT di localhost:1883 BERHASIL.
[OK] Error Logger MQTT broker connected
2025-10-01 17:14:08,070 - WARNING - Config file not found: /home/containment/thermal_mqtt_project/config/mqtt_config.json
2025-10-01 17:14:08,074 - INFO - RPi Config Manager initialized (network method: networkmanager)

==================================================
===== User Management Service =====
Initializing System...
==================================================
[INFO] Loading user management configurations...
2025-10-01 17:14:08,082 - INFO - Starting RPi Config Manager with Network Management...
[INFO] Users configuration loaded from ./JSON/usersConfig.json
[INFO] Connecting to MQTT broker...
[OK] Connected to MQTT broker successfully
[OK] Subscribed to user management MQTT topic
[INFO] Starting users data publisher thread...
[OK] Users data publisher thread started
2025-10-01 17:14:08,143 - INFO - MQTT connected to localhost
2025-10-01 17:14:08,145 - INFO - Attempting to connect to MQTT broker at localhost:1883...
2025-10-01 17:14:08,145 - INFO - MQTT connected successfully
2025-10-01 17:14:08,156 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:08,172 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:08,174 - INFO - Starting system information publisher thread...
2025-10-01 17:14:08,175 - INFO - System info publishing thread started. ▶️
2025-10-01 17:14:08,181 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:08,835 - NetworkManagerService - INFO - MQTT client started.
2025-10-01 17:14:08,836 - NetworkManagerService - INFO - MQTT client connected.
2025-10-01 17:14:08,838 - NetworkManagerService - INFO - Subscribed to topics.
2025-10-01 17:14:08,846 - NetworkManagerService - INFO - Published MAC address: 70:f7:54:cb:7a:93
2025-10-01 17:14:08,848 - NetworkManagerService - INFO - Started auto-publishing MQTT configurations.
2025-10-01 17:14:08,869 - NetworkManagerService - INFO - [auto_publish_mqtt_configs] MQTT configs published successfully
2025-10-01 17:14:09,177 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:09,179 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313649-7100486410', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:09', 'status': 'active'}
2025-10-01 17:14:09,180 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7

==================================================
======= Automation Voice Control =======
Success To Running

MQTT Broker CRUD is Running
MQTT Broker Control is Running

==================================
Log print Data

[OK] Automation Voice Control service started successfully
[INFO] Starting voice control publisher thread...
[OK] Voice control publisher thread started successfully
 * Serving Flask app 'ApiCombined'
 * Debug mode: off
Address already in use
Port 8000 is in use by another program. Either identify and stop that program, or start the server with a different port.

==================================================
======= Automation Value Control =======
Success To Running

MQTT Broker CRUD is Running
MQTT Broker Control is Running

==================================
Log print Data

[OK] Automation Value Control service started successfully

==================================================
======= Automation Logic Control =======
Success To Running

MQTT Broker CRUD is Running
MQTT Broker Control is Running

==================================
Log print Data

[OK] Automation Logic Control service started successfully

==================================================
======= Automation Schedule =======
Success To Running

MQTT Broker CRUD is Running
MQTT Broker Control is Running

==================================
Log print Data

[INFO] Setting up scheduled tasks...
No devices configured in automationSchedulerConfig.json to schedule.
[INFO] Checking and sending immediate control signals...
[OK] Scheduler service started successfully

==================================================
========== Device Config ==========
Success To Running

MQTT Broker Local connection failed
MQTT Broker Data connection failed

==================================
Log print Data

[INFO] Starting periodic publish thread...
[INFO] Starting periodic available devices publishing...
[WARN] Client not connected, skipping available devices publish
[OK] Device Config service started successfully
[OK] Local MQTT broker connected
[INFO] Sending all available devices...
[OK] Loaded 2 MODULAR I2C devices
[OK] Published 2 MODULAR devices to MODULAR_DEVICE/AVAILABLES
[OK] Loaded 2 MODBUS SNMP devices
[OK] Published 2 MODBUS devices to MODBUS_DEVICE/AVAILABLES
[WARN] Invalid device data format for topic 'MODULAR_DEVICE/AVAILABLES': expected dict, got list
[WARN] Invalid device data format for topic 'MODBUS_DEVICE/AVAILABLES': expected dict, got list
[INFO] Periodic publish completed. Modbus: 2, I2C: 2 devices

==================================================
===== User Management Service =====
Success To Running
Log print Data

MQTT Broker is Running

==================================
[OK] User Management Service started with 3 users
2025-10-01 17:14:10,151 - INFO - MQTT connected successfully
2025-10-01 17:14:10,155 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:10,191 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:10,193 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:11,194 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:11,195 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313651-2331536794', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:11', 'status': 'active'}
2025-10-01 17:14:11,196 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:12,158 - INFO - MQTT connected successfully
2025-10-01 17:14:12,161 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:12,204 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:12,216 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:13,218 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:13,222 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313653-8728387560', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:13', 'status': 'active'}
2025-10-01 17:14:13,225 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
[WARN] Invalid device data format for topic 'MODULAR_DEVICE/AVAILABLES': expected dict, got list
[WARN] Invalid device data format for topic 'MODBUS_DEVICE/AVAILABLES': expected dict, got list
2025-10-01 17:14:13,901 - NetworkManagerService - INFO - [auto_publish_mqtt_configs] MQTT configs published successfully
2025-10-01 17:14:14,169 - INFO - MQTT connected successfully
2025-10-01 17:14:14,174 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:14,231 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:14,235 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:15,238 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:15,240 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313655-2964352090', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:15', 'status': 'active'}
2025-10-01 17:14:15,240 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:16,177 - INFO - MQTT connected successfully
2025-10-01 17:14:16,180 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:16,245 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:16,248 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:17,252 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:17,254 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313657-8068429209', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:17', 'status': 'active'}
2025-10-01 17:14:17,254 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:18,185 - INFO - MQTT connected successfully
2025-10-01 17:14:18,188 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:18,258 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:18,261 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:18,931 - NetworkManagerService - INFO - [auto_publish_mqtt_configs] MQTT configs published successfully
2025-10-01 17:14:19,265 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:19,266 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313659-6093851158', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:19', 'status': 'active'}
2025-10-01 17:14:19,267 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:20,193 - INFO - MQTT connected successfully
2025-10-01 17:14:20,196 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:20,271 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:20,274 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:21,278 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:21,280 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313661-7490396300', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:21', 'status': 'active'}
2025-10-01 17:14:21,280 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:22,201 - INFO - MQTT connected successfully
2025-10-01 17:14:22,204 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:22,285 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:22,288 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:23,296 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:23,298 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313663-2284519996', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:23', 'status': 'active'}
2025-10-01 17:14:23,299 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:23,950 - NetworkManagerService - INFO - [auto_publish_mqtt_configs] MQTT configs published successfully
2025-10-01 17:14:24,214 - INFO - MQTT connected successfully
2025-10-01 17:14:24,217 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:24,315 - WARNING - MQTT client not connected, unable to publish system info. Waiting...
2025-10-01 17:14:24,317 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:24,320 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:25,325 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:25,326 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313665-5401251697', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:25', 'status': 'active'}
2025-10-01 17:14:25,327 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:26,223 - INFO - MQTT connected successfully
2025-10-01 17:14:26,226 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:26,334 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:26,336 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:27,341 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:27,342 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313667-8813841755', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:27', 'status': 'active'}
2025-10-01 17:14:27,343 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:28,230 - INFO - MQTT connected successfully
2025-10-01 17:14:28,233 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:28,347 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:28,350 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:28,967 - NetworkManagerService - INFO - [auto_publish_mqtt_configs] MQTT configs published successfully
2025-10-01 17:14:29,354 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:29,355 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313669-9228981947', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:29', 'status': 'active'}
2025-10-01 17:14:29,356 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:30,238 - INFO - MQTT connected successfully
2025-10-01 17:14:30,241 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:30,360 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:30,363 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:31,366 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:31,368 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313671-5198845530', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:31', 'status': 'active'}
2025-10-01 17:14:31,368 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:32,246 - INFO - MQTT connected successfully
2025-10-01 17:14:32,249 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:32,373 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:32,375 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:33,379 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:33,381 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313673-6639341173', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:33', 'status': 'active'}
2025-10-01 17:14:33,381 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:33,986 - NetworkManagerService - INFO - [auto_publish_mqtt_configs] MQTT configs published successfully
2025-10-01 17:14:34,256 - INFO - MQTT connected successfully
2025-10-01 17:14:34,264 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:34,390 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:34,393 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:35,393 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:35,395 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313675-7404698360', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:35', 'status': 'active'}
2025-10-01 17:14:35,396 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:36,265 - INFO - MQTT connected successfully
2025-10-01 17:14:36,268 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:36,402 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:36,407 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:37,411 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:37,412 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313677-2199775950', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:37', 'status': 'active'}
2025-10-01 17:14:37,413 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:38,274 - INFO - MQTT connected successfully
2025-10-01 17:14:38,277 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:38,417 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:38,420 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:39,005 - NetworkManagerService - INFO - [auto_publish_mqtt_configs] MQTT configs published successfully
2025-10-01 17:14:39,424 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:39,426 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313679-7408374988', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:39', 'status': 'active'}
2025-10-01 17:14:39,427 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
[INFO] Sending all available devices...
[OK] Loaded 2 MODULAR I2C devices
[OK] Published 2 MODULAR devices to MODULAR_DEVICE/AVAILABLES
[OK] Loaded 2 MODBUS SNMP devices
[WARN] Invalid device data format for topic 'MODULAR_DEVICE/AVAILABLES': expected dict, got list
[OK] Published 2 MODBUS devices to MODBUS_DEVICE/AVAILABLES
[INFO] Periodic available devices published
[WARN] Invalid device data format for topic 'MODBUS_DEVICE/AVAILABLES': expected dict, got list
2025-10-01 17:14:40,282 - INFO - MQTT connected successfully
2025-10-01 17:14:40,285 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:40,431 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:40,434 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:41,438 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:41,440 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313681-4077756064', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:41', 'status': 'active'}
2025-10-01 17:14:41,440 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
2025-10-01 17:14:42,290 - INFO - MQTT connected successfully
2025-10-01 17:14:42,294 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:42,445 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:42,447 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file
2025-10-01 17:14:43,451 - WARNING - Disconnected from MQTT broker with result code 7 🔌. Attempting to reconnect...
2025-10-01 17:14:43,453 - ERROR - Sent error log for mqtt_on_disconnect: {'id': 'SettingsService--1759313683-7662788500', 'data': '[Mqtt On Disconnect] Disconnected with code 7', 'type': 'MAJOR', 'source': 'SettingsService', 'Timestamp': '2025-10-01 17:14:43', 'status': 'active'}
2025-10-01 17:14:43,454 - ERROR - Local error log for mqtt_on_disconnect: Disconnected with code 7
[WARN] Invalid device data format for topic 'MODULAR_DEVICE/AVAILABLES': expected dict, got list
[WARN] Invalid device data format for topic 'MODBUS_DEVICE/AVAILABLES': expected dict, got list
2025-10-01 17:14:44,025 - NetworkManagerService - INFO - [auto_publish_mqtt_configs] MQTT configs published successfully
2025-10-01 17:14:44,298 - INFO - MQTT connected successfully
2025-10-01 17:14:44,301 - INFO - Subscribed to all configuration topics
2025-10-01 17:14:44,458 - INFO - Connected to MQTT broker successfully! ✅
2025-10-01 17:14:44,460 - INFO - Subscribed to: command/reset_config, service/command, command_download_file, command_upload_file