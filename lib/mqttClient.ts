// lib/mqttClient.ts
import mqtt, { MqttClient } from "mqtt";
import { getAppConfig } from "@/lib/config";

let client: MqttClient | null = null;
let isConnecting: boolean = false;
let connectionState:
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting" = "disconnected";
let lastLogTime = 0;
let reconnectAttempts = 0;
let currentBrokerUrl: string | null = null;
const maxReconnectAttempts = 10;
const logThrottleMs = 5000; // Only log similar messages every 5 seconds

// Throttled logging to reduce spam
function throttledLog(message: string, type: "log" | "error" = "log") {
  const now = Date.now();
  if (now - lastLogTime > logThrottleMs) {
    if (type === "error") {
      console.error(message);
    } else {
      console.log(message);
    }
    lastLogTime = now;
  }
}

// Function to update MQTT status on server
async function updateMQTTStatus(status: {
  is_connected: boolean;
  connection_state: string;
  broker_url: string;
  mode: string;
}) {
  try {
    await fetch("/api/mqtt/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(status),
    });
  } catch (error) {
    console.warn("Failed to update server-side MQTT status:", error);
  }
}

// Function to get MQTT config based on mode
async function getMQTTConfigUrl(): Promise<string> {
  const savedMode =
    typeof window !== "undefined"
      ? localStorage.getItem("mqtt_connection_mode")
      : null;

  if (savedMode === "database") {
    try {
      // First try to get enabled configuration
      const response = await fetch("/api/mqtt/?enabled=true");
      const result = await response.json();

      if (result.success && result.data.length > 0) {
        return result.data[0].broker_url;
      } else {
        // If no enabled config, fall back to active config
        const activeResponse = await fetch("/api/mqtt/?active=true");
        const activeResult = await activeResponse.json();

        if (activeResult.success && activeResult.data.length > 0) {
          return activeResult.data[0].broker_url;
        } else {
          // Fallback on error or no config found
          return getAppConfig().mqttBrokerUrl;
        }
      }
    } catch (error) {
      // Fallback on error
      return getAppConfig().mqttBrokerUrl;
    }
  } else {
    // ENV mode (default)
    return getAppConfig().mqttBrokerUrl;
  }
}

