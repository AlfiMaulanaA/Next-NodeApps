// components/pages/MqttConfigPage.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Server, Edit2, RefreshCw, Loader2, Wifi } from "lucide-react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";
import MqttStatus from "@/components/mqtt-status";

interface MqttConfig {
  broker_address: string;
  broker_port: number;
  username: string;
  password: string;
}

interface ConnectionStatus {
  status: "connected" | "disconnected" | "error";
  response_time?: number;
  message: string;
  error?: string;
}

export default function MqttConfigPage() {
  const [activeTab, setActiveTab] = useState<"modular" | "modbus">("modular");
  const [modularConfig, setModularConfig] = useState<MqttConfig | null>(null);
  const [modularConnection, setModularConnection] =
    useState<ConnectionStatus | null>(null);
  const [modbusConfig, setModbusConfig] = useState<MqttConfig | null>(null);
  const [modbusConnection, setModbusConnection] =
    useState<ConnectionStatus | null>(null);
  const [editConfig, setEditConfig] = useState<MqttConfig>({
    broker_address: "",
    broker_port: 1883,
    username: "",
    password: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    // Subscribe to the new Network.py response topics
    const topicsToSubscribe = [
      "mqtt_config/modular/response",
      "mqtt_config/modbus/response",
    ];
    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });

    const handleMessage = (topic: string, buf: Buffer) => {
      try {
        const response = JSON.parse(buf.toString());

        if (topic === "mqtt_config/modular/response") {
          if (response.status === "success" && response.data) {
            setModularConfig(response.data);
            if (response.connection) {
              setModularConnection(response.connection);
            }
            toast.success("MQTT Modular Config Updated! 🎉", { id: "mqtt-config" });
            setDialogOpen(false); // Close dialog on successful update
          } else if (response.status === "error") {
            toast.error(`Modular Config Error: ${response.message}`, { id: "mqtt-config" });
          }
        } else if (topic === "mqtt_config/modbus/response") {
          if (response.status === "success" && response.data) {
            setModbusConfig(response.data);
            if (response.connection) {
              setModbusConnection(response.connection);
            }
            toast.success("MQTT Modbus Config Updated! 🚀", { id: "mqtt-config" });
            setDialogOpen(false); // Close dialog on successful update
          } else if (response.status === "error") {
            toast.error(`Modbus Config Error: ${response.message}`, { id: "mqtt-config" });
          }
        }
      } catch (err) {
        toast.error(
          "Invalid response format from MQTT. Check backend payload.", { id: "mqtt-config" }
        );
        console.error(
          "Error parsing MQTT message. Raw string:",
          buf.toString(),
          "Error:",
          err
        );
      }
    };

    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (clientRef.current) {
        topicsToSubscribe.forEach((topic) => {
          clientRef.current?.unsubscribe(topic);
        });
        clientRef.current.off("message", handleMessage);
      }
    };
  }, []);

  const handleInput = (field: keyof MqttConfig, value: string | number) => {
    setEditConfig((prev) => ({ ...prev, [field]: value }));
  };

  const openEditModal = () => {
    const cfg = activeTab === "modular" ? modularConfig : modbusConfig;
    if (cfg) {
      setEditConfig(cfg);
      setDialogOpen(true);
    } else {
      toast.error(
        "Configuration not loaded yet. Auto-publishing from backend may take a few seconds. ⏳"
      );
    }
  };

  const saveConfig = () => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Cannot save configuration. 😔");
      return;
    }

    setIsLoading(true);
    toast.loading("Applying MQTT configuration...", { id: "mqtt-config" });

    // Prepare the command payload for Network.py
    const commandPayload = {
      command:
        activeTab === "modular" ? "updateMqttModular" : "updateMqttModbus",
      data: {
        broker_address: editConfig.broker_address,
        broker_port: editConfig.broker_port,
        username: editConfig.username,
        password: editConfig.password,
      },
    };

    const topic =
      activeTab === "modular"
        ? "mqtt_config/modular/command"
        : "mqtt_config/modbus/command";

    client.publish(topic, JSON.stringify(commandPayload), (err) => {
      if (err) {
        toast.error(`Failed to publish config update: ${err.message} 😭`, { id: "mqtt-config" });
        setIsLoading(false);
      } else {
        toast.loading("Configuration update sent. Waiting for confirmation... 📡", { id: "mqtt-config" });
        // Do NOT close dialog here - wait for backend response
        // Dialog will be closed in handleMessage on successful response
        setTimeout(() => setIsLoading(false), 2000);
      }
    });
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Wifi className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">MQTT Configuration</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            Auto-refresh every 5s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
        </div>
      </header>

      <div className="p-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "modular" | "modbus")}
        >
          <TabsList>
            <TabsTrigger value="modular">MQTT Modular</TabsTrigger>
            <TabsTrigger value="modbus">MQTT Modbus</TabsTrigger>
          </TabsList>

          <TabsContent value="modular">
            <ConfigView
              config={modularConfig}
              connection={modularConnection}
              onEdit={openEditModal}
            />
          </TabsContent>
          <TabsContent value="modbus">
            <ConfigView
              config={modbusConfig}
              connection={modbusConnection}
              onEdit={openEditModal}
            />
          </TabsContent>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Configuration</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="broker_address">Broker Address</Label>
              <Input
                id="broker_address"
                placeholder="localhost or 192.168.1.100 or broker.example.com"
                value={editConfig.broker_address}
                onChange={(e) => handleInput("broker_address", e.target.value)}
              />
              <Label htmlFor="broker_port">Broker Port</Label>
              <Input
                id="broker_port"
                placeholder="Broker Port"
                type="number"
                value={editConfig.broker_port}
                onChange={(e) =>
                  handleInput("broker_port", Number(e.target.value))
                }
              />
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Username (optional)"
                value={editConfig.username}
                onChange={(e) => handleInput("username", e.target.value)}
              />
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="Password (optional)"
                value={editConfig.password}
                type="password"
                onChange={(e) => handleInput("password", e.target.value)}
              />
              <Button onClick={saveConfig} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />{" "}
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 mr-1" /> Update Configuration
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}

