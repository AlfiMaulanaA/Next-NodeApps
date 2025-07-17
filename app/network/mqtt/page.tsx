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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Server, Edit2, RefreshCw, Loader2 } from "lucide-react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";
import MqttStatus from "@/components/mqtt-status";

interface MqttConfig {
  username: string;
  password: string;
  broker_address: string;
  broker_port: number;
}

export default function MqttConfigPage() {
  const [activeTab, setActiveTab] = useState<"mqtt" | "modbus">("mqtt");
  const [mqttConfig, setMqttConfig] = useState<MqttConfig | null>(null);
  const [modbusConfig, setModbusConfig] = useState<MqttConfig | null>(null);
  const [editConfig, setEditConfig] = useState<MqttConfig>({ username: "", password: "", broker_address: "", broker_port: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);

  const requestConfigs = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      setTimeout(() => {
        client.publish("mqtt_config/request", JSON.stringify({ action: "readConfiguration" }));
        client.publish("mqtt_config_modbus/request", JSON.stringify({ action: "readConfiguration" }));
        toast.info("Requesting latest configurations...");
      }, 300);
    } else {
      toast.warning("MQTT not connected. Cannot request configuration.");
    }
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = ["mqtt_config", "mqtt_config_modbus", "service/response"];
    topicsToSubscribe.forEach(topic => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });

    if (mqttClientInstance.connected) {
      requestConfigs();
    }

    const handleConnect = () => {
      requestConfigs();
    };

    const handleMessage = (topic: string, buf: Buffer) => {
      try {
        const data = JSON.parse(buf.toString());
        if (topic === "mqtt_config") {
          setMqttConfig(data);
          toast.success("MQTT Modular Config Loaded! 🎉");
        } else if (topic === "mqtt_config_modbus") {
          setModbusConfig(data);
          toast.success("MQTT Modbus Config Loaded! 🚀");
        } else if (topic === "service/response" && data.message) {
          toast.success(data.message);
        }
      } catch (err) {
        toast.error("Invalid response format from MQTT. Check backend payload.");
        console.error("Error parsing MQTT message. Raw string:", buf.toString(), "Error:", err);
      }
    };

    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (clientRef.current) {
        topicsToSubscribe.forEach(topic => {
          clientRef.current?.unsubscribe(topic);
        });
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("message", handleMessage);
      }
    };
  }, [requestConfigs]);

  const handleInput = (field: keyof MqttConfig, value: string | number) => {
    setEditConfig(prev => ({ ...prev, [field]: value }));
  };

  const openEditModal = () => {
    const cfg = activeTab === "mqtt" ? mqttConfig : modbusConfig;
    if (cfg) {
      setEditConfig(cfg);
      setDialogOpen(true);
    } else {
      toast.error("Configuration not loaded yet. Ensure MQTT connection and try refreshing. ⏳");
    }
  };

  const saveConfig = () => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Cannot save configuration. 😔");
      return;
    }

    const topic = activeTab === "mqtt" ? "mqtt_config/update" : "mqtt_config_modbus/update";
    client.publish(topic, JSON.stringify(editConfig), (err) => {
      if (err) {
        toast.error(`Failed to publish config: ${err.message} 😭`);
      } else {
        setDialogOpen(false);
        const serviceName = activeTab === "mqtt" ? "mqtt_config.service" : "mqtt_modbus.service";
        client.publish("service/command", JSON.stringify({
          action: "restart",
          services: [serviceName]
        }), (restartErr) => {
            if (restartErr) {
                toast.error(`Failed to send restart command: ${restartErr.message} 😵‍💫`);
            } else {
                toast.success("Configuration updated & service restarted. Refreshing data... ✨");
                requestConfigs();
            }
        });
      }
    });
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
          <MqttStatus />
          <Button variant="outline" size="icon" onClick={requestConfigs}>
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
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Username"
                value={editConfig.username}
                onChange={e => handleInput("username", e.target.value)}
              />
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="Password"
                value={editConfig.password}
                type="password"
                onChange={e => handleInput("password", e.target.value)}
              />
              <Label htmlFor="broker_address">Broker Address</Label>
              <Input
                id="broker_address"
                placeholder="Broker Address"
                value={editConfig.broker_address}
                onChange={e => handleInput("broker_address", e.target.value)}
              />
              <Label htmlFor="broker_port">Broker Port</Label>
              <Input
                id="broker_port"
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
        <CardTitle>MQTT Broker</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="text-sm w-full">
          <tbody>
            <tr>
              <td className="font-medium pr-4 py-1">Username</td><td className="py-1">{config.username || "—"}</td>
            </tr>
            <tr>
              <td className="font-medium pr-4 py-1">Password</td><td className="py-1">{config.password ? "••••••" : "—"}</td>
            </tr>
            <tr>
              <td className="font-medium pr-4 py-1">Broker Address</td><td className="py-1">{config.broker_address}</td>
            </tr>
            <tr>
              <td className="font-medium pr-4 py-1">Broker Port</td><td className="py-1">{config.broker_port}</td>
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