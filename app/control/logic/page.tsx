"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, FileBarChart, Edit2, Trash2 } from "lucide-react";
import { connectMQTT } from "@/lib/mqttClient";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";
import { toast } from "sonner";

interface Relay {
  address: string;
  bus: string;
  pin: number;
  set_value: number;
  customName: string;
  control_type: string;
  delay: number;
  latching_mode: boolean;
}

interface DryContact {
  id: string;
  customName: string;
  address: string;
  bus: string;
  pin: number;
  expected_value: number;
  control_relays: Relay[];
}

export default function LogicControlPage() {
  const [configs, setConfigs] = useState<DryContact[]>([]);
  const [status, setStatus] = useState("disconnected");
  const client = connectMQTT();

  useEffect(() => {
    if (!client) return;

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());

        if (topic === "response_get_data") {
          setConfigs(payload.data.read_data || []);
        } else if (topic === "response_control_drycontact") {
          if (payload.status === "success") {
            toast.success(payload.message);
            refreshData();
            restartService();
          } else {
            toast.error(payload.message);
          }
        } else if (topic === "service/response") {
          if (payload.result === "success") {
            toast.success(payload.message);
          } else {
            toast.error(payload.message);
          }
        }
      } catch (err) {
        console.error("Failed to parse MQTT message", err);
        toast.error("MQTT parsing error");
      }
    };

    client.on("message", handleMessage);
    client.subscribe("response_get_data");
    client.subscribe("response_control_drycontact");
    client.subscribe("service/response");

    setStatus("connected");
    refreshData();

    return () => {
      client.unsubscribe("response_get_data");
      client.unsubscribe("response_control_drycontact");
      client.unsubscribe("service/response");
      client.off("message", handleMessage);
    };
  }, [client]);

  const refreshData = () => {
    client?.publish(
      "command_control_drycontact",
      JSON.stringify({ action: "get" })
    );
  };

  const deleteConfig = (id: string) => {
    client?.publish(
      "command_control_drycontact",
      JSON.stringify({ command: "delete", data: { id } })
    );
    toast.success("Configuration deleted");
    restartService();
  };

  const restartService = () => {
    const command = JSON.stringify({
      action: "restart",
      services: ["modular_i2c.service", "drycontact_control.service"],
    });
    client?.publish("service/command", command);
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <FileBarChart className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Logic Control Configurations</h1>
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
            onClick={refreshData}
          >
            <RotateCw />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {configs.length > 0 ? (
          configs.map((entry, index) => (
            <Card key={entry.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {index + 1}. {entry.customName || "N/A"}
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  Addr: {entry.address} — Bus: {entry.bus} — Pin: {entry.pin} —
                  Expected: {entry.expected_value ? "True" : "False"}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm font-medium">Control Relays:</div>
                {entry.control_relays.map((relay, idx) => (
                  <div key={idx} className="text-sm border rounded p-2">
                    <div>
                      <strong>{relay.customName}</strong> — Addr: {relay.address},
                      Bus: {relay.bus}, Pin: {relay.pin}
                    </div>
                    <div>
                      Set: {relay.set_value ? "True" : "False"}, Type: {relay.control_type},
                      Delay: {relay.delay}s, Latching: {relay.latching_mode ? "Yes" : "No"}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline">
                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteConfig(entry.id)}
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
              No dry contact configurations found.
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
}
