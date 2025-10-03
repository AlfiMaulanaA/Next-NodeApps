// hooks/useMQTTStatus.ts
"use client";

import { useEffect, useState, useRef } from "react";
import { connectMQTTAsync, getMQTTClient, getConnectionState } from "@/lib/mqttClient";

export function useMQTTStatus() {
  const [status, setStatus] = useState<string>("connecting");
  const initializationRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      return;
    }

    initializationRef.current = true;

    const initializeStatusHook = async () => {
      try {
        console.log("🔧 useMQTTStatus: Initializing MQTT connection...");

        // Initialize MQTT connection if not already done
        const client = getMQTTClient();
        if (!client || !client.connected) {
          console.log("🔧 useMQTTStatus: No active connection, initializing...");
          await connectMQTTAsync();
        } else {
          console.log("🔧 useMQTTStatus: Connection already exists");
        }

        const updateStatus = () => {
          const currentState = getConnectionState();
          setStatus(currentState);
        };

        // Initial status update
        updateStatus();

        // Get client for event listeners
        const activeClient = getMQTTClient();
        if (activeClient) {
          const handleConnect = () => {
            console.log("useMQTTStatus: Connected event received");
            setStatus("connected");
          };
          const handleError = () => {
            console.log("useMQTTStatus: Error event received");
            setStatus("error");
          };
          const handleClose = () => {
            console.log("useMQTTStatus: Close event received");
            setStatus("disconnected");
          };
          const handleReconnect = () => {
            console.log("useMQTTStatus: Reconnect event received");
            setStatus("connecting");
          };
          const handleOffline = () => {
            console.log("useMQTTStatus: Offline event received");
            setStatus("disconnected");
          };

          activeClient.on("connect", handleConnect);
          activeClient.on("error", handleError);
          activeClient.on("close", handleClose);
          activeClient.on("reconnect", handleReconnect);
          activeClient.on("offline", handleOffline);

          // Cleanup function
          return () => {
            activeClient.off("connect", handleConnect);
            activeClient.off("error", handleError);
            activeClient.off("close", handleClose);
            activeClient.off("reconnect", handleReconnect);
            activeClient.off("offline", handleOffline);
          };
        }

        // Set up periodic status check as fallback
        const statusCheckInterval = setInterval(updateStatus, 2000);

        return () => {
          if (statusCheckInterval) clearInterval(statusCheckInterval);
        };
      } catch (error) {
        console.error("useMQTTStatus: Failed to initialize:", error);
        setStatus("error");
      }
    };

    // Start initialization and cleanup
    const cleanupPromise = initializeStatusHook();

    return () => {
      initializationRef.current = false;
      cleanupPromise?.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  return status;
}
