"use client";

import { useEffect, useState } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Battery,
  Zap,
  Thermometer,
  Activity,
} from "lucide-react";
import RealtimeClock from "@/components/realtime-clock";
import Refresh from "@/components/refresh-button";
import MqttStatus from "@/components/mqtt-status";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { connectMQTT } from "@/lib/mqttClient";
import { useIsMobile } from "@/hooks/use-mobile";

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

export default function BatteryDashboard() {
  const [batteryData, setBatteryData] = useState<BatteryData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const client = connectMQTT();
    const topic = "modbus/battery/data";

    if (!client) return;

    // Subscribe to battery MQTT topic
    client.subscribe(topic, { qos: 0 }, (err) => {
      if (err) {
        console.error("[MQTT] Subscribe error:", err);
      } else {
        console.log(`[MQTT] Subscribed to ${topic}`);
      }
    });

    const handleMessage = (receivedTopic: string, message: Buffer) => {
      if (receivedTopic === topic) {
        try {
          const payload = JSON.parse(message.toString());
          console.log("[MQTT] Battery data received:", payload);

          if (payload.value) {
            const data: BatteryData = JSON.parse(payload.value);
            setBatteryData(data);
            setLastUpdate(new Date());
            setIsConnected(true);
          }
        } catch (e) {
          console.error("[MQTT] Invalid JSON from battery:", e);
          setIsConnected(false);
        }
      }
    };

    client.on("message", handleMessage);

    // Check initial connection status
    const checkConnection = () => {
      setIsConnected(client.connected);
    };

    const interval = setInterval(checkConnection, 2000);
    checkConnection();

    return () => {
      clearInterval(interval);
      client.off("message", handleMessage);
      client.unsubscribe(topic);
    };
  }, []);

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Battery Dashboard";

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <Battery className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{appName} - Battery Monitor</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!useIsMobile() && <RealtimeClock />}
          <Refresh />
          <MqttStatus />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Status Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MQTT Status</CardTitle>
              <Activity className={`h-5 w-5 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <p className="text-xs text-muted-foreground">
                Last update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Battery SOC</CardTitle>
              <Battery className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {batteryData?.SOC?.toFixed(1)}%
              </div>
              <Progress value={batteryData?.SOC || 0} className="h-2 mt-1" />
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pack Voltage</CardTitle>
              <Zap className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {batteryData?.["Pack Voltage"]?.toFixed(2)} V
              </div>
              <p className="text-xs text-muted-foreground">
                Current: {batteryData?.Current?.toFixed(2)} A
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Temperature</CardTitle>
              <Thermometer className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {batteryData?.["Environment Temperature"]?.toFixed(1)}°C
              </div>
              <p className="text-xs text-muted-foreground">
                Cells avg: {batteryData?.["Averag of Cell Temperature"]?.toFixed(1)}°C
              </p>
            </CardContent>
          </Card>
        </div>

        {batteryData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Detailed Battery Information */}
            <Card>
              <CardHeader>
                <CardTitle>Battery Parameters</CardTitle>
                <CardDescription>Real-time battery monitoring data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground font-medium">State of Health (SOH):</span>
                    <div className="font-semibold text-lg">{batteryData.SOH?.toFixed(1)}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Cycle Count:</span>
                    <div className="font-semibold text-lg">{batteryData.Cycle}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Remaining Capacity:</span>
                    <div className="font-semibold">{batteryData["Remaining capacity"]?.toFixed(2)} Ah</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Total Capacity:</span>
                    <div className="font-semibold">{batteryData["Total Capacity"]?.toFixed(2)} Ah</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Avg Cell Voltage:</span>
                    <div className="font-semibold">{batteryData["Averag of Cell Votage"]?.toFixed(3)} V</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Cell Voltage Range:</span>
                    <div className="font-semibold">
                      {batteryData["Min Cell Voltage"]?.toFixed(3)} - {batteryData["Max Cell Voltage"]?.toFixed(3)} V
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Avg Cell Temp:</span>
                    <div className="font-semibold">{batteryData["Averag of Cell Temperature"]?.toFixed(1)}°C</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">MOSFET Temp:</span>
                    <div className="font-semibold">{batteryData["MOSFET temperature"]?.toFixed(1)}°C</div>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground font-medium">Polling Duration:</span>
                  <div className="font-semibold">{batteryData.PollingDuration?.toFixed(3)} seconds</div>
                </div>
              </CardContent>
            </Card>

            {/* System Events/Alarms */}
            <Card>
              <CardHeader>
                <CardTitle>System Events</CardTitle>
                <CardDescription>Battery protection and status indicators</CardDescription>
              </CardHeader>
              <CardContent>
                {batteryData["System Event"] ? (
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(batteryData["System Event"]).map(([event, status]) => (
                      <div key={event} className="flex items-center justify-between p-3 border border-border rounded bg-card">
                        <span className="text-sm text-foreground">
                          {event.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <Badge
                          variant={status === 1 ? "destructive" : "default"}
                          className={status === 1 ? "bg-red-100 text-red-800 border-red-200" : "bg-green-100 text-green-800 border-green-200"}
                        >
                          {status === 1 ? "Active" : "OK"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">No system events available</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {!batteryData && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Battery className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Waiting for Battery Data</h3>
                <p>Make sure battery.py is running and MQTT broker is connected.</p>
                <p className="text-sm mt-2">Topic: modbus/battery/data</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
}
