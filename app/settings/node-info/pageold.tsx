"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import { toast } from "sonner";
import {
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
  Server,
  Network,
  Settings2,
  Copy,
  Check,
  Eye,
  MapPin,
  Navigation,
  ExternalLink,
  AlertOctagon,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import MqttStatus from "@/components/mqtt-status";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";

interface NodeInfoConfig {
  NODE_NAME: string;
  BASE_TOPIC_MQTT: string;
  latitude?: number;
  longitude?: number;
  location_updated?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  method: string;
  accuracy: string;
  timestamp: string;
}

export default function NodeInfoConfigPage() {
  const [config, setConfig] = useState<NodeInfoConfig>({
    NODE_NAME: "",
    BASE_TOPIC_MQTT: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>("");
  const [copiedNodeInfo, setCopiedNodeInfo] = useState(false);
  const [copiedAlarmLogs, setCopiedAlarmLogs] = useState(false);
  const [dialogSubscribeOpen, setDialogSubscribeOpen] = useState(false);
  const [nodeInfoData, setNodeInfoData] = useState<any>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [manualLatitude, setManualLatitude] = useState<string>("");
  const [manualLongitude, setManualLongitude] = useState<string>("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSettingLocation, setIsSettingLocation] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [selectedNodeForRegistration, setSelectedNodeForRegistration] =
    useState<string>("");
  const [availableNodes, setAvailableNodes] = useState<string[]>([]);
  const [isRegisteringLocation, setIsRegisteringLocation] = useState(false);
  const [discoveredLocation, setDiscoveredLocation] = useState<{
    latitude?: number;
    longitude?: number;
    last_update?: string;
  } | null>(null);
  const clientRef = useRef<any>(null);
  const subscribedTopicsRef = useRef<string[]>([]);

  // Use centralized MQTT status management
  const mqttStatus = useMQTTStatus();

  // MQTT setup menggunakan pola yang sama dengan network/mqtt page (proven working)
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    // Subscribe ke response topic (mengikuti pola network/mqtt page)
    mqttClientInstance.subscribe("node_info/response", (err) => {
      if (err) {
        console.error(`Failed to subscribe to node_info/response:`, err);
      } else {
        console.log("Successfully subscribed to node_info/response");
      }
    });

    // Message handler menggunakan pola network/mqtt page
    const handleMessage = (topic: string, buf: Buffer) => {
      try {
        const response = JSON.parse(buf.toString());
        console.log("Received Node Info response on topic:", topic, response);

        // Handle command responses
        if (topic === "node_info/response" && response.status) {
          setLastResponse(
            `${new Date().toLocaleTimeString()} - ${response.status}: ${
              response.message
            }`
          );

          if (response.status === "success") {
            // Jika mendapat data config, update state
            if (response.data && typeof response.data === "object") {
              setConfig({
                NODE_NAME: response.data.NODE_NAME || "",
                BASE_TOPIC_MQTT: response.data.BASE_TOPIC_MQTT || "",
                latitude: response.data.latitude,
                longitude: response.data.longitude,
                location_updated: response.data.location_updated,
              });
              toast.success("Current configuration loaded successfully");
              console.log("Updated config state:", {
                NODE_NAME: response.data.NODE_NAME,
                BASE_TOPIC_MQTT: response.data.BASE_TOPIC_MQTT,
                latitude: response.data.latitude,
                longitude: response.data.longitude,
                location_updated: response.data.location_updated,
              });
            } else {
              toast.success(
                response.message || "Command executed successfully"
              );
            }
          } else if (response.status === "error") {
            toast.error(response.message || "Command failed");
          }

          setIsLoading(false);
          setIsSaving(false);
          setIsGettingLocation(false);
          setIsSettingLocation(false);
          return;
        }

        // Handle data dari subscribed topics (Node Info dan Alarm)
        if (subscribedTopicsRef.current.includes(topic)) {
          try {
            const data = JSON.parse(buf.toString());
            console.log(`Received data on ${topic}:`, data);

            // Cek apakah ini topic untuk node discovery (bukan topic utama)
            const isNodeDiscoveryTopic =
              topic ===
                `${config.BASE_TOPIC_MQTT}${selectedNodeForRegistration}` &&
              selectedNodeForRegistration &&
              isRegisteringLocation;

            if (isNodeDiscoveryTopic) {
              // Extract location data dari payload
              const locationData = {
                latitude: data.last_update ? undefined : undefined, // Dalam implementasi nyata, extract dari payload
                longitude: data.last_update ? undefined : undefined,
                last_update: data.time_stamp || data.last_update,
              };

              // Untuk demo, kita gunakan data mock karena payload sebenarnya belum ada field location
              // Dalam implementasi nyata, extract latitude & longitude dari data yang diterima
              if (data.time_stamp) {
                setDiscoveredLocation({
                  latitude: -6.2088 + Math.random() * 0.1, // Mock data untuk demo
                  longitude: 106.8456 + Math.random() * 0.1,
                  last_update: data.time_stamp,
                });
                setIsRegisteringLocation(false);
                toast.success("Location data discovered from node!");
              }
            }
            // Cek apakah ini Node Info topic utama
            else if (topic === subscribedTopicsRef.current[0]) {
              setNodeInfoData(data);
              toast.success("Node Info data received", { duration: 1000 });
            }
            // Cek apakah ini Error Log topic
            else if (topic === subscribedTopicsRef.current[1]) {
              // Add new error log to the array
              const newErrorLog = {
                ...data,
                receivedAt: new Date().toISOString(),
              };
              setErrorLogs((prevLogs) => [newErrorLog, ...prevLogs]);
              toast.success("Error log received", { duration: 1000 });
            }

            // Auto scroll dialog ke bawah
            setTimeout(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (dialog) {
                dialog.scrollIntoView({ behavior: "smooth", block: "end" });
              }
            }, 100);
          } catch (error) {
            console.error(`Error parsing data from ${topic}:`, error);
            toast.error(`Failed to parse data from ${topic}`);
          }
        }
      } catch (error: unknown) {
        console.error("Error parsing Node Info response:", error);
        toast.error("Failed to parse response from service");
        setIsLoading(false);
        setIsSaving(false);
      }
    };

    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (clientRef.current) {
        clientRef.current.unsubscribe("node_info/response");
        // Unsubscribe dari semua subscribed topics
        for (const topic of subscribedTopicsRef.current) {
          clientRef.current.unsubscribe(topic);
        }
        clientRef.current.off("message", handleMessage);
      }
    };
  }, []);

  // Helper function untuk publish MQTT message
  const publishCommand = (command: any) => {
    const client = clientRef.current;
    if (!client || mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return false;
    }

    try {
      client.publish(
        "node_info/command",
        JSON.stringify(command),
        (err: Error | null) => {
          if (err) {
            console.error("Failed to publish command:", err);
          } else {
            console.log("Published command:", command);
          }
        }
      );
      return true;
    } catch (error) {
      console.error("Error publishing command:", error);
      return false;
    }
  };

  // Function untuk get current config
  const handleGetConfig = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    setIsLoading(true);
    const success = publishCommand({
      command: "get_config",
    });

    if (!success) {
      toast.error("Failed to send get_config command");
      setIsLoading(false);
    }
  };

  // Function untuk update node name
  const handleUpdateNodeName = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    if (!config.NODE_NAME.trim()) {
      toast.error("Node name cannot be empty");
      return;
    }

    setIsSaving(true);
    const success = publishCommand({
      command: "update_node_name",
      node_name: config.NODE_NAME.trim(),
    });

    if (!success) {
      toast.error("Failed to send update_node_name command");
      setIsSaving(false);
    }
  };

  // Function untuk update base topic
  const handleUpdateBaseTopic = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    if (!config.BASE_TOPIC_MQTT.trim()) {
      toast.error("Base topic cannot be empty");
      return;
    }

    // Pastikan base topic diakhiri dengan '/'
    let baseTopic = config.BASE_TOPIC_MQTT.trim();
    if (!baseTopic.endsWith("/")) {
      baseTopic += "/";
      setConfig((prev) => ({ ...prev, BASE_TOPIC_MQTT: baseTopic }));
    }

    setIsSaving(true);
    const success = publishCommand({
      command: "update_base_topic",
      base_topic: baseTopic,
    });

    if (!success) {
      toast.error("Failed to send update_base_topic command");
      setIsSaving(false);
    }
  };

  // Function untuk update all config
  const handleUpdateAll = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    if (!config.NODE_NAME.trim() || !config.BASE_TOPIC_MQTT.trim()) {
      toast.error("Both node name and base topic are required");
      return;
    }

    // Pastikan base topic diakhiri dengan '/'
    let baseTopic = config.BASE_TOPIC_MQTT.trim();
    if (!baseTopic.endsWith("/")) {
      baseTopic += "/";
      setConfig((prev) => ({ ...prev, BASE_TOPIC_MQTT: baseTopic }));
    }

    setIsSaving(true);
    const success = publishCommand({
      command: "update_node_info",
      node_name: config.NODE_NAME.trim(),
      base_topic: baseTopic,
    });

    if (!success) {
      toast.error("Failed to send update_node_info command");
      setIsSaving(false);
    }
  };

  // Function untuk reload config
  const handleReloadConfig = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    setIsSaving(true);
    const success = publishCommand({
      command: "reload_config",
    });

    if (!success) {
      toast.error("Failed to send reload_config command");
      setIsSaving(false);
    }
  };

  // Function untuk copy text ke clipboard
  const copyToClipboard = async (
    text: string,
    type: "nodeInfo" | "alarmLogs"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        `${
          type === "nodeInfo" ? "Node Info" : "Alarm Logs"
        } topic copied to clipboard`
      );

      if (type === "nodeInfo") {
        setCopiedNodeInfo(true);
        setTimeout(() => setCopiedNodeInfo(false), 2000);
      } else {
        setCopiedAlarmLogs(true);
        setTimeout(() => setCopiedAlarmLogs(false), 2000);
      }
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Function untuk get current location
  const handleGetCurrentLocation = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    setIsGettingLocation(true);
    const success = publishCommand({
      command: "get_current_location",
    });

    if (!success) {
      toast.error("Failed to send get_current_location command");
      setIsGettingLocation(false);
    }
  };

  // Function untuk set manual location
  const handleSetManualLocation = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    const lat = parseFloat(manualLatitude);
    const lon = parseFloat(manualLongitude);

    if (isNaN(lat) || isNaN(lon)) {
      toast.error("Please enter valid latitude and longitude values");
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast.error(
        "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180"
      );
      return;
    }

    setIsSettingLocation(true);
    const success = publishCommand({
      command: "set_manual_location",
      latitude: lat,
      longitude: lon,
    });

    if (!success) {
      toast.error("Failed to send set_manual_location command");
      setIsSettingLocation(false);
    }
  };

  // Function untuk get location from config
  const handleGetLocation = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    setIsGettingLocation(true);
    const success = publishCommand({
      command: "get_location",
    });

    if (!success) {
      toast.error("Failed to send get_location command");
      setIsGettingLocation(false);
    }
  };

  // Function untuk subscribe ke MQTT topics dinamis
  const handleSubscribe = async () => {
    if (mqttStatus !== "connected") {
      toast.error("MQTT connection is not available");
      return;
    }

    if (!config.BASE_TOPIC_MQTT || !config.NODE_NAME) {
      toast.error("Configuration is not complete");
      return;
    }

    setIsSubscribing(true);

    const nodeInfoTopic = `${config.BASE_TOPIC_MQTT}${config.NODE_NAME}`;
    const errorLogTopic = "subrack/error/log";

    const topics = [nodeInfoTopic, errorLogTopic];

    try {
      // Unsubscribe dari topics sebelumnya jika ada
      for (const topic of subscribedTopicsRef.current) {
        clientRef.current?.unsubscribe(topic);
      }

      // Subscribe ke topics baru
      for (const topic of topics) {
        clientRef.current?.subscribe(topic, (err: Error | null) => {
          if (err) {
            console.error(`Failed to subscribe to ${topic}:`, err);
            toast.error(`Failed to subscribe to ${topic}`);
          } else {
            console.log(`Successfully subscribed to ${topic}`);
          }
        });
      }

      setSubscribedTopics(topics);
      subscribedTopicsRef.current = topics;
      toast.success(`Subscribed to ${topics.length} MQTT topics`);
      setDialogSubscribeOpen(true);
    } catch (error) {
      console.error("Error subscribing to topics:", error);
      toast.error("Failed to subscribe to MQTT topics");
    }

    setIsSubscribing(false);
  };

  // Helper functions untuk node registration
  const handleStartNodeRegistration = () => {
    if (!selectedNodeForRegistration) {
      toast.error("Please select a node first");
      return;
    }

    setIsRegisteringLocation(true);
    setDiscoveredLocation(null);

    // Subscribe ke topic node yang dipilih
    const nodeTopic = `${config.BASE_TOPIC_MQTT}${selectedNodeForRegistration}`;

    if (clientRef.current) {
      clientRef.current.subscribe(nodeTopic, (err: Error | null) => {
        if (err) {
          toast.error(`Failed to subscribe to ${nodeTopic}`);
          setIsRegisteringLocation(false);
          return;
        }

        toast.success(
          `Subscribed to ${nodeTopic} - waiting for location data...`
        );

        // Set timeout untuk unsubsribe jika tidak ada data
        setTimeout(() => {
          if (clientRef.current) {
            clientRef.current.unsubscribe(nodeTopic);
          }
          if (!discoveredLocation) {
            setIsRegisteringLocation(false);
            toast.error("No location data received within timeout");
          }
        }, 30000); // 30 seconds timeout
      });
    }
  };

  const handleRegisterDiscoveredLocation = () => {
    if (!discoveredLocation?.latitude || !discoveredLocation?.longitude) {
      toast.error("No valid location data to register");
      return;
    }

    // Set manual location dengan data yang didapat dari discovery
    const lat = discoveredLocation.latitude;
    const lon = discoveredLocation.longitude;

    setIsSettingLocation(true);
    const success = publishCommand({
      command: "set_manual_location",
      latitude: lat,
      longitude: lon,
    });

    if (!success) {
      toast.error("Failed to register discovered location");
      setIsSettingLocation(false);
      return;
    }

    // Reset state setelah berhasil
    setDiscoveredLocation(null);
    setSelectedNodeForRegistration("");
    setRegisterDialogOpen(false);
    toast.success("Location registered successfully from node discovery!");
  };

  // Function untuk populate available nodes (simulasi)
  useEffect(() => {
    // Dalam implementasi nyata, ini bisa dari API atau MQTT discovery
    setAvailableNodes([
      "NODE_JAKARTA_1",
      "NODE_SURABAYA_2",
      "NODE_BANDUNG_3",
      "NODE_SEMARANG_4",
      "NODE_YOGYAKARTA_5",
    ]);
  }, []);

  return (
    <div>
      <div className="p-6 space-y-6">
        {/* Page Description */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            Node Information Management
          </h2>
          <p className="text-muted-foreground">
            Configure Node Information Service settings and MQTT publishing
            topics.
          </p>
        </div>

        {/* Service Information - Moved to Top */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Service Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <h4 className="font-medium mb-4">
                Current MQTT Publishing Topics
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Badge
                    variant="outline"
                    className="border-blue-300 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  >
                    Node Info
                  </Badge>
                  <div className="flex-1">
                    <code className="bg-white dark:bg-gray-900 px-3 py-1 rounded border font-mono text-sm">
                      {config.BASE_TOPIC_MQTT || "BASE_TOPIC/"}
                      {config.NODE_NAME || "NODE_NAME"}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          `${config.BASE_TOPIC_MQTT || "BASE_TOPIC/"}${
                            config.NODE_NAME || "NODE_NAME"
                          }`,
                          "nodeInfo"
                        )
                      }
                      className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                    >
                      {copiedNodeInfo ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      )}
                    </Button>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      Published every 10 seconds
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Subscribe Section */}
              <div className="space-y-4">
                <h4 className="font-medium">MQTT Topic Monitoring</h4>
                <Dialog
                  open={dialogSubscribeOpen}
                  onOpenChange={setDialogSubscribeOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={handleSubscribe}
                      disabled={
                        !config.NODE_NAME ||
                        !config.BASE_TOPIC_MQTT ||
                        mqttStatus !== "connected" ||
                        isSubscribing
                      }
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {isSubscribing ? "Subscribing..." : "Monitor Topics"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Node Information Management - Live Data
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      {/* Status Info */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Subscribed Topics
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            {subscribedTopics.length}/2 active
                          </div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="text-sm font-medium text-green-900 dark:text-green-100">
                            Node Info Received
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                            {nodeInfoData ? "✓ Latest data" : "Waiting..."}
                          </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="text-sm font-medium text-red-900 dark:text-red-100">
                            Error Logs Received
                          </div>
                          <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                            {errorLogs.length > 0
                              ? `✓ ${errorLogs.length} logs`
                              : "Waiting..."}
                          </div>
                        </div>
                      </div>

                      <Tabs defaultValue="node-info" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="node-info">
                            Node Info Data
                          </TabsTrigger>
                          <TabsTrigger value="alarms">Error Logs</TabsTrigger>
                        </TabsList>

                        <TabsContent value="node-info" className="mt-4">
                          {nodeInfoData ? (
                            <ScrollArea className="h-96 w-full border rounded-md">
                              <div className="p-4 space-y-4">
                                {/* Topic Info */}
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    Node Info Topic
                                  </Badge>
                                  <code className="bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded text-sm border border-blue-200 dark:border-blue-800">
                                    {subscribedTopics[0]}
                                  </code>
                                </div>

                                {/* System Information Card */}
                                <Card className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                                  <CardHeader>
                                    <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                      <Server className="h-5 w-5" />
                                      System Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium">
                                          Node Name
                                        </Label>
                                        <div className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">
                                          {nodeInfoData.name || "N/A"}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium">
                                          MAC Address
                                        </Label>
                                        <div className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                                          {nodeInfoData.mac_address || "N/A"}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium">
                                          Latitude
                                        </Label>
                                        <div className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">
                                          {config.latitude !== undefined
                                            ? config.latitude.toFixed(6)
                                            : "N/A"}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium">
                                          Longitude
                                        </Label>
                                        <div className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">
                                          {config.longitude !== undefined
                                            ? config.longitude.toFixed(6)
                                            : "N/A"}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Network Information Card */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
                                      <Network className="h-5 w-5" />
                                      Network Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline">
                                            Ethernet
                                          </Badge>
                                        </div>
                                        <div className="pl-3 space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              IP Address:
                                            </span>
                                            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                                              {nodeInfoData.ip_eth || "N/A"}
                                            </code>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              MAC:
                                            </span>
                                            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                                              {nodeInfoData.mac_address_eth ||
                                                "N/A"}
                                            </code>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline">WiFi</Badge>
                                        </div>
                                        <div className="pl-3 space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              IP Address:
                                            </span>
                                            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                                              {nodeInfoData.ip_wlan || "N/A"}
                                            </code>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              MAC:
                                            </span>
                                            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                                              {nodeInfoData.mac_address_wlan ||
                                                "N/A"}
                                            </code>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Device Status Card */}
                                {nodeInfoData.device_status && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5" />
                                        Device Status
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                                          <div className="text-2xl font-bold text-yellow-600">
                                            {nodeInfoData.device_status
                                              .cpu_usage_percent || 0}
                                            %
                                          </div>
                                          <div className="text-xs text-yellow-700 dark:text-yellow-300">
                                            CPU Usage
                                          </div>
                                        </div>
                                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                                          <div className="text-2xl font-bold text-blue-600">
                                            {nodeInfoData.device_status
                                              .ram_usage_percent || 0}
                                            %
                                          </div>
                                          <div className="text-xs text-blue-700 dark:text-blue-300">
                                            RAM Usage
                                          </div>
                                        </div>
                                        <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                                          <div className="text-2xl font-bold text-red-600">
                                            {nodeInfoData.device_status
                                              .cpu_temperature_celsius || "N/A"}
                                            °C
                                          </div>
                                          <div className="text-xs text-red-700 dark:text-red-300">
                                            CPU Temp
                                          </div>
                                        </div>
                                        <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                                          <div className="text-2xl font-bold text-green-600">
                                            {Math.round(
                                              (nodeInfoData.device_status
                                                .system_uptime_hours || 0) * 10
                                            ) / 10}
                                            h
                                          </div>
                                          <div className="text-xs text-green-700 dark:text-green-300">
                                            Uptime
                                          </div>
                                        </div>
                                      </div>
                                      <Separator className="my-4" />
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Storage:
                                          </span>
                                          <span className="font-medium">
                                            {nodeInfoData.device_status
                                              .storage_usage_percent || 0}
                                            %
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            CPU Cores:
                                          </span>
                                          <span className="font-medium">
                                            {nodeInfoData.device_status
                                              .cpu_count_logical || "N/A"}
                                          </span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}

                                {/* Devices Cards */}
                                {nodeInfoData.data && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Modbus Devices */}
                                    {Array.isArray(nodeInfoData.data.modbus) &&
                                      nodeInfoData.data.modbus.length > 0 && (
                                        <Card>
                                          <CardHeader>
                                            <CardTitle className="text-sm flex items-center gap-2">
                                              <Badge variant="outline">
                                                Modbus RTU
                                              </Badge>
                                              <span>
                                                Devices (
                                                {
                                                  nodeInfoData.data.modbus
                                                    .length
                                                }
                                                )
                                              </span>
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                              {nodeInfoData.data.modbus
                                                .slice(0, 3)
                                                .map(
                                                  (
                                                    device: any,
                                                    index: number
                                                  ) => (
                                                    <div
                                                      key={index}
                                                      className="p-2 rounded text-xs border border-gray-100 dark:border-gray-800"
                                                    >
                                                      <div className="font-medium">
                                                        {device.profile?.name ||
                                                          `Device ${index + 1}`}
                                                      </div>
                                                      <div className="text-muted-foreground">
                                                        {device.profile
                                                          ?.device_type ||
                                                          "Unknown"}{" "}
                                                        - Addr:{" "}
                                                        {device.protocol_setting
                                                          ?.address || "N/A"}
                                                      </div>
                                                    </div>
                                                  )
                                                )}
                                              {nodeInfoData.data.modbus.length >
                                                3 && (
                                                <div className="text-center text-xs text-muted-foreground py-1">
                                                  +{" "}
                                                  {nodeInfoData.data.modbus
                                                    .length - 3}{" "}
                                                  more devices
                                                </div>
                                              )}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      )}

                                    {/* Modular Devices */}
                                    {Array.isArray(nodeInfoData.data.modular) &&
                                      nodeInfoData.data.modular.length > 0 && (
                                        <Card>
                                          <CardHeader>
                                            <CardTitle className="text-sm flex items-center gap-2">
                                              <Badge variant="outline">
                                                Modular I2C
                                              </Badge>
                                              <span>
                                                Devices (
                                                {
                                                  nodeInfoData.data.modular
                                                    .length
                                                }
                                                )
                                              </span>
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                              {nodeInfoData.data.modular
                                                .slice(0, 3)
                                                .map(
                                                  (
                                                    device: any,
                                                    index: number
                                                  ) => (
                                                    <div
                                                      key={index}
                                                      className="p-2 rounded text-xs border border-gray-100 dark:border-gray-800"
                                                    >
                                                      <div className="font-medium">
                                                        {device.profile?.name ||
                                                          `Device ${index + 1}`}
                                                      </div>
                                                      <div className="text-muted-foreground">
                                                        {device.profile
                                                          ?.device_type ||
                                                          "Modular"}{" "}
                                                        - Bus:{" "}
                                                        {device.protocol_setting
                                                          ?.device_bus || "N/A"}
                                                      </div>
                                                    </div>
                                                  )
                                                )}
                                              {nodeInfoData.data.modular
                                                .length > 3 && (
                                                <div className="text-center text-xs text-muted-foreground py-1">
                                                  +{" "}
                                                  {nodeInfoData.data.modular
                                                    .length - 3}{" "}
                                                  more devices
                                                </div>
                                              )}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      )}
                                  </div>
                                )}

                                {/* Raw JSON */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-xs text-muted-foreground">
                                      Raw JSON Data
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="bg-gray-900 text-green-400 p-3 rounded-md overflow-x-auto">
                                      <pre className="text-xs font-mono leading-tight">
                                        <code>
                                          {JSON.stringify(
                                            nodeInfoData,
                                            null,
                                            2
                                          )}
                                        </code>
                                      </pre>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </ScrollArea>
                          ) : (
                            <div className="text-center py-12 text-muted-foreground">
                              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <h3 className="text-lg font-medium mb-2">
                                No Node Info Data
                              </h3>
                              <p className="text-sm">
                                Waiting for data from {subscribedTopics[0]}
                              </p>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="alarms" className="mt-4">
                          {errorLogs.length > 0 ? (
                            <ScrollArea className="h-96 w-full border rounded-md">
                              <div className="p-4 space-y-4">
                                {/* Topic Info */}
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">
                                    Error Log Topic
                                  </Badge>
                                  <code className="bg-red-50 dark:bg-red-950 px-2 py-1 rounded text-sm">
                                    {subscribedTopics[1]}
                                  </code>
                                  <div className="text-sm text-muted-foreground ml-auto">
                                    Total logs: {errorLogs.length}
                                  </div>
                                </div>

                                {/* Error Logs Table */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                      <AlertCircle className="h-5 w-5" />
                                      Error Logs ({errorLogs.length})
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                          <TableHead className="w-32">
                                            Type
                                          </TableHead>
                                          <TableHead className="w-40">
                                            Source
                                          </TableHead>
                                          <TableHead className="flex-1 min-w-64">
                                            Message
                                          </TableHead>
                                          <TableHead className="w-48">
                                            Timestamp
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {errorLogs
                                          .slice(0, 20)
                                          .map((log: any, index: number) => {
                                            const getErrorColor = (
                                              type: string
                                            ) => {
                                              const typeMap: Record<
                                                string,
                                                {
                                                  bg: string;
                                                  text: string;
                                                  icon: React.ReactNode;
                                                }
                                              > = {
                                                CRITICAL: {
                                                  bg: "bg-red-100 dark:bg-red-950",
                                                  text: "text-red-800 dark:text-red-200",
                                                  icon: (
                                                    <AlertOctagon className="h-4 w-4" />
                                                  ),
                                                },
                                                ERROR: {
                                                  bg: "bg-orange-100 dark:bg-orange-950",
                                                  text: "text-orange-800 dark:text-orange-200",
                                                  icon: (
                                                    <AlertCircle className="h-4 w-4" />
                                                  ),
                                                },
                                                WARNING: {
                                                  bg: "bg-yellow-100 dark:bg-yellow-950",
                                                  text: "text-yellow-800 dark:text-yellow-200",
                                                  icon: (
                                                    <AlertTriangle className="h-4 w-4" />
                                                  ),
                                                },
                                                INFO: {
                                                  bg: "bg-blue-100 dark:bg-blue-950",
                                                  text: "text-blue-800 dark:text-blue-200",
                                                  icon: (
                                                    <Info className="h-4 w-4" />
                                                  ),
                                                },
                                                MAJOR: {
                                                  bg: "bg-red-100 dark:bg-red-950",
                                                  text: "text-red-800 dark:text-red-200",
                                                  icon: (
                                                    <AlertOctagon className="h-4 w-4" />
                                                  ),
                                                },
                                                MINOR: {
                                                  bg: "bg-blue-100 dark:bg-blue-950",
                                                  text: "text-blue-800 dark:text-blue-200",
                                                  icon: (
                                                    <Info className="h-4 w-4" />
                                                  ),
                                                },
                                              };
                                              return (
                                                typeMap[type] || typeMap["INFO"]
                                              );
                                            };

                                            const errorColor = getErrorColor(
                                              log.type
                                            );

                                            return (
                                              <TableRow
                                                key={log.id || index}
                                                className="hover:bg-muted/50 transition-colors"
                                              >
                                                <TableCell className="w-32 py-3">
                                                  <div
                                                    className={`flex items-center gap-2 px-2 py-1 rounded-md w-fit ${errorColor.bg}`}
                                                  >
                                                    {errorColor.icon}
                                                    <span
                                                      className={`text-xs font-semibold ${errorColor.text}`}
                                                    >
                                                      {log.type}
                                                    </span>
                                                  </div>
                                                </TableCell>
                                                <TableCell className="w-40 py-3">
                                                  <Badge variant="outline">
                                                    {log.source}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell className="flex-1 min-w-64 py-3">
                                                  <p className="truncate text-sm">
                                                    {log.data}
                                                  </p>
                                                </TableCell>
                                                <TableCell className="w-48 py-3 text-sm text-muted-foreground">
                                                  <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3 flex-shrink-0" />
                                                    <span>
                                                      {new Date(
                                                        log.Timestamp ||
                                                          log.receivedAt
                                                      ).toLocaleString()}
                                                    </span>
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                      </TableBody>
                                    </Table>

                                    {errorLogs.length > 20 && (
                                      <div className="text-center text-sm text-muted-foreground py-4">
                                        ... and {errorLogs.length - 20} more
                                        error logs
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>

                                {/* Raw JSON Data */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-xs text-muted-foreground">
                                      Latest Error Log JSON
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="bg-gray-900 text-green-400 p-3 rounded-md overflow-x-auto">
                                      <pre className="text-xs font-mono leading-tight">
                                        <code>
                                          {JSON.stringify(
                                            errorLogs[0],
                                            null,
                                            2
                                          )}
                                        </code>
                                      </pre>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </ScrollArea>
                          ) : (
                            <div className="text-center py-12 text-muted-foreground">
                              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <h3 className="text-lg font-medium mb-2">
                                No Error Logs
                              </h3>
                              <p className="text-sm">
                                Waiting for error logs from{" "}
                                {subscribedTopics[1]}
                              </p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Current Configuration
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetConfig}
                disabled={mqttStatus !== "connected" || isLoading}
                className="ml-auto"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Get Current
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BASE_TOPIC_MQTT - Left */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="baseTopic">Base MQTT Topic</Label>
                  <div className="text-xs text-muted-foreground">
                    Must end with "/" character
                  </div>
                </div>
                <Input
                  id="baseTopic"
                  placeholder="e.g., NODE_GATEWAY/"
                  value={config.BASE_TOPIC_MQTT}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      BASE_TOPIC_MQTT: e.target.value,
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateBaseTopic}
                    disabled={mqttStatus !== "connected" || isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Update Base Topic
                  </Button>
                </div>
              </div>

              {/* NODE_NAME - Right */}
              <div className="space-y-2">
                <Label htmlFor="nodeName">Node Name</Label>
                <Input
                  id="nodeName"
                  placeholder="e.g. NODE_JAKARTA_1"
                  value={config.NODE_NAME}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      NODE_NAME: e.target.value,
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateNodeName}
                    disabled={mqttStatus !== "connected" || isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Update Node Name
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Update All Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                Update All Configuration
              </h3>
              <div className="flex gap-4">
                <Button
                  onClick={handleUpdateAll}
                  disabled={
                    mqttStatus !== "connected" ||
                    isSaving ||
                    !config.NODE_NAME.trim() ||
                    !config.BASE_TOPIC_MQTT.trim()
                  }
                >
                  <Save className="h-4 w-4 mr-2" />
                  Update All Settings
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReloadConfig}
                  disabled={mqttStatus !== "connected" || isSaving}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Config
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GPS Location Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              GPS Location Management
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetLocation}
                disabled={mqttStatus !== "connected" || isGettingLocation}
                className="ml-auto"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    isGettingLocation ? "animate-spin" : ""
                  }`}
                />
                Get from Config
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Current Location Display */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Current Location
              </h3>
              <div className="space-y-4">
                {/* Accuracy Warning */}
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-yellow-800 dark:text-yellow-200">
                        Low Accuracy Warning
                      </div>
                      <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        Current location uses IP-based geolocation with ~10-50km
                        accuracy (city-level only). For precise location
                        tracking, consider using GPS hardware with gpsd service.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">
                      Latitude
                    </div>
                    <div className="text-xl font-mono font-bold text-green-600">
                      {config.latitude !== undefined
                        ? config.latitude.toFixed(6)
                        : "N/A"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">
                      Longitude
                    </div>
                    <div className="text-xl font-mono font-bold text-green-600">
                      {config.longitude !== undefined
                        ? config.longitude.toFixed(6)
                        : "N/A"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">
                      Last Updated
                    </div>
                    <div className="text-sm font-mono">
                      {config.location_updated
                        ? new Date(config.location_updated).toLocaleString()
                        : "Never"}
                    </div>
                  </div>
                  <div className="text-center flex items-center justify-center">
                    {config.latitude !== undefined &&
                      config.longitude !== undefined && (
                        <Button
                          onClick={() => {
                            const googleMapsUrl = `https://www.google.com/maps?q=${config.latitude},${config.longitude}`;
                            window.open(
                              googleMapsUrl,
                              "_blank",
                              "noopener,noreferrer"
                            );
                            toast.success("Opening location in Google Maps");
                          }}
                          variant="outline"
                          size="sm"
                          className="text-xs px-2 py-1 h-8"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Maps
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Location Actions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Location Actions</h3>
              <p className="text-sm text-muted-foreground">
                Get current location automatically or set coordinates manually.
              </p>

              {/* Action Buttons - Side by Side */}
              <div className="flex gap-4 items-center">
                <Button
                  onClick={handleGetCurrentLocation}
                  disabled={mqttStatus !== "connected" || isGettingLocation}
                  className="flex-1"
                >
                  <Navigation
                    className={`h-4 w-4 mr-2 ${
                      isGettingLocation ? "animate-spin" : ""
                    }`}
                  />
                  {isGettingLocation
                    ? "Getting Location..."
                    : "Get Current Location"}
                </Button>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mqttStatus !== "connected"}
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Set Manual Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold">
                          Set Manual Location
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Enter precise latitude and longitude coordinates.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dialogLatitude">Latitude</Label>
                          <Input
                            id="dialogLatitude"
                            type="number"
                            step="0.0001"
                            min="-90"
                            max="90"
                            placeholder="-6.2088"
                            value={manualLatitude}
                            onChange={(e) => setManualLatitude(e.target.value)}
                          />
                          <div className="text-xs text-muted-foreground">
                            Range: -90 to 90 (e.g., -6.2088 for Jakarta)
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dialogLongitude">Longitude</Label>
                          <Input
                            id="dialogLongitude"
                            type="number"
                            step="0.0001"
                            min="-180"
                            max="180"
                            placeholder="106.8456"
                            value={manualLongitude}
                            onChange={(e) => setManualLongitude(e.target.value)}
                          />
                          <div className="text-xs text-muted-foreground">
                            Range: -180 to 180 (e.g., 106.8456 for Jakarta)
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <DialogTrigger asChild>
                          <Button variant="outline" className="flex-1">
                            Cancel
                          </Button>
                        </DialogTrigger>
                        <Button
                          onClick={handleSetManualLocation}
                          disabled={
                            isSettingLocation ||
                            !manualLatitude.trim() ||
                            !manualLongitude.trim()
                          }
                          className="flex-1"
                        >
                          <MapPin
                            className={`h-4 w-4 mr-2 ${
                              isSettingLocation ? "animate-spin" : ""
                            }`}
                          />
                          {isSettingLocation ? "Setting..." : "Set Location"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="text-xs text-muted-foreground">
                <strong>Get Current Location:</strong> Attempts GPS hardware
                first, then IP-based geolocation as fallback (~10-50km
                accuracy).
                <br />
                <strong>Set Manual Location:</strong> Enter precise coordinates
                for 100% accuracy.
              </div>

              <Separator className="my-6" />

              {/* Node Location Registration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Node Location Registration
                </h3>
                <p className="text-sm text-muted-foreground">
                  Discover and register location data from active nodes
                  automatically.
                </p>

                <Dialog
                  open={registerDialogOpen}
                  onOpenChange={setRegisterDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={mqttStatus !== "connected"}
                      className="w-full"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Register Node Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold">
                          Register Node Location
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Select a node to discover its location data
                          automatically.
                        </p>
                      </div>

                      {/* Node Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="nodeSelect">Available Nodes</Label>
                        <select
                          id="nodeSelect"
                          value={selectedNodeForRegistration}
                          onChange={(e) =>
                            setSelectedNodeForRegistration(e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select a node...</option>
                          {availableNodes.map((node) => (
                            <option key={node} value={node}>
                              {node}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-muted-foreground">
                          Nodes are discovered from MQTT topics automatically
                        </div>
                      </div>

                      {/* Discovered Location Display */}
                      {discoveredLocation && (
                        <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800 dark:text-green-200">
                              Location Discovered!
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Latitude
                              </Label>
                              <div className="font-mono text-green-700 dark:text-green-300">
                                {discoveredLocation.latitude?.toFixed(6) ||
                                  "N/A"}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Longitude
                              </Label>
                              <div className="font-mono text-green-700 dark:text-green-300">
                                {discoveredLocation.longitude?.toFixed(6) ||
                                  "N/A"}
                              </div>
                            </div>
                          </div>
                          {discoveredLocation.last_update && (
                            <div className="text-xs text-muted-foreground">
                              Last updated:{" "}
                              {new Date(
                                discoveredLocation.last_update
                              ).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4">
                        <DialogTrigger asChild>
                          <Button variant="outline" className="flex-1">
                            Cancel
                          </Button>
                        </DialogTrigger>

                        {!discoveredLocation ? (
                          <Button
                            onClick={handleStartNodeRegistration}
                            disabled={
                              !selectedNodeForRegistration ||
                              isRegisteringLocation
                            }
                            className="flex-1"
                          >
                            <Eye
                              className={`h-4 w-4 mr-2 ${
                                isRegisteringLocation ? "animate-spin" : ""
                              }`}
                            />
                            {isRegisteringLocation
                              ? "Discovering..."
                              : "Discover Location"}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleRegisterDiscoveredLocation}
                            disabled={isRegisteringLocation}
                            className="flex-1"
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            Register Location
                          </Button>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <strong>Step 1:</strong> Select node to discover its
                        location
                        <br />
                        <strong>Step 2:</strong> System subscribes to node topic
                        and captures location data
                        <br />
                        <strong>Step 3:</strong> Register discovered coordinates
                        to configuration
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
