import { useEffect, useRef, useState } from "react";
// import mqtt from "mqtt"; // Remove direct mqtt import
// import { mqttBrokerUrl } from "@/lib/config"; // Remove this import

import { connectMQTT } from "@/lib/mqttClient"; // Import centralized MQTT connection
import type { MqttClient } from "mqtt"; // Import MqttClient type for useRef

export function useTotalErrorCount() {
  const [totalErrors, setTotalErrors] = useState<number>(0);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    // Use the centralized connectMQTT function
    const client = connectMQTT();
    clientRef.current = client;

    // Handle initial connection and subscriptions
    const handleConnect = () => {
      client.subscribe("subrack/error/data");
    };

    // Handle incoming messages
    const handleMessage = (_topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString());
        if (Array.isArray(data)) {
          setTotalErrors(data.length);
        } else {
          // If the payload is not an array, assume 0 errors or handle as an error
          setTotalErrors(0);
        }
      } catch (e) {
        console.error("Failed to parse MQTT message for error count:", e);
        setTotalErrors(0); // Reset or set to a default if parsing fails
      }
    };

    // Attach event listeners
    client.on("connect", handleConnect);
    client.on("message", handleMessage);

    // Clean up function
    return () => {
      // Ensure the client is still connected before unsubscribing
      if (client.connected) {
        client.unsubscribe("subrack/error/data");
      }
      // Remove event listeners to prevent memory leaks
      client.off("connect", handleConnect);
      client.off("message", handleMessage);
      // Do NOT call client.end() here, as the client is managed globally
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  return totalErrors;
}