function ConfigView({
  config,
  connection,
  onEdit,
}: {
  config: MqttConfig | null;
  connection: ConnectionStatus | null;
  onEdit: () => void;
}) {
  const getConnectionIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Wifi className="w-4 h-4 text-green-500" />;
      case "disconnected":
        return <Wifi className="w-4 h-4 text-red-500" />;
      case "error":
        return <Server className="w-4 h-4 text-red-500" />;
      default:
        return <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />;
    }
  };

  const getConnectionText = (status: ConnectionStatus | null) => {
    if (!status) return "Checking...";

    switch (status.status) {
      case "connected":
        return `Connected (${status.response_time}ms)`;
      case "disconnected":
        return "Disconnected";
      case "error":
        return `Error: ${status.error || "Unknown error"}`;
      default:
        return "Checking...";
    }
  };

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Configuration...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground flex items-center">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching data...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>MQTT Broker</span>
          <div className="flex items-center gap-2 text-sm">
            {getConnectionIcon(connection?.status || "loading")}
            <span
              className={`text-xs ${
                connection?.status === "connected"
                  ? "text-green-600"
                  : connection?.status === "disconnected"
                  ? "text-red-600"
                  : "text-gray-500"
              }`}
            >
              {getConnectionText(connection)}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <table className="text-sm w-full">
          <tbody>
            <tr>
              <td className="font-medium pr-4 py-1">Broker Address</td>
              <td className="py-1">{config.broker_address}</td>
            </tr>
            <tr>
              <td className="font-medium pr-4 py-1">Broker Port</td>
              <td className="py-1">{config.broker_port}</td>
            </tr>
            <tr>
              <td className="font-medium pr-4 py-1">Username</td>
              <td className="py-1">{config.username || "—"}</td>
            </tr>
            <tr>
              <td className="font-medium pr-4 py-1">Password</td>
              <td className="py-1">{config.password ? "••••••" : "—"}</td>
            </tr>
          </tbody>
        </table>
        <div className="flex gap-2 mt-4">
          <Button onClick={onEdit}>
            <Edit2 className="w-4 h-4 mr-1" /> Update Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
