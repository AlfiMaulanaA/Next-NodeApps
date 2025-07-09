"use client";

import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Network, Wifi, WifiOff, Loader2, RefreshCw } from "lucide-react";

interface NetworkConfig {
  address: string;
  netmask: string;
  gateway: string;
}

export default function NetworkPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [config, setConfig] = useState<NetworkConfig | null>(null);
  const [editConfig, setEditConfig] = useState<NetworkConfig>({ address: "", netmask: "", gateway: "" });
  const [open, setOpen] = useState(false);
  const clientRef = useRef<mqtt.MqttClient>();

  const isValidIP = (ip: string) =>
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip);

  const isValidNetmask = (mask: string) =>
    /^(255|254|252|248|240|224|192|128|0)\.0\.0\.0$|^255\.(255|254|252|248|240|224|192|128|0)\.0\.0$|^255\.255\.(255|254|252|248|240|224|192|128|0)\.0$|^255\.255\.255\.(255|254|252|248|240|224|192|128|0)$/.test(mask);

  const handleInput = (field: keyof NetworkConfig, value: string) => {
    setEditConfig(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const client = mqtt.connect(`${process.env.NEXT_PUBLIC_MQTT_BROKER_URL}`);

    client.on("connect", () => {
      setStatus("connected");
      client.subscribe("response_device_ip");
      client.publish("command_device_ip", JSON.stringify({ command: "readIP", interface: "eth0" }));
    });

    client.on("error", () => setStatus("error"));
    client.on("close", () => setStatus("disconnected"));

    client.on("message", (_, buf) => {
      try {
        const data = JSON.parse(buf.toString());

        if (data.eth0) {
          setConfig(data.eth0);
          setEditConfig(data.eth0);
        }

        if (data.status === "success") {
          toast.success(data.message || "Success");
        } else if (data.status === "error") {
          toast.error(data.message || "Error occurred");
        }
      } catch (err) {
        toast.error("Invalid response");
      }
    });

    clientRef.current = client;
    return () => {
      client.end(); // Proper cleanup, returns void
    };
  }, []);

  const restartNetwork = () => {
    toast.loading("Restarting networking...");
    clientRef.current?.publish("command_device_ip", JSON.stringify({ command: "restartNetworking" }));
  };

  const updateConfig = () => {
    if (
      !isValidIP(editConfig.address) ||
      !isValidIP(editConfig.gateway) ||
      !isValidNetmask(editConfig.netmask)
    ) {
      toast.error("Invalid input format");
      return;
    }

    clientRef.current?.publish("command_device_ip/update", JSON.stringify(editConfig));
    setOpen(false);
    toast.success("Configuration sent, restarting...");
    restartNetwork();
  };

  const renderStatusIcon = () => {
    if (status === "connected") return <Wifi className="w-4 h-4 text-green-500" />;
    if (status === "error") return <WifiOff className="w-4 h-4 text-red-500" />;
    return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
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
          {renderStatusIcon()}
          <span className="capitalize text-sm">{status}</span>
          <Button variant="outline" size="icon" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
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
                      <td className="font-medium">IP Address</td>
                      <td>{config.address}</td>
                    </tr>
                    <tr>
                      <td className="font-medium">Netmask</td>
                      <td>{config.netmask}</td>
                    </tr>
                    <tr>
                      <td className="font-medium">Gateway</td>
                      <td>{config.gateway}</td>
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
              <p className="text-sm text-muted-foreground">No configuration loaded.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}
