"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  Wifi,
  Cable,
  Settings,
  Loader2,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  Globe,
  Router,
  Shield,
} from "lucide-react";
import type { MqttClient } from "mqtt";
import MqttStatus from "@/components/mqtt-status";

// --- MQTT Topics ---
const NETWORK_GET_TOPIC = "rpi/network/get";
const NETWORK_SET_TOPIC = "rpi/network/set";
const NETWORK_RESPONSE_TOPIC = "rpi/network/response";

// Additional topics for dependent services
const MODBUS_TCP_SETTING_COMMAND_TOPIC =
  "IOT/Containment/modbustcp/setting/command";
const SNMP_SETTING_COMMAND_TOPIC = "IOT/Containment/snmp/setting/command";

// --- Type Definitions ---
interface NetworkInterface {
  method: "static" | "dhcp";
  address?: string;
  netmask?: string;
  gateway?: string;
  "dns-nameservers"?: string;
  current_address?: string;
  connection?: string;
  state?: string;
  type?: string;
  cidr?: string;
  device_state?: string;
}

interface NetworkConfig {
  [interfaceName: string]: NetworkInterface;
}

interface EditConfig {
  interface: string;
  method: "static" | "dhcp";
  static_ip: string;
  netmask: string;
  gateway: string;
  dns: string;
}

