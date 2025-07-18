// src/config/appConfig.ts

interface AppConfig {
  mqttBrokerUrl: string;
  apiBaseUrl: string;
}

export function getAppConfig(): AppConfig {
  let mqttBrokerUrl: string;
  let apiBaseUrl: string;

  const isProduction = process.env.NODE_ENV === "production";
  const currentBrowserProtocol = typeof window !== "undefined" ? window.location.protocol : '';

  if (isProduction) {
    if (currentBrowserProtocol === "https:") {
      // Production (HTTPS): Use environment variable for MQTT, assume API is also HTTPS
      mqttBrokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "wss://localhost:9000";
      apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://localhost:8000";
    } else if (typeof window !== "undefined") {
      // Production (HTTP, e.g., local test): Use hostname with ws
      mqttBrokerUrl = `ws://${window.location.hostname}:9000`;
      apiBaseUrl = `http://${window.location.hostname}:8000`;
    } else {
      // Production (SSR): Fallback to environment variables
      mqttBrokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "ws://localhost:9000";
      apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    }
  } else {
    // Development: Always use environment variables (or localhost fallbacks)
    mqttBrokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "ws://localhost:9000";
    apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  }

  // Ensure URLs are defined
  if (!mqttBrokerUrl) {
    throw new Error("MQTT broker URL is not defined.");
  }
  if (!apiBaseUrl) {
    throw new Error("API base URL is not defined.");
  }

  return { mqttBrokerUrl, apiBaseUrl };
}
