"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  reconnectMQTT,
  connectMQTTAsync,
  getMQTTClient,
} from "@/lib/mqttClient";
import { useMQTT } from "@/hooks/useMQTT";
export type MQTTConnectionMode = "env" | "json" | "database";

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

const MQTTModeContext = createContext<MQTTModeContextType | undefined>(
  undefined
);

export function MQTTModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<MQTTConnectionMode>("env");
  const [mqttActiveConfig, setMqttActiveConfig] = useState<MQTTConfig | null>(
    null
  );
  const [activeConfigPromises, setActiveConfigPromises] = useState<
    Map<
      string,
      { resolve: (value: MQTTConfig) => void; reject: (reason: any) => void }
    >
  >(new Map());

  // MQTT configuration for getting active config
  const { publishMessage, addMessageHandler, isOnline } = useMQTT({
    topics: ["response_mqtt_active_config"],
    autoSubscribe: true,
    enableLogging: true,
  });

  // MQTT message handler for active config responses
  useEffect(() => {
    const handleActiveConfigResponse = (topic: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("Received MQTT active config response:", data);

        if (data.success && data.data) {
          // Process enabled configuration first
          let config = data.data.find((c: any) => c.enabled);
          if (!config) {
            // Fallback to active configuration
            config = data.data.find((c: any) => c.is_active);
          }

          if (config) {
            try {
              const url = new URL(config.broker_url);
              const mqttConfig: MQTTConfig = {
                url: config.broker_url,
                host: url.hostname,
                port: parseInt(url.port) || 1883,
                protocol: url.protocol.slice(0, -1), // Remove ':'
              };

              setMqttActiveConfig(mqttConfig);
              console.log(
                "Using MQTT database config:",
                config.name,
                mqttConfig
              );

              // Resolve pending promises for this request
              const requestId = data.request_id || "default";
              const promiseHandlers = activeConfigPromises.get(requestId);
              if (promiseHandlers) {
                promiseHandlers.resolve(mqttConfig);
                setActiveConfigPromises((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(requestId);
                  return newMap;
                });
              }
            } catch (urlError) {
              console.error(
                "Invalid broker URL in MQTT config:",
                config.broker_url
              );
              handleConfigError(data.request_id);
            }
          } else {
            // No active/enabled config found
            console.warn(
              "No active/enabled MQTT configuration found in MQTT response"
            );
            handleConfigError(data.request_id);
          }
        } else {
          // Unsuccessful response
          console.error("MQTT config request failed:", data.error);
          handleConfigError(data.request_id);
        }
      } catch (error) {
        console.error("Error parsing MQTT active config response:", error);
        handleConfigError();
      }
    };

    const handleConfigError = (requestId?: string) => {
      // Reject pending promises
      const reqId = requestId || "default";
      const promiseHandlers = activeConfigPromises.get(reqId);
      if (promiseHandlers) {
        promiseHandlers.reject(new Error("No active MQTT configuration found"));
        setActiveConfigPromises((prev) => {
          const newMap = new Map(prev);
          newMap.delete(reqId);
          return newMap;
        });
      }
    };

    // Set up message handler
    addMessageHandler(
      "response_mqtt_active_config",
      handleActiveConfigResponse
    );
  }, [addMessageHandler, activeConfigPromises]);

  // Load saved mode from localStorage and initialize MQTT connection
  useEffect(() => {
    const savedMode = localStorage.getItem(
      "mqtt_connection_mode"
    ) as MQTTConnectionMode;
    if (
      savedMode &&
      (savedMode === "env" || savedMode === "json" || savedMode === "database")
    ) {
      setModeState(savedMode);
    }

    // Initialize MQTT connection after setting the mode
    const initializeMQTT = async () => {
      try {
        // console.log("Initializing MQTT connection on app startup...");
        await connectMQTTAsync();
        console.log("MQTT connection initialized successfully");
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
      // For ENV mode, return config synchronously - no MQTT needed
      return getEnvMQTTConfig();
    } else if (mode === "json") {
      // For JSON mode, get config via MQTT
      return getJSONFileMQTTConfig();
    } else {
      // For database mode, get config via MQTT
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
    // Check if we have a cached active config
    if (mqttActiveConfig) {
      console.log("Using cached MQTT database config:", mqttActiveConfig);
      return mqttActiveConfig;
    }

    // If not connected to MQTT, fallback to ENV
    if (!isOnline) {
      console.warn("MQTT not connected, falling back to ENV configuration");
      return getEnvMQTTConfig();
    }

    try {
      // Create a unique request ID for this request
      const requestId = `config-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create a promise that will be resolved when we get the MQTT response
      const configPromise = new Promise<MQTTConfig>((resolve, reject) => {
        setActiveConfigPromises((prev) => {
          const newMap = new Map(prev);
          newMap.set(requestId, { resolve, reject });
          return newMap;
        });

        // Set a timeout for the request (5 seconds)
        setTimeout(() => {
          const handlers = activeConfigPromises.get(requestId);
          if (handlers) {
            handlers.reject(new Error("MQTT config request timeout"));
            setActiveConfigPromises((prev) => {
              const newMap = new Map(prev);
              newMap.delete(requestId);
              return newMap;
            });
          }
        }, 5000);
      });

      // Publish MQTT command to get active MQTT configurations
      const success = publishMessage("command_mqtt_json_config", {
        command: "get_active_enabled",
        request_id: requestId,
        timestamp: new Date().toISOString(),
      });

      if (!success) {
        console.error("Failed to publish MQTT JSON config request");
        return getEnvMQTTConfig();
      }

      // Wait for the response
      return await configPromise;
    } catch (error) {
      console.error("Error getting MQTT JSON config via MQTT:", error);
      // Fallback to ENV on error
      return getEnvMQTTConfig();
    }
  };

  const getJSONFileMQTTConfig = async (): Promise<MQTTConfig> => {
    // Check if we have a cached active config
    if (mqttActiveConfig) {
      console.log("Using cached MQTT JSON config:", mqttActiveConfig);
      return mqttActiveConfig;
    }

    // If not connected to MQTT, fallback to ENV
    if (!isOnline) {
      console.warn("MQTT not connected, falling back to ENV configuration");
      return getEnvMQTTConfig();
    }

    try {
      // Create a unique request ID for this request
      const requestId = `json-config-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create a promise that will be resolved when we get the MQTT response
      const configPromise = new Promise<MQTTConfig>((resolve, reject) => {
        setActiveConfigPromises((prev) => {
          const newMap = new Map(prev);
          newMap.set(requestId, { resolve, reject });
          return newMap;
        });

        // Set a timeout for the request (5 seconds)
        setTimeout(() => {
          const handlers = activeConfigPromises.get(requestId);
          if (handlers) {
            handlers.reject(new Error("MQTT JSON config request timeout"));
            setActiveConfigPromises((prev) => {
              const newMap = new Map(prev);
              newMap.delete(requestId);
              return newMap;
            });
          }
        }, 5000);
      });

      // Publish MQTT command to get active MQTT configurations from JSON file
      const success = publishMessage("command_mqtt_json_config", {
        command: "get_active_enabled",
        request_id: requestId,
        timestamp: new Date().toISOString(),
      });

      if (!success) {
        console.error("Failed to publish MQTT JSON config request");
        return getEnvMQTTConfig();
      }

      // Wait for the response
      return await configPromise;
    } catch (error) {
      console.error("Error getting MQTT JSON config via MQTT:", error);
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
