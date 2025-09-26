"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Swal from "sweetalert2";
import { v4 as uuidv4 } from "uuid";
import { connectMQTT, getMQTTClient, disconnectMQTT } from "@/lib/mqttClient";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Brain,
  Activity,
  Code,
} from "lucide-react";
import MqttStatus from "@/components/mqtt-status";

// Type definitions for updated requirements
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

interface AutomationLogicRule {
  id: string;
  rule_name: string;
  description: string;
  group_rule_name: string;
  created_at?: string;
  updated_at?: string;
  trigger_groups: TriggerGroup[];
  actions: ControlAction[];
}

interface AutomationLogicConfig {
  logic_rules: AutomationLogicRule[];
}

interface ModularDevice {
  name: string;
  address: number;
  device_bus: number;
  part_number: string;
  mac: string;
  device_type: string;
  manufacturer: string;
}

interface MQTTResponse {
  status: "success" | "error";
  message: string;
  data?: any;
  id?: string;
  count?: number;
  timestamp?: string;
}

const AutomationLogicControl = () => {
  // MQTT Topics - simplified for new middleware
  const TOPICS = useMemo(
    () => ({
      // Unified Command Topic
      COMMAND: "command_control_logic",

      // Unified Response Topic
      RESPONSE: "response_control_logic",

      // Device Topics
      MODULAR_AVAILABLES: "MODULAR_DEVICE/AVAILABLES",
      RESULT_MESSAGE: "result/message/logic/control",
    }),
    []
  );

  // Connection Status
  const [mqttConnectionStatus, setMqttConnectionStatus] =
    useState("Disconnected");

  // Data States
  const [automationConfig, setAutomationConfig] =
    useState<AutomationLogicConfig>({
      logic_rules: [],
    });
  const [modularDevices, setModularDevices] = useState<ModularDevice[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // Form States
  const [currentRule, setCurrentRule] = useState<AutomationLogicRule>({
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

  // Available condition operators for updated logic
  const conditionOperators = [
    { value: "is", label: "Is" },
    { value: "and", label: "And" },
    { value: "or", label: "Or" },
  ];

  // Available dry contact pins (1-10 based on modular devices)
  const dryContactPins = Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    label: `Pin ${i + 1}`,
  }));

  // Available relay pins (1-8 based on relay modules)
  const relayPins = Array.from({ length: 8 }, (_, i) => ({
    value: i + 1,
    label: `Relay Pin ${i + 1}`,
  }));

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
      Swal.fire({
        icon: "error",
        title: "MQTT Disconnected",
        text: "Cannot send command, MQTT client is not connected.",
      });
    }
  }, []);

  // CRUD Operations matching new simplified backend
  const createRule = useCallback(
    (rule: AutomationLogicRule) => {
      setLoading(true);
      const ruleData = {
        ...rule,
        id: uuidv4(),
        created_at: new Date().toISOString(),
      };
      publishMQTT(TOPICS.COMMAND, { action: "add", data: ruleData });
    },
    [publishMQTT, TOPICS.COMMAND]
  );

  const updateRule = useCallback(
    (rule: AutomationLogicRule) => {
      setLoading(true);
      const ruleData = {
        ...rule,
        updated_at: new Date().toISOString(),
      };
      publishMQTT(TOPICS.COMMAND, { action: "set", data: ruleData });
    },
    [publishMQTT, TOPICS.COMMAND]
  );

  const deleteRule = useCallback(
    (ruleId: string) => {
      setLoading(true);
      publishMQTT(TOPICS.COMMAND, { action: "delete", data: { id: ruleId } });
    },
    [publishMQTT, TOPICS.COMMAND]
  );

  const refreshData = useCallback(() => {
    setLoading(true);
    publishMQTT(TOPICS.COMMAND, { action: "get" });
  }, [publishMQTT, TOPICS.COMMAND]);

  // Load modular devices from MODULAR_DEVICE/AVAILABLES
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
          currentClient.subscribe([TOPICS.RESPONSE, TOPICS.MODULAR_AVAILABLES]);

          console.log("Subscribed to automation logic topics");

          // Load initial data
          setTimeout(() => {
            refreshData();
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
                  setAutomationConfig({ logic_rules: payload.data });
                  console.log("Automation config loaded:", payload.data);
                  setLoading(false);
                } else {
                  // This is a CRUD response
                  handleCRUDResponse(payload);
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
            Swal.fire({
              icon: "error",
              title: "Parsing Error",
              text: "An error occurred while processing the response.",
            });
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
  }, [TOPICS, refreshData, loadModularDevices]);

  // Handle CRUD Response
  const handleCRUDResponse = (payload: MQTTResponse) => {
    setLoading(false);

    if (payload.status === "success") {
      Swal.fire({
        icon: "success",
        title: "Success",
        text: payload.message,
        timer: 2000,
        showConfirmButton: false,
      });

      // Refresh data after successful operation
      setTimeout(() => {
        refreshData();
      }, 500);

      // Close modal if open
      if (isModalOpen) {
        closeModal();
      }
    } else {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: payload.message || "An error occurred",
      });
    }
  };

  // Modal Functions
  const openModal = (rule?: AutomationLogicRule) => {
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
                device_mac: "",
                device_address: 0,
                device_bus: 0,
                trigger_type: "drycontact",
                pin_number: 1,
                condition_operator: "is",
                target_value: true,
                expected_value: true,
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
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please enter a rule name.",
      });
      return;
    }

    if (!currentRule.group_rule_name.trim()) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please enter a group rule name.",
      });
      return;
    }

    if (currentRule.trigger_groups.length === 0) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please add at least one trigger group.",
      });
      return;
    }

    if (currentRule.actions.length === 0) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please add at least one action.",
      });
      return;
    }

    // Validate trigger groups
    for (const group of currentRule.trigger_groups) {
      if (group.triggers.length === 0) {
        Swal.fire({
          icon: "error",
          title: "Validation Error",
          text: `Trigger group "${group.group_name}" must have at least one trigger.`,
        });
        return;
      }

      for (const trigger of group.triggers) {
        if (!trigger.device_name) {
          Swal.fire({
            icon: "error",
            title: "Validation Error",
            text: "All triggers must have a device name.",
          });
          return;
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

  const confirmDelete = (rule: AutomationLogicRule) => {
    Swal.fire({
      title: "Delete Automation Rule",
      text: `Are you sure you want to delete "${rule.rule_name}"? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        deleteRule(rule.id);
      }
    });
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
              device_mac: "",
              device_address: 0,
              device_bus: 0,
              trigger_type: "drycontact",
              pin_number: 1,
              condition_operator: "is",
              target_value: true,
              expected_value: true,
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
          device_mac: "",
          device_address: 0,
          device_bus: 0,
          trigger_type: "drycontact" as const,
          pin_number: 1,
          condition_operator: "is" as const,
          target_value: true,
          expected_value: true,
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

  // Get drycontact devices for triggers (handle flattened structure from backend)
  const dryContactDevices = useMemo(() => {
    if (!modularDevices || modularDevices.length === 0) return [];

    return modularDevices
      .filter(
        (device) => device?.name && device?.part_number === "DRYCONTACT" // Filter only DRYCONTACT devices
      )
      .map((device) => ({
        value: device.name,
        label: device.name,
        address: device.address || 0,
        device_bus: device.device_bus || 0,
        mac: device.mac || "00:00:00:00:00:00",
      }));
  }, [modularDevices]);

  // Get relay devices for actions (handle flattened structure from backend)
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
  const totalRules = automationConfig?.logic_rules?.length || 0;
  const totalTriggers =
    automationConfig?.logic_rules?.reduce(
      (sum: number, rule: AutomationLogicRule) =>
        sum +
        (rule.trigger_groups?.reduce(
          (groupSum: number, group) => groupSum + (group.triggers?.length || 0),
          0
        ) || 0),
      0
    ) || 0;
  const totalActions =
    automationConfig?.logic_rules?.reduce(
      (sum: number, rule: AutomationLogicRule) =>
        sum + (rule.actions?.length || 0),
      0
    ) || 0;
  const totalPages = Math.ceil(
    (automationConfig?.logic_rules?.length || 0) / itemsPerPage
  );

  const summaryItems = [
    { label: "Total Rules", value: totalRules, icon: Brain },
    {
      label: "Trigger Groups",
      value:
        automationConfig?.logic_rules?.reduce(
          (sum, rule) => sum + (rule.trigger_groups?.length || 0),
          0
        ) || 0,
      icon: Activity,
      variant: "default" as const,
    },
    {
      label: "Triggers",
      value: totalTriggers,
      icon: Code,
      variant: "secondary" as const,
    },
    {
      label: "Actions",
      value: totalActions,
      icon: Zap,
      variant: "outline" as const,
    },
  ];

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Brain className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Automation Logic Control</h1>
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
            Add Logic Rule
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Summary Cards - Modern Design */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <CardTitle>Automation Logic Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl border">
                <Brain className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {totalRules}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  Logic Rules
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl border">
                <Activity className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {automationConfig?.logic_rules?.reduce(
                    (sum, rule) => sum + (rule.trigger_groups?.length || 0),
                    0
                  ) || 0}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Trigger Groups
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-xl border">
                <Code className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {totalTriggers}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">
                  Triggers
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 rounded-xl border">
                <Zap className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {totalActions}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Actions
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logic Rules Table - Simplified */}
        <div className="rounded-lg border bg-background shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">
              Logic Rules ({automationConfig.logic_rules.length})
            </h3>
          </div>
          <div className="p-4">
            {automationConfig.logic_rules.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No logic rules found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first automation logic rule to get started
                </p>
                <Button onClick={() => openModal()}>Add Logic Rule</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-4 text-left font-medium">#</th>
                      <th className="p-4 text-left font-medium">Rule Name</th>
                      <th className="p-4 text-left font-medium">Description</th>
                      <th className="p-4 text-center font-medium">Groups</th>
                      <th className="p-4 text-center font-medium">Actions</th>
                      <th className="p-4 text-center font-medium">Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automationConfig.logic_rules
                      .slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage
                      )
                      .map((rule, index) => (
                        <tr
                          key={rule.id}
                          className="border-b hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-4 text-center font-medium text-muted-foreground">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="p-4">
                            <div className="font-medium">{rule.rule_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {rule.group_rule_name}
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {rule.description || "No description"}
                          </td>
                          <td className="p-4 text-center">
                            <Badge variant="outline">
                              {rule.trigger_groups.length}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <Badge variant="outline">
                              {rule.actions.length}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2 justify-center">
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
                                onClick={() => confirmDelete(rule)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * itemsPerPage + 1,
                        automationConfig.logic_rules.length
                      )}{" "}
                      to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        automationConfig.logic_rules.length
                      )}{" "}
                      of {automationConfig.logic_rules.length} results
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

      {/* Logic Rule Dialog */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <DialogTitle>
                {isEditing ? "Edit Logic Rule" : "Create Logic Rule"}
              </DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure advanced automation logic with conditions and actions
            </p>
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

            {/* Logic Groups - Simplified */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Logic Groups
                </div>
              </h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Define conditions that trigger this automation rule
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

                      {group.triggers.map((trigger, triggerIndex) => (
                        <div
                          key={triggerIndex}
                          className="p-3 bg-muted/30 rounded-md space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">
                              Trigger {triggerIndex + 1}
                            </Label>
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

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Device Selection */}
                            <div>
                              <Label className="text-xs">Device</Label>
                              <Select
                                value={trigger.device_name}
                                onValueChange={(value) => {
                                  const selectedDevice = dryContactDevices.find(
                                    (d) => d.value === value
                                  );
                                  updateTrigger(groupIndex, triggerIndex, {
                                    ...trigger,
                                    device_name: value,
                                    device_mac: selectedDevice?.mac || "",
                                    device_address:
                                      selectedDevice?.address || 0,
                                    device_bus: selectedDevice?.device_bus || 0,
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select drycontact device" />
                                </SelectTrigger>
                                <SelectContent>
                                  {dryContactDevices.map((device) => (
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

                            {/* Pin Number */}
                            <div>
                              <Label className="text-xs">Pin Number</Label>
                              <Select
                                value={trigger.pin_number.toString()}
                                onValueChange={(value) =>
                                  updateTrigger(groupIndex, triggerIndex, {
                                    ...trigger,
                                    pin_number: parseInt(value),
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select pin" />
                                </SelectTrigger>
                                <SelectContent>
                                  {dryContactPins.map((pin) => (
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

                            {/* Condition Operator */}
                            <div>
                              <Label className="text-xs">Operator</Label>
                              <Select
                                value={trigger.condition_operator}
                                onValueChange={(value) =>
                                  updateTrigger(groupIndex, triggerIndex, {
                                    ...trigger,
                                    condition_operator: value as
                                      | "is"
                                      | "and"
                                      | "or",
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {conditionOperators.map((op) => (
                                    <SelectItem key={op.value} value={op.value}>
                                      {op.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Target Value */}
                            <div>
                              <Label className="text-xs">Condition</Label>
                              <Select
                                value={trigger.target_value.toString()}
                                onValueChange={(value) =>
                                  updateTrigger(groupIndex, triggerIndex, {
                                    ...trigger,
                                    target_value: value === "true",
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">True</SelectItem>
                                  <SelectItem value="false">False</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Delay Settings */}
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
                                    delay_off: parseInt(e.target.value) || 0,
                                  })
                                }
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions - Simplified */}
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
                                {relayPins.map((pin) => (
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

                        {/* WhatsApp Message Configuration - Always shown for send_message actions */}
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
                                    message_type: "whatsapp", // Always set to whatsapp
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
                                    message_type: "whatsapp", // Always set to whatsapp
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
                                  message_type: "whatsapp", // Always set to whatsapp
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
                                    message_type: "whatsapp", // Always set to whatsapp
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
                                    message_type: "whatsapp", // Always set to whatsapp
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
              <Button type="submit">
                {isEditing ? "Update Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
};

export default AutomationLogicControl;
