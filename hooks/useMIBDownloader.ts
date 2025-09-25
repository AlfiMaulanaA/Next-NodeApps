"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";

export interface MIBDownloadStatus {
  status: 'idle' | 'downloading' | 'success' | 'error';
  message?: string;
  fileName?: string;
  downloadUrl?: string;
  timestamp?: string;
  fileSize?: string;
  progress?: number;
}

export function useMIBDownloader() {
  const [downloadStatus, setDownloadStatus] = useState<MIBDownloadStatus>({ status: 'idle' });
  const [isConnected, setIsConnected] = useState(false);
  const mqttStatus = useMQTTStatus();
  const client = getMQTTClient();

  // Update connection status
  useEffect(() => {
    setIsConnected(mqttStatus === 'connected');
  }, [mqttStatus]);

  // MQTT Message Handler
  const handleMQTTMessage = useCallback((topic: string, message: Buffer) => {
    if (topic !== "snmp/response") return;

    try {
      const payload = JSON.parse(message.toString());

      if (payload.command === "downloadMIB") {
        if (payload.status === "success") {
          setDownloadStatus({
            status: 'success',
            message: payload.message || "MIB file downloaded successfully",
            fileName: payload.fileName,
            downloadUrl: payload.downloadUrl,
            fileSize: payload.fileSize,
            timestamp: new Date().toLocaleString()
          });

          // Auto-download file if URL is provided
          if (payload.downloadUrl) {
            const link = document.createElement('a');
            link.href = payload.downloadUrl;
            link.download = payload.fileName || 'mib-file.txt';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }

          toast.success("MIB file downloaded successfully!", {
            duration: 4000,
            position: "top-right",
          });
        } else if (payload.status === "error") {
          setDownloadStatus({
            status: 'error',
            message: payload.message || "Failed to download MIB file",
            timestamp: new Date().toLocaleString()
          });

          toast.error(`MIB Download Error: ${payload.message}`, {
            duration: 5000,
            position: "top-right",
          });
        } else if (payload.status === "progress") {
          setDownloadStatus(prev => ({
            ...prev,
            progress: payload.progress,
            message: payload.message || `Downloading... ${payload.progress}%`
          }));
        }
      }
    } catch (error) {
      console.error("Error parsing MQTT message:", error);
      setDownloadStatus({
        status: 'error',
        message: "Invalid response format from SNMP service",
        timestamp: new Date().toLocaleString()
      });
    }
  }, []);

  // Setup MQTT listeners
  useEffect(() => {
    if (!client || !isConnected) return;

    // Subscribe to response topic
    client.subscribe("snmp/response", (err) => {
      if (err) {
        console.error("Failed to subscribe to snmp/response:", err);
        toast.error("Failed to subscribe to SNMP response topic");
      } else {
        console.log("Successfully subscribed to snmp/response topic");
      }
    });

    // Add message listener
    client.on("message", handleMQTTMessage);

    return () => {
      client.unsubscribe("snmp/response");
      client.off("message", handleMQTTMessage);
    };
  }, [client, isConnected, handleMQTTMessage]);

  // Handle MIB Download
  const downloadMIB = useCallback(async () => {
    if (!isConnected) {
      toast.error("MQTT not connected. Please check your connection.");
      return;
    }

    if (!client) {
      toast.error("MQTT client not available.");
      return;
    }

    try {
      setDownloadStatus({ status: 'downloading', message: "Initiating MIB download..." });

      const payload = {
        command: "downloadMIB",
        timestamp: new Date().toISOString(),
        requestId: `mib-${Date.now()}`
      };

      console.log("Publishing MIB download command:", payload);

      // Show loading toast
      toast.loading("Requesting MIB download...", {
        id: "mib-download",
        duration: 10000 // Auto-dismiss after 10 seconds if no response
      });

      // Publish command to MQTT
      client.publish("snmp/command", JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
          console.error("Failed to publish MIB download command:", err);
          setDownloadStatus({
            status: 'error',
            message: "Failed to send download command",
            timestamp: new Date().toLocaleString()
          });
          toast.dismiss("mib-download");
          toast.error("Failed to send MIB download command");
        } else {
          console.log("MIB download command published successfully");
          // Dismiss loading toast after successful publish
          setTimeout(() => {
            toast.dismiss("mib-download");
          }, 1000);
        }
      });

    } catch (error) {
      console.error("Error initiating MIB download:", error);
      setDownloadStatus({
        status: 'error',
        message: "Unexpected error occurred",
        timestamp: new Date().toLocaleString()
      });
      toast.dismiss("mib-download");
      toast.error("Unexpected error occurred");
    }
  }, [client, isConnected]);

  // Reset download status
  const resetStatus = useCallback(() => {
    setDownloadStatus({ status: 'idle' });
  }, []);

  return {
    downloadStatus,
    isConnected,
    downloadMIB,
    resetStatus,
    mqttStatus
  };
}