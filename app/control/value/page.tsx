"use client";
import { useEffect, useRef, useState } from "react";
import { connectMQTT } from "@/lib/mqttClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Zap, Edit2, Trash2, CircleCheck, CircleX, Target, Activity, Database, Settings, RotateCw, PlusCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { useSortableTable } from "@/hooks/use-sort-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import MqttStatus from "@/components/mqtt-status";

// Type definitions
interface AutomationValue {
  name: string;
  topic: string;
  config: {
    key_value: string;
    logic: ">" | "<" | ">=" | "<=" | "==" | "!=";
    value: number;
    auto: boolean;
  };
  relay: {
    name: string;
    pin: number;
    logic: boolean;
    address?: number;
    bus?: number;
  };
}

interface ModbusDevice {
  profile: {
    name: string;
    topic: string;
  };
}

interface ModularDevice {
  profile: {
    name: string;
  };
}

const ITEMS_PER_PAGE = 10;

export default function AutomationValuePage() {
  const [automationValues, setAutomationValues] = useState<AutomationValue[]>([]);
  const [modbusDevices, setModbusDevices] = useState<ModbusDevice[]>([]);
  const [modularDevices, setModularDevices] = useState<ModularDevice[]>([]);
  
  // Modal and editing states
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [mqttClient, setMqttClient] = useState<any>(null);
  
  // Form states
  const [automationName, setAutomationName] = useState("");
  const [selectedDeviceTrigger, setSelectedDeviceTrigger] = useState("");
  const [selectedTopicTrigger, setSelectedTopicTrigger] = useState("");
  const [selectedVarTrigger, setSelectedVarTrigger] = useState("");
  const [logicTrigger, setLogicTrigger] = useState<">" | "<" | ">=" | "<=" | "==" | "!=">(">");
  const [valueTrigger, setValueTrigger] = useState<number>(0);
  const [autoMode, setAutoMode] = useState(false);
  const [selectedDeviceOutput, setSelectedDeviceOutput] = useState("");
  const [outputPin, setOutputPin] = useState("");
  const [outputLogic, setOutputLogic] = useState(true);

  // Search and pagination
  const { filteredData, searchQuery, setSearchQuery } = useSearchFilter(automationValues, ["name", "topic"]);
  const { sorted, handleSort } = useSortableTable(filteredData);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedData = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Calculate summary data
  const totalAutomations = automationValues.length;
  const activeAutomations = automationValues.filter(a => a.config.auto).length;
  const triggerDevices = modbusDevices.length;
  const outputDevices = modularDevices.length;

  const summaryItems = [
    { label: "Total Rules", value: totalAutomations, icon: Zap },
    { label: "Auto Mode", value: activeAutomations, icon: Activity, variant: "default" as const },
    { label: "Triggers", value: triggerDevices, icon: Database, variant: "secondary" as const },
    { label: "Outputs", value: outputDevices, icon: Target, variant: "outline" as const }
  ];

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'trigger', label: 'Trigger Device / Topic', render: (value: any, item: any) => (
      <div className="flex items-start space-x-2">
        <Zap className="w-4 h-4 text-blue-500 mt-1" />
        <div>
          <div className="font-medium text-sm">{item.name}</div>
          <div className="text-muted-foreground text-xs break-all">{item.topic || "N/A"}</div>
        </div>
      </div>
    )},
    { key: 'rule', label: 'Trigger Rule', className: 'text-center', render: (value: any, item: any) => (
      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
        {item.config.key_value} {item.config.logic} {item.config.value}
      </span>
    )},
    { key: 'output', label: 'Relay Output', className: 'text-center', render: (value: any, item: any) => (
      <div className="flex items-start justify-center space-x-2">
        <Target className="w-4 h-4 text-green-500 mt-1" />
        <div>
          <div className="font-medium text-sm">{item.relay.name}</div>
          <div className="text-muted-foreground text-xs">Pin: {item.relay.pin}</div>
          <div className={`text-sm font-semibold ${item.relay.logic ? "text-green-600" : "text-red-600"}`}>
            {item.relay.logic ? "ON" : "OFF"}
          </div>
          {(item.relay.address !== undefined && item.relay.bus !== undefined) && (
            <div className="text-muted-foreground text-xs">Bus: {item.relay.bus}, Addr: {item.relay.address}</div>
          )}
        </div>
      </div>
    )},
    { key: 'auto', label: 'Auto Mode', className: 'text-center', render: (value: any, item: any) => (
      <div className="flex flex-col items-center space-y-1">
        {item.config.auto ? (
          <>
            <CircleCheck className="w-5 h-5 text-green-600" />
            <span className="text-xs text-muted-foreground">Yes</span>
          </>
        ) : (
          <>
            <CircleX className="w-5 h-5 text-red-600" />
            <span className="text-xs text-muted-foreground">No</span>
          </>
        )}
      </div>
    )}
  ];

  const tableActions = [
    { icon: Edit2, label: 'Edit', onClick: (item: any) => openModal(item) },
    { icon: Trash2, label: 'Delete', variant: 'destructive' as const, onClick: (item: any) => remove(item) }
  ];

  // Modal functions
  const openModal = (item?: AutomationValue) => {
    if (item) {
      setEditing(item);
      setAutomationName(item.name);
      setSelectedTopicTrigger(item.topic);
      setSelectedVarTrigger(item.config.key_value);
      setLogicTrigger(item.config.logic);
      setValueTrigger(item.config.value);
      setAutoMode(item.config.auto);
      setSelectedDeviceOutput(item.relay.name);
      setOutputPin(item.relay.pin.toString());
      setOutputLogic(item.relay.logic);
      
      // Find and set the trigger device based on topic
      const triggerDevice = modbusDevices.find(d => d.profile.topic === item.topic);
      if (triggerDevice) {
        setSelectedDeviceTrigger(triggerDevice.profile.name);
      }
    } else {
      resetForm();
    }
    setModalOpen(true);
  };
  
  // Update topic when device changes
  useEffect(() => {
    const device = modbusDevices.find(d => d.profile.name === selectedDeviceTrigger);
    if (device) {
      setSelectedTopicTrigger(device.profile.topic);
    }
  }, [selectedDeviceTrigger, modbusDevices]);

  const save = () => {
    if (!automationName.trim()) {
      toast.error("Automation name is required");
      return;
    }
    
    if (!selectedDeviceTrigger || !selectedVarTrigger || !selectedDeviceOutput || !outputPin) {
      toast.error("Please fill all required fields");
      return;
    }
    
    const automationData = {
      name: automationName,
      topic: selectedTopicTrigger,
      config: {
        key_value: selectedVarTrigger,
        logic: logicTrigger,
        value: valueTrigger,
        auto: autoMode
      },
      relay: {
        name: selectedDeviceOutput,
        pin: parseInt(outputPin),
        logic: outputLogic
      }
    };
    
    try {
      const topic = editing ? "automation_value/update" : "automation_value/create";
      mqttClient?.publish(topic, JSON.stringify(automationData));
      
      toast.success(editing ? "Automation updated successfully" : "Automation created successfully");
      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving automation:", error);
      toast.error("Failed to save automation");
    }
  };

  const remove = (item: AutomationValue) => {
    try {
      mqttClient?.publish("automation_value/delete", JSON.stringify({ name: item.name }));
      toast.success("Automation deleted successfully");
    } catch (error) {
      console.error("Error deleting automation:", error);
      toast.error("Failed to delete automation");
    }
  };
  
  const resetForm = () => {
    setAutomationName("");
    setSelectedDeviceTrigger("");
    setSelectedTopicTrigger("");
    setSelectedVarTrigger("");
    setLogicTrigger(">");
    setValueTrigger(0);
    setAutoMode(false);
    setSelectedDeviceOutput("");
    setOutputPin("");
    setOutputLogic(true);
    setEditing(null);
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Connect to MQTT
        const client = connectMQTT();
        setMqttClient(client);
        
        // Subscribe to automation data topic
        client.subscribe("automation_value/data");
        client.subscribe("modbus_value/data");
        client.subscribe("modular_value/data");
        
        // Set up message handler
        client.on('message', (topic: string, message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            
            if (topic === "automation_value/data") {
              setAutomationValues(data);
            } else if (topic === "modbus_value/data") {
              setModbusDevices(data);
            } else if (topic === "modular_value/data") {
              setModularDevices(data);
            }
          } catch (error) {
            console.error(`Error parsing ${topic} data:`, error);
            if (topic === "automation_value/data") {
              toast.error("Failed to parse automation data");
            }
          }
        });
        
        toast.success("Connected to automation system");
      } catch (error) {
        console.error("Error connecting to MQTT:", error);
        toast.error("Failed to connect to automation system");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      if (mqttClient) {
        mqttClient.end();
      }
    };
  }, []);

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Zap className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Automation Values</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Automation
          </Button>
        </div>
      </header>
      
      {/* Search Bar */}
      <div className="px-4 py-2 border-b">
        <Input
          placeholder="Search automation by name or topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary Cards */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <CardTitle>Automation Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {summaryItems.map((item, index) => (
                <div
                  key={index}
                  className="text-center p-4 bg-muted/50 rounded-lg"
                >
                  <item.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold">{item.value}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.label}
                  </div>
                  {item.variant && (
                    <Badge variant={item.variant} className="mt-1">
                      {item.label}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Automation Rules Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Automation Rules</span>
            </CardTitle>
            <CardDescription>
              Manage your automation rules and monitor their status
            </CardDescription>
          </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : paginatedData.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No automation rules found</h3>
                  <p className="text-muted-foreground mb-4">Create your first automation rule to get started</p>
                  <Button onClick={() => openModal()}>Add Automation</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Trigger Device / Topic</TableHead>
                      <TableHead className="text-center">Trigger Rule</TableHead>
                      <TableHead className="text-center">Relay Output</TableHead>
                      <TableHead className="text-center">Auto Mode</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <div className="flex items-start space-x-2">
                            <Zap className="w-4 h-4 text-blue-500 mt-1" />
                            <div>
                              <div className="font-medium text-sm">{item.name}</div>
                              <div className="text-muted-foreground text-xs break-all">{item.topic || "N/A"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-xs">
                            {item.config.key_value} {item.config.logic} {item.config.value}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-start justify-center space-x-2">
                            <Target className="w-4 h-4 text-green-500 mt-1" />
                            <div>
                              <div className="font-medium text-sm">{item.relay.name}</div>
                              <div className="text-muted-foreground text-xs">Pin: {item.relay.pin}</div>
                              <Badge variant={item.relay.logic ? "default" : "destructive"} className="text-xs">
                                {item.relay.logic ? "ON" : "OFF"}
                              </Badge>
                              {(item.relay.address !== undefined && item.relay.bus !== undefined) && (
                                <div className="text-muted-foreground text-xs">Bus: {item.relay.bus}, Addr: {item.relay.address}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center space-y-1">
                            {item.config.auto ? (
                              <>
                                <CircleCheck className="w-5 h-5 text-green-600" />
                                <span className="text-xs text-muted-foreground">Yes</span>
                              </>
                            ) : (
                              <>
                                <CircleX className="w-5 h-5 text-red-600" />
                                <span className="text-xs text-muted-foreground">No</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center space-x-2">
                            <Button size="sm" variant="outline" onClick={() => openModal(item)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => remove(item)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Automation Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>{editing ? "Edit Automation Rule" : "Add New Automation Rule"}</span>
            </DialogTitle>
            <DialogDescription>
              Configure automation trigger conditions and relay outputs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Automation Rule Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Zap className="w-5 h-5" />
                  <span>Automation Rule</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="automation-name">Automation Rule Name *</Label>
                    <Input
                      id="automation-name"
                      value={automationName}
                      onChange={(e) => setAutomationName(e.target.value)}
                      placeholder="e.g., Living Room Light Automation"
                      readOnly={!!editing}
                      className={editing ? "bg-muted" : ""}
                    />
                    {editing && (
                      <p className="text-sm text-muted-foreground mt-1">Rule name cannot be changed</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trigger Configuration Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Database className="w-5 h-5" />
                  <span>Trigger Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="trigger-device">Trigger Device *</Label>
                    <Select value={selectedDeviceTrigger} onValueChange={setSelectedDeviceTrigger}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select device to monitor" />
                      </SelectTrigger>
                      <SelectContent>
                        {modbusDevices.map((device) => (
                          <SelectItem key={device.profile.name} value={device.profile.name}>
                            {device.profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="trigger-topic">Trigger Topic</Label>
                    <Input
                      id="trigger-topic"
                      value={selectedTopicTrigger}
                      placeholder="Auto-filled from selected device"
                      readOnly
                      className="bg-muted"
                    />
                    <p className="text-sm text-muted-foreground mt-1">Topic is automatically filled based on selected device</p>
                  </div>
                  
                  <div>
                    <Label htmlFor="variable">Variable (Key Value) *</Label>
                    <Input
                      id="variable"
                      value={selectedVarTrigger}
                      onChange={(e) => setSelectedVarTrigger(e.target.value)}
                      placeholder="e.g., temperature, humidity"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="logic-operator">Logic Operator *</Label>
                    <Select value={logicTrigger} onValueChange={(value) => setLogicTrigger(value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select comparison logic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">"> &gt; (Greater than)</SelectItem>
                        <SelectItem value="<"> &lt; (Less than)</SelectItem>
                        <SelectItem value=">="> &gt;= (Greater or equal)</SelectItem>
                        <SelectItem value="<="> &lt;= (Less or equal)</SelectItem>
                        <SelectItem value="=="> == (Equal to)</SelectItem>
                        <SelectItem value="!="> != (Not equal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="trigger-value">Trigger Value *</Label>
                    <Input
                      id="trigger-value"
                      type="number"
                      value={valueTrigger.toString()}
                      onChange={(e) => setValueTrigger(Number(e.target.value))}
                      placeholder="e.g., 25"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-mode"
                      checked={autoMode}
                      onCheckedChange={(checked) => setAutoMode(checked === true)}
                    />
                    <Label htmlFor="auto-mode">Enable Automatic Mode</Label>
                  </div>
                </div>
                <Alert className="mt-4">
                  <AlertDescription>
                    When enabled, the relay will be controlled automatically when conditions are met
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Relay Output Configuration Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Target className="w-5 h-5" />
                  <span>Relay Output Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="relay-device">Relay Device *</Label>
                    <Select value={selectedDeviceOutput} onValueChange={setSelectedDeviceOutput}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relay device" />
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
                    <Label htmlFor="relay-pin">Relay Pin *</Label>
                    <Input
                      id="relay-pin"
                      value={outputPin}
                      onChange={(e) => setOutputPin(e.target.value)}
                      placeholder="e.g., 1, 2, 3"
                    />
                    <p className="text-sm text-muted-foreground mt-1">Pin number on the relay device</p>
                  </div>
                  
                  <div className="col-span-2">
                    <Label htmlFor="output-logic">Output Logic *</Label>
                    <Select value={outputLogic ? "true" : "false"} onValueChange={(v) => setOutputLogic(v === "true")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Set output logic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">ON (True) - Activate relay</SelectItem>
                        <SelectItem value="false">OFF (False) - Deactivate relay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={loading}>
              {loading ? "Saving..." : editing ? "Update Automation" : "Create Automation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}