import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";

export function useTotalErrorCount() {
  const [totalErrors, setTotalErrors] = useState<number>(0);
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    const client = mqtt.connect(`${process.env.NEXT_PUBLIC_MQTT_BROKER_URL}`);

    client.on("connect", () => {
      client.subscribe("subrack/error/data");
    });

    client.on("message", (_topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (Array.isArray(data)) {
          setTotalErrors(data.length);
        } else {
          setTotalErrors(0);
        }
      } catch {
        setTotalErrors(0);
      }
    });

    clientRef.current = client;
    return () => {
      client.end();
    };
  }, []);

  return totalErrors;
}
