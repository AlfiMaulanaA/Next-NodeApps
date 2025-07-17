"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Network, RotateCw, Loader2 } from "lucide-react"; // Removed Wifi, WifiOff as MqttStatus handles it
import type { MqttClient } from "mqtt";
import MqttStatus from "@/components/mqtt-status";

interface NetworkConfig {
  address: string;
  netmask: string;
  gateway: string;
}

export default function NetworkPage() {
  const [config, setConfig] = useState<NetworkConfig | null>(null);
  const [editConfig, setEditConfig] = useState<NetworkConfig>({ address: "", netmask: "", gateway: "" });
  const [open, setOpen] = useState(false);
  const clientRef = useRef<MqttClient | null>(null); // Initialize with null

  const isValidIP = (ip: string) =>
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip);

  const isValidNetmask = (mask: string) =>
    /^(255|254|252|248|240|224|192|128|0)\.0\.0\.0$|^255\.(255|254|252|248|240|224|192|128|0)\.0\.0$|^255\.255\.(255|254|252|248|240|224|192|128|0)\.0$|^255\.255\.255\.(255|254|252|248|240|224|192|128|0)$/.test(mask);

  const handleInput = (field: keyof NetworkConfig, value: string) => {
    setEditConfig(prev => ({ ...prev, [field]: value }));
  };

  // Function to request network config from the device
  const requestNetworkConfig = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      // Small delay to ensure subscription is active on the broker
      setTimeout(() => {
        client.publish("command_device_ip", JSON.stringify({ command: "readIP", interface: "eth0" }));
        toast.info("Requesting network configuration...");
      }, 300);
    } else {
      toast.warning("MQTT not connected. Cannot request network configuration.");
    }
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    // Subscribe to the response topic immediately
    mqttClientInstance.subscribe("response_device_ip", (err) => {
      if (err) console.error(`Failed to subscribe to response_device_ip:`, err);
    });

    // If client is already connected on mount, request config immediately
    if (mqttClientInstance.connected) {
      requestNetworkConfig();
    }

    // Listener for successful MQTT connection
    const handleConnect = () => {
      requestNetworkConfig(); // Request config every time connection is established (including re-connects)
    };

    // Listener for incoming MQTT messages
    const handleMessage = (topic: string, messageBuf: Buffer) => {
      try {
        const data = JSON.parse(messageBuf.toString());

        if (topic === "response_device_ip") {
          if (data.eth0) {
            setConfig(data.eth0);
            setEditConfig(data.eth0);
            toast.success("Network configuration loaded! 🚀");
          }

          if (data.status === "success") {
            toast.success(data.message || "Success");
          } else if (data.status === "error") {
            toast.error(data.message || "Error occurred");
          }
        }
      } catch (err) {
        toast.error("Invalid response from MQTT. Check backend payload.");
        console.error("Error parsing MQTT message:", err);
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);

    // Cleanup function
    return () => {
      if (clientRef.current) {
        clientRef.current.unsubscribe("response_device_ip");
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("message", handleMessage);
      }
    };
  }, [requestNetworkConfig]); // Dependency array includes requestNetworkConfig

  const restartNetwork = () => {
    toast.loading("Restarting networking...");
    clientRef.current?.publish("command_device_ip", JSON.stringify({ command: "restartNetworking" }), (err) => {
      if (err) {
        toast.error(`Failed to send restart command: ${err.message} 😵‍💫`);
      }
    });
  };

  const updateConfig = () => {
    if (
      !isValidIP(editConfig.address) ||
      !isValidIP(editConfig.gateway) ||
      !isValidNetmask(editConfig.netmask)
    ) {
      toast.error("Invalid input format for IP, Netmask, or Gateway.");
      return;
    }

    clientRef.current?.publish("command_device_ip/update", JSON.stringify(editConfig), (err) => {
      if (err) {
        toast.error(`Failed to update config: ${err.message} 😭`);
      } else {
        setOpen(false);
        toast.success("Configuration sent, restarting network... ✨");
        restartNetwork(); // Call restart after successfully sending config
      }
    });
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Network Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button variant="outline" size="icon" onClick={requestNetworkConfig}>
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>IP Configuration (eth0)</CardTitle>
          </CardHeader>
          <CardContent>
            {config ? (
              <>
                <table className="text-sm w-full">
                  <tbody>
                    <tr>
                      <td className="font-medium pr-4 py-1">IP Address</td>
                      <td className="py-1">{config.address}</td>
                    </tr>
                    <tr>
                      <td className="font-medium pr-4 py-1">Netmask</td>
                      <td className="py-1">{config.netmask}</td>
                    </tr>
                    <tr>
                      <td className="font-medium pr-4 py-1">Gateway</td>
                      <td className="py-1">{config.gateway}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex gap-2 mt-4">
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="default">Edit IP</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit IP Configuration</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input
                          placeholder="IP Address"
                          value={editConfig.address}
                          onChange={e => handleInput("address", e.target.value)}
                        />
                        <Input
                          placeholder="Netmask"
                          value={editConfig.netmask}
                          onChange={e => handleInput("netmask", e.target.value)}
                        />
                        <Input
                          placeholder="Gateway"
                          value={editConfig.gateway}
                          onChange={e => handleInput("gateway", e.target.value)}
                        />
                        <Button onClick={updateConfig}>Save Changes</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="secondary" onClick={restartNetwork}>
                    Restart Networking
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching network data...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}