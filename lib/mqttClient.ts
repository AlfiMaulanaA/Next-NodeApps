// lib/mqttClient.ts
import mqtt, { MqttClient } from "mqtt";
import { getAppConfig } from "@/lib/config";

let client: MqttClient | null = null;
let isConnecting: boolean = false;
let connectionState: "disconnected" | "connecting" | "connected" | "reconnecting" = "disconnected";
let lastLogTime = 0;
let reconnectAttempts = 0;
let currentBrokerUrl: string | null = null;
let connectionFailures = 0;
let lastConnectionMode: string | null = null;
let connectionPromise: Promise<MqttClient> | null = null; // Prevent multiple simultaneous connections
const maxReconnectAttempts = 10;
const maxConnectionFailures = 3; // Force fallback after 3 failures
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

// Function to get MQTT config based on mode with validation
async function getMQTTConfigUrl(): Promise<string> {
  const savedMode = typeof window !== "undefined" ?
    localStorage.getItem("mqtt_connection_mode") : null;

  console.log(`MQTT Mode: ${savedMode || "default (env)"}`);

  if (savedMode === "database") {
    try {
      const response = await fetch("/api/mqtt/?enabled=true");
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const brokerUrl = result.data[0].broker_url;
        console.log(`Database config found: ${brokerUrl}`);

        // Validate the URL format
        if (isValidMQTTUrl(brokerUrl)) {
          // If it's a WebSocket URL, convert it to TCP for reliability
          if (brokerUrl.startsWith('ws://') || brokerUrl.startsWith('wss://')) {
            const tcpUrl = convertWebSocketToTCP(brokerUrl);
            console.log(`🔄 Converted database WebSocket URL to TCP: ${tcpUrl}`);
            return tcpUrl;
          } else {
            console.log(`Using validated database configuration: ${brokerUrl}`);
            return brokerUrl;
          }
        } else {
          console.warn(`Invalid database MQTT URL: ${brokerUrl}, falling back to ENV`);
          const envUrl = getAppConfig().mqttBrokerUrl;
          console.log(`Using ENV fallback: ${envUrl}`);
          return envUrl;
        }
      } else {
        console.warn("No enabled MQTT configuration found in database, using ENV");
        const envUrl = getAppConfig().mqttBrokerUrl;
        console.log(`Using ENV configuration: ${envUrl}`);
        return envUrl;
      }
    } catch (error) {
      console.error("Error fetching MQTT config from database:", error);
      console.log("Falling back to ENV configuration due to database error");
      const envUrl = getAppConfig().mqttBrokerUrl;
      console.log(`Using ENV fallback: ${envUrl}`);
      return envUrl;
    }
  } else {
    // ENV mode (default)
    const envUrl = getAppConfig().mqttBrokerUrl;
    console.log(`Using ENV configuration: ${envUrl}`);
    return envUrl;
  }
}

