// components/DeviceSchedulerControl.jsx (atau .tsx jika Anda menggunakan TypeScript)

"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Swal from 'sweetalert2';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.css';
import { v4 as uuidv4 } from 'uuid';

// Import komponen UI yang diperlukan
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator"; // Asumsi Separator ada di ui/separator
import { RotateCw, ClockFading } from "lucide-react";
import { connectMQTT, getMQTTClient, disconnectMQTT } from '@/lib/mqttClient';
import MqttStatus from '@/components/mqtt-status'; // Komponen status MQTT yang akan kita buat


const DeviceSchedulerControl = () => {
  // Namun, kita tetap menyimpannya di sini untuk logging dan feedback SweetAlerts
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState('');
  const [mqttConnectionStatusClass, setMqttConnectionStatusClass] = useState('text-warning'); // Mungkin tidak lagi digunakan untuk UI status di header

  const [availableDevices, setAvailableDevices] = useState([]);
  const [devices, setDevices] = useState([]);
  const [autoControl, setAutoControl] = useState(false);
  const [editingDevice, setEditingDevice] = useState(false);
  const [selectedDeviceName, setSelectedDeviceName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formRef = useRef(null);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const initialDeviceForm = {
    id: "",
    customName: "",
    deviceName: "",
    mac: "",
    address: "",
    device_bus: "",
    part_number: "",
    startDay: "Mon",
    endDay: "Sun",
    controls: [{ pin: 1, customName: "", onTime: "08:00", offTime: "17:00" }],
  };
  const [deviceForm, setDeviceForm] = useState(initialDeviceForm);

  const timePickerConfig = {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 1,
    allowInput: true,
  };

  const topicCommand = "command_control_scheduler";
  const topicResponse = "response_control_scheduler";
  const macAddressRequestTopic = "mqtt_config/get_mac_address";
  const macAddressResponseTopic = "mqtt_config/response_mac";
  const commandDeviceI2cTopic = "command_device_i2c"; // Topik untuk perintah getDataI2C

  const publishMessage = useCallback((message, topic = topicCommand) => {
    const currentClient = getMQTTClient();
    if (currentClient && currentClient.connected) {
      currentClient.publish(topic, JSON.stringify(message), (err) => {
        if (err) {
          console.error("Failed to publish message:", err);
        }
      });
    } else {
      console.error("MQTT client not connected for publishing.");
    }
  }, []);

  const getConfig = useCallback(() => {
    publishMessage({ action: "get" });
  }, [publishMessage]);

  const requestMacAddress = useCallback(() => {
    publishMessage({ action: "get_mac_address" }, macAddressRequestTopic);
  }, [publishMessage]);

  const getAvailableDevices = useCallback(() => {
    publishMessage({ action: "get_devices" });
  }, [publishMessage]);

  useEffect(() => {
    let currentClient = null;

    if (typeof window !== 'undefined') {
      try {
        currentClient = connectMQTT();

        currentClient.on("connect", () => {
          console.log("Connected to MQTT Broker via lib/mqttClient");
          setMqttConnectionStatus("Connected");
          setMqttConnectionStatusClass("text-success");
          currentClient.subscribe("service/response", { qos: 0 });
          currentClient.subscribe(topicResponse);
          currentClient.subscribe(macAddressResponseTopic);
          currentClient.subscribe(commandDeviceI2cTopic); // Subscribe untuk respon getDataI2C jika ada
          getConfig();
        });

        currentClient.on("error", (err) => {
          console.error("MQTT Error (from component):", err.message);
          setMqttConnectionStatus("Error: " + err.message);
          setMqttConnectionStatusClass("text-danger");
        });

        currentClient.on("close", () => {
          console.log("MQTT Connection closed (from component)");
          setMqttConnectionStatus("Disconnected from MQTT Broker");
          setMqttConnectionStatusClass("text-danger");
        });

        currentClient.on("message", (topic, message) => {
          console.log("Message arrived:", message.toString());
          try {
            const payload = JSON.parse(message.toString());

            if (topic === macAddressResponseTopic && payload.mac) {
              setDeviceForm(prev => ({ ...prev, mac: payload.mac }));
            } else if (topic === commandDeviceI2cTopic && payload.availableDevices) { // Respon untuk getDataI2C
                setAvailableDevices(payload.availableDevices);
            }
            else if (payload.result) {
              setMqttConnectionStatus(payload.result);
              if (payload.result === "success") {
                Swal.fire({
                  icon: "success",
                  title: "Success",
                  text: payload.message || "Operation completed successfully.",
                });
              } else if (payload.result === "error") {
                Swal.fire({
                  icon: "error",
                  title: "Error",
                  text: payload.message || "There was an error processing the request.",
                });
              }
            } else if (Array.isArray(payload.devices) && payload.devices.length > 0) {
              setDevices(payload.devices);
              setAutoControl(payload.autoControl);
            } else if (payload.availableDevices && Array.isArray(payload.availableDevices)) {
              setAvailableDevices(payload.availableDevices);
            } else {
              console.log("Received payload does not match expected structure or contains no relevant data.");
            }
          } catch (error) {
            console.error("Error parsing message:", error);
            Swal.fire({
              icon: "error",
              title: "Error",
              text: "There was an error parsing the MQTT message.",
            });
          }
        });

      } catch (error) {
        console.error("Error connecting MQTT:", error.message);
        setMqttConnectionStatus("Connection failed: " + error.message);
        setMqttConnectionStatusClass("text-danger");
      }
    }

    return () => {
      if (currentClient) {
        currentClient.removeAllListeners("connect");
        currentClient.removeAllListeners("error");
        currentClient.removeAllListeners("close");
        currentClient.removeAllListeners("message");
      }
    };
  }, [getConfig, macAddressResponseTopic, topicResponse, commandDeviceI2cTopic]); // Tambahkan commandDeviceI2cTopic ke dependensi

  const uniqueDeviceNames = useMemo(() => {
    return [...new Set(availableDevices.map((device) => device.name))];
  }, [availableDevices]);

  const onDeviceNameChange = (value) => {
    setSelectedDeviceName(value);
    const selectedDevice = availableDevices.find((device) => device.name === value);
    if (selectedDevice) {
      setDeviceForm(prev => ({
        ...prev,
        deviceName: value,
        address: selectedDevice.address,
        device_bus: selectedDevice.device_bus,
        part_number: selectedDevice.part_number,
      }));
    } else {
      setDeviceForm(prev => ({
        ...prev,
        deviceName: value,
        address: "",
        device_bus: "",
        part_number: "",
      }));
    }
  };

  const showAddDeviceModal = () => {
    setEditingDevice(false);
    setDeviceForm(initialDeviceForm);
    setSelectedDeviceName('');
    getAvailableDevices(); // Mungkin ini perlu diganti dengan command "getDataI2C"
    requestMacAddress();
    setIsModalOpen(true);
  };

  const showEditDeviceModal = (device) => {
    setEditingDevice(true);
    setDeviceForm({ ...device, deviceName: device.deviceName || '' });
    setSelectedDeviceName(device.deviceName || '');
    getAvailableDevices(); // Mungkin ini perlu diganti dengan command "getDataI2C"
    setIsModalOpen(true);
  };

  const saveDevice = (e) => {
    e.preventDefault();
    const action = editingDevice ? "set" : "add";
    const dataToSend = { ...deviceForm };

    if (!editingDevice) {
      dataToSend.id = uuidv4();
    }

    publishMessage({ action, data: JSON.parse(JSON.stringify(dataToSend)) });

    setIsModalOpen(false);
    Swal.fire({
      icon: "success",
      title: editingDevice ? "Device updated!" : "Device added!",
      showConfirmButton: true,
      confirmButtonText: "OK",
    }).then(() => {
      restartService();
    });
  };

  const deleteDevice = (id) => {
    publishMessage({ action: "delete", data: { id } });
    setDevices(prev => prev.filter((device) => device.id !== id));

    Swal.fire({
      icon: "success",
      title: "Device Deleted!",
      showConfirmButton: true,
      confirmButtonText: "OK",
    }).then(() => {
      restartService();
    });
  };

  const addControl = () => {
    const usedPins = new Set(deviceForm.controls.map((c) => c.pin));
    let nextPin = 1;
    while (usedPins.has(nextPin)) {
      nextPin++;
    }
    setDeviceForm(prev => ({
      ...prev,
      controls: [
        ...prev.controls,
        { pin: nextPin, customName: "", onTime: "08:00", offTime: "17:00" },
      ],
    }));
  };

  const removeControl = (controlToRemove) => {
    setDeviceForm(prev => ({
      ...prev,
      controls: prev.controls.filter((c) => c !== controlToRemove),
    }));
  };

  const updateAutoControl = (checked) => {
    setAutoControl(checked);
    publishMessage({
      action: "update_autoControl",
      data: { autoControl: checked },
    });
  };

  const restartService = () => {
    const services = ["modular_i2c.service", "scheduler_control.service"];

    const command = JSON.stringify({
      action: "restart",
      services: services,
    });

    const client = getMQTTClient();
    if (client && client.connected) {
      client.publish("service/command", command);
    } else {
      console.error("MQTT client not connected to send restart command.");
      Swal.fire({
        title: "Connection Error",
        text: "MQTT client is not connected. Cannot send restart command.",
        icon: "error",
      });
      return;
    }

    Swal.fire({
      title: "Restarting Services",
      text: "Please wait while the services are being restarted...",
      icon: "info",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  };

  const handleControlChange = (index, field, value) => {
    const newControls = [...deviceForm.controls];
    newControls[index][field] = value;
    setDeviceForm(prev => ({ ...prev, controls: newControls }));
  };

  // Fungsi untuk memanggil getDataI2C
  const requestGetDataI2C = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      client.publish(commandDeviceI2cTopic, JSON.stringify({ command: "getDataI2C" }));
    } else {
      console.error("MQTT client not connected to send getDataI2C command.");
    }
  }, [commandDeviceI2cTopic]);

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <ClockFading className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Device Scheduler Control</h1> {/* Judul diubah */}
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus /> {/* Komponen status MQTT */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={requestGetDataI2C} // Panggil fungsi yang diperbarui
          >
            <RotateCw />
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={showAddDeviceModal} // Memanggil modal tambah perangkat
          >
            Add Device
          </Button>
        </div>
      </header>

      {/* Konten utama yang sebelumnya ada di CardContent */}
      <div className="flex-1 overflow-y-auto p-4"> {/* Menambahkan padding dan scrollability */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <Button size="sm" onClick={getConfig} className="mr-2">
                Get Configuration
              </Button>
              {/* Tombol Add Device dipindahkan ke header */}
            </div>
            <div>
              <div className="flex items-center">
                <Switch
                  checked={autoControl}
                  onCheckedChange={updateAutoControl}
                  id="auto-control"
                />
                <Label htmlFor="auto-control" className="ml-3 mt-2">Control State</Label>
              </div>
            </div>
          </div>

          <h5 className="text-lg font-semibold mb-3">Control Scheduler</h5>
          {devices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Custom Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Device Bus</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Controls</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device, index) => (
                  <TableRow key={device.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{device.customName}</TableCell>
                    <TableCell>{device.address}</TableCell>
                    <TableCell>{device.device_bus}</TableCell>
                    <TableCell>
                      <strong>Active Days: </strong> {device.startDay} - {device.endDay}
                    </TableCell>
                    <TableCell>
                      <ul>
                        {device.controls.map((control) => (
                          <li key={control.pin} className="flex justify-between text-sm">
                            <span>
                              Name: <span className="font-bold">{control.customName}</span> - Pin:{" "}
                              <span className="font-bold">{control.pin}</span>
                            </span>
                            <span>
                              Turn On: <span className="font-bold">{control.onTime} </span> - Turn Off:{" "}
                              <span className="font-bold">{control.offTime}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => showEditDeviceModal(device)} className="mr-2">
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteDevice(device.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">No devices found. Click "Get Configuration" to load or "Add Device" to create one.</p>
              <Button variant="link" onClick={getConfig}>Get Configuration</Button>
            </div>
          )}
        </div>
      </div>


      {/* Add/Edit Device Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {editingDevice ? "Edit Device" : "Add Device"}
              <Badge variant="secondary" onClick={getAvailableDevices} className="ml-2 cursor-pointer">
                Get Devices
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveDevice} ref={formRef}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="col-span-1">
                <Label htmlFor="device_name">Device Name</Label>
                <Select value={selectedDeviceName} onValueChange={onDeviceNameChange} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a device" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueDeviceNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label htmlFor="custom_name">Custom Name</Label>
                <Input
                  id="custom_name"
                  value={deviceForm.customName}
                  onChange={(e) => setDeviceForm(prev => ({ ...prev, customName: e.target.value }))}
                  placeholder="Enter Custom Name"
                  required
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="startDay">Start Day</Label>
                <Select value={deviceForm.startDay} onValueChange={(value) => setDeviceForm(prev => ({ ...prev, startDay: value }))} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select start day" />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label htmlFor="endDay">End Day</Label>
                <Select value={deviceForm.endDay} onValueChange={(value) => setDeviceForm(prev => ({ ...prev, endDay: value }))} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select end day" />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-3">
              <h5 className="text-md font-semibold mb-2">Controls</h5>
              <div className="max-h-60 overflow-y-auto pr-2">
                {deviceForm.controls.map((control, index) => (
                  <div key={index} className="mb-4 p-3 border rounded-md">
                    <hr className="my-2" />
                    <div className="grid grid-cols-12 gap-2 items-center mb-2">
                      <div className="col-span-9">
                        <Input
                          value={control.customName}
                          onChange={(e) => handleControlChange(index, 'customName', e.target.value)}
                          placeholder="Custom Name for control"
                        />
                      </div>
                      <div className="col-span-3 text-right">
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeControl(control)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Pin</Label>
                        <Input
                          type="number"
                          value={control.pin}
                          onChange={(e) => handleControlChange(index, 'pin', parseInt(e.target.value))}
                          placeholder="Pin"
                          required
                        />
                      </div>
                      <div>
                        <Label>Start Time</Label>
                        <Flatpickr
                          options={timePickerConfig}
                          value={control.onTime}
                          onChange={([date]) => handleControlChange(index, 'onTime', date ? Flatpickr.formatDate(date, "H:i") : "")}
                          className="w-full p-2 border rounded-md"
                          placeholder="On Time"
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Flatpickr
                          options={timePickerConfig}
                          value={control.offTime}
                          onChange={([date]) => handleControlChange(index, 'offTime', date ? Flatpickr.formatDate(date, "H:i") : "")}
                          className="w-full p-2 border rounded-md"
                          placeholder="Off Time"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button type="button" variant="secondary" size="sm" onClick={addControl} className="mr-2">
                Add Control
              </Button>
              <Button type="submit" size="sm">
                {editingDevice ? "Update" : "Add"} Device
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
};

export default DeviceSchedulerControl;