export async function connectMQTTAsync(): Promise<MqttClient> {
  const mqttBrokerUrl = await getMQTTConfigUrl();

  if (!mqttBrokerUrl) {
    throw new Error("MQTT broker URL is missing from configuration.");
  }

  // Check if we need to reconnect due to URL change
  if (currentBrokerUrl && currentBrokerUrl !== mqttBrokerUrl) {
    if (client) {
      client.end(true);
      client = null;
      isConnecting = false;
      connectionState = "disconnected";
      reconnectAttempts = 0;
    }
  }

  currentBrokerUrl = mqttBrokerUrl;

  if (client && (client.connected || isConnecting)) {
    return client;
  }

  if (!client || client.disconnected) {
    if (isConnecting) {
      return client!;
    }

    isConnecting = true;
    connectionState = "connecting";

    // Generate dynamic client ID
    const clientId = `client-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}`;

    const connectionOptions = {
      clean: true,
      connectTimeout: 3000, // Reduced from 5000 to 3000ms
      reconnectPeriod: 3000,
      keepalive: 60,
      reschedulePings: true,
      protocolVersion: 4 as const,
      rejectUnauthorized: false,
      clientId: clientId,
    };

    // For WebSocket connections, use URL as provided
    let finalUrl = mqttBrokerUrl;
    console.log(`MQTT: Using broker URL as configured: ${finalUrl}`);

    client = mqtt.connect(finalUrl, connectionOptions);

    client.on("connect", async () => {
      connectionState = "connected";
      isConnecting = false;
      reconnectAttempts = 0;

      // Update server-side status
      await updateMQTTStatus({
        is_connected: true,
        connection_state: "connected",
        broker_url: mqttBrokerUrl,
        mode:
          typeof window !== "undefined"
            ? localStorage.getItem("mqtt_connection_mode") || "env"
            : "env",
      });

      // Update database status if connected to database configuration
      try {
        const savedMode =
          typeof window !== "undefined"
            ? localStorage.getItem("mqtt_connection_mode")
            : null;

        if (savedMode === "database") {
          // Find and update the enabled configuration status
          const response = await fetch("/api/mqtt/?enabled=true");
          const result = await response.json();

          if (result.success && result.data.length > 0) {
            const enabledConfig = result.data[0];

            // Update connection status
            await fetch(`/api/mqtt/${enabledConfig.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                connection_status: "connected",
                last_connected: new Date().toISOString(),
                error_message: undefined,
              }),
            });
          }
        }
      } catch (error) {
        console.warn("Failed to update database connection status:", error);
      }
    });

    client.on("error", async (err) => {
      connectionState = "disconnected";
      isConnecting = false;

      // Only log errors if not too many reconnect attempts
      if (reconnectAttempts < maxReconnectAttempts) {
        throttledLog(`MQTT Error: ${err.message}`, "error");
      }

      // Update server-side status
      await updateMQTTStatus({
        is_connected: false,
        connection_state: "error",
        broker_url: mqttBrokerUrl,
        mode:
          typeof window !== "undefined"
            ? localStorage.getItem("mqtt_connection_mode") || "env"
            : "env",
      });

      // Update database status if connected to database configuration
      try {
        const savedMode =
          typeof window !== "undefined"
            ? localStorage.getItem("mqtt_connection_mode")
            : null;

        if (savedMode === "database") {
          const response = await fetch("/api/mqtt/?enabled=true");
          const result = await response.json();

          if (result.success && result.data.length > 0) {
            const enabledConfig = result.data[0];

            await fetch(`/api/mqtt/${enabledConfig.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                connection_status: "error",
                error_message: err.message,
              }),
            });
          }
        }
      } catch (error) {
        console.warn("Failed to update database error status:", error);
      }

      // If this is a connection error and we have fallback options, try them
      if (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("Failed to fetch")
      ) {
        console.warn(
          `MQTT: Connection to ${mqttBrokerUrl} failed, broker might be unavailable`
        );
      }
    });

    client.on("reconnect", () => {
      reconnectAttempts++;

      if (reconnectAttempts <= maxReconnectAttempts) {
        connectionState = "reconnecting";
        isConnecting = true;

        // Throttled reconnection logging
        throttledLog(`MQTT: Reconnecting... (attempt ${reconnectAttempts})`);
      } else {
        // Stop trying after max attempts
        client?.end(true);
        throttledLog(
          `MQTT: Max reconnection attempts reached. Stopping reconnection.`,
          "error"
        );
      }
    });

    client.on("close", async () => {
      connectionState = "disconnected";
      isConnecting = false;

      // Only log close events during initial connection or every few attempts
      if (reconnectAttempts === 0 || reconnectAttempts % 5 === 0) {
        throttledLog(`MQTT: Connection closed`);
      }

      // Update server-side status
      await updateMQTTStatus({
        is_connected: false,
        connection_state: "disconnected",
        broker_url: mqttBrokerUrl,
        mode:
          typeof window !== "undefined"
            ? localStorage.getItem("mqtt_connection_mode") || "env"
            : "env",
      });
    });

    client.on("offline", () => {
      connectionState = "disconnected";
      isConnecting = false;

      // Throttled offline logging
      throttledLog(`MQTT: Client offline`);
    });
  }

  return client;
}

export function getMQTTClient(): MqttClient | null {
  return client;
}

export function getConnectionState(): string {
  return connectionState;
}

export function isClientConnected(): boolean {
  const connected = client?.connected || false;
  return connected;
}

export function resetConnection(): void {
  reconnectAttempts = 0;
  connectionState = "disconnected";

  if (client) {
    client.end(true);
    client = null;
  }

  isConnecting = false;
}

export function disconnectMQTT(): void {
  if (client && client.connected) {
    client.end(false, () => {
      client = null;
      isConnecting = false;
      connectionState = "disconnected";
      reconnectAttempts = 0;
    });
  } else if (client) {
    client.end(true, () => {
      client = null;
      isConnecting = false;
      connectionState = "disconnected";
      reconnectAttempts = 0;
    });
  }
}

// Backward compatible wrapper - returns the client without waiting
export function connectMQTT(): MqttClient {
  // For existing code that expects synchronous behavior
  // We'll start the async connection but return immediately with a placeholder
  connectMQTTAsync().catch(console.error);

  // Return existing client or create placeholder
  if (client) {
    return client;
  }

  // Create a temporary client with fallback URL for immediate return
  const { mqttBrokerUrl } = getAppConfig();
  return mqtt.connect(mqttBrokerUrl, {
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
    keepalive: 60,
  });
}

// Function to force reconnection when mode changes
export async function reconnectMQTT(): Promise<MqttClient> {
  // Force disconnect from current broker
  if (client) {
    client.end(true);
    client = null;
  }

  // Reset all connection state
  isConnecting = false;
  connectionState = "disconnected";
  reconnectAttempts = 0;
  currentBrokerUrl = null; // Force URL re-evaluation

  // Wait a bit to ensure clean disconnect
  await new Promise((resolve) => setTimeout(resolve, 100));

  return await connectMQTTAsync();
}
