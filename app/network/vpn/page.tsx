// app/vpn/dashboard/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  RefreshCw,
  Shield,
  Lock,
  Zap,
  Play,
  Square,
  ArrowDown,
  ArrowUp,
  Network,
  Activity,
  Loader2,
  TrendingUp,
  Server,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";
import MqttStatus from "@/components/mqtt-status";
import { toast } from "sonner";

interface VPNConnection {
  id: string;
  name: string;
  type: "openvpn" | "ikev2" | "wireguard";
  status: "connected" | "disconnected" | "connecting";
  vpn_ip?: string;
  interface?: string;
  peer_ip?: string;
  remote_host?: string;
  bytes_sent?: number;
  bytes_received?: number;
}

export default function VPNDashboardPage() {
  const [vpnConnections, setVpnConnections] = useState<VPNConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const clientRef = useRef<MqttClient | null>(null);

  const requestAllVPNStatus = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      client.publish(
        "vpn/openvpn/request",
        JSON.stringify({ action: "getConfig" })
      );
      client.publish(
        "vpn/ikev2/request",
        JSON.stringify({ action: "getConfig" })
      );
      client.publish(
        "vpn/wireguard/request",
        JSON.stringify({ action: "getConfig" })
      );
      toast.info("Refreshing VPN status...");
    }
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      "vpn/openvpn/config",
      "vpn/openvpn/status",
      "vpn/ikev2/config",
      "vpn/ikev2/status",
      "vpn/wireguard/config",
      "vpn/wireguard/status",
    ];

    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`Subscribed to ${topic}`);
        }
      });
    });

    const handleMessage = (topic: string, buf: Buffer) => {
      try {
        const data = JSON.parse(buf.toString());

        setVpnConnections((prev) => {
          const existing = [...prev];

          let vpnType: "openvpn" | "ikev2" | "wireguard" = "openvpn";
          if (topic.includes("ikev2")) vpnType = "ikev2";
          else if (topic.includes("wireguard")) vpnType = "wireguard";
          else if (topic.includes("openvpn")) vpnType = "openvpn";

          const index = existing.findIndex((v) => v.type === vpnType);

          if (topic.includes("/config")) {
            const vpnData: VPNConnection = {
              id: vpnType,
              name: data.config_name || `${vpnType.toUpperCase()} VPN`,
              type: vpnType,
              status: data.status || "disconnected",
              vpn_ip: data.vpn_ip || "",
              remote_host:
                data.remote_host || data.server_address || data.endpoint || "",
              bytes_sent: 0,
              bytes_received: 0,
            };

            if (index >= 0) {
              existing[index] = { ...existing[index], ...vpnData };
            } else {
              existing.push(vpnData);
            }
          } else if (topic.includes("/status")) {
            const statusData = {
              status: data.status || "disconnected",
              vpn_ip: data.vpn_ip || "",
              interface: data.interface || "",
              peer_ip: data.peer_ip || "",
              bytes_sent: data.bytes_sent || 0,
              bytes_received: data.bytes_received || 0,
            };

            if (index >= 0) {
              existing[index] = { ...existing[index], ...statusData };
            } else {
              existing.push({
                id: vpnType,
                name: `${vpnType.toUpperCase()} VPN`,
                type: vpnType,
                ...statusData,
              });
            }
          }

          return existing;
        });

        setIsLoading(false);
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    };

    const handleConnect = () => {
      toast.success("Connected to MQTT broker");
      setTimeout(() => {
        requestAllVPNStatus();
      }, 1000);
    };

    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (clientRef.current) {
        topicsToSubscribe.forEach((topic) => {
          clientRef.current?.unsubscribe(topic);
        });
        clientRef.current.off("message", handleMessage);
        clientRef.current.off("connect", handleConnect);
      }
    };
  }, [requestAllVPNStatus]);

  const handleToggleConnection = (vpnId: string, currentStatus: string) => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT not connected");
      return;
    }

    const action = currentStatus === "connected" ? "disconnect" : "connect";
    client.publish(`vpn/${vpnId}/command`, JSON.stringify({ action }));
    toast.success(`VPN ${action} command sent`);
  };

  const totalConnections = vpnConnections.length;
  const activeConnections = vpnConnections.filter(
    (v) => v.status === "connected"
  ).length;
  const totalBytesSent = vpnConnections.reduce(
    (sum, v) => sum + (v.bytes_sent || 0),
    0
  );
  const totalBytesReceived = vpnConnections.reduce(
    (sum, v) => sum + (v.bytes_received || 0),
    0
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getVPNIcon = (type: string) => {
    switch (type) {
      case "openvpn":
        return Shield;
      case "ikev2":
        return Lock;
      case "wireguard":
        return Zap;
      default:
        return Network;
    }
  };

  const getVPNColor = (type: string) => {
    switch (type) {
      case "openvpn":
        return "from-blue-500/20 to-blue-500/5";
      case "ikev2":
        return "from-purple-500/20 to-purple-500/5";
      case "wireguard":
        return "from-green-500/20 to-green-500/5";
      default:
        return "from-gray-500/20 to-gray-500/5";
    }
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">VPN Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Real-time monitoring
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MqttStatus />
          <Button
            variant="outline"
            size="sm"
            onClick={requestAllVPNStatus}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Connections
                  </p>
                  <p className="text-3xl font-bold">
                    {activeConnections}
                    <span className="text-lg text-muted-foreground font-normal">
                      /{totalConnections}
                    </span>
                  </p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Downloaded
                  </p>
                  <p className="text-3xl font-bold">
                    {formatBytes(totalBytesReceived)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-500/10">
                  <ArrowDown className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Uploaded
                  </p>
                  <p className="text-3xl font-bold">
                    {formatBytes(totalBytesSent)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <ArrowUp className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Traffic
                  </p>
                  <p className="text-3xl font-bold">
                    {formatBytes(totalBytesSent + totalBytesReceived)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-orange-500/10">
                  <TrendingUp className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* VPN Connections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">VPN Connections</h2>
              <p className="text-sm text-muted-foreground">
                Manage and monitor your VPN tunnels
              </p>
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-base font-medium">Loading VPN status...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please wait
                </p>
              </CardContent>
            </Card>
          ) : vpnConnections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Network className="w-12 h-12 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium">No VPN Configured</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Get started by configuring your first VPN connection
                </p>
                <Button onClick={() => (window.location.href = "/vpn/config")}>
                  Configure VPN
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {vpnConnections.map((vpn) => {
                const Icon = getVPNIcon(vpn.type);
                const isConnected = vpn.status === "connected";
                const isConnecting = vpn.status === "connecting";

                return (
                  <Card
                    key={vpn.id}
                    className="group hover:shadow-lg transition-all duration-300"
                  >
                    <div
                      className={`h-2 rounded-t-lg bg-gradient-to-r ${getVPNColor(
                        vpn.type
                      )}`}
                    />

                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-3 rounded-xl bg-gradient-to-br ${getVPNColor(
                              vpn.type
                            )} border`}
                          >
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {vpn.name}
                            </CardTitle>
                            <CardDescription className="capitalize">
                              {vpn.type} Protocol
                            </CardDescription>
                          </div>
                        </div>
                        <Badge
                          variant={isConnected ? "default" : "secondary"}
                          className={`${
                            isConnected ? "bg-green-500 hover:bg-green-600" : ""
                          }`}
                        >
                          {isConnected
                            ? "Connected"
                            : isConnecting
                            ? "Connecting"
                            : "Disconnected"}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {isConnected ? (
                        <div className="space-y-3">
                          {/* Connection Info */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Network className="w-3 h-3" />
                                <span>VPN IP</span>
                              </div>
                              <p className="text-sm font-mono font-medium">
                                {vpn.vpn_ip || "N/A"}
                              </p>
                            </div>

                            {vpn.interface && (
                              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Server className="w-3 h-3" />
                                  <span>Interface</span>
                                </div>
                                <p className="text-sm font-mono font-medium">
                                  {vpn.interface}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Traffic Stats */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                              <div className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                                <ArrowDown className="w-3 h-3" />
                                Download
                              </div>
                              <p className="text-sm font-bold">
                                {formatBytes(vpn.bytes_received || 0)}
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                              <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                                <ArrowUp className="w-3 h-3" />
                                Upload
                              </div>
                              <p className="text-sm font-bold">
                                {formatBytes(vpn.bytes_sent || 0)}
                              </p>
                            </div>
                          </div>

                          {/* Server Info */}
                          {vpn.remote_host && (
                            <div className="p-3 rounded-lg border bg-card">
                              <div className="flex items-start gap-2">
                                <Server className="w-4 h-4 text-muted-foreground mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground mb-0.5">
                                    Server
                                  </p>
                                  <p className="text-sm font-mono truncate">
                                    {vpn.remote_host}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <div className="p-3 rounded-full bg-muted inline-flex mb-3">
                            <Network className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Not connected
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() =>
                            handleToggleConnection(vpn.id, vpn.status)
                          }
                          variant={isConnected ? "destructive" : "default"}
                          className="flex-1"
                          disabled={isConnecting}
                        >
                          {isConnecting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Connecting
                            </>
                          ) : isConnected ? (
                            <>
                              <Square className="w-4 h-4 mr-2" />
                              Disconnect
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Connect
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => (window.location.href = "/vpn/config")}
                        >
                          Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
