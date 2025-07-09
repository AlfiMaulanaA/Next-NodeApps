"use client";

import { useEffect, useState } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, Cpu, Wifi, WifiOff } from "lucide-react";
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

export default function OverviewDashboard() {
  // Modular/I2C
  const [modularDevices, setModularDevices] = useState<any[]>([]);
  // Modbus/SNMP
  const [modbusDevices, setModbusDevices] = useState<any[]>([]);

  useEffect(() => {
    const client = connectMQTT();
    if (!client) return;
    // Modular/I2C
    const handleI2C = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log('[MQTT][I2C] payload:', payload); // DEBUG LOG
        if (Array.isArray(payload)) setModularDevices(payload);
      } catch (e) {
        console.error('[MQTT][I2C] Invalid JSON', e);
      }
    };
    // Modbus/SNMP
    const handleModbus = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        if (Array.isArray(payload)) setModbusDevices(payload);
      } catch {}
    };
    client.on("message", handleI2C);
    client.on("message", handleModbus);
    client.subscribe("response_device_i2c");
    client.subscribe("response_device_modbus");
    client.publish("command_device_i2c", JSON.stringify({ command: "getDataI2C" }));
    client.publish("command_device_modbus", JSON.stringify({ command: "getDataModbus" }));
    return () => {
      client.unsubscribe("response_device_i2c");
      client.unsubscribe("response_device_modbus");
      client.off("message", handleI2C);
      client.off("message", handleModbus);
    };
  }, []);

  // Helper: count online/offline
  const countStatus = (devices: any[]) => {
    let online = 0, offline = 0;
    devices.forEach((d) => {
      if (d.status === "online" || d.status === true) online++;
      else offline++;
    });
    return { online, offline };
  };
  const modularStats = countStatus(modularDevices);
  const modbusStats = countStatus(modbusDevices);
  const totalDevices = modularDevices.length + modbusDevices.length;
  const totalOnline = modularStats.online + modbusStats.online;
  const totalOffline = modularStats.offline + modbusStats.offline;

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Node App</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <RealtimeClock />
          <Refresh />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Cpu className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDevices}</div>
              <p className="text-xs text-muted-foreground">All registered devices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <Wifi className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOnline}</div>
              <p className="text-xs text-muted-foreground">Devices currently online</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <WifiOff className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOffline}</div>
              <p className="text-xs text-muted-foreground">Devices currently offline</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          <Tabs defaultValue="modbus" className="w-full">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="modbus">Device Modbus/SNMP</TabsTrigger>
                <TabsTrigger value="modular">Device Modular</TabsTrigger>
                <TabsTrigger value="control">Control</TabsTrigger>
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
                    <ul className="space-y-2">
                      {modbusDevices.map((d, i) => (
                        <li key={d.profile?.name || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-2 last:border-b-0 last:pb-0">
                          <div>
                            <span className="font-semibold">{d.profile?.name}</span> <span className="ml-2 text-xs text-muted-foreground">({d.profile?.part_number})</span>
                            <div className="text-xs">{d.protocol_setting?.protocol === "Modbus RTU" ? `Address: ${d.protocol_setting?.address}` : `IP: ${d.protocol_setting?.ip_address}`}</div>
                            <div className="text-xs">Topic: {d.profile?.topic}</div>
                          </div>
                          <span className={`text-xs font-semibold ml-2 ${d.status === "online" || d.status === true ? "text-green-600" : "text-red-600"}`}>{d.status === "online" || d.status === true ? "Online" : "Offline"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="modular" className="mt-2">
              <Card>
                <CardHeader>
                  <CardTitle>Device Modular</CardTitle>
                  <CardDescription>List of Modular/I2C devices</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {modularDevices.length === 0 ? (
                    <div>No Modular devices found.</div>
                  ) : (
                    <ul className="space-y-2">
                      {modularDevices.map((d, i) => (
                        <li key={d.profile?.name || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-2 last:border-b-0 last:pb-0">
                          <div>
                            <span className="font-semibold">{d.profile?.name}</span> <span className="ml-2 text-xs text-muted-foreground">({d.profile?.part_number})</span>
                            <div className="text-xs">Address: {d.protocol_setting?.address}</div>
                            <div className="text-xs">Topic: {d.profile?.topic}</div>
                          </div>
                          <span className={`text-xs font-semibold ml-2 ${d.status === "online" || d.status === true ? "text-green-600" : "text-red-600"}`}>{d.status === "online" || d.status === true ? "Online" : "Offline"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="control" className="mt-2">
              <Card>
                <CardHeader>
                  <CardTitle>Control Modular Devices</CardTitle>
                  <CardDescription>Control panel for modular devices</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {modularDevices.length === 0 ? (
                    <div>No Modular devices found.</div>
                  ) : (
                    <ul className="space-y-2">
                      {modularDevices.map((d, i) => (
                        <li key={d.profile?.name || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-2 last:border-b-0 last:pb-0">
                          <div>
                            <span className="font-semibold">{d.profile?.name}</span> <span className="ml-2 text-xs text-muted-foreground">({d.profile?.part_number})</span>
                            <div className="text-xs">Address: {d.protocol_setting?.address}</div>
                            <div className="text-xs">Topic: {d.profile?.topic}</div>
                          </div>
                          <span className={`text-xs font-semibold ml-2 ${d.status === "online" || d.status === true ? "text-green-600" : "text-red-600"}`}>{d.status === "online" || d.status === true ? "Online" : "Offline"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SidebarInset>
  );
}
