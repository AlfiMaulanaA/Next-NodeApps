// app/vpn/config/components/WireGuardForm.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Zap,
  Edit2,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Network,
  Key,
  Globe,
  Settings,
  Save,
  Play,
  Square,
  Upload,
  Sparkles,
} from "lucide-react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WireGuardConfig {
  enabled: boolean;
  config_name: string;
  private_key: string;
  public_key: string;
  address: string;
  dns: string;
  mtu: number;
  peer_public_key: string;
  preshared_key: string;
  endpoint: string;
  endpoint_port: number;
  allowed_ips: string;
  persistent_keepalive: number;
  status?: "connected" | "disconnected" | "connecting" | "needs_config";
  vpn_ip?: string;
  is_template?: boolean;
  warning?: string;
}

export default function WireGuardForm() {
  const [config, setConfig] = useState<WireGuardConfig | null>(null);
  const [editConfig, setEditConfig] = useState<WireGuardConfig>({
    enabled: false,
    config_name: "WireGuard VPN",
    private_key: "",
    public_key: "",
    address: "",
    dns: "1.1.1.1",
    mtu: 1420,
    peer_public_key: "",
    preshared_key: "",
    endpoint: "",
    endpoint_port: 51820,
    allowed_ips: "0.0.0.0/0",
    persistent_keepalive: 25,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isWaitingForConfig, setIsWaitingForConfig] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);

  const requestConfig = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      client.publish(
        "vpn/wireguard/request",
        JSON.stringify({ action: "getConfig" })
      );
      toast.info("Refreshing configuration...");
    }
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      "vpn/wireguard/config",
      "vpn/wireguard/status",
      "vpn/wireguard/response",
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

        if (topic === "vpn/wireguard/config") {
          setConfig(data);
          setIsWaitingForConfig(false);
          toast.success("WireGuard configuration loaded");
        } else if (topic === "vpn/wireguard/status") {
          setConfig((prev) => (prev ? { ...prev, ...data } : null));
        } else if (topic === "vpn/wireguard/response" && data.message) {
          if (data.success) {
            toast.success(data.message);

            // Handle key generation response
            if (data.data) {
              if (data.data.private_key && data.data.public_key) {
                setEditConfig((prev) => ({
                  ...prev,
                  private_key: data.data.private_key,
                  public_key: data.data.public_key,
                }));
              } else if (data.data.preshared_key) {
                setEditConfig((prev) => ({
                  ...prev,
                  preshared_key: data.data.preshared_key,
                }));
              }
            }

            requestConfig();
          } else {
            toast.error(data.message);
          }
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    };

    const handleConnect = () => {
      toast.success("Connected to MQTT broker");
      setTimeout(() => requestConfig(), 1000);
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
  }, [requestConfig]);

  const handleInput = (
    field: keyof WireGuardConfig,
    value: string | number | boolean
  ) => {
    setEditConfig((prev) => ({ ...prev, [field]: value }));
  };

  const generateKeypair = () => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT not connected");
      return;
    }

    setIsGenerating(true);
    client.publish(
      "vpn/wireguard/request",
      JSON.stringify({ action: "generateKeys", type: "keypair" }),
      () => {
        setTimeout(() => setIsGenerating(false), 2000);
      }
    );
  };

  const generatePresharedKey = () => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT not connected");
      return;
    }

    setIsGenerating(true);
    client.publish(
      "vpn/wireguard/request",
      JSON.stringify({ action: "generateKeys", type: "preshared" }),
      () => {
        setTimeout(() => setIsGenerating(false), 2000);
      }
    );
  };

  const openEditModal = () => {
    if (config) {
      setEditConfig(config);
      setDialogOpen(true);
    } else {
      toast.error("Configuration not loaded yet.");
    }
  };

  const saveConfig = () => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT not connected");
      return;
    }

    if (
      !editConfig.private_key ||
      !editConfig.address ||
      !editConfig.peer_public_key ||
      !editConfig.endpoint
    ) {
      toast.error(
        "Private key, address, peer public key, and endpoint are required"
      );
      return;
    }

    setIsSaving(true);

    client.publish(
      "vpn/wireguard/update",
      JSON.stringify(editConfig),
      (err) => {
        if (err) {
          toast.error(`Failed to save: ${err.message}`);
          setIsSaving(false);
        } else {
          toast.success("Configuration saved");
          setDialogOpen(false);
          setTimeout(() => {
            requestConfig();
            setIsSaving(false);
          }, 2000);
        }
      }
    );
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      toast.error("Please select a file");
      return;
    }

    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT not connected");
      return;
    }

    setIsUploading(true);

    try {
      const fileContent = await uploadFile.text();

      client.publish(
        "vpn/wireguard/upload",
        JSON.stringify({ content: fileContent }),
        (err) => {
          if (err) {
            toast.error(`Upload failed: ${err.message}`);
            setIsUploading(false);
          } else {
            toast.success("File uploaded");
            setUploadDialogOpen(false);
            setUploadFile(null);
            setTimeout(() => {
              requestConfig();
              setIsUploading(false);
            }, 2000);
          }
        }
      );
    } catch (error) {
      toast.error("Error reading file");
      setIsUploading(false);
    }
  };

  const toggleConnection = () => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT not connected");
      return;
    }

    const action = config?.status === "connected" ? "disconnect" : "connect";
    setIsConnecting(true);

    client.publish(
      "vpn/wireguard/command",
      JSON.stringify({ action }),
      (err) => {
        if (err) {
          toast.error(`Failed to ${action}: ${err.message}`);
          setIsConnecting(false);
        } else {
          toast.success(`VPN ${action} command sent`);
          setTimeout(() => {
            requestConfig();
            setIsConnecting(false);
          }, 2000);
        }
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">WireGuard Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Modern, fast, and secure VPN protocol
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadDialogOpen(true)}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload .conf
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={requestConfig}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <ConfigView
        config={config}
        onEdit={openEditModal}
        onToggleConnection={toggleConnection}
        isWaiting={isWaitingForConfig}
        isConnecting={isConnecting}
      />

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload WireGuard Configuration
            </DialogTitle>
            <DialogDescription>
              Upload a .conf file to configure WireGuard
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="wg-file">Select .conf File</Label>
              <Input
                id="wg-file"
                type="file"
                accept=".conf"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              {uploadFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: <strong>{uploadFile.name}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                setUploadFile(null);
              }}
              className="flex-1"
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFileUpload}
              className="flex-1 gap-2"
              disabled={isUploading || !uploadFile}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Config Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Edit WireGuard Configuration
            </DialogTitle>
            <DialogDescription>
              Configure WireGuard VPN connection
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="interface" className="py-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="interface">Interface</TabsTrigger>
              <TabsTrigger value="peer">Peer</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Interface Settings */}
            <TabsContent value="interface" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable VPN</Label>
                    <p className="text-xs text-muted-foreground">
                      Activate this VPN configuration
                    </p>
                  </div>
                  <Switch
                    checked={editConfig.enabled}
                    onCheckedChange={(checked) =>
                      handleInput("enabled", checked)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="config_name">Configuration Name</Label>
                  <Input
                    id="config_name"
                    placeholder="e.g., Office WireGuard"
                    value={editConfig.config_name}
                    onChange={(e) => handleInput("config_name", e.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Private Key</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateKeypair}
                      disabled={isGenerating}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Generate Keypair
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Private key (will be generated)"
                    className="font-mono text-xs"
                    rows={3}
                    value={editConfig.private_key}
                    onChange={(e) => handleInput("private_key", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Public Key (Read-only)</Label>
                  <Input
                    placeholder="Auto-derived from private key"
                    className="font-mono text-xs"
                    value={editConfig.public_key}
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically derived from private key
                  </p>
                </div>

                <Separator />

                <div className="grid gap-2">
                  <Label htmlFor="address">VPN Address (CIDR)</Label>
                  <Input
                    id="address"
                    placeholder="10.0.0.2/24"
                    value={editConfig.address}
                    onChange={(e) => handleInput("address", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Client IP address with subnet (e.g., 10.0.0.2/24)
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dns">DNS Servers</Label>
                    <Input
                      id="dns"
                      placeholder="1.1.1.1, 8.8.8.8"
                      value={editConfig.dns}
                      onChange={(e) => handleInput("dns", e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="mtu">MTU</Label>
                    <Input
                      id="mtu"
                      type="number"
                      placeholder="1420"
                      value={editConfig.mtu}
                      onChange={(e) =>
                        handleInput("mtu", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Peer Settings */}
            <TabsContent value="peer" className="space-y-4 mt-4">
              <div className="space-y-4">
                <Alert>
                  <Network className="h-4 w-4" />
                  <AlertDescription>
                    Server (Peer) configuration
                  </AlertDescription>
                </Alert>

                <div className="grid gap-2">
                  <Label htmlFor="peer_public_key">Server Public Key</Label>
                  <Textarea
                    id="peer_public_key"
                    placeholder="Server's public key"
                    className="font-mono text-xs"
                    rows={3}
                    value={editConfig.peer_public_key}
                    onChange={(e) =>
                      handleInput("peer_public_key", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Preshared Key (Optional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generatePresharedKey}
                      disabled={isGenerating}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Key className="w-3 h-3" />
                      )}
                      Generate PSK
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Optional preshared key for extra security"
                    className="font-mono text-xs"
                    rows={2}
                    value={editConfig.preshared_key}
                    onChange={(e) =>
                      handleInput("preshared_key", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Adds an additional layer of symmetric encryption
                  </p>
                </div>

                <Separator />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="endpoint">Server Address</Label>
                    <Input
                      id="endpoint"
                      placeholder="vpn.example.com"
                      value={editConfig.endpoint}
                      onChange={(e) => handleInput("endpoint", e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="endpoint_port">Port</Label>
                    <Input
                      id="endpoint_port"
                      type="number"
                      placeholder="51820"
                      value={editConfig.endpoint_port}
                      onChange={(e) =>
                        handleInput("endpoint_port", Number(e.target.value))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="allowed_ips">Allowed IPs</Label>
                  <Input
                    id="allowed_ips"
                    placeholder="0.0.0.0/0 (route all traffic)"
                    value={editConfig.allowed_ips}
                    onChange={(e) => handleInput("allowed_ips", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    IP ranges to route through VPN (0.0.0.0/0 = all traffic)
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="persistent_keepalive">
                    Persistent Keepalive (seconds)
                  </Label>
                  <Input
                    id="persistent_keepalive"
                    type="number"
                    placeholder="25"
                    value={editConfig.persistent_keepalive}
                    onChange={(e) =>
                      handleInput(
                        "persistent_keepalive",
                        Number(e.target.value)
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Keep connection alive through NAT/firewall (0 = disabled, 25
                    recommended)
                  </p>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    WireGuard uses modern cryptography (ChaCha20, Poly1305) by
                    default. No additional encryption settings needed.
                  </AlertDescription>
                </Alert>

                <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                  <h4 className="font-medium text-sm">Configuration Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Protocol:</span>{" "}
                      UDP
                    </div>
                    <div>
                      <span className="text-muted-foreground">Encryption:</span>{" "}
                      ChaCha20
                    </div>
                    <div>
                      <span className="text-muted-foreground">Auth:</span>{" "}
                      Poly1305
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Key Exchange:
                      </span>{" "}
                      Noise_IK
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="flex-1"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={saveConfig}
              className="flex-1 gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigView({
  config,
  onEdit,
  onToggleConnection,
  isWaiting = true,
  isConnecting = false,
}: {
  config: WireGuardConfig | null;
  onEdit: () => void;
  onToggleConnection: () => void;
  isWaiting?: boolean;
  isConnecting?: boolean;
}) {
  if (!config) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
          <p className="text-base font-medium mb-1">
            {isWaiting
              ? "Loading configuration..."
              : "Waiting for connection..."}
          </p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Please ensure MQTT broker is running and accessible
          </p>
        </CardContent>
      </Card>
    );
  }

  const isConfigured =
    config.private_key &&
    config.address &&
    config.peer_public_key &&
    config.endpoint;
  const isConnected = config.status === "connected";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{config.config_name}</CardTitle>
            <CardDescription>WireGuard VPN configuration</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className="gap-1"
            >
              {isConnected ? (
                <>
                  <Check className="w-3 h-3" />
                  Connected
                </>
              ) : (
                "Disconnected"
              )}
            </Badge>
            {config.enabled && (
              <Badge variant="outline" className="gap-1">
                Enabled
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {config.is_template && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {config.warning || "Please configure WireGuard settings"}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Globe className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Server Endpoint</p>
              <p className="text-base font-mono">
                {config.endpoint
                  ? `${config.endpoint}:${config.endpoint_port}`
                  : "Not configured"}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Network className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">VPN Address</p>
                <p className="text-base font-mono">
                  {config.address || "Not configured"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Key className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Keys</p>
                <p className="text-sm text-muted-foreground">
                  {config.private_key && config.peer_public_key
                    ? "Configured"
                    : "Not configured"}
                </p>
              </div>
            </div>
          </div>

          {isConnected && config.vpn_ip && (
            <Alert variant="default">
              <Network className="h-4 w-4" />
              <AlertDescription>
                VPN IP Address: <strong>{config.vpn_ip}</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Settings className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Allowed IPs</p>
              <p className="text-sm text-muted-foreground">
                {config.allowed_ips || "0.0.0.0/0"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Network className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Keepalive</p>
              <p className="text-sm text-muted-foreground">
                {config.persistent_keepalive}s
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Zap className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Protocol</p>
              <p className="text-sm text-muted-foreground">Modern & Fast</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onToggleConnection}
            className="flex-1 gap-2"
            size="lg"
            variant={isConnected ? "destructive" : "default"}
            disabled={!isConfigured || isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isConnected ? "Disconnecting..." : "Connecting..."}
              </>
            ) : isConnected ? (
              <>
                <Square className="w-4 h-4" />
                Disconnect VPN
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Connect VPN
              </>
            )}
          </Button>

          <Button
            onClick={onEdit}
            variant="outline"
            className="gap-2"
            size="lg"
          >
            <Edit2 className="w-4 h-4" />
            Edit Config
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
