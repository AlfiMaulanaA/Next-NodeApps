"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { connectMQTT, getMQTTClient, disconnectMQTT } from "@/lib/mqttClient";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RotateCw,
  Zap,
  PlusCircle,
  Trash2,
  Edit2,
  Play,
  Pause,
  Settings2,
  AlertTriangle,
  TrendingUp,
  Activity,
  Code,
  Eye,
  Calendar,
  MessageSquare,
  Power,
  Gauge,
} from "lucide-react";
import MqttStatus from "@/components/mqtt-status";

// Type definitions for AutomationValue
interface TriggerCondition {
  device_name: string;
  device_topic?: string; // MQTT topic for device data
  trigger_type: "numeric";
  field_name: string; // Dynamic field from devices.json
  condition_operator:
    | "equals"
    | "greater_than"
    | "less_than"
    | "greater_equal"
    | "less_equal"
    | "not_equals"
    | "between";
  target_value: number | number[]; // Single value or range [min, max] for "between"
  delay_on?: number; // delay in seconds before trigger activates
  delay_off?: number; // delay in seconds before trigger deactivates
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

interface AutomationValueRule {
  id: string;
  rule_name: string;
  description: string;
  group_rule_name: string;
  created_at?: string;
  updated_at?: string;
  trigger_groups: TriggerGroup[];
  actions: ControlAction[];
}

interface AutomationValueConfig {
  value_rules: AutomationValueRule[];
}

interface ModbusDevice {
  id?: string;
  name: string;
  ip_address?: string;
  port?: string | number;
  part_number: string;
  mac: string;
  device_type: string;
  manufacturer: string;
  topic?: string;
  protocol?: string;
}

interface ModularDevice {
  id?: string;
  name: string;
  address: number;
  device_bus: number;
  part_number: string;
  mac: string;
  device_type: string;
  manufacturer: string;
  topic?: string;
}

interface DeviceField {
  var_name: string;
  relative_address: number;
  register_type: string;
  word_length: number;
  data_type: string;
  multiplier: number;
}

interface DeviceProfile {
  manufacturer: string;
  part_number: string;
  protocol: string;
  data: DeviceField[];
  uom?: string;
}

interface MQTTResponse {
  status: "success" | "error";
  message: string;
  data?: any;
  id?: string;
  count?: number;
  timestamp?: string;
}

const AutomationValueControl = () => {
  // MQTT Topics - simplified for new middleware
  const TOPICS = useMemo(
    () => ({
      // Unified Command Topic
      COMMAND: "command_control_value",

      // Unified Response Topic
      RESPONSE: "response_control_value",

      // Device Topics
      MODBUS_AVAILABLES: "MODBUS_DEVICE/AVAILABLES",
      MODULAR_AVAILABLES: "MODULAR_DEVICE/AVAILABLES",
      RESULT_MESSAGE: "result/message/value/control",
    }),
    []
  );

  // Connection Status
  const [mqttConnectionStatus, setMqttConnectionStatus] =
    useState("Disconnected");

  // Data States
  const [automationConfig, setAutomationConfig] =
    useState<AutomationValueConfig>({
      value_rules: [],
    });
  const [modbusDevices, setModbusDevices] = useState<ModbusDevice[]>([]);
  const [modularDevices, setModularDevices] = useState<ModularDevice[]>([]);
  const [deviceProfiles, setDeviceProfiles] = useState<
    Record<string, DeviceProfile>
  >({});
  const [loading, setLoading] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationValueRule | null>(
    null
  );

  // Alert and Confirmation Dialog States
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertDialogContent, setAlertDialogContent] = useState<{
    title: string;
    description: string;
  }>({ title: "", description: "" });

  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [confirmationDialogContent, setConfirmationDialogContent] = useState<{
    title: string;
    description: string;
    confirmAction: () => void;
  }>({ title: "", description: "", confirmAction: () => {} });

