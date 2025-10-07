"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { connectMQTT } from "@/lib/mqttClient"; // Import centralized MQTT connection
import type { MqttClient } from "mqtt"; // Import MqttClient type for useRef

// Define the expected structure of an individual error log item
interface ErrorLog {
    id: string; // Unique ID from backend
    data: string;
    type: string;
    Timestamp: string;
    source?: string; // Optional: Source of the error
    status?: "active" | "resolved"; // Status of the error
    resolved_at?: string; // Timestamp when resolved
}

// Global static client - only one instance across all hooks
let globalMQTTClient: MqttClient | null = null;
let globalSubscriptionCount = 0;

export function useTotalErrorCount() {
    // We'll store the full list of errors to allow for filtering
    const [allErrors, setAllErrors] = useState<ErrorLog[]>([]);
    const clientRef = useRef<MqttClient | null>(null);

    // Memoize error filtering for performance
    const totalActiveErrors = useMemo(() => {
        // Apply the same filter as ErrorLogPage for consistency
        const ignoredErrorPattern = "MODULAR I2C cannot connect to server broker mqtt";
        return allErrors.filter(log => {
            return log.data &&
                   !log.data.includes(ignoredErrorPattern) &&
                   log.status !== "resolved";
        }).length;
    }, [allErrors]);

    // Optimized message handler with useCallback for stability
    const handleMessage = useCallback((topic: string, payload: Buffer) => {
        if (topic === "subrack/error/data") {
            try {
                const data = JSON.parse(payload.toString());
                if (Array.isArray(data)) {
                    setAllErrors(data);
                } else {
                    console.warn("Received non-array payload for error data. Expected an array of logs.", data);
                    setAllErrors([]);
                }
            } catch (e) {
                console.error("Failed to parse MQTT message for error count:", e);
                setAllErrors([]);
            }
        }
    }, []);

    useEffect(() => {
        // Use global MQTT client to avoid multiple connections
        if (!globalMQTTClient) {
            globalMQTTClient = connectMQTT();
        }

        const client = globalMQTTClient;
        clientRef.current = client;
        globalSubscriptionCount++;

        // Only subscribe if not already subscribed and client is connected
        if (client.connected) {
            client.subscribe("subrack/error/data", (err) => {
                if (err) {
                    console.error(`Failed to subscribe to error topic:`, err);
                } else {
                    // Only log once
                    if (globalSubscriptionCount === 1) {
                        console.log("Subscribed to error count topic");
                    }
                }
            });
        } else {
            // Wait for connection
            const onConnect = () => {
                if (globalMQTTClient) {
                    globalMQTTClient.subscribe("subrack/error/data", (err) => {
                        if (err) {
                            console.error(`Failed to subscribe to error topic after connect:`, err);
                        } else if (globalSubscriptionCount === 1) {
                            console.log("Subscribed to error count topic on connect");
                        }
                    });
                }
            };

            client.once("connect", onConnect);
        }

        // Attach event listener
        client.on("message", handleMessage);

        // Cleanup function
        return () => {
            globalSubscriptionCount--;

            // Only cleanup if this is the last hook using the global client
            if (globalSubscriptionCount === 0 && clientRef.current) {
                if (client.connected) {
                    client.unsubscribe("subrack/error/data", (err) => {
                        if (err) console.error("Failed to unsubscribe from error topic:", err);
                    });
                }
                client.off("message", handleMessage);
                // Don't disconnect global client here as it might be used by other hooks
            } else {
                // Just remove our message handler
                client.off("message", handleMessage);
            }
        };
    }, [handleMessage]); // Only re-run if handleMessage changes (memoized)

    return totalActiveErrors;
}
