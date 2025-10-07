// src/config/appConfig.ts

interface AppConfig {
  mqttBrokerUrl: string;
  apiBaseUrl: string;
}

// Legacy function for backward compatibility
// New code should use MQTTModeContext instead
export function getAppConfig(): AppConfig {
  let mqttBrokerUrl: string;
  let apiBaseUrl: string;

  // Check if we have a saved MQTT mode preference
  const savedMode = typeof window !== "undefined" ?
    localStorage.getItem("mqtt_connection_mode") : null;

  if (savedMode === "database") {
    // For legacy compatibility, return a placeholder URL
    // The actual URL will be resolved by MQTTModeContext
    mqttBrokerUrl = getEnvMQTTBrokerUrl(); // Use env fallback even in database mode
  } else {
    // ENV mode (default)
    mqttBrokerUrl = getEnvMQTTBrokerUrl();
  }

  // API URL logic remains the same
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://localhost:8000";
    } else if (typeof window !== "undefined") {
      apiBaseUrl = `http://${window.location.hostname}:8000`;
    } else {
      apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    }
  } else {
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

// Helper function to get MQTT URL from environment variables
export function getEnvMQTTBrokerUrl(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const isDevelopment = process.env.NODE_ENV === "development";

  let host: string;
  let port: string;
  let protocol: string;

  if (isDevelopment) {
    // Development: Use WebSocket connection to match Mosquitto config
    host = process.env.NEXT_PUBLIC_MQTT_BROKER_HOST || "localhost";
    port = process.env.NEXT_PUBLIC_MQTT_BROKER_PORT || "9000"; // Changed to 9000 for WebSocket
    protocol = "ws";
  } else if (isProduction) {
    // Production: Use window.location.hostname
    if (typeof window !== "undefined") {
      host = window.location.hostname;
      port = process.env.NEXT_PUBLIC_MQTT_BROKER_PORT || "9000"; // Changed to 9000 for WebSocket
      protocol = window.location.protocol === "https:" ? "wss" : "ws";
    } else {
      // Fallback for SSR
      host = process.env.NEXT_PUBLIC_MQTT_BROKER_HOST || "localhost";
      port = process.env.NEXT_PUBLIC_MQTT_BROKER_PORT || "9000"; // Changed to 9000 for WebSocket
      protocol = "ws";
    }
  } else {
    // Fallback
    host = process.env.NEXT_PUBLIC_MQTT_BROKER_HOST || "localhost";
    port = process.env.NEXT_PUBLIC_MQTT_BROKER_PORT || "9000"; // Changed to 9000 for WebSocket
    protocol = "ws";
  }

  return `${protocol}://${host}:${port}/mqtt`;
}
