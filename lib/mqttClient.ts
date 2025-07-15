// lib/mqttClient.ts
import mqtt, { MqttClient } from "mqtt";

let client: MqttClient | null = null;

/**
 * Menginisialisasi koneksi MQTT jika belum ada koneksi atau koneksi sebelumnya terputus.
 * @returns {MqttClient} Koneksi MQTT client yang aktif.
 */
export function connectMQTT(): MqttClient {
  const brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL;

  if (!brokerUrl) {
    throw new Error("MQTT broker URL tidak didefinisikan di .env");
  }

  if (!client || client.disconnected) {
    client = mqtt.connect(brokerUrl, {
      clean: true,
      connectTimeout: 3000,
      reconnectPeriod: 750,
    });
  }

  return client;
}

/**
 * Mendapatkan instance MQTT client yang sedang aktif (jika sudah terhubung).
 * @returns {MqttClient | null}
 */
export function getMQTTClient(): MqttClient | null {
  return client;
}
