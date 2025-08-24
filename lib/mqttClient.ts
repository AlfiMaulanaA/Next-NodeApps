// lib/mqttClient.ts
import mqtt, { MqttClient } from "mqtt";
import { getAppConfig } from "@/lib/config";

let client: MqttClient | null = null;
let isConnecting: boolean = false;
let connectionState: "disconnected" | "connecting" | "connected" | "reconnecting" = "disconnected";
let lastLogTime = 0;
let reconnectAttempts = 0;
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

export function connectMQTT(): MqttClient {
  const { mqttBrokerUrl } = getAppConfig();

  if (!mqttBrokerUrl) {
    throw new Error("MQTT broker URL is missing from configuration.");
  }

  if (client && (client.connected || isConnecting)) {
    return client;
  }

  if (!client || client.disconnected) {
    if (isConnecting) {
      return client!;
    }

    isConnecting = true;
    connectionState = "connecting";
    
    // Only log initial connection attempt
    if (reconnectAttempts === 0) {
      console.log(`MQTT: Attempting connection to ${mqttBrokerUrl}...`);
    }

    client = mqtt.connect(mqttBrokerUrl, {
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 3000,
      keepalive: 60,
      reschedulePings: true,
      protocolVersion: 4,
      rejectUnauthorized: false
    });

    client.on("connect", () => {
      connectionState = "connected";
      isConnecting = false;
      reconnectAttempts = 0;
      console.log(`MQTT: Connected to ${mqttBrokerUrl}`);
    });

    client.on("error", (err) => {
      connectionState = "disconnected";
      isConnecting = false;
      
      // Only log errors if not too many reconnect attempts
      if (reconnectAttempts < maxReconnectAttempts) {
        throttledLog(`MQTT Error: ${err.message}`, "error");
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
        throttledLog(`MQTT: Max reconnection attempts reached. Stopping reconnection.`, "error");
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
  return client?.connected || false;
}

export function resetConnection(): void {
  reconnectAttempts = 0;
  connectionState = "disconnected";
  
  if (client) {
    client.end(true);
    client = null;
  }
  
  isConnecting = false;
  console.log("MQTT: Connection reset. Ready for new connection attempt.");
}

export function disconnectMQTT(): void {
  if (client && client.connected) {
    client.end(false, () => {
      console.log("MQTT: Client disconnected gracefully.");
      client = null;
      isConnecting = false;
      connectionState = "disconnected";
      reconnectAttempts = 0;
    });
  } else if (client) {
    client.end(true, () => {
      console.log("MQTT: Client forced disconnection.");
      client = null;
      isConnecting = false;
      connectionState = "disconnected";
      reconnectAttempts = 0;
    });
  }
}