"use client";

import React, { useCallback, useState } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

import { InputNode } from "./nodes/InputNode";
import { SwitchNode } from "./nodes/SwitchNode";
import { ActionNode } from "./nodes/ActionNode";
import { SaveNode } from "./nodes/SaveNode";
import { RpcNode } from "./nodes/RpcNode";
import NodeSidebar from "./NodeSidebar";

// Define custom node types
const nodeTypes = {
  inputNode: InputNode,
  switchNode: SwitchNode,
  actionNode: ActionNode,
  saveNode: SaveNode,
  rpcNode: RpcNode,
};

// Dummy initial nodes
const initialNodes: Node[] = [
  {
    id: "1",
    type: "inputNode",
    position: { x: 100, y: 200 },
    data: { label: "Input" },
  },
  {
    id: "2",
    type: "switchNode",
    position: { x: 350, y: 150 },
    data: { label: "Message Type Switch", switchType: "message type switch" },
  },
  {
    id: "3",
    type: "actionNode",
    position: { x: 350, y: 280 },
    data: { label: "Device Profile Node", actionType: "device profile" },
  },
  {
    id: "4",
    type: "saveNode",
    position: { x: 650, y: 100 },
    data: { label: "Save Client Attributes", saveType: "save attributes" },
  },
  {
    id: "5",
    type: "saveNode",
    position: { x: 650, y: 180 },
    data: { label: "Save Timeseries", saveType: "save timeseries" },
  },
  {
    id: "6",
    type: "rpcNode",
    position: { x: 650, y: 260 },
    data: { label: "RPC Request from Device", rpcType: "request from device" },
  },
  {
    id: "7",
    type: "rpcNode",
    position: { x: 650, y: 340 },
    data: { label: "RPC Request to Device", rpcType: "request to device" },
  },
];

// Dummy initial edges
const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    label: "Success",
    type: "smoothstep",
  },
  {
    id: "e2-4",
    source: "2",
    target: "4",
    label: "Post attributes",
    type: "smoothstep",
  },
  {
    id: "e2-5",
    source: "2",
    target: "5",
    label: "Post telemetry",
    type: "smoothstep",
  },
  {
    id: "e2-6",
    source: "2",
    target: "6",
    label: "RPC Request from Device",
    type: "smoothstep",
  },
  {
    id: "e2-7",
    source: "2",
    target: "7",
    label: "RPC Request to Device",
    type: "smoothstep",
  },
];

export default function RuleChainEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNode = useCallback(
    (nodeType: string, label: string) => {
      const newNode: Node = {
        id: `${nodes.length + 1}`,
        type: nodeType,
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 400 + 100,
        },
        data: { label },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes]
  );

  return (
    <div className="w-full h-full flex">
      {/* Sidebar */}
      <NodeSidebar onAddNode={addNode} selectedNode={selectedNode} />

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-50"
        >
          <Panel
            position="top-left"
            className="bg-white rounded-lg shadow-lg p-4 m-4"
          >
            <h2 className="text-lg font-bold text-slate-800">
              Root Rule Chain
            </h2>
            <p className="text-sm text-slate-500">
              Drag nodes from the left panel
            </p>
          </Panel>

          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
