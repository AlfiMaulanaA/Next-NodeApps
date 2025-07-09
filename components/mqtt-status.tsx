"use client";

import { useMQTTStatus } from "@/hooks/useMQTTStatus";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";

export default function MQTTConnectionBadge() {
  const status = useMQTTStatus();

  const getStatusInfo = () => {
    switch (status) {
      case "connected":
        return {
          color: "bg-green-500",
          icon: <CheckCircle className="w-4 h-4 mr-1" />,
          label: "Connected",
        };
      case "disconnected":
        return {
          color: "bg-yellow-500",
          icon: <AlertTriangle className="w-4 h-4 mr-1" />,
          label: "Disconnected",
        };
      case "error":
        return {
          color: "bg-red-500",
          icon: <XCircle className="w-4 h-4 mr-1" />,
          label: "Error",
        };
      default:
        return {
          color: "bg-gray-400",
          icon: <Loader2 className="w-4 h-4 mr-1 animate-spin" />,
          label: "Connecting...",
        };
    }
  };

  const { color, icon, label } = getStatusInfo();

  return (
    <Badge className={`flex items-center ${color} text-white px-2 py-1`}>
      {icon}
      <span className="text-sm">{label}</span>
    </Badge>
  );
}
