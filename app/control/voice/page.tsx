"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Swal from "sweetalert2";
import { v4 as uuidv4 } from "uuid";
import { connectMQTT, getMQTTClient, isClientConnected, getConnectionState } from "@/lib/mqttClient";
import { MqttClient } from "mqtt";

// UI Components
import {
  RotateCw,
  Mic,
  PlusCircle,
  Trash2,
  Edit2,
  Volume2,
  Settings,
  Activity,
  Search,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import MqttStatus from "@/components/mqtt-status";

// Type definitions
interface VoiceControl {
  uuid: string;
  device_name: string;
  data: {
    pin: number;
    custom_name: string;
    address: number;
    bus: number;
  };
}

interface ModularDevice {
  profile: {
    name: string;
    device_bus: number;
    address: number;
  };
  protocol_setting: {
    address: number;
    device_bus: number;
  };
  data?: any[];
}

const ITEMS_PER_PAGE = 10;

const VoiceControlPage = () => {
  // MQTT Connection
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isConnected, setIsConnected] = useState(false);

  // Data States
  const [voiceControlData, setVoiceControlData] = useState<VoiceControl[]>([]);
  const [modularDevices, setModularDevices] = useState<ModularDevice[]>([]);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedControl, setSelectedControl] = useState<string | null>(null);

  // Voice Control Form State
  const initialVoiceControl: VoiceControl = {
    uuid: "",
    device_name: "",
    data: {
      pin: 1,
      custom_name: "",
      address: 0,
      bus: 0,
    },
  };
  const [voiceControl, setVoiceControl] =
    useState<VoiceControl>(initialVoiceControl);

  // MQTT Topics
  const topicVoiceControlCreate = "voice_control/create";
  const topicVoiceControlUpdate = "voice_control/update";
  const topicVoiceControlDelete = "voice_control/delete";
  const topicVoiceControlData = "voice_control/data";
  const topicModularData = "modular_value/data";
  const topicRefreshData = "voice_control/request_data";

  const formRef = useRef<HTMLFormElement>(null);

  // Initialize MQTT Connection
  useEffect(() => {
    const initMQTT = async () => {
      try {
        const client = connectMQTT();
        setMqttClient(client);
        
        client.on('connect', () => {
          setConnectionStatus('connected');
          setIsConnected(true);
          console.log('MQTT: Voice Control - Connected');
          
          // Subscribe to topics
          client.subscribe('voice_control/data', (err) => {
            if (err) console.error('Failed to subscribe to voice_control/data:', err);
          });
          client.subscribe('modular_value/data', (err) => {
            if (err) console.error('Failed to subscribe to modular_value/data:', err);
          });
        });
        
        client.on('disconnect', () => {
          setConnectionStatus('disconnected');
          setIsConnected(false);
          console.log('MQTT: Voice Control - Disconnected');
        });
        
        client.on('error', (error) => {
          console.error('MQTT Error:', error);
          setConnectionStatus('error');
          setIsConnected(false);
        });
        
      } catch (error) {
        console.error('Failed to initialize MQTT:', error);
        setConnectionStatus('error');
      }
    };
    
    initMQTT();
    
    return () => {
      // Cleanup on unmount
      if (mqttClient) {
        mqttClient.removeAllListeners();
      }
    };
  }, []);
  
  // Publish Message Function
  const publishMessage = useCallback(
    (message: any, topic: string) => {
      if (mqttClient && isConnected) {
        mqttClient.publish(topic, JSON.stringify(message), (err) => {
          if (err) {
            console.error('Failed to publish message:', err);
            Swal.fire({
              icon: "error",
              title: "MQTT Error",
              text: "Failed to send command.",
            });
          }
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "MQTT Disconnected",
          text: "Cannot send command, MQTT client is not connected.",
        });
      }
    },
    [mqttClient, isConnected]
  );

  // Refresh Function
  const refreshVoiceControlData = useCallback(() => {
    publishMessage("refresh", topicRefreshData);
    Swal.fire({
      icon: "info",
      title: "Refreshing data...",
      text: "Requesting latest data from MQTT broker.",
      showConfirmButton: false,
      timer: 1000,
    });
  }, [publishMessage, topicRefreshData]);

  // Message Handlers
  useEffect(() => {
    if (!mqttClient || !isConnected) return;
    
    // Handler untuk data voice control
    const handleVoiceControlData = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        setVoiceControlData(payload || []);
        console.log("MQTT: Data voice control diterima:", payload);
      } catch (error) {
        console.error("MQTT: Gagal memproses data voice control", error);
        Swal.fire({
          icon: "error",
          title: "Parsing Error",
          text: "An error occurred while processing voice control data.",
        });
      }
    };

    // Handler untuk data modular devices
    const handleModularData = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        setModularDevices(payload || []);
        console.log("MQTT: Data modular devices diterima:", payload);
      } catch (error) {
        console.error("MQTT: Gagal memproses data modular devices", error);
        Swal.fire({
          icon: "error",
          title: "Parsing Error",
          text: "An error occurred while processing modular device data.",
        });
      }
    };

    // Set up message handlers
    mqttClient.on('message', (topic: string, message: Buffer) => {
      if (topic === topicVoiceControlData) {
        handleVoiceControlData(topic, message);
      } else if (topic === topicModularData) {
        handleModularData(topic, message);
      }
    });

    // Request initial data
    console.log("MQTT: Meminta data awal setelah koneksi berhasil.");
    publishMessage("refresh", topicRefreshData);
    
    return () => {
      // Cleanup message handlers
      if (mqttClient) {
        mqttClient.removeAllListeners('message');
      }
    };
  }, [mqttClient, isConnected, publishMessage, topicVoiceControlData, topicModularData, topicRefreshData]);

  // Modal Functions
  const openModal = (item?: VoiceControl) => {
    if (item) {
      setIsEditing(true);
      setSelectedControl(item.uuid);
      setVoiceControl({ ...item });
    } else {
      setIsEditing(false);
      setSelectedControl(null);
      setVoiceControl({ ...initialVoiceControl, uuid: uuidv4() });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setSelectedControl(null);
    setVoiceControl({ ...initialVoiceControl, uuid: uuidv4() });
  };

  // Save Function
  const saveVoiceControl = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!voiceControl.data.custom_name || !voiceControl.device_name) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please fill in all required fields.",
      });
      return;
    }

    const topic = isEditing ? topicVoiceControlUpdate : topicVoiceControlCreate;
    publishMessage(voiceControl, topic);

    closeModal();
    Swal.fire({
      icon: "success",
      title: isEditing ? "Voice Control Updated!" : "Voice Control Created!",
      showConfirmButton: false,
      timer: 1500,
    });
  };

  // Delete Function
  const deleteVoiceControl = (uuid: string) => {
    Swal.fire({
      title: "Are you sure?",
      text: "Do you want to delete this voice control? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, keep it",
    }).then((result) => {
      if (result.isConfirmed) {
        publishMessage({ uuid }, topicVoiceControlDelete);
        Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Voice control has been deleted.",
          showConfirmButton: false,
          timer: 1500,
        });
      }
    });
  };

  // Device Selection Handler
  const handleDeviceSelection = (deviceName: string) => {
    const selectedDevice = modularDevices.find(
      (d) => d.profile.name === deviceName
    );
    setVoiceControl((prev) => ({
      ...prev,
      device_name: deviceName,
      data: {
        ...prev.data,
        address: selectedDevice?.protocol_setting.address || 0,
        bus: selectedDevice?.protocol_setting.device_bus || 0,
      },
    }));
  };

  // Search and Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const filteredData = useMemo(() => {
    if (!searchQuery) {
      return voiceControlData;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return voiceControlData.filter(
      (item) =>
        item.data.custom_name.toLowerCase().includes(lowerCaseQuery) ||
        item.device_name.toLowerCase().includes(lowerCaseQuery)
    );
  }, [voiceControlData, searchQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Calculate summary data
  const totalVoiceControls = voiceControlData.length;
  const availableDevices = modularDevices.length;
  const usedPins = voiceControlData.length;
  const uniqueDevices = new Set(voiceControlData.map((v) => v.device_name))
    .size;

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Mic className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Voice Control</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Badge variant={isConnected ? "default" : "destructive"}>
            {connectionStatus}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={refreshVoiceControlData}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Voice Control
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-2 border-b">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search voice controls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Summary Cards */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              <CardTitle>Voice Control Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Volume2 className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{totalVoiceControls}</div>
                <div className="text-sm text-muted-foreground">Total Commands</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Activity className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{uniqueDevices}</div>
                <div className="text-sm text-muted-foreground">Devices Used</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Settings className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{availableDevices}</div>
                <div className="text-sm text-muted-foreground">Available</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <PlusCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{usedPins}</div>
                <div className="text-sm text-muted-foreground">Active Pins</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice Controls Table */}
        <Card>
          <CardHeader>
            <CardTitle>Voice Controls</CardTitle>
            <CardDescription>Manage your voice command configurations</CardDescription>
          </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="text-center py-12">
              <Mic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No voice controls found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first voice control command to get started
              </p>
              <Button onClick={() => openModal()}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Voice Control
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voice Command</TableHead>
                  <TableHead>Device Name</TableHead>
                  <TableHead>Pin</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((item) => (
                  <TableRow key={item.uuid}>
                    <TableCell className="font-medium">{item.data.custom_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.device_name}</Badge>
                    </TableCell>
                    <TableCell>{item.data.pin}</TableCell>
                    <TableCell>{item.data.address}</TableCell>
                    <TableCell>{item.data.bus}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openModal(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteVoiceControl(item.uuid)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredData.length)} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} of {filteredData.length} results
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          </CardContent>
        </Card>

      {/* Voice Control Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Mic className="h-5 w-5" />
              <span>{isEditing ? "Edit Voice Control" : "Add New Voice Control"}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveVoiceControl} className="space-y-6">
            {/* Voice Command Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Volume2 className="h-4 w-4" />
                <h3 className="text-sm font-medium">Voice Command Settings</h3>
              </div>
              <div>
                <Label htmlFor="custom_name">Voice Command *</Label>
                <Input
                  id="custom_name"
                  value={voiceControl.data.custom_name}
                  onChange={(e) =>
                    setVoiceControl((prev) => ({
                      ...prev,
                      data: { ...prev.data, custom_name: e.target.value },
                    }))
                  }
                  placeholder="e.g., Turn on living room light"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This phrase will be recognized after "nyalakan" or "matikan"
                </p>
              </div>
            </div>

            {/* Device Configuration */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <h3 className="text-sm font-medium">Device Configuration</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="device_name">Device Name *</Label>
                  <Select
                    value={voiceControl.device_name}
                    onValueChange={handleDeviceSelection}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select device" />
                    </SelectTrigger>
                    <SelectContent>
                      {modularDevices.map((device) => (
                        <SelectItem key={device.profile.name} value={device.profile.name}>
                          {device.profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pin">Pin *</Label>
                  <Select
                    value={voiceControl.data.pin.toString()}
                    onValueChange={(value) =>
                      setVoiceControl((prev) => ({
                        ...prev,
                        data: { ...prev.data, pin: parseInt(value) },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pin" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 8 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          Pin {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    type="number"
                    value={voiceControl.data.address.toString()}
                    placeholder="Auto-filled"
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Address is automatically filled from device selection
                  </p>
                </div>
                <div>
                  <Label htmlFor="bus">Bus</Label>
                  <Input
                    id="bus"
                    type="number"
                    value={voiceControl.data.bus.toString()}
                    placeholder="Auto-filled"
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Bus is automatically filled from device selection
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">
                {isEditing ? "Update" : "Create"} Voice Control
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </SidebarInset>
  );
};

export default VoiceControlPage;