// Function to validate MQTT URL format and convert if needed
function isValidMQTTUrl(url: string): boolean {
  try {
    // Check if URL is properly formatted
    if (!url || typeof url !== 'string') {
      console.warn("MQTT URL is empty or not a string");
      return false;
    }

    // Basic URL validation
    const urlPattern = /^(mqtt|ws|tcp):\/\/[^\s/$.?#].[^\s]*$/i;
    const isValidFormat = urlPattern.test(url);

    if (!isValidFormat) {
      console.warn(`Invalid MQTT URL format: ${url}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validating MQTT URL:", error);
    return false;
  }
}

// Function to convert WebSocket URL to TCP URL for fallback
function convertWebSocketToTCP(wsUrl: string): string {
  try {
    // Convert ws://localhost:9000/mqtt to tcp://localhost:9000
    // Keep the same port, just change protocol from ws to tcp
    if (wsUrl.startsWith('ws://')) {
      // Extract host and port from WebSocket URL
      const urlParts = wsUrl.replace('ws://', '').split('/')[0].split(':');
      const host = urlParts[0] || 'localhost';
      const port = urlParts[1] || '1883'; // Default MQTT port if not specified

      // Use tcp:// protocol to force TCP transport, keep original port
      const tcpUrl = `tcp://${host}:${port}`;
      console.log(`🔄 Converting WebSocket URL ${wsUrl} to TCP URL ${tcpUrl}`);
      return tcpUrl;
    }
    return wsUrl;
  } catch (error) {
    console.error("Error converting WebSocket URL to TCP:", error);
    return wsUrl;
  }
}

// Function to try multiple connection methods
async function tryMultipleConnections(): Promise<string> {
  const connectionAttempts = [
    "tcp://localhost:9000",    // TCP ke port 9000
    "tcp://localhost:1883",    // TCP ke port 1883 (default)
    "ws://localhost:9000/mqtt", // WebSocket ke port 9000
    "ws://localhost:1883/mqtt", // WebSocket ke port 1883
    "mqtt://localhost:1883",    // MQTT protocol default
  ];

  for (const url of connectionAttempts) {
    console.log(`🔄 Trying connection to: ${url}`);
    // You could implement actual connection test here
    // For now, we'll return the first option and let MQTT.js handle the fallback
  }

  return "tcp://localhost:1883"; // Fallback to most common setup
}

export async function connectMQTTAsync(): Promise<MqttClient> {
  // Return existing connected client
  if (client && client.connected) {
    console.log("MQTT: Already connected, returning existing client");
    return client;
  }

  // If already connecting, wait for existing connection promise
  if (isConnecting && connectionPromise) {
    console.log("MQTT: Connection already in progress, waiting for existing connection...");
    try {
      return await connectionPromise;
    } catch (error) {
      console.log("MQTT: Existing connection failed, starting new connection");
      // Continue with new connection attempt
    }
  }

  // If connection exists but not connected, reset it
  if (client && !client.connected) {
    console.log("MQTT: Existing client not connected, resetting...");
    client.end(true);
    client = null;
  }

  // Create connection promise to prevent multiple simultaneous connections
  connectionPromise = (async () => {
    try {
      const mqttBrokerUrl = await getMQTTConfigUrl();

      if (!mqttBrokerUrl) {
        throw new Error("MQTT broker URL is missing from configuration.");
      }

      // Check if we need to reconnect due to URL change
      if (currentBrokerUrl && currentBrokerUrl !== mqttBrokerUrl) {
        console.log(`MQTT: Broker URL changed, reconnecting...`);
        if (client) {
          client.end(true);
          client = null;
        }
      }

      currentBrokerUrl = mqttBrokerUrl;
      isConnecting = true;
      connectionState = "connecting";

      console.log(`MQTT: Connecting to ${mqttBrokerUrl}...`);

      const clientId = `nextjs-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      const connectionOptions = {
        clean: true,
        connectTimeout: 10000, // Increased timeout
        reconnectPeriod: 5000, // Slower reconnection to reduce spam
        keepalive: 60,
        reschedulePings: true,
        protocolVersion: 4 as const,
        rejectUnauthorized: false,
        clientId: clientId,
      };

      client = mqtt.connect(mqttBrokerUrl, connectionOptions);

      return new Promise<MqttClient>((resolve, reject) => {
        const timeout = setTimeout(() => {
          isConnecting = false;
          connectionState = "disconnected";
          connectionPromise = null;
          reject(new Error("Connection timeout"));
        }, 15000); // Increased timeout

        client!.on("connect", async () => {
          clearTimeout(timeout);
          connectionState = "connected";
          isConnecting = false;
          connectionPromise = null;
          reconnectAttempts = 0;
          connectionFailures = 0; // Reset failure counter on successful connection
          console.log(`✅ MQTT: Successfully connected to ${mqttBrokerUrl}`);

          await updateMQTTStatus({
            is_connected: true,
            connection_state: "connected",
            broker_url: mqttBrokerUrl,
            mode: typeof window !== "undefined" ? localStorage.getItem("mqtt_connection_mode") || "env" : "env"
          });

          resolve(client!);
        });

        client!.on("error", async (err) => {
          clearTimeout(timeout);
          connectionState = "disconnected";
          isConnecting = false;
          connectionPromise = null;

          console.error(`❌ MQTT: Connection error to ${mqttBrokerUrl}: ${err.message}`);

          await updateMQTTStatus({
            is_connected: false,
            connection_state: "error",
            broker_url: mqttBrokerUrl,
            mode: typeof window !== "undefined" ? localStorage.getItem("mqtt_connection_mode") || "env" : "env"
          });

          reject(err);
        });

        client!.on("reconnect", () => {
          reconnectAttempts++;
          if (reconnectAttempts <= maxReconnectAttempts) {
            connectionState = "reconnecting";
            throttledLog(`MQTT: Reconnecting... (attempt ${reconnectAttempts})`);
          } else {
            client?.end(true);
            throttledLog(`MQTT: Max reconnection attempts reached.`, "error");
          }
        });

        client!.on("close", async () => {
          connectionState = "disconnected";
          isConnecting = false;
          connectionPromise = null;
          throttledLog(`MQTT: Connection closed`);

          await updateMQTTStatus({
            is_connected: false,
            connection_state: "disconnected",
            broker_url: mqttBrokerUrl,
            mode: typeof window !== "undefined" ? localStorage.getItem("mqtt_connection_mode") || "env" : "env"
          });
        });

        client!.on("offline", () => {
          connectionState = "disconnected";
          throttledLog(`MQTT: Client offline`);
        });
      });

    } catch (error) {
      console.error("MQTT: Connection setup failed:", error);
      connectionState = "disconnected";
      isConnecting = false;
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

export function getMQTTClient(): MqttClient | null {
  if (typeof window !== "undefined") {
    (window as any).mqttClient = client;
  }
  return client;
}

export function getConnectionState(): string {
  return connectionState;
}

export function isClientConnected(): boolean {
  return client?.connected || false;
}

export function resetConnection(): void {
  reconnectAttempts = 0;
  connectionFailures = 0; // Reset failure counter
  connectionState = "disconnected";

  if (client) {
    client.end(true);
    client = null;
  }

  isConnecting = false;
  console.log("MQTT: Connection reset");
}

export function disconnectMQTT(): void {
  if (client) {
    client.end(true, () => {
      console.log("MQTT: Client disconnected");
      client = null;
      isConnecting = false;
      connectionState = "disconnected";
      reconnectAttempts = 0;
    });
  }
}

export function connectMQTT(): MqttClient {
  if (client) {
    return client;
  }

  const { mqttBrokerUrl } = getAppConfig();
  client = mqtt.connect(mqttBrokerUrl, {
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
    keepalive: 60,
  });

  return client;
}

export async function reconnectMQTT(): Promise<MqttClient> {
  console.log("MQTT: Forcing reconnection...");

  if (client) {
    client.end(true);
    client = null;
  }

  isConnecting = false;
  connectionState = "disconnected";
  reconnectAttempts = 0;
  currentBrokerUrl = null;

  await new Promise(resolve => setTimeout(resolve, 100));

  return await connectMQTTAsync();
}
