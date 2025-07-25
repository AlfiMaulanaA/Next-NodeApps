"use client";

import { useEffect, useRef, useState } from "react";
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

export function useTotalErrorCount() {
    // We'll store the full list of errors to allow for filtering
    const [allErrors, setAllErrors] = useState<ErrorLog[]>([]);
    const clientRef = useRef<MqttClient | null>(null);

    // Filter out specific errors and count only active ones
    const totalActiveErrors = allErrors.filter(log => {
        // Apply the same filter as ErrorLogPage for consistency
        const ignoredErrorPattern = "MODULAR I2C cannot connect to server broker mqtt";
        return log.data && !log.data.includes(ignoredErrorPattern) && log.status !== "resolved";
    }).length;

    useEffect(() => {
        const client = connectMQTT();
        clientRef.current = client;

        const topic = "subrack/error/data";

        // Function to subscribe and handle reconnects
        const subscribeToTopic = () => {
            if (client.connected) {
                client.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`Failed to subscribe to ${topic}:`, err);
                    } else {
                        console.log(`Subscribed to ${topic} for error count.`);
                    }
                });
            } else {
                // If not connected, wait for 'connect' event to subscribe
                client.once("connect", () => {
                    client.subscribe(topic, (err) => {
                        if (err) {
                            console.error(`Failed to subscribe to ${topic} on reconnect:`, err);
                        } else {
                            console.log(`Subscribed to ${topic} on reconnect for error count.`);
                        }
                    });
                });
            }
        };

        // Initial subscription attempt
        subscribeToTopic();

        const handleMessage = (_topic: string, payload: Buffer) => {
            if (_topic === topic) {
                try {
                    const data = JSON.parse(payload.toString());
                    if (Array.isArray(data)) {
                        // Assuming 'data' from this topic is the full list of current errors
                        setAllErrors(data);
                    } else {
                        console.warn("Received non-array payload for error data. Expected an array of logs.", data);
                        // Depending on your backend, you might want to clear or ignore
                        setAllErrors([]); // Reset if unexpected format
                    }
                } catch (e) {
                    console.error("Failed to parse MQTT message for error count:", e);
                    setAllErrors([]); // Reset if parsing fails
                }
            }
        };

        // Attach event listener for messages
        client.on("message", handleMessage);

        // --- Cleanup Function ---
        return () => {
            // Unsubscribe only if the client is still active/connected
            if (clientRef.current?.connected) {
                clientRef.current.unsubscribe(topic, (err) => {
                    if (err) console.error(`Failed to unsubscribe from ${topic}:`, err);
                });
            }
            // Remove event listeners
            client.off("message", handleMessage);
            // It's generally not recommended to remove 'connect' listeners here if connectMQTT manages a global client.
            // If connectMQTT uses client.once("connect", ...), it's automatically removed after first fire.
        };
    }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

    return totalActiveErrors;
}