"use client";

import { useEffect, useRef, useState } from "react";
// import mqtt from "mqtt"; // <-- REMOVE THIS LINE (if you haven't already)
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { FileBarChart, Download, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
// import { mqttBrokerUrl } from "@/lib/config"; // <-- REMOVE THIS LINE (if you haven't already)

// Import centralized MQTT client functions
import { connectMQTT } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt"; // Import MqttClient type for useRef

export default function FileLibraryPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [fileName, setFileName] = useState<string | null>(null);
  const clientRef = useRef<MqttClient | null>(null); // Use MqttClient type

  // Define restartService outside useEffect or use useCallback
  // to ensure it can be safely called from within handleMessage
  const restartService = () => {
    // Ensure clientRef.current exists and is connected before publishing
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot restart service.");
      return;
    }

    const cmd = JSON.stringify({
      action: "restart",
      services: ["MODBUS_SNMP.service"],
    });
    clientRef.current.publish("service/command", cmd, (err) => {
        if (err) {
            toast.error(`Failed to send restart command: ${err.message}`, { id: "restartToast" });
            console.error("Publish error:", err);
        } else {
            toast.loading("Restarting MODBUS_SNMP.service...", { id: "restartToast" });
        }
    });
  };

  // Connect to MQTT broker using the centralized function
  useEffect(() => {
    // Replace the direct mqtt.connect call with connectMQTT()
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      setStatus("connected");
      mqttClientInstance.subscribe("response_file_transfer");
      mqttClientInstance.subscribe("service/response");
      mqttClientInstance.subscribe("download_file_response"); // Ensure this topic is subscribed
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setStatus("error");
    };

    const handleClose = () => {
      setStatus("disconnected");
    };

    const handleMessage = (topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString());

        if (topic === "response_file_transfer") {
          if (data.status === "success" && data.action === "upload") {
            toast.success("devices.json uploaded successfully.");
            // Add a check for clientRef.current before calling restartService
            // The check for clientRef.current.connected is already inside restartService
            if (clientRef.current) {
                restartService();
            } else {
                console.warn("ClientRef is null when trying to restart service after upload success.");
            }
          } else if (data.status === "error") {
            toast.error(data.message || "Upload failed");
            console.error("File upload error response:", data);
          }
        } else if (topic === "service/response") {
          if (data.result === "success") {
            toast.success(data.message || "Service restarted successfully.");
          } else {
            toast.error(data.message || "Service restart failed.");
            console.error("Service restart error response:", data);
          }
        } else if (topic === "download_file_response") {
          if (data.status === "success" && data.action === "download" && data.content) {
            // Decode base64 content and trigger download
            const blob = new Blob([atob(data.content)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "devices.json"; // Or data.filename if provided by the backend
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("devices.json downloaded successfully.");
          } else if (data.status === "error") {
            toast.error(data.message || "Download failed");
            console.error("File download error response:", data);
          }
        }
      } catch (err) {
        toast.error("Invalid payload format received from MQTT.");
        console.error("MQTT message parsing error:", err);
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    // Cleanup function
    return () => {
      if (mqttClientInstance.connected) {
        mqttClientInstance.unsubscribe("response_file_transfer");
        mqttClientInstance.unsubscribe("service/response");
        mqttClientInstance.unsubscribe("download_file_response");
      }
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
      // Do NOT call client.end() here; it's managed globally by connectMQTT's singleton pattern.
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const confirmDownload = () => {
    if (confirm("Download devices.json file?")) {
      downloadFile();
    }
  };

  const confirmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (file.name !== "devices.json") {
      toast.error("Invalid file. Please select devices.json");
      return;
    }

    if (confirm("Upload and replace devices.json file? This will restart the MODBUS_SNMP service.")) {
      uploadFile(file);
    }
    // Clear the input after selection (optional, but good for re-uploading the same file)
    e.target.value = '';
  };

  const downloadFile = () => {
    // Add null and connected check here
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot download file.");
      return;
    }
    toast.loading("Requesting devices.json download...", { id: "downloadToast" });
    const cmd = JSON.stringify({
      action: "download",
      filepath: "../MODBUS_SNMP/JSON/Config/Library/devices.json",
    });
    clientRef.current.publish("command_download_file", cmd, (err) => {
        if (err) {
            toast.error(`Failed to send download command: ${err.message}`, { id: "downloadToast" });
            console.error("Publish error:", err);
        }
    });
  };

  const uploadFile = (file: File) => {
    // Add null and connected check here
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot upload file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // Ensure content is base64 encoded for transfer over MQTT
      const content = btoa(reader.result as string); // Base64 encode the content
      const cmd = JSON.stringify({
        action: "upload",
        filepath: "../MODBUS_SNMP/JSON/Config/Library/devices.json",
        content: content,
      });
      clientRef.current?.publish("command_upload_file", cmd, (err) => {
          if (err) {
              toast.error(`Failed to send upload command: ${err.message}`, { id: "uploadToast" });
              console.error("Publish error:", err);
          } else {
              toast.loading("Uploading devices.json...", { id: "uploadToast" });
          }
      });
    };
    reader.onerror = () => {
      toast.error("Failed to read file.");
    };
    reader.readAsBinaryString(file); // Read as binary string to ensure correct base64 encoding
  };

  const refreshData = () => {
    toast.info("Refreshing page for MQTT connection re-initialization...");
    // A full page reload will re-run the useEffect and re-initialize MQTT
    window.location.reload();
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <FileBarChart className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">File Library Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`capitalize ${
              status === "connected"
                ? "text-green-600 border-green-600"
                : status === "error"
                ? "text-red-600 border-red-600"
                : "text-yellow-600 border-yellow-600"
            }`}
          >
            {status}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={refreshData}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">devices.json File Control</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Button onClick={confirmDownload} className="w-full" disabled={status !== "connected"}>
              <Download className="mr-2 h-4 w-4" /> Download devices.json
            </Button>
            <div>
              <Input
                type="file"
                accept=".json"
                onChange={confirmUpload}
                disabled={status !== "connected"}
              />
              {fileName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {fileName}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}