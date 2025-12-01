"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Zap } from "lucide-react";

export const ActionNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-red-400 border-2 border-red-500 min-w-[160px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-red-600"
      />
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-red-900" />
        <div className="text-sm font-medium text-red-900">{data.label}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-red-600"
      />
    </div>
  );
});

ActionNode.displayName = "ActionNode";
