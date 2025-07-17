// hooks/useMQTTStatus.ts
"use client";

import { useEffect, useState } from "react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";

export function useMQTTStatus() {
  const initialClient = getMQTTClient();

  const [status, setStatus] = useState(() => {
    if (!initialClient) return "connecting";
    if (initialClient.connected) return "connected";
    if (initialClient.disconnected) return "disconnected";
    return "connecting";
  });

  useEffect(() => {
    const client = connectMQTT();

    if (client.connected) {
      setStatus("connected");
    } else if (client.disconnected) {
      setStatus("disconnected");
    } else {
      setStatus("connecting");
    }

    const handleConnect = () => setStatus("connected");
    const handleError = () => setStatus("error");
    const handleClose = () => setStatus("disconnected");
    const handleReconnect = () => setStatus("connecting");
    const handleOffline = () => setStatus("disconnected");

    client.on("connect", handleConnect);
    client.on("error", handleError);
    client.on("close", handleClose);
    client.on("reconnect", handleReconnect);
    client.on("offline", handleOffline);

    return () => {
      client.off("connect", handleConnect);
      client.off("error", handleError);
      client.off("close", handleClose);
      client.off("reconnect", handleReconnect);
      client.off("offline", handleOffline);
    };
  }, []);

  return status;
}