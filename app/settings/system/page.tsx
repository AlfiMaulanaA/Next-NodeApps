"use client";

import { useState, useEffect } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Activity,
  Database,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  Zap,
  Clock,
  HardDrive,
  Loader2,
} from "lucide-react";
import MQTTModeSelector from "@/components/MQTTModeSelector";
import { MQTTModeProvider, useMQTTMode } from "@/contexts/MQTTModeContext";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  response_time: number;
  services: {
    database: {
      status: "healthy" | "degraded" | "unhealthy" | "unknown";
      response_time: number;
      tables: Array<{ name: string; count: number }>;
      error: string | null;
    };
    mqtt: {
      status: "healthy" | "degraded" | "unhealthy" | "unknown";
      connection_state: string;
      is_connected: boolean;
      active_config: {
        id: number;
        name: string;
        broker_url: string;
        connection_status: string;
      } | null;
      error: string | null;
    };
  };
  error?: string;
}

const SystemHealthPage = () => {
  const { mode, getMQTTConfig } = useMQTTMode();
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingDatabase, setTestingDatabase] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentMQTTConfig, setCurrentMQTTConfig] = useState<{url: string; host: string; port: number; protocol: string} | null>(null);

  // Fetch current MQTT config based on mode
  const fetchMQTTConfig = async () => {
    try {
      const config = await getMQTTConfig();
      setCurrentMQTTConfig(config);
    } catch (error) {
      console.error("Error fetching MQTT config:", error);
      setCurrentMQTTConfig(null);
    }
  };

  // Fetch health status
  const fetchHealthStatus = async () => {
    try {
      const response = await fetch("/api/health/", {
        method: "GET",
        redirect: "error", // Prevent following redirects
        cache: "no-cache",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-MQTT-Mode": mode, // Pass the current MQTT mode to the API
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setHealthStatus(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching health status:", error);
      toast.error("Failed to fetch system health status");
    } finally {
      setLoading(false);
    }
  };

  // Test database connection
  const testDatabaseConnection = async (testType: string) => {
    setTestingDatabase(true);
    try {
      const response = await fetch("/api/health/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        redirect: "error", // Prevent following redirects
        cache: "no-cache",
        body: JSON.stringify({ test_type: testType }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${result.message} (${result.response_time}ms)`);
      } else {
        toast.error(result.message);
      }

      // Refresh health status
      await fetchHealthStatus();
    } catch (error) {
      console.error("Error testing database:", error);
      toast.error("Database test failed");
    } finally {
      setTestingDatabase(false);
    }
  };

  useEffect(() => {
    fetchMQTTConfig();
    fetchHealthStatus();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMQTTConfig();
      fetchHealthStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [mode, getMQTTConfig]);

  // Get status icon and color
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "healthy":
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      case "degraded":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
        };
      case "unhealthy":
        return {
          icon: <XCircle className="w-5 h-5 text-red-500" />,
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
        };
      default:
        return {
          icon: <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
        };
    }
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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

  if (!healthStatus) {
    return (
      <SidebarInset>
        <div className="flex items-center justify-center h-64">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="ml-2 text-red-600">
            Failed to load system health status
          </p>
        </div>
      </SidebarInset>
    );
  }

  const overallStatus = getStatusInfo(healthStatus.status);
  const dbStatus = getStatusInfo(healthStatus.services.database.status);
  const mqttStatus = getStatusInfo(healthStatus.services.mqtt.status);

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Activity className="h-5 w-5" />
        <h1 className="text-lg font-semibold">System Health</h1>
        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealthStatus}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Overall System Status */}
        <Card
          className={`${overallStatus.bgColor} ${overallStatus.borderColor} border-2`}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {overallStatus.icon}
                <div>
                  <CardTitle className="text-xl">System Status</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Overall system health: {healthStatus.status.toUpperCase()}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={overallStatus.color}>
                {healthStatus.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Uptime</p>
                  <p className="text-lg font-bold">
                    {formatUptime(healthStatus.uptime)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Response Time</p>
                  <p className="text-lg font-bold">
                    {healthStatus.response_time}ms
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Check</p>
                  <p className="text-sm">
                    {new Date(healthStatus.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Database Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5" />
                  <div>
                    <CardTitle>Database</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      SQLite Connection
                    </p>
                  </div>
                </div>
                {dbStatus.icon}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge
                  variant={
                    healthStatus.services.database.status === "healthy"
                      ? "default"
                      : "destructive"
                  }
                >
                  {healthStatus.services.database.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Response Time</span>
                <span className="text-sm">
                  {healthStatus.services.database.response_time}ms
                </span>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Tables</span>
                <div className="space-y-1">
                  {healthStatus.services.database.tables.map((table, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{table.name}</span>
                      <Badge variant="outline">{table.count} records</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {healthStatus.services.database.error && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {healthStatus.services.database.error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testDatabaseConnection("basic")}
                  disabled={testingDatabase}
                >
                  {testingDatabase ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4 mr-2" />
                  )}
                  Test Connection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testDatabaseConnection("stats")}
                  disabled={testingDatabase}
                >
                  Test Queries
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* MQTT Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {healthStatus.services.mqtt.is_connected ? (
                    <Wifi className="w-5 h-5 text-green-500" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <CardTitle>MQTT Broker</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Connection Mode: {mode.toUpperCase()}
                    </p>
                  </div>
                </div>
                {mqttStatus.icon}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge
                  variant={
                    healthStatus.services.mqtt.is_connected
                      ? "default"
                      : "destructive"
                  }
                >
                  {healthStatus.services.mqtt.connection_state}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Connected</span>
                <Badge
                  variant={
                    healthStatus.services.mqtt.is_connected
                      ? "default"
                      : "secondary"
                  }
                >
                  {healthStatus.services.mqtt.is_connected ? "Yes" : "No"}
                </Badge>
              </div>

              {/* Current MQTT Configuration based on selected mode */}
              {currentMQTTConfig && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    Current Configuration
                  </span>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Mode:</span>
                      <span className="font-medium">
                        {mode === "env" ? "Environment Variables" : "Database Configuration"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Protocol:</span>
                      <span className="font-medium">
                        {currentMQTTConfig.protocol.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Host:</span>
                      <span className="font-medium">
                        {currentMQTTConfig.host}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Port:</span>
                      <span className="font-medium">
                        {currentMQTTConfig.port}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Broker URL:</span>
                      <span className="font-medium text-xs break-all">
                        {currentMQTTConfig.url}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback to health API data if currentMQTTConfig is not available */}
              {!currentMQTTConfig && healthStatus.services.mqtt.active_config && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    Active Configuration
                  </span>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <span className="font-medium">
                        {healthStatus.services.mqtt.active_config.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Broker:</span>
                      <span className="font-medium">
                        {healthStatus.services.mqtt.active_config.broker_url}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {healthStatus.services.mqtt.error && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {healthStatus.services.mqtt.error}
                  </AlertDescription>
                </Alert>
              )}

              {!healthStatus.services.mqtt.active_config && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    No active MQTT configuration found. Please configure and
                    activate an MQTT connection.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              System Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Database className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">
                  {healthStatus.services.database.tables.reduce(
                    (sum, table) => sum + table.count,
                    0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Records
                </div>
              </div>

              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Server className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">
                  {healthStatus.services.database.tables.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Database Tables
                </div>
              </div>

              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Wifi className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">
                  {healthStatus.services.mqtt.active_config ? "1" : "0"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active MQTT Configs
                </div>
              </div>

              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Activity className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">
                  {Math.round(healthStatus.response_time)}ms
                </div>
                <div className="text-sm text-muted-foreground">
                  Avg Response Time
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MQTT Connection Mode Selector */}
        <MQTTModeSelector />

        {/* Error Display */}
        {healthStatus.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>System Error:</strong> {healthStatus.error}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </SidebarInset>
  );
};

const SystemHealthPageWithProvider = () => (
  <MQTTModeProvider>
    <SystemHealthPage />
  </MQTTModeProvider>
);

export default SystemHealthPageWithProvider;
