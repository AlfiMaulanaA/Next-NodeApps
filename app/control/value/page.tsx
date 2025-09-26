"use client";
import { useEffect, useRef, useState } from "react";
import { connectMQTT } from "@/lib/mqttClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Edit2,
  Trash2,
  CircleCheck,
  CircleX,
  Target,
  Activity,
  Database,
  Settings,
  RotateCw,
  PlusCircle,
  Search,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { useSortableTable } from "@/hooks/use-sort-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import MqttStatus from "@/components/mqtt-status";

// Type definitions - Consistent with AutomationLogic structure
interface TriggerCondition {
  device_name: string;
  device_mac: string;
  device_address: number;
  device_bus: number;
  trigger_type: "drycontact";
  pin_number: number;
  condition_operator: "is" | "and" | "or";
  target_value: boolean;
  expected_value: boolean;
  delay_on?: number;
  delay_off?: number;
}

interface TriggerGroup {
  group_name: string;
  triggers: TriggerCondition[];
  group_operator: "AND" | "OR";
}

interface ControlAction {
  action_type: "control_relay" | "send_message";
  target_device?: string;
  target_mac?: string;
  target_address?: number;
  target_bus?: number;
  relay_pin?: number;
  target_value?: boolean;
  message?: string;
  message_type?: "mqtt" | "whatsapp";
  whatsapp_number?: string;
  whatsapp_name?: string;
  message_template_id?: string;
  channel_integration_id?: string;
  description?: string;
}

