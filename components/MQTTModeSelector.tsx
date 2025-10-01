"use client";

import { useState, useEffect } from "react";
import { useMQTTMode } from "@/contexts/MQTTModeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import Link from "next/link";
import {
  Settings,
  Database,
  FileCode,
  Wifi,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Server,
} from "lucide-react";

interface MQTTConfig {
  url: string;
  host: string;
  port: number;
  protocol: string;
}

export default function MQTTModeSelector() {
  const { mode, setMode, getMQTTConfig } = useMQTTMode();
  const [currentConfig, setCurrentConfig] = useState<MQTTConfig | null>(null);
  const [loading, setLoading] = useState(false);

  // Load current config when component mounts or mode changes
  useEffect(() => {
    loadCurrentConfig();
  }, [mode]);

  const loadCurrentConfig = async () => {
    setLoading(true);
    try {
      const config = await getMQTTConfig();
      setCurrentConfig(config);
    } catch (error) {
      console.error("Error loading MQTT config:", error);
      toast.error("Failed to load MQTT configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (newMode: "env" | "json" | "database") => {
    console.log(`Changing MQTT mode from ${mode} to ${newMode}`);

    // Update mode in context (this also saves to localStorage)
    setMode(newMode);

    // Show loading toast
    const toastId = toast.loading(
      `Switching to ${newMode.toUpperCase()} mode...`
    );

    // Force MQTT client reconnection to pick up the new mode
    try {
      // Import reconnectMQTT dynamically to avoid SSR issues
      const { reconnectMQTT } = await import("@/lib/mqttClient");

      console.log("Starting MQTT reconnection...");
      await reconnectMQTT();

      console.log("MQTT client successfully reconnected");
      toast.success(
        `MQTT connection mode changed to ${newMode.toUpperCase()}`,
        { id: toastId }
      );

      // Reload current config to show the updated configuration
      await loadCurrentConfig();
    } catch (reconnectError) {
      console.error("Failed to reconnect MQTT client:", reconnectError);
      toast.warning(
        `Mode changed to ${newMode.toUpperCase()}, but reconnection failed. Please refresh the page.`,
        { id: toastId }
      );
    }
  };

  const getEnvironmentInfo = () => {
    const isProduction = process.env.NODE_ENV === "production";
    const isDevelopment = process.env.NODE_ENV === "development";

    if (isDevelopment) {
      return {
        env: "Development",
        source: "ENV Variables",
        description: `Using NEXT_PUBLIC_MQTT_BROKER_HOST=${
          process.env.NEXT_PUBLIC_MQTT_BROKER_HOST || "192.168.0.193"
        }`,
      };
    } else if (isProduction) {
      return {
        env: "Production",
        source: "window.location.hostname",
        description:
          typeof window !== "undefined"
            ? `Using current hostname: ${window.location.hostname}`
            : "Using server-side hostname",
      };
    } else {
      return {
        env: "Unknown",
        source: "Fallback",
        description: "Using fallback configuration",
      };
    }
  };

  const envInfo = getEnvironmentInfo();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            MQTT Connection Mode
          </CardTitle>
          <div className="flex gap-2">
            <Link href="/settings/mqtt">
              <Button variant="outline" size="sm">
                <Database className="h-4 w-4 mr-2" />
                MQTT Settings
              </Button>
            </Link>
            <Link href="/network/mqtt">
              <Button variant="outline" size="sm">
                <Server className="h-4 w-4 mr-2" />
                Network Config
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <div>
          <Label className="text-base font-medium">Connection Mode</Label>
          <RadioGroup
            value={mode}
            onValueChange={handleModeChange}
            className="mt-3"
          >
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
              <RadioGroupItem value="env" id="env" />
              <div className="flex-1">
                <label
                  htmlFor="env"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">Environment Variables</span>
                  <Badge variant="outline" className="ml-auto">
                    {envInfo.env}
                  </Badge>
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  {envInfo.description}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
              <RadioGroupItem value="json" id="json" />
              <div className="flex-1">
                <label
                  htmlFor="json"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileCode className="h-4 w-4" />
                  <span className="font-medium">JSON Configuration</span>
                  <Badge variant="outline" className="ml-auto">
                    Via MQTT
                  </Badge>
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  Use MQTT configuration from JSON file at{" "}
                  <code>
                    middleware/CONFIG_SYSTEM_DEVICE/JSON/mqttConfig.json
                  </code>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors">
              <RadioGroupItem value="database" id="database" />
              <div className="flex-1">
                <label
                  htmlFor="database"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Database className="h-4 w-4" />
                  <span className="font-medium">Database Configuration</span>
                  <Badge variant="outline" className="ml-auto">
                    Via MQTT
                  </Badge>
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  Use MQTT configuration from database settings
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Current Configuration Display */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-medium">
              Current Configuration
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={loadCurrentConfig}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          {currentConfig ? (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-medium">Active Configuration</span>
                <Badge variant="secondary">{mode.toUpperCase()}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Protocol:</span>
                  <p className="font-medium">
                    {currentConfig.protocol.toUpperCase()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Host:</span>
                  <p className="font-medium">{currentConfig.host}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Port:</span>
                  <p className="font-medium">{currentConfig.port}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Full URL:</span>
                  <p className="font-medium text-xs break-all">
                    {currentConfig.url}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {loading
                  ? "Loading configuration..."
                  : "Failed to load configuration"}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Mode Info */}
        {mode === "database" && (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong>Database Mode Active:</strong> Using active MQTT
                configuration from database. You can manage configurations in{" "}
                <strong>Settings → MQTT Configuration</strong>.
              </div>
              <Link href="/settings/mqtt">
                <Button variant="outline" size="sm" className="ml-4">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Configs
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
