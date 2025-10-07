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

// MQTT status management disabled - no server-side state tracking

// Function to get MQTT config (simplified - only use environment config)
function getMQTTConfigUrl(): string {
  return getAppConfig().mqttBrokerUrl;
}

// Now the function needs to be synchronous since getMQTTConfigUrl is no longer async
export function connectMQTTAsync(): MqttClient {
  const mqttBrokerUrl = getMQTTConfigUrl();

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

    client.on("connect", () => {
      connectionState = "connected";
      isConnecting = false;
      reconnectAttempts = 0;
      throttledLog(`MQTT: Connected to broker`);
    });

    client.on("error", (err) => {
      connectionState = "disconnected";
      isConnecting = false;

      // Only log errors if not too many reconnect attempts
      if (reconnectAttempts < maxReconnectAttempts) {
        throttledLog(`MQTT Error: ${err.message}`, "error");
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

    client.on("close", () => {
      connectionState = "disconnected";
      isConnecting = false;

      // Only log close events during initial connection or every few attempts
      if (reconnectAttempts === 0 || reconnectAttempts % 5 === 0) {
        throttledLog(`MQTT: Connection closed`);
      }
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
  // Return existing client or create new one
  if (client) {
    return client;
  }

  // Create temporary client with fallback URL for immediate return
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

  return connectMQTTAsync();
}
