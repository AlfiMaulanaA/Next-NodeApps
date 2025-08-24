"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { connectMQTT, getMQTTClient, getConnectionState, isClientConnected } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";

interface UseMQTTOptions {
  topics?: string[];
  autoSubscribe?: boolean;
  enableLogging?: boolean;
}

export function useMQTT(options: UseMQTTOptions = {}) {
  const { topics = [], autoSubscribe = true, enableLogging = false } = options;
  
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [isOnline, setIsOnline] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);
  const subscribedTopicsRef = useRef<Set<string>>(new Set());
  const messageHandlersRef = useRef<Map<string, (topic: string, message: Buffer) => void>>(new Map());

  // Throttled logging
  const log = useCallback((message: string, type: "log" | "error" = "log") => {
    if (enableLogging) {
      if (type === "error") {
        console.error(`[MQTT Hook] ${message}`);
      } else {
        console.log(`[MQTT Hook] ${message}`);
      }
    }
  }, [enableLogging]);

  // Initialize MQTT connection
  useEffect(() => {
    try {
      const client = connectMQTT();
      clientRef.current = client;

      const handleConnect = () => {
        setConnectionStatus("Connected");
        setIsOnline(true);
        log("Connected to MQTT broker");

        // Auto-subscribe to topics if enabled
        if (autoSubscribe && topics.length > 0) {
          subscribeToTopics(topics);
        }
      };

      const handleError = (err: Error) => {
        setConnectionStatus(`Error: ${err.message}`);
        setIsOnline(false);
        log(`MQTT Error: ${err.message}`, "error");
      };

      const handleClose = () => {
        setConnectionStatus("Disconnected");
        setIsOnline(false);
        subscribedTopicsRef.current.clear();
        log("Connection closed");
      };

      const handleOffline = () => {
        setConnectionStatus("Offline");
        setIsOnline(false);
        log("Client offline");
      };

      const handleReconnect = () => {
        setConnectionStatus("Reconnecting");
        setIsOnline(false);
        log("Reconnecting...");
      };

      // Set up event listeners
      client.on("connect", handleConnect);
      client.on("error", handleError);
      client.on("close", handleClose);
      client.on("offline", handleOffline);
      client.on("reconnect", handleReconnect);

      // Check initial connection state
      if (client.connected) {
        handleConnect();
      }

      return () => {
        // Cleanup event listeners
        client.off("connect", handleConnect);
        client.off("error", handleError);
        client.off("close", handleClose);
        client.off("offline", handleOffline);
        client.off("reconnect", handleReconnect);

        // Unsubscribe from topics
        Array.from(subscribedTopicsRef.current).forEach(topic => {
          unsubscribeFromTopic(topic);
        });
      };
    } catch (error) {
      log(`Failed to initialize MQTT: ${error}`, "error");
      setConnectionStatus("Failed to initialize");
    }
  }, [topics, autoSubscribe, log]);

  // Subscribe to topics
  const subscribeToTopics = useCallback((topicList: string[]) => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      log("Cannot subscribe: client not connected", "error");
      return;
    }

    topicList.forEach(topic => {
      if (!subscribedTopicsRef.current.has(topic)) {
        client.subscribe(topic, (err) => {
          if (err) {
            log(`Failed to subscribe to ${topic}: ${err.message}`, "error");
          } else {
            subscribedTopicsRef.current.add(topic);
            log(`Subscribed to ${topic}`);
          }
        });
      }
    });
  }, [log]);

  // Unsubscribe from topic
  const unsubscribeFromTopic = useCallback((topic: string) => {
    const client = clientRef.current;
    if (client && subscribedTopicsRef.current.has(topic)) {
      client.unsubscribe(topic, (err) => {
        if (err) {
          log(`Failed to unsubscribe from ${topic}: ${err.message}`, "error");
        } else {
          subscribedTopicsRef.current.delete(topic);
          messageHandlersRef.current.delete(topic);
          log(`Unsubscribed from ${topic}`);
        }
      });
    }
  }, [log]);

  // Add message handler for specific topic
  const addMessageHandler = useCallback((topic: string, handler: (topic: string, message: Buffer) => void) => {
    messageHandlersRef.current.set(topic, handler);
    
    const client = clientRef.current;
    if (client) {
      // Remove existing handler if any
      const existingHandler = messageHandlersRef.current.get(topic);
      if (existingHandler) {
        client.off("message", existingHandler);
      }

      // Add new handler
      const wrappedHandler = (receivedTopic: string, message: Buffer) => {
        if (receivedTopic === topic) {
          handler(receivedTopic, message);
        }
      };

      client.on("message", wrappedHandler);
    }
  }, []);

  // Publish message
  const publishMessage = useCallback((topic: string, message: string | object, options: { qos?: 0 | 1 | 2; retain?: boolean } = {}) => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      log("Cannot publish: client not connected", "error");
      return false;
    }

    const payload = typeof message === "string" ? message : JSON.stringify(message);
    
    client.publish(topic, payload, options, (err) => {
      if (err) {
        log(`Failed to publish to ${topic}: ${err.message}`, "error");
      } else {
        log(`Published to ${topic}`);
      }
    });

    return true;
  }, [log]);

  return {
    client: clientRef.current,
    connectionStatus,
    isOnline,
    isConnected: isClientConnected(),
    subscribeToTopics,
    unsubscribeFromTopic,
    addMessageHandler,
    publishMessage,
    subscribedTopics: Array.from(subscribedTopicsRef.current)
  };
}