"use client";

import { useEffect, useState } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, Cpu, Wifi, WifiOff, Link } from "lucide-react";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { connectMQTT } from "@/lib/mqttClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge"; // Import Badge component

export default function OverviewDashboard() {
  const [modbusDevices, setModbusDevices] = useState<any[]>([]);
  const [batteryChargerData, setBatteryChargerData] = useState<any>(null);
  const [statusSummary, setStatusSummary] = useState<Record<string, string>>({});
  const [deviceTopicData, setDeviceTopicData] = useState<Record<string, any>>({});

  useEffect(() => {
    const client = connectMQTT();
    if (!client) return;

    const dynamicTopics = new Set<string>();

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());

        if (topic === "response_device_modbus") {
          if (Array.isArray(payload)) {
            setModbusDevices(payload);

            payload.forEach((d) => {
              const t = d.profile?.topic;
              if (t && !dynamicTopics.has(t)) {
                client.subscribe(t);
                dynamicTopics.add(t);
              }
            });
          }
        } else if (topic === "batteryCharger") {
          setBatteryChargerData(payload);
        } else if (topic === "modbus_snmp_summ") {
          const raw = payload["MODBUS SNMP STATUS"];
          if (typeof raw === "string") {
            const match = raw.match(/^(.*?)\s+(.+?)$/);
            if (match) {
              const deviceName = match[1];
              const status = match[2];
              setStatusSummary((prev) => ({ ...prev, [deviceName]: status }));
            }
          }
        } else {
          setDeviceTopicData((prev) => ({ ...prev, [topic]: payload }));
        }
      } catch (e) {
        console.error("[MQTT] Invalid JSON:", e);
      }
    };

    client.on("message", handleMessage);
    const baseTopics = ["response_device_modbus", "batteryCharger", "modbus_snmp_summ"];
    baseTopics.forEach((t) => client.subscribe(t));

    client.publish("command_device_modbus", JSON.stringify({ command: "getDataModbus" }));

    return () => {
      baseTopics.forEach((t) => client.unsubscribe(t));
      dynamicTopics.forEach((t) => client.unsubscribe(t));
      client.off("message", handleMessage);
    };
  }, []);

  const countStatus = (devices: any[]) => {
    let online = 0,
      offline = 0;
    devices.forEach((d) => {
      const status = statusSummary[d.profile?.name];
      if (status?.includes("success")) online++;
      else offline++;
    });
    return { online, offline };
  };

  const stats = countStatus(modbusDevices);
  const totalDevices = modbusDevices.length;
  const totalOnline = stats.online;
  const totalOffline = stats.offline;
  const allDevicesOnline = totalDevices === totalOnline && totalDevices > 0;
  const noDevicesOnline = totalDevices > 0 && totalOnline === 0;
  const noDeviceRegistered = totalDevices === 0;
  
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "MQTT Gateway Dashboard";

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{ appName}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!useIsMobile() && <RealtimeClock />}
          <Refresh />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Cpu className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
              <div className="text-2xl font-bold">{totalDevices}</div>
              <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-muted-foreground">All registered devices</p>
            {noDeviceRegistered && ( // Menggunakan variabel yang sudah didefinisikan
                <div className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs font-medium border border-blue-300">
                  No devices registered
                </div>
                )}
                </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Wifi className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOnline}</div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground">Devices currently online</p>
              {allDevicesOnline && (
                <div className="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-xs font-medium border border-green-300">
                  All devices are online
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
              <div className="text-2xl font-bold">{totalOffline}</div>
              
              <div className="flex justify-between items-center mt-1">
                
            <p className="text-xs text-muted-foreground">Devices currently offline</p>
            {noDevicesOnline && (
              <div className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium border border-red-300">
                All devices are offline
              </div>
            )}
            </div>
          </CardContent>
        </Card>
      </div>

        <Tabs defaultValue="modbus" className="w-full mt-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="modbus">Device Modbus/SNMP</TabsTrigger>
              <TabsTrigger value="battery">Battery Charger</TabsTrigger>
            </TabsList>
            <MqttStatus />
          </div>

          <TabsContent value="modbus" className="mt-2">
            <Card>
              <CardHeader>
                <CardTitle>Device Modbus/SNMP</CardTitle>
                <CardDescription>List of Modbus/SNMP devices</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {modbusDevices.length === 0 ? (
                  <div>No Modbus/SNMP devices found.</div>
                ) : (
                  <ul className="space-y-4">
                    {modbusDevices.map((d, i) => (
                      <li key={d.profile?.name || i} className="border-b pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <span className="font-semibold">{d.profile?.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">({d.profile?.part_number})</span>
                            <div className="text-xs">
                              {d.protocol_setting?.protocol === "Modbus RTU"
                                ? `Address: ${d.protocol_setting?.address}`
                                : `IP: ${d.protocol_setting?.ip_address}`}
                            </div>
                            <div className="text-xs">Topic: {d.profile?.topic}</div>
                          </div>
                          <span className={`text-xs font-semibold ml-2 ${statusSummary[d.profile?.name]?.includes("success") ? "text-green-600 bg-green-200" : "text-red-600 bg-red-200"} rounded-full px-2 py-1`}>
                            {statusSummary[d.profile?.name]?.includes("success") ? "Online" : "Offline"}
                          </span>
                        </div>
                        <div className="text-xs mt-1">
                          <span className="font-semibold">Live Data:</span>
                          <div className="flex flex-wrap gap-1 mt-1"> {/* Flex container for badges */}
                            {(() => {
                              const topicData = deviceTopicData[d.profile?.topic];
                              if (!topicData) return <Badge variant="secondary">Waiting...</Badge>;
                              try {
                                const parsedValue = topicData.value ? JSON.parse(topicData.value) : {};
                                return Object.entries(parsedValue).map(([key, value]) => (
                                  <Badge key={key} variant="outline" className="text-[10px] px-2 py-0.5">
                                    {key}: {String(value)}
                                  </Badge>
                                ));
                              } catch (err) {
                                return <Badge variant="destructive">Invalid JSON</Badge>;
                              }
                            })()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="battery" className="mt-2">
            <Card>
              <CardHeader>
                <CardTitle>Battery Charger</CardTitle>
                <CardDescription>Live data from charger via MQTT</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {batteryChargerData ? (
                  Object.entries(batteryChargerData).map(([key, value]) => (
                    <div key={key}>
                      <div className="font-semibold">{key}</div>
                      <div className="text-muted-foreground">{String(value)}</div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center">Waiting for battery data...</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarInset>
  );
}