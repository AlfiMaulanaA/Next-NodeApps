// src/config/appConfig.ts atau config/appConfig.ts

interface AppConfig {
  mqttBrokerUrl: string;
  apiBaseUrl: string;
}

export function getAppConfig(): AppConfig {
  let mqttBrokerUrl: string;
  let apiBaseUrl: string;

  const isProduction = process.env.NODE_ENV === "production";

  // Tentukan protokol berdasarkan lingkungan (HTTPS di produksi, atau dari env)
  // Penting: Pastikan broker MQTT Anda mendukung WSS di port 9000 jika menggunakan HTTPS
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";

  if (isProduction) {
    if (typeof window !== "undefined") {
      // Di produksi, gunakan window.location.hostname dengan port 9000
      // Protokol disesuaikan secara dinamis
      mqttBrokerUrl = `${protocol}://${window.location.hostname}:9000`; // Sesuaikan port jika berbeda
      apiBaseUrl = `http://${window.location.hostname}:8000`; // Sesuaikan port jika berbeda
    } else {
      // Fallback untuk SSR di produksi (jika diperlukan koneksi di server, tapi ini client component)
      mqttBrokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "ws://localhost:9000";
      apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    }
  } else {
    // Development environment: Gunakan langsung dari .env
    // Protokol diambil dari env, jika tidak ada, default ke ws
    mqttBrokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "ws://localhost:9000"; // Sesuaikan port jika berbeda
    apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"; // Sesuaikan port jika berbeda
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