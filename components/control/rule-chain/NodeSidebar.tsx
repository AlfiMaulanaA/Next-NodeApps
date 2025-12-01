"use client";

import React from "react";
import { Node } from "reactflow";
import { Filter, Zap, Settings, Save, Radio } from "lucide-react";

interface NodeSidebarProps {
  onAddNode: (nodeType: string, label: string) => void;
  selectedNode: Node | null;
}

const nodeCategories = [
  {
    title: "Filter",
    icon: Filter,
    nodes: [
      { type: "switchNode", label: "check alarm status" },
      { type: "switchNode", label: "check existence fields" },
      { type: "switchNode", label: "check relation" },
      { type: "switchNode", label: "gps geofencing filter" },
      { type: "switchNode", label: "message type" },
      { type: "switchNode", label: "message type switch" },
      { type: "switchNode", label: "originator type" },
      { type: "switchNode", label: "originator type switch" },
    ],
  },
  {
    title: "Action",
    icon: Zap,
    nodes: [
      { type: "actionNode", label: "script" },
      { type: "switchNode", label: "switch" },
    ],
  },
  {
    title: "Enrichment",
    icon: Settings,
    nodes: [
      { type: "actionNode", label: "calculate delta" },
      { type: "actionNode", label: "customer attributes" },
      { type: "actionNode", label: "customer details" },
    ],
  },
];

export default function NodeSidebar({
  onAddNode,
  selectedNode,
}: NodeSidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800">Search nodes</h3>
        <input
          type="text"
          placeholder="Search..."
          className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm"
        />
      </div>

      {/* Filter Section */}
      <div className="p-2">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md">
          <Filter size={16} />
          Filter
        </button>
      </div>

      {/* Node Categories */}
      {nodeCategories.map((category) => {
        const Icon = category.icon;
        return (
          <div key={category.title} className="border-t border-slate-200">
            <button className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Icon size={16} />
              {category.title}
            </button>
            <div className="px-2 pb-2">
              {category.nodes.map((node, idx) => (
                <button
                  key={idx}
                  onClick={() => onAddNode(node.type, node.label)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-yellow-50 hover:text-yellow-800 rounded-md transition-colors"
                >
                  <span className="w-5 h-5 flex items-center justify-center bg-yellow-100 text-yellow-600 rounded text-xs">
                    ≡
                  </span>
                  {node.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="fixed bottom-4 left-4 right-64 bg-white border border-slate-300 rounded-lg shadow-lg p-4 max-w-sm">
          <h4 className="font-semibold text-slate-800 mb-2">Selected Node</h4>
          <div className="text-sm text-slate-600">
            <p>
              <strong>ID:</strong> {selectedNode.id}
            </p>
            <p>
              <strong>Type:</strong> {selectedNode.type}
            </p>
            <p>
              <strong>Label:</strong> {selectedNode.data.label}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
