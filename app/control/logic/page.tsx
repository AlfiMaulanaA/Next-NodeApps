"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import { v4 as uuidv4 } from 'uuid';
import { connectMQTT, getMQTTClient, disconnectMQTT } from '@/lib/mqttClient';

// UI Components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RotateCw, Zap, PlusCircle, Trash2, Edit2, Play, Pause, Settings2, AlertTriangle, Brain, Activity, Code } from "lucide-react";
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
  delay_on?: number;  // delay in seconds before trigger activates
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
  profile: {
    name: string;
    part_number: string;
    device_type: string;
    manufacturer: string;
    topic?: string;
  };
  protocol_setting: {
    address: number;
    device_bus: number;
  };
  mac?: string;
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
  // MQTT Topics - updated for new requirements
  const TOPICS = useMemo(() => ({
    // CRUD Topics
    CREATE: "automation_logic/create",
    READ: "automation_logic/read", 
    UPDATE: "automation_logic/update",
    DELETE: "automation_logic/delete",
    GET: "automation_logic/get",
    
    // Response Topics
    RESPONSE: "response_automation_logic",
    RESPONSE_GET: "response_get_data",
    
    // Device Topics
    MODULAR_AVAILABLES: "MODULAR_DEVICE/AVAILABLES",
    RESULT_MESSAGE: "result/message/logic/control"
  }), []);

  // Connection Status
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState('Disconnected');
  
  // Data States
  const [automationConfig, setAutomationConfig] = useState<AutomationLogicConfig>({
    logic_rules: []
  });
  const [modularDevices, setModularDevices] = useState<ModularDevice[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  
  // Form States
  const [currentRule, setCurrentRule] = useState<AutomationLogicRule>({
    id: '',
    rule_name: '',
    description: '',
    group_rule_name: '',
    trigger_groups: [],
    actions: []
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Available condition operators for updated logic
  const conditionOperators = [
    { value: "is", label: "Is" },
    { value: "and", label: "And" },
    { value: "or", label: "Or" }
  ];

  // Available dry contact pins (1-10 based on modular devices)
  const dryContactPins = Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    label: `Pin ${i + 1}`
  }));

  // Available relay pins (1-8 based on relay modules)  
  const relayPins = Array.from({ length: 8 }, (_, i) => ({
    value: i + 1,
    label: `Relay Pin ${i + 1}`
  }));

  // MQTT Publishing Function
  const publishMQTT = useCallback((topic: string, message: any) => {
    const client = getMQTTClient();
    if (client && client.connected) {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
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

  // CRUD Operations matching backend structure
  const createRule = useCallback((rule: AutomationLogicRule) => {
    setLoading(true);
    const ruleData = {
      ...rule,
      id: uuidv4(),
      created_at: new Date().toISOString()
    };
    publishMQTT(TOPICS.CREATE, { action: "add", data: ruleData });
  }, [publishMQTT, TOPICS.CREATE]);

  const updateRule = useCallback((rule: AutomationLogicRule) => {
    setLoading(true);
    const ruleData = {
      ...rule,
      updated_at: new Date().toISOString()
    };
    publishMQTT(TOPICS.UPDATE, { action: "set", data: ruleData });
  }, [publishMQTT, TOPICS.UPDATE]);

  const deleteRule = useCallback((ruleId: string) => {
    setLoading(true);
    publishMQTT(TOPICS.DELETE, { action: "delete", data: { id: ruleId } });
  }, [publishMQTT, TOPICS.DELETE]);

  const refreshData = useCallback(() => {
    setLoading(true);
    publishMQTT(TOPICS.GET, "get_data");
  }, [publishMQTT, TOPICS.GET]);

  // Load modular devices from MODULAR_DEVICE/AVAILABLES
  const loadModularDevices = useCallback(() => {
    publishMQTT("command_available_device", "get_modular_devices");
  }, [publishMQTT]);

  // MQTT Connection and Message Handling
  useEffect(() => {
    let currentClient: any = null;

    if (typeof window !== 'undefined') {
      try {
        currentClient = connectMQTT();

        currentClient.on("connect", () => {
          console.log("Connected to MQTT Broker");
          setMqttConnectionStatus("Connected");
          
          // Subscribe to all required topics
          currentClient.subscribe([
            TOPICS.RESPONSE,
            TOPICS.RESPONSE_GET,
            TOPICS.MODULAR_AVAILABLES
          ]);
          
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
                handleCRUDResponse(payload);
                break;
                
              case TOPICS.RESPONSE_GET:
                if (payload.status === "success" && payload.data) {
                  setAutomationConfig(payload.data);
                  console.log("Automation config loaded:", payload.data);
                }
                setLoading(false);
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
                      console.log("Modular devices loaded (direct):", devices.length);
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
        showConfirmButton: false
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
        id: '',
        rule_name: '',
        description: '',
        group_rule_name: '',
        trigger_groups: [{
          group_name: 'Trigger Group 1',
          group_operator: 'AND',
          triggers: [{
            device_name: '',
            device_mac: '',
            device_address: 0,
            device_bus: 0,
            trigger_type: 'drycontact',
            pin_number: 1,
            condition_operator: 'is',
            target_value: true,
            expected_value: true,
            delay_on: 0,
            delay_off: 0
          }]
        }],
        actions: [{
          action_type: 'control_relay',
          target_device: '',
          target_mac: '',
          target_address: 0,
          target_bus: 0,
          relay_pin: 1,
          target_value: true
        }]
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setSelectedRuleId(null);
    setCurrentRule({
      id: '',
      rule_name: '',
      description: '',
      group_rule_name: '',
      trigger_groups: [],
      actions: []
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
      title: 'Delete Automation Rule',
      text: `Are you sure you want to delete "${rule.rule_name}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteRule(rule.id);
      }
    });
  };

  // Helper functions for trigger group management
  const addTriggerGroup = () => {
    setCurrentRule(prev => ({
      ...prev,
      trigger_groups: [
        ...prev.trigger_groups,
        {
          group_name: `Trigger Group ${prev.trigger_groups.length + 1}`,
          group_operator: 'AND',
          triggers: [{
            device_name: '',
            device_mac: '',
            device_address: 0,
            device_bus: 0,
            trigger_type: 'drycontact',
            pin_number: 1,
            condition_operator: 'is',
            target_value: true,
            expected_value: true,
            delay_on: 0,
            delay_off: 0
          }]
        }
      ]
    }));
  };

  const removeTriggerGroup = (index: number) => {
    setCurrentRule(prev => ({
      ...prev,
      trigger_groups: prev.trigger_groups.filter((_, i) => i !== index)
    }));
  };

  const updateTriggerGroup = (index: number, updatedGroup: TriggerGroup) => {
    setCurrentRule(prev => ({
      ...prev,
      trigger_groups: prev.trigger_groups.map((group, i) => 
        i === index ? updatedGroup : group
      )
    }));
  };

  const addTrigger = (groupIndex: number) => {
    const updatedGroup = {
      ...currentRule.trigger_groups[groupIndex],
      triggers: [
        ...currentRule.trigger_groups[groupIndex].triggers,
        {
          device_name: '',
          device_mac: '',
          device_address: 0,
          device_bus: 0,
          trigger_type: 'drycontact' as const,
          pin_number: 1,
          condition_operator: 'is' as const,
          target_value: true,
          expected_value: true,
          delay_on: 0,
          delay_off: 0
        }
      ]
    };
    updateTriggerGroup(groupIndex, updatedGroup);
  };

  const removeTrigger = (groupIndex: number, triggerIndex: number) => {
    const updatedGroup = {
      ...currentRule.trigger_groups[groupIndex],
      triggers: currentRule.trigger_groups[groupIndex].triggers.filter((_, i) => i !== triggerIndex)
    };
    updateTriggerGroup(groupIndex, updatedGroup);
  };

  const updateTrigger = (groupIndex: number, triggerIndex: number, updatedTrigger: TriggerCondition) => {
    const updatedGroup = {
      ...currentRule.trigger_groups[groupIndex],
      triggers: currentRule.trigger_groups[groupIndex].triggers.map((trigger, i) => 
        i === triggerIndex ? updatedTrigger : trigger
      )
    };
    updateTriggerGroup(groupIndex, updatedGroup);
  };

  const addAction = () => {
    setCurrentRule(prev => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          action_type: 'control_relay',
          target_device: '',
          target_mac: '',
          target_address: 0,
          target_bus: 0,
          relay_pin: 1,
          target_value: true
        }
      ]
    }));
  };

  const removeAction = (index: number) => {
    setCurrentRule(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const updateAction = (index: number, updatedAction: ControlAction) => {
    setCurrentRule(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? updatedAction : action
      )
    }));
  };

  // Get device names for dropdowns
  const deviceNames = useMemo(() => {
    if (!modularDevices || modularDevices.length === 0) return [];
    
    return modularDevices
      .filter(device => device?.profile?.name)
      .map(device => ({
        value: device.profile.name,
        label: device.profile.name,
        address: device.protocol_setting?.address || 0,
        device_bus: device.protocol_setting?.device_bus || 0,
        mac: device.mac || '00:00:00:00:00:00'
      }));
  }, [modularDevices]);

  // Get relay devices for actions
  const relayDevices = useMemo(() => {
    if (!modularDevices || modularDevices.length === 0) return [];
    
    return modularDevices
      .filter(device => 
        device?.profile?.part_number === 'RELAY' || 
        device?.profile?.part_number === 'RELAYMINI'
      )
      .filter(device => device?.profile?.name)
      .map(device => ({
        value: device.profile.name,
        label: device.profile.name,
        address: device.protocol_setting?.address || 0,
        device_bus: device.protocol_setting?.device_bus || 0,
        mac: device.mac || '00:00:00:00:00:00'
      }));
  }, [modularDevices]);

  // Calculate summary data
  const totalRules = automationConfig?.logic_rules?.length || 0;
  const totalTriggers = automationConfig?.logic_rules?.reduce((sum: number, rule: AutomationLogicRule) => 
    sum + (rule.trigger_groups?.reduce((groupSum: number, group) => groupSum + (group.triggers?.length || 0), 0) || 0), 0
  ) || 0;
  const totalActions = automationConfig?.logic_rules?.reduce((sum: number, rule: AutomationLogicRule) => sum + (rule.actions?.length || 0), 0) || 0;
  const totalPages = Math.ceil((automationConfig?.logic_rules?.length || 0) / itemsPerPage);

  const summaryItems = [
    { label: "Total Rules", value: totalRules, icon: Brain },
    { label: "Trigger Groups", value: automationConfig?.logic_rules?.reduce((sum, rule) => sum + (rule.trigger_groups?.length || 0), 0) || 0, icon: Activity, variant: "default" as const },
    { label: "Triggers", value: totalTriggers, icon: Code, variant: "secondary" as const },
    { label: "Actions", value: totalActions, icon: Zap, variant: "outline" as const }
  ];

  const tableColumns = [
    { key: 'name', label: 'Rule Name', sortable: true },
    { key: 'description', label: 'Description', render: (value: any) => value || "No description" },
    { 
      key: 'enabled', 
      label: 'Status', 
      className: 'text-center', 
      render: (value: any) => (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Enabled" : "Disabled"}
        </Badge>
      )
    },
    { 
      key: 'groups', 
      label: 'Logic Groups', 
      className: 'text-center', 
      render: (value: any, item: any) => (
        <Badge variant="outline">{item.trigger_groups.length} Groups</Badge>
      )
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      className: 'text-center', 
      render: (value: any, item: any) => (
        <Badge variant="outline">{item.actions.length} Actions</Badge>
      )
    },
    { 
      key: 'operator', 
      label: 'Logic', 
      className: 'text-center', 
      render: (value: any, item: any) => (
        <Badge variant={item.rule_logic_operator === "AND" ? "default" : "secondary"}>
          {item.rule_logic_operator}
        </Badge>
      )
    }
  ];

  const tableActions = [
    { icon: Edit2, label: 'Edit', onClick: (item: any) => openModal(item) },
    { icon: Trash2, label: 'Delete', variant: 'destructive' as const, onClick: (item: any) => deleteRule(item.id) }
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
          <Button
            size="sm"
            onClick={() => openModal()}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Logic Rule
          </Button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary Cards */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <CardTitle>Logic Control Summary</CardTitle>
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

        {/* System Status Card */}
        <div className="p-4 bg-muted/20 rounded-lg border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">Automation Logic System</span>
            <Badge variant="default">
              Running
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Total Devices: {modularDevices.length}
          </div>
        </div>

        {/* Logic Rules Table */}
        <Card>
          <CardHeader>
            <CardTitle>Logic Rules ({automationConfig.logic_rules.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {automationConfig.logic_rules.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No logic rules found</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first automation logic rule to get started
                </p>
                <Button onClick={() => openModal()}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Logic Rule
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Group Rule Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Trigger Groups</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {automationConfig.logic_rules
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.rule_name}</TableCell>
                        <TableCell className="font-medium text-primary">{rule.group_rule_name}</TableCell>
                        <TableCell>{rule.description || "No description"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{rule.trigger_groups.length} Groups</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{rule.actions.length} Actions</Badge>
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
                              onClick={() => confirmDelete(rule)}
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
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {Math.min((currentPage - 1) * itemsPerPage + 1, automationConfig.logic_rules.length)} to{" "}
                      {Math.min(currentPage * itemsPerPage, automationConfig.logic_rules.length)} of {automationConfig.logic_rules.length} results
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logic Rule Dialog */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <DialogTitle>
                {isEditing ? 'Edit Logic Rule' : 'Create Logic Rule'}
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
                    value={currentRule.name}
                    onChange={(e) => setCurrentRule(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter rule name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={currentRule.enabled}
                      onCheckedChange={(checked) => setCurrentRule(prev => ({ ...prev, enabled: checked }))}
                    />
                    <Label>{currentRule.enabled ? 'Enabled' : 'Disabled'}</Label>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="ruleDescription">Description</Label>
                  <Textarea
                    id="ruleDescription"
                    value={currentRule.description}
                    onChange={(e) => setCurrentRule(prev => ({ ...prev, description: e.target.value }))}
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
                  <div key={groupIndex} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <Label>Group Name</Label>
                        <Input
                          value={group.group_name}
                          onChange={(e) => updateTriggerGroup(groupIndex, { ...group, group_name: e.target.value })}
                          placeholder="Enter group name"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeTriggerGroup(groupIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {group.triggers.length} trigger(s) defined
                    </div>
                    
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
                  <div key={actionIndex} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <Label>Action Type</Label>
                        <Select
                          value={action.action_type}
                          onValueChange={(value) => updateAction(actionIndex, { ...action, action_type: value as "control_relay" | "send_message" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select action type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="control_relay">Control Relay</SelectItem>
                            <SelectItem value="send_message">Send Message</SelectItem>
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
                    
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={action.description || ''}
                        onChange={(e) => updateAction(actionIndex, { ...action, description: e.target.value })}
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