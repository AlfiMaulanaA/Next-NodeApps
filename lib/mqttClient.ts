// lib/mqttClient.ts
import mqtt, { MqttClient } from "mqtt";
import { getAppConfig } from "@/lib/config";

let client: MqttClient | null = null;
let isConnecting: boolean = false;

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
    console.log(`MQTT: Attempting connection to ${mqttBrokerUrl}...`);

    client = mqtt.connect(mqttBrokerUrl, {
      clean: true,
      connectTimeout: 3000,
      reconnectPeriod: 1000,
    });

    client.on("connect", () => {
      console.log(`MQTT: Connected to ${mqttBrokerUrl}`);
      isConnecting = false;
    });

    client.on("error", (err) => {
      console.error(`MQTT Error: ${err.message}`);
      isConnecting = false;
    });

    client.on("reconnect", () => {
      console.log(`MQTT: Reconnecting to ${mqttBrokerUrl}`);
      isConnecting = true;
    });

    client.on("close", () => {
      console.log(`MQTT: Connection to ${mqttBrokerUrl} closed.`);
      isConnecting = false;
    });

    client.on("offline", () => {
      console.log(`MQTT: Client is offline.`);
      isConnecting = false;
    });
  }

  return client;
}

export function getMQTTClient(): MqttClient | null {
  return client;
}

export function disconnectMQTT(): void {
  if (client && client.connected) {
    client.end(false, () => {
      console.log("MQTT client disconnected.");
      client = null;
      isConnecting = false;
    });
  } else if (client) {
    client.end(true, () => {
      console.log("MQTT client forced end.");
      client = null;
      isConnecting = false;
    });
  }
}