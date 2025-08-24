"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RotateCw,
  Server,
  ArrowUpDown,
  Cpu,
  Network,
  Layers,
  Edit2,
  Trash2,
} from "lucide-react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { connectMQTT } from "@/lib/mqttClient";
import MqttStatus from "@/components/mqtt-status";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";
import { useSortableTable } from "@/hooks/use-sort-table";
import { useSearchFilter } from "@/hooks/use-search-filter";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITEMS_PER_PAGE = 5;

// TypeScript interfaces
interface DeviceProfile {
  name: string;
  device_type: string;
  manufacturer: string;
  part_number: string;
  topic: string;
  interval_publish: number;
  qos: number;
}

interface ProtocolSetting {
  protocol: string;
  address?: number;
  ip_address?: string;
  port?: string | number;
  baudrate?: number;
  parity?: string;
  bytesize?: number;
  stop_bit?: number;
  timeout?: number;
  endianness?: string;
  snmp_version?: number;
  read_community?: string;
}

interface Device {
  profile: DeviceProfile;
  protocol_setting: ProtocolSetting;
}

export default function DeviceManagerPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deviceToUpdate, setDeviceToUpdate] = useState<string>("");
  
  // Device Library States
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [partNumbers, setPartNumbers] = useState<string[]>([]);
  const [deviceLibraryLoading, setDeviceLibraryLoading] = useState(false);
  const [newDevice, setNewDevice] = useState<Device>({
    profile: {
      name: "",
      device_type: "",
      manufacturer: "",
      part_number: "",
      topic: "",
      interval_publish: 60,
      qos: 1
    },
    protocol_setting: {
      protocol: "Modbus RTU",
      address: 1,
      ip_address: "",
      port: "",
      baudrate: 9600,
      parity: "NONE",
      bytesize: 8,
      stop_bit: 1,
      timeout: 1000,
      endianness: "Little Endian",
      snmp_version: 1,
      read_community: "public",
    },
  });

  const status = useMQTTStatus();
  const client = connectMQTT(); // Connects to the global MQTT client instance

  // Device Library Functions
  const requestDeviceTypes = useCallback(() => {
    if (client && client.connected) {
      setDeviceLibraryLoading(true);
      const command = JSON.stringify({ command: "getDeviceTypes" });
      client.publish("command_device_selection", command);
    }
  }, [client]);

  const requestManufacturers = useCallback((deviceType: string) => {
    if (client && client.connected && deviceType) {
      setDeviceLibraryLoading(true);
      const command = JSON.stringify({ 
        command: "getManufacturers", 
        device_type: deviceType 
      });
      client.publish("command_device_selection", command);
    }
  }, [client]);

  const requestPartNumbers = useCallback((deviceType: string, manufacturer: string) => {
    if (client && client.connected && deviceType && manufacturer) {
      setDeviceLibraryLoading(true);
      const command = JSON.stringify({ 
        command: "getPartNumbers", 
        device_type: deviceType,
        manufacturer: manufacturer
      });
      client.publish("command_device_selection", command);
    }
  }, [client]);

  // Handle device selection changes
  const handleDeviceTypeChange = useCallback((deviceType: string) => {
    setNewDevice(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        device_type: deviceType,
        manufacturer: "", // Reset manufacturer when device type changes
        part_number: ""   // Reset part number when device type changes
      }
    }));
    
    // Clear dependent dropdowns
    setManufacturers([]);
    setPartNumbers([]);
    
    // Request manufacturers for this device type
    if (deviceType) {
      requestManufacturers(deviceType);
    }
  }, [requestManufacturers]);

  const handleManufacturerChange = useCallback((manufacturer: string) => {
    setNewDevice(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        manufacturer: manufacturer,
        part_number: "" // Reset part number when manufacturer changes
      }
    }));
    
    // Clear part numbers
    setPartNumbers([]);
    
    // Request part numbers for this device type and manufacturer
    if (manufacturer && newDevice.profile.device_type) {
      requestPartNumbers(newDevice.profile.device_type, manufacturer);
    }
  }, [requestPartNumbers, newDevice.profile.device_type]);

  const handlePartNumberChange = useCallback((partNumber: string) => {
    setNewDevice(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        part_number: partNumber
      }
    }));
  }, []);

  // Handle protocol change - reset protocol-specific fields
  const handleProtocolChange = useCallback((protocol: string) => {
    if (protocol === "SNMP") {
      setNewDevice((prev: Device) => ({
        ...prev,
        protocol_setting: {
          protocol: "SNMP",
          port: 161,
          ip_address: "",
          snmp_version: 1,
          read_community: "public"
        }
      }));
    } else if (protocol === "Modbus RTU") {
      setNewDevice((prev: Device) => ({
        ...prev,
        protocol_setting: {
          protocol: "Modbus RTU", 
          address: 1,
          port: "",
          baudrate: 9600,
          parity: "NONE",
          bytesize: 8,
          stop_bit: 1,
          timeout: 1000,
          endianness: "Little Endian"
        }
      }));
    }
  }, []);

  useEffect(() => {
    // Ensure the MQTT client is available before setting up listeners
    if (!client) {
      console.warn("MQTT client not available.");
      return;
    }

    const handleMessage = (topic: string, message: Buffer) => {
      if (topic !== "response_device_modbus" && topic !== "response_device_selection") {
        return; // Ignore messages not meant for device management
      }

      try {
        const messageString = message.toString();

        const payload = JSON.parse(messageString);
        // console.log(`[MQTT] DeviceManagerPage: Parsed payload:`, payload);

        // Handle device selection responses
        if (topic === "response_device_selection") {
          setDeviceLibraryLoading(false);
          
          if (payload.status === "success") {
            const command = payload.message;
            
            if (command.includes("Device types")) {
              setDeviceTypes(payload.data || []);
            } else if (command.includes("Manufacturers")) {
              setManufacturers(payload.data || []);
            } else if (command.includes("Part numbers")) {
              setPartNumbers(payload.data || []);
            }
          } else {
            toast.error(`Device library error: ${payload.message}`, {
              duration: 3000,
              position: "top-right"
            });
          }
          return;
        }

        // Handle regular device management responses
        if (Array.isArray(payload)) {
          setDevices(payload);
        } else if (payload && typeof payload === "object" && payload.status) {
          // Handle operation response (add/update/delete)
          if (payload.status === "success") {
            // Dismiss any existing loading toast
            toast.dismiss("device-operation");
            
            // Show success toast with appropriate message
            const successMessage = payload.message || "Operation completed successfully";
            toast.success(successMessage, {
              duration: 3000,
              position: "top-right"
            });
            
            // Close dialog if it's open
            if (showDialog) {
              setShowDialog(false);
            }
            
            // Auto refresh data after successful operation
            setTimeout(() => {
              client?.publish("command_device_modbus", JSON.stringify({ command: "getDataModbus" }));
            }, 500);
          } else if (payload.status === "error") {
            // Dismiss any existing loading toast
            toast.dismiss("device-operation");
            
            // Show error toast
            toast.error(payload.message || "Operation failed", {
              duration: 4000,
              position: "top-right"
            });
          }
        } else {
          console.warn(
            "[MQTT] DeviceManagerPage: Payload is not an array, skipping update:",
            payload
          );
        }
      } catch (error) {
        console.error(
          "[MQTT] DeviceManagerPage: Invalid JSON from MQTT or processing error:",
          error,
          "Raw message:",
          message.toString()
        );
        // setDevices([]);
      }
    };

    // Attach the message listener to the MQTT client
    client.on("message", handleMessage);
    client.subscribe("response_device_modbus");
    client.subscribe("response_device_selection");
    client.publish(
      "command_device_modbus",
      JSON.stringify({ command: "getDataModbus" })
    );
    
    // Request device types for dynamic selection
    setTimeout(() => {
      requestDeviceTypes();
    }, 500);

    // Cleanup function for when the component unmounts
    return () => {
      client.unsubscribe("response_device_modbus");
      client.unsubscribe("response_device_selection");
      client.off("message", handleMessage);
    };
  }, [client]); // Rerun effect if the MQTT client instance changes (unlikely for global client)

  const handleSubmit = () => {
    // Show loading toast
    toast.loading(isUpdateMode ? "Updating device..." : "Adding device...", {
      id: "device-operation"
    });
    
    const command = JSON.stringify({
      command: isUpdateMode ? "updateDevice" : "addDevice",
      device: newDevice,
      ...(isUpdateMode && deviceToUpdate && { old_name: deviceToUpdate }),
    });
    client?.publish("command_device_modbus", command);
    setShowDialog(false);
  };

  const handleEdit = (device: Device) => {
    setIsUpdateMode(true);
    setDeviceToUpdate(device.profile.name);
    setNewDevice({
      profile: {
        name: device.profile.name || "",
        device_type: device.profile.device_type || "",
        manufacturer: device.profile.manufacturer || "",
        part_number: device.profile.part_number || "",
        topic: device.profile.topic || "",
        interval_publish: typeof device.profile.interval_publish === 'string' 
          ? parseInt(device.profile.interval_publish) 
          : device.profile.interval_publish || 60,
        qos: typeof device.profile.qos === 'string' 
          ? parseInt(device.profile.qos) 
          : device.profile.qos || 1
      },
      protocol_setting: {
        protocol: device.protocol_setting.protocol || "Modbus RTU",
        address: typeof device.protocol_setting.address === 'string' 
          ? parseInt(device.protocol_setting.address) 
          : device.protocol_setting.address || 1,
        ip_address: device.protocol_setting.ip_address || "",
        port: device.protocol_setting.port || "",
        baudrate: typeof device.protocol_setting.baudrate === 'string' 
          ? parseInt(device.protocol_setting.baudrate) 
          : device.protocol_setting.baudrate || 9600,
        parity: device.protocol_setting.parity || "NONE",
        bytesize: typeof device.protocol_setting.bytesize === 'string' 
          ? parseInt(device.protocol_setting.bytesize) 
          : device.protocol_setting.bytesize || 8,
        stop_bit: typeof device.protocol_setting.stop_bit === 'string' 
          ? parseInt(device.protocol_setting.stop_bit) 
          : device.protocol_setting.stop_bit || 1,
        timeout: typeof device.protocol_setting.timeout === 'string' 
          ? parseInt(device.protocol_setting.timeout) 
          : device.protocol_setting.timeout || 1000,
        endianness: device.protocol_setting.endianness || "Little Endian",
        snmp_version: typeof device.protocol_setting.snmp_version === 'string' 
          ? parseInt(device.protocol_setting.snmp_version) 
          : device.protocol_setting.snmp_version || 1,
        read_community: device.protocol_setting.read_community || "public",
      }
    });
    
    // Load manufacturers for the device type
    if (device.profile.device_type) {
      requestManufacturers(device.profile.device_type);
      
      // Load part numbers if manufacturer is available
      if (device.profile.manufacturer) {
        setTimeout(() => {
          requestPartNumbers(device.profile.device_type, device.profile.manufacturer);
        }, 500);
      }
    }
    
    setShowDialog(true);
  };

  const handleDelete = (name: string) => {
    Swal.fire({
      title: `Delete ${name}?`,
      text: "You can't undo this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, keep it",
    }).then((result) => {
      if (result.isConfirmed) {
        // Show loading toast
        toast.loading(`Deleting ${name}...`, {
          id: "device-operation"
        });
        
        const command = JSON.stringify({ command: "deleteDevice", name });
        client?.publish("command_device_modbus", command);
      }
    });
  };

  // Hooks for sorting and filtering
  const { sorted, sortField, sortDirection, handleSort } =
    useSortableTable(devices);
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(
    sorted,
    [
      "profile.name",
      "profile.part_number",
      "profile.topic",
      "protocol_setting.address",
      "protocol_setting.ip_address",
    ]
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedDevices = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Server className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Modbus SNMP Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus /> {/* Displays MQTT connection status */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              // Request fresh data from the backend
              client?.publish(
                "command_device_modbus",
                JSON.stringify({ command: "getDataModbus" })
              )
            }
          >
            <RotateCw />
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              // Reset form for adding new device
              setNewDevice({
                profile: {
                  name: "",
                  device_type: "",
                  manufacturer: "",
                  part_number: "",
                  topic: "",
                  interval_publish: 60,
                  qos: 1
                },
                protocol_setting: {
                  protocol: "Modbus RTU",
                  address: 1,
                  ip_address: "",
                  port: "",
                  baudrate: 9600,
                  parity: "NONE",
                  bytesize: 8,
                  stop_bit: 1,
                  timeout: 1000,
                  endianness: "Little Endian",
                  snmp_version: 1,
                  read_community: "public",
                },
              });
              
              // Reset device library states
              setManufacturers([]);
              setPartNumbers([]);
              
              setDeviceToUpdate("");
              setIsUpdateMode(false);
              setShowDialog(true); // Open the dialog
            }}
          >
            Add Device
          </Button>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 m-4">
        {/* Total Devices Card */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Cpu className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
            <p className="text-xs text-muted-foreground">
              All connected devices
            </p>
          </CardContent>
        </Card>

        {/* Protocol Breakdown Card */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Protocol Breakdown
            </CardTitle>
            <Network className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Modbus RTU</span>
                <span className="font-semibold">
                  {
                    devices.filter(
                      (d) =>
                        d.protocol_setting?.protocol?.toLowerCase() ===
                        "modbus rtu"
                    ).length
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>SNMP</span>
                <span className="font-semibold">
                  {
                    devices.filter(
                      (d) =>
                        d.protocol_setting?.protocol?.toLowerCase() === "snmp"
                    ).length
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Most Used Protocol Card */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Most Used Protocol
            </CardTitle>
            <Layers className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {(() => {
                const modbusCount = devices.filter(
                  (d) =>
                    d.protocol_setting?.protocol?.toLowerCase() === "modbus rtu"
                ).length;
                const snmpCount = devices.filter(
                  (d) => d.protocol_setting?.protocol?.toLowerCase() === "snmp"
                ).length;
                if (modbusCount === snmpCount && modbusCount > 0)
                  return "Equal Use";
                if (modbusCount === 0 && snmpCount === 0) return "N/A";
                return modbusCount > snmpCount ? "Modbus RTU" : "SNMP";
              })()}
            </div>
            <p className="text-xs text-muted-foreground">
              Most common protocol
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Device List Table */}
      <Card className="m-4">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Device List</CardTitle>
            <Input
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("profile.name")}
                >
                  Device Name <ArrowUpDown className="inline mr-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("profile.part_number")}
                >
                  PN <ArrowUpDown className="inline mr-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("protocol_setting.address")}
                >
                  Address/IP <ArrowUpDown className="inline mr-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("profile.topic")}
                >
                  Topic <ArrowUpDown className="inline mr-1 h-4 w-4" />
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDevices.length > 0 ? (
                paginatedDevices.map((device, index) => (
                  // Using device.profile?.name as key, with index as fallback for safety.
                  // For production, prefer a truly unique ID from your data if available (e.g., device.id).
                  <TableRow key={device.profile?.name || `device-${index}`}>
                    <TableCell>
                      {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                    </TableCell>
                    <TableCell>{device.profile?.name}</TableCell>
                    <TableCell>{device.profile?.part_number}</TableCell>
                    <TableCell>
                      {device.protocol_setting?.protocol === "Modbus RTU"
                        ? device.protocol_setting?.address
                        : device.protocol_setting?.ip_address}
                    </TableCell>
                    <TableCell>{device.profile?.topic}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(device)}
                          title="Edit Device"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(device.profile?.name)}
                          title="Delete Device"
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No devices found. Please add a new device or refresh the
                    list.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    href="#"
                    aria-disabled={currentPage === 1}
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      isActive={currentPage === i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      href="#"
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, totalPages))
                    }
                    href="#"
                    aria-disabled={currentPage === totalPages}
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Device Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isUpdateMode ? "Update Device" : "Add New Device"}
            </DialogTitle>
            <DialogDescription>
              Configure device profile and protocol settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Device Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deviceName">Device Name *</Label>
                  <Input
                    id="deviceName"
                    value={newDevice.profile.name}
                    onChange={(e) =>
                      setNewDevice({
                        ...newDevice,
                        profile: { ...newDevice.profile, name: e.target.value },
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="deviceType">Device Type</Label>
                  <Select
                    value={newDevice.profile.device_type}
                    onValueChange={handleDeviceTypeChange}
                  >
                    <SelectTrigger id="deviceType">
                      <SelectValue placeholder={deviceLibraryLoading ? "Loading..." : "Select device type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Select
                    value={newDevice.profile.manufacturer}
                    onValueChange={handleManufacturerChange}
                    disabled={!newDevice.profile.device_type || deviceLibraryLoading}
                  >
                    <SelectTrigger id="manufacturer">
                      <SelectValue placeholder={
                        !newDevice.profile.device_type 
                          ? "Select device type first" 
                          : deviceLibraryLoading 
                            ? "Loading..." 
                            : "Select manufacturer"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {manufacturers.map((manufacturer) => (
                        <SelectItem key={manufacturer} value={manufacturer}>
                          {manufacturer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="partNumber">Part Number *</Label>
                  <Select
                    value={newDevice.profile.part_number}
                    onValueChange={handlePartNumberChange}
                    disabled={!newDevice.profile.manufacturer || deviceLibraryLoading}
                  >
                    <SelectTrigger id="partNumber">
                      <SelectValue placeholder={
                        !newDevice.profile.manufacturer 
                          ? "Select manufacturer first" 
                          : deviceLibraryLoading 
                            ? "Loading..." 
                            : "Select part number"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {partNumbers.map((partNumber) => (
                        <SelectItem key={partNumber} value={partNumber}>
                          {partNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="topic">MQTT Topic *</Label>
                  <Input
                    id="topic"
                    value={newDevice.profile.topic}
                    onChange={(e) =>
                      setNewDevice({
                        ...newDevice,
                        profile: { ...newDevice.profile, topic: e.target.value },
                      })
                    }
                    required
                    placeholder="e.g., TBGPower/POCGSPE/parameters"
                  />
                </div>
                <div>
                  <Label htmlFor="intervalPublish">Interval Publish (seconds)</Label>
                  <Input
                    id="intervalPublish"
                    type="number"
                    value={newDevice.profile.interval_publish}
                    onChange={(e) =>
                      setNewDevice({
                        ...newDevice,
                        profile: { ...newDevice.profile, interval_publish: parseInt(e.target.value) || 60 },
                      })
                    }
                    placeholder="60"
                  />
                </div>
                <div>
                  <Label htmlFor="qos">QoS Level</Label>
                  <Select
                    value={newDevice.profile.qos?.toString() || ""}
                    onValueChange={(value) =>
                      setNewDevice({
                        ...newDevice,
                        profile: { ...newDevice.profile, qos: parseInt(value) },
                      })
                    }
                  >
                    <SelectTrigger id="qos">
                      <SelectValue placeholder="Select QoS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - At most once</SelectItem>
                      <SelectItem value="1">1 - At least once</SelectItem>
                      <SelectItem value="2">2 - Exactly once</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
            </div>

            {/* Protocol Settings Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Protocol Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="protocol">Protocol *</Label>
                  <Select
                    value={newDevice.protocol_setting.protocol}
                    onValueChange={handleProtocolChange}
                  >
                    <SelectTrigger id="protocol">
                      <SelectValue placeholder="Select protocol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Modbus RTU">Modbus RTU</SelectItem>
                      <SelectItem value="SNMP">SNMP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Modbus RTU Fields */}
                {newDevice.protocol_setting.protocol === "Modbus RTU" && (
                  <>
                    <div>
                      <Label htmlFor="address">Modbus Address *</Label>
                      <Input
                        id="address"
                        type="number"
                        value={newDevice.protocol_setting.address}
                        onChange={(e) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              address: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="port">Serial Port *</Label>
                      <Select
                        value={newDevice.protocol_setting.port?.toString() || ""}
                        onValueChange={(value) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              port: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger id="port">
                          <SelectValue placeholder="Select port" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="/dev/ttyUSB0">/dev/ttyUSB0</SelectItem>
                          <SelectItem value="/dev/ttyAMA0">/dev/ttyAMA0</SelectItem>
                          <SelectItem value="/dev/ttyAMA1">/dev/ttyAMA1</SelectItem>
                          <SelectItem value="/dev/ttyAMA2">/dev/ttyAMA2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="baudrate">Baud Rate *</Label>
                      <Select
                        value={newDevice.protocol_setting.baudrate?.toString() || ""}
                        onValueChange={(value) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              baudrate: parseInt(value),
                            },
                          })
                        }
                      >
                        <SelectTrigger id="baudrate">
                          <SelectValue placeholder="Select baud rate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9600">9600</SelectItem>
                          <SelectItem value="19200">19200</SelectItem>
                          <SelectItem value="38400">38400</SelectItem>
                          <SelectItem value="57600">57600</SelectItem>
                          <SelectItem value="115200">115200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="parity">Parity</Label>
                      <Select
                        value={newDevice.protocol_setting.parity}
                        onValueChange={(value) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              parity: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger id="parity">
                          <SelectValue placeholder="Select parity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          <SelectItem value="EVEN">Even</SelectItem>
                          <SelectItem value="ODD">Odd</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="bytesize">Byte Size</Label>
                      <Input
                        id="bytesize"
                        type="number"
                        value={newDevice.protocol_setting.bytesize}
                        onChange={(e) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              bytesize: parseInt(e.target.value) || 8,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="stopBit">Stop Bit</Label>
                      <Input
                        id="stopBit"
                        type="number"
                        value={newDevice.protocol_setting.stop_bit}
                        onChange={(e) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              stop_bit: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="timeout">Timeout (ms)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        value={newDevice.protocol_setting.timeout}
                        onChange={(e) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              timeout: parseInt(e.target.value) || 1000,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="endianness">Endianness</Label>
                      <Select
                        value={newDevice.protocol_setting.endianness}
                        onValueChange={(value) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              endianness: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger id="endianness">
                          <SelectValue placeholder="Select endianness" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Little Endian">Little Endian</SelectItem>
                          <SelectItem value="Big Endian">Big Endian</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                {/* SNMP Fields */}
                {newDevice.protocol_setting.protocol === "SNMP" && (
                  <>
                    <div>
                      <Label htmlFor="ipAddress">IP Address *</Label>
                      <Input
                        id="ipAddress"
                        value={newDevice.protocol_setting.ip_address}
                        onChange={(e) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              ip_address: e.target.value,
                            },
                          })
                        }
                        required
                        placeholder="192.168.88.100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="snmpPort">SNMP Port</Label>
                      <Input
                        id="snmpPort"
                        type="number"
                        value={newDevice.protocol_setting.port}
                        onChange={(e) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              port: parseInt(e.target.value) || 161,
                            },
                          })
                        }
                        placeholder="161"
                      />
                    </div>
                    <div>
                      <Label htmlFor="snmpVersion">SNMP Version</Label>
                      <Select
                        value={newDevice.protocol_setting.snmp_version?.toString() || ""}
                        onValueChange={(value) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              snmp_version: parseInt(value),
                            },
                          })
                        }
                      >
                        <SelectTrigger id="snmpVersion">
                          <SelectValue placeholder="Select SNMP version" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">SNMPv1</SelectItem>
                          <SelectItem value="2">SNMPv2c</SelectItem>
                          <SelectItem value="3">SNMPv3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="readCommunity">Read Community</Label>
                      <Input
                        id="readCommunity"
                        value={newDevice.protocol_setting.read_community}
                        onChange={(e) =>
                          setNewDevice({
                            ...newDevice,
                            protocol_setting: {
                              ...newDevice.protocol_setting,
                              read_community: e.target.value,
                            },
                          })
                        }
                        placeholder="public"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {isUpdateMode ? "Update Device" : "Add Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