  // Form States
  const [currentRule, setCurrentRule] = useState<AutomationValueRule>({
    id: "",
    rule_name: "",
    description: "",
    group_rule_name: "",
    trigger_groups: [],
    actions: [],
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Available condition operators for numeric values
  const conditionOperators = [
    { value: "equals", label: "Equals (=)" },
    { value: "greater_than", label: "Greater Than (>)" },
    { value: "less_than", label: "Less Than (<)" },
    { value: "greater_equal", label: "Greater or Equal (≥)" },
    { value: "less_equal", label: "Less or Equal (≤)" },
    { value: "not_equals", label: "Not Equal (≠)" },
    { value: "between", label: "Between (Range)" },
  ];

  // Function to get relay pins based on device PART_NUMBER
  const getRelayPinsForDevice = useCallback(
    (deviceName: string) => {
      // Check both MODBUS and Modular devices
      const modbusDevice = modbusDevices.find(
        (device) => device.name === deviceName
      );
      const modularDevice = modularDevices.find(
        (device) => device.name === deviceName
      );
      const selectedDevice = modbusDevice || modularDevice;

      if (!selectedDevice) return [];

      const totalPins =
        selectedDevice.part_number === "RELAY"
          ? 8
          : selectedDevice.part_number === "RELAYMINI"
          ? 6
          : 8; // Default to 8 pins

      return Array.from({ length: totalPins }, (_, i) => ({
        value: i + 1,
        label: `Relay Pin ${i + 1}`,
      }));
    },
    [modbusDevices, modularDevices]
  );

  // Load devices.json on mount
  useEffect(() => {
    const loadDeviceProfiles = async () => {
      try {
        setLoadingDevices(true);
        const response = await fetch("/files/devices.json");
        if (!response.ok) {
          throw new Error("Failed to load device profiles");
        }
        const data = await response.json();
        setDeviceProfiles(data);
        console.log(
          "Device profiles loaded:",
          Object.keys(data).length,
          "categories"
        );
      } catch (error) {
        console.error("Error loading device profiles:", error);
        toast.error("Failed to load device profiles from devices.json");
      } finally {
        setLoadingDevices(false);
      }
    };

    loadDeviceProfiles();
  }, []);

  // Get available fields for a selected device
  const getDeviceFields = useCallback(
    (device: ModbusDevice | ModularDevice | null): DeviceField[] => {
      if (!device) return [];

      // Search through all device types in deviceProfiles
      for (const deviceType in deviceProfiles) {
        const profiles = deviceProfiles[deviceType];
        if (Array.isArray(profiles)) {
          const profile = profiles.find(
            (p: DeviceProfile) =>
              p.manufacturer === device.manufacturer &&
              p.part_number === device.part_number
          );
          if (profile && profile.data) {
            return profile.data;
          }
        }
      }

      return [];
    },
    [deviceProfiles]
  );

  // MQTT Publishing Function
  const publishMQTT = useCallback((topic: string, message: any) => {
    const client = getMQTTClient();
    if (client && client.connected) {
      const payload =
        typeof message === "string" ? message : JSON.stringify(message);
      client.publish(topic, payload);
      console.log(`Published to ${topic}:`, payload);
    } else {
      console.error("MQTT client not connected for publishing.");
      toast.error("Cannot send command, MQTT client is not connected.");
    }
  }, []);

  // CRUD Operations matching new simplified backend
  const createRule = useCallback(
    (rule: AutomationValueRule) => {
      setLoading(true);
      const ruleData = {
        ...rule,
        id: uuidv4(),
        created_at: new Date().toISOString(),
      };
      publishMQTT(TOPICS.COMMAND, { command: "add", data: ruleData });
    },
    [publishMQTT, TOPICS.COMMAND]
  );

  const updateRule = useCallback(
    (rule: AutomationValueRule) => {
      setLoading(true);
      const ruleData = {
        ...rule,
        updated_at: new Date().toISOString(),
      };
      publishMQTT(TOPICS.COMMAND, { command: "set", data: ruleData });
    },
    [publishMQTT, TOPICS.COMMAND]
  );

  const deleteRule = useCallback(
    (ruleId: string) => {
      setLoading(true);
      publishMQTT(TOPICS.COMMAND, { command: "delete", data: { id: ruleId } });
    },
    [publishMQTT, TOPICS.COMMAND]
  );

  const refreshData = useCallback(() => {
    setLoading(true);
    publishMQTT(TOPICS.COMMAND, { command: "get" });
  }, [publishMQTT, TOPICS.COMMAND]);

  // Load devices from MODBUS_DEVICE/AVAILABLES and MODULAR_DEVICE/AVAILABLES
  const loadModbusDevices = useCallback(() => {
    publishMQTT("command_available_device", "get_modbus_devices");
  }, [publishMQTT]);

  const loadModularDevices = useCallback(() => {
    publishMQTT("command_available_device", "get_modular_devices");
  }, [publishMQTT]);

  // MQTT Connection and Message Handling
  useEffect(() => {
    let currentClient: any = null;

    if (typeof window !== "undefined") {
      try {
        currentClient = connectMQTT();

        currentClient.on("connect", () => {
          console.log("Connected to MQTT Broker");
          setMqttConnectionStatus("Connected");

          // Subscribe to all required topics
          currentClient.subscribe([
            TOPICS.RESPONSE,
            TOPICS.MODBUS_AVAILABLES,
            TOPICS.MODULAR_AVAILABLES,
          ]);

          console.log("Subscribed to automation value topics");

          // Load initial data
          setTimeout(() => {
            refreshData();
            loadModbusDevices();
            loadModularDevices();
          }, 1000);
        });

        currentClient.on("error", (err: Error) => {
          console.error("MQTT Error:", err.message);
          setMqttConnectionStatus("Error: " + err.message);
        });

        currentClient.on("close", () => {
          console.log("MQTT Connection closed");
          setMqttConnectionStatus("Disconnected");
        });

        currentClient.on("message", (topic: string, message: Buffer) => {
          console.log("Message arrived:", topic, message.toString());
          try {
            const payload: MQTTResponse = JSON.parse(message.toString());

            switch (topic) {
              case TOPICS.RESPONSE:
                // Handle both CRUD responses and data responses
                if (payload.data && Array.isArray(payload.data)) {
                  // This is a data response (get operation)
                  setAutomationConfig({ value_rules: payload.data });
                  console.log("Automation config loaded:", payload.data);
                  setLoading(false);
                } else {
                  // This is a CRUD response
                  handleCRUDResponse(payload);
                }
                break;

              case TOPICS.MODBUS_AVAILABLES:
                if (payload.status === "success" && payload.data) {
                  setModbusDevices(payload.data);
                  console.log("MODBUS devices loaded:", payload.data.length);
                } else {
                  // Try parsing as direct array if no status wrapper
                  try {
                    const devices = JSON.parse(message.toString());
                    if (Array.isArray(devices)) {
                      setModbusDevices(devices);
                      console.log(
                        "MODBUS devices loaded (direct):",
                        devices.length
                      );
                    }
                  } catch (e) {
                    console.error("Error parsing MODBUS devices:", e);
                  }
                }
                break;

              case TOPICS.MODULAR_AVAILABLES:
                if (payload.status === "success" && payload.data) {
                  setModularDevices(payload.data);
                  console.log("Modular devices loaded:", payload.data.length);
                } else {
                  // Try parsing as direct array if no status wrapper
                  try {
                    const devices = JSON.parse(message.toString());
                    if (Array.isArray(devices)) {
                      setModularDevices(devices);
                      console.log(
                        "Modular devices loaded (direct):",
                        devices.length
                      );
                    }
                  } catch (e) {
                    console.error("Error parsing modular devices:", e);
                  }
                }
                break;

              default:
                console.log("Unhandled topic:", topic);
            }
          } catch (error) {
            console.error("Error parsing MQTT message:", error);
            setLoading(false);
            toast.error("An error occurred while processing the response.");
          }
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error connecting MQTT:", errorMessage);
        setMqttConnectionStatus("Connection failed: " + errorMessage);
      }
    }

    return () => {
      if (currentClient) {
        currentClient.removeAllListeners("connect");
        currentClient.removeAllListeners("error");
        currentClient.removeAllListeners("close");
        currentClient.removeAllListeners("message");
      }
    };
  }, [TOPICS, refreshData, loadModbusDevices, loadModularDevices]);

  // Handle CRUD Response
  const handleCRUDResponse = (payload: MQTTResponse) => {
    setLoading(false);

    if (payload.status === "success") {
      toast.success(payload.message);

      // Refresh data after successful operation
      setTimeout(() => {
        refreshData();
      }, 500);

      // Close modal if open
      if (isModalOpen) {
        closeModal();
      }
    } else {
      toast.error(payload.message || "An error occurred");
    }
  };

  // Modal Functions
  const openModal = (rule?: AutomationValueRule) => {
    if (rule) {
      setIsEditing(true);
      setSelectedRuleId(rule.id);
      setCurrentRule({ ...rule });
    } else {
      setIsEditing(false);
      setSelectedRuleId(null);
      setCurrentRule({
        id: "",
        rule_name: "",
        description: "",
        group_rule_name: "",
        trigger_groups: [
          {
            group_name: "Trigger Group 1",
            group_operator: "AND",
            triggers: [
              {
                device_name: "",
                device_topic: "",
                trigger_type: "numeric",
                field_name: "",
                condition_operator: "greater_than",
                target_value: 0,
                delay_on: 0,
                delay_off: 0,
              },
            ],
          },
        ],
        actions: [
          {
            action_type: "control_relay",
            target_device: "",
            target_mac: "",
            target_address: 0,
            target_bus: 0,
            relay_pin: 1,
            target_value: true,
          },
        ],
      });
    }
    setIsModalOpen(true);
  };

  const openDetailDialog = (rule: AutomationValueRule) => {
    setSelectedRule(rule);
    setIsDetailDialogOpen(true);
  };

  const closeDetailDialog = () => {
    setSelectedRule(null);
    setIsDetailDialogOpen(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setSelectedRuleId(null);
    setCurrentRule({
      id: "",
      rule_name: "",
      description: "",
      group_rule_name: "",
      trigger_groups: [],
      actions: [],
    });
  };

  // Save Functions
  const saveRule = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!currentRule.rule_name.trim()) {
      setAlertDialogContent({
        title: "Validation Error",
        description: "Please enter a rule name.",
      });
      setAlertDialogOpen(true);
      return;
    }

    if (!currentRule.group_rule_name.trim()) {
      setAlertDialogContent({
        title: "Validation Error",
        description: "Please enter a group rule name.",
      });
      setAlertDialogOpen(true);
      return;
    }

    if (currentRule.trigger_groups.length === 0) {
      setAlertDialogContent({
        title: "Validation Error",
        description: "Please add at least one trigger group.",
      });
      setAlertDialogOpen(true);
      return;
    }

    if (currentRule.actions.length === 0) {
      setAlertDialogContent({
        title: "Validation Error",
        description: "Please add at least one action.",
      });
      setAlertDialogOpen(true);
      return;
    }

    // Validate trigger groups
    for (const group of currentRule.trigger_groups) {
      if (group.triggers.length === 0) {
        setAlertDialogContent({
          title: "Validation Error",
          description: `Trigger group "${group.group_name}" must have at least one trigger.`,
        });
        setAlertDialogOpen(true);
        return;
      }

      for (const trigger of group.triggers) {
        if (!trigger.device_name) {
          setAlertDialogContent({
            title: "Validation Error",
            description: "All triggers must have a device name.",
          });
          setAlertDialogOpen(true);
          return;
        }

        if (!trigger.field_name) {
          setAlertDialogContent({
            title: "Validation Error",
            description: "All triggers must have a field name selected.",
          });
          setAlertDialogOpen(true);
          return;
        }

        // Validate "between" operator has array with 2 values
        if (trigger.condition_operator === "between") {
          if (
            !Array.isArray(trigger.target_value) ||
            trigger.target_value.length !== 2
          ) {
            setAlertDialogContent({
              title: "Validation Error",
              description:
                "Between operator requires both minimum and maximum values.",
            });
            setAlertDialogOpen(true);
            return;
          }
        }
      }
    }

    // Save rule
    if (isEditing) {
      updateRule(currentRule);
    } else {
      createRule(currentRule);
    }
  };

  const confirmDelete = (rule: AutomationValueRule) => {
    setConfirmationDialogContent({
      title: "Delete Automation Rule",
      description: `Are you sure you want to delete "${rule.rule_name}"? This action cannot be undone.`,
      confirmAction: () => deleteRule(rule.id),
    });
    setConfirmationDialogOpen(true);
  };

  // Helper functions for trigger group management
  const addTriggerGroup = () => {
    setCurrentRule((prev) => ({
      ...prev,
      trigger_groups: [
        ...prev.trigger_groups,
        {
          group_name: `Trigger Group ${prev.trigger_groups.length + 1}`,
          group_operator: "AND",
          triggers: [
            {
              device_name: "",
              device_topic: "",
              trigger_type: "numeric",
              field_name: "",
              condition_operator: "greater_than",
              target_value: 0,
              delay_on: 0,
              delay_off: 0,
            },
          ],
        },
      ],
    }));
  };

  const removeTriggerGroup = (index: number) => {
    setCurrentRule((prev) => ({
      ...prev,
      trigger_groups: prev.trigger_groups.filter((_, i) => i !== index),
    }));
  };

  const updateTriggerGroup = (index: number, updatedGroup: TriggerGroup) => {
    setCurrentRule((prev) => ({
      ...prev,
      trigger_groups: prev.trigger_groups.map((group, i) =>
        i === index ? updatedGroup : group
      ),
    }));
  };

  const addTrigger = (groupIndex: number) => {
    const updatedGroup = {
      ...currentRule.trigger_groups[groupIndex],
      triggers: [
        ...currentRule.trigger_groups[groupIndex].triggers,
        {
          device_name: "",
          device_topic: "",
          trigger_type: "numeric" as const,
          field_name: "",
          condition_operator: "greater_than" as const,
          target_value: 0,
          delay_on: 0,
          delay_off: 0,
        },
      ],
    };
    updateTriggerGroup(groupIndex, updatedGroup);
  };

  const removeTrigger = (groupIndex: number, triggerIndex: number) => {
    const updatedGroup = {
      ...currentRule.trigger_groups[groupIndex],
      triggers: currentRule.trigger_groups[groupIndex].triggers.filter(
        (_, i) => i !== triggerIndex
      ),
    };
    updateTriggerGroup(groupIndex, updatedGroup);
  };

  const updateTrigger = (
    groupIndex: number,
    triggerIndex: number,
    updatedTrigger: TriggerCondition
  ) => {
    const updatedGroup = {
      ...currentRule.trigger_groups[groupIndex],
      triggers: currentRule.trigger_groups[groupIndex].triggers.map(
        (trigger, i) => (i === triggerIndex ? updatedTrigger : trigger)
      ),
    };
    updateTriggerGroup(groupIndex, updatedGroup);
  };

  const addAction = () => {
    setCurrentRule((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          action_type: "control_relay",
          target_device: "",
          target_mac: "",
          target_address: 0,
          target_bus: 0,
          relay_pin: 1,
          target_value: true,
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

  const updateAction = (index: number, updatedAction: ControlAction) => {
    setCurrentRule((prev) => ({
      ...prev,
      actions: prev.actions.map((action, i) =>
        i === index ? updatedAction : action
      ),
    }));
  };

  // Sensor devices only from MODBUS_DEVICES/AVAILABLES topic
  const sensorDevices = useMemo(() => {
    return modbusDevices
      .filter((device) => device?.name)
      .map((device) => ({
        value: device.name,
        label: `${device.name} (${device.manufacturer} - ${device.part_number})`,
        device: device,
        topic: device.topic || "",
      }));
  }, [modbusDevices]);

  // Get relay devices for actions (from modular devices only)
  const relayDevices = useMemo(() => {
    if (!modularDevices || modularDevices.length === 0) return [];

    return modularDevices
      .filter(
        (device) =>
          device?.part_number === "RELAY" || device?.part_number === "RELAYMINI"
      )
      .filter((device) => device?.name)
      .map((device) => ({
        value: device.name,
        label: device.name,
        address: device.address || 0,
        device_bus: device.device_bus || 0,
        mac: device.mac || "00:00:00:00:00:00",
      }));
  }, [modularDevices]);

  // Calculate summary data
  const totalRules = automationConfig?.value_rules?.length || 0;
  const totalTriggers =
    automationConfig?.value_rules?.reduce(
      (sum: number, rule: AutomationValueRule) =>
        sum +
        (rule.trigger_groups?.reduce(
          (groupSum: number, group) => groupSum + (group.triggers?.length || 0),
          0
        ) || 0),
      0
    ) || 0;
  const totalActions =
    automationConfig?.value_rules?.reduce(
      (sum: number, rule: AutomationValueRule) =>
        sum + (rule.actions?.length || 0),
      0
    ) || 0;
  const totalPages = Math.ceil(
    (automationConfig?.value_rules?.length || 0) / itemsPerPage
  );

  // Format operator for display
  const formatOperator = (op: string): string => {
    const operatorMap: Record<string, string> = {
      equals: "=",
      greater_than: ">",
      less_than: "<",
      greater_equal: "≥",
      less_equal: "≤",
      not_equals: "≠",
      between: "⟷",
    };
    return operatorMap[op] || op;
  };

  // Format target value for display
  const formatTargetValue = (
    operator: string,
    value: number | number[]
  ): string => {
    if (operator === "between" && Array.isArray(value)) {
      return `${value[0]} - ${value[1]}`;
    }
    return value.toString();
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Gauge className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Automation Value Control</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={refreshData}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => openModal()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Value Rule
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Summary Cards - New Clean Design */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Value Rules</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRules}</div>
              <p className="text-xs text-muted-foreground">
                Active automation rules
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Trigger Groups
              </CardTitle>
              <Activity className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {automationConfig?.value_rules?.reduce(
                  (sum, rule) => sum + (rule.trigger_groups?.length || 0),
                  0
                ) || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Condition groups configured
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Triggers
              </CardTitle>
              <Code className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTriggers}</div>
              <p className="text-xs text-muted-foreground">
                Individual conditions
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Actions
              </CardTitle>
              <Zap className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActions}</div>
              <p className="text-xs text-muted-foreground">
                Automated responses
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Value Rules Table - Simplified */}
        <div className="rounded-lg border bg-background shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">
              Value Rules ({automationConfig.value_rules.length})
            </h3>
          </div>
          <div className="p-4">
            {automationConfig.value_rules.length === 0 ? (
              <div className="text-center py-8">
                <Gauge className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No value rules found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first automation value rule to get started
                </p>
                <Button onClick={() => openModal()}>Add Value Rule</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead className="min-w-48">
                        Rule Information
                      </TableHead>
                      <TableHead className="min-w-80">
                        Trigger Conditions
                      </TableHead>
                      <TableHead className="min-w-80">Actions</TableHead>
                      <TableHead className="text-center w-32">
                        Controls
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {automationConfig.value_rules
                      .slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage
                      )
                      .map((rule, index) => (
                        <TableRow
                          key={rule.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="text-center font-medium text-muted-foreground">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-base">
                                {rule.rule_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {rule.group_rule_name}
                              </div>
                              {rule.description && (
                                <div className="text-xs text-muted-foreground italic">
                                  {rule.description}
                                </div>
                              )}
                              {rule.created_at && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(rule.created_at).toLocaleDateString(
                                    "id-ID",
                                    {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <div className="space-y-2 max-w-sm">
                              {rule.trigger_groups?.map((group, groupIdx) => (
                                <div
                                  key={groupIdx}
                                  className="border rounded-md p-2 bg-muted/20"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {group.group_name}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {group.group_operator}
                                    </Badge>
                                  </div>
                                  <div className="space-y-1">
                                    {group.triggers
                                      ?.slice(0, 2)
                                      .map((trigger, triggerIdx) => (
                                        <div
                                          key={triggerIdx}
                                          className="text-xs bg-background/60 rounded px-2 py-1"
                                        >
                                          <div className="font-medium truncate">
                                            {trigger.device_name}
                                          </div>
                                          <div className="text-muted-foreground">
                                            {trigger.field_name}{" "}
                                            {formatOperator(
                                              trigger.condition_operator
                                            )}{" "}
                                            <Badge
                                              variant="default"
                                              className="text-xs ml-1"
                                            >
                                              {formatTargetValue(
                                                trigger.condition_operator,
                                                trigger.target_value
                                              )}
                                            </Badge>
                                          </div>
                                          {((trigger.delay_on ?? 0) > 0 ||
                                            (trigger.delay_off ?? 0) > 0) && (
                                            <div className="text-xs text-orange-600">
                                              Delay: {trigger.delay_on ?? 0}s/
                                              {trigger.delay_off ?? 0}s
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    {(group.triggers?.length || 0) > 2 && (
                                      <div className="text-xs text-muted-foreground text-center py-1">
                                        +{(group.triggers?.length || 0) - 2}{" "}
                                        more triggers
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {(rule.trigger_groups?.length || 0) === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-2">
                                  No triggers defined
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <div className="space-y-2 max-w-sm">
                              {rule.actions
                                ?.slice(0, 2)
                                .map((action, actionIdx) => (
                                  <div
                                    key={actionIdx}
                                    className="border rounded-md p-2 bg-muted/20"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      {action.action_type ===
                                      "control_relay" ? (
                                        <Power className="h-3 w-3" />
                                      ) : (
                                        <MessageSquare className="h-3 w-3" />
                                      )}
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {action.action_type === "control_relay"
                                          ? "Control Relay"
                                          : "Send Message"}
                                      </Badge>
                                    </div>
                                    {action.action_type === "control_relay" ? (
                                      <div className="text-xs bg-background/60 rounded px-2 py-1">
                                        <div className="font-medium truncate">
                                          {action.target_device} - Pin{" "}
                                          {action.relay_pin}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-muted-foreground">
                                            Set to:
                                          </span>
                                          <Badge
                                            variant={
                                              action.target_value
                                                ? "default"
                                                : "outline"
                                            }
                                            className="text-xs"
                                          >
                                            {action.target_value ? "ON" : "OFF"}
                                          </Badge>
                                        </div>
                                        <div className="text-muted-foreground">
                                          Addr: {action.target_address}, Bus:{" "}
                                          {action.target_bus}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-xs bg-background/60 rounded px-2 py-1">
                                        <div className="font-medium flex items-center gap-1">
                                          <MessageSquare className="h-3 w-3" />
                                          WhatsApp Message
                                        </div>
                                        <div className="text-muted-foreground truncate">
                                          To: {action.whatsapp_name || "N/A"}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                          {action.whatsapp_number || "N/A"}
                                        </div>
                                        <div className="text-muted-foreground text-xs truncate">
                                          "
                                          {action.message?.substring(0, 40) ||
                                            "N/A"}
                                          {(action.message?.length || 0) > 40
                                            ? "..."
                                            : ""}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              {(rule.actions?.length || 0) > 2 && (
                                <div className="text-xs text-muted-foreground text-center py-1 border rounded-md bg-muted/10">
                                  +{(rule.actions?.length || 0) - 2} more
                                  actions
                                </div>
                              )}
                              {(rule.actions?.length || 0) === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-2">
                                  No actions defined
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetailDialog(rule)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openModal(rule)}
                                title="Edit Rule"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => confirmDelete(rule)}
                                title="Delete Rule"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * itemsPerPage + 1,
                        automationConfig.value_rules.length
                      )}{" "}
                      to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        automationConfig.value_rules.length
                      )}{" "}
                      of {automationConfig.value_rules.length} results
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rule Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={closeDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              <DialogTitle>Rule Details</DialogTitle>
            </div>
            <DialogDescription>
              Detailed view of automation value rule configuration
            </DialogDescription>
          </DialogHeader>

          {selectedRule && (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings2 className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Rule Name
                      </Label>
                      <p className="text-base font-medium">
                        {selectedRule.rule_name}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Group Rule Name
                      </Label>
                      <p className="text-base">
                        {selectedRule.group_rule_name}
                      </p>
                    </div>
                    {selectedRule.description && (
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Description
                        </Label>
                        <p className="text-base">{selectedRule.description}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Rule ID
                      </Label>
                      <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {selectedRule.id}
                      </p>
                    </div>
                    {selectedRule.created_at && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Created At
                        </Label>
                        <p className="text-base flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(selectedRule.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Trigger Groups */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Code className="h-5 w-5" />
                    Trigger Groups ({selectedRule.trigger_groups?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedRule.trigger_groups?.map((group, groupIdx) => (
                      <div
                        key={groupIdx}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{group.group_name}</h4>
                          <Badge variant="secondary">
                            {group.group_operator}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">
                            Triggers ({group.triggers?.length || 0})
                          </Label>
                          {group.triggers?.map((trigger, triggerIdx) => (
                            <div
                              key={triggerIdx}
                              className="bg-muted/50 rounded-md p-3"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Device
                                  </Label>
                                  <p className="font-medium">
                                    {trigger.device_name}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Field Name
                                  </Label>
                                  <p className="font-mono text-sm">
                                    {trigger.field_name}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Condition
                                  </Label>
                                  <p>
                                    {formatOperator(trigger.condition_operator)}{" "}
                                    <Badge variant="default" className="ml-1">
                                      {formatTargetValue(
                                        trigger.condition_operator,
                                        trigger.target_value
                                      )}
                                    </Badge>
                                  </p>
                                </div>
                                {trigger.device_topic && (
                                  <div className="md:col-span-2">
                                    <Label className="text-xs text-muted-foreground">
                                      MQTT Topic
                                    </Label>
                                    <p className="text-xs font-mono bg-background px-2 py-1 rounded">
                                      {trigger.device_topic}
                                    </p>
                                  </div>
                                )}
                                {((trigger.delay_on ?? 0) > 0 ||
                                  (trigger.delay_off ?? 0) > 0) && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Delays
                                    </Label>
                                    <p className="text-orange-600">
                                      ON: {trigger.delay_on ?? 0}s, OFF:{" "}
                                      {trigger.delay_off ?? 0}s
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5" />
                    Actions ({selectedRule.actions?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedRule.actions?.map((action, actionIdx) => (
                      <div
                        key={actionIdx}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          {action.action_type === "control_relay" ? (
                            <Power className="h-4 w-4" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
                          <Badge variant="secondary">
                            {action.action_type === "control_relay"
                              ? "Control Relay"
                              : "Send Message"}
                          </Badge>
                        </div>

                        {action.action_type === "control_relay" ? (
                          <div className="bg-muted/50 rounded-md p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Target Device
                                </Label>
                                <p className="font-medium">
                                  {action.target_device}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Relay Pin
                                </Label>
                                <p>Pin {action.relay_pin}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Target Value
                                </Label>
                                <Badge
                                  variant={
                                    action.target_value ? "default" : "outline"
                                  }
                                >
                                  {action.target_value
                                    ? "ON (True)"
                                    : "OFF (False)"}
                                </Badge>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Device Address
                                </Label>
                                <p>
                                  Address: {action.target_address}, Bus:{" "}
                                  {action.target_bus}
                                </p>
                              </div>
                              {action.target_mac && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    MAC Address
                                  </Label>
                                  <p className="text-xs font-mono bg-background px-2 py-1 rounded">
                                    {action.target_mac}
                                  </p>
                                </div>
                              )}
                              {action.description && (
                                <div className="md:col-span-2 lg:col-span-3">
                                  <Label className="text-xs text-muted-foreground">
                                    Description
                                  </Label>
                                  <p>{action.description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-muted/50 rounded-md p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  WhatsApp Number
                                </Label>
                                <p className="font-medium">
                                  {action.whatsapp_number || "N/A"}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Recipient Name
                                </Label>
                                <p>{action.whatsapp_name || "N/A"}</p>
                              </div>
                              <div className="md:col-span-2">
                                <Label className="text-xs text-muted-foreground">
                                  Message
                                </Label>
                                <p className="bg-background p-2 rounded border text-sm">
                                  {action.message || "N/A"}
                                </p>
                              </div>
                              {action.message_template_id && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Template ID
                                  </Label>
                                  <p className="text-xs font-mono bg-background px-2 py-1 rounded">
                                    {action.message_template_id}
                                  </p>
                                </div>
                              )}
                              {action.channel_integration_id && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Channel Integration ID
                                  </Label>
                                  <p className="text-xs font-mono bg-background px-2 py-1 rounded">
                                    {action.channel_integration_id}
                                  </p>
                                </div>
                              )}
                              {action.description && (
                                <div className="md:col-span-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Description
                                  </Label>
                                  <p>{action.description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDetailDialog}>
              Close
            </Button>
            {selectedRule && (
              <Button
                onClick={() => {
                  closeDetailDialog();
                  openModal(selectedRule);
                }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Rule
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Value Rule Dialog */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              <DialogTitle>
                {isEditing ? "Edit Value Rule" : "Create Value Rule"}
              </DialogTitle>
            </div>
            <DialogDescription>
              Configure advanced automation value rules with numeric conditions
              and actions
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveRule} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Basic Information
                </div>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ruleName">Rule Name *</Label>
                  <Input
                    id="ruleName"
                    value={currentRule.rule_name}
                    onChange={(e) =>
                      setCurrentRule((prev) => ({
                        ...prev,
                        rule_name: e.target.value,
                      }))
                    }
                    placeholder="Enter rule name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="groupRuleName">Group Rule Name *</Label>
                  <Input
                    id="groupRuleName"
                    value={currentRule.group_rule_name}
                    onChange={(e) =>
                      setCurrentRule((prev) => ({
                        ...prev,
                        group_rule_name: e.target.value,
                      }))
                    }
                    placeholder="Enter group rule name"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="ruleDescription">Description</Label>
                  <Textarea
                    id="ruleDescription"
                    value={currentRule.description}
                    onChange={(e) =>
                      setCurrentRule((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Enter rule description"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Value Groups - Trigger Configuration */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Value Triggers
                </div>
              </h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Define numeric conditions that trigger this automation rule
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTriggerGroup}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                </div>

                {loadingDevices && (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Loading device profiles...
                    </p>
                  </div>
                )}

                {currentRule.trigger_groups.map((group, groupIndex) => (
                  <div
                    key={groupIndex}
                    className="p-4 border rounded-lg space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <Label>Group Name</Label>
                        <Input
                          value={group.group_name}
                          onChange={(e) =>
                            updateTriggerGroup(groupIndex, {
                              ...group,
                              group_name: e.target.value,
                            })
                          }
                          placeholder="Enter group name"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Operator:</Label>
                        <Select
                          value={group.group_operator}
                          onValueChange={(value) =>
                            updateTriggerGroup(groupIndex, {
                              ...group,
                              group_operator: value as "AND" | "OR",
                            })
                          }
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeTriggerGroup(groupIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Triggers Configuration */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          Triggers ({group.triggers.length})
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTrigger(groupIndex)}
                        >
                          <PlusCircle className="h-4 w-4 mr-1" />
                          Add Trigger
                        </Button>
                      </div>

                      {group.triggers.map((trigger, triggerIndex) => {
                        // Get selected device for this trigger
                        const selectedDeviceOption = sensorDevices.find(
                          (d) => d.value === trigger.device_name
                        );
                        const selectedDevice = selectedDeviceOption?.device;
                        const availableFields = getDeviceFields(
                          selectedDevice || null
                        );

                        return (
                          <div
                            key={triggerIndex}
                            className="p-4 bg-muted/30 rounded-lg space-y-4 border border-muted"
                          >
                            <div className="flex items-center justify-between border-b border-muted pb-2">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                  {triggerIndex + 1}
                                </div>
                                <Label className="text-sm font-semibold">
                                  Trigger Condition
                                </Label>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  removeTrigger(groupIndex, triggerIndex)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Device Configuration Section */}
                            <div className="space-y-3">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Device Configuration
                              </Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Device Selection */}
                                <div>
                                  <Label className="text-xs">
                                    Sensor Device *
                                  </Label>
                                  <Select
                                    value={trigger.device_name}
                                    onValueChange={(value) => {
                                      const selectedDeviceOption =
                                        sensorDevices.find(
                                          (d) => d.value === value
                                        );
                                      updateTrigger(groupIndex, triggerIndex, {
                                        ...trigger,
                                        device_name: value,
                                        device_topic:
                                          selectedDeviceOption?.topic || "",
                                        field_name: "", // Reset field when device changes
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select sensor device" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sensorDevices.length === 0 ? (
                                        <SelectItem value="no-devices" disabled>
                                          No devices available
                                        </SelectItem>
                                      ) : (
                                        sensorDevices.map((device) => (
                                          <SelectItem
                                            key={device.value}
                                            value={device.value}
                                          >
                                            {device.label}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Field Name Selection - DYNAMIC from devices.json */}
                                <div>
                                  <Label className="text-xs">
                                    Field Name *
                                  </Label>
                                  <Select
                                    value={trigger.field_name}
                                    onValueChange={(value) =>
                                      updateTrigger(groupIndex, triggerIndex, {
                                        ...trigger,
                                        field_name: value,
                                      })
                                    }
                                    disabled={
                                      !trigger.device_name ||
                                      availableFields.length === 0
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {!trigger.device_name ? (
                                        <SelectItem value="no-device" disabled>
                                          Select device first
                                        </SelectItem>
                                      ) : availableFields.length === 0 ? (
                                        <SelectItem value="no-fields" disabled>
                                          No fields available
                                        </SelectItem>
                                      ) : (
                                        availableFields.map((field) => (
                                          <SelectItem
                                            key={field.var_name}
                                            value={field.var_name}
                                          >
                                            {field.var_name} ({field.data_type})
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Device Topic Display */}
                                <div className="md:col-span-2">
                                  <Label className="text-xs">MQTT Topic</Label>
                                  <Input
                                    value={trigger.device_topic || ""}
                                    readOnly
                                    placeholder="Topic will be set automatically"
                                    className="bg-muted text-xs font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Condition Configuration Section */}
                            <div className="space-y-3">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Condition Settings
                              </Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Condition Operator */}
                                <div>
                                  <Label className="text-xs">Operator *</Label>
                                  <Select
                                    value={trigger.condition_operator}
                                    onValueChange={(value) => {
                                      const newTrigger = {
                                        ...trigger,
                                        condition_operator:
                                          value as TriggerCondition["condition_operator"],
                                      };
                                      // Reset target_value when changing to/from "between"
                                      if (value === "between") {
                                        newTrigger.target_value = [0, 0];
                                      } else if (
                                        trigger.condition_operator === "between"
                                      ) {
                                        newTrigger.target_value = 0;
                                      }
                                      updateTrigger(
                                        groupIndex,
                                        triggerIndex,
                                        newTrigger
                                      );
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {conditionOperators.map((op) => (
                                        <SelectItem
                                          key={op.value}
                                          value={op.value}
                                        >
                                          {op.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Target Value - Single or Range */}
                                {trigger.condition_operator === "between" ? (
                                  <>
                                    <div>
                                      <Label className="text-xs">
                                        Min Value *
                                      </Label>
                                      <Input
                                        type="number"
                                        step="any"
                                        value={
                                          Array.isArray(trigger.target_value)
                                            ? trigger.target_value[0]
                                            : 0
                                        }
                                        onChange={(e) => {
                                          const currentValue = Array.isArray(
                                            trigger.target_value
                                          )
                                            ? trigger.target_value
                                            : [0, 0];
                                          updateTrigger(
                                            groupIndex,
                                            triggerIndex,
                                            {
                                              ...trigger,
                                              target_value: [
                                                parseFloat(e.target.value) || 0,
                                                currentValue[1],
                                              ],
                                            }
                                          );
                                        }}
                                        placeholder="Min value"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">
                                        Max Value *
                                      </Label>
                                      <Input
                                        type="number"
                                        step="any"
                                        value={
                                          Array.isArray(trigger.target_value)
                                            ? trigger.target_value[1]
                                            : 0
                                        }
                                        onChange={(e) => {
                                          const currentValue = Array.isArray(
                                            trigger.target_value
                                          )
                                            ? trigger.target_value
                                            : [0, 0];
                                          updateTrigger(
                                            groupIndex,
                                            triggerIndex,
                                            {
                                              ...trigger,
                                              target_value: [
                                                currentValue[0],
                                                parseFloat(e.target.value) || 0,
                                              ],
                                            }
                                          );
                                        }}
                                        placeholder="Max value"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <div>
                                    <Label className="text-xs">
                                      Target Value *
                                    </Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={
                                        typeof trigger.target_value === "number"
                                          ? trigger.target_value
                                          : 0
                                      }
                                      onChange={(e) =>
                                        updateTrigger(
                                          groupIndex,
                                          triggerIndex,
                                          {
                                            ...trigger,
                                            target_value:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        )
                                      }
                                      placeholder="Enter target value"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Delay Settings Section */}
                            <div className="space-y-3">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Delay Timing (Optional)
                              </Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">
                                    Delay ON (seconds)
                                  </Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={trigger.delay_on || 0}
                                    onChange={(e) =>
                                      updateTrigger(groupIndex, triggerIndex, {
                                        ...trigger,
                                        delay_on: parseInt(e.target.value) || 0,
                                      })
                                    }
                                    placeholder="0"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Wait time before activating
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs">
                                    Delay OFF (seconds)
                                  </Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={trigger.delay_off || 0}
                                    onChange={(e) =>
                                      updateTrigger(groupIndex, triggerIndex, {
                                        ...trigger,
                                        delay_off:
                                          parseInt(e.target.value) || 0,
                                      })
                                    }
                                    placeholder="0"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Wait time before deactivating
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions - Same as Logic */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Actions
                </div>
              </h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Define what happens when conditions are met
                  </p>
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
                    className="p-4 border rounded-lg space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <Label>Action Type</Label>
                        <Select
                          value={action.action_type}
                          onValueChange={(value) =>
                            updateAction(actionIndex, {
                              ...action,
                              action_type: value as
                                | "control_relay"
                                | "send_message",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select action type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="control_relay">
                              Control Relay
                            </SelectItem>
                            <SelectItem value="send_message">
                              Send Message
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeAction(actionIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Action Configuration */}
                    {action.action_type === "control_relay" && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Relay Control Configuration
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* Relay Device Selection */}
                          <div>
                            <Label className="text-xs">Relay Device</Label>
                            <Select
                              value={action.target_device}
                              onValueChange={(value) => {
                                const selectedDevice = relayDevices.find(
                                  (d) => d.value === value
                                );
                                updateAction(actionIndex, {
                                  ...action,
                                  target_device: value,
                                  target_mac: selectedDevice?.mac || "",
                                  target_address: selectedDevice?.address || 0,
                                  target_bus: selectedDevice?.device_bus || 0,
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select relay device" />
                              </SelectTrigger>
                              <SelectContent>
                                {relayDevices.map((device) => (
                                  <SelectItem
                                    key={device.value}
                                    value={device.value}
                                  >
                                    {device.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Relay Pin Number */}
                          <div>
                            <Label className="text-xs">Relay Pin</Label>
                            <Select
                              value={action.relay_pin?.toString() || "1"}
                              onValueChange={(value) =>
                                updateAction(actionIndex, {
                                  ...action,
                                  relay_pin: parseInt(value),
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select pin" />
                              </SelectTrigger>
                              <SelectContent>
                                {getRelayPinsForDevice(
                                  action.target_device || ""
                                ).map((pin) => (
                                  <SelectItem
                                    key={pin.value}
                                    value={pin.value.toString()}
                                  >
                                    {pin.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Relay Target Value */}
                          <div>
                            <Label className="text-xs">Relay State</Label>
                            <Select
                              value={action.target_value?.toString() || "true"}
                              onValueChange={(value) =>
                                updateAction(actionIndex, {
                                  ...action,
                                  target_value: value === "true",
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">ON (True)</SelectItem>
                                <SelectItem value="false">
                                  OFF (False)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    {action.action_type === "send_message" && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Message Configuration
                        </Label>

                        {/* WhatsApp Message Configuration */}
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">
                                WhatsApp Number *
                              </Label>
                              <Input
                                value={action.whatsapp_number || ""}
                                onChange={(e) =>
                                  updateAction(actionIndex, {
                                    ...action,
                                    message_type: "whatsapp",
                                    whatsapp_number: e.target.value,
                                  })
                                }
                                placeholder="6281284842478"
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Recipient Name</Label>
                              <Input
                                value={action.whatsapp_name || ""}
                                onChange={(e) =>
                                  updateAction(actionIndex, {
                                    ...action,
                                    message_type: "whatsapp",
                                    whatsapp_name: e.target.value,
                                  })
                                }
                                placeholder="Pak Sen"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Message Content *</Label>
                            <Textarea
                              value={action.message || ""}
                              onChange={(e) =>
                                updateAction(actionIndex, {
                                  ...action,
                                  message_type: "whatsapp",
                                  message: e.target.value,
                                })
                              }
                              placeholder="Enter WhatsApp message content"
                              rows={2}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">
                                Message Template ID
                              </Label>
                              <Input
                                value={
                                  action.message_template_id ||
                                  "300d84f2-d962-4451-bc27-870fb99d18e7"
                                }
                                onChange={(e) =>
                                  updateAction(actionIndex, {
                                    ...action,
                                    message_type: "whatsapp",
                                    message_template_id: e.target.value,
                                  })
                                }
                                placeholder="300d84f2-d962-4451-bc27-870fb99d18e7"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">
                                Channel Integration ID
                              </Label>
                              <Input
                                value={
                                  action.channel_integration_id ||
                                  "662f9fcb-7e2b-4c1a-8eda-9aeb4a388004"
                                }
                                onChange={(e) =>
                                  updateAction(actionIndex, {
                                    ...action,
                                    message_type: "whatsapp",
                                    channel_integration_id: e.target.value,
                                  })
                                }
                                placeholder="662f9fcb-7e2b-4c1a-8eda-9aeb4a388004"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={action.description || ""}
                        onChange={(e) =>
                          updateAction(actionIndex, {
                            ...action,
                            description: e.target.value,
                          })
                        }
                        placeholder="Action description"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={loadingDevices}>
                {isEditing ? "Update Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertDialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationDialogOpen}
        onOpenChange={setConfirmationDialogOpen}
        title={confirmationDialogContent.title}
        description={confirmationDialogContent.description}
        onConfirm={confirmationDialogContent.confirmAction}
      />
    </SidebarInset>
  );
};

export default AutomationValueControl;
