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
import { RotateCw, Cpu, ArrowUpDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Swal from "sweetalert2";
import { connectMQTT } from "@/lib/mqttClient";
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

export default function DeviceManagerPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [newDevice, setNewDevice] = useState<any>({
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

  const status = useMQTTStatus();
  const client = connectMQTT();

  useEffect(() => {
    if (!client) return;

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        if (Array.isArray(payload)) {
          console.log(payload);
          setDevices(payload);
          console.log(payload);
        }
      } catch (error) {
        console.error("Invalid JSON from MQTT", error);
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
    const topic = isUpdateMode ? "updateDevice" : "addDevice";
    const command = JSON.stringify({
      command: topic,
      device: newDevice,
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
    }).then((result) => {
      if (result.isConfirmed) {
        const command = JSON.stringify({ command: "deleteDevice", name });
        client?.publish("command_device_i2c", command);
      }
    });
  };

  const { sorted, sortField, sortDirection, handleSort } = useSortableTable(devices);
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(sorted, [
    "profile.name",
    "profile.part_number",
    "profile.topic",
    "protocol_setting.address",
  ]);

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
          <Cpu className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Modular Devices</h1>
        </div>
        <div className="flex items-center gap-2">
          
          <Badge
            variant="outline"
            className={`capitalize ${
              status === "connected"
                ? "text-green-600 border-green-600"
                : status === "error"
                ? "text-red-600 border-red-600"
                : "text-yellow-600 border-yellow-600"
            }`}
          >
            {status}
          </Badge>
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
              setIsUpdateMode(false);
              setShowDialog(true);
            }}
          >
            Add Device
          </Button>
        </div>
      </header>

      <Card className="m-4">
        <CardHeader>
          <div className="flex justify-between">
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
                <TableHead onClick={() => handleSort("profile")}>Device Name <ArrowUpDown className="inline mr-1 h-4 w-4" /></TableHead>
                <TableHead onClick={() => handleSort("part_number")}>PN <ArrowUpDown className="inline mr-1 h-4 w-4" /></TableHead>
                <TableHead onClick={() => handleSort("address")}>Address <ArrowUpDown className="inline mr-1 h-4 w-4" /></TableHead>
                <TableHead onClick={() => handleSort("topic")}>Topic <ArrowUpDown className="inline mr-1 h-4 w-4" /></TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDevices.length > 0 ? (
                paginatedDevices.map((device, index) => (
                  <TableRow key={device.profile?.name}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                    <TableCell>{device.profile?.name}</TableCell>
                    <TableCell>{device.profile?.part_number}</TableCell>
                    <TableCell>{device.protocol_setting?.address}</TableCell>
                    <TableCell>{device.profile?.topic}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewDevice(device);
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
                  <TableCell colSpan={6} className="text-center">
                    No devices found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  href="#"
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
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isUpdateMode ? "Update Device" : "Add New Device"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Device Name</Label>
              <Input
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
              <Label>Part Number</Label>
              <Select
                value={newDevice.profile.part_number}
                onValueChange={(value) =>
                  setNewDevice({
                    ...newDevice,
                    profile: { ...newDevice.profile, part_number: value },
                  })
                }
              >
                <SelectTrigger>
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
              <Label>Address</Label>
              <Input
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
              <Label>Device Bus</Label>
              <Input
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
            <div className="col-span-2">
              <Label>Topic</Label>
              <Input
                value={newDevice.profile.topic}
                onChange={(e) =>
                  setNewDevice({
                    ...newDevice,
                    profile: { ...newDevice.profile, topic: e.target.value },
                  })
                }
              />
            </div>
            <Button onClick={handleSubmit} className="col-span-2">
              {isUpdateMode ? "Update Device" : "Add Device"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
