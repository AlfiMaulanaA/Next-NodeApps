import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Battery,
  Zap,
  Thermometer,
  AlertTriangle,
  Activity,
  Cpu,
  Wifi,
  Settings,
} from "lucide-react";

interface DeviceDataDisplayProps {
  topicData: any;
  deviceName: string;
}

interface BatteryData {
  // Basic parameters
  Current?: number;
  "Pack Voltage"?: number;
  "Remaining capacity"?: number;
  "Total Capacity"?: number;
  "Total Discharge Capacity"?: number;
  SOC?: number;
  SOH?: number;
  Cycle?: number;

  // Cell voltages
  "Averag of Cell Votage"?: number;
  "Max Cell Voltage"?: number;
  "Min Cell Voltage"?: number;
  [key: `Cell${number} Voltage`]: number;

  // Temperatures
  "Averag of Cell Temperature"?: number;
  "Max Cell Temperature"?: number;
  "Min Cell Temperature"?: number;
  "Environment Temperature"?: number;
  "MOSFET temperature"?: number;
  [key: `Cell temperature ${number}`]: number;

  // System Events
  "System Event"?: Record<string, number>;

  // Other
  PollingDuration?: number;
}

export default function DeviceDataDisplay({
  topicData,
  deviceName,
}: DeviceDataDisplayProps) {
  if (!topicData) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Waiting for data...
      </div>
    );
  }

  // Alarm type descriptions mapping
  const alarmDescriptions: Record<string, string> = {
    "Over Voltage Protect": "Include cell and pack over voltage protect",
    "Under Voltage Protect": "Include cell and pack under voltage protect",
    "Charge over current Protect": "Include 1st and 2nd over current protect",
    "Discharge over current Protect":
      "Include 1st and 2nd over current protect",
    "Short/Reverse circuit Protect":
      "Protection against short circuit or reverse polarity",
    "High temperature Protect":
      "Include cell and environment high temperature protect",
    "Low temperature Protect":
      "Include cell and environment low temperature protect",
    "SOC Low alarm": "State of Charge is below safe threshold",
    Discharging: "Battery is currently discharging",
    Chargeing: "Battery is currently charging",
    Charging: "Battery is currently charging",
    "Charge Online": "Battery is connected to power source",
    "Cell Balancing": "Automatic cell voltage balancing is active",
    "Full Charge": "Battery is fully charged",
    "Sleep Mode": "Battery management system is in sleep mode",
    "Wake Up": "Battery management system has woken from sleep mode",
    Fault: "General system fault detected",
    "Communication Error": "Communication with battery cells failed",
    "Temperature Sensor Error": "Temperature sensor malfunction",
    "Voltage Sensor Error": "Voltage sensor malfunction",
    "Current Sensor Error": "Current sensor malfunction",
  };

  // Helper function to get alarm description
  const getAlarmDescription = (alarmName: string): string => {
    // Try exact match first
    if (alarmDescriptions[alarmName]) {
      return alarmDescriptions[alarmName];
    }

    // Try to match common variations
    const normalizedName = alarmName.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [key, description] of Object.entries(alarmDescriptions)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedKey === normalizedName) {
        return description;
      }
    }

    // Return a generic description if no match found
    return "Battery protection or status indicator";
  };

  try {
    // Parse the full MQTT payload
    const fullData = topicData;
    const batteryData: BatteryData = fullData.value
      ? JSON.parse(fullData.value)
      : {};

    return (
      <div className="space-y-3 mt-3">
        {/* Device Info */}
        <div className="text-sm text-muted-foreground border-l-2 border-border pl-3">
          <div className="grid grid-cols-2 gap-3">
            <span>Device: {fullData.device_name || deviceName}</span>
            <span>Protocol: {fullData.protocol_type}</span>
            <span>Port: {fullData.comport}</span>
            <span>Address: {fullData.modbus_address}</span>
          </div>
        </div>

        {/* Battery Status */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground font-medium">SOC</div>
            <div
              className={`font-bold text-lg ${
                (batteryData.SOC || 0) >= 80
                  ? "text-green-600"
                  : (batteryData.SOC || 0) >= 50
                  ? "text-yellow-600"
                  : (batteryData.SOC || 0) >= 20
                  ? "text-orange-600"
                  : "text-red-600"
              }`}
            >
              {batteryData.SOC?.toFixed(1)}%
            </div>
            <Progress value={batteryData.SOC || 0} className="h-2 mt-1" />
          </div>
          <div>
            <div className="text-muted-foreground font-medium">SOH</div>
            <div
              className={`font-bold text-lg ${
                (batteryData.SOH || 0) >= 90
                  ? "text-green-600"
                  : (batteryData.SOH || 0) >= 80
                  ? "text-yellow-600"
                  : (batteryData.SOH || 0) >= 70
                  ? "text-orange-600"
                  : "text-red-600"
              }`}
            >
              {batteryData.SOH?.toFixed(1)}%
            </div>
            <Progress value={batteryData.SOH || 0} className="h-2 mt-1" />
          </div>
          <div>
            <div className="text-muted-foreground font-medium">Current</div>
            <div className="font-bold text-lg text-foreground">
              {batteryData.Current?.toFixed(2)} A
            </div>
          </div>
          <div>
            <div className="text-muted-foreground font-medium">Voltage</div>
            <div className="font-bold text-lg text-foreground">
              {batteryData["Pack Voltage"]?.toFixed(2)} V
            </div>
          </div>
        </div>

        {/* Capacity */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground font-medium">
              Remaining:{" "}
            </span>
            <span className="font-semibold text-foreground">
              {batteryData["Remaining capacity"]?.toFixed(2)} Ah
            </span>
          </div>
          <div>
            <span className="text-muted-foreground font-medium">Total: </span>
            <span className="font-semibold text-foreground">
              {batteryData["Total Capacity"]?.toFixed(2)} Ah
            </span>
          </div>
          <div>
            <span className="text-muted-foreground font-medium">Cycles: </span>
            <span className="font-semibold text-foreground">
              {batteryData.Cycle}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground font-medium">
              Duration:{" "}
            </span>
            <span className="font-semibold text-foreground">
              {batteryData.PollingDuration?.toFixed(3)}s
            </span>
          </div>
        </div>

        {/* Cell Voltages Summary */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center border border-border rounded p-2 bg-card">
            <div className="text-muted-foreground font-medium">Avg Cell V</div>
            <div className="font-semibold text-foreground">
              {batteryData["Averag of Cell Votage"]?.toFixed(3)} V
            </div>
          </div>
          <div className="text-center border border-border rounded p-2 bg-card">
            <div className="text-muted-foreground font-medium">Max Cell V</div>
            <div className="font-semibold text-foreground">
              {batteryData["Max Cell Voltage"]?.toFixed(3)} V
            </div>
          </div>
          <div className="text-center border border-border rounded p-2 bg-card">
            <div className="text-muted-foreground font-medium">Min Cell V</div>
            <div className="font-semibold text-foreground">
              {batteryData["Min Cell Voltage"]?.toFixed(3)} V
            </div>
          </div>
        </div>

        {/* Temperatures Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="text-center border border-border rounded p-2 bg-card">
            <div className="text-muted-foreground font-medium">
              Avg Cell Temp
            </div>
            <div className="font-semibold text-foreground">
              {batteryData["Averag of Cell Temperature"]?.toFixed(1)}°C
            </div>
          </div>
          <div className="text-center border border-border rounded p-2 bg-card">
            <div className="text-muted-foreground font-medium">
              Max Cell Temp
            </div>
            <div className="font-semibold text-foreground">
              {batteryData["Max Cell Temperature"]?.toFixed(1)}°C
            </div>
          </div>
          <div className="text-center border border-border rounded p-2 bg-card">
            <div className="text-muted-foreground font-medium">
              Min Cell Temp
            </div>
            <div className="font-semibold text-foreground">
              {batteryData["Min Cell Temperature"]?.toFixed(1)}°C
            </div>
          </div>
          <div className="text-center border border-border rounded p-2 bg-card">
            <div className="text-muted-foreground font-medium">Environment</div>
            <div className="font-semibold text-foreground">
              {batteryData["Environment Temperature"]?.toFixed(1)}°C
            </div>
          </div>
        </div>

        {/* System Events/Alarms */}
        {batteryData["System Event"] && (
          <TooltipProvider>
            <div className="text-sm">
              <div className="text-muted-foreground font-medium mb-2">
                System Events:
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(batteryData["System Event"]).map(
                  ([event, status]) => {
                    const displayName = event.replace(/([A-Z])/g, " $1").trim();
                    const description = getAlarmDescription(event);

                    return (
                      <Tooltip key={event}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between px-3 py-2 border border-border rounded bg-card cursor-help hover:bg-accent/50 transition-colors">
                            <span className="truncate mr-2 text-foreground">
                              {displayName}
                            </span>
                            <Badge
                              variant={status === 1 ? "destructive" : "default"}
                              className={`text-xs px-2 py-1 ${
                                status === 1
                                  ? "bg-red-100 text-red-800 border-red-200"
                                  : "bg-green-100 text-green-800 border-green-200"
                              }`}
                            >
                              {status === 1 ? "Active" : "OK"}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                )}
              </div>
            </div>
          </TooltipProvider>
        )}
      </div>
    );
  } catch (error) {
    console.error("Error parsing device data:", error);
    return (
      <div className="text-sm text-red-600 bg-red-50 p-2 rounded border">
        Error parsing device data. Raw data: {JSON.stringify(topicData)}
      </div>
    );
  }
}