export default function NetworkPage() {
  // --- State Variables ---
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig | null>(
    null
  );
  const [editConfig, setEditConfig] = useState<EditConfig>({
    interface: "eth0",
    method: "static",
    static_ip: "",
    netmask: "255.255.255.0",
    gateway: "",
    dns: "8.8.8.8 8.8.4.4",
  });
  const [open, setOpen] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentModbusTcpPort] = useState<number>(502);

  // Get current interface configs
  const eth0Config = networkConfig?.eth0;
  const wlan0Config = networkConfig?.wlan0;

  // --- Input Validation Functions ---
  const isValidIP = (ip: string) =>
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(
      ip
    );

  const isValidNetmask = (mask: string) => {
    const parts = mask.split(".").map(Number);
    if (parts.length !== 4) return false;
    if (parts.some((p) => p < 0 || p > 255)) return false;
    const validMasks = [
      "255.255.255.255",
      "255.255.255.254",
      "255.255.255.252",
      "255.255.255.248",
      "255.255.255.240",
      "255.255.255.224",
      "255.255.255.192",
      "255.255.255.128",
      "255.255.255.0",
      "255.255.254.0",
      "255.255.252.0",
      "255.255.248.0",
      "255.255.240.0",
      "255.255.224.0",
      "255.255.192.0",
      "255.255.128.0",
      "255.255.0.0",
      "255.254.0.0",
      "255.252.0.0",
      "255.248.0.0",
      "255.240.0.0",
      "255.224.0.0",
      "255.192.0.0",
      "255.128.0.0",
      "255.0.0.0",
      "0.0.0.0",
    ];
    return validMasks.includes(mask);
  };

  // --- Event Handlers ---
  const handleInput = (field: keyof EditConfig, value: string | boolean) => {
    console.log(`[DEBUG] handleInput: ${field} = ${value}`);
    setEditConfig((prev) => ({ ...prev, [field]: value }));
  };

  // --- Network Status Helper ---
  const getConnectionStatus = (config?: NetworkInterface) => {
    if (!config)
      return {
        status: "unknown",
        color: "bg-gray-500",
        textColor: "text-gray-700",
      };

    const state = config.state?.toLowerCase();
    if (state === "connected") {
      return {
        status: "connected",
        color: "bg-green-500",
        textColor: "text-green-700",
      };
    } else if (state === "disconnected" || state === "unavailable") {
      return {
        status: "disconnected",
        color: "bg-red-500",
        textColor: "text-red-700",
      };
    } else {
      return {
        status: "unknown",
        color: "bg-yellow-500",
        textColor: "text-yellow-700",
      };
    }
  };

  /**
   * Request current network configuration from backend
   */
  const requestNetworkConfig = useCallback(() => {
    console.log("[DEBUG] requestNetworkConfig: Starting request");
    const client = getMQTTClient();
    if (client && client.connected) {
      setIsLoading(true);
      console.log("[DEBUG] Publishing to:", NETWORK_GET_TOPIC);
      client.publish(NETWORK_GET_TOPIC, JSON.stringify({}), {}, (err) => {
        if (err) {
          console.error("[DEBUG] Publish error (get network config):", err);
          toast.error(`Failed to request config: ${err.message}`);
          setIsLoading(false);
        } else {
          console.log("[DEBUG] Successfully published network config request");
        }
      });
    } else {
      console.warn("[DEBUG] MQTT not connected, cannot request network config");
      toast.warning(
        "MQTT not connected. Cannot request network configuration."
      );
      setIsLoading(false);
    }
  }, []);

  /**
   * Update network configuration
   */
  const updateConfig = async () => {
    console.log(
      "[DEBUG] updateConfig: Starting update with config:",
      editConfig
    );

    if (editConfig.method === "static") {
      if (
        !isValidIP(editConfig.static_ip) ||
        !isValidIP(editConfig.gateway) ||
        !isValidNetmask(editConfig.netmask)
      ) {
        toast.error(
          "Invalid input format for IP Address, Netmask, or Gateway."
        );
        return;
      }
    }

    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT not connected. Cannot update configuration.");
      return;
    }

    const result = await Swal.fire({
      title: "Apply Network Changes?",
      html: `
        <div class="text-left space-y-2">
          <p><strong>Interface:</strong> ${editConfig.interface}</p>
          <p><strong>Method:</strong> ${editConfig.method.toUpperCase()}</p>
          ${
            editConfig.method === "static"
              ? `
            <p><strong>IP Address:</strong> ${editConfig.static_ip}</p>
            <p><strong>Gateway:</strong> ${editConfig.gateway}</p>
            <p><strong>Netmask:</strong> ${editConfig.netmask}</p>
          `
              : "<p><em>DHCP will obtain settings automatically</em></p>"
          }
          <hr class="my-3">
          <p class="text-sm text-amber-600">⚠️ This may temporarily interrupt network connectivity</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Apply Changes",
      cancelButtonText: "Cancel",
      customClass: {
        htmlContainer: "text-sm",
      },
    });

    if (!result.isConfirmed) {
      toast.info("Network update cancelled.");
      return;
    }

    setIsConfiguring(true);
    toast.loading("Applying network configuration...", { id: "networkUpdate" });

    const networkPayload: any = {
      interface: editConfig.interface,
      method: editConfig.method,
    };

    if (editConfig.method === "static") {
      networkPayload.static_ip = editConfig.static_ip;
      networkPayload.netmask = editConfig.netmask;
      networkPayload.gateway = editConfig.gateway;
      networkPayload.dns = editConfig.dns;
    }

    console.log("[DEBUG] Network payload:", networkPayload);

    client.publish(
      NETWORK_SET_TOPIC,
      JSON.stringify(networkPayload),
      {},
      (err) => {
        if (err) {
          console.error("[DEBUG] Publish error:", err);
          toast.dismiss("networkUpdate");
          toast.error(`Failed to send update: ${err.message}`);
          setIsConfiguring(false);
        } else {
          console.log("[DEBUG] Network config update sent");
          setOpen(false);

          // Update dependent services for static IP
          if (editConfig.method === "static") {
            const newIP = editConfig.static_ip;

            // Update Modbus TCP
            client.publish(
              MODBUS_TCP_SETTING_COMMAND_TOPIC,
              JSON.stringify({
                command: "write",
                modbus_tcp_ip: newIP,
                modbus_tcp_port: currentModbusTcpPort,
              }),
              {},
              (err) => {
                if (err)
                  console.error("[DEBUG] Modbus TCP update failed:", err);
                else console.log("[DEBUG] Modbus TCP updated with new IP");
              }
            );

            // Update SNMP
            client.publish(
              SNMP_SETTING_COMMAND_TOPIC,
              JSON.stringify({
                command: "write",
                snmpIPaddress: newIP,
              }),
              {},
              (err) => {
                if (err) console.error("[DEBUG] SNMP update failed:", err);
                else console.log("[DEBUG] SNMP updated with new IP");
              }
            );
          }
        }
      }
    );
  };

  const handleMethodChange = (isStatic: boolean) => {
    const newMethod = isStatic ? "static" : "dhcp";
    console.log("[DEBUG] Method changed to:", newMethod);
    handleInput("method", newMethod);

    // Pre-fill with current values when switching to static
    if (isStatic && eth0Config) {
      setEditConfig((prev) => ({
        ...prev,
        static_ip: eth0Config.current_address || eth0Config.address || "",
        gateway: eth0Config.gateway || "",
        dns: eth0Config["dns-nameservers"] || "8.8.8.8 8.8.4.4",
      }));
    }
  };

  const formatUptime = () => {
    if (!lastUpdated) return "Never";
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) return `${minutes}m ${seconds}s ago`;
    return `${seconds}s ago`;
  };

  // --- useEffect for MQTT Connection and Auto-Load ---
  useEffect(() => {
    console.log("[DEBUG] Initializing MQTT connection and auto-load");
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      console.log("[DEBUG] MQTT connected, subscribing to topics");
      mqttClientInstance.subscribe(NETWORK_RESPONSE_TOPIC, (err) => {
        if (err) console.error(`[DEBUG] Subscribe error:`, err);
        else console.log(`[DEBUG] Subscribed to ${NETWORK_RESPONSE_TOPIC}`);
      });

      // Auto-load data on connect
      setTimeout(() => requestNetworkConfig(), 500);
      toast.success("Connected - Loading network data...");
    };

    const handleMessage = (topic: string, messageBuf: Buffer) => {
      try {
        const data = JSON.parse(messageBuf.toString());
        console.log(`[DEBUG] Received:`, data);

        if (topic === NETWORK_RESPONSE_TOPIC) {
          toast.dismiss("networkUpdate");

          if (data.status === "success") {
            if (data.action === "get_network_config" && data.network_config) {
              console.log(
                "[DEBUG] Setting network config:",
                data.network_config
              );
              setNetworkConfig(data.network_config);
              setLastUpdated(new Date());

              // Update edit form with current eth0 config
              if (data.network_config.eth0) {
                const eth0 = data.network_config.eth0;
                setEditConfig({
                  interface: "eth0",
                  method: eth0.method || "dhcp",
                  static_ip: eth0.address || eth0.current_address || "",
                  netmask: eth0.netmask || "255.255.255.0",
                  gateway: eth0.gateway || "",
                  dns: eth0["dns-nameservers"] || "8.8.8.8 8.8.4.4",
                });
              }

              toast.success("Network configuration loaded");
            } else if (data.action === "set_network_config") {
              toast.success(data.message || "Network updated successfully");
              setTimeout(() => requestNetworkConfig(), 2000);
            }
          } else {
            console.error("[DEBUG] Error response:", data);
            toast.error(
              data.error || data.message || "Network operation failed"
            );
          }

          setIsLoading(false);
          setIsConfiguring(false);
        }
      } catch (err) {
        console.error("[DEBUG] Parse error:", err);
        toast.error("Invalid response format");
        setIsLoading(false);
        setIsConfiguring(false);
      }
    };

    // Event listeners
    if (mqttClientInstance.connected) {
      handleConnect();
    } else {
      mqttClientInstance.on("connect", handleConnect);
    }

    mqttClientInstance.on("message", handleMessage);
    mqttClientInstance.on("error", (err) => {
      console.error("[DEBUG] MQTT error:", err);
      toast.error("MQTT connection error");
      setIsLoading(false);
    });

    return () => {
      console.log("[DEBUG] Cleanup MQTT");
      if (clientRef.current) {
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("message", handleMessage);
        clientRef.current.unsubscribe(NETWORK_RESPONSE_TOPIC);
      }
    };
  }, [requestNetworkConfig]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !isConfiguring) {
        console.log("[DEBUG] Auto-refresh network config");
        requestNetworkConfig();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [requestNetworkConfig, isLoading, isConfiguring]);

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">
            Network Configuration
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            onClick={requestNetworkConfig}
            disabled={isLoading}
            title="Refresh Network Data"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>
      <div className="p-6 space-y-6 ">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Cable className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Ethernet Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        getConnectionStatus(eth0Config).color
                      }`}
                    />
                    <span className="text-sm capitalize">
                      {getConnectionStatus(eth0Config).status}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Wifi className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">WiFi Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        getConnectionStatus(wlan0Config).color
                      }`}
                    />
                    <span className="text-sm capitalize">
                      {getConnectionStatus(wlan0Config).status}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-purple-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatUptime()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Main Interface Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ethernet Interface */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cable className="w-5 h-5" />
                  <CardTitle className="text-lg">Ethernet (eth0)</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      eth0Config?.method === "static" ? "default" : "secondary"
                    }
                  >
                    {eth0Config?.method?.toUpperCase() || "Unknown"}
                  </Badge>
                  {eth0Config?.state === "connected" ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!networkConfig ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading network configuration...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                      <div>
                        <label className="font-medium text-gray-700">
                          IP Address
                        </label>
                        <p className="mt-1 font-mono bg-gray-50 px-2 py-1 rounded">
                          {eth0Config?.current_address ||
                            eth0Config?.address ||
                            "Not assigned"}
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-gray-700">
                          Gateway
                        </label>
                        <p className="mt-1 font-mono bg-gray-50 px-2 py-1 rounded flex items-center">
                          <Router className="w-3 h-3 mr-1" />
                          {eth0Config?.gateway || "Not set"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="font-medium text-gray-700">
                          Netmask
                        </label>
                        <p className="mt-1 font-mono bg-gray-50 px-2 py-1 rounded">
                          {eth0Config?.netmask || "Not set"}
                        </p>
                      </div>
                      <div>
                        <label className="font-medium text-gray-700">
                          DNS Servers
                        </label>
                        <p className="mt-1 font-mono bg-gray-50 px-2 py-1 rounded flex items-center">
                          <Globe className="w-3 h-3 mr-1" />
                          {eth0Config?.["dns-nameservers"] || "Not set"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Dialog open={open} onOpenChange={setOpen}>
                      <DialogTrigger asChild>
                        <Button
                          className="w-full"
                          disabled={isLoading || isConfiguring}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Configure Network
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle className="flex items-center">
                            <Settings className="w-5 h-5 mr-2" />
                            Configure Ethernet Interface
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Method Toggle */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                              <Label className="text-base font-medium">
                                Configuration Method
                              </Label>
                              <p className="text-sm text-gray-600 mt-1">
                                {editConfig.method === "static"
                                  ? "Manual IP configuration"
                                  : "Automatic DHCP configuration"}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Label className="text-sm">DHCP</Label>
                              <Switch
                                checked={editConfig.method === "static"}
                                onCheckedChange={handleMethodChange}
                              />
                              <Label className="text-sm">Static</Label>
                            </div>
                          </div>

                          {editConfig.method === "static" ? (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                <Label>IP Address</Label>
                                <Input
                                  placeholder="192.168.1.100"
                                  value={editConfig.static_ip}
                                  onChange={(e) =>
                                    handleInput("static_ip", e.target.value)
                                  }
                                  className={
                                    !isValidIP(editConfig.static_ip) &&
                                    editConfig.static_ip
                                      ? "border-red-500"
                                      : ""
                                  }
                                />
                              </div>
                              <div>
                                <Label>Netmask</Label>
                                <Input
                                  placeholder="255.255.255.0"
                                  value={editConfig.netmask}
                                  onChange={(e) =>
                                    handleInput("netmask", e.target.value)
                                  }
                                  className={
                                    !isValidNetmask(editConfig.netmask) &&
                                    editConfig.netmask
                                      ? "border-red-500"
                                      : ""
                                  }
                                />
                              </div>
                              <div>
                                <Label>Gateway</Label>
                                <Input
                                  placeholder="192.168.1.1"
                                  value={editConfig.gateway}
                                  onChange={(e) =>
                                    handleInput("gateway", e.target.value)
                                  }
                                  className={
                                    !isValidIP(editConfig.gateway) &&
                                    editConfig.gateway
                                      ? "border-red-500"
                                      : ""
                                  }
                                />
                              </div>
                              <div className="col-span-2">
                                <Label>DNS Servers</Label>
                                <Input
                                  placeholder="8.8.8.8 8.8.4.4"
                                  value={editConfig.dns}
                                  onChange={(e) =>
                                    handleInput("dns", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-start space-x-2">
                                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                  <h4 className="font-medium text-blue-900">
                                    DHCP Configuration
                                  </h4>
                                  <p className="text-sm text-blue-700 mt-1">
                                    Network settings will be obtained
                                    automatically from your router or DHCP
                                    server. This is the recommended option for
                                    most users.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <Button
                            onClick={updateConfig}
                            disabled={
                              isConfiguring ||
                              (editConfig.method === "static" &&
                                (!isValidIP(editConfig.static_ip) ||
                                  !isValidIP(editConfig.gateway) ||
                                  !isValidNetmask(editConfig.netmask)))
                            }
                            className="w-full"
                          >
                            {isConfiguring ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            Apply Configuration
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* WiFi Interface */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wifi className="w-5 h-5" />
                  <CardTitle className="text-lg">WiFi (wlan0)</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      wlan0Config?.method === "static" ? "default" : "secondary"
                    }
                  >
                    {wlan0Config?.method?.toUpperCase() || "Unknown"}
                  </Badge>
                  {wlan0Config?.state === "connected" ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {wlan0Config ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div>
                      <label className="font-medium text-gray-700">
                        IP Address
                      </label>
                      <p className="mt-1 font-mono bg-gray-50 px-2 py-1 rounded">
                        {wlan0Config.current_address ||
                          wlan0Config.address ||
                          "Not assigned"}
                      </p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">
                        Connection
                      </label>
                      <p className="mt-1 font-mono bg-gray-50 px-2 py-1 rounded flex items-center">
                        <Shield className="w-3 h-3 mr-1" />
                        {wlan0Config.connection || "Not connected"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="font-medium text-gray-700">
                        Gateway
                      </label>
                      <p className="mt-1 font-mono bg-gray-50 px-2 py-1 rounded flex items-center">
                        <Router className="w-3 h-3 mr-1" />
                        {wlan0Config.gateway || "Not set"}
                      </p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">DNS</label>
                      <p className="mt-1 font-mono bg-gray-50 px-2 py-1 rounded flex items-center">
                        <Globe className="w-3 h-3 mr-1" />
                        {wlan0Config["dns-nameservers"] || "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 text-sm text-gray-500">
                  <Wifi className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>
                    WiFi interface (wlan0) is not available or not configured.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>{" "}
        {/* End of grid for cards */}
      </div>{" "}
      {/* End of main content padding */}
    </SidebarInset>
  );
}
