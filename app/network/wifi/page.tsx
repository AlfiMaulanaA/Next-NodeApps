"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import { toast } from "@/components/ui/use-toast";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Radar,
  Shield,
  Trash2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Network,
  Signal,
  Settings,
  Info
} from "lucide-react";
import type { MqttClient } from "mqtt";
import MqttStatus from "@/components/mqtt-status";

// MQTT Topics sesuai dengan Network.py
const WIFI_SCAN_TOPIC = "rpi/wifi/scan";
const WIFI_SCAN_RESPONSE_TOPIC = "rpi/wifi/scan_response";
const WIFI_CONNECT_TOPIC = "rpi/wifi/connect";
const WIFI_CONNECT_RESPONSE_TOPIC = "rpi/wifi/connect_response";
const WIFI_DISCONNECT_TOPIC = "rpi/wifi/disconnect";
const WIFI_DISCONNECT_RESPONSE_TOPIC = "rpi/wifi/disconnect_response";
const WIFI_DELETE_TOPIC = "rpi/wifi/delete";
const WIFI_DELETE_RESPONSE_TOPIC = "rpi/wifi/delete_response";
const WIFI_STATUS_GET_TOPIC = "rpi/wifi/status/get";
const WIFI_STATUS_RESPONSE_TOPIC = "rpi/wifi/status/response";

interface WifiNetwork {
  ssid: string;
  security: string;
  signal: string;
  frequency: string;
  is_current: boolean;
  is_saved: boolean;
}

interface WifiStatus {
  connected: boolean;
  current_network?: {
    ssid: string;
    ip_address?: string;
    signal_strength?: string;
  };
  saved_networks: Array<{ ssid: string; is_current: boolean }>;
  device_state: string;
  error?: string;
}

