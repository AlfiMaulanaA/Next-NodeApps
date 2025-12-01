"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ArrowRight } from "lucide-react";

export const InputNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-green-400 border-2 border-green-500 min-w-[120px]">
      <div className="flex items-center gap-2">
        <ArrowRight size={16} className="text-green-800" />
        <div className="text-sm font-medium text-green-900">{data.label}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-600"
      />
    </div>
  );
});

InputNode.displayName = "InputNode";
