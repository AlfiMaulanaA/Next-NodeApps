// components/DryContactControl.jsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is installed: npm install uuid
import { connectMQTT, getMQTTClient } from '@/lib/mqttClient';

// UI Components from shadcn/ui (ensure they are installed and configured)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { RotateCw, HardDrive, PlusCircle, Trash2, Edit2, Info } from "lucide-react"; // Added more icons
import MqttStatus from '@/components/mqtt-status'; // Your MQTT status component

const DryContactControl = () => {
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState('Disconnected');
  const [dryContactData, setDryContactData] = useState([]);
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [relayDeviceOptions, setRelayDeviceOptions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState(null);

  const initialNewConfig = {
    drycontact: {
      address: "",
      bus: "",
      pin: "",
      expected_value: 1, // Default True
      customName: "",
      control_relays: [],
    },
  };
  const [newConfig, setNewConfig] = useState(initialNewConfig);

  const initialRelayInput = {
    address: "",
    bus: "",
    pin: "",
    set_value: 1, // Default True
    selectedRelayDevice: "",
    customName: "",
    control_type: "auto", // Default "auto"
    delay: 0,
    latching_mode: false, // Default false
    id: uuidv4(), // Add a unique ID for each relay for keying in loops
  };
  const [relayInputs, setRelayInputs] = useState([initialRelayInput]);

  const [selectedDryContactDeviceName, setSelectedDryContactDeviceName] = useState('');

  // MQTT Topics
  const topicInstalledDeviceCommand = "command_installed_device";
  const topicInstalledDeviceResponse = "response_installed_device";
  const topicDryContactCommand = "command_control_drycontact";
  const topicDryContactResponse = "response_control_drycontact";
  const topicGetDataResponse = "response_get_data";
  const topicServiceCommand = "service/command";
  const topicServiceResponse = "service/response";

  const publishMessage = useCallback((message, topic) => {
    const currentClient = getMQTTClient();
    if (currentClient && currentClient.connected) {
      currentClient.publish(topic, JSON.stringify(message), (err) => {
        if (err) {
          console.error(`Failed to publish message to ${topic}:`, err);
          Swal.fire({
            icon: "error",
            title: "Publish Error",
            text: `Failed to send command: ${err.message}`,
          });
        }
      });
    } else {
      console.error("MQTT client not connected for publishing.");
      Swal.fire({
        icon: "error",
        title: "MQTT Disconnected",
        text: "Cannot send command, MQTT client is not connected.",
      });
    }
  }, []);

  const refreshData = useCallback(() => {
    publishMessage({ action: "get" }, topicDryContactCommand);
  }, [publishMessage, topicDryContactCommand]);

  const requestInstalledDevices = useCallback(() => {
    publishMessage("read_device", topicInstalledDeviceCommand);
  }, [publishMessage, topicInstalledDeviceCommand]);

  useEffect(() => {
    let currentClient = null;

    if (typeof window !== 'undefined') {
      try {
        currentClient = connectMQTT();

        currentClient.on("connect", () => {
          console.log("Connected to MQTT Broker");
          setMqttConnectionStatus("Connected");
          currentClient.subscribe(topicServiceResponse, { qos: 0 });
          currentClient.subscribe(topicDryContactResponse);
          currentClient.subscribe(topicInstalledDeviceResponse);
          currentClient.subscribe(topicGetDataResponse);
          refreshData(); // Load data on connect
        });

        currentClient.on("error", (err) => {
          console.error("MQTT Error:", err.message);
          setMqttConnectionStatus("Error: " + err.message);
        });

        currentClient.on("close", () => {
          console.log("MQTT Connection closed");
          setMqttConnectionStatus("Disconnected");
        });

        currentClient.on("message", (topic, message) => {
          console.log("Message arrived:", message.toString());
          try {
            const payload = JSON.parse(message.toString());

            if (topic === topicInstalledDeviceResponse) {
              const dryContactDevices = payload.data
                .filter((device) => device.profile.part_number === "DRYCONTACT")
                .map((device) => ({
                  name: device.profile.name,
                  address: device.protocol_setting.address,
                  bus: device.protocol_setting.device_bus,
                }));
              setDeviceOptions(dryContactDevices);

              const relayDevices = payload.data
                .filter((device) => device.profile.part_number.startsWith("RELAY"))
                .map((device) => ({
                  name: device.profile.name,
                  address: device.protocol_setting.address,
                  bus: device.protocol_setting.device_bus,
                }));
              setRelayDeviceOptions(relayDevices);
            } else if (topic === topicDryContactResponse) {
              if (payload.status === "success") {
                Swal.fire({
                  icon: "success",
                  title: "Success",
                  text: payload.message,
                }).then(() => {
                  refreshData();
                  restartService();
                });
              } else {
                Swal.fire({
                  icon: "error",
                  title: "Error",
                  text: payload.message,
                });
              }
            } else if (topic === topicGetDataResponse) {
              setDryContactData(payload.data?.read_data || []);
            } else if (topic === topicServiceResponse) {
              if (payload.result === "success") {
                Swal.fire({
                  icon: "success",
                  title: "Service Restarted",
                  text: payload.message || "Services restarted successfully.",
                });
              } else {
                Swal.fire({
                  icon: "error",
                  title: "Service Error",
                  text: payload.message || "Failed to restart services.",
                });
              }
            }
          } catch (error) {
            console.error("Error parsing MQTT message:", error);
            Swal.fire({
              icon: "error",
              title: "Parsing Error",
              text: "An error occurred while processing the response.",
            });
          }
        });

      } catch (error) {
        console.error("Error connecting MQTT:", error.message);
        setMqttConnectionStatus("Connection failed: " + error.message);
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
  }, [refreshData, publishMessage, topicDryContactResponse, topicInstalledDeviceResponse, topicGetDataResponse, topicServiceResponse]);

  const restartService = useCallback(() => {
    const services = ["modular_i2c.service", "drycontact_control.service"];
    const command = JSON.stringify({ action: "restart", services: services });
    publishMessage(command, topicServiceCommand);

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
  }, [publishMessage, topicServiceCommand]);

  const openModal = (config = null) => {
    requestInstalledDevices(); // Always request devices when opening modal

    if (config) {
      setIsEditing(true);
      setSelectedConfigId(config.id);
      // Deep copy to prevent direct mutation of table data
      const configCopy = JSON.parse(JSON.stringify(config));
      setNewConfig(configCopy);

      const mappedRelays = (configCopy.drycontact?.control_relays || []).map(
        (relay) => ({
          ...relay,
          selectedRelayDevice:
            relayDeviceOptions.find(
              (device) =>
                device.address === relay.address && device.bus === relay.bus
            )?.name || "",
          id: relay.id || uuidv4(), // Ensure each relay has a unique ID
        })
      );
      setRelayInputs(mappedRelays.length > 0 ? mappedRelays : [initialRelayInput]);

      setSelectedDryContactDeviceName(
        deviceOptions.find(
          (device) =>
            device.address === configCopy.drycontact.address &&
            device.bus === configCopy.drycontact.bus
        )?.name || ""
      );
    } else {
      setIsEditing(false);
      setSelectedConfigId(null);
      setNewConfig(initialNewConfig);
      setRelayInputs([initialRelayInput]);
      setSelectedDryContactDeviceName("");
    }
    setIsModalOpen(true);
  };

  const handleDryContactDeviceNameChange = (value) => {
    setSelectedDryContactDeviceName(value);
    const selectedDevice = deviceOptions.find((device) => device.name === value);
    if (selectedDevice) {
      setNewConfig(prev => ({
        ...prev,
        drycontact: {
          ...prev.drycontact,
          address: selectedDevice.address,
          bus: selectedDevice.bus,
        },
      }));
    } else {
      setNewConfig(prev => ({
        ...prev,
        drycontact: {
          ...prev.drycontact,
          address: "",
          bus: "",
        },
      }));
    }
  };

  const handleRelayDeviceChange = (index, value) => {
    const updatedRelayInputs = [...relayInputs];
    updatedRelayInputs[index].selectedRelayDevice = value;
    const selectedRelayDevice = relayDeviceOptions.find((device) => device.name === value);

    if (selectedRelayDevice) {
      updatedRelayInputs[index].address = selectedRelayDevice.address;
      updatedRelayInputs[index].bus = selectedRelayDevice.bus;
    } else {
      updatedRelayInputs[index].address = "";
      updatedRelayInputs[index].bus = "";
    }
    setRelayInputs(updatedRelayInputs);
  };

  const addRelay = () => {
    setRelayInputs(prev => [...prev, { ...initialRelayInput, id: uuidv4() }]);
  };

  const removeRelay = (relayIdToRemove) => {
    setRelayInputs(prev => prev.filter(relay => relay.id !== relayIdToRemove));
  };

  const handleRelayInputChange = (relayId, field, value) => {
    setRelayInputs(prev => prev.map(relay =>
      relay.id === relayId ? { ...relay, [field]: value } : relay
    ));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const dataToSend = {
      ...newConfig,
      drycontact: {
        ...newConfig.drycontact,
        control_relays: relayInputs.map(relay => ({
          address: relay.address,
          bus: relay.bus,
          pin: relay.pin,
          set_value: relay.set_value,
          customName: relay.customName,
          control_type: relay.control_type,
          delay: relay.delay,
          latching_mode: relay.latching_mode,
        })),
      },
    };

    const command = isEditing ? "update" : "create";
    const payload = isEditing ? { ...dataToSend, id: selectedConfigId } : dataToSend;

    publishMessage({ command, data: payload }, topicDryContactCommand);
    setIsModalOpen(false); // Close modal on submit
  };

  const deleteConfig = (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "Do you want to delete this configuration? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, keep it",
    }).then((result) => {
      if (result.isConfirmed) {
        publishMessage({ command: "delete", data: { id } }, topicDryContactCommand);
        // Optimistically remove from UI
        setDryContactData(prev => prev.filter(config => config.id !== id));
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        Swal.fire({
          title: "Cancelled",
          text: "Your configuration is safe.",
          icon: "error",
        });
      }
    });
  };

  return (
    <SidebarInset>
      {/* Page Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <HardDrive className="h-5 w-5" />
          <h1 className="text-lg font-semibold text-gray-800">Logic Control Configurations</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-gray-600 hover:text-gray-900"
            onClick={refreshData}
            title="Refresh Data"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => openModal()}
          > Add New Config
          </Button>
        </div>
      </header>

      {/* Data Table Section */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 bg-white p-6 rounded-lg shadow-sm">
          <h5 className="text-xl font-bold text-gray-700 mb-4">Dry Contact Data Table</h5>
          {dryContactData.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">ID</TableHead>
                    <TableHead className="min-w-[150px]">Input Name</TableHead>
                    <TableHead className="min-w-[100px]">Address</TableHead>
                    <TableHead className="min-w-[60px]">Bus</TableHead>
                    <TableHead className="min-w-[60px]">Pin</TableHead>
                    <TableHead className="min-w-[60px]">Expected Value</TableHead>
                    <TableHead className="min-w-[400px]">Control Relays</TableHead>
                    <TableHead className="min-w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dryContactData.map((entry, index) => (
                    <TableRow key={entry.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{entry.drycontact?.customName || "N/A"}</TableCell>
                      <TableCell>{entry.drycontact?.address || "N/A"}</TableCell>
                      <TableCell>{entry.drycontact?.bus}</TableCell>
                      <TableCell>{entry.drycontact?.pin || "N/A"}</TableCell>
                      <TableCell>
                       <span className={entry.drycontact?.expected_value ? "text-green-600 font-semibold bg-green-100 py-1 px-2 rounded-full text-sm" : "text-red-600 font-semibold bg-red-100 py-1 px-2 rounded-full text-sm"}>
  {entry.drycontact?.expected_value ? "TRUE" : "FALSE"}
</span>
                      </TableCell>
                      <TableCell>
  {entry.drycontact?.control_relays && entry.drycontact.control_relays.length > 0 ? (
    <div className="space-y-3">
      {" "}
      {/* Increased space-y for better separation */}
      {entry.drycontact.control_relays.map((relay, relayIndex) => (
        <div
          key={relay.id || relayIndex}
          className="p-3 border border-gray-200 rounded-md bg-white shadow-xs text-sm"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {" "}
            {/* Grid for better layout */}
            <div className="font-semibold text-gray-700">Custom Name:</div>
            <div>{relay.customName || "N/A"}</div>
            <div className="font-semibold text-gray-700">Control Type:</div>
            <div className="capitalize">{relay.control_type}</div>
            <div className="font-semibold text-gray-700">Address:</div>
            <div>{relay.address}</div>
            <div className="font-semibold text-gray-700">Pin:</div>
            <div>{relay.pin}</div>
            <div className="font-semibold text-gray-700">Set Value:</div>
            <div>
              <span
                className={
                  relay.set_value
                    ? "text-green-600 font-semibold bg-green-100 py-1 px-2 rounded-full text-sm"
                    : "text-red-600 font-semibold bg-red-100 py-1 px-2 rounded-full text-sm"
                }
              >
                {relay.set_value ? "TRUE" : "FALSE"}
              </span>
            </div>
            <div className="font-semibold text-gray-700">Delay (s):</div>
            <div>{relay.delay}</div>
            <div className="font-semibold text-gray-700">Latching:</div>
            <div>
              <span
                className={
                  relay.latching_mode
                    ? "text-green-600 font-semibold bg-green-100 py-1 px-2 rounded-full text-sm"
                    : "text-red-600 font-semibold bg-red-100 py-1 px-2 rounded-full text-sm"
                }
              >
                {relay.latching_mode ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <span className="text-gray-500 italic">No relays configured.</span>
  )}
</TableCell>
                      <TableCell>
  <div className="flex flex-col gap-2">
    <Button
      size="sm"
      variant="outline"
      onClick={() => openModal(entry)}
      className="w-full justify-start text-orange-600 hover:bg-orange-50/50"
    >
      <Edit2 className="h-4 w-4 mr-2" /> Edit
    </Button>
    <Button
      size="sm"
      variant="destructive"
      onClick={() => deleteConfig(entry.id)}
      className="w-full justify-start"
    >
      <Trash2 className="h-4 w-4 mr-2" /> Delete
    </Button>
  </div>
</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 border rounded-md bg-gray-50">
              <p className="text-gray-500 text-lg mb-4">No logic control configurations found. 😔</p>
              <Button variant="outline" onClick={refreshData} className="text-blue-600 border-blue-600 hover:bg-blue-50">
                <RotateCw className="h-4 w-4 mr-2" /> Refresh Data
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Configuration Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md md:max-w-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800">
              {isEditing ? "Edit Configuration" : "Add New Configuration"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6 py-4">
              {/* Dry Contact Data Section */}
              <h6 className="font-bold text-lg text-gray-700 border-b pb-2 mb-4">Dry Contact Data</h6>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customName" className="text-gray-600">Custom Name</Label>
                  <Input
                    id="customName"
                    value={newConfig.drycontact.customName}
                    onChange={(e) => setNewConfig(prev => ({
                      ...prev,
                      drycontact: { ...prev.drycontact, customName: e.target.value }
                    }))}
                    placeholder="e.g., Main Door Sensor"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="deviceName" className="text-gray-600">Device Name</Label>
                  <Select value={selectedDryContactDeviceName} onValueChange={handleDryContactDeviceNameChange} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a dry contact device" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceOptions.map((device) => (
                        <SelectItem key={device.name} value={device.name}>
                          {device.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pin" className="text-gray-600">Pin</Label>
                  <Input
                    id="pin"
                    type="number"
                    value={newConfig.drycontact.pin}
                    onChange={(e) => setNewConfig(prev => ({
                      ...prev,
                      drycontact: { ...prev.drycontact, pin: parseInt(e.target.value) }
                    }))}
                    placeholder="e.g., 1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="expectedValue" className="text-gray-600">Expected Value</Label>
                  <Select value={String(newConfig.drycontact.expected_value)} onValueChange={(value) => setNewConfig(prev => ({
                    ...prev,
                    drycontact: { ...prev.drycontact, expected_value: parseInt(value) }
                  }))} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select expected value" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">True (Input Triggered)</SelectItem>
                      <SelectItem value="0">False (Input Not Triggered)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="my-4 border-dashed" />

              {/* Control Relays Section */}
              <div className="space-y-6">
                <h6 className="font-bold text-lg text-gray-700 border-b pb-2 mb-4">Control Relays</h6>
                {relayInputs.map((relay, index) => (
                  <div key={relay.id} className="p-5 border border-gray-200 rounded-lg shadow-sm bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                      <h6 className="font-semibold text-md text-gray-700">
                        Control Relay - <span className="text-blue-600">{index + 1}</span>
                      </h6>
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeRelay(relay.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Remove Relay
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor={`relayCustomName-${relay.id}`} className="text-gray-600">Relay Custom Name</Label>
                        <Input
                          id={`relayCustomName-${relay.id}`}
                          value={relay.customName}
                          onChange={(e) => handleRelayInputChange(relay.id, 'customName', e.target.value)}
                          placeholder="e.g., Living Room Light"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`relayDeviceName-${relay.id}`} className="text-gray-600">Relay Device Name</Label>
                        <Select value={relay.selectedRelayDevice} onValueChange={(value) => handleRelayDeviceChange(index, value)} required>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a relay device" />
                          </SelectTrigger>
                          <SelectContent>
                            {relayDeviceOptions.map((device) => (
                              <SelectItem key={device.name} value={device.name}>
                                {device.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`controlRelayPin-${relay.id}`} className="text-gray-600">Relay Pin</Label>
                        <Input
                          id={`controlRelayPin-${relay.id}`}
                          type="number"
                          value={relay.pin}
                          onChange={(e) => handleRelayInputChange(relay.id, 'pin', parseInt(e.target.value))}
                          placeholder="e.g., 0"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`controlRelayValue-${relay.id}`} className="text-gray-600">Set Value</Label>
                        <Select value={String(relay.set_value)} onValueChange={(value) => handleRelayInputChange(relay.id, 'set_value', parseInt(value))} required>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select set value" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">True (Relay ON)</SelectItem>
                            <SelectItem value="0">False (Relay OFF)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`controlType-${relay.id}`} className="text-gray-600">Control Type</Label>
                        <Select value={relay.control_type} onValueChange={(value) => handleRelayInputChange(relay.id, 'control_type', value)} required>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select control type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto (Immediate)</SelectItem>
                            <SelectItem value="delay">Delay (With Delay)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {relay.control_type === 'delay' && (
                        <div>
                          <Label htmlFor={`delay-${relay.id}`} className="text-gray-600">Delay (seconds)</Label>
                          <Input
                            id={`delay-${relay.id}`}
                            type="number"
                            value={relay.delay}
                            onChange={(e) => handleRelayInputChange(relay.id, 'delay', parseInt(e.target.value))}
                            placeholder="e.g., 5"
                            required
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end space-x-3 mt-4">
                      <Label htmlFor={`latchingMode-${relay.id}`} className="text-gray-700 text-sm font-medium">Latching Mode</Label>
                      <Switch
                        id={`latchingMode-${relay.id}`}
                        checked={relay.latching_mode}
                        onCheckedChange={(checked) => handleRelayInputChange(relay.id, 'latching_mode', checked)}
                      />
                      <span className={relay.latching_mode ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {relay.latching_mode ? "Yes" : "No"}
                      </span>
                    </div>
                    {index < relayInputs.length - 1 && <Separator className="my-6 border-dashed" />}
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="mt-8 pt-4 border-t border-gray-200">
              <Button type="button" variant="secondary" onClick={addRelay} className="mr-auto bg-gray-200 hover:bg-gray-300 text-gray-800">
                <PlusCircle className="h-4 w-4 mr-2" /> Add Relay
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                {isEditing ? "Update Configuration" : "Add Configuration"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
};

export default DryContactControl;