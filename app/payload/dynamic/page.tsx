"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Settings2, PlusCircle, Edit2, Trash2, ArrowUpDown, Eye } from "lucide-react";
import MQTTConnectionBadge from "@/components/mqtt-status";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { useSortableTable } from "@/hooks/use-sort-table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import axios from "axios";
import { connectMQTT } from "@/lib/mqttClient";
import { MqttClient } from 'mqtt';
import Swal from 'sweetalert2';

// Import Shadcn UI Select components
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
} from "@/components/ui/select";

// --- Type Definitions ---
interface KeyValue {
  key: string;
  value: string;
}

interface DeviceFormState {
  name: string;
  part_number: string;
  value_group?: string; // Optional
  keyOptions: string[];
  value_keys: KeyValue[];
}

interface Calculation {
  operation: string; // e.g., "sum", "average", "multiply", "divide"
  name: string;      // Name for the calculated key in the payload
  value_group_selected: string; // The value_group to apply calculation on
}

interface SummaryGroup {
  summary_topic: string;
  included_devices: Array<{
    name: string;
    value_group?: string;
    value_keys: { [key: string]: string };
  }>;
  calculations: Calculation[]; // Added
  retain: boolean;
  qos: number;
  interval: number;
  calculation_only: boolean; // Added
}

interface SummaryConfig {
  groups: SummaryGroup[];
}

interface RawDeviceInfo {
  name: string;
  part_number: string;
  data?: Array<{ var_name: string }>;
}

