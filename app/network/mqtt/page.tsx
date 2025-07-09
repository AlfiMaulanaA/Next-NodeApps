"use client";

import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import { toast } from "sonner";
import {
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card, CardHeader, CardContent, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wifi, WifiOff, Loader2, Server, Edit2, RefreshCw } from "lucide-react";

interface MqttConfig {
  username: string;
  password: string;
  broker_address: string;
  broker_port: number;
}

export default function MqttConfigPage() {
  const [status, setStatus] = useState<"connected"|"disconnected"|"error">("disconnected");
  const [activeTab, setActiveTab] = useState<"mqtt"|"modbus">("mqtt");
  const [mqttConfig, setMqttConfig] = useState<MqttConfig | null>(null);
  const [modbusConfig, setModbusConfig] = useState<MqttConfig | null>(null);
  const [editConfig, setEditConfig] = useState<MqttConfig>({ username: "", password: "", broker_address: "", broker_port: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const clientRef = useRef<mqtt.MqttClient>();

  const handleInput = (field: keyof MqttConfig, value: string | number) => {
    setEditConfig(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const client = mqtt.connect(`${process.env.NEXT_PUBLIC_MQTT_BROKER_URL}`);

    client.on("connect", () => {
      setStatus("connected");
      client.subscribe("mqtt_config");
      client.subscribe("mqtt_config_modbus");
      client.subscribe("service/response");
      // Request configs
      client.publish("mqtt_config/request", JSON.stringify({ action: "readConfiguration" }));
      client.publish("mqtt_config_modbus/request", JSON.stringify({ action: "readConfiguration" }));
    });

    client.on("error", () => setStatus("error"));
    client.on("close", () => setStatus("disconnected"));

    client.on("message", (_, buf) => {
      const data = JSON.parse(buf.toString());
      if (_.endsWith("mqtt_config")) {
        setMqttConfig(data);
      } else if (_.endsWith("mqtt_config_modbus")) {
        setModbusConfig(data);
      } else if (_.endsWith("service/response")) {
        toast.success(data.message || "Service response");
      }
    });

    clientRef.current = client;
    return () => {
      client.end(); // Proper cleanup, returns void
    };
  }, []);

  const renderStatusIcon = () => {
    if (status === "connected") return <Wifi className="w-4 h-4 text-green-500" />;
    if (status === "error") return <WifiOff className="w-4 h-4 text-red-500" />;
    return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
  };

  const openEditModal = () => {
    const cfg = activeTab === "mqtt" ? mqttConfig : modbusConfig;
    if (cfg) {
      setEditConfig(cfg);
      setDialogOpen(true);
    } else {
      toast.error("Configuration not loaded yet");
    }
  };

  const saveConfig = () => {
    const topic = activeTab === "mqtt" ? "mqtt_config/update" : "mqtt_config_modbus/update";
    clientRef.current?.publish(topic, JSON.stringify(editConfig));
    setDialogOpen(false);
    // trigger service restart
    clientRef.current?.publish("service/command", JSON.stringify({
      action: "restart",
      services: ["mqtt_config.service", "mqtt_modbus.service"]
    }));
    toast.success("Configuration updated & service restarted");
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Server className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">MQTT Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          {renderStatusIcon()}
          <span className="capitalize text-sm">{status}</span>
          <Button variant="outline" size="icon" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "mqtt" | "modbus")}>
          <TabsList>
            <TabsTrigger value="mqtt">MQTT Modular</TabsTrigger>
            <TabsTrigger value="modbus">MQTT Modbus</TabsTrigger>
          </TabsList>

          <TabsContent value="mqtt">
            <ConfigView config={mqttConfig} onEdit={openEditModal} />
          </TabsContent>
          <TabsContent value="modbus">
            <ConfigView config={modbusConfig} onEdit={openEditModal} />
          </TabsContent>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Configuration</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Username"
                value={editConfig.username}
                onChange={e => handleInput("username", e.target.value)}
              />
              <Input
                placeholder="Password"
                value={editConfig.password}
                type="password"
                onChange={e => handleInput("password", e.target.value)}
              />
              <Input
                placeholder="Broker Address"
                value={editConfig.broker_address}
                onChange={e => handleInput("broker_address", e.target.value)}
              />
              <Input
                placeholder="Broker Port"
                type="number"
                value={editConfig.broker_port}
                onChange={e => handleInput("broker_port", Number(e.target.value))}
              />
              <Button onClick={saveConfig}>
                <Edit2 className="w-4 h-4 mr-1" /> Save
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
  onEdit
}: {
  config: MqttConfig | null;
  onEdit: () => void;
}) {
  if (!config) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection: {config.broker_address}:{config.broker_port}</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="text-sm w-full">
          <tbody>
            <tr>
              <td className="font-medium">Username</td><td>{config.username || "—"}</td>
            </tr>
            <tr>
              <td className="font-medium">Password</td><td>{config.password ? "••••••" : "—"}</td>
            </tr>
            <tr>
              <td className="font-medium">Broker Address</td><td>{config.broker_address}</td>
            </tr>
            <tr>
              <td className="font-medium">Broker Port</td><td>{config.broker_port}</td>
            </tr>
          </tbody>
        </table>
        <Button className="mt-4" onClick={onEdit}>
          <Edit2 className="w-4 h-4 mr-1" /> Update Configuration
        </Button>
      </CardContent>
    </Card>
  );
}
