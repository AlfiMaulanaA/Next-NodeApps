// components/DeviceSchedulerControl.jsx (atau .tsx jika Anda menggunakan TypeScript)

"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import MqttStatus from "@/components/mqtt-status";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
// Import komponen UI yang diperlukan
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RotateCw, ClockFading, Calendar, Users, Settings } from "lucide-react";
import { connectMQTT, getMQTTClient, disconnectMQTT } from "@/lib/mqttClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

// Type definitions
interface Control {
  pin: number;
  customName: string;
  onTime: string;
  offTime: string;
}

interface Device {
  id: string;
  customName: string;
  deviceName?: string;
  name?: string;
  mac: string;
  address: number;
  device_bus: number;
  part_number: string;
  startDay: string;
  endDay: string;
  controls: Control[];
}

interface AvailableDevice {
  id: string;
  name: string;
  address: number;
  device_bus: number;
  part_number: string;
  mac: string;
  manufacturer: string;
  device_type: string;
  topic: string;
}

interface MQTTPayload {
  result?: string;
  message?: string;
  devices?: Device[];
  availableDevices?: AvailableDevice[];
  mac?: string;
}

interface MQTTMessage {
  action: string;
  data?: any;
}

const DeviceSchedulerControl = () => {
  // Namun, kita tetap menyimpannya di sini untuk logging dan feedback SweetAlerts
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState("");
  const [mqttConnectionStatusClass, setMqttConnectionStatusClass] =
    useState("text-warning"); // Mungkin tidak lagi digunakan untuk UI status di header

  const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>(
    []
  );
  const [devices, setDevices] = useState<Device[]>([]);
  const [editingDevice, setEditingDevice] = useState(false);
  const [selectedDeviceName, setSelectedDeviceName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMqttConnected, setIsMqttConnected] = useState(false);

  // Alert and Confirmation Dialog States
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertDialogContent, setAlertDialogContent] = useState<{
    title: string;
    description: string;
  }>({ title: "", description: "" });

  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [confirmationDialogContent, setConfirmationDialogContent] = useState<{
    title: string;
    description: string;
    confirmAction: () => void;
  }>({ title: "", description: "", confirmAction: () => {} });

  // Helper functions for alerts and confirmations
  const showAlert = (title: string, description: string) => {
    setAlertDialogContent({ title, description });
    setAlertDialogOpen(true);
  };

  const showConfirmation = (
    title: string,
    description: string,
    confirmAction: () => void
  ) => {
    setConfirmationDialogContent({ title, description, confirmAction });
    setConfirmationDialogOpen(true);
  };

  const formRef = useRef(null);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const initialDeviceForm: Device = {
    id: "",
    customName: "",
    deviceName: "",
    name: "",
    mac: "",
    address: 0,
    device_bus: 0,
    part_number: "",
    startDay: "Mon",
    endDay: "Sun",
    controls: [{ pin: 1, customName: "", onTime: "08:00", offTime: "17:00" }],
  };
  const [deviceForm, setDeviceForm] = useState<Device>(initialDeviceForm);

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
  const availableDevicesTopic = "MODULAR_DEVICE/AVAILABLES";

  const publishMessage = useCallback(
    (message: MQTTMessage, topic = topicCommand) => {
      const currentClient = getMQTTClient();
      if (currentClient && currentClient.connected) {
        // Validate message has action
        if (!message.action) {
          console.error(
            "Attempted to publish message without action:",
            message
          );
          return;
        }

        console.log(`[SCHEDULER] Publishing to ${topic}:`, message);
        currentClient.publish(
          topic,
          JSON.stringify(message),
          {},
          (err?: Error) => {
            if (err) {
              console.error("Failed to publish message:", err);
            }
          }
        );
      } else {
        console.warn(
          `[SCHEDULER] MQTT client not connected, queuing message for ${topic}:`,
          message
        );
        // Try to connect and publish when connection is established
        setTimeout(() => {
          const retryClient = getMQTTClient();
          if (retryClient && retryClient.connected) {
            console.log(`[SCHEDULER] Retrying publish to ${topic}:`, message);
            retryClient.publish(
              topic,
              JSON.stringify(message),
              {},
              (err?: Error) => {
                if (err) {
                  console.error("Failed to retry publish message:", err);
                }
              }
            );
          } else {
            console.error(
              `[SCHEDULER] Still not connected, failed to publish to ${topic}`
            );
          }
        }, 1000); // Retry after 1 second
      }
    },
    []
  );

  const getConfig = useCallback(() => {
    console.log("[SCHEDULER] Sending get config request");
    publishMessage({ action: "get" });
  }, [publishMessage]);

  const requestMacAddress = useCallback(() => {
    publishMessage({ action: "get_mac_address" }, macAddressRequestTopic);
  }, [publishMessage]);

  const getAvailableDevices = useCallback(() => {
    publishMessage({ action: "get_devices" });
  }, [publishMessage]);

  // Auto-fetch data when MQTT connects
  useEffect(() => {
    if (isMqttConnected) {
      console.log("[SCHEDULER] MQTT connected, fetching initial data");
      getConfig();
      getAvailableDevices();
    }
  }, [isMqttConnected, getConfig, getAvailableDevices]);

  useEffect(() => {
    let currentClient: any = null;

    if (typeof window !== "undefined") {
      try {
        currentClient = connectMQTT();

        currentClient.on("connect", () => {
          console.log("Connected to MQTT Broker via lib/mqttClient");
          setMqttConnectionStatus("Connected");
          setMqttConnectionStatusClass("text-success");
          setIsMqttConnected(true); // Set connection status
          currentClient.subscribe("service/response", { qos: 0 });
          currentClient.subscribe(topicResponse);
          currentClient.subscribe(macAddressResponseTopic);
          currentClient.subscribe(availableDevicesTopic);
          // Data fetching is now handled by the useEffect that depends on isMqttConnected
        });

        currentClient.on("error", (err: Error) => {
          console.error("MQTT Error (from component):", err.message);
          setMqttConnectionStatus("Error: " + err.message);
          setMqttConnectionStatusClass("text-danger");
        });

        currentClient.on("close", () => {
          console.log("MQTT Connection closed (from component)");
          setMqttConnectionStatus("Disconnected from MQTT Broker");
          setMqttConnectionStatusClass("text-danger");
          setIsMqttConnected(false); // Reset connection status
        });

        currentClient.on("message", (topic: string, message: Buffer) => {
          try {
            const payload: MQTTPayload = JSON.parse(message.toString());
            console.log(
              `[SCHEDULER] Received message on topic ${topic}:`,
              payload
            );

            if (topic === macAddressResponseTopic && payload.mac) {
              setDeviceForm((prev) => ({ ...prev, mac: payload.mac || "" }));
              console.log("MAC Address retrieved automatically:", payload.mac);
            } else if (topic === availableDevicesTopic) {
              // Handle available devices from dedicated topic (silent)
              if (Array.isArray(payload)) {
                setAvailableDevices(payload as AvailableDevice[]);
                console.log(
                  `Available devices updated: ${payload.length} devices`
                );
              }
            } else if (payload.result) {
              setMqttConnectionStatus(payload.result);
              console.log(
                `Operation result: ${payload.result} - ${payload.message}`
              );
              if (payload.result === "success") {
                toast.success(payload.message || "Operation completed successfully.");
              } else if (payload.result === "error") {
                toast.error(payload.message || "There was an error processing the request.");
              }
            } else if (topic === topicResponse) {
              // Handle config response - check if it's an array directly
              console.log(`Processing config response on ${topicResponse}`);
              if (Array.isArray(payload)) {
                console.log(
                  `Setting devices from array: ${payload.length} devices`
                );
                setDevices(payload as Device[]);
              } else if (payload.devices && Array.isArray(payload.devices)) {
                console.log(
                  `Setting devices from payload.devices: ${payload.devices.length} devices`
                );
                setDevices(payload.devices);
              } else {
                console.warn(
                  `Unexpected payload structure on ${topicResponse}:`,
                  payload
                );
              }
            } else {
              console.log(
                `Received payload on unhandled topic ${topic} or no relevant data.`
              );
            }
          } catch (error) {
            console.error("Error parsing message:", error);
            console.error("Raw message:", message.toString());
            showAlert(
              "Error",
              `There was an error parsing the MQTT message: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error connecting MQTT:", errorMessage);
        setMqttConnectionStatus("Connection failed: " + errorMessage);
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
  }, [getConfig, macAddressResponseTopic, topicResponse]);

  const uniqueDeviceNames = useMemo(() => {
    // Filter only relay devices for scheduling
    const relayDevices = availableDevices.filter(
      (device) =>
        device.device_type?.toLowerCase().includes("relay") ||
        device.part_number?.toLowerCase().includes("relay") ||
        device.name?.toLowerCase().includes("relay")
    );

    let names = [...new Set(relayDevices.map((device) => device.name))];

    // Fallback: if no available relay devices but we have existing scheduled relay devices, use those names
    if (names.length === 0 && devices.length > 0) {
      const scheduledRelayDevices = devices.filter(
        (device) =>
          device.part_number?.toLowerCase().includes("relay") ||
          device.name?.toLowerCase().includes("relay") ||
          device.deviceName?.toLowerCase().includes("relay")
      );

      names = [
        ...new Set(
          scheduledRelayDevices
            .map((device) => device.name || device.deviceName)
            .filter((name): name is string => !!name)
        ),
      ];
    }

    return names;
  }, [availableDevices, devices]);

  const onDeviceNameChange = (value: string) => {
    setSelectedDeviceName(value);

    // First try to find in available relay devices only
    const relayDevices = availableDevices.filter(
      (device) =>
        device.device_type?.toLowerCase().includes("relay") ||
        device.part_number?.toLowerCase().includes("relay") ||
        device.name?.toLowerCase().includes("relay")
    );

    let selectedDevice = relayDevices.find((device) => device.name === value);

    // Fallback: try to find in existing scheduled relay devices
    if (!selectedDevice) {
      const scheduledRelayDevices = devices.filter(
        (device) =>
          device.part_number?.toLowerCase().includes("relay") ||
          device.name?.toLowerCase().includes("relay") ||
          device.deviceName?.toLowerCase().includes("relay")
      );

      const existingDevice = scheduledRelayDevices.find(
        (device) => device.name === value || device.deviceName === value
      );
      if (existingDevice) {
        selectedDevice = {
          id: existingDevice.id,
          name: existingDevice.name || existingDevice.deviceName || "",
          mac: existingDevice.mac,
          address: existingDevice.address,
          device_bus: existingDevice.device_bus,
          part_number: existingDevice.part_number,
          manufacturer: "",
          device_type: "",
          topic: "",
        };
      }
    }

    if (selectedDevice) {
      setDeviceForm((prev) => ({
        ...prev,
        deviceName: value,
        name: value, // Add name field as required by middleware
        address: selectedDevice.address,
        device_bus: selectedDevice.device_bus,
        part_number: selectedDevice.part_number,
        mac: selectedDevice.mac || prev.mac, // Use device mac if available
      }));
    } else {
      setDeviceForm((prev) => ({
        ...prev,
        deviceName: value,
        name: value,
        address: 0,
        device_bus: 0,
        part_number: "",
      }));
    }
  };

  const showAddDeviceModal = () => {
    setEditingDevice(false);
    setDeviceForm(initialDeviceForm);
    setSelectedDeviceName("");
    getAvailableDevices();
    requestMacAddress();
    setIsModalOpen(true);
  };

  const showEditDeviceModal = (device: Device) => {
    setEditingDevice(true);
    setDeviceForm({
      ...device,
      deviceName: device.deviceName || device.name || "",
      name: device.name || device.deviceName || "",
    });
    setSelectedDeviceName(device.deviceName || device.name || "");
    getAvailableDevices();
    setIsModalOpen(true);
  };

  const saveDevice = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !deviceForm.customName ||
      !deviceForm.name ||
      !deviceForm.mac ||
      !deviceForm.address
    ) {
      showAlert(
        "Validation Error",
        "Please fill in all required fields (Custom Name, Device Name, MAC Address, Address)."
      );
      return;
    }

    const action = editingDevice ? "set" : "add";
    const dataToSend = { ...deviceForm };

    // Ensure required fields are present for middleware
    if (!editingDevice) {
      dataToSend.id = uuidv4();
    }

    publishMessage({ action, data: dataToSend });

    setIsModalOpen(false);
    toast.success(editingDevice ? "Device updated successfully!" : "Device added successfully!");
    restartService();
  };

  const deleteDevice = (id: string) => {
    publishMessage({ action: "delete", data: { id } });
    setDevices((prev) => prev.filter((device) => device.id !== id));

    toast.success("Device deleted successfully!");
    restartService();
  };

  const addControl = () => {
    const usedPins = new Set(deviceForm.controls.map((c) => c.pin));
    let nextPin = 1;
    while (usedPins.has(nextPin)) {
      nextPin++;
    }
    setDeviceForm((prev) => ({
      ...prev,
      controls: [
        ...prev.controls,
        { pin: nextPin, customName: "", onTime: "08:00", offTime: "17:00" },
      ],
    }));
  };

  const removeControl = (controlToRemove: Control) => {
    setDeviceForm((prev) => ({
      ...prev,
      controls: prev.controls.filter((c) => c !== controlToRemove),
    }));
  };

  const restartService = () => {
    // Configuration updates are handled internally by the scheduler
    // Just refresh the config after a short delay
    setTimeout(() => {
      getConfig();
    }, 1000);

    toast.success("Please wait while the scheduler configuration is updated...");
  };

  const handleControlChange = (
    index: number,
    field: keyof Control,
    value: string | number
  ) => {
    const newControls = [...deviceForm.controls];
    (newControls[index] as any)[field] = value;
    setDeviceForm((prev) => ({ ...prev, controls: newControls }));
  };

  // Refresh data and get latest config
  const refreshData = useCallback(() => {
    getConfig();
    getAvailableDevices();
  }, [getConfig, getAvailableDevices]);

  // Calculate summary data
  const totalDevices = devices.length;
  const activeDevices = devices.filter(
    (d) => d.controls && d.controls.length > 0
  ).length;
  const totalControls = devices.reduce(
    (sum, device) => sum + (device.controls?.length || 0),
    0
  );

  const summaryItems = [
    { label: "Total Devices", value: totalDevices, icon: Calendar },
    {
      label: "Active",
      value: activeDevices,
      icon: Settings,
      variant: "default" as const,
    },
    {
      label: "Controls",
      value: totalControls,
      icon: Users,
      variant: "secondary" as const,
    },
  ];

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <ClockFading className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Device Scheduler Control</h1>
        </div>
        <div className="flex gap-2">
          <MqttStatus />
          <Button variant="outline" onClick={refreshData}>
            <RotateCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={showAddDeviceModal}>Add Device</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Summary Cards - Modern Design */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClockFading className="h-5 w-5" />
              <CardTitle>Device Scheduler Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl border">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {totalDevices}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  Scheduled Devices
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl border">
                <Settings className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {activeDevices}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Active Schedules
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-xl border">
                <Users className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {totalControls}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">
                  Control Points
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Control Settings */}
        <div className="flex justify-between items-center p-4 bg-muted/20 rounded-lg border">
          <div className="space-y-1">
            <h3 className="font-semibold">Scheduler Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Manage scheduled device configurations
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button size="sm" onClick={getConfig} variant="outline">
              Get Configuration
            </Button>
          </div>
        </div>

        {/* Devices Table */}
        <div className="rounded-lg border bg-background shadow-sm">
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">
              Scheduled Devices ({devices.length})
            </h3>
          </div>

          {devices.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                No scheduled devices found
              </h3>
              <p className="mb-4">
                Create your first scheduled device to get started
              </p>
              <Button variant="outline" onClick={showAddDeviceModal}>
                Add Device
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-left font-medium">#</th>
                    <th className="p-4 text-left font-medium">Custom Name</th>
                    <th className="p-4 text-left font-medium">Device Name</th>
                    <th className="p-4 text-left font-medium">Address</th>
                    <th className="p-4 text-left font-medium">Device Bus</th>
                    <th className="p-4 text-left font-medium">Schedule</th>
                    <th className="p-4 text-left font-medium">Controls</th>
                    <th className="p-4 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device, index) => {
                    return (
                      <tr
                        key={device.id || index}
                        className="border-b hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4 text-center font-medium text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="p-4 font-medium">{device.customName}</td>
                        <td className="p-4">
                          {device.name || device.deviceName}
                        </td>
                        <td className="p-4">{device.address}</td>
                        <td className="p-4">{device.device_bus}</td>
                        <td className="p-4">
                          <Badge variant="outline">
                            {device.startDay} - {device.endDay}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            {device.controls &&
                              device.controls.map((control, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs bg-muted/50 p-2 rounded"
                                >
                                  <div className="font-semibold">
                                    {control.customName || `Pin ${control.pin}`}
                                  </div>
                                  <div className="text-muted-foreground">
                                    Pin: {control.pin} | {control.onTime} -{" "}
                                    {control.offTime}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => showEditDeviceModal(device)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteDevice(device.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Device Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <DialogTitle>
                {editingDevice ? "Edit Device" : "Add Device"}
              </DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure device scheduling settings and time controls
            </p>
          </DialogHeader>
          <form onSubmit={saveDevice} ref={formRef} className="space-y-6">
            {/* Device Configuration Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                Device Configuration
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="deviceName">Device Name *</Label>
                  <Select
                    value={selectedDeviceName}
                    onValueChange={onDeviceNameChange}
                  >
                    <SelectTrigger id="deviceName">
                      <SelectValue placeholder="Select a device" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueDeviceNames.length > 0 ? (
                        uniqueDeviceNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>
                          No devices available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="customName">Custom Name *</Label>
                  <Input
                    id="customName"
                    value={deviceForm.customName}
                    onChange={(e) =>
                      setDeviceForm((prev) => ({
                        ...prev,
                        customName: e.target.value,
                      }))
                    }
                    placeholder="Enter custom name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="macAddress">
                    MAC Address (Auto-retrieved) *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="macAddress"
                      value={deviceForm.mac}
                      onChange={(e) =>
                        setDeviceForm((prev) => ({
                          ...prev,
                          mac: e.target.value,
                        }))
                      }
                      placeholder="XX:XX:XX:XX:XX:XX"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={requestMacAddress}
                    >
                      Get MAC
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    MAC address will be automatically retrieved from the system
                  </p>
                </div>
              </div>
            </div>

            {/* Schedule Settings Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                Schedule Settings
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDay">Start Day *</Label>
                  <Select
                    value={deviceForm.startDay}
                    onValueChange={(value) =>
                      setDeviceForm((prev) => ({ ...prev, startDay: value }))
                    }
                  >
                    <SelectTrigger id="startDay">
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

                <div>
                  <Label htmlFor="endDay">End Day *</Label>
                  <Select
                    value={deviceForm.endDay}
                    onValueChange={(value) =>
                      setDeviceForm((prev) => ({ ...prev, endDay: value }))
                    }
                  >
                    <SelectTrigger id="endDay">
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
            </div>

            {/* Control Settings Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                Control Settings
              </h4>
              <div className="space-y-4 max-h-60 overflow-y-auto">
                {deviceForm.controls.map((control, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg bg-muted/20"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">Control {index + 1}</h4>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeControl(control)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Custom Name</Label>
                        <Input
                          value={control.customName}
                          onChange={(e) =>
                            handleControlChange(
                              index,
                              "customName",
                              e.target.value
                            )
                          }
                          placeholder="Control name"
                        />
                      </div>
                      <div>
                        <Label>Pin</Label>
                        <Input
                          type="number"
                          value={control.pin}
                          onChange={(e) =>
                            handleControlChange(
                              index,
                              "pin",
                              parseInt(e.target.value)
                            )
                          }
                          placeholder="Pin number"
                          required
                        />
                      </div>
                      <div>
                        <Label>Start Time (24-hour format)</Label>
                        <Input
                          type="time"
                          value={control.onTime}
                          onChange={(e) =>
                            handleControlChange(index, "onTime", e.target.value)
                          }
                          placeholder="HH:MM"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Label>End Time (24-hour format)</Label>
                        <Input
                          type="time"
                          value={control.offTime}
                          onChange={(e) =>
                            handleControlChange(
                              index,
                              "offTime",
                              e.target.value
                            )
                          }
                          placeholder="HH:MM"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addControl}
                className="mt-4 w-full"
              >
                Add Control
              </Button>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingDevice ? "Update Device" : "Add Device"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertDialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationDialogOpen}
        onOpenChange={setConfirmationDialogOpen}
        title={confirmationDialogContent.title}
        description={confirmationDialogContent.description}
        onConfirm={confirmationDialogContent.confirmAction}
      />
    </div>
  );
};

export default DeviceSchedulerControl;
