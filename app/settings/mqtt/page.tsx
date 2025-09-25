"use client";

import { useState, useEffect } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  PlusCircle,
  Edit2,
  Trash2,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Loader2,
  Settings,
  Activity,
  Play,
  Square,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface MQTTConfiguration {
  id: number;
  name: string;
  broker_url: string;
  broker_port: number;
  username?: string;
  password?: string;
  client_id?: string;
  keepalive: number;
  qos: 0 | 1 | 2;
  retain: boolean;
  clean_session: boolean;
  reconnect_period: number;
  connect_timeout: number;
  protocol: "mqtt" | "mqtts" | "ws" | "wss";
  is_active: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_connected?: string;
  connection_status: "connected" | "disconnected" | "connecting" | "error";
  error_message?: string;
}

const MQTTSettingsPage = () => {
  const [configurations, setConfigurations] = useState<MQTTConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MQTTConfiguration | null>(
    null
  );
  const [testingConnection, setTestingConnection] = useState<number | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] =
    useState<MQTTConfiguration | null>(null);
  const [checkingAllConnections, setCheckingAllConnections] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    broker_host: "",
    broker_port: 1883,
    username: "",
    password: "",
    client_id: "",
    keepalive: 60,
    qos: 0 as 0 | 1 | 2,
    retain: false,
    clean_session: true,
    reconnect_period: 3000,
    connect_timeout: 5000,
    protocol: "mqtt" as "mqtt" | "mqtts" | "ws" | "wss",
    is_active: false,
  });

  // Fetch configurations
  const fetchConfigurations = async () => {
    try {
      const response = await fetch("/api/mqtt/");
      const result = await response.json();

      if (result.success) {
        setConfigurations(result.data);
      } else {
        toast.error("Failed to fetch configurations");
      }
    } catch (error) {
      console.error("Error fetching configurations:", error);
      toast.error("Error fetching configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigurations();

    // Auto-check connection status every 30 seconds
    const interval = setInterval(async () => {
      if (!checkingAllConnections && !testingConnection) {
        try {
          const response = await fetch("/api/mqtt/check-status/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          const result = await response.json();
          if (result.success) {
            // Silently refresh configurations to update status
            fetchConfigurations();
          }
        } catch (error) {
          console.error("Auto connection check failed:", error);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [checkingAllConnections, testingConnection]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      broker_host: "",
      broker_port: 1883,
      username: "",
      password: "",
      client_id: "",
      keepalive: 60,
      qos: 0,
      retain: false,
      clean_session: true,
      reconnect_period: 3000,
      connect_timeout: 5000,
      protocol: "mqtt",
      is_active: false,
    });
    setEditingConfig(null);
  };

  // Open dialog for creating
  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  // Open dialog for editing
  const openEditDialog = (config: MQTTConfiguration) => {
    // Parse the existing broker_url to get host and protocol
    const { protocol, host, port } = parseBrokerUrl(config.broker_url || "");

    setFormData({
      name: config.name,
      broker_host: host,
      broker_port: port,
      username: config.username || "",
      password: config.password || "",
      client_id: config.client_id || "",
      keepalive: config.keepalive,
      qos: config.qos,
      retain: config.retain,
      clean_session: config.clean_session,
      reconnect_period: config.reconnect_period,
      connect_timeout: config.connect_timeout,
      protocol: protocol,
      is_active: config.is_active,
    });
    setEditingConfig(config);
    setDialogOpen(true);
  };

  // Handle form submission
  // Helper function to construct broker URL
  const constructBrokerUrl = (protocol: string, host: string, port: number) => {
    // For WebSocket protocols, add /mqtt path if not included in host
    if (protocol === "ws" || protocol === "wss") {
      const hasPath = host.includes("/");
      if (!hasPath) {
        return `${protocol}://${host}:${port}/mqtt`;
      }
    }
    return `${protocol}://${host}:${port}`;
  };

  // Helper function to parse broker URL back to components
  const parseBrokerUrl = (brokerUrl: string) => {
    try {
      const url = new URL(brokerUrl);
      return {
        protocol: url.protocol.slice(0, -1) as "mqtt" | "mqtts" | "ws" | "wss", // Remove the ':'
        host: url.hostname,
        port: parseInt(url.port) || 1883,
      };
    } catch {
      // Fallback for invalid URLs
      return {
        protocol: "mqtt" as "mqtt" | "mqtts" | "ws" | "wss",
        host: brokerUrl,
        port: 1883,
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingConfig ? "/api/mqtt/" : "/api/mqtt/";
      const method = editingConfig ? "PUT" : "POST";

      // Construct the broker URL from components
      const brokerUrl = constructBrokerUrl(
        formData.protocol,
        formData.broker_host,
        formData.broker_port
      );

      const payload = editingConfig
        ? { ...formData, broker_url: brokerUrl, id: editingConfig.id }
        : { ...formData, broker_url: brokerUrl };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        setDialogOpen(false);
        resetForm();
        fetchConfigurations();
      } else {
        toast.error(result.error || "Operation failed");
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error("Error saving configuration");
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (config: MQTTConfiguration) => {
    setConfigToDelete(config);
    setDeleteDialogOpen(true);
  };

  // Delete configuration
  const handleDelete = async () => {
    if (!configToDelete) return;

    try {
      const response = await fetch(`/api/mqtt/?id=${configToDelete.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        fetchConfigurations();
        setDeleteDialogOpen(false);
        setConfigToDelete(null);
      } else {
        toast.error(result.error || "Delete failed");
      }
    } catch (error) {
      console.error("Error deleting configuration:", error);
      toast.error("Error deleting configuration");
    }
  };

  // Set active configuration
  const handleSetActive = async (id: number) => {
    try {
      const response = await fetch("/api/mqtt/active/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          "Active configuration updated - MQTT connection will reload"
        );
        fetchConfigurations();

        // Auto-reload MQTT connection after changing active config
        setTimeout(async () => {
          try {
            // Import and reconnect MQTT client
            const { reconnectMQTT } = await import("@/lib/mqttClient");
            await reconnectMQTT();
            console.log(
              "MQTT connection reloaded with new active configuration"
            );
          } catch (error) {
            console.error("Failed to reload MQTT connection:", error);
          }
        }, 1000);
      } else {
        toast.error(result.error || "Failed to set active configuration");
      }
    } catch (error) {
      console.error("Error setting active configuration:", error);
      toast.error("Error setting active configuration");
    }
  };

  // Check all connections
  const handleCheckAllConnections = async () => {
    setCheckingAllConnections(true);

    try {
      const response = await fetch("/api/mqtt/check-status/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (result.success) {
        const connected = result.data.filter(
          (item: any) => item.status === "connected"
        ).length;
        const total = result.data.length;
        toast.success(
          `Connection check completed: ${connected}/${total} configurations connected`
        );

        // Refresh configurations to show updated status
        fetchConfigurations();
      } else {
        toast.error("Failed to check connections");
      }
    } catch (error) {
      console.error("Error checking all connections:", error);
      toast.error("Error checking connections");
    } finally {
      setCheckingAllConnections(false);
    }
  };

  // Test connection
  const handleTestConnection = async (id: number) => {
    setTestingConnection(id);

    try {
      const response = await fetch("/api/mqtt/test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Connection successful! Latency: ${result.latency}ms`);
      } else {
        toast.error(`Connection failed: ${result.message}`);
      }

      // Refresh configurations to get updated status
      fetchConfigurations();
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error("Error testing connection");
    } finally {
      setTestingConnection(null);
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "connecting":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get status badge
  const getStatusBadge = (config: MQTTConfiguration) => {
    const variant =
      config.connection_status === "connected"
        ? "success"
        : config.connection_status === "connecting"
        ? "secondary"
        : config.connection_status === "error"
        ? "destructive"
        : "outline";

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(config.connection_status)}
        {config.connection_status}
      </Badge>
    );
  };

  // Toggle enabled configuration
  const toggleEnabled = async (configId: number, currentEnabled: boolean) => {
    try {
      const response = await fetch("/api/mqtt/enable/", {
        method: currentEnabled ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: configId }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);

        // Check if MQTT connection mode is set to database
        const savedMode = localStorage.getItem("mqtt_connection_mode");
        if (savedMode === "database") {
          // Force MQTT client reconnection to pick up the new enabled configuration
          try {
            // Import reconnectMQTT dynamically to avoid SSR issues
            const { reconnectMQTT } = await import("@/lib/mqttClient");
            await reconnectMQTT();
            console.log("MQTT client reconnected to new enabled configuration");
          } catch (reconnectError) {
            console.warn("Failed to reconnect MQTT client:", reconnectError);
          }
        }

        // Refresh configurations to get updated status
        fetchConfigurations();
      } else {
        toast.error(`Failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Error toggling enabled status:", error);
      toast.error("Error updating configuration");
    }
  };

  if (loading) {
    return (
      <SidebarInset>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Settings className="h-5 w-5" />
        <h1 className="text-lg font-semibold">MQTT Configuration</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Configurations
              </CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{configurations.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {configurations.filter((c) => c.is_active).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Enabled for App
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {configurations.filter((c) => c.enabled).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected</CardTitle>
              <Wifi className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  configurations.filter(
                    (c) => c.connection_status === "connected"
                  ).length
                }
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  configurations.filter((c) => c.connection_status === "error")
                    .length
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configurations Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>MQTT Configurations</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCheckAllConnections}
                  disabled={checkingAllConnections}
                >
                  {checkingAllConnections ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Check All Connections
                </Button>
                <Button onClick={openCreateDialog}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Configuration
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Enabled for App</TableHead>
                  <TableHead>Last Connected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configurations.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell>
                      {parseBrokerUrl(config.broker_url).host}:
                      {config.broker_port}
                      <br />
                      <span className="text-sm text-muted-foreground">
                        {config.protocol.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(config)}</TableCell>
                    <TableCell>
                      {config.is_active && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={() =>
                            toggleEnabled(config.id, config.enabled)
                          }
                          aria-label={`Enable ${config.name} for application use`}
                        />
                        {config.enabled && (
                          <Badge variant="secondary" className="text-xs">
                            App Broker
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {config.last_connected
                        ? new Date(config.last_connected).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(config.id)}
                          disabled={testingConnection === config.id}
                        >
                          {testingConnection === config.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>

                        {!config.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetActive(config.id)}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(config)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(config)}
                          disabled={config.is_active}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Configuration Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingConfig
                  ? "Edit MQTT Configuration"
                  : "Add MQTT Configuration"}
              </DialogTitle>
              <DialogDescription>
                {editingConfig
                  ? "Modify the MQTT broker configuration settings below."
                  : "Configure a new MQTT broker connection. Fill in the required fields to establish a connection."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Configuration Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="protocol">Protocol</Label>
                  <Select
                    value={formData.protocol}
                    onValueChange={(value: "mqtt" | "mqtts" | "ws" | "wss") =>
                      setFormData((prev) => ({ ...prev, protocol: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mqtt">MQTT (TCP)</SelectItem>
                      <SelectItem value="mqtts">MQTTS (SSL/TLS)</SelectItem>
                      <SelectItem value="ws">WebSocket</SelectItem>
                      <SelectItem value="wss">WebSocket Secure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* WebSocket Protocol Information */}
              {(formData.protocol === "ws" || formData.protocol === "wss") && (
                <Alert>
                  <Wifi className="h-4 w-4" />
                  <AlertDescription>
                    <strong>WebSocket Mode:</strong> Perfect for AWS/Cloud MQTT!
                    <br />
                    <strong>Example AWS Config:</strong>
                    <br />• Host: <code>52.74.91.79</code> or{" "}
                    <code>mqttws.iotech.my.id</code>
                    <br />• Port: <code>8000</code> or <code>443</code> (for
                    wss)
                    <br />• The <code>/mqtt</code> path will be added
                    automatically
                  </AlertDescription>
                </Alert>
              )}

              {(formData.protocol === "mqtt" ||
                formData.protocol === "mqtts") && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> TCP MQTT may not work in web
                    browsers for remote servers.
                    <br />
                    For AWS/Cloud MQTT, use <strong>
                      WebSocket (ws/wss)
                    </strong>{" "}
                    instead.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="broker_host">Broker Host *</Label>
                  <Input
                    id="broker_host"
                    value={formData.broker_host}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        broker_host: e.target.value,
                      }))
                    }
                    placeholder="For AWS: mqttws.iotech.my.id or 52.74.91.79 or localhost"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="broker_port">Port *</Label>
                  <Input
                    id="broker_port"
                    type="number"
                    value={formData.broker_port}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        broker_port: parseInt(e.target.value),
                      }))
                    }
                    min="1"
                    max="65535"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="qos">QoS Level</Label>
                  <Select
                    value={formData.qos.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        qos: parseInt(value) as 0 | 1 | 2,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">QoS 0 (At most once)</SelectItem>
                      <SelectItem value="1">QoS 1 (At least once)</SelectItem>
                      <SelectItem value="2">QoS 2 (Exactly once)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="keepalive">Keep Alive (s)</Label>
                  <Input
                    id="keepalive"
                    type="number"
                    value={formData.keepalive}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        keepalive: parseInt(e.target.value),
                      }))
                    }
                    min="10"
                    max="65535"
                  />
                </div>

                <div>
                  <Label htmlFor="client_id">Client ID</Label>
                  <Input
                    id="client_id"
                    value={formData.client_id}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        client_id: e.target.value,
                      }))
                    }
                    placeholder="Auto-generated if empty"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="retain"
                    checked={formData.retain}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, retain: checked }))
                    }
                  />
                  <Label htmlFor="retain">Retain Messages</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="clean_session"
                    checked={formData.clean_session}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        clean_session: checked,
                      }))
                    }
                  />
                  <Label htmlFor="clean_session">Clean Session</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                  <Label htmlFor="is_active">Set as Active</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingConfig ? "Update" : "Create"} Configuration
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete MQTT Configuration</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the configuration "
                {configToDelete?.name}"?
                <br />
                <br />
                <strong>Broker:</strong> {configToDelete?.broker_url}
                <br />
                <strong>Protocol:</strong>{" "}
                {configToDelete?.protocol?.toUpperCase()}
                <br />
                <br />
                This action cannot be undone and will permanently remove this
                MQTT configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Configuration
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarInset>
  );
};

export default MQTTSettingsPage;