// --- Main Component ---
export default function CustomPayloadPage() {
  // --- State Variables ---
  const [mqttStatus, setMqttStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [config, setConfig] = useState<SummaryConfig | null>(null);
  const [devicesInfo, setDevicesInfo] = useState<RawDeviceInfo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // Form states for the modal
  const [summaryTopic, setSummaryTopic] = useState("");
  const [retain, setRetain] = useState(false);
  const [qos, setQos] = useState(0);
  const [interval, setIntervalValue] = useState(10);
  const [devicesInForm, setDevicesInForm] = useState<DeviceFormState[]>([
    { name: "", part_number: "", keyOptions: [], value_keys: [{ key: "", value: "" }] }
  ]);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [calculationOnly, setCalculationOnly] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<string | null>(null);

  const deviceKeyOptionsMap = useRef<Record<string, string[]>>({});
  const clientRef = useRef<MqttClient | null>(null);

  // --- Callbacks for MQTT Operations ---
  const fetchAvailableDevices = useCallback(() => {
    if (clientRef.current?.connected) {
      console.log("Publishing getDeviceInfo command...");
      clientRef.current.publish("config/device_info", JSON.stringify({ command: "getDeviceInfo" }));
    } else {
      console.warn("MQTT not connected, cannot publish getDeviceInfo.");
    }
  }, []);

  const fetchSummaryData = useCallback(() => {
    if (clientRef.current?.connected) {
      console.log("Publishing getData command to config/summary_device...");
      clientRef.current.publish("config/summary_device", JSON.stringify({ command: "getData" }));
    } else {
      console.warn("MQTT not connected, cannot publish getData.");
      toast.error("MQTT not connected. Cannot fetch data.");
    }
  }, []);

  const sendCommand = useCallback((command: string, data: any) => {
    if (!clientRef.current?.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }
    clientRef.current.publish("config/summary_device", JSON.stringify({ command, data }), (err) => {
      if (err) {
        toast.error(`Failed to send command: ${err.message}`);
        console.error("Publish error:", err);
      } else {
        if (command !== "getData") {
             toast.info(`Command '${command}' sent. Awaiting response...`);
        }
      }
    });
  }, []);

  // --- Event Handlers for MQTT Client ---
  const handleConnect = useCallback(() => {
    setMqttStatus("connected");
    toast.success("MQTT Connected!");
    if (clientRef.current) {
      clientRef.current.subscribe("config/device_info/response", { qos: 1 });
      clientRef.current.subscribe("config/summary_device/response", { qos: 1 });
      console.log("Subscribed to response topics.");
      fetchAvailableDevices(); // Request data immediately upon connection
      fetchSummaryData();     // Request data immediately upon connection
    }
  }, [fetchAvailableDevices, fetchSummaryData]);

  const handleError = useCallback((err: Error) => {
    console.error("MQTT Client Error:", err);
    setMqttStatus("error");
    toast.error(`MQTT Error: ${err.message}`);
  }, []);

  const handleClose = useCallback(() => {
    setMqttStatus("disconnected");
    toast.info("MQTT connection closed.");
  }, []);

  const handleMessage = useCallback((topic: string, buf: Buffer) => {
    try {
      const msg = JSON.parse(buf.toString());
      console.log(`[handleMessage] Topic: ${topic}, Payload:`, msg); // Crucial for debugging

      if (topic.endsWith("/device_info/response")) {
        // Ensure msg is treated as an array of RawDeviceInfo
        if (Array.isArray(msg)) {
          setDevicesInfo(msg as RawDeviceInfo[]);
          console.log("Updated devicesInfo from MQTT:", msg);
        } else {
          console.warn("Received non-array for device_info/response:", msg);
        }
      } else if (topic.endsWith("/summary_device/response")) {
        // Your middleware sends `{"groups": [...]}` for getData, or `{"status": "...", "message": "..."}` for others
        if (msg && Array.isArray(msg.groups)) { // ✅ THIS IS THE CRITICAL CHECK
          setConfig(msg);
          console.log("Summary config data loaded successfully:", msg);
          toast.success("Custom payload configurations updated!");
        } else if (msg && (msg.status === "success" || msg.status === "error")) {
          // This path handles responses from writeData, deleteData etc.
          toast[msg.status === "success" ? "success" : "error"](msg.message || `Operation ${msg.status}.`);
          // Re-fetch data after a successful operation to update the UI
          if (msg.status === "success") {
              // Add a small delay to give the middleware time to save/process
              setTimeout(() => {
                  fetchSummaryData();
              }, 500);
          }
        } else {
          console.warn("Unexpected summary_device/response format (not `groups` or `status`):", msg);
        }
      }
    } catch (err) {
      console.error("MQTT message parsing error:", err);
    }
  }, [fetchSummaryData]); // fetchSummaryData is a dependency because it's called inside handleMessage

  // --- Effects ---

  // 1. Load device keys from devices.json once on component mount
  useEffect(() => {
    axios.get("/devices.json")
      .then(res => {
        const keys: Record<string, string[]> = {};
        const allDevices = Array.isArray(res.data) ? res.data : Object.values(res.data).flat();

        allDevices.forEach((device: any) => {
          if (device.part_number && device.data && Array.isArray(device.data)) {
            keys[device.part_number] = device.data.map((item: any) => item.var_name);
          }
        });
        deviceKeyOptionsMap.current = keys;
        console.log("Loaded deviceKeyOptionsMap from devices.json:", keys);
      })
      .catch(error => {
        console.error("Failed to load devices.json:", error);
        toast.error("Failed to load device key options from devices.json.");
      });
  }, []); // Empty dependency array means this runs once on mount

  // 2. MQTT Connection and Initial Data Fetch
  useEffect(() => {
    // Only connect if no client instance exists
    if (!clientRef.current) {
      console.log("Attempting to connect to MQTT broker...");
      const mqttClientInstance = connectMQTT();
      clientRef.current = mqttClientInstance;

      // Attach event listeners
      mqttClientInstance.on("connect", handleConnect);
      mqttClientInstance.on("error", handleError);
      mqttClientInstance.on("close", handleClose);
      mqttClientInstance.on("message", handleMessage);

      // Clean up on component unmount
      return () => {
        const mqttClientInstance = clientRef.current;
        if (mqttClientInstance) {
          console.log("MQTT client cleanup.");
          if (mqttClientInstance.connected) {
            mqttClientInstance.unsubscribe("config/device_info/response");
            mqttClientInstance.unsubscribe("config/summary_device/response");
          }
          mqttClientInstance.off("connect", handleConnect);
          mqttClientInstance.off("error", handleError);
          mqttClientInstance.off("close", handleClose);
          mqttClientInstance.off("message", handleMessage);
          // It's generally good practice to end the MQTT client connection
          // when the component unmounts to prevent resource leaks.
          if (mqttClientInstance.connected) {
            mqttClientInstance.end(true, () => console.log("MQTT client disconnected."));
          }
        }
      };
    } else {
      // If client already exists (e.g., hot reload), ensure data is fetched
      // This is important for scenarios where the component re-renders but MQTT is already connected
      if (clientRef.current.connected) {
          console.log("MQTT client already connected. Triggering initial data fetch.");
          fetchAvailableDevices();
          fetchSummaryData();
      }
    }
    // Dependencies: Ensure useCallback functions are stable, as they are used here.
  }, [handleConnect, handleError, handleClose, handleMessage, fetchAvailableDevices, fetchSummaryData]);

  // --- Form and Data Management Functions (No changes needed here based on the debug) ---

  const openEditor = (idx?: number) => {
    if (idx !== undefined && config && config.groups[idx]) {
      const g = config.groups[idx];
      setSummaryTopic(g.summary_topic);
      setRetain(g.retain);
      setQos(g.qos);
      setIntervalValue(g.interval);
      setDevicesInForm(g.included_devices.map(d => {
        const fullDeviceInfo = devicesInfo.find(x => x.name === d.name);
        return {
          name: d.name,
          part_number: fullDeviceInfo?.part_number || '',
          value_group: d.value_group,
          keyOptions: deviceKeyOptionsMap.current[fullDeviceInfo?.part_number || ''] || [],
          value_keys: Object.entries(d.value_keys).map(([key, value]) => ({ key, value })),
        };
      }));
      setCalculations(g.calculations || []);
      setCalculationOnly(g.calculation_only || false);
      setEditIndex(idx);
    } else {
      setSummaryTopic("");
      setRetain(false);
      setQos(0);
      setIntervalValue(10);
      setDevicesInForm([{ name: "", part_number: "", keyOptions: [], value_keys: [{ key: "", value: "" }] }]);
      setCalculations([]);
      setCalculationOnly(false);
      setEditIndex(null);
    }
    setPreviewPayload(null);
    setModalOpen(true);
  };

  const handleSaveGroup = () => {
    if (!summaryTopic.trim()) {
      toast.error("Summary Topic cannot be empty.");
      return;
    }
    if (devicesInForm.length === 0 || devicesInForm.some(d => !d.name.trim() || d.value_keys.some(kv => !kv.key.trim() || !kv.value.trim()))) {
      toast.error("Please ensure all devices and their value keys are correctly filled.");
      return;
    }
    if (calculations.some(c => !c.operation || !c.name || !c.value_group_selected)) {
        toast.error("Please ensure all calculation fields are correctly filled.");
        return;
    }

    const payloadData: SummaryGroup = {
      summary_topic: summaryTopic,
      retain: retain,
      qos,
      interval,
      included_devices: devicesInForm.map(d => ({
        name: d.name,
        value_group: d.value_group,
        value_keys: Object.fromEntries(d.value_keys.map(kv => [kv.key, kv.value])),
      })),
      calculations: calculations,
      calculation_only: calculationOnly,
    };

    sendCommand("writeData", payloadData);
    toast.info(`Sending ${editIndex === null ? "create" : "update"} command...`);

    setModalOpen(false);
  };

  const handleDeleteGroup = (idx: number) => {
    const topic = config?.groups[idx]?.summary_topic;
    if (topic) {
      Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
      }).then((result) => {
        if (result.isConfirmed) {
          sendCommand("deleteData", { summary_topic: topic });
          toast.info(`Sending delete command for topic: ${topic}`);
        }
      });
    } else {
      toast.error("Could not find topic to delete.");
    }
  };

  const handleAddDeviceToForm = () => {
    setDevicesInForm([...devicesInForm, { name: "", part_number: "", keyOptions: [], value_keys: [{ key: "", value: "" }] }]);
  };

  const handleRemoveDeviceFromForm = (index: number) => {
    const updatedDevices = devicesInForm.filter((_, i) => i !== index);
    setDevicesInForm(updatedDevices);
  };

  const handleDeviceSelectionInForm = (index: number, selectedDeviceName: string) => {
    const updatedDevices = [...devicesInForm];
    const selectedDeviceInfo = devicesInfo.find(d => d.name === selectedDeviceName);

    if (selectedDeviceInfo) {
      updatedDevices[index] = {
        ...updatedDevices[index],
        name: selectedDeviceName,
        part_number: selectedDeviceInfo.part_number,
        keyOptions: deviceKeyOptionsMap.current[selectedDeviceInfo.part_number] || [],
        value_keys: [{ key: "", value: "" }]
      };
    } else {
      updatedDevices[index] = {
        ...updatedDevices[index],
        name: selectedDeviceName,
        part_number: '',
        keyOptions: [],
        value_keys: [{ key: "", value: "" }]
      };
    }
    setDevicesInForm(updatedDevices);
  };

  const handleAddValueKeyToDevice = (deviceIndex: number) => {
    const updatedDevices = [...devicesInForm];
    updatedDevices[deviceIndex].value_keys.push({ key: "", value: "" });
    setDevicesInForm(updatedDevices);
  };

  const handleRemoveValueKeyFromDevice = (deviceIndex: number, keyIndex: number) => {
    const updatedDevices = [...devicesInForm];
    updatedDevices[deviceIndex].value_keys.splice(keyIndex, 1);
    setDevicesInForm(updatedDevices);
  };

  const handleValueKeyChange = (deviceIndex: number, keyIndex: number, field: 'key' | 'value', value: string) => {
    const updatedDevices = [...devicesInForm];
    updatedDevices[deviceIndex].value_keys[keyIndex][field] = value;
    setDevicesInForm(updatedDevices);
  };

  const handlePreviewPayload = () => {
    const payloadData = {
      summary_topic: summaryTopic,
      retain: retain,
      qos,
      interval,
      included_devices: devicesInForm.map(d => ({
        name: d.name,
        value_group: d.value_group,
        value_keys: Object.fromEntries(d.value_keys.map(kv => [kv.key, kv.value])),
      })),
      calculations: calculations,
      calculation_only: calculationOnly,
    };
    setPreviewPayload(JSON.stringify(payloadData, null, 2));
  };

  // --- Pagination, Sort, and Search Logic ---
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(config?.groups || [], ["summary_topic", "included_devices.name"]);
  const { sorted, sortField, sortDirection, handleSort } = useSortableTable(filteredData);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const uniqueValueGroups = Array.from(new Set(devicesInForm.map(d => d.value_group).filter(Boolean))) as string[];

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <Settings2 className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Custom Payload Data</h1>
        </div>
        <MQTTConnectionBadge  />
      </header>

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={fetchSummaryData}>Fetch Data</Button>
            <Button size="sm" variant="default" onClick={() => openEditor()}>Create New Data</Button>
          </div>
          <Input
            type="text"
            placeholder="Search by topic or device name..."
            className="w-full md:w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort('summary_topic' as keyof SummaryGroup)} className="cursor-pointer select-none">
                Topic <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" />
              </TableHead>
              <TableHead>Devices</TableHead>
              <TableHead onClick={() => handleSort('retain' as keyof SummaryGroup)} className="cursor-pointer select-none">Retain <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" /></TableHead>
              <TableHead onClick={() => handleSort('qos' as keyof SummaryGroup)} className="cursor-pointer select-none">QoS <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" /></TableHead>
              <TableHead onClick={() => handleSort('interval' as keyof SummaryGroup)} className="cursor-pointer select-none">Interval <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" /></TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? paginatedData.map((g, i) => (
              <TableRow key={g.summary_topic}>
                <TableCell className="font-medium">{g.summary_topic}</TableCell>
                <TableCell>
                  <ul className="list-disc list-inside text-sm">
                    {g.included_devices.map((d, devIdx) => (
                      <li key={`${g.summary_topic}-${d.name}-${devIdx}`}>
                        <strong>{d.name}</strong>
                        {d.value_group && <span className="text-muted-foreground ml-1">({d.value_group})</span>}
                        <ul className="ml-4 list-none">
                          {Object.entries(d.value_keys).map(([key, value]) => (
                            <li key={`${g.summary_topic}-${d.name}-${key}`} className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">{key}:</span>
                              <span className="text-xs font-semibold">{value}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  {g.calculations.length > 0 && (
                    <div className="mt-2 text-xs">
                      <span className="font-semibold">Calculations:</span>
                      <ul className="ml-2 list-disc list-inside">
                        {g.calculations.map((calc, calcIdx) => (
                          <li key={calcIdx}>
                            {calc.operation} ({calc.value_group_selected}) as {calc.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {g.calculation_only && (
                      <div className="mt-1 text-xs text-blue-600">
                          <span className="font-semibold">Note:</span> Only calculated values will be published.
                      </div>
                  )}
                </TableCell>
                <TableCell>{g.retain ? "✔️" : "❌"}</TableCell>
                <TableCell>{g.qos}</TableCell>
                <TableCell>{g.interval}s</TableCell>
                <TableCell className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => openEditor(i)} title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => handleDeleteGroup(i)} title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No custom payload configurations found. Click "Create New Data" to add a new configuration.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
              {Array.from({ length: totalPages }, (_, idx) => (
                <PaginationItem key={idx}>
                  <PaginationLink
                    isActive={currentPage === idx + 1}
                    onClick={() => setCurrentPage(idx + 1)}
                  >
                    {idx + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
            </PaginationContent>
          </Pagination>
        )}

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editIndex === null ? "Add Custom Payload" : "Edit Custom Payload"}</DialogTitle>
              <DialogDescription>
                Configure custom MQTT payloads by defining topics, QoS, retention settings, and including devices with specific value keys. You can also define calculations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Card>
                <CardHeader><CardTitle className="text-md">Payload Details</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Summary Topic" value={summaryTopic} onChange={e => setSummaryTopic(e.target.value)} required />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label htmlFor="qos-select" className="text-sm font-medium mb-1">QoS Level</label>
                      <Select value={String(qos)} onValueChange={value => setQos(Number(value))}>
                        <SelectTrigger id="qos-select" className="w-full">
                          <SelectValue placeholder="Select QoS Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 (At most once)</SelectItem>
                          <SelectItem value="1">1 (At least once)</SelectItem>
                          <SelectItem value="2">2 (Exactly once)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="interval-input" className="text-sm font-medium mb-1">Interval (seconds)</label>
                      <Input id="interval-input" placeholder="Interval" type="number" value={interval} onChange={e => setIntervalValue(Number(e.target.value))} required min={1} />
                    </div>
                    <div className="flex items-center mt-auto pt-2">
                      <input type="checkbox" id="retain-checkbox" checked={retain} onChange={e => setRetain(e.target.checked)} className="mr-2 h-4 w-4" />
                      <label htmlFor="retain-checkbox" className="text-sm font-medium leading-none">Retain Message</label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle className="text-md">Included Devices</CardTitle>
                  <Button size="sm" variant="outline" onClick={handleAddDeviceToForm}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Device
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {devicesInForm.length === 0 && (
                    <p className="text-center text-muted-foreground">No devices added. Click "Add Device" to start.</p>
                  )}
                  {devicesInForm.map((device, deviceIndex) => (
                    <div key={deviceIndex} className="p-4 border rounded-md space-y-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Device {deviceIndex + 1}</label>
                        {devicesInForm.length > 1 && (
                          <Button variant="destructive" size="sm" onClick={() => handleRemoveDeviceFromForm(deviceIndex)}>Remove Device</Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col">
                          <label htmlFor={`device-select-${deviceIndex}`} className="text-sm font-medium mb-1">Select Device</label>
                          <Select value={device.name} onValueChange={value => handleDeviceSelectionInForm(deviceIndex, value)}>
                            <SelectTrigger id={`device-select-${deviceIndex}`} className="w-full">
                              <SelectValue placeholder="Select Device" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {devicesInfo.length === 0 ? (
                                  <SelectLabel>Loading devices...</SelectLabel>
                                ) : (
                                  devicesInfo.map(d => (
                                    <SelectItem key={d.name} value={d.name}>
                                      {d.name} ({d.part_number})
                                    </SelectItem>
                                  ))
                                )}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col">
                          <label htmlFor={`value-group-${deviceIndex}`} className="text-sm font-medium mb-1">Value Group (Optional)</label>
                          <Input
                            id={`value-group-${deviceIndex}`}
                            placeholder="Enter Value Group"
                            value={device.value_group || ""}
                            onChange={e => {
                              const nd = [...devicesInForm];
                              nd[deviceIndex].value_group = e.target.value;
                              setDevicesInForm(nd);
                            }}
                          />
                        </div>
                      </div>

                      <h5 className="text-sm font-semibold mt-3">Value Keys:</h5>
                      {device.value_keys.length === 0 && (
                        <p className="text-center text-muted-foreground text-xs">No keys added for this device.</p>
                      )}
                      {device.value_keys.map((keyValue, keyIndex) => (
                        <div key={keyIndex} className="flex gap-2 items-center">
                          <Select value={keyValue.key} onValueChange={value => handleValueKeyChange(deviceIndex, keyIndex, 'key', value)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select Key" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {device.keyOptions.length === 0 ? (
                                  <SelectLabel>No keys available for this device.</SelectLabel>
                                ) : (
                                  device.keyOptions.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)
                                )}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Assign Value"
                            value={keyValue.value}
                            className="flex-1"
                            onChange={e => handleValueKeyChange(deviceIndex, keyIndex, 'value', e.target.value)}
                            required
                          />
                          <Button variant="destructive" size="icon" onClick={() => handleRemoveValueKeyFromDevice(deviceIndex, keyIndex)} title="Remove Key">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="secondary" onClick={() => handleAddValueKeyToDevice(deviceIndex)} className="mt-2">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Key
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Calculations Card */}
              <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle className="text-md">Calculations (Optional)</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setCalculations([...calculations, { operation: "", name: "", value_group_selected: "" }])}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Calculation
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {calculations.length === 0 && (
                    <p className="text-center text-muted-foreground">No calculations added. Click "Add Calculation" to start.</p>
                  )}
                  {calculations.map((calc, calcIndex) => (
                    <div key={calcIndex} className="p-4 border rounded-md space-y-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Calculation {calcIndex + 1}</label>
                        <Button variant="destructive" size="sm" onClick={() => setCalculations(calculations.filter((_, i) => i !== calcIndex))}>
                          Remove Calculation
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col">
                            <label htmlFor={`calc-op-${calcIndex}`} className="text-sm font-medium mb-1">Operation</label>
                            <Select value={calc.operation} onValueChange={value => {
                                const updatedCalcs = [...calculations];
                                updatedCalcs[calcIndex].operation = value;
                                setCalculations(updatedCalcs);
                            }}>
                                <SelectTrigger id={`calc-op-${calcIndex}`} className="w-full">
                                <SelectValue placeholder="Select Operation" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="sum">Sum</SelectItem>
                                    <SelectItem value="average">Average</SelectItem>
                                    <SelectItem value="multiply">Multiply</SelectItem>
                                    <SelectItem value="divide">Divide</SelectItem>
                                </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor={`calc-name-${calcIndex}`} className="text-sm font-medium mb-1">Calculation Name</label>
                            <Input
                                id={`calc-name-${calcIndex}`}
                                placeholder="e.g., total_power"
                                value={calc.name}
                                onChange={e => {
                                const updatedCalcs = [...calculations];
                                updatedCalcs[calcIndex].name = e.target.value;
                                setCalculations(updatedCalcs);
                                }}
                            />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor={`calc-vg-${calcIndex}`} className="text-sm font-medium mb-1">Source Value Group</label>
                            <Select value={calc.value_group_selected} onValueChange={value => {
                                const updatedCalcs = [...calculations];
                                updatedCalcs[calcIndex].value_group_selected = value;
                                setCalculations(updatedCalcs);
                            }}>
                                <SelectTrigger id={`calc-vg-${calcIndex}`} className="w-full">
                                <SelectValue placeholder="Select Value Group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {uniqueValueGroups.length === 0 ? (
                                            <SelectLabel>No value groups defined in devices.</SelectLabel>
                                        ) : (
                                            uniqueValueGroups.map((vg, idx) => (
                                                <SelectItem key={idx} value={vg}>{vg}</SelectItem>
                                            ))
                                        )}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center mt-auto pt-2">
                    <input
                      type="checkbox"
                      id="calculation-only-checkbox"
                      checked={calculationOnly}
                      onChange={e => setCalculationOnly(e.target.checked)}
                      className="mr-2 h-4 w-4"
                    />
                    <label htmlFor="calculation-only-checkbox" className="text-sm font-medium leading-none">
                      Publish only calculated values (exclude raw device data)
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle className="text-md">Payload Preview</CardTitle>
                  <Button size="sm" variant="outline" onClick={handlePreviewPayload}>
                    <Eye className="mr-2 h-4 w-4" /> Generate Preview
                  </Button>
                </CardHeader>
                <CardContent>
                  {previewPayload ? (
                    <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                      {previewPayload}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground text-sm">Click "Generate Preview" to see the JSON payload that will be sent to the middleware.</p>
                  )}
                </CardContent>
              </Card>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveGroup}>Save Configuration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}