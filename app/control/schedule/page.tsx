"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, BarChart, Edit2, Trash2 } from "lucide-react";
import { connectMQTT } from "@/lib/mqttClient";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Control {
  pin: number;
  customName: string;
  onTime: string;
  offTime: string;
}

interface Device {
  id: string;
  customName: string;
  address: string;
  device_bus: string;
  startDay: string;
  endDay: string;
  controls: Control[];
}

export default function SchedulerPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [autoControl, setAutoControl] = useState(false);
  const status = useMQTTStatus();
  const client = connectMQTT();

  useEffect(() => {
    if (!client) return;

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        if (Array.isArray(payload.devices)) {
          setDevices(payload.devices);
          setAutoControl(payload.autoControl);
        } else if (payload.result) {
          toast.success(payload.message || "Operation successful");
        }
      } catch (err) {
        console.error("Failed to parse MQTT message", err);
        toast.error("MQTT parsing error");
      }
    };

    client.on("message", handleMessage);
    client.subscribe("response_control_scheduler");

    client.publish("command_control_scheduler", JSON.stringify({ action: "get" }));

    return () => {
      client.unsubscribe("response_control_scheduler");
      client.off("message", handleMessage);
    };
  }, [client]);

  const updateAutoControl = () => {
    client?.publish(
      "command_control_scheduler",
      JSON.stringify({ action: "update_autoControl", data: { autoControl } })
    );
  };

  const refreshConfig = () => {
    client?.publish("command_control_scheduler", JSON.stringify({ action: "get" }));
  };

  const deleteDevice = (id: string) => {
    client?.publish(
      "command_control_scheduler",
      JSON.stringify({ action: "delete", data: { id } })
    );
    setDevices((prev) => prev.filter((d) => d.id !== id));
    toast.success("Device deleted");
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <BarChart className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Scheduler Control</h1>
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
            onClick={refreshConfig}
          >
            <RotateCw />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold">Control State</h2>
          <Switch checked={autoControl} onCheckedChange={setAutoControl} onBlur={updateAutoControl} />
        </div>

        {devices.length > 0 ? (
          devices.map((device, index) => (
            <Card key={device.id}>
              <CardHeader>
                <CardTitle className="text-base">{device.customName}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Address: {device.address} — Bus: {device.device_bus} — Days: {device.startDay}–{device.endDay}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {device.controls.map((ctrl) => (
                  <div key={ctrl.pin} className="text-sm flex justify-between">
                    <span>
                      <strong>{ctrl.customName}</strong> (Pin {ctrl.pin})
                    </span>
                    <span>
                      On: {ctrl.onTime} — Off: {ctrl.offTime}
                    </span>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline">
                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteDevice(device.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              No scheduler devices found.
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
}
