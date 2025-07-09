// hooks/useMQTTStatus.ts
"use client";

import { useEffect, useState } from "react";
import { connectMQTT } from "@/lib/mqttClient";

export function useMQTTStatus() {
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const client = connectMQTT();

    const handleConnect = () => {
      console.log("✅ Connected to MQTT");
      setStatus("connected");
    };

    const handleError = (error: any) => {
      console.error("❌ MQTT Error", error);
      setStatus("error");
    };

    const handleClose = () => {
      console.warn("⚠️ MQTT Disconnected");
      setStatus("disconnected");
    };

    client.on("connect", handleConnect);
    client.on("error", handleError);
    client.on("close", handleClose);

    return () => {
      client.off("connect", handleConnect);
      client.off("error", handleError);
      client.off("close", handleClose);
    };
  }, []);

  return status;
}
