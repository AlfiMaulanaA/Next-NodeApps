//components/database-status.tsx
"use client";

import { useDatabaseStatus } from "@/hooks/useDatabaseStatus";
import { Badge } from "@/components/ui/badge";
import { Database, AlertTriangle, XCircle, Loader2 } from "lucide-react";

export default function DatabaseConnectionBadge() {
  const { status, userCount, lastCheck } = useDatabaseStatus();

  const getStatusInfo = () => {
    switch (status) {
      case "connected":
        return {
          color: "bg-green-500",
          icon: <Database className="w-4 h-4 mr-1" />,
          label: `DB Online (${userCount} users)`,
        };
      case "disconnected":
        return {
          color: "bg-yellow-500",
          icon: <AlertTriangle className="w-4 h-4 mr-1" />,
          label: "DB Disconnected",
        };
      case "error":
        return {
          color: "bg-red-500",
          icon: <XCircle className="w-4 h-4 mr-1" />,
          label: "DB Error",
        };
      default:
        return {
          color: "bg-gray-400",
          icon: <Loader2 className="w-4 h-4 mr-1 animate-spin" />,
          label: "Checking DB...",
        };
    }
  };

  const { color, icon, label } = getStatusInfo();

  return (
    <Badge
      className={`flex items-center ${color} text-white px-2 py-1`}
      title={lastCheck ? `Last checked: ${lastCheck}` : ""}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </Badge>
  );
}