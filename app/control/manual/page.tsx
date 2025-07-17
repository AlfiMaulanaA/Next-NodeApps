"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, SlidersHorizontal } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { connectMQTT } from "@/lib/mqttClient";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";

interface Device {
  profile?: {
    id?: string;
    name?: string;
    topic?: string;
    part_number?: string;
  };
  protocol_setting?: {
    address?: string;
  };
}

interface DeviceMessage {
  mac: string;
  value: string;
  Timestamp: string;
}

export default function ModularDashboardPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceMessages, setDeviceMessages] = useState<Record<string, DeviceMessage>>({});
  const [messageVisibility, setMessageVisibility] = useState<Record<string, boolean>>({});
  const status = useMQTTStatus();
  const client = connectMQTT();

  useEffect(() => {
    if (!client) return;

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        if (Array.isArray(payload)) {
          setDevices(payload);
        } else if (payload?.topic) {
          setDeviceMessages((prev) => ({ ...prev, [topic]: payload }));
        }
      } catch (err) {
        console.error("Failed to parse MQTT message", err);
      }
    };

    client.on("message", handleMessage);
    client.subscribe("response_device_i2c");
    client.subscribe("device_data/#");

    return () => {
      client.unsubscribe("response_device_i2c");
      client.unsubscribe("device_data/#");
      client.off("message", handleMessage);
    };
  }, [client]);

  const toggleVisibility = (id?: string) => {
    if (!id) return;
    setMessageVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getAllData = () => {
    client?.publish("command_device_i2c", JSON.stringify({ command: "getDataI2C" }));
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Modular Control Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`capitalize ${
              status === "connected"
                ? "text-green-600 border-green-600"
                : status === "error"
                ? "text-red-600 border-red-600"
                : "text-yellow-600 border-yellow-600"
            }`}
          >
            {status}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={getAllData}
          >
            <RotateCw />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {devices.length > 0 ? (
          devices.map((device) => (
            <Card key={device.profile?.id}>
              <CardHeader className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">
                    {device.profile?.name} ({device.profile?.part_number})
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    Addr: {device.protocol_setting?.address}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Topic: {device.profile?.topic}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleVisibility(device.profile?.id)}
                  >
                    {messageVisibility[device.profile?.id || ""] ? "Hide" : "Show"}
                  </Button>
                </div>
              </CardHeader>
              {messageVisibility[device.profile?.id || ""] && (
                <CardContent className="space-y-2 text-sm">
                  <pre className="rounded bg-muted p-2 whitespace-pre-wrap">
                    {JSON.stringify(deviceMessages[device.profile?.topic || ""], null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              No devices found. Click refresh to try again.
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
}