export default function WifiPage() {
  // State variables
  const [wifiStatus, setWifiStatus] = useState<WifiStatus | null>(null);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const clientRef = useRef<MqttClient | null>(null);

  // Request WiFi status from backend
  const requestWifiStatus = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      client.publish(WIFI_STATUS_GET_TOPIC, JSON.stringify({}), {}, (err) => {
        if (err) {
          toast({
            title: "Error",
            description: `Failed to request WiFi status: ${err.message}`,
            variant: "destructive",
          });
        }
      });
    } else {
      toast({
        title: "Warning",
        description: "MQTT not connected. Cannot request WiFi status.",
      });
    }
  }, []);

  // Scan for WiFi networks
  const scanWifiNetworks = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      setIsScanning(true);
      client.publish(WIFI_SCAN_TOPIC, JSON.stringify({}), {}, (err) => {
        if (err) {
          toast({
            title: "Error",
            description: `Failed to start WiFi scan: ${err.message}`,
            variant: "destructive",
          });
          setIsScanning(false);
        }
      });
    } else {
      toast({
        title: "Warning",
        description: "MQTT not connected. Cannot scan WiFi networks.",
      });
    }
  }, []);

  // Connect to WiFi network
  const connectToWifi = () => {
    if (!selectedNetwork || !password) {
      toast({
        title: "Error",
        description: "Please enter password for the selected network.",
        variant: "destructive",
      });
      return;
    }

    const client = getMQTTClient();
    if (client && client.connected) {
      setIsConnecting(true);
      client.publish(
        WIFI_CONNECT_TOPIC,
        JSON.stringify({
          ssid: selectedNetwork.ssid,
          password: selectedNetwork.security === "open" ? "" : password,
        }),
        {},
        (err) => {
          if (err) {
            toast({
              title: "Error",
              description: `Failed to connect to WiFi: ${err.message}`,
              variant: "destructive",
            });
            setIsConnecting(false);
          } else {
            toast({
              title: "Connecting",
              description: `Connecting to ${selectedNetwork.ssid}...`,
            });
          }
        }
      );
    }
  };

  // Disconnect from current WiFi
  const disconnectWifi = () => {
    const client = getMQTTClient();
    if (client && client.connected) {
      client.publish(WIFI_DISCONNECT_TOPIC, JSON.stringify({}), {}, (err) => {
        if (err) {
          toast({
            title: "Error",
            description: `Failed to disconnect WiFi: ${err.message}`,
            variant: "destructive",
          });
        }
      });
    }
  };

  // Delete saved WiFi network
  const deleteWifiNetwork = () => {
    if (!selectedNetwork) return;

    const client = getMQTTClient();
    if (client && client.connected) {
      setIsDeleting(true);
      client.publish(
        WIFI_DELETE_TOPIC,
        JSON.stringify({ ssid: selectedNetwork.ssid }),
        {},
        (err) => {
          if (err) {
            toast({
              title: "Error",
              description: `Failed to delete WiFi network: ${err.message}`,
              variant: "destructive",
            });
            setIsDeleting(false);
          }
        }
      );
    }
  };

  // Helper functions
  const getSignalStrength = (signal: string) => {
    const signalValue = parseInt(signal) || 0;
    if (signalValue >= 60) return { strength: "Excellent", color: "text-green-600", icon: "🟢" };
    if (signalValue >= 40) return { strength: "Good", color: "text-yellow-600", icon: "🟡" };
    if (signalValue >= 20) return { strength: "Fair", color: "text-orange-600", icon: "🟠" };
    return { strength: "Poor", color: "text-red-600", icon: "🔴" };
  };

  const getSecurityIcon = (security: string) => {
    if (security === "open") return <Wifi className="w-4 h-4 text-gray-500" />;
    return <Shield className="w-4 h-4 text-blue-500" />;
  };

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      requestWifiStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [requestWifiStatus]);

  // MQTT setup and message handling
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      // Subscribe to all WiFi topics
      const topics = [
        WIFI_SCAN_RESPONSE_TOPIC,
        WIFI_CONNECT_RESPONSE_TOPIC,
        WIFI_DISCONNECT_RESPONSE_TOPIC,
        WIFI_DELETE_RESPONSE_TOPIC,
        WIFI_STATUS_RESPONSE_TOPIC,
      ];

      topics.forEach((topic) => {
        mqttClientInstance.subscribe(topic, (err) => {
          if (err) {
            console.error(`Failed to subscribe to ${topic}:`, err);
          }
        });
      });

      // Initial status request
      requestWifiStatus();
    };

    const handleMessage = (topic: string, messageBuf: Buffer) => {
      try {
        const data = JSON.parse(messageBuf.toString());

        switch (topic) {
          case WIFI_STATUS_RESPONSE_TOPIC:
            if (data.status === "success") {
              setWifiStatus(data.wifi_status);
            }
            break;

          case WIFI_SCAN_RESPONSE_TOPIC:
            if (data.status === "success") {
              setWifiNetworks(data.networks || []);
              toast({
                title: "Success",
                description: `Found ${data.count || 0} WiFi networks`,
              });
            } else {
              toast({
                title: "Error",
                description: data.error || "Failed to scan WiFi networks",
                variant: "destructive",
              });
            }
            setIsScanning(false);
            break;

          case WIFI_CONNECT_RESPONSE_TOPIC:
            setIsConnecting(false);
            setConnectDialogOpen(false);
            setPassword("");

            if (data.status === "success") {
              toast({
                title: "Success",
                description: `${data.ip_address ? `Connected to ${data.ssid}. IP: ${data.ip_address}` : `Connected to ${data.ssid}`}`,
              });
              // Refresh status after connection
              setTimeout(() => requestWifiStatus(), 1000);
            } else {
              toast({
                title: "Connection Failed",
                description: data.error || `Failed to connect to ${data.ssid}`,
                variant: "destructive",
              });
            }
            break;

          case WIFI_DISCONNECT_RESPONSE_TOPIC:
            if (data.status === "success") {
              toast({
                title: "Success",
                description: "Disconnected from WiFi network",
              });
              setTimeout(() => requestWifiStatus(), 1000);
            } else {
              toast({
                title: "Error",
                description: data.error || "Failed to disconnect from WiFi",
                variant: "destructive",
              });
            }
            break;

          case WIFI_DELETE_RESPONSE_TOPIC:
            setIsDeleting(false);
            setDeleteDialogOpen(false);

            if (data.status === "success") {
              toast({
                title: "Success",
                description: `Deleted WiFi network: ${data.ssid}`,
              });
              setTimeout(() => requestWifiStatus(), 1000);
            } else {
              toast({
                title: "Error",
                description: data.error || "Failed to delete WiFi network",
                variant: "destructive",
              });
            }
            break;

          default:
            console.warn(`Unhandled topic: ${topic}`);
        }
      } catch (err) {
        console.error("MQTT message parsing error:", err);
        toast({
          title: "Error",
          description: "Invalid response format received",
          variant: "destructive",
        });
      }
    };

    // Event listeners
    if (mqttClientInstance.connected) {
      handleConnect();
    } else {
      mqttClientInstance.on("connect", handleConnect);
    }

    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (mqttClientInstance.connected) {
        const topics = [
          WIFI_SCAN_RESPONSE_TOPIC,
          WIFI_CONNECT_RESPONSE_TOPIC,
          WIFI_DISCONNECT_RESPONSE_TOPIC,
          WIFI_DELETE_RESPONSE_TOPIC,
          WIFI_STATUS_RESPONSE_TOPIC,
        ];
        topics.forEach((topic) => mqttClientInstance.unsubscribe(topic));
      }
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("message", handleMessage);
    };
  }, [requestWifiStatus]);

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Wifi className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">WiFi Networks</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            onClick={requestWifiStatus}
            title="Refresh WiFi Status"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Wifi className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">WiFi Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div
                      className={`w-2 h-2 rounded-full ${wifiStatus?.connected ? "bg-green-500" : "bg-gray-400"}`}
                    />
                    <span className="text-sm capitalize">
                      {wifiStatus?.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Signal className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Current Network</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {wifiStatus?.current_network?.ssid || "None"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Network className="w-5 h-5 text-purple-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">IP Address</p>
                  <p className="text-sm text-muted-foreground mt-1 font-mono">
                    {wifiStatus?.current_network?.ip_address || "Not assigned"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Control Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Network Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                onClick={scanWifiNetworks}
                disabled={isScanning}
                variant="default"
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Radar className="w-4 h-4 mr-2" />
                )}
                {isScanning ? "Scanning..." : "Scan Networks"}
              </Button>

              {wifiStatus?.connected && (
                <Button
                  onClick={disconnectWifi}
                  variant="outline"
                  className="text-orange-600 border-orange-600 hover:bg-orange-50"
                >
                  <WifiOff className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Networks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Wifi className="w-5 h-5 mr-2" />
                Available Networks
              </div>
              <Badge variant="secondary">
                {wifiNetworks.length} found
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wifiNetworks.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Wifi className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p>No WiFi networks found. Click "Scan Networks" to search.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {wifiNetworks.map((network) => {
                  const signalInfo = getSignalStrength(network.signal);
                  return (
                    <div
                      key={network.ssid}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {network.is_current ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          getSecurityIcon(network.security)
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{network.ssid}</span>
                            {network.is_current && (
                              <Badge variant="outline" className="text-green-600">
                                Connected
                              </Badge>
                            )}
                            {network.is_saved && !network.is_current && (
                              <Badge variant="secondary">Saved</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{network.security}</span>
                            <span className={`flex items-center gap-1 ${signalInfo.color}`}>
                              {signalInfo.icon} {signalInfo.strength}
                            </span>
                            <span>{network.frequency}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {!network.is_current && (
                          <Dialog
                            open={connectDialogOpen && selectedNetwork?.ssid === network.ssid}
                            onOpenChange={(open) => {
                              setConnectDialogOpen(open);
                              if (open) setSelectedNetwork(network);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Wifi className="w-3 h-3 mr-1" />
                                Connect
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Connect to {network.ssid}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {network.security !== "open" && (
                                  <div>
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative mt-1">
                                      <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter network password"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                      >
                                        {showPassword ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                <Alert>
                                  <Info className="h-4 w-4" />
                                  <AlertDescription>
                                    Connecting to {network.ssid}.
                                    {network.security !== "open" && password && (
                                      <> Password will be stored securely.</>
                                    )}
                                  </AlertDescription>
                                </Alert>

                                <div className="flex gap-3">
                                  <Button
                                    onClick={connectToWifi}
                                    disabled={isConnecting}
                                    className="flex-1"
                                  >
                                    {isConnecting ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Wifi className="w-4 h-4 mr-2" />
                                    )}
                                    {isConnecting ? "Connecting..." : "Connect"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setConnectDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {network.is_saved && (
                          <Dialog
                            open={deleteDialogOpen && selectedNetwork?.ssid === network.ssid}
                            onOpenChange={(open) => {
                              setDeleteDialogOpen(open);
                              if (open) setSelectedNetwork(network);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Saved Network</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <Alert variant="destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    Are you sure you want to delete the saved network "{network.ssid}"?
                                    You will need to enter the password again to reconnect.
                                  </AlertDescription>
                                </Alert>

                                <div className="flex gap-3">
                                  <Button
                                    variant="destructive"
                                    onClick={deleteWifiNetwork}
                                    disabled={isDeleting}
                                    className="flex-1"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4 mr-2" />
                                    )}
                                    {isDeleting ? "Deleting..." : "Delete Network"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setDeleteDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Networks */}
        {wifiStatus?.saved_networks && wifiStatus.saved_networks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Saved Networks
                </div>
                <Badge variant="outline">
                  {wifiStatus.saved_networks.length} saved
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {wifiStatus.saved_networks.map((saved) => (
                  <div
                    key={saved.ssid}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      saved.is_current ? "bg-green-50 dark:bg-green-950 border-green-200" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {saved.is_current ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Shield className="w-5 h-5 text-blue-500" />
                      )}
                      <span className={`font-medium ${saved.is_current ? "text-green-700 dark:text-green-300" : ""}`}>
                        {saved.ssid}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
}
