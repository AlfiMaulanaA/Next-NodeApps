"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import { toast } from "sonner";
import {
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
  Server,
  Network,
  Settings2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import MqttStatus from "@/components/mqtt-status";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";

interface NodeInfoConfig {
  NODE_NAME: string;
  BASE_TOPIC_MQTT: string;
}

export default function NodeInfoConfigPage() {
  const [config, setConfig] = useState<NodeInfoConfig>({
    NODE_NAME: "",
    BASE_TOPIC_MQTT: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>("");
  const clientRef = useRef<any>(null);

  // Use centralized MQTT status management
  const mqttStatus = useMQTTStatus();

  // MQTT setup menggunakan pola yang sama dengan network/mqtt page (proven working)
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    // Subscribe ke response topic (mengikuti pola network/mqtt page)
    mqttClientInstance.subscribe("node_info/response", (err) => {
      if (err) {
        console.error(`Failed to subscribe to node_info/response:`, err);
      } else {
        console.log("Successfully subscribed to node_info/response");
      }
    });

    // Message handler menggunakan pola network/mqtt page
    const handleMessage = (topic: string, buf: Buffer) => {
      try {
        const response = JSON.parse(buf.toString());
        console.log("Received Node Info response on topic:", topic, response);

        setLastResponse(`${new Date().toLocaleTimeString()} - ${response.status}: ${response.message}`);

        if (response.status === "success") {
          // Jika mendapat data config, update state
          if (response.data && typeof response.data === 'object') {
            setConfig({
              NODE_NAME: response.data.NODE_NAME || '',
              BASE_TOPIC_MQTT: response.data.BASE_TOPIC_MQTT || ''
            });
            toast.success("Current configuration loaded successfully");
            console.log("Updated config state:", { NODE_NAME: response.data.NODE_NAME, BASE_TOPIC_MQTT: response.data.BASE_TOPIC_MQTT });
          } else {
            toast.success(response.message || "Command executed successfully");
          }
        } else if (response.status === "error") {
          toast.error(response.message || "Command failed");
        }

        setIsLoading(false);
        setIsSaving(false);
      } catch (error: unknown) {
        console.error("Error parsing Node Info response:", error);
        toast.error("Failed to parse response from service");
        setIsLoading(false);
        setIsSaving(false);
      }
    };

    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (clientRef.current) {
        clientRef.current.unsubscribe("node_info/response");
        clientRef.current.off("message", handleMessage);
      }
    };
  }, []);

  // Helper function untuk publish MQTT message
  const publishCommand = (command: any) => {
    const client = clientRef.current;
    if (!client || mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return false;
    }

    try {
      client.publish("node_info/command", JSON.stringify(command), (err: Error | null) => {
        if (err) {
          console.error("Failed to publish command:", err);
        } else {
          console.log("Published command:", command);
        }
      });
      return true;
    } catch (error) {
      console.error("Error publishing command:", error);
      return false;
    }
  };

  // Function untuk get current config
  const handleGetConfig = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    setIsLoading(true);
    const success = publishCommand({
      command: "get_config",
    });

    if (!success) {
      toast.error("Failed to send get_config command");
      setIsLoading(false);
    }
  };

  // Function untuk update node name
  const handleUpdateNodeName = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    if (!config.NODE_NAME.trim()) {
      toast.error("Node name cannot be empty");
      return;
    }

    setIsSaving(true);
    const success = publishCommand({
      command: "update_node_name",
      node_name: config.NODE_NAME.trim(),
    });

    if (!success) {
      toast.error("Failed to send update_node_name command");
      setIsSaving(false);
    }
  };

  // Function untuk update base topic
  const handleUpdateBaseTopic = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    if (!config.BASE_TOPIC_MQTT.trim()) {
      toast.error("Base topic cannot be empty");
      return;
    }

    // Pastikan base topic diakhiri dengan '/'
    let baseTopic = config.BASE_TOPIC_MQTT.trim();
    if (!baseTopic.endsWith('/')) {
      baseTopic += '/';
      setConfig(prev => ({ ...prev, BASE_TOPIC_MQTT: baseTopic }));
    }

    setIsSaving(true);
    const success = publishCommand({
      command: "update_base_topic",
      base_topic: baseTopic,
    });

    if (!success) {
      toast.error("Failed to send update_base_topic command");
      setIsSaving(false);
    }
  };

  // Function untuk update all config
  const handleUpdateAll = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    if (!config.NODE_NAME.trim() || !config.BASE_TOPIC_MQTT.trim()) {
      toast.error("Both node name and base topic are required");
      return;
    }

    // Pastikan base topic diakhiri dengan '/'
    let baseTopic = config.BASE_TOPIC_MQTT.trim();
    if (!baseTopic.endsWith('/')) {
      baseTopic += '/';
      setConfig(prev => ({ ...prev, BASE_TOPIC_MQTT: baseTopic }));
    }

    setIsSaving(true);
    const success = publishCommand({
      command: "update_node_info",
      node_name: config.NODE_NAME.trim(),
      base_topic: baseTopic,
    });

    if (!success) {
      toast.error("Failed to send update_node_info command");
      setIsSaving(false);
    }
  };

  // Function untuk reload config
  const handleReloadConfig = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    setIsSaving(true);
    const success = publishCommand({
      command: "reload_config",
    });

    if (!success) {
      toast.error("Failed to send reload_config command");
      setIsSaving(false);
    }
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Settings2 className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Node Info Configuration</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            MQTT Service
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Page Description */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Node Information Management</h2>
          <p className="text-muted-foreground">
            Configure Node Information Service settings and MQTT publishing topics.
          </p>
        </div>
      {/* Current Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Current Configuration
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetConfig}
              disabled={mqttStatus !== "connected" || isLoading}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Get Current
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* NODE_NAME */}
            <div className="space-y-2">
              <Label htmlFor="nodeName">Node Name</Label>
              <Input
                id="nodeName"
                placeholder="e.g. NODE_JAKARTA_1"
                value={config.NODE_NAME}
                onChange={(e) =>
                  setConfig(prev => ({ ...prev, NODE_NAME: e.target.value }))
                }
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUpdateNodeName}
                  disabled={mqttStatus !== "connected" || isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Update Node Name
                </Button>
              </div>
            </div>

            {/* BASE_TOPIC_MQTT */}
            <div className="space-y-2">
              <Label htmlFor="baseTopic">Base MQTT Topic</Label>
              <Input
                id="baseTopic"
                placeholder="e.g., NODE_GATEWAY/"
                value={config.BASE_TOPIC_MQTT}
                onChange={(e) =>
                  setConfig(prev => ({ ...prev, BASE_TOPIC_MQTT: e.target.value }))
                }
              />
              <div className="text-xs text-muted-foreground">
                Must end with "/" character
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUpdateBaseTopic}
                  disabled={mqttStatus !== "connected" || isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Update Base Topic
                </Button>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Update All Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Update All Configuration</h3>
            <div className="flex gap-4">
              <Button
                onClick={handleUpdateAll}
                disabled={mqttStatus !== "connected" || isSaving || !config.NODE_NAME.trim() || !config.BASE_TOPIC_MQTT.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                Update All Settings
              </Button>
              <Button
                variant="outline"
                onClick={handleReloadConfig}
                disabled={mqttStatus !== "connected" || isSaving}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Config
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">MQTT Topics</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <code className="bg-muted px-2 py-1 rounded">node_info/command</code>
                  <span className="text-muted-foreground ml-2">→ Send commands</span>
                </li>
                <li>
                  <code className="bg-muted px-2 py-1 rounded">node_info/response</code>
                  <span className="text-muted-foreground ml-2">← Receive responses</span>
                </li>
                <li>
                  <code className="bg-muted px-2 py-1 rounded">{config.BASE_TOPIC_MQTT || 'BASE_TOPIC/'}{config.NODE_NAME || 'NODE_NAME'}</code>
                  <span className="text-muted-foreground ml-2">← Node info publishing topic</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Available Commands</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <code className="bg-muted px-1 rounded">get_config</code>
                  <span className="text-muted-foreground ml-2">- Get current configuration</span>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">update_node_name</code>
                  <span className="text-muted-foreground ml-2">- Update node name</span>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">update_base_topic</code>
                  <span className="text-muted-foreground ml-2">- Update base MQTT topic</span>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">update_node_info</code>
                  <span className="text-muted-foreground ml-2">- Update both settings</span>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">reload_config</code>
                  <span className="text-muted-foreground ml-2">- Reload config from file</span>
                </li>
              </ul>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Service File</h4>
            <code className="text-sm">
              middleware/CONFIG_SYSTEM_DEVICE/Node_Info.py
            </code>
            <p className="text-sm text-muted-foreground mt-1">
              Python service that publishes node network information every 10 seconds
              and handles MQTT-based configuration commands.
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </SidebarInset>
  );
}
