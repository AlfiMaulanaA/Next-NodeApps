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
  const [deviceTopicData, setDeviceTopicData] = useState<Record<string, any>>(
    {}
  );
  // State untuk menyimpan status device (online/offline)
  const [deviceStatus, setDeviceStatus] = useState<Record<string, string>>({});

  // Function to parse status message and extract device name and status
  const parseStatusMessage = (statusMessage: string): { deviceName: string; isSuccess: boolean } | null => {
    // Format: "SeedStudio_PH_1 data acquisition failed" atau "RELAY data acquisition success"
    const regex = /^(.+?)\s+data acquisition\s+(success|failed)/i;
    const match = statusMessage.match(regex);

    if (match) {
      const deviceName = match[1].trim();
      const status = match[2].toLowerCase();
      return {
        deviceName,
        isSuccess: status === 'success'
      };
    }
    return null;
  };

  // Function to render dynamic JSON data with badges for each key-value pair
  const renderDynamicJSON = (data: any): JSX.Element => {
    if (data === null || data === undefined) {
      return (
        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs badge-data border">
            null
          </span>
        </div>
      );
    }

    if (typeof data === "boolean") {
      return (
        <div className="flex flex-wrap gap-1">
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
              data
                ? "badge-success"
                : "badge-error"
            }`}
          >
            {data.toString()}
          </span>
        </div>
      );
    }

    if (typeof data === "number") {
      return (
        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs badge-data border">
            {data}
          </span>
        </div>
      );
    }

    if (typeof data === "string") {
      return (
        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs badge-data border">
            {data}
          </span>
        </div>
      );
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return (
          <div className="flex flex-wrap gap-1">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs badge-data border">
              Empty Array
            </span>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-medium">
            Array ({data.length} items)
          </div>
          <div className="flex flex-wrap gap-1">
            {data.map((item, index) => (
              <div key={index} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">[{index}]</span>
                {renderDynamicJSON(item)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (typeof data === "object") {
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return (
          <div className="flex flex-wrap gap-1">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs badge-data border">
              Empty Object
            </span>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 p-1.5 bg-card border rounded"
              >
                <div
                  className="text-xs text-data-key truncate flex-shrink-0"
                  title={key}
                >
                  {key}:
                </div>
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {renderDynamicJSON(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs badge-data border">
          {String(data)}
        </span>
      </div>
    );
  };

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

            payload.forEach((d) => {
              const t = d.profile?.topic;
              if (t && !dynamicTopics.has(t)) {
                client.subscribe(t);
                dynamicTopics.add(t);
              }
            });
          }
        } else if (topic === "modbus_snmp_summ") {
          // Handle Modbus/SNMP status summary
          const statusMessage = payload["MODBUS SNMP STATUS"];
          if (typeof statusMessage === "string") {
            const parsed = parseStatusMessage(statusMessage);
            if (parsed) {
              setDeviceStatus((prev) => ({
                ...prev,
                [parsed.deviceName]: parsed.isSuccess ? "online" : "offline"
              }));
            }
          }
        } else if (topic === "modular_i2c_summ") {
          // Handle Modular I2C status summary
          const statusMessage = payload["MODULAR I2C STATUS"];
          if (typeof statusMessage === "string") {
            const parsed = parseStatusMessage(statusMessage);
            if (parsed) {
              setDeviceStatus((prev) => ({
                ...prev,
                [parsed.deviceName]: parsed.isSuccess ? "online" : "offline"
              }));
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
    // Subscribe to device response topics and status summary topics
    const baseTopics = [
      "response_device_modbus",
      "response_device_i2c",
      "modbus_snmp_summ",
      "modular_i2c_summ"
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

  // Calculate device statistics
  const totalModbusDevices = modbusDevices.length;
  const noModbusRegistered = totalModbusDevices === 0;

  const totalI2cDevices = i2cDevices.length;
  const noI2cRegistered = totalI2cDevices === 0;

  // Count online/offline devices
  const countDeviceStatus = () => {
    let online = 0;
    let offline = 0;

    // Count Modbus devices
    modbusDevices.forEach((d) => {
      const status = deviceStatus[d.profile?.name];
      if (status === "online") online++;
      else if (status === "offline") offline++;
    });

    // Count I2C devices
    i2cDevices.forEach((d) => {
      const status = deviceStatus[d.profile?.name];
      if (status === "online") online++;
      else if (status === "offline") offline++;
    });

    return { online, offline };
  };

  const { online: totalOnline, offline: totalOffline } = countDeviceStatus();
  const totalDevices = totalModbusDevices + totalI2cDevices;
  const allDevicesOnline = totalDevices > 0 && totalOnline === totalDevices;
  const noDevicesOnline = totalDevices > 0 && totalOnline === 0;

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
                {noModbusRegistered && noI2cRegistered ? (
                  <div className="px-2 py-0.5 rounded-full badge-info text-xs font-medium border">
                    No devices registered
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Card for Online Devices */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Online Devices
              </CardTitle>
              <Wifi className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOnline}</div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground">
                  Devices currently online
                </p>
                {allDevicesOnline && (
                  <div className="px-2 py-0.5 rounded-full badge-success text-xs font-medium border">
                    All devices are online
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card for Offline Devices */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Offline Devices
              </CardTitle>
              <WifiOff className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOffline}</div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground">
                  Devices currently offline
                </p>
                {noDevicesOnline && totalDevices > 0 && (
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
                          {/* Status badge based on MQTT status summary */}
                          {deviceStatus[d.profile?.name] && (
                            <span
                              className={`text-xs font-semibold ml-2 rounded-full px-2 py-1 ${
                                deviceStatus[d.profile?.name] === "online"
                                  ? "status-online"
                                  : "status-offline"
                              }`}
                            >
                              {deviceStatus[d.profile?.name] === "online"
                                ? "Online"
                                : "Offline"}
                            </span>
                          )}
                        </div>
                        <div className="text-xs mt-1">
                          <span className="font-semibold">Live Data:</span>
                          <div className="mt-1 p-2 bg-muted rounded border">
                            {(() => {
                              const topicData =
                                deviceTopicData[d.profile?.topic];
                              if (!topicData)
                                return (
                                  <span className="text-muted-foreground italic">
                                    Waiting...
                                  </span>
                                );
                              try {
                                // Only display the parsed content from the 'value' field
                                if (topicData.value) {
                                  const parsedValue = JSON.parse(
                                    topicData.value
                                  );
                                  return renderDynamicJSON(parsedValue);
                                } else {
                                  return (
                                    <span className="text-muted-foreground">
                                      No data available
                                    </span>
                                  );
                                }
                              } catch (err) {
                                return (
                                  <span className="text-red-600">
                                    Invalid data format
                                  </span>
                                );
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
                          {/* Status badge based on MQTT status summary */}
                          {deviceStatus[d.profile?.name] && (
                            <span
                              className={`text-xs font-semibold ml-2 rounded-full px-2 py-1 ${
                                deviceStatus[d.profile?.name] === "online"
                                  ? "status-online"
                                  : "status-offline"
                              }`}
                            >
                              {deviceStatus[d.profile?.name] === "online"
                                ? "Online"
                                : "Offline"}
                            </span>
                          )}
                        </div>
                        <div className="text-xs mt-1">
                          <span className="font-semibold">Live Data:</span>
                          <div className="mt-1 p-2 bg-muted rounded border">
                            {(() => {
                              const topicData =
                                deviceTopicData[d.profile?.topic];
                              if (!topicData)
                                return (
                                  <span className="text-muted-foreground italic">
                                    Waiting...
                                  </span>
                                );
                              try {
                                // Only display the parsed content from the 'value' field
                                if (topicData.value) {
                                  const parsedValue = JSON.parse(
                                    topicData.value
                                  );
                                  return renderDynamicJSON(parsedValue);
                                } else {
                                  return (
                                    <span className="text-muted-foreground">
                                      No data available
                                    </span>
                                  );
                                }
                              } catch (err) {
                                return (
                                  <span className="text-red-600">
                                    Invalid data format
                                  </span>
                                );
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
        </Tabs>
      </div>
    </SidebarInset>
  );
}
