"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2, Server, ScanLine, RotateCw, Network } from "lucide-react";
import axios from "axios";
import { Button } from "@/components/ui/button";

type DeviceInfo = {
  mac: string;
  ip: string;
  mqtthost: string;
  chipset: string;
  manufacture: string;
  webapp: string;
  shortName: string;
  build: string;
};

type ScanResult = {
  ip: string;
  mac: string;
  chipset: string;
  mqtthost: string;
  shortName: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function ScanInfoPage() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingScan, setLoadingScan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInfo();
  }, []);

  const fetchInfo = async () => {
    setLoadingInfo(true);
    setError(null);
    try {
      const res = await axios.get<DeviceInfo>(`${API_BASE_URL}/api/info`);
      setInfo(res.data);
    } catch (err) {
      console.error("Error fetching device info:", err);
      setError("Failed to fetch device info.");
    } finally {
      setLoadingInfo(false);
    }
  };

  const scanNetwork = async () => {
    setLoadingScan(true);
    setError(null);
    try {
      const res = await axios.get<ScanResult[]>(`${API_BASE_URL}/api/scan?range=192.168.0`);
      setScanResults(res.data);
    } catch (err) {
      console.error("Error scanning network:", err);
      setError("Failed to scan the network.");
    } finally {
      setLoadingScan(false);
    }
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Devices System Info</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchInfo}>
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <Tabs defaultValue="info">
          <TabsList className="mb-4">
            <TabsTrigger value="info">
              <Server className="mr-2 h-4 w-4" /> Device Info
            </TabsTrigger>
            <TabsTrigger value="scan">
              <ScanLine className="mr-2 h-4 w-4" /> Network Scan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardContent className="p-4">
                {loadingInfo ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin w-5 h-5" />
                    <span>Loading device info...</span>
                  </div>
                ) : error ? (
                  <p className="text-red-600">{error}</p>
                ) : info ? (
                  <div className="space-y-2 text-sm">
                    <p><strong>MAC:</strong> {info.mac}</p>
                    <p><strong>IP:</strong> {info.ip}</p>
                    <p><strong>MQTT Host:</strong> {info.mqtthost}</p>
                    <p><strong>Chipset:</strong> {info.chipset}</p>
                    <p><strong>Manufacture:</strong> {info.manufacture}</p>
                    <p>
                      <strong>Web App:</strong>{" "}
                      <a
                        href={info.webapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {info.webapp}
                      </a>
                    </p>
                    <p><strong>Short Name:</strong> {info.shortName}</p>
                    <p><strong>Build:</strong> {info.build}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No information available.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scan">
            <div className="mb-2 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Scan Network</h2>
              <Button onClick={scanNetwork} disabled={loadingScan}>
                {loadingScan ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" />
                    Scanning...
                  </div>
                ) : (
                  "Scan"
                )}
              </Button>
            </div>
            <Separator className="mb-4" />
            {error && <p className="text-red-600 mb-2">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scanResults.length === 0 && !loadingScan && (
                <p className="text-muted-foreground">No devices found.</p>
              )}
              {scanResults.map((device, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4 space-y-1 text-sm">
                    <p><strong>IP:</strong> {device.ip}</p>
                    <p><strong>MAC:</strong> {device.mac}</p>
                    <p><strong>Chipset:</strong> {device.chipset}</p>
                    <p><strong>MQTT Host:</strong> {device.mqtthost}</p>
                    <p><strong>Short Name:</strong> {device.shortName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarInset>
  );
}
