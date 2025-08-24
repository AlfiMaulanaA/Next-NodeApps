"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { connectMQTT } from "@/lib/mqttClient";
import { MqttClient } from "mqtt";

// UI Components
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Icons
import {
  MapPin,
  RotateCw,
  PlusCircle,
  Edit2,
  Trash2,
  Search,
  Navigation,
  Target,
  Activity,
  Settings,
  Map,
  Users,
  Zap,
} from "lucide-react";

// MQTT Status
import MqttStatus from "@/components/mqtt-status";

// Import Simple Geofence Map component
import SimpleGeofenceMap from "@/components/simple-geofence-map";

// Type definitions
interface GeofenceArea {
  id: string;
  name: string;
  description: string;
  coordinates: Array<{ lat: number; lng: number }>;
  radius?: number; // For circle type
  type: "polygon" | "circle";
  center?: { lat: number; lng: number }; // For circle type
}

interface GeofenceRule {
  id: string;
  name: string;
  area_id: string;
  trigger_type: "enter" | "exit" | "both";
  enabled: boolean;
  actions: {
    device_name: string;
    pin: number;
    action: "on" | "off" | "toggle";
    delay: number; // seconds
    address: number;
    device_bus: number;
  }[];
  users: string[]; // User IDs or device IDs to track
  created_at: string;
  last_triggered?: string;
}

interface ModularDevice {
  profile: {
    name: string;
  };
  protocol_setting: {
    address: number;
    device_bus: number;
  };
}

interface MQTTBrokerData {
  mac_address: string;
}

const ITEMS_PER_PAGE = 10;

