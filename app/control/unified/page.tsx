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
  Code,
  Activity,
  Eye,
  Calendar,
  MessageSquare,
  Power,
  Combine,
  Target,
  Cpu,
} from "lucide-react";
import MqttStatus from "@/components/mqtt-status";

// Type definitions for Unified Automation
// Schedule-based trigger interface
interface ScheduleTrigger {
  schedule_type: "time_range" | "specific_time" | "daily";
  active_days: string[]; // ["Mon", "Tue", etc.]
  start_time?: string; // HH:MM format
  end_time?: string; // HH:MM format
  specific_time?: string; // HH:MM format
}

interface UnifiedTriggerCondition {
  device_name?: string; // Optional for schedule triggers
  device_topic?: string; // Optional for schedule triggers
  trigger_type: "drycontact" | "numeric" | "schedule";
  // For drycontact triggers
  pin_number?: number;
  // For numeric triggers
  field_name?: string;
  // For schedule triggers
  start_time?: string;
  end_time?: string;
  specific_time?: string;
  active_days?: string[];
  // Common condition settings
  condition_operator: string; // Different operators based on trigger_type
  target_value: boolean | number | number[]; // Single value or range [min, max]
  delay_on?: number;
  delay_off?: number;
}

interface UnifiedTriggerGroup {
  group_name: string;
  triggers: UnifiedTriggerCondition[];
  group_operator: "AND" | "OR";
}

interface UnifiedControlAction {
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
  delay_on?: number;
  delay_off?: number;
  latching?: boolean;
}

interface UnifiedAutomationRule {
  id: string;
  rule_name: string;
  description: string;
  group_rule_name: string;
  created_at?: string;
  updated_at?: string;
  trigger_groups: UnifiedTriggerGroup[];
  actions: UnifiedControlAction[];
}

