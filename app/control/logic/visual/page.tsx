"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Icons
import {
  Zap,
  Play,
  Save,
  RotateCcw,
  Settings,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Brain,
  Activity,
  Target,
  Code,
} from "lucide-react";

// MQTT
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import MqttStatus from "@/components/mqtt-status";

// Types
interface TriggerNodeData {
  device_name: string;
  pin_number: number;
  condition_operator: "is" | "and" | "or";
  target_value: boolean;
  delay_on?: number;
  delay_off?: number;
  label: string;
}

interface ActionNodeData {
  action_type: "control_relay" | "send_message";
  device_name?: string;
  pin?: number;
  target_value?: boolean;
  message?: string;
  label: string;
}

interface LogicNodeData {
  operator: "AND" | "OR";
  label: string;
}

// Custom Node Components
function TriggerNode({ data }: { data: TriggerNodeData }) {
  return (
    <Card className="min-w-[200px] border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-500" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Device:</span>
            <Badge variant="outline" className="text-xs">
              {data.device_name}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pin:</span>
            <span>{data.pin_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Condition:</span>
            <span>
              {data.condition_operator} {data.target_value ? "ON" : "OFF"}
            </span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t">
          <div className="text-xs text-green-600 font-medium">
            TRIGGER OUTPUT
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionNode({ data }: { data: ActionNodeData }) {
  return (
    <Card className="min-w-[200px] border-l-4 border-l-orange-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-orange-500" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs space-y-1">
          {data.action_type === "control_relay" ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device:</span>
                <Badge variant="outline" className="text-xs">
                  {data.device_name}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pin:</span>
                <span>{data.pin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action:</span>
                <span>{data.target_value ? "ON" : "OFF"}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Message:</span>
              <span className="truncate max-w-[120px]">{data.message}</span>
            </div>
          )}
        </div>
        <div className="mt-2 pt-2 border-t">
          <div className="text-xs text-blue-600 font-medium">ACTION INPUT</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LogicNode({ data }: { data: LogicNodeData }) {
  return (
    <Card className="min-w-[150px] border-l-4 border-l-purple-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-center">
          <Badge variant="outline" className="text-xs font-bold">
            {data.operator}
          </Badge>
        </div>
        <div className="mt-2 pt-2 border-t space-y-1">
          <div className="text-xs text-blue-600 font-medium">INPUTS</div>
          <div className="text-xs text-green-600 font-medium">OUTPUT</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Node types definition
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
};

// Initial nodes
const initialNodes: Node[] = [
  {
    id: "1",
    type: "trigger",
    position: { x: 100, y: 100 },
    data: {
      device_name: "DRYCONTACT_1",
      pin_number: 1,
      condition_operator: "is",
      target_value: true,
      label: "Door Sensor",
    },
  },
  {
    id: "2",
    type: "logic",
    position: { x: 400, y: 100 },
    data: {
      operator: "AND",
      label: "Logic Gate",
    },
  },
  {
    id: "3",
    type: "action",
    position: { x: 700, y: 100 },
    data: {
      action_type: "control_relay",
      device_name: "RELAY_1",
      pin: 1,
      target_value: true,
      label: "Turn On Light",
    },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", type: "smoothstep" },
  { id: "e2-3", source: "2", target: "3", type: "smoothstep" },
];

export default function VisualAutomationLogicPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [mqttClient, setMqttClient] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Modal states
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showLogicModal, setShowLogicModal] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  // Form states
  const [triggerForm, setTriggerForm] = useState<TriggerNodeData>({
    device_name: "",
    pin_number: 1,
    condition_operator: "is",
    target_value: true,
    label: "",
  });

  const [actionForm, setActionForm] = useState<ActionNodeData>({
    action_type: "control_relay",
    label: "",
  });

  const [logicForm, setLogicForm] = useState<LogicNodeData>({
    operator: "AND",
    label: "",
  });

  // Available devices (mock data - in real app, fetch from MQTT)
  const availableDevices = useMemo(
    () => [
      { name: "DRYCONTACT_1", type: "sensor", pins: [1, 2, 3, 4] },
      { name: "DRYCONTACT_2", type: "sensor", pins: [1, 2, 3, 4] },
      { name: "RELAY_1", type: "actuator", pins: [1, 2, 3, 4, 5, 6, 7, 8] },
      { name: "RELAY_2", type: "actuator", pins: [1, 2, 3, 4, 5, 6, 7, 8] },
    ],
    []
  );

  // MQTT Connection
  useEffect(() => {
    const client = connectMQTT();
    setMqttClient(client);

    client.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to MQTT for Visual Automation");
    });

    client.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from MQTT");
    });

    return () => {
      if (client) {
        client.removeAllListeners();
      }
    };
  }, []);

  // Handle connections
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Add new nodes
  const addTriggerNode = useCallback(() => {
    const newNode: Node = {
      id: `trigger-${Date.now()}`,
      type: "trigger",
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { ...triggerForm },
    };
    setNodes((nds) => [...nds, newNode]);
    setShowTriggerModal(false);
    setTriggerForm({
      device_name: "",
      pin_number: 1,
      condition_operator: "is",
      target_value: true,
      label: "",
    });
  }, [triggerForm, setNodes]);

  const addActionNode = useCallback(() => {
    const newNode: Node = {
      id: `action-${Date.now()}`,
      type: "action",
      position: { x: Math.random() * 400 + 400, y: Math.random() * 300 },
      data: { ...actionForm },
    };
    setNodes((nds) => [...nds, newNode]);
    setShowActionModal(false);
    setActionForm({
      action_type: "control_relay",
      label: "",
    });
  }, [actionForm, setNodes]);

  const addLogicNode = useCallback(() => {
    const newNode: Node = {
      id: `logic-${Date.now()}`,
      type: "logic",
      position: { x: Math.random() * 400 + 200, y: Math.random() * 300 + 100 },
      data: { ...logicForm },
    };
    setNodes((nds) => [...nds, newNode]);
    setShowLogicModal(false);
    setLogicForm({
      operator: "AND",
      label: "",
    });
  }, [logicForm, setNodes]);

  // Save automation flow
  const saveAutomationFlow = useCallback(() => {
    const automationData = {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
      })),
      timestamp: new Date().toISOString(),
    };

    // Send to MQTT backend
    if (mqttClient && isConnected) {
      mqttClient.publish(
        "command_control_logic_visual",
        JSON.stringify({
          action: "save_flow",
          data: automationData,
        })
      );
      toast.success("Automation flow saved successfully!");
    } else {
      toast.error("MQTT not connected. Cannot save flow.");
    }
  }, [nodes, edges, mqttClient, isConnected]);

  // Load automation flow
  const loadAutomationFlow = useCallback(() => {
    if (mqttClient && isConnected) {
      mqttClient.publish(
        "command_control_logic_visual",
        JSON.stringify({
          action: "load_flow",
        })
      );
      toast.info("Loading automation flow...");
    } else {
      toast.error("MQTT not connected. Cannot load flow.");
    }
  }, [mqttClient, isConnected]);

  // Execute automation
  const executeAutomation = useCallback(() => {
    if (mqttClient && isConnected) {
      const executionData = {
        nodes: nodes,
        edges: edges,
        timestamp: new Date().toISOString(),
      };

      mqttClient.publish(
        "command_control_logic_visual",
        JSON.stringify({
          action: "execute",
          data: executionData,
        })
      );
      toast.success("Automation executed!");
    } else {
      toast.error("MQTT not connected. Cannot execute automation.");
    }
  }, [nodes, edges, mqttClient, isConnected]);

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) =>
      eds.filter((edge) =>
        nodes.some((node) =>
          node.selected
            ? edge.source !== node.id && edge.target !== node.id
            : true
        )
      )
    );
  }, [nodes, setNodes, setEdges]);

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Brain className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Visual Automation Logic</h1>
          <Badge variant="outline" className="ml-2">
            IFTTT Style
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button variant="outline" size="sm" onClick={loadAutomationFlow}>
            Load Flow
          </Button>
          <Button variant="outline" size="sm" onClick={saveAutomationFlow}>
            <Save className="h-4 w-4 mr-2" />
            Save Flow
          </Button>
          <Button size="sm" onClick={executeAutomation}>
            <Play className="h-4 w-4 mr-2" />
            Execute
          </Button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar with tools */}
        <div className="w-64 border-r bg-muted/20 p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setShowTriggerModal(true)}
              >
                <Eye className="h-4 w-4 mr-2 text-blue-500" />
                Add Trigger
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setShowLogicModal(true)}
              >
                <Brain className="h-4 w-4 mr-2 text-purple-500" />
                Add Logic Gate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setShowActionModal(true)}
              >
                <Zap className="h-4 w-4 mr-2 text-orange-500" />
                Add Action
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={deleteSelectedNodes}
              >
                <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                Delete Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setNodes([]);
                  setEdges([]);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2 text-gray-500" />
                Clear Canvas
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Flow Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Nodes:</span>
                <Badge variant="outline">{nodes.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Connections:</span>
                <Badge variant="outline">{edges.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Triggers:</span>
                <Badge variant="outline">
                  {nodes.filter((n) => n.type === "trigger").length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Actions:</span>
                <Badge variant="outline">
                  {nodes.filter((n) => n.type === "action").length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50 dark:bg-gray-900"
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

            <Panel position="top-left" className="space-x-2">
              <Badge variant="outline" className="text-xs">
                Drag components from sidebar
              </Badge>
              <Badge variant="outline" className="text-xs">
                Connect with edges
              </Badge>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Trigger Modal */}
      <Dialog open={showTriggerModal} onOpenChange={setShowTriggerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Trigger Component</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="trigger-label">Label</Label>
              <Input
                id="trigger-label"
                value={triggerForm.label}
                onChange={(e) =>
                  setTriggerForm((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="e.g., Door Sensor"
              />
            </div>
            <div>
              <Label htmlFor="trigger-device">Device</Label>
              <Select
                value={triggerForm.device_name}
                onValueChange={(value) =>
                  setTriggerForm((prev) => ({ ...prev, device_name: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {availableDevices
                    .filter((d) => d.type === "sensor")
                    .map((device) => (
                      <SelectItem key={device.name} value={device.name}>
                        {device.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="trigger-pin">Pin Number</Label>
              <Select
                value={triggerForm.pin_number.toString()}
                onValueChange={(value) =>
                  setTriggerForm((prev) => ({
                    ...prev,
                    pin_number: parseInt(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((pin) => (
                    <SelectItem key={pin} value={pin.toString()}>
                      Pin {pin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="trigger-condition">Condition</Label>
              <Select
                value={triggerForm.condition_operator}
                onValueChange={(value: any) =>
                  setTriggerForm((prev) => ({
                    ...prev,
                    condition_operator: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="is">Is</SelectItem>
                  <SelectItem value="and">And</SelectItem>
                  <SelectItem value="or">Or</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="trigger-value">Target Value</Label>
              <Select
                value={triggerForm.target_value.toString()}
                onValueChange={(value) =>
                  setTriggerForm((prev) => ({
                    ...prev,
                    target_value: value === "true",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">ON / True</SelectItem>
                  <SelectItem value="false">OFF / False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTriggerModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={addTriggerNode}>Add Trigger</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Modal */}
      <Dialog open={showActionModal} onOpenChange={setShowActionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Action Component</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="action-label">Label</Label>
              <Input
                id="action-label"
                value={actionForm.label}
                onChange={(e) =>
                  setActionForm((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="e.g., Turn On Light"
              />
            </div>
            <div>
              <Label htmlFor="action-type">Action Type</Label>
              <Select
                value={actionForm.action_type}
                onValueChange={(value: any) =>
                  setActionForm((prev) => ({ ...prev, action_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="control_relay">Control Relay</SelectItem>
                  <SelectItem value="send_message">Send Message</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {actionForm.action_type === "control_relay" ? (
              <>
                <div>
                  <Label htmlFor="action-device">Device</Label>
                  <Select
                    value={actionForm.device_name || ""}
                    onValueChange={(value) =>
                      setActionForm((prev) => ({ ...prev, device_name: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select device" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDevices
                        .filter((d) => d.type === "actuator")
                        .map((device) => (
                          <SelectItem key={device.name} value={device.name}>
                            {device.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="action-pin">Pin Number</Label>
                  <Select
                    value={actionForm.pin?.toString() || "1"}
                    onValueChange={(value) =>
                      setActionForm((prev) => ({
                        ...prev,
                        pin: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((pin) => (
                        <SelectItem key={pin} value={pin.toString()}>
                          Pin {pin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="action-value">Target Value</Label>
                  <Select
                    value={actionForm.target_value?.toString() || "true"}
                    onValueChange={(value) =>
                      setActionForm((prev) => ({
                        ...prev,
                        target_value: value === "true",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">ON / True</SelectItem>
                      <SelectItem value="false">OFF / False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="action-message">Message</Label>
                <Input
                  id="action-message"
                  value={actionForm.message || ""}
                  onChange={(e) =>
                    setActionForm((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  placeholder="Message to send"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionModal(false)}>
              Cancel
            </Button>
            <Button onClick={addActionNode}>Add Action</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logic Modal */}
      <Dialog open={showLogicModal} onOpenChange={setShowLogicModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Logic Gate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="logic-label">Label</Label>
              <Input
                id="logic-label"
                value={logicForm.label}
                onChange={(e) =>
                  setLogicForm((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="e.g., AND Gate"
              />
            </div>
            <div>
              <Label htmlFor="logic-operator">Operator</Label>
              <Select
                value={logicForm.operator}
                onValueChange={(value: any) =>
                  setLogicForm((prev) => ({ ...prev, operator: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">
                    AND - All conditions must be true
                  </SelectItem>
                  <SelectItem value="OR">
                    OR - At least one condition must be true
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogicModal(false)}>
              Cancel
            </Button>
            <Button onClick={addLogicNode}>Add Logic Gate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