export default function GeofencePage() {
  // MQTT Connection
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isConnected, setIsConnected] = useState(false);

  // Data States
  const [geofenceRules, setGeofenceRules] = useState<GeofenceRule[]>([]);
  const [geofenceAreas, setGeofenceAreas] = useState<GeofenceArea[]>([]);
  const [modularDevices, setModularDevices] = useState<ModularDevice[]>([]);
  const [mqttBrokerData, setMqttBrokerData] = useState<MQTTBrokerData | null>(
    null
  );

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);

  // Search and pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Form States
  const initialRule: GeofenceRule = {
    id: "",
    name: "",
    area_id: "",
    trigger_type: "enter",
    enabled: true,
    actions: [
      {
        device_name: "",
        pin: 1,
        action: "on",
        delay: 0,
        address: 0,
        device_bus: 0,
      },
    ],
    users: [],
    created_at: "",
  };

  const [currentRule, setCurrentRule] = useState<GeofenceRule>(initialRule);
  const [currentArea, setCurrentArea] = useState<GeofenceArea>({
    id: "",
    name: "",
    description: "",
    coordinates: [],
    type: "polygon",
  });

  // MQTT Topics
  const topicGeofenceCreate = "geofence/create";
  const topicGeofenceUpdate = "geofence/update";
  const topicGeofenceDelete = "geofence/delete";
  const topicGeofenceData = "geofence/data";
  const topicModularData = "modular_value/data";
  const topicMqttBroker = "mqtt_broker_server";
  const topicRefreshData = "geofence/request_data";

  const clientRef = useRef<MqttClient | null>(null);

  // Initialize MQTT Connection
  useEffect(() => {
    const initMQTT = async () => {
      try {
        const client = connectMQTT();
        setMqttClient(client);
        clientRef.current = client;

        client.on("connect", () => {
          setConnectionStatus("connected");
          setIsConnected(true);
          console.log("MQTT: Geofence Control - Connected");

          // Subscribe to topics
          client.subscribe(topicGeofenceData, (err) => {
            if (err)
              console.error("Failed to subscribe to geofence/data:", err);
          });
          client.subscribe(topicModularData, (err) => {
            if (err)
              console.error("Failed to subscribe to modular_value/data:", err);
          });
          client.subscribe(topicMqttBroker, (err) => {
            if (err)
              console.error("Failed to subscribe to mqtt_broker_server:", err);
          });

          // Request initial data
          refreshGeofenceData();
        });

        client.on("disconnect", () => {
          setConnectionStatus("disconnected");
          setIsConnected(false);
          console.log("MQTT: Geofence Control - Disconnected");
        });

        client.on("error", (error) => {
          console.error("MQTT Error:", error);
          setConnectionStatus("error");
          setIsConnected(false);
        });

        client.on("message", handleMqttMessage);
      } catch (error) {
        console.error("Failed to initialize MQTT:", error);
        setConnectionStatus("error");
      }
    };

    initMQTT();

    return () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
      }
    };
  }, []);

  // Handle MQTT Messages
  const handleMqttMessage = useCallback(
    (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());

        if (topic === topicGeofenceData) {
          if (payload.rules && Array.isArray(payload.rules)) {
            setGeofenceRules(payload.rules);
          }
          if (payload.areas && Array.isArray(payload.areas)) {
            setGeofenceAreas(payload.areas);
          }
          console.log("MQTT: Geofence data received:", payload);
        } else if (topic === topicModularData) {
          setModularDevices(payload || []);
          console.log("MQTT: Modular devices data received:", payload);
        } else if (topic === topicMqttBroker) {
          setMqttBrokerData(payload);
          console.log("MQTT: Broker data received:", payload);
        }
      } catch (error) {
        console.error("MQTT: Failed to process message", error);
        toast.error("Failed to process MQTT message");
      }
    },
    [topicGeofenceData, topicModularData, topicMqttBroker]
  );

  // Publish Message Function
  const publishMessage = useCallback(
    (message: any, topic: string) => {
      if (mqttClient && isConnected) {
        mqttClient.publish(topic, JSON.stringify(message), (err) => {
          if (err) {
            console.error("Failed to publish message:", err);
            toast.error("Failed to send command.");
          }
        });
      } else {
        toast.error("MQTT client is not connected.");
      }
    },
    [mqttClient, isConnected]
  );

  // Refresh Function
  const refreshGeofenceData = useCallback(() => {
    publishMessage({ command: "get_data" }, topicRefreshData);
    toast.info("Requesting latest geofence data...");
  }, [publishMessage, topicRefreshData]);

  // Modal Functions
  const openModal = (rule?: GeofenceRule) => {
    if (rule) {
      setIsEditing(true);
      setSelectedRule(rule.id);
      setCurrentRule({ ...rule });
    } else {
      setIsEditing(false);
      setSelectedRule(null);
      setCurrentRule({ ...initialRule, id: Date.now().toString() });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setSelectedRule(null);
    setCurrentRule(initialRule);
  };

  const openMapModal = () => {
    setCurrentArea({
      id: Date.now().toString(),
      name: "",
      description: "",
      coordinates: [],
      type: "polygon",
    });
    setIsMapModalOpen(true);
  };

  // Save Functions
  const saveRule = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (
      !currentRule.name ||
      !currentRule.area_id ||
      currentRule.actions.length === 0
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Validate actions
    for (const action of currentRule.actions) {
      if (!action.device_name || !action.pin) {
        toast.error("Please fill in all action details.");
        return;
      }
    }

    const topic = isEditing ? topicGeofenceUpdate : topicGeofenceCreate;
    const ruleData = {
      ...currentRule,
      created_at: isEditing ? currentRule.created_at : new Date().toISOString(),
    };

    publishMessage(ruleData, topic);
    closeModal();

    toast.success(
      isEditing ? "Geofence rule updated!" : "Geofence rule created!"
    );
  };

  const saveArea = (area: GeofenceArea) => {
    setGeofenceAreas((prev) => [...prev, area]);
    setIsMapModalOpen(false);
    toast.success("Geofence area created!");
  };

  // Delete Function
  const deleteRule = (ruleId: string) => {
    if (window.confirm("Are you sure you want to delete this geofence rule?")) {
      publishMessage({ id: ruleId }, topicGeofenceDelete);
      toast.success("Geofence rule deleted!");
    }
  };

  // Action Management
  const addAction = () => {
    setCurrentRule((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          device_name: "",
          pin: 1,
          action: "on",
          delay: 0,
          address: 0,
          device_bus: 0,
        },
      ],
    }));
  };

  const removeAction = (index: number) => {
    setCurrentRule((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const updateAction = (index: number, field: string, value: any) => {
    setCurrentRule((prev) => ({
      ...prev,
      actions: prev.actions.map((action, i) =>
        i === index ? { ...action, [field]: value } : action
      ),
    }));
  };

  // Device Selection Handler
  const handleDeviceSelection = (actionIndex: number, deviceName: string) => {
    const selectedDevice = modularDevices.find(
      (d) => d.profile.name === deviceName
    );
    if (selectedDevice) {
      updateAction(actionIndex, "device_name", deviceName);
      updateAction(
        actionIndex,
        "address",
        selectedDevice.protocol_setting.address
      );
      updateAction(
        actionIndex,
        "device_bus",
        selectedDevice.protocol_setting.device_bus
      );
    }
  };

  // Filter and paginate data
  const filteredRules = geofenceRules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.area_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredRules.length / ITEMS_PER_PAGE);
  const paginatedRules = filteredRules.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate summary data
  const totalRules = geofenceRules.length;
  const activeRules = geofenceRules.filter((r) => r.enabled).length;
  const totalAreas = geofenceAreas.length;
  const totalActions = geofenceRules.reduce(
    (sum, r) => sum + r.actions.length,
    0
  );

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <MapPin className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Geofence Control</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={refreshGeofenceData}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => openModal()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Geofence Rule
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-2 border-b">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search geofence rules..."
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
              <Navigation className="h-5 w-5" />
              <CardTitle>Geofence Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{totalRules}</div>
                <div className="text-sm text-muted-foreground">Total Rules</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Activity className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{activeRules}</div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Map className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{totalAreas}</div>
                <div className="text-sm text-muted-foreground">Areas</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Zap className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{totalActions}</div>
                <div className="text-sm text-muted-foreground">Actions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openMapModal}>
                <Map className="h-4 w-4 mr-2" />
                Create Geofence Area
              </Button>
              <Button variant="outline" onClick={refreshGeofenceData}>
                <RotateCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Geofence Rules Table */}
        <Card>
          <CardHeader>
            <CardTitle>Geofence Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedRules.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No geofence rules found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first geofence rule to get started
                </p>
                <Button onClick={() => openModal()}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Geofence Rule
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead className="text-right">Controls</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRules.map((rule) => {
                      const area = geofenceAreas.find(
                        (a) => a.id === rule.area_id
                      );
                      return (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">
                            {rule.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {area?.name || rule.area_id}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                rule.trigger_type === "enter"
                                  ? "default"
                                  : rule.trigger_type === "exit"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {rule.trigger_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={rule.enabled ? "default" : "secondary"}
                            >
                              {rule.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {rule.actions.map((action, idx) => (
                                <div key={idx} className="text-xs">
                                  {action.device_name} Pin {action.pin} →{" "}
                                  {action.action}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openModal(rule)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteRule(rule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * ITEMS_PER_PAGE + 1,
                        filteredRules.length
                      )}{" "}
                      to{" "}
                      {Math.min(
                        currentPage * ITEMS_PER_PAGE,
                        filteredRules.length
                      )}{" "}
                      of {filteredRules.length} results
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
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
                        onClick={() =>
                          setCurrentPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Geofence Rule Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <DialogTitle>
                {isEditing ? "Edit Geofence Rule" : "Create Geofence Rule"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={saveRule} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                Basic Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ruleName">Rule Name *</Label>
                  <Input
                    id="ruleName"
                    value={currentRule.name}
                    onChange={(e) =>
                      setCurrentRule((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Enter rule name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="areaSelect">Geofence Area *</Label>
                  <Select
                    value={currentRule.area_id}
                    onValueChange={(value) =>
                      setCurrentRule((prev) => ({ ...prev, area_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select geofence area" />
                    </SelectTrigger>
                    <SelectContent>
                      {geofenceAreas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name} ({area.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="triggerType">Trigger Type *</Label>
                  <Select
                    value={currentRule.trigger_type}
                    onValueChange={(value) =>
                      setCurrentRule((prev) => ({
                        ...prev,
                        trigger_type: value as any,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enter">On Enter</SelectItem>
                      <SelectItem value="exit">On Exit</SelectItem>
                      <SelectItem value="both">Both Enter & Exit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={currentRule.enabled}
                      onCheckedChange={(checked) =>
                        setCurrentRule((prev) => ({
                          ...prev,
                          enabled: checked,
                        }))
                      }
                    />
                    <Label>
                      {currentRule.enabled ? "Enabled" : "Disabled"}
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground border-b pb-2 flex-1">
                  Actions
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAction}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Action
                </Button>
              </div>

              {currentRule.actions.map((action, actionIndex) => (
                <div
                  key={actionIndex}
                  className="p-4 border rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">Action {actionIndex + 1}</h5>
                    {currentRule.actions.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeAction(actionIndex)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <Label>Device *</Label>
                      <Select
                        value={action.device_name}
                        onValueChange={(value) =>
                          handleDeviceSelection(actionIndex, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select device" />
                        </SelectTrigger>
                        <SelectContent>
                          {modularDevices.map((device) => (
                            <SelectItem
                              key={device.profile.name}
                              value={device.profile.name}
                            >
                              {device.profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Pin *</Label>
                      <Select
                        value={action.pin.toString()}
                        onValueChange={(value) =>
                          updateAction(actionIndex, "pin", parseInt(value))
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
                      <Label>Action *</Label>
                      <Select
                        value={action.action}
                        onValueChange={(value) =>
                          updateAction(actionIndex, "action", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on">Turn ON</SelectItem>
                          <SelectItem value="off">Turn OFF</SelectItem>
                          <SelectItem value="toggle">Toggle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Delay (seconds)</Label>
                      <Input
                        type="number"
                        value={action.delay}
                        onChange={(e) =>
                          updateAction(
                            actionIndex,
                            "delay",
                            parseInt(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        min={0}
                      />
                    </div>

                    <div>
                      <Label>Address</Label>
                      <Input
                        type="number"
                        value={action.address}
                        readOnly
                        className="bg-muted"
                      />
                    </div>

                    <div>
                      <Label>Device Bus</Label>
                      <Input
                        type="number"
                        value={action.device_bus}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">
                {isEditing ? "Update Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Map Modal for Area Creation */}
      <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              <DialogTitle>Create Geofence Area</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex flex-col h-full space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="areaName">Area Name *</Label>
                <Input
                  id="areaName"
                  value={currentArea.name}
                  onChange={(e) =>
                    setCurrentArea((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter area name"
                />
              </div>
              <div>
                <Label htmlFor="areaType">Area Type</Label>
                <Select
                  value={currentArea.type}
                  onValueChange={(value) =>
                    setCurrentArea((prev) => ({ ...prev, type: value as any }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="polygon">Polygon</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="areaDescription">Description</Label>
              <Textarea
                id="areaDescription"
                value={currentArea.description}
                onChange={(e) =>
                  setCurrentArea((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Enter area description"
                rows={2}
              />
            </div>

            <div className="flex-1 min-h-[500px] border rounded-lg overflow-hidden">
              <SimpleGeofenceMap
                onAreaCreated={saveArea}
                currentArea={currentArea}
                existingAreas={geofenceAreas}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMapModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
