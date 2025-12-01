"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Save } from "lucide-react";

export const SaveNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-pink-400 border-2 border-pink-500 min-w-[180px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-pink-600"
      />
      <div className="flex items-center gap-2">
        <Save size={16} className="text-pink-900" />
        <div className="text-sm font-medium text-pink-900">{data.label}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-pink-600"
      />
    </div>
  );
});

SaveNode.displayName = "SaveNode";
