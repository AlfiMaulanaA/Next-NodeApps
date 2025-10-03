"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { reconnectMQTT, connectMQTTAsync } from "@/lib/mqttClient";

export type MQTTConnectionMode = "env" | "database";

interface MQTTModeContextType {
  mode: MQTTConnectionMode;
  setMode: (mode: MQTTConnectionMode) => void;
  getMQTTConfig: () => Promise<MQTTConfig>;
}

interface MQTTConfig {
  url: string;
  host: string;
  port: number;
  protocol: string;
}

const MQTTModeContext = createContext<MQTTModeContextType | undefined>(undefined);

export function MQTTModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<MQTTConnectionMode>("env");

  // Load saved mode from localStorage and initialize MQTT connection
  useEffect(() => {
    const savedMode = localStorage.getItem("mqtt_connection_mode") as MQTTConnectionMode;
    if (savedMode && (savedMode === "env" || savedMode === "database")) {
      setModeState(savedMode);
    }

    // Initialize MQTT connection after setting the mode
    const initializeMQTT = async () => {
      try {
        console.log("Initializing MQTT connection on app startup...");
        const mqttClient = await connectMQTTAsync();
        console.log("MQTT connection initialized successfully");

        // Expose client to window for debugging
        if (typeof window !== "undefined") {
          (window as any).mqttClient = mqttClient;
          console.log("MQTT client exposed to window.mqttClient");
        }
      } catch (error) {
        console.error("Failed to initialize MQTT connection:", error);
      }
    };

    // Small delay to ensure mode is set before connection
    const timeoutId = setTimeout(initializeMQTT, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Save mode to localStorage when changed
  const setMode = (newMode: MQTTConnectionMode) => {
    const oldMode = mode;
    setModeState(newMode);
    localStorage.setItem("mqtt_connection_mode", newMode);

    // Only log the change, don't trigger reconnection here
    // Reconnection will be handled by the calling component
    if (oldMode !== newMode) {
      console.log(`MQTT Mode changed from ${oldMode} to ${newMode} in context`);
    }
  };

  const getMQTTConfig = async (): Promise<MQTTConfig> => {
    if (mode === "env") {
      return getEnvMQTTConfig();
    } else {
      return getDatabaseMQTTConfig();
    }
  };

  const getEnvMQTTConfig = (): MQTTConfig => {
    const isProduction = process.env.NODE_ENV === "production";
    const isDevelopment = process.env.NODE_ENV === "development";

    let host: string;
    let port: number;
    let protocol: string;

    if (isDevelopment) {
      // Development: Use ENV variables
      host = process.env.NEXT_PUBLIC_MQTT_BROKER_HOST || "192.168.0.193";
      port = parseInt(process.env.NEXT_PUBLIC_MQTT_BROKER_PORT || "9000");
      protocol = "ws";
    } else if (isProduction) {
      // Production: Use window.location.hostname
      if (typeof window !== "undefined") {
        host = window.location.hostname;
        port = parseInt(process.env.NEXT_PUBLIC_MQTT_BROKER_PORT || "9000");
        protocol = window.location.protocol === "https:" ? "wss" : "ws";
      } else {
        // Fallback for SSR
        host = process.env.NEXT_PUBLIC_MQTT_BROKER_HOST || "localhost";
        port = parseInt(process.env.NEXT_PUBLIC_MQTT_BROKER_PORT || "9000");
        protocol = "ws";
      }
    } else {
      // Fallback
      host = process.env.NEXT_PUBLIC_MQTT_BROKER_HOST || "localhost";
      port = parseInt(process.env.NEXT_PUBLIC_MQTT_BROKER_PORT || "9000");
      protocol = "ws";
    }

    const url = `${protocol}://${host}:${port}`;

    return { url, host, port, protocol };
  };

  const getDatabaseMQTTConfig = async (): Promise<MQTTConfig> => {
    try {
      // First try to get enabled configuration
      const enabledResponse = await fetch("/api/mqtt/?enabled=true");
      const enabledResult = await enabledResponse.json();

      if (enabledResult.success && enabledResult.data.length > 0) {
        const config = enabledResult.data[0];
        const url = new URL(config.broker_url);

        console.log("Using enabled database MQTT configuration:", config.name);
        return {
          url: config.broker_url,
          host: url.hostname,
          port: parseInt(url.port) || 1883,
          protocol: url.protocol.slice(0, -1) // Remove ':'
        };
      }

      // Fallback to active configuration if no enabled config
      const activeResponse = await fetch("/api/mqtt/?active=true");
      const activeResult = await activeResponse.json();

      if (activeResult.success && activeResult.data.length > 0) {
        const config = activeResult.data[0];
        const url = new URL(config.broker_url);

        console.log("Using active database MQTT configuration:", config.name);
        return {
          url: config.broker_url,
          host: url.hostname,
          port: parseInt(url.port) || 1883,
          protocol: url.protocol.slice(0, -1) // Remove ':'
        };
      } else {
        // Fallback to ENV if no database config
        console.warn("No database MQTT configuration found, falling back to ENV");
        return getEnvMQTTConfig();
      }
    } catch (error) {
      console.error("Error fetching MQTT config from database:", error);
      // Fallback to ENV on error
      return getEnvMQTTConfig();
    }
  };

  return (
    <MQTTModeContext.Provider value={{ mode, setMode, getMQTTConfig }}>
      {children}
    </MQTTModeContext.Provider>
  );
}

export function useMQTTMode() {
  const context = useContext(MQTTModeContext);
  if (context === undefined) {
    throw new Error("useMQTTMode must be used within a MQTTModeProvider");
  }
  return context;
}
