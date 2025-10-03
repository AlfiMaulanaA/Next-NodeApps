"use client";

import { useEffect, useState } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Cpu,
  Wifi,
  WifiOff,
  Link,
  Microchip,
  Unplug,
} from "lucide-react"; // Import new icons
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { connectMQTT } from "@/lib/mqttClient";
import { useIsMobile } from "@/hooks/use-mobile";
import DeviceDataDisplay from "@/components/DeviceDataDisplay";

export default function OverviewDashboard() {
  const [modbusDevices, setModbusDevices] = useState<any[]>([]);
  const [i2cDevices, setI2cDevices] = useState<any[]>([]); // New state for I2C devices
  const [statusSummary, setStatusSummary] = useState<Record<string, string>>(
    {}
  );
  const [deviceTopicData, setDeviceTopicData] = useState<Record<string, any>>(
    {}
  );

  useEffect(() => {
    const client = connectMQTT();
    if (!client) return;

    // Request data for both types of devices
    client.publish(
      "command_device_modbus",
      JSON.stringify({ command: "getDataModbus" })
    );
    client.publish(
      "command_device_i2c",
      JSON.stringify({ command: "getDataI2C" })
    );

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
        } else if (topic === "response_device_i2c") {
          // Handle I2C device response
          if (Array.isArray(payload)) {
            setI2cDevices(payload);
          }
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
    // Subscribe to both Modbus and I2C response topics
    const baseTopics = [
      "response_device_modbus",
      "modbus_snmp_summ",
      "response_device_i2c",
    ];
    baseTopics.forEach((t) => client.subscribe(t));

    // Request data for both types of devices
    client.publish(
      "command_device_modbus",
      JSON.stringify({ command: "getDataModbus" })
    );
    client.publish(
      "command_device_i2c",
      JSON.stringify({ command: "getDataI2C" })
    );

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
      const status = statusSummary[d.profile?.name]; // Status summary is still based on MODBUS SNMP STATUS which might not apply directly to I2C unless your backend also provides it for I2C devices under the same topic structure.
      // For I2C, you might need a separate status topic or different logic if status isn't available via modbus_snmp_summ.
      // Assuming for now, statusSummary can cover I2C devices if their names match.
      if (status?.includes("success")) online++;
      else offline++;
    });
    return { online, offline };
  };

  const modbusStats = countStatus(modbusDevices);
  const totalModbusDevices = modbusDevices.length;
  const totalModbusOnline = modbusStats.online;
  const totalModbusOffline = modbusStats.offline;
  const allModbusOnline =
    totalModbusDevices === totalModbusOnline && totalModbusDevices > 0;
  const noModbusOnline = totalModbusDevices > 0 && totalModbusOnline === 0;
  const noModbusRegistered = totalModbusDevices === 0;

  // New stats for I2C devices
  const i2cStats = countStatus(i2cDevices); // Reusing countStatus, assuming compatible status reporting
  const totalI2cDevices = i2cDevices.length;
  const totalI2cOnline = i2cStats.online;
  const totalI2cOffline = i2cStats.offline;
  const allI2cOnline =
    totalI2cDevices === totalI2cOnline && totalI2cDevices > 0;
  const noI2cOnline = totalI2cDevices > 0 && totalI2cOnline === 0;
  const noI2cRegistered = totalI2cDevices === 0;

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "MQTT Gateway Dashboard";

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{appName}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!useIsMobile() && <RealtimeClock />}
          <Refresh />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Summary Cards - Modified to reflect combined or specific device types if needed */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card for Total Devices (Combined or specific) */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Devices
              </CardTitle>
              <Cpu className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {/* This now reflects total of both Modbus and I2C devices */}
              <div className="text-2xl font-bold">
                {totalModbusDevices + totalI2cDevices}
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground">
                  All registered devices
                </p>
                {noModbusRegistered && noI2cRegistered && (
                  <div className="px-2 py-0.5 rounded-full badge-info text-xs font-medium border">
                    No devices registered
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card for Online Devices (Combined) */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Online Devices
              </CardTitle>
              <Wifi className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalModbusOnline + totalI2cOnline}
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground">
                  Devices currently online
                </p>
                {allModbusOnline &&
                  totalModbusDevices > 0 &&
                  allI2cOnline &&
                  totalI2cDevices > 0 && ( // Check if both types are all online
                    <div className="px-2 py-0.5 rounded-full badge-success text-xs font-medium border">
                      All devices are online
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Card for Offline Devices (Combined) */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Offline Devices
              </CardTitle>
              <WifiOff className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalModbusOffline + totalI2cOffline}
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground">
                  Devices currently offline
                </p>
                {noModbusOnline &&
                  totalModbusDevices > 0 &&
                  noI2cOnline &&
                  totalI2cDevices > 0 && ( // Check if both types are all offline
                    <div className="px-2 py-0.5 rounded-full badge-error text-xs font-medium border">
                      All devices are offline
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="modbus" className="w-full">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="modbus">Device Modbus/SNMP</TabsTrigger>
              <TabsTrigger value="i2c">Device I2C</TabsTrigger>{" "}
              {/* New Tab Trigger */}
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
                            <span className="font-semibold">
                              {d.profile?.name}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({d.profile?.part_number})
                            </span>
                            <div className="text-xs">
                              {d.protocol_setting?.protocol === "Modbus RTU"
                                ? `Address: ${d.protocol_setting?.address}`
                                : `IP: ${d.protocol_setting?.ip_address}`}
                            </div>
                            <div className="text-xs">
                              Topic: {d.profile?.topic}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-semibold ml-2 rounded-full px-2 py-1 ${
                              statusSummary[d.profile?.name]?.includes(
                                "success"
                              )
                                ? "status-online"
                                : "status-offline"
                            }`}
                          >
                            {statusSummary[d.profile?.name]?.includes("success")
                              ? "Online"
                              : "Offline"}
                          </span>
                        </div>
                        <DeviceDataDisplay
                          topicData={deviceTopicData[d.profile?.topic]}
                          deviceName={d.profile?.name}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="i2c" className="mt-2">
            {" "}
            {/* New Tab Content for I2C */}
            <Card>
              <CardHeader>
                <CardTitle>Device I2C</CardTitle>
                <CardDescription>List of I2C devices</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {i2cDevices.length === 0 ? (
                  <div>No I2C devices found.</div>
                ) : (
                  <ul className="space-y-4">
                    {i2cDevices.map((d, i) => (
                      <li key={d.profile?.name || i} className="border-b pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <span className="font-semibold">
                              {d.profile?.name}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({d.profile?.part_number})
                            </span>
                            <div className="text-xs">
                              {/* I2C devices usually have address and device_bus */}
                              Address: {d.protocol_setting?.address}, Bus:{" "}
                              {d.protocol_setting?.device_bus}
                            </div>
                            <div className="text-xs">
                              Topic: {d.profile?.topic}
                            </div>
                          </div>
                          {/* Assuming statusSummary might also contain I2C device status,
                              or you'd need a separate mechanism for I2C status. */}
                          <span
                            className={`text-xs font-semibold ml-2 rounded-full px-2 py-1 ${
                              statusSummary[d.profile?.name]?.includes(
                                "success"
                              )
                                ? "status-online"
                                : "status-offline"
                            }`}
                          >
                            {statusSummary[d.profile?.name]?.includes("success")
                              ? "Online"
                              : "Offline"}
                          </span>
                        </div>
                        <div className="text-xs mt-1">
                          <span className="font-semibold">Live Data:</span>
                          <pre className="whitespace-pre-wrap break-words text-[10px] text-muted-foreground bg-muted p-1 rounded">
                            {(() => {
                              const topicData =
                                deviceTopicData[d.profile?.topic];
                              if (!topicData) return "Waiting...";
                              try {
                                const parsedValue = topicData.value
                                  ? JSON.parse(topicData.value)
                                  : {};
                                return JSON.stringify(parsedValue, null, 2);
                              } catch (err) {
                                return "Invalid JSON in 'value'";
                              }
                            })()}
                          </pre>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarInset>
  );
}
