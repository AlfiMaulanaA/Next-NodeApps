// app/vpn/config/components/IKEv2Form.tsx
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
  Lock,
  Edit2,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Network,
  Shield,
  FileKey,
  Globe,
  Settings,
  Save,
  Play,
  Square,
  Upload,
  Key,
} from "lucide-react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface IKEv2Config {
  enabled: boolean;
  config_name: string;
  server_address: string;
  auth_method: "psk" | "cert" | "eap";
  local_id: string;
  remote_id: string;
  psk: string;
  username: string;
  password: string;
  ca_certificate: string;
  client_certificate: string;
  client_key: string;
  ike_encryption: string;
  ike_integrity: string;
  esp_encryption: string;
  esp_integrity: string;
  dpd_interval: number;
  dpd_timeout: number;
  nat_traversal: boolean;
  local_subnet: string;
  remote_subnet: string;
  status?: "connected" | "disconnected" | "connecting" | "needs_config";
  vpn_ip?: string;
  is_template?: boolean;
  warning?: string;
}

export default function IKEv2Form() {
  const [config, setConfig] = useState<IKEv2Config | null>(null);
  const [editConfig, setEditConfig] = useState<IKEv2Config>({
    enabled: false,
    config_name: "IKEv2 VPN",
    server_address: "",
    auth_method: "psk",
    local_id: "",
    remote_id: "",
    psk: "",
    username: "",
    password: "",
    ca_certificate: "",
    client_certificate: "",
    client_key: "",
    ike_encryption: "aes256",
    ike_integrity: "sha256",
    esp_encryption: "aes256",
    esp_integrity: "sha256",
    dpd_interval: 30,
    dpd_timeout: 150,
    nat_traversal: true,
    local_subnet: "0.0.0.0/0",
    remote_subnet: "0.0.0.0/0",
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
      client.publish(
        "vpn/ikev2/request",
        JSON.stringify({ action: "getConfig" })
      );
      toast.info("Refreshing configuration...");
    }
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      "vpn/ikev2/config",
      "vpn/ikev2/status",
      "vpn/ikev2/response",
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

        if (topic === "vpn/ikev2/config") {
          setConfig(data);
          setIsWaitingForConfig(false);
          toast.success("IKEv2 configuration loaded");
        } else if (topic === "vpn/ikev2/status") {
          setConfig((prev) => (prev ? { ...prev, ...data } : null));
        } else if (topic === "vpn/ikev2/response" && data.message) {
          if (data.success) {
            toast.success(data.message);
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
    field: keyof IKEv2Config,
    value: string | number | boolean
  ) => {
    setEditConfig((prev) => ({ ...prev, [field]: value }));
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

    if (!editConfig.server_address) {
      toast.error("Server address is required");
      return;
    }

    setIsSaving(true);

    client.publish("vpn/ikev2/update", JSON.stringify(editConfig), (err) => {
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
        "vpn/ikev2/upload",
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

    client.publish("vpn/ikev2/command", JSON.stringify({ action }), (err) => {
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
          <h3 className="text-lg font-semibold">IKEv2 Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Internet Key Exchange version 2 protocol
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
            Upload Config
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
              Upload IKEv2 Configuration
            </DialogTitle>
            <DialogDescription>
              Upload strongSwan config file or .mobileconfig
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ikev2-file">Select Config File</Label>
              <Input
                id="ikev2-file"
                type="file"
                accept=".conf,.mobileconfig"
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
              Edit IKEv2 Configuration
            </DialogTitle>
            <DialogDescription>
              Configure IKEv2/IPsec VPN connection
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="py-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="auth">Authentication</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Basic Settings */}
            <TabsContent value="basic" className="space-y-4 mt-4">
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
                    placeholder="e.g., Office IKEv2"
                    value={editConfig.config_name}
                    onChange={(e) => handleInput("config_name", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="server_address">Server Address</Label>
                  <Input
                    id="server_address"
                    placeholder="vpn.example.com or IP"
                    value={editConfig.server_address}
                    onChange={(e) =>
                      handleInput("server_address", e.target.value)
                    }
                  />
                </div>

                <Separator />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="local_id">Local ID (Optional)</Label>
                    <Input
                      id="local_id"
                      placeholder="client@example.com"
                      value={editConfig.local_id}
                      onChange={(e) => handleInput("local_id", e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="remote_id">Remote ID (Optional)</Label>
                    <Input
                      id="remote_id"
                      placeholder="server@example.com"
                      value={editConfig.remote_id}
                      onChange={(e) => handleInput("remote_id", e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="local_subnet">Local Subnet</Label>
                    <Input
                      id="local_subnet"
                      placeholder="0.0.0.0/0"
                      value={editConfig.local_subnet}
                      onChange={(e) =>
                        handleInput("local_subnet", e.target.value)
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="remote_subnet">Remote Subnet</Label>
                    <Input
                      id="remote_subnet"
                      placeholder="0.0.0.0/0"
                      value={editConfig.remote_subnet}
                      onChange={(e) =>
                        handleInput("remote_subnet", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Authentication */}
            <TabsContent value="auth" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Authentication Method</Label>
                  <Select
                    value={editConfig.auth_method}
                    onValueChange={(value) =>
                      handleInput(
                        "auth_method",
                        value as "psk" | "cert" | "eap"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="psk">Pre-Shared Key (PSK)</SelectItem>
                      <SelectItem value="eap">
                        Username/Password (EAP)
                      </SelectItem>
                      <SelectItem value="cert">Certificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* PSK Authentication */}
                {editConfig.auth_method === "psk" && (
                  <div className="space-y-4">
                    <Alert>
                      <Key className="h-4 w-4" />
                      <AlertDescription>
                        Pre-Shared Key authentication
                      </AlertDescription>
                    </Alert>

                    <div className="grid gap-2">
                      <Label htmlFor="psk">Pre-Shared Key</Label>
                      <Input
                        id="psk"
                        type="password"
                        placeholder="Enter shared secret"
                        value={editConfig.psk}
                        onChange={(e) => handleInput("psk", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* EAP Authentication */}
                {editConfig.auth_method === "eap" && (
                  <div className="space-y-4">
                    <Alert>
                      <Lock className="h-4 w-4" />
                      <AlertDescription>
                        Username/Password (EAP-MSCHAPv2)
                      </AlertDescription>
                    </Alert>

                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder="username"
                        value={editConfig.username}
                        onChange={(e) =>
                          handleInput("username", e.target.value)
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="password"
                        value={editConfig.password}
                        onChange={(e) =>
                          handleInput("password", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Certificate Authentication */}
                {editConfig.auth_method === "cert" && (
                  <div className="space-y-4">
                    <Alert>
                      <FileKey className="h-4 w-4" />
                      <AlertDescription>
                        Certificate-based authentication
                      </AlertDescription>
                    </Alert>

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
                      <Label htmlFor="client_certificate">
                        Client Certificate
                      </Label>
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
                        onChange={(e) =>
                          handleInput("client_key", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="space-y-4">
                <h3 className="font-semibold">Encryption Settings</h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ike_encryption">IKE Encryption</Label>
                    <Select
                      value={editConfig.ike_encryption}
                      onValueChange={(value) =>
                        handleInput("ike_encryption", value)
                      }
                    >
                      <SelectTrigger id="ike_encryption">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aes256">AES-256</SelectItem>
                        <SelectItem value="aes128">AES-128</SelectItem>
                        <SelectItem value="3des">3DES</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ike_integrity">IKE Integrity</Label>
                    <Select
                      value={editConfig.ike_integrity}
                      onValueChange={(value) =>
                        handleInput("ike_integrity", value)
                      }
                    >
                      <SelectTrigger id="ike_integrity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sha256">SHA256</SelectItem>
                        <SelectItem value="sha1">SHA1</SelectItem>
                        <SelectItem value="sha512">SHA512</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="esp_encryption">ESP Encryption</Label>
                    <Select
                      value={editConfig.esp_encryption}
                      onValueChange={(value) =>
                        handleInput("esp_encryption", value)
                      }
                    >
                      <SelectTrigger id="esp_encryption">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aes256">AES-256</SelectItem>
                        <SelectItem value="aes128">AES-128</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="esp_integrity">ESP Integrity</Label>
                    <Select
                      value={editConfig.esp_integrity}
                      onValueChange={(value) =>
                        handleInput("esp_integrity", value)
                      }
                    >
                      <SelectTrigger id="esp_integrity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sha256">SHA256</SelectItem>
                        <SelectItem value="sha1">SHA1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <h3 className="font-semibold">Dead Peer Detection (DPD)</h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dpd_interval">DPD Interval (seconds)</Label>
                    <Input
                      id="dpd_interval"
                      type="number"
                      value={editConfig.dpd_interval}
                      onChange={(e) =>
                        handleInput("dpd_interval", Number(e.target.value))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="dpd_timeout">DPD Timeout (seconds)</Label>
                    <Input
                      id="dpd_timeout"
                      type="number"
                      value={editConfig.dpd_timeout}
                      onChange={(e) =>
                        handleInput("dpd_timeout", Number(e.target.value))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>NAT Traversal</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable NAT-T for connections behind NAT
                    </p>
                  </div>
                  <Switch
                    checked={editConfig.nat_traversal}
                    onCheckedChange={(checked) =>
                      handleInput("nat_traversal", checked)
                    }
                  />
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
  config: IKEv2Config | null;
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

  const isConfigured = config.server_address;
  const isConnected = config.status === "connected";

  const getAuthMethodLabel = (method: string) => {
    switch (method) {
      case "psk":
        return "Pre-Shared Key";
      case "cert":
        return "Certificate";
      case "eap":
        return "Username/Password";
      default:
        return method;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{config.config_name}</CardTitle>
            <CardDescription>IKEv2/IPsec configuration</CardDescription>
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
              {config.warning || "Please configure IKEv2 settings"}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Globe className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Server Address</p>
              <p className="text-base font-mono">
                {config.server_address || "Not configured"}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Lock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Authentication</p>
                <p className="text-base">
                  {getAuthMethodLabel(config.auth_method)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
              <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Encryption</p>
                <p className="text-sm text-muted-foreground">
                  {config.ike_encryption?.toUpperCase()}/
                  {config.esp_encryption?.toUpperCase()}
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
            <Network className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Local Subnet</p>
              <p className="text-sm text-muted-foreground">
                {config.local_subnet || "0.0.0.0/0"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Network className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Remote Subnet</p>
              <p className="text-sm text-muted-foreground">
                {config.remote_subnet || "0.0.0.0/0"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <Settings className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">NAT Traversal</p>
              <p className="text-sm text-muted-foreground">
                {config.nat_traversal ? "Enabled" : "Disabled"}
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