interface AutomationValue {
  id: string;
  rule_name: string;
  description: string;
  group_rule_name: string;
  created_at?: string;
  updated_at?: string;
  trigger_groups: TriggerGroup[];
  actions: ControlAction[];
  // Legacy properties for backward compatibility
  name?: string;
  topic?: string;
  config?: {
    key_value: string;
    logic: ">" | "<" | ">=" | "<=" | "==" | "!=";
    value: number;
    auto: boolean;
  };
  relay?: {
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
  const [automationValues, setAutomationValues] = useState<AutomationValue[]>(
    []
  );
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
  const [logicTrigger, setLogicTrigger] = useState<
    ">" | "<" | ">=" | "<=" | "==" | "!="
  >(">");
  const [valueTrigger, setValueTrigger] = useState<number>(0);
  const [autoMode, setAutoMode] = useState(false);
  const [selectedDeviceOutput, setSelectedDeviceOutput] = useState("");
  const [outputPin, setOutputPin] = useState("");
  const [outputLogic, setOutputLogic] = useState(true);

  // Search and pagination
  const { filteredData, searchQuery, setSearchQuery } = useSearchFilter(
    automationValues,
    ["name", "topic"]
  );
  const { sorted, handleSort } = useSortableTable(filteredData);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedData = sorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate summary data
  const totalAutomations = automationValues.length;
  const activeAutomations = automationValues.filter(
    (a) => a.config?.auto
  ).length;
  const triggerDevices = modbusDevices.length;
  const outputDevices = modularDevices.length;

  const summaryItems = [
    { label: "Total Rules", value: totalAutomations, icon: Zap },
    {
      label: "Auto Mode",
      value: activeAutomations,
      icon: Activity,
      variant: "default" as const,
    },
    {
      label: "Triggers",
      value: triggerDevices,
      icon: Database,
      variant: "secondary" as const,
    },
    {
      label: "Outputs",
      value: outputDevices,
      icon: Target,
      variant: "outline" as const,
    },
  ];

  const tableColumns = [
    { key: "name", label: "Name", sortable: true },
    {
      key: "trigger",
      label: "Trigger Device / Topic",
      render: (value: any, item: any) => (
        <div className="flex items-start space-x-2">
          <Zap className="w-4 h-4 text-blue-500 mt-1" />
          <div>
            <div className="font-medium text-sm">{item.name}</div>
            <div className="text-muted-foreground text-xs break-all">
              {item.topic || "N/A"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "rule",
      label: "Trigger Rule",
      className: "text-center",
      render: (value: any, item: any) => (
        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
          {item.config?.key_value || "N/A"} {item.config?.logic || "N/A"}{" "}
          {item.config?.value || "N/A"}
        </span>
      ),
    },
    {
      key: "output",
      label: "Relay Output",
      className: "text-center",
      render: (value: any, item: any) => (
        <div className="flex items-start justify-center space-x-2">
          <Target className="w-4 h-4 text-green-500 mt-1" />
          <div>
            <div className="font-medium text-sm">
              {item.relay?.name || "N/A"}
            </div>
            <div className="text-muted-foreground text-xs">
              Pin: {item.relay?.pin || "N/A"}
            </div>
            <div
              className={`text-sm font-semibold ${
                item.relay?.logic ? "text-green-600" : "text-red-600"
              }`}
            >
              {item.relay?.logic ? "ON" : "OFF"}
            </div>
            {item.relay?.address !== undefined &&
              item.relay?.bus !== undefined && (
                <div className="text-muted-foreground text-xs">
                  Bus: {item.relay.bus}, Addr: {item.relay.address}
                </div>
              )}
          </div>
        </div>
      ),
    },
    {
      key: "auto",
      label: "Auto Mode",
      className: "text-center",
      render: (value: any, item: any) => (
        <div className="flex flex-col items-center space-y-1">
          {item.config?.auto ? (
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
      ),
    },
  ];

  const tableActions = [
    { icon: Edit2, label: "Edit", onClick: (item: any) => openModal(item) },
    {
      icon: Trash2,
      label: "Delete",
      variant: "destructive" as const,
      onClick: (item: any) => remove(item),
    },
  ];

  // Modal functions
  const openModal = (item?: AutomationValue) => {
    if (item) {
      setEditing(item);
      setAutomationName(item.name || "");
      setSelectedTopicTrigger(item.topic || "");
      setSelectedVarTrigger(item.config?.key_value || "");
      setLogicTrigger(item.config?.logic || ">");
      setValueTrigger(item.config?.value || 0);
      setAutoMode(item.config?.auto || false);
      setSelectedDeviceOutput(item.relay?.name || "");
      setOutputPin(item.relay?.pin?.toString() || "");
      setOutputLogic(item.relay?.logic || true);

      // Find and set the trigger device based on topic
      const triggerDevice = modbusDevices.find(
        (d) => d.profile.topic === item.topic
      );
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
    const device = modbusDevices.find(
      (d) => d.profile.name === selectedDeviceTrigger
    );
    if (device) {
      setSelectedTopicTrigger(device.profile.topic);
    }
  }, [selectedDeviceTrigger, modbusDevices]);

  const save = () => {
    if (!automationName.trim()) {
      toast.error("Automation name is required");
      return;
    }

    if (
      !selectedDeviceTrigger ||
      !selectedVarTrigger ||
      !selectedDeviceOutput ||
      !outputPin
    ) {
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
        auto: autoMode,
      },
      relay: {
        name: selectedDeviceOutput,
        pin: parseInt(outputPin),
        logic: outputLogic,
      },
    };

    try {
      // Use simplified topic with action in payload
      const action = editing ? "set" : "add";
      const message = {
        action: action,
        data: automationData,
      };

      mqttClient?.publish("command_control_value", JSON.stringify(message));

      toast.success(
        editing
          ? "Automation updated successfully"
          : "Automation created successfully"
      );
      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving automation:", error);
      toast.error("Failed to save automation");
    }
  };

  const remove = (item: AutomationValue) => {
    try {
      // Use simplified topic with action in payload
      const message = {
        action: "delete",
        data: { id: item.id || item.name, name: item.name },
      };

      mqttClient?.publish("command_control_value", JSON.stringify(message));
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
        client.on("message", (topic: string, message: Buffer) => {
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
          <Button variant="outline" size="icon" className="h-8 w-8">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => openModal()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Automation
          </Button>
        </div>
      </header>

      <div className="px-4 py-2 border-b">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search automation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Summary Cards - Modern Design */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <CardTitle>Automation Values Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl border">
                <Zap className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {totalAutomations}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  Automation Rules
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl border">
                <Activity className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {activeAutomations}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Active Rules
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-xl border">
                <Database className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {triggerDevices}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">
                  Trigger Devices
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 rounded-xl border">
                <Target className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {outputDevices}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Output Devices
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Automation Rules Table - Simplified */}
        <div className="rounded-lg border bg-background shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">
              Automation Rules ({automationValues.length})
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your automation rules and monitor their status
            </p>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No automation rules found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first automation rule to get started
                </p>
                <Button onClick={() => openModal()}>Add Automation</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-4 text-left font-medium">#</th>
                      <th className="p-4 text-left font-medium">Name</th>
                      <th className="p-4 text-left font-medium">Trigger</th>
                      <th className="p-4 text-center font-medium">Rule</th>
                      <th className="p-4 text-center font-medium">Output</th>
                      <th className="p-4 text-center font-medium">Auto</th>
                      <th className="p-4 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4 text-center font-medium text-muted-foreground">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td className="p-4 font-medium">{item.name}</td>
                        <td className="p-4">
                          <div className="text-sm">{item.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-32">
                            {item.topic || "N/A"}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {item.config?.key_value || "N/A"}{" "}
                            {item.config?.logic || "N/A"}{" "}
                            {item.config?.value || "N/A"}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <div className="text-sm font-medium">
                            {item.relay?.name || "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Pin: {item.relay?.pin || "N/A"}
                          </div>
                          <Badge
                            variant={
                              item.relay?.logic ? "default" : "destructive"
                            }
                            className="text-xs"
                          >
                            {item.relay?.logic ? "ON" : "OFF"}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          {item.config?.auto ? (
                            <Badge variant="default" className="text-xs">
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              No
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openModal(item)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => remove(item)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Automation Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>
                {editing ? "Edit Automation Rule" : "Add New Automation Rule"}
              </span>
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
                    <Label htmlFor="automation-name">
                      Automation Rule Name *
                    </Label>
                    <Input
                      id="automation-name"
                      value={automationName}
                      onChange={(e) => setAutomationName(e.target.value)}
                      placeholder="e.g., Living Room Light Automation"
                      readOnly={!!editing}
                      className={editing ? "bg-muted" : ""}
                    />
                    {editing && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Rule name cannot be changed
                      </p>
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
                    <Select
                      value={selectedDeviceTrigger}
                      onValueChange={setSelectedDeviceTrigger}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device to monitor" />
                      </SelectTrigger>
                      <SelectContent>
                        {modbusDevices.map((device) => (
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
                    <Label htmlFor="trigger-topic">Trigger Topic</Label>
                    <Input
                      id="trigger-topic"
                      value={selectedTopicTrigger}
                      placeholder="Auto-filled from selected device"
                      readOnly
                      className="bg-muted"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Topic is automatically filled based on selected device
                    </p>
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
                    <Select
                      value={logicTrigger}
                      onValueChange={(value) => setLogicTrigger(value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select comparison logic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">"> &gt; (Greater than)</SelectItem>
                        <SelectItem value="<"> &lt; (Less than)</SelectItem>
                        <SelectItem value=">=">
                          {" "}
                          &gt;= (Greater or equal)
                        </SelectItem>
                        <SelectItem value="<=">
                          {" "}
                          &lt;= (Less or equal)
                        </SelectItem>
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
                      onCheckedChange={(checked) =>
                        setAutoMode(checked === true)
                      }
                    />
                    <Label htmlFor="auto-mode">Enable Automatic Mode</Label>
                  </div>
                </div>
                <Alert className="mt-4">
                  <AlertDescription>
                    When enabled, the relay will be controlled automatically
                    when conditions are met
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
                    <Select
                      value={selectedDeviceOutput}
                      onValueChange={setSelectedDeviceOutput}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select relay device" />
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
                    <Label htmlFor="relay-pin">Relay Pin *</Label>
                    <Input
                      id="relay-pin"
                      value={outputPin}
                      onChange={(e) => setOutputPin(e.target.value)}
                      placeholder="e.g., 1, 2, 3"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Pin number on the relay device
                    </p>
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="output-logic">Output Logic *</Label>
                    <Select
                      value={outputLogic ? "true" : "false"}
                      onValueChange={(v) => setOutputLogic(v === "true")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Set output logic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">
                          ON (True) - Activate relay
                        </SelectItem>
                        <SelectItem value="false">
                          OFF (False) - Deactivate relay
                        </SelectItem>
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
              {loading
                ? "Saving..."
                : editing
                ? "Update Automation"
                : "Create Automation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
