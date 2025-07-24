"use client";

import { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RotateCw, Server, ArrowUpDown, Cpu, Network, Layers } from "lucide-react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import Swal from "sweetalert2";
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
}
 from "@/components/ui/select";

const ITEMS_PER_PAGE = 5;

export default function DeviceManagerPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deviceToUpdate, setDeviceToUpdate] = useState<string>("");
  const [newDevice, setNewDevice] = useState<any>({
    profile: {
      name: "",
      part_number: "",
      topic: "",
    },
    protocol_setting: {
      protocol: "Modbus RTU",
      address: "",
      ip_address: "",
      port: "",
      baudrate: 9600,
      parity: "NONE",
      bytesize: 8,
      stop_bit: 1,
      timeout: 1000,
      endianness: "Little Endian",
      snmp_version: "1",
      read_community: "public",
    },
  });

  const status = useMQTTStatus();
  const client = connectMQTT(); // Connects to the global MQTT client instance

  useEffect(() => {
    // Ensure the MQTT client is available before setting up listeners
    if (!client) {
      console.warn("MQTT client not available.");
      return;
    }

    const handleMessage = (topic: string, message: Buffer) => {
      if (topic !== "response_device_modbus") {
        return; // Ignore messages not meant for device management
      }

      try {
        const messageString = message.toString();

        const payload = JSON.parse(messageString);
        // console.log(`[MQTT] DeviceManagerPage: Parsed payload:`, payload);

        if (Array.isArray(payload)) {
          setDevices(payload);
        } else {
          console.warn("[MQTT] DeviceManagerPage: Payload is not an array, skipping update:", payload);
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
    client.publish("command_device_modbus", JSON.stringify({ command: "getDataModbus" }));

    // Cleanup function for when the component unmounts
    return () => {
      client.unsubscribe("response_device_modbus");
      client.off("message", handleMessage);
    };
  }, [client]); // Rerun effect if the MQTT client instance changes (unlikely for global client)

  const handleSubmit = () => {
    const command = JSON.stringify({
      command: isUpdateMode ? "updateDevice" : "addDevice",
      device: newDevice,
      ...(isUpdateMode && deviceToUpdate && { old_name: deviceToUpdate }),
    });
    client?.publish("command_device_modbus", command);
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
        const command = JSON.stringify({ command: "deleteDevice", name });
        client?.publish("command_device_modbus", command);
        Swal.fire("Deleted!", "Your device has been deleted.", "success");
      }
    });
  };

  // Hooks for sorting and filtering
  const { sorted, sortField, sortDirection, handleSort } = useSortableTable(devices);
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(sorted, [
    "profile.name",
    "profile.part_number",
    "profile.topic",
    "protocol_setting.address",
    "protocol_setting.ip_address",
  ]);

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
          {/* <Button
            size="sm"
            variant="default"
            onClick={() => {
              // Reset form for adding new device
              setNewDevice({
                profile: { name: "", part_number: "", topic: "" },
                protocol_setting: {
                  protocol: "Modbus RTU",
                  address: "",
                  ip_address: "",
                  port: "",
                  baudrate: 9600,
                  parity: "NONE",
                  bytesize: 8,
                  stop_bit: 1,
                  timeout: 1000,
                  endianness: "Little Endian",
                  snmp_version: "1",
                  read_community: "public",
                },
              });
              setDeviceToUpdate("");
              setIsUpdateMode(false);
              setShowDialog(true); // Open the dialog
            }}
          >
            Add Device
          </Button> */}
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
            <p className="text-xs text-muted-foreground">All connected devices</p>
          </CardContent>
        </Card>

        {/* Protocol Breakdown Card */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protocol Breakdown</CardTitle>
            <Network className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Modbus RTU</span>
                <span className="font-semibold">
                  {
                    devices.filter(
                      (d) => d.protocol_setting?.protocol?.toLowerCase() === "modbus rtu"
                    ).length
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>SNMP</span>
                <span className="font-semibold">
                  {
                    devices.filter(
                      (d) => d.protocol_setting?.protocol?.toLowerCase() === "snmp"
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
            <CardTitle className="text-sm font-medium">Most Used Protocol</CardTitle>
            <Layers className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {(() => {
                const modbusCount = devices.filter(
                  (d) => d.protocol_setting?.protocol?.toLowerCase() === "modbus rtu"
                ).length;
                const snmpCount = devices.filter(
                  (d) => d.protocol_setting?.protocol?.toLowerCase() === "snmp"
                ).length;
                if (modbusCount === snmpCount && modbusCount > 0) return "Equal Use";
                if (modbusCount === 0 && snmpCount === 0) return "N/A";
                return modbusCount > snmpCount ? "Modbus RTU" : "SNMP";
              })()}
            </div>
            <p className="text-xs text-muted-foreground">Most common protocol</p>
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
                  Device Name{" "}
                  <ArrowUpDown className="inline mr-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("profile.part_number")}
                >
                  PN{" "}
                  <ArrowUpDown className="inline mr-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("protocol_setting.address")}
                >
                  Address/IP{" "}
                  <ArrowUpDown className="inline mr-1 h-4 w-4" />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("profile.topic")}
                >
                  Topic{" "}
                  <ArrowUpDown className="inline mr-1 h-4 w-4" />
                </TableHead>
                {/* <TableHead className="text-right">Action</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDevices.length > 0 ? (
                paginatedDevices.map((device, index) => (
                  // Using device.profile?.name as key, with index as fallback for safety.
                  // For production, prefer a truly unique ID from your data if available (e.g., device.id).
                  <TableRow key={device.profile?.name || `device-${index}`}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                    <TableCell>{device.profile?.name}</TableCell>
                    <TableCell>{device.profile?.part_number}</TableCell>
                    <TableCell>
                      {device.protocol_setting?.protocol === "Modbus RTU"
                        ? device.protocol_setting?.address
                        : device.protocol_setting?.ip_address}
                    </TableCell>
                    <TableCell>{device.profile?.topic}</TableCell>
                    {/* <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewDevice(device);
                          setDeviceToUpdate(device.profile?.name); // Store old name for update
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
                    </TableCell> */}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No devices found. Please add a new device or refresh the list.
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

      {/* Add/Edit Device Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isUpdateMode ? "Update Device" : "Add New Device"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deviceName">Device Name</Label>
              <Input
                id="deviceName"
                value={newDevice.profile.name}
                onChange={(e) =>
                  setNewDevice({
                    ...newDevice,
                    profile: { ...newDevice.profile, name: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="partNumber">Part Number</Label>
              <Input
                id="partNumber"
                value={newDevice.profile.part_number}
                onChange={(e) =>
                  setNewDevice({
                    ...newDevice,
                    profile: { ...newDevice.profile, part_number: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={newDevice.profile.topic}
                onChange={(e) =>
                  setNewDevice({
                    ...newDevice,
                    profile: { ...newDevice.profile, topic: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="protocol">Protocol</Label>
              <Select
                value={newDevice.protocol_setting.protocol}
                onValueChange={(value) =>
                  setNewDevice({
                    ...newDevice,
                    protocol_setting: { ...newDevice.protocol_setting, protocol: value },
                  })
                }
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
            <div>
              <Label htmlFor="address">
                {newDevice.protocol_setting.protocol === "Modbus RTU" ? "Address" : "IP Address"}
              </Label>
              <Input
                id="address"
                value={
                  newDevice.protocol_setting.protocol === "Modbus RTU"
                    ? newDevice.protocol_setting.address
                    : newDevice.protocol_setting.ip_address
                }
                onChange={(e) =>
                  setNewDevice({
                    ...newDevice,
                    protocol_setting: {
                      ...newDevice.protocol_setting,
                      [newDevice.protocol_setting.protocol === "Modbus RTU"
                        ? "address"
                        : "ip_address"]: e.target.value,
                    },
                  })
                }
              />
            </div>
            {/* You might want to add more fields for other protocol_setting properties
                like port, baudrate, etc., based on the selected protocol */}
            <Button onClick={handleSubmit} className="col-span-full mt-4">
              {isUpdateMode ? "Update Device" : "Add Device"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}