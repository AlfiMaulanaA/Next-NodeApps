"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Info,
  Server,
  Wifi,
  Router,
  Globe,
  RefreshCw,
  Loader2,
  CheckCircle,
  Settings,
  Zap,
  Network,
  Database,
  Clock,
  Cpu,
  HardDrive,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface DeviceInfo {
  uptime_s: number;
  build: string;
  ip: string;
  mac: string;
  flags: string;
  mqtthost: string;
  chipset: string;
  manufacture: string;
  webapp: string;
  shortName: string;
  startcmd: string;
  supportsSSDP: boolean;
  supportsClientDeviceDB: boolean;
}

interface MQTTConfig {
  broker_address: string;
  broker_port: string;
  username: string;
  password: string;
}

export default function ApiInfo() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [ipAddresses, setIpAddresses] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mqttDialogOpen, setMqttDialogOpen] = useState(false);
  const [mqttConfig, setMqttConfig] = useState<MQTTConfig>({
    broker_address: "",
    broker_port: "",
    username: "",
    password: "",
  });
  const [isUpdatingMQTT, setIsUpdatingMQTT] = useState(false);

  // Format uptime
  const formatUptime = useCallback((seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days} days, ${hours} hours`;
    if (hours > 0) return `${hours} hours, ${mins} minutes`;
    return `${mins} minutes`;
  }, []);

  // Fetch device information
  const fetchDeviceInfo = async () => {
    try {
      const response = await fetch("/api/info");
      if (response.ok) {
        const data = await response.json();
        setDeviceInfo(data);
        setLastUpdated(new Date());
      } else {
        toast.error("Failed to fetch device information");
      }
    } catch (error) {
      console.error("Error fetching device info:", error);
      toast.error("Error fetching device information");
    }
  };

  // Fetch IP addresses
  const fetchIPAddresses = async () => {
    try {
      const response = await fetch("/api/ips");
      if (response.ok) {
        const data = await response.json();
        setIpAddresses(data);
      }
    } catch (error) {
      console.error("Error fetching IP addresses:", error);
    }
  };

  // Load initial data
  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([fetchDeviceInfo(), fetchIPAddresses()]);
    setIsLoading(false);
  };

  // Update MQTT configuration
  const updateMQTTConfig = async () => {
    if (!mqttConfig.broker_address || !mqttConfig.broker_port) {
      toast.error("Broker address and port are required");
      return;
    }

    setIsUpdatingMQTT(true);
    try {
      const response = await fetch("/api/update_mqtt_config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mqttConfig),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          result.message || "MQTT configuration updated successfully"
        );
        setMqttDialogOpen(false);
        // Refresh device info to show updated MQTT host
        await fetchDeviceInfo();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to update MQTT configuration");
      }
    } catch (error) {
      console.error("Error updating MQTT config:", error);
      toast.error("Error updating MQTT configuration");
    } finally {
      setIsUpdatingMQTT(false);
    }
  };

  // Initialize MQTT config from device info
  useEffect(() => {
    if (deviceInfo?.mqtthost) {
      const [address, port] = deviceInfo.mqtthost.split(":");
      setMqttConfig((prev) => ({
        ...prev,
        broker_address: address || "",
        broker_port: port || "",
      }));
    }
  }, [deviceInfo]);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        loadData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mr-3" />
        <span className="text-lg">Loading device information...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Device Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Device Information
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            System information and specifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {deviceInfo && (
            <>
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Device Name
                  </Label>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{deviceInfo.shortName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Manufacturer
                  </Label>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span>{deviceInfo.manufacture}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Chipset
                  </Label>
                  <Badge variant="outline">{deviceInfo.chipset}</Badge>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Uptime
                  </Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span>{formatUptime(deviceInfo.uptime_s)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Network Information */}
              <div>
                <h4 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Network Configuration
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        IP Address
                      </Label>
                      <p className="font-mono text-lg">{deviceInfo.ip}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        MAC Address
                      </Label>
                      <p className="font-mono">{deviceInfo.mac}</p>
                    </div>

                    {deviceInfo.mqtthost && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          MQTT Broker
                        </Label>
                        <div className="flex items-center gap-2">
                          <Router className="h-4 w-4 text-blue-500" />
                          <span className="font-mono">
                            {deviceInfo.mqtthost}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {deviceInfo.webapp && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Web Interface
                        </Label>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-green-500" />
                          <a
                            href={deviceInfo.webapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {deviceInfo.webapp}
                          </a>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Build Info
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {deviceInfo.build}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            deviceInfo.supportsSSDP ? "default" : "secondary"
                          }
                        >
                          SSDP{" "}
                          {deviceInfo.supportsSSDP
                            ? "Supported"
                            : "Not Supported"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            deviceInfo.supportsClientDeviceDB
                              ? "default"
                              : "secondary"
                          }
                        >
                          Device DB{" "}
                          {deviceInfo.supportsClientDeviceDB
                            ? "Supported"
                            : "Not Supported"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* IP Addresses */}
              {ipAddresses && (
                <div>
                  <h4 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    Network Interfaces
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Wifi className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">WiFi (wlan0)</span>
                        </div>
                        <p className="font-mono text-sm">
                          {ipAddresses.wlan_ip || "Not connected"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Network className="h-4 w-4 text-green-500" />
                          <span className="font-medium">Ethernet (eth0)</span>
                        </div>
                        <p className="font-mono text-sm">
                          {ipAddresses.eth_ip || "Not connected"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-gray-500">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">Local Loopback</span>
                        </div>
                        <p className="font-mono text-sm">
                          {ipAddresses.local_ip}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* MQTT Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Router className="h-5 w-5" />
            MQTT Configuration
          </CardTitle>
          <CardDescription>
            Configure MQTT broker settings for device communication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Current MQTT Broker</p>
              <p className="text-sm text-muted-foreground">
                {deviceInfo?.mqtthost || "Not configured"}
              </p>
            </div>

            <Dialog open={mqttDialogOpen} onOpenChange={setMqttDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure MQTT
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>MQTT Broker Configuration</DialogTitle>
                  <DialogDescription>
                    Update MQTT broker settings. Changes will take effect
                    immediately.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="broker_address">Broker Address</Label>
                      <Input
                        id="broker_address"
                        placeholder="192.168.1.100"
                        value={mqttConfig.broker_address}
                        onChange={(e) =>
                          setMqttConfig((prev) => ({
                            ...prev,
                            broker_address: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="broker_port">Port</Label>
                      <Input
                        id="broker_port"
                        placeholder="1883"
                        value={mqttConfig.broker_port}
                        onChange={(e) =>
                          setMqttConfig((prev) => ({
                            ...prev,
                            broker_port: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username (Optional)</Label>
                      <Input
                        id="username"
                        placeholder="username"
                        value={mqttConfig.username}
                        onChange={(e) =>
                          setMqttConfig((prev) => ({
                            ...prev,
                            username: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password (Optional)</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="password"
                        value={mqttConfig.password}
                        onChange={(e) =>
                          setMqttConfig((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <Button
                    onClick={updateMQTTConfig}
                    disabled={isUpdatingMQTT}
                    className="w-full"
                  >
                    {isUpdatingMQTT ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Update Configuration
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  );
}
