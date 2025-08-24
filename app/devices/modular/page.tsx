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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, Cpu, ArrowUpDown, Microchip, LayoutGrid } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { connectMQTT } from "@/lib/mqttClient";
import { useSortableTable } from "@/hooks/use-sort-table";
import { useSearchFilter } from "@/hooks/use-search-filter";
import MqttStatus from "@/components/mqtt-status";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import ScanAddressDialog from "@/components/ScanAddressDialog";

const ITEMS_PER_PAGE = 5;

// Define the type for a device to fix the 'any' implicit type error
interface Device {
  profile: {
    name: string;
    device_type: string;
    manufacturer: string;
    part_number: string;
    topic: string;
  };
  protocol_setting: {
    protocol: string;
    address: number;
    device_bus: number;
  };
}

export default function DeviceManagerPage() {
  const [devices, setDevices] = useState<Device[]>([]); // Use Device type
  const [showDialog, setShowDialog] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deviceToUpdate, setDeviceToUpdate] = useState<string>("");
  const [newDevice, setNewDevice] = useState<Device>({ // Use Device type
    profile: {
      name: "",
      device_type: "Modular",
      manufacturer: "IOT",
      part_number: "",
      topic: "",
    },
    protocol_setting: {
      protocol: "Modular",
      address: 0,
      device_bus: 0,
    },
  });

  // Dynamic device selection states
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [partNumbers, setPartNumbers] = useState<string[]>([]);

  const client = connectMQTT();

  // Dynamic device selection functions
  const requestDeviceTypes = useCallback(() => {
    client?.publish("command_i2c_device_selection", JSON.stringify({ command: "getDeviceTypes" }));
  }, [client]);

  const requestManufacturers = useCallback((deviceType: string) => {
    client?.publish("command_i2c_device_selection", JSON.stringify({ 
      command: "getManufacturers", 
      device_type: deviceType 
    }));
  }, [client]);

  const requestPartNumbers = useCallback((deviceType: string, manufacturer: string) => {
    client?.publish("command_i2c_device_selection", JSON.stringify({ 
      command: "getPartNumbers", 
      device_type: deviceType, 
      manufacturer: manufacturer 
    }));
  }, [client]);

  const handleDeviceTypeChange = useCallback((deviceType: string) => {
    setNewDevice(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        device_type: deviceType,
        manufacturer: "",
        part_number: ""
      }
    }));
    setManufacturers([]);
    setPartNumbers([]);
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
        part_number: ""
      }
    }));
    setPartNumbers([]);
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

  useEffect(() => {
    if (!client) {
      console.warn("MQTT client not available.");
      return;
    }

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const messageString = message.toString();
        const payload = JSON.parse(messageString);

        if (topic === "response_device_i2c") {
          if (Array.isArray(payload)) {
            setDevices(payload);
          } else if (payload && typeof payload === "object" && payload.status) {
            // Handle operation response (add/update/delete)
            if (payload.status === "success") {
              // Dismiss loading toast and show success
              toast.success(payload.message || "Operation completed successfully", {
                id: "device-operation"
              });
              
              // Auto refresh data after successful operation
              setTimeout(() => {
                client?.publish("command_device_i2c", JSON.stringify({ command: "getDataI2C" }));
              }, 500);
            } else if (payload.status === "error") {
              // Dismiss loading toast and show error
              toast.error(payload.message || "Operation failed", {
                id: "device-operation"
              });
            }
          } else {
            console.warn("[MQTT] DeviceManagerPage (I2C): Unexpected payload format:", payload);
          }
        } else if (topic === "response_i2c_device_selection") {
          if (payload.status === "success" && payload.data) {
            if (payload.command === "getDeviceTypes") {
              setDeviceTypes(payload.data || []);
            } else if (payload.command === "getManufacturers") {
              setManufacturers(payload.data || []);
            } else if (payload.command === "getPartNumbers") {
              setPartNumbers(payload.data || []);
            }
          } else if (payload.status === "error") {
            toast.error(payload.message || "Failed to load device data");
          }
        }
      } catch (error) {
        console.error(
          `[MQTT] DeviceManagerPage (I2C): Invalid JSON from MQTT topic '${topic}' or processing error:`,
          error,
          "Raw message:",
          message.toString()
        );
      }
    };

    client.on("message", handleMessage);
    client.subscribe("response_device_i2c");
    client.subscribe("response_i2c_device_selection");

    client.publish("command_device_i2c", JSON.stringify({ command: "getDataI2C" }));
    
    // Load device types on component mount
    requestDeviceTypes();

    return () => {
      client.unsubscribe("response_device_i2c");
      client.unsubscribe("response_i2c_device_selection");
      client.off("message", handleMessage);
    };
  }, [client, requestDeviceTypes]);

  const handleSubmit = () => {
    // Ensure fixed values are set correctly
    const deviceToSend = {
      ...newDevice,
      protocol_setting: {
        ...newDevice.protocol_setting,
        protocol: "Modular",
        address: parseInt(newDevice.protocol_setting.address.toString()) || 0,
        device_bus: parseInt(newDevice.protocol_setting.device_bus.toString()) || 0,
      },
    };

    const command = JSON.stringify({
      command: isUpdateMode ? "updateDevice" : "addDevice",
      device: deviceToSend,
      ...(isUpdateMode && deviceToUpdate && { old_name: deviceToUpdate }),
    });
    
    // Show immediate feedback
    toast.loading(isUpdateMode ? "Updating device..." : "Adding device...", {
      id: "device-operation"
    });
    
    client?.publish("command_device_i2c", command);
    setShowDialog(false);
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
        client?.publish("command_device_i2c", command);
      }
    });
  };

  // The fix is applied here: added type annotation for 'prev'
  const handleSelectScannedAddress = (address: string) => {
    setNewDevice((prev: Device) => ({ // Explicitly type 'prev' as Device
      ...prev,
      protocol_setting: {
        ...prev.protocol_setting,
        address: parseInt(address) || 0,
      },
    }));
  };

  const { sorted, sortField, sortDirection, handleSort } = useSortableTable(devices);
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(sorted, [
    "profile.name",
    "profile.part_number",
    "profile.topic",
    "protocol_setting.address",
    "protocol_setting.device_bus",
  ]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedDevices = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const deviceTypeBreakdown = devices.reduce((acc: { [key: string]: number }, device) => {
    const type = device.profile?.part_number || "Unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Cpu className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Modular Devices Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              client?.publish(
                "command_device_i2c",
                JSON.stringify({ command: "getDataI2C" })
              )
            }
          >
            <RotateCw />
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setNewDevice({
                profile: { 
                  name: "", 
                  device_type: "",
                  manufacturer: "",
                  part_number: "", 
                  topic: "" 
                },
                protocol_setting: { 
                  protocol: "Modular",
                  address: 0, 
                  device_bus: 0 
                },
              });
              setDeviceTypes([]);
              setManufacturers([]);
              setPartNumbers([]);
              requestDeviceTypes();
              setDeviceToUpdate("");
              setIsUpdateMode(false);
              setShowDialog(true);
            }}
          >
            Add Device
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 m-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Microchip className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
            <p className="text-xs text-muted-foreground">Registered devices</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Device Type Breakdown</CardTitle>
            <LayoutGrid className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            {Object.keys(deviceTypeBreakdown).length > 0 ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(deviceTypeBreakdown).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{type}:</span>
                    <Badge variant="outline" className="text-foreground">
                      {String(count)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No device types found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Common Type</CardTitle>
            <Badge variant="secondary" className="text-xs">Analysis</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Based on Part Number</p>
            <div className="text-xl font-semibold">
              {(() => {
                const counts: { [key: string]: number } = {};
                devices.forEach((d) => {
                  const type = d.profile?.part_number || "Unknown";
                  counts[type] = (counts[type] || 0) + 1;
                });
                const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                return top ? `${top[0]} (${top[1]})` : "N/A";
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="m-4">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <CardTitle>Device List</CardTitle>
              <ScanAddressDialog onSelectAddress={handleSelectScannedAddress} />
            </div>
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
                  Device Name <ArrowUpDown className="inline ml-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("profile.part_number")}
                >
                  PN <ArrowUpDown className="inline ml-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("protocol_setting.address")}
                >
                  Address <ArrowUpDown className="inline ml-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("protocol_setting.device_bus")}
                >
                  Bus <ArrowUpDown className="inline ml-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("profile.topic")}
                >
                  Topic <ArrowUpDown className="inline ml-1 h-4 w-4" />
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDevices.length > 0 ? (
                paginatedDevices.map((device, index) => (
                  <TableRow key={device.profile?.name || `device-${index}`}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                    <TableCell>{device.profile?.name}</TableCell>
                    <TableCell>{device.profile?.part_number}</TableCell>
                    <TableCell>{device.protocol_setting?.address}</TableCell>
                    <TableCell>{device.protocol_setting?.device_bus}</TableCell>
                    <TableCell>{device.profile?.topic}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewDevice(device);
                          setDeviceToUpdate(device.profile?.name);
                          setIsUpdateMode(true);
                          setShowDialog(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(device.profile?.name)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No devices found. Please add a new device or refresh the list.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    href="#"
                    aria-disabled={currentPage === 1}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
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
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    href="#"
                    aria-disabled={currentPage === totalPages}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isUpdateMode ? "Update Device" : "Add New Device"}</DialogTitle>
            <DialogDescription>
              {isUpdateMode 
                ? "Modify the device configuration below." 
                : "Configure the new modular device settings below."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Device Information Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">Device Information</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="deviceName">Device Name *</Label>
                  <Input
                    id="deviceName"
                    placeholder="Enter device name"
                    value={newDevice.profile.name}
                    onChange={(e) =>
                      setNewDevice({
                        ...newDevice,
                        profile: { ...newDevice.profile, name: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Device Selection Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">Device Selection</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="deviceType">Device Type *</Label>
                  <Select
                    value={newDevice.profile.device_type}
                    onValueChange={handleDeviceTypeChange}
                  >
                    <SelectTrigger id="deviceType">
                      <SelectValue placeholder="Select device type" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceTypes.length > 0 ? (
                        deviceTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>
                          Loading device types...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="manufacturer">Manufacturer *</Label>
                  <Select
                    value={newDevice.profile.manufacturer}
                    onValueChange={handleManufacturerChange}
                    disabled={!newDevice.profile.device_type}
                  >
                    <SelectTrigger id="manufacturer">
                      <SelectValue placeholder="Select manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      {manufacturers.length > 0 ? (
                        manufacturers.map((manufacturer) => (
                          <SelectItem key={manufacturer} value={manufacturer}>
                            {manufacturer}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>
                          {newDevice.profile.device_type ? "Loading manufacturers..." : "Select device type first"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="partNumber">Part Number *</Label>
                  <Select
                    value={newDevice.profile.part_number}
                    onValueChange={handlePartNumberChange}
                    disabled={!newDevice.profile.manufacturer}
                  >
                    <SelectTrigger id="partNumber">
                      <SelectValue placeholder="Select part number" />
                    </SelectTrigger>
                    <SelectContent>
                      {partNumbers.length > 0 ? (
                        partNumbers.map((partNumber) => (
                          <SelectItem key={partNumber} value={partNumber}>
                            {partNumber}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>
                          {newDevice.profile.manufacturer ? "Loading part numbers..." : "Select manufacturer first"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Protocol Configuration Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">Protocol Configuration</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address">I2C Address *</Label>
                  <Input
                    id="address"
                    type="number"
                    placeholder="Enter I2C address (e.g., 48)"
                    min="0"
                    max="127"
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
                  />
                  <p className="text-xs text-muted-foreground mt-1">Valid range: 0-127</p>
                </div>
                <div>
                  <Label htmlFor="deviceBus">Device Bus *</Label>
                  <Input
                    id="deviceBus"
                    type="number"
                    placeholder="Enter device bus (e.g., 0 or 1)"
                    min="0"
                    max="1"
                    value={newDevice.protocol_setting.device_bus}
                    onChange={(e) =>
                      setNewDevice({
                        ...newDevice,
                        protocol_setting: {
                          ...newDevice.protocol_setting,
                          device_bus: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">Usually 0 or 1</p>
                </div>
              </div>
            </div>

            {/* MQTT Configuration Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">MQTT Configuration</h4>
              <div>
                <Label htmlFor="topic">MQTT Topic *</Label>
                <Input
                  id="topic"
                  placeholder="e.g., sensors/temperature/room1"
                  value={newDevice.profile.topic}
                  onChange={(e) =>
                    setNewDevice({
                      ...newDevice,
                      profile: { ...newDevice.profile, topic: e.target.value },
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">MQTT topic for publishing device data</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSubmit} className="flex-1">
                {isUpdateMode ? "Update Device" : "Add Device"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}