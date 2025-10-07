// app/vpn/config/components/OpenVPNForm.tsx
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Shield,
  Edit2,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Network,
  Lock,
  FileKey,
  Globe,
  Settings,
  Save,
  Play,
  Square,
  Upload,
} from "lucide-react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface OpenVPNConfig {
  enabled: boolean;
  config_name: string;
  remote_host: string;
  remote_port: number;
  protocol: "udp" | "tcp";
  username?: string;
  password?: string;
  ca_certificate: string;
  client_certificate: string;
  client_key: string;
  tls_crypt: string;
  compression: boolean;
  cipher?: string;
  auth?: string;
  extra_options?: string;
  status?: "connected" | "disconnected" | "connecting" | "needs_config";
  vpn_ip?: string;
  is_template?: boolean;
  warning?: string;
}

export default function OpenVPNForm() {
  const [config, setConfig] = useState<OpenVPNConfig | null>(null);
  const [editConfig, setEditConfig] = useState<OpenVPNConfig>({
    enabled: false,
    config_name: "VPN Config",
    remote_host: "",
    remote_port: 1194,
    protocol: "udp",
    username: "",
    password: "",
    ca_certificate: "",
    client_certificate: "",
    client_key: "",
    tls_crypt: "",
    compression: true,
    cipher: "AES-256-GCM",
    auth: "SHA256",
    extra_options: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isWaitingForConfig, setIsWaitingForConfig] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);

  const requestConfig = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      console.log("Requesting OpenVPN configuration...");
      client.publish(
        "vpn/openvpn/request",
        JSON.stringify({ action: "getConfig" })
      );
      toast.info("Refreshing configuration...");
    } else {
      toast.warning("MQTT not connected. Cannot request configuration.");
    }
  }, []);

  useEffect(() => {
    console.log("Initializing MQTT connection for OpenVPN...");
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      "vpn/openvpn/config",
      "vpn/openvpn/status",
      "vpn/openvpn/response",
    ];

    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
          toast.error(`Failed to subscribe to ${topic}`);
        } else {
          console.log(`Subscribed to ${topic}`);
        }
      });
    });

    const handleMessage = (topic: string, buf: Buffer) => {
      const rawMessage = buf.toString();

      try {
        const data = JSON.parse(rawMessage);

        if (topic === "vpn/openvpn/config") {
          setConfig(data);
          setIsWaitingForConfig(false);
          toast.success("OpenVPN configuration loaded");
        } else if (topic === "vpn/openvpn/status") {
          setConfig((prev) => (prev ? { ...prev, ...data } : null));
        } else if (topic === "vpn/openvpn/response" && data.message) {
          if (data.success) {
            toast.success(data.message);
            requestConfig();
          } else {
            toast.error(data.message);
          }
        }
      } catch (err) {
        console.error("Error parsing message:", err);
        toast.error("Invalid response format from MQTT.");
      }
    };

    const handleConnect = () => {
      console.log("MQTT Connected");
      toast.success("Connected to MQTT broker");

      setTimeout(() => {
        requestConfig();
      }, 1000);
    };

    const handleDisconnect = () => {
      console.log("MQTT Disconnected");
      toast.error("Disconnected from MQTT broker");
    };

    const handleError = (error: Error) => {
      console.error("MQTT Error:", error);
      toast.error(`MQTT Error: ${error.message}`);
    };

    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);
    mqttClientInstance.on("disconnect", handleDisconnect);
    mqttClientInstance.on("error", handleError);

    return () => {
      if (clientRef.current) {
        topicsToSubscribe.forEach((topic) => {
          clientRef.current?.unsubscribe(topic);
        });
        clientRef.current.off("message", handleMessage);
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("disconnect", handleDisconnect);
        clientRef.current.off("error", handleError);
      }
    };
  }, [requestConfig]);

  const handleInput = (
    field: keyof OpenVPNConfig,
    value: string | number | boolean
  ) => {
    setEditConfig((prev) => ({ ...prev, [field]: value }));
  };

  const openEditModal = () => {
    if (config) {
      setEditConfig(config);
      setDialogOpen(true);
    } else {
      toast.error("Configuration not loaded yet. Please wait or refresh.");
    }
  };

  const saveConfig = async () => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Cannot save configuration.");
      return;
    }

    if (!editConfig.remote_host || !editConfig.remote_port) {
      toast.error("Remote host and port are required.");
      return;
    }

    setIsSaving(true);

    client.publish("vpn/openvpn/update", JSON.stringify(editConfig), (err) => {
      if (err) {
        toast.error(`Failed to publish config: ${err.message}`);
        setIsSaving(false);
      } else {
        toast.success("Configuration saved successfully");
        setDialogOpen(false);

        setTimeout(() => {
          requestConfig();
          setIsSaving(false);
        }, 2000);
      }
    });
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
        "vpn/openvpn/upload",
        JSON.stringify({ content: fileContent }),
        (err) => {
          if (err) {
            toast.error(`Upload failed: ${err.message}`);
            setIsUploading(false);
          } else {
            toast.success("File uploaded successfully");
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
      toast.error("MQTT client not connected.");
      return;
    }

    const action = config?.status === "connected" ? "disconnect" : "connect";
    setIsConnecting(true);

    client.publish("vpn/openvpn/command", JSON.stringify({ action }), (err) => {
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
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">OpenVPN Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Manage OpenVPN client connection and certificates
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
            Upload .ovpn
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
              Upload OpenVPN Configuration
            </DialogTitle>
            <DialogDescription>
              Upload a .ovpn file to configure OpenVPN. The file will be saved
              as subrack.ovpn
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Uploading will replace existing configuration
              </AlertDescription>
            </Alert>

            <div className="grid gap-2">
              <Label htmlFor="ovpn-file">Select .ovpn File</Label>
              <Input
                id="ovpn-file"
                type="file"
                accept=".ovpn"
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
                  Upload File
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Config Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Edit OpenVPN Configuration
            </DialogTitle>
            <DialogDescription>
              Update VPN connection settings and certificates
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Changes will be applied after saving
              </AlertDescription>
            </Alert>

            {/* Basic Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Network className="w-4 h-4" />
                Connection Settings
              </h3>

              <div className="grid gap-4">
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
                    placeholder="e.g., Office VPN"
                    value={editConfig.config_name}
                    onChange={(e) => handleInput("config_name", e.target.value)}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="remote_host">Remote Host/IP</Label>
                    <Input
                      id="remote_host"
                      placeholder="vpn.example.com"
                      value={editConfig.remote_host}
                      onChange={(e) =>
                        handleInput("remote_host", e.target.value)
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="remote_port">Port</Label>
                    <Input
                      id="remote_port"
                      placeholder="1194"
                      type="number"
                      value={editConfig.remote_port}
                      onChange={(e) =>
                        handleInput("remote_port", Number(e.target.value))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="protocol">Protocol</Label>
                  <Select
                    value={editConfig.protocol}
                    onValueChange={(value) =>
                      handleInput("protocol", value as "udp" | "tcp")
                    }
                  >
                    <SelectTrigger id="protocol">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="udp">UDP (Recommended)</SelectItem>
                      <SelectItem value="tcp">TCP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Authentication */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Authentication (Optional)
              </h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Optional"
                    value={editConfig.username}
                    onChange={(e) => handleInput("username", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    placeholder="Optional"
                    type="password"
                    value={editConfig.password}
                    onChange={(e) => handleInput("password", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Certificates */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileKey className="w-4 h-4" />
                Certificates & Keys
              </h3>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ca_certificate">CA Certificate</Label>
                  <Textarea
                    id="ca_certificate"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    className="font-mono text-xs"
                    rows={4}
                    value={editConfig.ca_certificate}
                    onChange={(e) =>
                      handleInput("ca_certificate", e.target.value)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="client_certificate">Client Certificate</Label>
                  <Textarea
                    id="client_certificate"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    className="font-mono text-xs"
                    rows={4}
                    value={editConfig.client_certificate}
                    onChange={(e) =>
                      handleInput("client_certificate", e.target.value)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="client_key">Client Private Key</Label>
                  <Textarea
                    id="client_key"
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    className="font-mono text-xs"
                    rows={4}
                    value={editConfig.client_key}
                    onChange={(e) => handleInput("client_key", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* TLS Crypt */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileKey className="w-4 h-4" />
                TLS Crypt/Auth Key
              </h3>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tls_crypt">TLS Crypt Key</Label>
                  <Textarea
                    id="tls_crypt"
                    placeholder="-----BEGIN OpenVPN Static key V1-----&#10;...&#10;-----END OpenVPN Static key V1-----"
                    className="font-mono text-xs"
                    rows={6}
                    value={editConfig.tls_crypt}
                    onChange={(e) => handleInput("tls_crypt", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Additional security layer for TLS handshake (optional but
                    recommended)
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Advanced Options */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Advanced Settings
              </h3>

              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>LZO Compression</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable data compression
                    </p>
                  </div>
                  <Switch
                    checked={editConfig.compression}
                    onCheckedChange={(checked) =>
                      handleInput("compression", checked)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cipher">TLS Cipher</Label>
                  <Input
                    id="cipher"
                    placeholder="AES-256-GCM"
                    value={editConfig.cipher}
                    onChange={(e) => handleInput("cipher", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="auth">Auth Algorithm</Label>
                  <Input
                    id="auth"
                    placeholder="SHA256"
                    value={editConfig.auth}
                    onChange={(e) => handleInput("auth", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    HMAC authentication algorithm (e.g., SHA256, SHA512)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="extra_options">Extra Options</Label>
                  <Textarea
                    id="extra_options"
                    placeholder="Additional OpenVPN options (one per line)"
                    rows={3}
                    value={editConfig.extra_options}
                    onChange={(e) =>
                      handleInput("extra_options", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Advanced users only. Format: one option per line
                  </p>
                </div>
              </div>
            </div>
          </div>

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
  config: OpenVPNConfig | null;
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

  const isConfigured = config.remote_host && config.remote_port;
  const isConnected = config.status === "connected";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{config.config_name}</CardTitle>
            <CardDescription>
              OpenVPN client configuration details
            </CardDescription>
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
              {config.warning ||
                "Configuration template detected. Please edit and complete all required fields."}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Globe className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Remote Server</p>
              <p className="text-base font-mono">
                {config.remote_host || "Not configured"}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Network className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Port</p>
                <p className="text-base font-mono">{config.remote_port}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Settings className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Protocol</p>
                <p className="text-base uppercase">{config.protocol}</p>
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
            <Lock className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Authentication</p>
              <p className="text-sm text-muted-foreground">
                {config.username ? "Username/Password" : "Certificate only"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <FileKey className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Certificates</p>
              <p className="text-sm text-muted-foreground">
                {config.ca_certificate &&
                config.client_certificate &&
                config.client_key
                  ? "Configured"
                  : "Not configured"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">TLS Crypt</p>
              <p className="text-sm text-muted-foreground">
                {config.tls_crypt ? "Enabled" : "Disabled"}
              </p>
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