interface UnifiedAutomationConfig {
  unified_rules: UnifiedAutomationRule[];
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

const UnifiedAutomationControl = () => {
  // MQTT Topics - simplified for unified backend
  const TOPICS = useMemo(
    () => ({
      COMMAND: "command_control_unified",
      RESPONSE: "response_control_unified",
      MODBUS_AVAILABLES: "MODBUS_DEVICE/AVAILABLES",
      MODULAR_AVAILABLES: "MODULAR_DEVICE/AVAILABLES",
      RESULT_MESSAGE: "result/message/unified/control",
    }),
    []
  );

  // Connection Status
  const [mqttConnectionStatus, setMqttConnectionStatus] =
    useState("Disconnected");

  // Data States
  const [automationConfig, setAutomationConfig] =
    useState<UnifiedAutomationConfig>({
      unified_rules: [],
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
  const [selectedRule, setSelectedRule] =
    useState<UnifiedAutomationRule | null>(null);

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
  const [currentRule, setCurrentRule] = useState<UnifiedAutomationRule>({
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

  // Available condition operators and schedule types for different trigger types
  const conditionOperators = {
    drycontact: [{ value: "is", label: "Is" }],
    numeric: [
      { value: "equals", label: "Equals (=)" },
      { value: "greater_than", label: "Greater Than (>)" },
      { value: "less_than", label: "Less Than (<)" },
      { value: "greater_equal", label: "Greater or Equal (≥)" },
      { value: "less_equal", label: "Less or Equal (≤)" },
      { value: "not_equals", label: "Not Equal (≠)" },
      { value: "between", label: "Between (Range)" },
    ],
    schedule: [
      { value: "time_range", label: "Time Range" },
      { value: "specific_time", label: "Specific Time" },
      { value: "daily", label: "Daily (All Day)" },
    ],
  };

  // Available days for schedule triggers
  const daysOfWeek = [
    { value: "Mon", label: "Monday" },
    { value: "Tue", label: "Tuesday" },
    { value: "Wed", label: "Wednesday" },
    { value: "Thu", label: "Thursday" },
    { value: "Fri", label: "Friday" },
    { value: "Sat", label: "Saturday" },
    { value: "Sun", label: "Sunday" },
  ];

  // Function to get relay pins based on device PART_NUMBER
  const getRelayPinsForDevice = useCallback(
    (deviceName: string) => {
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
          : 8;

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
        // Load both modbus and modular device profiles
        const [modbusResponse, modularResponse] = await Promise.all([
          fetch("/files/modbus/devices.json"),
          fetch("/files/modular/devices.json"),
        ]);

        if (!modbusResponse.ok) {
          throw new Error("Failed to load modbus device profiles");
        }
        if (!modularResponse.ok) {
          throw new Error("Failed to load modular device profiles");
        }

        const [modbusData, modularData] = await Promise.all([
          modbusResponse.json(),
          modularResponse.json(),
        ]);

        // Merge both device profiles
        const combinedProfiles = { ...modbusData, ...modularData };
        setDeviceProfiles(combinedProfiles);
        console.log(
          "Device profiles loaded:",
          Object.keys(combinedProfiles).length,
          "categories"
        );
      } catch (error) {
        console.error("Error loading device profiles:", error);
        toast.error("Failed to load device profiles");
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

  // CRUD Operations matching new unified backend
  const createRule = useCallback(
    (rule: UnifiedAutomationRule) => {
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
    (rule: UnifiedAutomationRule) => {
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

          currentClient.subscribe([
            TOPICS.RESPONSE,
            TOPICS.MODBUS_AVAILABLES,
            TOPICS.MODULAR_AVAILABLES,
          ]);

          console.log("Subscribed to unified automation topics");

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
                if (payload.data && Array.isArray(payload.data)) {
                  setAutomationConfig({ unified_rules: payload.data });
                  console.log(
                    "Unified automation config loaded:",
                    payload.data
                  );
                  setLoading(false);
                } else {
                  handleCRUDResponse(payload);
                }
                break;

              case TOPICS.MODBUS_AVAILABLES:
                // Handle both wrapped and direct array formats
                let modbusDevices = [];
                if (payload.status === "success" && payload.data) {
                  modbusDevices = payload.data;
                  console.log(
                    "MODBUS devices loaded (wrapped):",
                    payload.data.length
                  );
                } else {
                  // Try parsing as direct array or dict format
                  try {
                    const parsed = JSON.parse(message.toString());
                    if (Array.isArray(parsed)) {
                      modbusDevices = parsed;
                      console.log(
                        "MODBUS devices loaded (direct array):",
                        parsed.length
                      );
                    } else if (parsed && Array.isArray(parsed.devices)) {
                      modbusDevices = parsed.devices;
                      console.log(
                        "MODBUS devices loaded (dict.devices):",
                        parsed.devices.length
                      );
                    } else if (parsed && typeof parsed === "object") {
                      // Handle direct device objects in array
                      modbusDevices = [parsed];
                      console.log("MODBUS devices loaded (single device):", 1);
                    }
                  } catch (e) {
                    console.error("Error parsing MODBUS devices:", e);
                  }
                }
                setModbusDevices(modbusDevices);
                console.log("MODBUS devices set:", modbusDevices.length);
                break;

              case TOPICS.MODULAR_AVAILABLES:
                // Handle both wrapped and direct array formats
                let modularDevices = [];
                if (payload.status === "success" && payload.data) {
                  modularDevices = payload.data;
                  console.log(
                    "Modular devices loaded (wrapped):",
                    payload.data.length
                  );
                } else {
                  // Try parsing as direct array or dict format
                  try {
                    const parsed = JSON.parse(message.toString());
                    if (Array.isArray(parsed)) {
                      modularDevices = parsed;
                      console.log(
                        "Modular devices loaded (direct array):",
                        parsed.length
                      );
                    } else if (parsed && Array.isArray(parsed.devices)) {
                      modularDevices = parsed.devices;
                      console.log(
                        "Modular devices loaded (dict.devices):",
                        parsed.devices.length
                      );
                    } else if (parsed && typeof parsed === "object") {
                      // Handle direct device objects in array
                      modularDevices = [parsed];
                      console.log("Modular devices loaded (single device):", 1);
                    }
                  } catch (e) {
                    console.error("Error parsing modular devices:", e);
                  }
                }
                setModularDevices(modularDevices);
                console.log("Modular devices set:", modularDevices.length);
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

      setTimeout(() => {
        refreshData();
      }, 500);

      if (isModalOpen) {
        closeModal();
      }
    } else {
      toast.error(payload.message || "An error occurred");
    }
  };

  // Modal Functions
  const openModal = (rule?: UnifiedAutomationRule) => {
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

  const openDetailDialog = (rule: UnifiedAutomationRule) => {
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
    // Reset to clean state
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

        // Validation based on trigger type
        if (trigger.trigger_type === "drycontact") {
          if (!trigger.field_name) {
            setAlertDialogContent({
              title: "Validation Error",
              description: "Boolean triggers must have a field name selected.",
            });
            setAlertDialogOpen(true);
            return;
          }
        } else if (trigger.trigger_type === "numeric") {
          if (!trigger.field_name) {
            setAlertDialogContent({
              title: "Validation Error",
              description: "Numeric triggers must have a field name selected.",
            });
            setAlertDialogOpen(true);
            return;
          }

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
    }

    // Save rule
    if (isEditing) {
      updateRule(currentRule);
    } else {
      createRule(currentRule);
    }
  };

  const confirmDelete = (rule: UnifiedAutomationRule) => {
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

  const updateTriggerGroup = (
    index: number,
    updatedGroup: UnifiedTriggerGroup
  ) => {
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
    updatedTrigger: UnifiedTriggerCondition
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

  const updateAction = (index: number, updatedAction: UnifiedControlAction) => {
    setCurrentRule((prev) => ({
      ...prev,
      actions: prev.actions.map((action, i) =>
        i === index ? updatedAction : action
      ),
    }));
  };

  // Combined device lists for sensors and dry contacts
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

  const dryContactDevices = useMemo(() => {
    return modularDevices
      .filter((device) => device?.name && device?.part_number === "DRYCONTACT")
      .map((device) => ({
        value: device.name,
        label: `${device.name} (${device.manufacturer} - ${device.part_number})`,
        device: device,
        topic: device.topic || "",
        address: device.address || 0,
        device_bus: device.device_bus || 0,
      }));
  }, [modularDevices]);

  // Combined all devices for easier selection
  const allDevices = useMemo(() => {
    return [...sensorDevices, ...dryContactDevices];
  }, [sensorDevices, dryContactDevices]);

  // Get relay devices (from modular devices only)
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
  const totalRules = automationConfig?.unified_rules?.length || 0;
  const totalTriggerGroups =
    automationConfig?.unified_rules?.reduce(
      (sum, rule) => sum + (rule.trigger_groups?.length || 0),
      0
    ) || 0;
  const totalTriggers =
    automationConfig?.unified_rules?.reduce(
      (sum: number, rule: UnifiedAutomationRule) =>
        sum +
        (rule.trigger_groups?.reduce(
          (groupSum: number, group) => groupSum + (group.triggers?.length || 0),
          0
        ) || 0),
      0
    ) || 0;
  const totalActions =
    automationConfig?.unified_rules?.reduce(
      (sum: number, rule: UnifiedAutomationRule) =>
        sum + (rule.actions?.length || 0),
      0
    ) || 0;
  const totalPages = Math.ceil(
    (automationConfig?.unified_rules?.length || 0) / itemsPerPage
  );

  // Calculate additional stats
  const numericTriggers =
    automationConfig?.unified_rules?.reduce(
      (sum, rule) =>
        sum +
          rule.trigger_groups?.reduce(
            (groupSum, group) =>
              groupSum +
              (group.triggers?.filter((t) => t.trigger_type === "numeric")
                .length || 0),
            0
          ) || 0,
      0
    ) || 0;

  const dryContactTriggers = totalTriggers - numericTriggers;

  // Calculate schedule triggers count
  const scheduleTriggers =
    automationConfig?.unified_rules?.reduce(
      (sum, rule) =>
        sum +
          rule.trigger_groups?.reduce(
            (groupSum, group) =>
              groupSum +
              (group.triggers?.filter((t) => t.trigger_type === "schedule")
                .length || 0),
            0
          ) || 0,
      0
    ) || 0;

  // Format operator for display
  const formatOperator = (op: string, triggerType: string): string => {
    if (triggerType === "drycontact") {
      return op.toUpperCase();
    }

    const operatorMap: Record<string, string> = {
      equals: "=",
      greater_than: ">",
      less_than: "<",
      greater_equal: "≥",
      less_equal: "≤",
      not_equals: "≠",
      between: "⟷",
      is: "is",
    };
    return operatorMap[op] || op;
  };

  // Format target value for display
  const formatTargetValue = (
    operator: string,
    triggerType: string,
    value: boolean | number | number[]
  ): string => {
    if (triggerType === "drycontact") {
      return value ? "TRUE" : "FALSE";
    }

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
          <Combine className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Unified Automation Control</h1>
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
            Add Unified Rule
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Enhanced Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Unified Rules
              </CardTitle>
              <Combine className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {totalRules}
              </div>
              <p className="text-xs text-muted-foreground">
                Active mixed trigger rules
              </p>
              <div className="mt-2">
                <div className="flex justify-between text-xs">
                  <span>Groups:</span>
                  <span className="font-medium">{totalTriggerGroups}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Trigger Types
              </CardTitle>
              <Target className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalTriggers}
              </div>
              <p className="text-xs text-muted-foreground">
                Total conditions configured
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-blue-500" />
                    Numeric:
                  </span>
                  <span className="font-medium">{numericTriggers}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Power className="h-3 w-3 text-red-500" />
                    Boolean:
                  </span>
                  <span className="font-medium">{dryContactTriggers}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actions</CardTitle>
              <Zap className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {totalActions}
              </div>
              <p className="text-xs text-muted-foreground">
                Automated responses
              </p>
              <div className="mt-2">
                <div className="flex justify-between text-xs">
                  <span>Relay Ctrl:</span>
                  <span className="font-medium">
                    {automationConfig?.unified_rules?.reduce(
                      (sum, rule) =>
                        sum +
                        (rule.actions?.filter(
                          (a) => a.action_type === "control_relay"
                        ).length || 0),
                      0
                    ) || 0}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Messages:</span>
                  <span className="font-medium">
                    {automationConfig?.unified_rules?.reduce(
                      (sum, rule) =>
                        sum +
                        (rule.actions?.filter(
                          (a) => a.action_type === "send_message"
                        ).length || 0),
                      0
                    ) || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Devices</CardTitle>
              <Settings2 className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {allDevices.length}
              </div>
              <p className="text-xs text-muted-foreground">Available devices</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Sensors:</span>
                  <span className="font-medium">{sensorDevices.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Dry Contacts:</span>
                  <span className="font-medium">
                    {dryContactDevices.length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Relays:</span>
                  <span className="font-medium">{relayDevices.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Schedule Triggers
              </CardTitle>
              <Calendar className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">
                {scheduleTriggers}
              </div>
              <p className="text-xs text-muted-foreground">
                Time-based conditions
              </p>
              <div className="mt-2">
                <div className="flex justify-between text-xs">
                  <span>Active schedules:</span>
                  <span className="font-medium">{scheduleTriggers}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Rule utilities:</span>
                  <span className="font-medium">
                    {automationConfig?.unified_rules?.filter((rule) =>
                      rule.trigger_groups?.some((group) =>
                        group.triggers?.some(
                          (trigger) => trigger.trigger_type === "schedule"
                        )
                      )
                    ).length || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unified Rules Table */}
        <div className="rounded-lg border bg-background shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">
              Unified Automation Rules ({automationConfig.unified_rules.length})
            </h3>
            <p className="text-sm text-muted-foreground">
              Combine boolean and numeric triggers in a single rule
            </p>
          </div>
          <div className="p-4">
            {automationConfig.unified_rules.length === 0 ? (
              <div className="text-center py-8">
                <Combine className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No unified rules found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first unified automation rule to get started
                </p>
                <Button onClick={() => openModal()}>Add Unified Rule</Button>
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
                      <TableHead className="min-w-80">Mixed Triggers</TableHead>
                      <TableHead className="min-w-80">Actions</TableHead>
                      <TableHead className="text-center w-32">
                        Controls
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {automationConfig.unified_rules
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
                                          <div className="font-medium truncate flex items-center gap-1">
                                            {trigger.trigger_type ===
                                            "drycontact" ? (
                                              <Power className="h-3 w-3 text-blue-500" />
                                            ) : (
                                              <Cpu className="h-3 w-3 text-purple-500" />
                                            )}
                                            {trigger.device_name}
                                          </div>
                                          <div className="text-muted-foreground">
                                            {trigger.trigger_type ===
                                            "drycontact"
                                              ? `${
                                                  trigger.field_name ||
                                                  `Pin ${
                                                    trigger.pin_number || 1
                                                  }`
                                                }`
                                              : trigger.field_name}{" "}
                                            {formatOperator(
                                              trigger.condition_operator,
                                              trigger.trigger_type
                                            )}{" "}
                                            <Badge
                                              variant="default"
                                              className="text-xs ml-1"
                                            >
                                              {formatTargetValue(
                                                trigger.condition_operator,
                                                trigger.trigger_type,
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
                        automationConfig.unified_rules.length
                      )}{" "}
                      to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        automationConfig.unified_rules.length
                      )}{" "}
                      of {automationConfig.unified_rules.length} results
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
              Detailed view of unified automation rule configuration
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
                    <Target className="h-5 w-5" />
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
                                    Type
                                  </Label>
                                  <Badge
                                    variant={
                                      trigger.trigger_type === "drycontact"
                                        ? "secondary"
                                        : "default"
                                    }
                                  >
                                    {trigger.trigger_type === "drycontact" ? (
                                      <Power className="h-3 w-3 mr-1" />
                                    ) : (
                                      <Cpu className="h-3 w-3 mr-1" />
                                    )}
                                    {trigger.trigger_type}
                                  </Badge>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Condition
                                  </Label>
                                  <p>
                                    {trigger.trigger_type === "drycontact"
                                      ? `Pin ${trigger.pin_number}`
                                      : trigger.field_name}{" "}
                                    {formatOperator(
                                      trigger.condition_operator,
                                      trigger.trigger_type
                                    )}{" "}
                                    <Badge variant="default" className="ml-1">
                                      {formatTargetValue(
                                        trigger.condition_operator,
                                        trigger.trigger_type,
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

      {/* Unified Rule Dialog */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Combine className="h-5 w-5" />
              <DialogTitle>
                {isEditing ? "Edit Unified Rule" : "Create Unified Rule"}
              </DialogTitle>
            </div>
            <DialogDescription>
              Configure advanced automation rules with mixed boolean and numeric
              triggers
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
                  <Label htmlFor="groupRuleName">Group Rule Name</Label>
                  <Input
                    id="groupRuleName"
                    value={currentRule.group_rule_name}
                    onChange={(e) =>
                      setCurrentRule((prev) => ({
                        ...prev,
                        group_rule_name: e.target.value,
                      }))
                    }
                    placeholder="Optional group rule identifier"
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

            {/* Mixed Trigger Groups */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Mixed Trigger Groups
                </div>
              </h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Combine boolean and numeric triggers in flexible groups with
                    AND/OR logic
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
                        const selectedDeviceOption = allDevices.find(
                          (d: {
                            value: string;
                            label: string;
                            device?: any;
                            topic?: string;
                          }) => d.value === trigger.device_name
                        );
                        const selectedDevice = selectedDeviceOption?.device;
                        const availableFields = getDeviceFields(
                          selectedDevice || null
                        );

                        // For modular devices, also get fields specifically for boolean triggers
                        const modularDevice = modularDevices.find(
                          (d: ModularDevice) => d.name === trigger.device_name
                        );
                        const modularAvailableFields = modularDevice
                          ? getDeviceFields(modularDevice)
                          : [];

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
                                  Mixed Trigger Condition
                                </Label>
                                <Badge
                                  variant={
                                    trigger.trigger_type === "drycontact"
                                      ? "secondary"
                                      : "default"
                                  }
                                >
                                  {trigger.trigger_type === "drycontact" ? (
                                    <Power className="h-3 w-3 mr-1" />
                                  ) : (
                                    <Cpu className="h-3 w-3 mr-1" />
                                  )}
                                  {trigger.trigger_type}
                                </Badge>
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

                            {/* Device and Type Configuration */}
                            <div className="space-y-3">
                              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Device & Trigger Type Configuration
                              </Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Trigger Type */}
                                <div>
                                  <Label className="text-xs">
                                    Trigger Type *
                                  </Label>
                                  <Select
                                    value={trigger.trigger_type}
                                    onValueChange={(value) => {
                                      const newTriggerType = value as
                                        | "drycontact"
                                        | "numeric"
                                        | "schedule";
                                      updateTrigger(groupIndex, triggerIndex, {
                                        ...trigger,
                                        trigger_type: newTriggerType,
                                        device_name:
                                          newTriggerType === "schedule"
                                            ? undefined
                                            : "", // No device required for schedule
                                        device_topic:
                                          newTriggerType === "schedule"
                                            ? undefined
                                            : "",
                                        field_name:
                                          newTriggerType === "schedule"
                                            ? undefined
                                            : newTriggerType === "numeric"
                                            ? ""
                                            : trigger.field_name,
                                        pin_number:
                                          newTriggerType === "drycontact"
                                            ? 1
                                            : trigger.pin_number,
                                        condition_operator:
                                          newTriggerType === "schedule"
                                            ? "time_range"
                                            : newTriggerType === "drycontact"
                                            ? "is"
                                            : "greater_than",
                                        target_value:
                                          newTriggerType === "drycontact"
                                            ? true
                                            : newTriggerType === "numeric"
                                            ? 0
                                            : true,
                                        start_time:
                                          newTriggerType === "schedule"
                                            ? ""
                                            : undefined,
                                        end_time:
                                          newTriggerType === "schedule"
                                            ? ""
                                            : undefined,
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select trigger type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="drycontact">
                                        Boolean (Dry Contact/Switch)
                                      </SelectItem>
                                      <SelectItem value="numeric">
                                        Numeric (Sensor Value)
                                      </SelectItem>
                                      <SelectItem
                                        value="schedule"
                                        className="flex items-center gap-1"
                                      >
                                        Schedule (Time-based)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Device Selection or Schedule Configuration */}
                                {trigger.trigger_type === "schedule" ? (
                                  <div className="md:col-span-2">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      Schedule Configuration
                                    </Label>

                                    {/* Time Configuration - Start and End Time */}
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                      <div>
                                        <Label className="text-xs">
                                          Waktu ON (Start Time) *
                                        </Label>
                                        <Select
                                          value={trigger.start_time || ""}
                                          onValueChange={(value) =>
                                            updateTrigger(
                                              groupIndex,
                                              triggerIndex,
                                              {
                                                ...trigger,
                                                start_time: value,
                                              }
                                            )
                                          }
                                        >
                                          <SelectTrigger className="font-mono">
                                            <SelectValue placeholder="HH:MM" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {Array.from(
                                              { length: 24 * 60 },
                                              (_, index) => {
                                                const hour = Math.floor(
                                                  index / 60
                                                );
                                                const minute = index % 60;
                                                const h = hour
                                                  .toString()
                                                  .padStart(2, "0");
                                                const m = minute
                                                  .toString()
                                                  .padStart(2, "0");
                                                return (
                                                  <SelectItem
                                                    key={`${h}:${m}`}
                                                    value={`${h}:${m}`}
                                                  >
                                                    {`${h}:${m}`}
                                                  </SelectItem>
                                                );
                                              }
                                            )}
                                          </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          24-hour format (HH:MM)
                                        </p>
                                      </div>
                                      <div>
                                        <Label className="text-xs">
                                          Waktu OFF (End Time) *
                                        </Label>
                                        <Select
                                          value={trigger.end_time || ""}
                                          onValueChange={(value) =>
                                            updateTrigger(
                                              groupIndex,
                                              triggerIndex,
                                              {
                                                ...trigger,
                                                end_time: value,
                                              }
                                            )
                                          }
                                        >
                                          <SelectTrigger className="font-mono">
                                            <SelectValue placeholder="HH:MM" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {Array.from(
                                              { length: 24 * 60 },
                                              (_, index) => {
                                                const hour = Math.floor(
                                                  index / 60
                                                );
                                                const minute = index % 60;
                                                const h = hour
                                                  .toString()
                                                  .padStart(2, "0");
                                                const m = minute
                                                  .toString()
                                                  .padStart(2, "0");
                                                return (
                                                  <SelectItem
                                                    key={`${h}:${m}`}
                                                    value={`${h}:${m}`}
                                                  >
                                                    {`${h}:${m}`}
                                                  </SelectItem>
                                                );
                                              }
                                            )}
                                          </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          24-hour format (HH:MM)
                                        </p>
                                      </div>
                                    </div>

                                    {/* Active Days */}
                                    <div className="mt-3">
                                      <Label className="text-xs">
                                        Hari Aktif (Active Days) *
                                      </Label>
                                      <div className="grid grid-cols-7 gap-1 mt-1">
                                        {daysOfWeek.map(
                                          (day: {
                                            value: string;
                                            label: string;
                                          }) => {
                                            // For schedule triggers, we'll use active_days from a separate property or extract from target_value
                                            const activeDays =
                                              (trigger as any).active_days ||
                                              (trigger.trigger_type ===
                                              "schedule"
                                                ? [
                                                    "Mon",
                                                    "Tue",
                                                    "Wed",
                                                    "Thu",
                                                    "Fri",
                                                    "Sat",
                                                    "Sun",
                                                  ]
                                                : []);

                                            const isActive =
                                              activeDays?.includes(day.value);

                                            return (
                                              <Button
                                                key={day.value}
                                                type="button"
                                                variant={
                                                  isActive
                                                    ? "default"
                                                    : "outline"
                                                }
                                                size="sm"
                                                className="text-xs h-8 px-2"
                                                onClick={() => {
                                                  const currentDays =
                                                    (trigger as any)
                                                      .active_days ||
                                                    (trigger.trigger_type ===
                                                    "schedule"
                                                      ? [
                                                          "Mon",
                                                          "Tue",
                                                          "Wed",
                                                          "Thu",
                                                          "Fri",
                                                          "Sat",
                                                          "Sun",
                                                        ]
                                                      : []);
                                                  const newDays = isActive
                                                    ? currentDays.filter(
                                                        (d: string) =>
                                                          d !== day.value
                                                      )
                                                    : [
                                                        ...currentDays,
                                                        day.value,
                                                      ];

                                                  updateTrigger(
                                                    groupIndex,
                                                    triggerIndex,
                                                    {
                                                      ...trigger,
                                                      active_days: newDays,
                                                    }
                                                  );
                                                }}
                                              >
                                                {day.label.charAt(0)}
                                              </Button>
                                            );
                                          }
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Pilih hari-hari dalam seminggu dimana
                                        jadwal ini berlaku
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <Label className="text-xs">Device *</Label>
                                    <Select
                                      value={trigger.device_name}
                                      onValueChange={(value) => {
                                        const selectedDevice = allDevices.find(
                                          (d: {
                                            value: string;
                                            label: string;
                                            device?: any;
                                            topic?: string;
                                          }) => d.value === value
                                        );
                                        updateTrigger(
                                          groupIndex,
                                          triggerIndex,
                                          {
                                            ...trigger,
                                            device_name: value,
                                            device_topic:
                                              selectedDevice?.topic || "",
                                          }
                                        );
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select device" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {trigger.trigger_type ===
                                        "drycontact" ? (
                                          dryContactDevices.length === 0 ? (
                                            <SelectItem
                                              value="no-devices"
                                              disabled
                                            >
                                              No dry contact devices available
                                            </SelectItem>
                                          ) : (
                                            dryContactDevices.map((device) => (
                                              <SelectItem
                                                key={device.value}
                                                value={device.value}
                                              >
                                                {device.label}
                                              </SelectItem>
                                            ))
                                          )
                                        ) : sensorDevices.length === 0 ? (
                                          <SelectItem
                                            value="no-devices"
                                            disabled
                                          >
                                            No sensor devices available
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
                                )}
                              </div>
                            </div>

                            {/* Dynamic Fields based on trigger type - Only for device-based triggers */}
                            {trigger.trigger_type !== "schedule" && (
                              <div className="space-y-3">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Device Field Configuration
                                </Label>
                                {trigger.trigger_type === "drycontact" ? (
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">
                                      Field Name *
                                    </Label>
                                    <Select
                                      value={trigger.field_name || ""}
                                      onValueChange={(value) =>
                                        updateTrigger(
                                          groupIndex,
                                          triggerIndex,
                                          {
                                            ...trigger,
                                            field_name: value,
                                          }
                                        )
                                      }
                                      disabled={
                                        !trigger.device_name ||
                                        modularAvailableFields.length === 0
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select field from device profile" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {!trigger.device_name ? (
                                          <SelectItem
                                            value="no-device"
                                            disabled
                                          >
                                            Select device first
                                          </SelectItem>
                                        ) : modularAvailableFields.length ===
                                          0 ? (
                                          <SelectItem
                                            value="no-fields"
                                            disabled
                                          >
                                            No boolean fields available for{" "}
                                            {trigger.device_name}
                                          </SelectItem>
                                        ) : (
                                          modularAvailableFields.map(
                                            (field) => (
                                              <SelectItem
                                                key={field.var_name}
                                                value={field.var_name}
                                              >
                                                {field.var_name} (Boolean)
                                              </SelectItem>
                                            )
                                          )
                                        )}
                                      </SelectContent>
                                    </Select>
                                    {/* Show available boolean fields count and tooltip */}
                                    {trigger.device_name &&
                                      modularAvailableFields.length > 0 && (
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {modularAvailableFields.length}{" "}
                                          boolean field
                                          {modularAvailableFields.length !== 1
                                            ? "s"
                                            : ""}{" "}
                                          available from{" "}
                                          {modularDevice?.manufacturer}{" "}
                                          {modularDevice?.part_number}
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <div className="md:col-span-2">
                                    <Label className="text-xs">
                                      Field Name *
                                    </Label>
                                    <Select
                                      value={trigger.field_name || ""}
                                      onValueChange={(value) =>
                                        updateTrigger(
                                          groupIndex,
                                          triggerIndex,
                                          {
                                            ...trigger,
                                            field_name: value,
                                          }
                                        )
                                      }
                                      disabled={
                                        !trigger.device_name ||
                                        availableFields.length === 0
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select field from device profile" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {!trigger.device_name ? (
                                          <SelectItem
                                            value="no-device"
                                            disabled
                                          >
                                            Select device first
                                          </SelectItem>
                                        ) : availableFields.length === 0 ? (
                                          <SelectItem
                                            value="no-fields"
                                            disabled
                                          >
                                            No fields available for{" "}
                                            {trigger.device_name}
                                          </SelectItem>
                                        ) : (
                                          availableFields.map((field) => (
                                            <SelectItem
                                              key={field.var_name}
                                              value={field.var_name}
                                            >
                                              {field.var_name} (
                                              {field.data_type})
                                            </SelectItem>
                                          ))
                                        )}
                                      </SelectContent>
                                    </Select>
                                    {/* Show available fields count and tooltip */}
                                    {trigger.device_name &&
                                      availableFields.length > 0 && (
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {availableFields.length} field
                                          {availableFields.length !== 1
                                            ? "s"
                                            : ""}{" "}
                                          available from{" "}
                                          {selectedDevice?.manufacturer}{" "}
                                          {selectedDevice?.part_number}
                                        </div>
                                      )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Condition Configuration - Only show for device-based triggers */}
                            {trigger.trigger_type !== "schedule" && (
                              <div className="space-y-3">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Condition Settings
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Condition Operator */}
                                  <div>
                                    <Label className="text-xs">
                                      Operator *
                                    </Label>
                                    <Select
                                      value={trigger.condition_operator}
                                      onValueChange={(value) =>
                                        updateTrigger(
                                          groupIndex,
                                          triggerIndex,
                                          {
                                            ...trigger,
                                            condition_operator: value,
                                            target_value:
                                              value === "between" &&
                                              trigger.trigger_type === "numeric"
                                                ? [0, 0]
                                                : value === "between" &&
                                                  trigger.trigger_type ===
                                                    "drycontact"
                                                ? trigger.target_value
                                                : value === "is" &&
                                                  trigger.trigger_type ===
                                                    "drycontact"
                                                ? true
                                                : trigger.trigger_type ===
                                                  "numeric"
                                                ? 0
                                                : trigger.target_value,
                                          }
                                        )
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(
                                          conditionOperators[
                                            trigger.trigger_type
                                          ] || []
                                        ).map((op) => (
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

                                  {/* Target Value - Dynamic based on type and operator */}
                                  {trigger.trigger_type === "drycontact" ? (
                                    <div>
                                      <Label className="text-xs">
                                        Target Value *
                                      </Label>
                                      <Select
                                        value={trigger.target_value.toString()}
                                        onValueChange={(value) =>
                                          updateTrigger(
                                            groupIndex,
                                            triggerIndex,
                                            {
                                              ...trigger,
                                              target_value: value === "true",
                                            }
                                          )
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="true">
                                            TRUE (ON/HIGH)
                                          </SelectItem>
                                          <SelectItem value="false">
                                            FALSE (OFF/LOW)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : trigger.condition_operator ===
                                    "between" ? (
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
                                                  parseFloat(e.target.value) ||
                                                    0,
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
                                                  parseFloat(e.target.value) ||
                                                    0,
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
                                          typeof trigger.target_value ===
                                          "number"
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
                            )}

                            {/* TRIGGER DELAYS REMOVED - now handled at action level */}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions - Same as before */}
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
                    Define what happens when mixed trigger conditions are met
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

                    {/* Description - moved to top */}
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

                    {/* Action Configuration */}
                    {action.action_type === "control_relay" && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Relay Control Configuration
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Relay Device</Label>
                            <Select
                              value={action.target_device}
                              onValueChange={(value) => {
                                const selectedDevice = relayDevices.find(
                                  (d: {
                                    value: string;
                                    label: string;
                                    address?: number;
                                    device_bus?: number;
                                    mac?: string;
                                  }) => d.value === value
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

                          {/* Latching Toggle */}
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`latching-${actionIndex}`}
                              checked={action.latching || false}
                              onCheckedChange={(checked) =>
                                updateAction(actionIndex, {
                                  ...action,
                                  latching: checked,
                                })
                              }
                            />
                            <Label
                              htmlFor={`latching-${actionIndex}`}
                              className="text-xs font-medium"
                            >
                              Latching Mode
                            </Label>
                          </div>
                        </div>
                      </div>
                    )}

                    {action.action_type === "send_message" && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Message Configuration
                        </Label>

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

                    {/* Action Delay Configuration */}
                    <div className="mt-4 space-y-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Action Delay Timing (Optional)
                      </Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Delay ON (seconds)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={action.delay_on || 0}
                            onChange={(e) =>
                              updateAction(actionIndex, {
                                ...action,
                                delay_on: parseInt(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Wait before executing when rule triggers
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs">Delay OFF (seconds)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={action.delay_off || 0}
                            onChange={(e) =>
                              updateAction(actionIndex, {
                                ...action,
                                delay_off: parseInt(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Wait before stopping when rule stops
                          </p>
                        </div>
                      </div>
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

export default UnifiedAutomationControl;
