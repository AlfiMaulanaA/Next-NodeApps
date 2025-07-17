// config/appConfig.ts
interface AppConfig {
  mqttBrokerUrl: string;
  apiBaseUrl: string;
}

export function getAppConfig(): AppConfig {
  let mqttBrokerUrl: string;
  let apiBaseUrl: string;

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // Di produksi, gunakan window.location.hostname dengan port 9000
    if (typeof window !== "undefined") {
      mqttBrokerUrl = `ws://${window.location.hostname}:9000`;
      apiBaseUrl = `http://${window.location.hostname}:8000`;
    } else {
      mqttBrokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "ws://localhost:9000";
      apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    }
  } else {
    // Development environment: Gunakan langsung dari .env
    mqttBrokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "ws://localhost:9000";

    // Untuk API Base URL (dari .env)
    apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  }

  // Pastikan URL tidak kosong
  if (!mqttBrokerUrl) {
    throw new Error("MQTT broker URL is not defined in any environment or fallback.");
  }
  if (!apiBaseUrl) {
    throw new Error("API base URL is not defined in any environment or fallback.");
  }

  return { mqttBrokerUrl, apiBaseUrl };
}