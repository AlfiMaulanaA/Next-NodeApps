"use client";

import { useEffect, useRef, useState } from "react";
// import mqtt from "mqtt"; // Remove direct mqtt import
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wifi, WifiOff, Loader2, RefreshCw, Radar, Repeat, Trash2 } from "lucide-react";
import { connectMQTT } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt"; // Import MqttClient type for useRef
import MqttStatus from "@/components/mqtt-status";

interface Network {
  ssid: string;
  signal_strength: number;
}

export default function WifiScannerPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [networks, setNetworks] = useState<Network[]>([]);
  const [tab, setTab] = useState("scan");
  const [chosenSsid, setChosenSsid] = useState("");
  const [password, setPassword] = useState("");
  const [delSsid, setDelSsid] = useState("");

  const clientRef = useRef<MqttClient>(); // Use MqttClient type

  useEffect(() => {
    // Connect using the centralized function
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      setStatus("connected");
      // Subscribe to necessary topics
      mqttClientInstance.subscribe("wifi/scan_results");
      mqttClientInstance.subscribe("wifi/ip_update");
    };

    const handleError = () => setStatus("error");
    const handleClose = () => setStatus("disconnected");

    const handleMessage = (topic: string, payload: Buffer) => {
      try {
        const msg = JSON.parse(payload.toString());
        // Process messages based on topic
        if (topic === "wifi/scan_results") {
          setNetworks(msg.networks || []);
          toast.success("Wi-Fi scan complete");
        } else if (topic === "wifi/ip_update" && msg.status === "success") {
          toast.success(`Switched to ${msg.ssid}, new IP: ${msg.ip}`);
        } else if (msg.status === "error") {
          toast.error(msg.message || "An error occurred.");
        }
      } catch (err) {
        toast.error("Invalid data received");
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
        mqttClientInstance.unsubscribe("wifi/scan_results");
        mqttClientInstance.unsubscribe("wifi/ip_update");
      }
      // Detach event listeners to prevent memory leaks
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
      // Do NOT call client.end() here; it's managed globally.
    };
  }, []);

  const scanWifi = () => {
    clientRef.current?.publish("wifi/scan_request", "{}", (err) => {
      if (err) toast.error(`Failed to request scan: ${err.message}`);
    });
  };

  const switchWifi = () => {
    if (!chosenSsid || !password) {
      toast.error("SSID & password required");
      return;
    }
    clientRef.current?.publish("wifi/switch_wifi", JSON.stringify({ ssid: chosenSsid, password }), (err) => {
      if (err) toast.error(`Failed to switch Wi-Fi: ${err.message}`);
      else toast.success(`Switching to ${chosenSsid}...`);
    });
  };

  const deleteWifi = () => {
    if (!delSsid) {
      toast.error("SSID required");
      return;
    }
    clientRef.current?.publish("wifi/delete_wifi", JSON.stringify({ ssid: delSsid }), (err) => {
      if (err) toast.error(`Failed to delete Wi-Fi: ${err.message}`);
      else toast.success(`Deleted ${delSsid}`);
    });
  };

  const signalColor = (s: number) =>
    s >= 60 ? "text-green-600" : s >= 30 ? "text-orange-500" : "text-red-600";

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Wifi className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Wi‑Fi Scanner</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button variant="outline" size="icon" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6">
        <Tabs defaultValue="scan" value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="scan">
              <Radar className="w-4 h-4 mr-1" /> Scan
            </TabsTrigger>
            <TabsTrigger value="switch">
              <Repeat className="w-4 h-4 mr-1" /> Switch Wi‑Fi
            </TabsTrigger>
            <TabsTrigger value="delete">
              <Trash2 className="w-4 h-4 mr-1" /> Delete Wi‑Fi
            </TabsTrigger>
          </TabsList>

          {/* SCAN */}
          <TabsContent value="scan">
            <Card>
              <CardHeader>
                <CardTitle>Nearby Networks</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={scanWifi}>Start Scan</Button>
                <div className="mt-4">
                  {networks.length === 0 ? (
                    <p>No networks found.</p>
                  ) : (
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr><th className="text-left">SSID</th><th className="text-left">Signal</th></tr>
                      </thead>
                      <tbody>
                        {networks.map((n) => (
                          <tr key={n.ssid}>
                            <td>{n.ssid}</td>
                            <td className={signalColor(n.signal_strength)}>{n.signal_strength}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SWITCH */}
          <TabsContent value="switch">
            <Card>
              <CardHeader><CardTitle>Switch Wi‑Fi</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <select
                  value={chosenSsid}
                  onChange={(e) => setChosenSsid(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">Select SSID</option>
                  {networks.map((n) => (
                    <option key={n.ssid} value={n.ssid}>
                      {n.ssid} ({n.signal_strength})
                    </option>
                  ))}
                </select>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button onClick={switchWifi}>Switch</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DELETE */}
          <TabsContent value="delete">
            <Card>
              <CardHeader><CardTitle>Delete Wi‑Fi</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="SSID to delete"
                  value={delSsid}
                  onChange={(e) => setDelSsid(e.target.value)}
                />
                <Button variant="destructive" onClick={deleteWifi}>Delete</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarInset>
  );
}