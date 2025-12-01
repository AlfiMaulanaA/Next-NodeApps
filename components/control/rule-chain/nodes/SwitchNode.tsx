"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitBranch } from "lucide-react";

export const SwitchNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-yellow-300 border-2 border-yellow-400 min-w-[160px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-yellow-600"
      />
      <div className="flex items-center gap-2">
        <GitBranch size={16} className="text-yellow-800" />
        <div className="text-sm font-medium text-yellow-900">{data.label}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-yellow-600"
      />
    </div>
  );
});

SwitchNode.displayName = "SwitchNode";
