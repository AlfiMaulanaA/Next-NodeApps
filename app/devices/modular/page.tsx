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
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, Cpu, ArrowUpDown, Microchip, LayoutGrid } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Swal from "sweetalert2";
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
    part_number: string;
    topic: string;
  };
  protocol_setting: {
    address: string;
    device_bus: string;
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
      part_number: "",
      topic: "",
    },
    protocol_setting: {
      address: "",
      device_bus: "",
    },
  });

  const client = connectMQTT();

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
          } else {
            console.warn("[MQTT] DeviceManagerPage (I2C): Payload from response_device_i2c is not an array, skipping update:", payload);
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

    client.publish("command_device_i2c", JSON.stringify({ command: "getDataI2C" }));

    return () => {
      client.unsubscribe("response_device_i2c");
      client.off("message", handleMessage);
    };
  }, [client]);

  const handleSubmit = () => {
    const command = JSON.stringify({
      command: isUpdateMode ? "updateDevice" : "addDevice",
      device: newDevice,
      ...(isUpdateMode && deviceToUpdate && { old_name: deviceToUpdate }),
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
        const command = JSON.stringify({ command: "deleteDevice", name });
        client?.publish("command_device_i2c", command);
        Swal.fire("Deleted!", "Your device has been deleted.", "success");
      }
    });
  };

  // The fix is applied here: added type annotation for 'prev'
  const handleSelectScannedAddress = (address: string) => {
    setNewDevice((prev: Device) => ({ // Explicitly type 'prev' as Device
      ...prev,
      protocol_setting: {
        ...prev.protocol_setting,
        address: address,
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
                profile: { name: "", part_number: "", topic: "" },
                protocol_setting: { address: "", device_bus: "" },
              });
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
              <Select
                value={newDevice.profile.part_number}
                onValueChange={(value) =>
                  setNewDevice({
                    ...newDevice,
                    profile: { ...newDevice.profile, part_number: value },
                  })
                }
              >
                <SelectTrigger id="partNumber">
                  <SelectValue placeholder="Select a part number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RELAYMINI">RELAYMINI</SelectItem>
                  <SelectItem value="RELAY">RELAY</SelectItem>
                  <SelectItem value="DRYCONTACT">DRYCONTACT</SelectItem>
                  <SelectItem value="DIGITALIO">DIGITAL IO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={newDevice.protocol_setting.address}
                onChange={(e) =>
                  setNewDevice({
                    ...newDevice,
                    protocol_setting: {
                      ...newDevice.protocol_setting,
                      address: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="deviceBus">Device Bus</Label>
              <Input
                id="deviceBus"
                value={newDevice.protocol_setting.device_bus}
                onChange={(e) =>
                  setNewDevice({
                    ...newDevice,
                    protocol_setting: {
                      ...newDevice.protocol_setting,
                      device_bus: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="col-span-full">
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
            <Button onClick={handleSubmit} className="col-span-full mt-4">
              {isUpdateMode ? "Update Device" : "Add Device"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}