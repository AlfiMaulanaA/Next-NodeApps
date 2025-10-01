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
import {
  Search,
  Network,
  Server,
  Wifi,
  Router,
  Globe,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface DeviceInfo {
  uptime_s: number;
  build: string;
  ip: string;
  mac: string;
  flags: string;
  mqtthost: string;
  mqtttopic?: string;
  chipset: string;
  manufacture: string;
  webapp: string;
  shortName: string;
  startcmd: string;
  supportsSSDP: boolean;
  supportsClientDeviceDB: boolean;
}

export default function ApiScan() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanRange, setScanRange] = useState("192.168.0");
  const [startIP, setStartIP] = useState("1");
  const [endIP, setEndIP] = useState("254");
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  // Validate IP range inputs
  const isValidIPRange = useCallback(() => {
    const start = parseInt(startIP);
    const end = parseInt(endIP);
    return start >= 1 && start <= 254 && end >= 1 && end <= 254 && start <= end;
  }, [startIP, endIP]);

  // Format uptime
  const formatUptime = useCallback((seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }, []);

  // Scan network for devices
  const scanNetwork = async () => {
    if (!isValidIPRange()) {
      toast.error(
        "Invalid IP range. Start and end must be between 1-254, and start <= end"
      );
      return;
    }

    setIsScanning(true);
    try {
      const response = await fetch(
        `/api/scan?range=${scanRange}&start=${startIP}&end=${endIP}`
      );

      if (response.ok) {
        const data = await response.json();
        setDevices(data);
        setLastScanTime(new Date());
        toast.success(`Found ${data.length} device(s)`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Scan failed");
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast.error("Network scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  // Get device status icon
  const getDeviceStatusIcon = (device: DeviceInfo) => {
    // Simple status check - if we can reach it, it's online
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  // Get device type icon
  const getDeviceTypeIcon = (device: DeviceInfo) => {
    if (device.chipset?.toLowerCase().includes("bk")) {
      return <Zap className="h-4 w-4 text-blue-500" />;
    }
    return <Server className="h-4 w-4 text-gray-500" />;
  };

  // Auto-scan on component mount
  useEffect(() => {
    scanNetwork();
  }, []);

  return (
    <div className="space-y-6">
      {/* Scan Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Network Scanner
          </CardTitle>
          <CardDescription>
            Scan your network to discover connected IoT devices and systems
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scanRange">IP Range Base</Label>
              <Input
                id="scanRange"
                placeholder="192.168.0"
                value={scanRange}
                onChange={(e) => setScanRange(e.target.value)}
                disabled={isScanning}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startIP">Start IP</Label>
              <Input
                id="startIP"
                type="number"
                min="1"
                max="254"
                value={startIP}
                onChange={(e) => setStartIP(e.target.value)}
                disabled={isScanning}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endIP">End IP</Label>
              <Input
                id="endIP"
                type="number"
                min="1"
                max="254"
                value={endIP}
                onChange={(e) => setEndIP(e.target.value)}
                disabled={isScanning}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={scanNetwork}
                disabled={isScanning || !isValidIPRange()}
                className="w-full"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Scan Network
                  </>
                )}
              </Button>
            </div>
          </div>

          {lastScanTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              Last scan: {lastScanTime.toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Discovered Devices
            </div>
            <Badge variant="secondary">
              {devices.length} device{devices.length !== 1 ? "s" : ""} found
            </Badge>
          </CardTitle>
          <CardDescription>
            Devices discovered on the network scan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-12">
              <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No devices found
              </h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your IP range and scan again
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device, index) => (
                <Card key={index} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getDeviceStatusIcon(device)}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getDeviceTypeIcon(device)}
                            <h4 className="font-medium">
                              {device.shortName || "Unknown Device"}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {device.chipset}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                IP Address
                              </Label>
                              <p className="font-mono">{device.ip}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                MAC Address
                              </Label>
                              <p className="font-mono text-xs">{device.mac}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Uptime
                              </Label>
                              <p>{formatUptime(device.uptime_s)}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Manufacturer
                              </Label>
                              <p>{device.manufacture}</p>
                            </div>
                          </div>

                          {device.mqtthost && (
                            <div className="flex items-center gap-2 text-sm">
                              <Router className="h-3 w-3 text-blue-500" />
                              <span className="text-muted-foreground">
                                MQTT:
                              </span>
                              <span className="font-mono">
                                {device.mqtthost}
                              </span>
                            </div>
                          )}

                          {device.webapp && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-3 w-3 text-green-500" />
                              <a
                                href={device.webapp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {device.webapp}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
