"use client";

import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { FileBarChart, Download, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input"; 

export default function FileLibraryPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [fileName, setFileName] = useState<string | null>(null);
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  // Connect to MQTT broker
  useEffect(() => {
    const client = mqtt.connect(`${process.env.NEXT_PUBLIC_MQTT_BROKER_URL }`);

    client.on("connect", () => {
      setStatus("connected");
      client.subscribe("response_file_transfer");
      client.subscribe("service/response");
    });

    client.on("error", () => {
      setStatus("error");
    });

    client.on("close", () => {
      setStatus("disconnected");
    });

    client.on("message", (topic, payload) => {
      const data = JSON.parse(payload.toString());

      if (topic === "response_file_transfer") {
        if (data.status === "success" && data.action === "upload") {
          toast.success("devices.json uploaded successfully.");
          restartService();
        } else if (data.status === "error") {
          toast.error(data.message || "Upload failed");
        }
      } else if (topic === "service/response") {
        if (data.result === "success") {
          toast.success(data.message || "Service restarted successfully.");
        } else {
          toast.error(data.message || "Service restart failed.");
        }
      }
    });

    clientRef.current = client;

    return () => {
      client.end();
    };
  }, []);

  const confirmDownload = () => {
    if (confirm("Download devices.json file?")) downloadFile();
  };

  const confirmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (file.name !== "devices.json") {
      toast.error("Invalid file. Please select devices.json");
      return;
    }

    if (confirm("Upload and replace devices.json file?")) {
      uploadFile(file);
    }
  };

  const downloadFile = () => {
    toast.loading("Downloading devices.json...");
    const cmd = JSON.stringify({
      action: "download",
      filepath: "../MODBUS_SNMP/JSON/Config/Library/devices.json",
    });
    clientRef.current?.publish("command_download_file", cmd);
  };

  const uploadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      const cmd = JSON.stringify({
        action: "upload",
        filepath: "../MODBUS_SNMP/JSON/Config/Library/devices.json",
        content,
      });
      clientRef.current?.publish("command_upload_file", cmd);
      toast.loading("Uploading devices.json...");
    };
    reader.readAsText(file);
  };

  const restartService = () => {
    const cmd = JSON.stringify({
      action: "restart",
      services: ["MODBUS_SNMP.service"],
    });
    clientRef.current?.publish("service/command", cmd);
    toast.loading("Restarting MODBUS_SNMP.service...");
  };

  const refreshData = () => {
    toast.info("Refreshing MQTT connection...");
    clientRef.current?.end(true, () => {
      window.location.reload();
    });
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
  <Button onClick={confirmDownload} className="w-full">
    <Download className="mr-2 h-4 w-4" /> Download devices.json
  </Button>
  <div>
    <Input
      type="file"
      accept=".json"
      onChange={confirmUpload}
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
