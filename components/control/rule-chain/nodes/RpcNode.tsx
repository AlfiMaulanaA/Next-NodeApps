"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Radio } from "lucide-react";

export const RpcNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-orange-300 border-2 border-orange-400 min-w-[200px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-orange-600"
      />
      <div className="flex items-center gap-2">
        <Radio size={16} className="text-orange-900" />
        <div className="text-sm font-medium text-orange-900">{data.label}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-orange-600"
      />
    </div>
  );
});

RpcNode.displayName = "RpcNode";
