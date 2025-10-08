"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AlertTriangle, Wifi, Loader2, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { showToast } from '@/lib/toast-utils';
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";

interface SnmpResult {
  oid: string;
  type: number;
  value: string;
}

// --- SNMP Data Topics ---
const SNMP_DATA_COMMAND_TOPIC = "snmp/data/command";
const SNMP_DATA_RESPONSE_TOPIC = "snmp/data/response";

export default function SNMPGetPage() {
  const [formData, setFormData] = useState({
    host: "",
    community: "public",
    oid: "",
    version: "v2c",
    value: "",      // For SNMP SET operation
    type: "s",      // SNMP data type: s=string, i=integer, etc.
  });
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SnmpResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<MqttClient | null>(null);

  // --- useEffect for MQTT Connection and Message Handling ---
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    // Subscribe to response topics
    mqttClientInstance.subscribe(SNMP_DATA_RESPONSE_TOPIC, { qos: 0 }, (err) => {
      if (err) console.error(`Failed to subscribe to ${SNMP_DATA_RESPONSE_TOPIC}:`, err);
    });

    // MQTT 'connect' event handler
    const handleConnect = () => {
      console.log("MQTT Connected for SNMP Operations");
    };

    // MQTT 'message' event handler
    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log(`Received message on topic ${topic}:`, payload);

        if (topic === SNMP_DATA_RESPONSE_TOPIC) {
          setIsLoading(false);
          if (payload.success) {
            setResults(payload.results || []);
            setError(null);
            toast.success("SNMP operation completed successfully");
          } else {
            setError(payload.error || "Unknown SNMP error");
            toast.error(`SNMP operation failed: ${payload.error}`);
          }
        }
      } catch (e) {
        console.error("Error parsing MQTT message:", message.toString(), e);
        setIsLoading(false);
        setError("Invalid response from MQTT");
      }
    };

    // MQTT 'error' event handler
    const handleError = (err: any) => {
      console.error("MQTT Client error:", err);
      toast.error(`MQTT connection error: ${err.message}`);
      setIsLoading(false);
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);
    mqttClientInstance.on("error", handleError);

    // Cleanup function for unmounting
    return () => {
      if (clientRef.current) {
        clientRef.current.unsubscribe(SNMP_DATA_RESPONSE_TOPIC);
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("message", handleMessage);
        clientRef.current.off("error", handleError);
      }
    };
  }, []);

  const copyToClipboard = async (oid: string) => {
    try {
      await navigator.clipboard.writeText(oid);
      showToast.success('OID Copied', `${oid} has been copied to clipboard`);
    } catch (err) {
      // Fallback for browsers that don't support clipboard or HTTP
      try {
        // Fallback for IE and mobile browsers
        const textArea = document.createElement('textarea');
        textArea.value = oid;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        showToast.success('OID Copied', `${oid} has been copied to clipboard (fallback method)`);
      } catch (fallbackErr) {
        showToast.error('Copy Failed', 'Unable to copy OID to clipboard. Please copy manually.');
        console.error('Failed to copy:', err, fallbackErr);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.host || !formData.community || !formData.oid) {
      toast.error("All fields are required");
      return false;
    }
    // Basic IP validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(formData.host)) {
      // Could be hostname, but for now require IP
      toast.error("Please enter a valid IP address");
      return false;
    }
    return true;
  };

  const performSNMPOperation = (operation: "get" | "walk") => {
    if (!validateForm()) return;

    setIsLoading(true);
    setResults(null);
    setError(null);

    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      setIsLoading(false);
      return;
    }

    client.publish(SNMP_DATA_COMMAND_TOPIC, JSON.stringify({
      operation,
      host: formData.host,
      community: formData.community,
      oid: formData.oid,
      version: formData.version,
    }), (err) => {
      if (err) {
        console.error("Publish error:", err);
        toast.error(`Failed to send SNMP ${operation} command: ${err.message}`);
        setIsLoading(false);
      } else {
        toast.info(`Sending SNMP ${operation.toUpperCase()} command...`);
      }
    });
  };

  const performSNMPSET = () => {
    // Separate validation for SET operation
    if (!formData.host) {
      toast.error("Device IP Address is required");
      return false;
    }
    if (!formData.community) {
      toast.error("Community string is required");
      return false;
    }
    if (!formData.oid) {
      toast.error("OID is required for SET operation");
      return false;
    }
    if (!formData.value) {
      toast.error("Value is required for SET operation");
      return false;
    }

    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(formData.host)) {
      toast.error("Please enter a valid IP address");
      return false;
    }

    setIsLoading(true);
    setResults(null);
    setError(null);

    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      setIsLoading(false);
      return;
    }

    client.publish(SNMP_DATA_COMMAND_TOPIC, JSON.stringify({
      operation: "set",
      host: formData.host,
      community: formData.community,
      oid: formData.oid,
      version: formData.version,
      value: formData.value,
      type: formData.type,
    }), (err) => {
      if (err) {
        console.error("Publish error:", err);
        toast.error(`Failed to send SNMP SET command: ${err.message}`);
        setIsLoading(false);
      } else {
        toast.info(`Sending SNMP SET command...`);
      }
    });
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-lg font-semibold tracking-tight">SNMP Data Get/Walk</h1>
        </div>
      </header>

      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-md">SNMP Operations</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="host">Device IP Address</Label>
                <Input
                  id="host"
                  name="host"
                  type="text"
                  value={formData.host}
                  onChange={handleChange}
                  placeholder="192.168.1.100"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="community">Community</Label>
                <Input
                  id="community"
                  name="community"
                  type="text"
                  value={formData.community}
                  onChange={handleChange}
                  placeholder="public"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="oid">OID to Query/Set</Label>
                <Input
                  id="oid"
                  name="oid"
                  type="text"
                  value={formData.oid}
                  onChange={handleChange}
                  placeholder="1.3.6.1.2.1.1.5.0"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="version">SNMP Version</Label>
                <Select value={formData.version} onValueChange={(value) => setFormData(prev => ({ ...prev, version: value }))}>
                  <SelectTrigger disabled={isLoading}>
                    <SelectValue placeholder="Select SNMP version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1">SNMP v1</SelectItem>
                    <SelectItem value="v2c">SNMP v2c (Default)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SET Operation Fields - shown only when SET is active */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value">Value (for SET operation)</Label>
                <Input
                  id="value"
                  name="value"
                  type="text"
                  value={formData.value}
                  onChange={handleChange}
                  placeholder="New value to set"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="type">SNMP Type (for SET operation)</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger disabled={isLoading}>
                    <SelectValue placeholder="Data type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s">String (s)</SelectItem>
                    <SelectItem value="i">Integer (i)</SelectItem>
                    <SelectItem value="u">Unsigned (u)</SelectItem>
                    <SelectItem value="t">Timeticks (t)</SelectItem>
                    <SelectItem value="a">IP Address (a)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => performSNMPOperation("get")}
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
                SNMP GET
              </Button>
              <Button
                onClick={() => performSNMPOperation("walk")}
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
                SNMP WALK
              </Button>
              <Button
                onClick={performSNMPSET}
                disabled={isLoading}
                variant="default"
                color="destructive"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
                SNMP SET
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {results && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="table" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="table">Table View</TabsTrigger>
                  <TabsTrigger value="json">JSON View</TabsTrigger>
                </TabsList>
                <TabsContent value="table">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">OID</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((result, index) => (
                          <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs bg-muted text-muted-foreground border-border">
                                  {result.oid}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(result.oid)}
                                  className="h-6 w-6 p-0 hover:bg-muted"
                                  title="Copy OID to clipboard"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="p-2">
                              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                {result.type}
                              </Badge>
                            </td>
                            <td className="p-2 font-mono break-all text-sm">{String(result.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                <TabsContent value="json">
                  <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
}
