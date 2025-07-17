"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner"; // Import toast for notifications
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RefreshCw, Save, Settings2, Wifi, Loader2 } from "lucide-react"; // Add Loader2 for loading state
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import MqttStatus from "@/components/mqtt-status"; // Assuming this component shows MQTT connection status
import type { MqttClient } from "mqtt"; // Import MqttClient type

const SNMP_SETTING_TOPIC_COMMAND = "IOT/Containment/snmp/setting/command";
const SNMP_SETTING_TOPIC_DATA = "IOT/Containment/snmp/setting/data";
const SNMP_STATUS_TOPIC = "IOT/Containment/snmp/status";
const SNMP_STATUS_COMMAND_TOPIC = "IOT/Containment/snmp/status/command";

// Define a type for your form data for better type safety
interface SnmpConfig {
  snmpIPaddress: string;
  snmpNetmask: string;
  snmpGateway: string;
  snmpVersion: string; // Changed to string to match Select value
  authKey: string;
  privKey: string;
  securityName: string;
  securityLevel: string; // Changed to string to match Select value
  snmpCommunity: string;
  snmpPort: string; // Changed to string to match Input value
  sysOID: string;
  DeviceName: string;
  Site: string;
  snmpTrapEnabled: boolean;
  ipSnmpManager: string;
  portSnmpManager: number;
  snmpTrapComunity: string;
  snmpTrapVersion: string; // Changed to string to match Select value
  timeDelaySnmpTrap: number;
}

export default function SNMPSettingPage() {
  const [formData, setFormData] = useState<SnmpConfig>({
    snmpIPaddress: "",
    snmpNetmask: "",
    snmpGateway: "",
    snmpVersion: "3",
    authKey: "",
    privKey: "",
    securityName: "",
    securityLevel: "authPriv",
    snmpCommunity: "",
    snmpPort: "161",
    sysOID: "",
    DeviceName: "",
    Site: "",
    snmpTrapEnabled: true,
    ipSnmpManager: "",
    portSnmpManager: 162,
    snmpTrapComunity: "",
    snmpTrapVersion: "2",
    timeDelaySnmpTrap: 30,
  });

  const [snmpStatus, setSnmpStatus] = useState<string>("Unknown"); // Changed name to avoid conflict with MQTT status
  const [isLoading, setIsLoading] = useState(true); // New loading state
  const clientRef = useRef<MqttClient | null>(null); // Reference to MQTT client

  // Callback to get current SNMP settings
  const getConfig = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.warning("MQTT not connected. Cannot retrieve SNMP settings.");
      setIsLoading(false); // Stop loading if not connected
      return;
    }

    setIsLoading(true); // Start loading state
    setTimeout(() => {
      client.publish(SNMP_SETTING_TOPIC_COMMAND, JSON.stringify({ command: "read" }));
      toast.info("Requesting SNMP settings...");
    }, 300); // Small delay to ensure subscription is active
  }, []);

  // Callback to check SNMP service status
  const checkStatus = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.warning("MQTT not connected. Cannot check SNMP status.");
      return;
    }
    client.publish(SNMP_STATUS_COMMAND_TOPIC, JSON.stringify({ command: "check status" }));
    toast.info("Checking SNMP service status...");
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      SNMP_SETTING_TOPIC_DATA,
      SNMP_STATUS_TOPIC,
    ];

    // Subscribe to all necessary topics immediately
    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });

    // If MQTT client is already connected on mount, request config and status immediately
    if (mqttClientInstance.connected) {
      getConfig();
      checkStatus();
    }

    // Listener for successful MQTT connection
    const handleConnect = () => {
      // Re-subscribe in case of re-connection (though mqtt.js handles this, good practice)
      topicsToSubscribe.forEach((topic) => {
        mqttClientInstance.subscribe(topic, (err) => {
          if (err) console.error(`Failed to subscribe to ${topic} on reconnect:`, err);
        });
      });
      getConfig(); // Request config on every successful connection
      checkStatus(); // Check status on every successful connection
      toast.success("MQTT Connected for SNMP settings. Fetching data...");
    };

    // Listener for incoming MQTT messages
    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());

        if (topic === SNMP_SETTING_TOPIC_DATA) {
          // Map incoming payload keys to formData state keys
          const updatedFormData = {
            snmpIPaddress: payload.snmpIPaddress || "",
            snmpNetmask: payload.snmpNetmask || "",
            snmpGateway: payload.snmpGateway || "",
            snmpVersion: String(payload.snmpVersion || "3"),
            authKey: payload.authKey || "",
            privKey: payload.privKey || "",
            securityName: payload.securityName || "",
            securityLevel: String(payload.securityLevel || "authPriv"),
            snmpCommunity: payload.snmpCommunity || "",
            snmpPort: String(payload.snmpPort || "161"),
            sysOID: payload.sysOID || "",
            DeviceName: payload.DeviceName || "",
            Site: payload.Site || "",
            snmpTrapEnabled: typeof payload.snmpTrapEnabled === 'boolean' ? payload.snmpTrapEnabled : true,
            ipSnmpManager: payload.ipSnmpManager || "",
            portSnmpManager: Number(payload.portSnmpManager) || 162,
            snmpTrapComunity: payload.snmpTrapComunity || "",
            snmpTrapVersion: String(payload.snmpTrapVersion || "2"),
            timeDelaySnmpTrap: Number(payload.timeDelaySnmpTrap) || 30,
          };
          setFormData(updatedFormData);
          toast.success("SNMP settings loaded! 🎉");
          setIsLoading(false); // Stop loading after data is received
        } else if (topic === SNMP_STATUS_TOPIC) {
          setSnmpStatus(payload.snmpStatus || "Unknown");
          toast.info(`SNMP Status: ${payload.snmpStatus || "Unknown"}`);
        }
      } catch (e) {
        toast.error("Invalid response from MQTT. Check backend payload.");
        console.error("Error parsing MQTT message:", message.toString(), e);
        setIsLoading(false); // Stop loading on parse error
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);

    // Cleanup function
    return () => {
      if (clientRef.current) {
        topicsToSubscribe.forEach((topic) => {
          clientRef.current?.unsubscribe(topic);
        });
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("message", handleMessage);
      }
    };
  }, [getConfig, checkStatus]); // Add callbacks to dependency array

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSelectChange = (name: keyof SnmpConfig, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const writeConfig = () => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Cannot save configuration. 😔");
      return;
    }

    // Basic validation for numbers (port, timeDelay)
    const parsedPort = parseInt(formData.snmpPort, 10);
    const parsedTrapPort = parseInt(String(formData.portSnmpManager), 10); // Ensure it's a string for parseInt
    const parsedTimeDelay = parseInt(String(formData.timeDelaySnmpTrap), 10); // Ensure it's a string for parseInt

    if (isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      toast.error("Invalid SNMP Port. Must be between 1 and 65535.");
      return;
    }
    if (isNaN(parsedTrapPort) || parsedTrapPort <= 0 || parsedTrapPort > 65535) {
      toast.error("Invalid SNMP Trap Manager Port. Must be between 1 and 65535.");
      return;
    }
    if (isNaN(parsedTimeDelay) || parsedTimeDelay <= 0) {
      toast.error("Invalid Time Delay for SNMP Trap. Must be a positive number.");
      return;
    }

    const payloadToSend = {
      command: "write",
      ...formData,
      snmpPort: parsedPort, // Convert to number for sending
      portSnmpManager: parsedTrapPort, // Convert to number for sending
      timeDelaySnmpTrap: parsedTimeDelay, // Convert to number for sending
    };

    setIsLoading(true); // Start loading state
    client.publish(SNMP_SETTING_TOPIC_COMMAND, JSON.stringify(payloadToSend), {}, (err) => {
      if (err) {
        toast.error(`Failed to send write command: ${err.message} 😭`);
        setIsLoading(false); // Stop loading on error
      } else {
        toast.success("Configuration sent. Verifying update...");
        // Re-request config after a short delay to allow backend to process and publish
        setTimeout(() => {
          getConfig();
          checkStatus(); // Also re-check status after config change
        }, 1000); // 1 second delay
      }
    });
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Settings2 className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">SNMP Communication</h1>
        </div>
        <div className="flex gap-2">
          <MqttStatus /> {/* Display MQTT connection status */}
          <Button variant="outline" size="sm" onClick={getConfig} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-1" /> Get Config
          </Button>
          <Button variant="outline" size="sm" onClick={checkStatus}>
            <Wifi className="w-4 h-4 mr-1" /> Check Status
          </Button>
        </div>
      </header>

      <div className="p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          SNMP Service Status: <strong>{snmpStatus}</strong>
        </p>

        <Card>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {isLoading && ( // Show loading indicator if data is being fetched
              <div className="col-span-full flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-lg text-blue-500">Loading SNMP Settings...</span>
              </div>
            )}

            {!isLoading && Object.entries(formData).map(([key, value]) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // Convert camelCase to "Camel Case" for label

              // Special handling for Select components
              if (["snmpVersion", "securityLevel", "snmpTrapVersion"].includes(key)) {
                const options =
                  key === "snmpVersion"
                    ? ["1", "2", "3"]
                    : key === "securityLevel"
                    ? ["noAuthNoPriv", "authNoPriv", "authPriv"]
                    : ["1", "2"];
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <Label htmlFor={key}>{label}</Label>
                    <Select value={String(value)} onValueChange={(val) => handleSelectChange(key as keyof SnmpConfig, val)}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              // Special handling for boolean (checkbox or select for true/false)
              if (typeof value === "boolean") {
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <Label htmlFor={key}>{label}</Label>
                    <Select value={String(value)} onValueChange={(val) => handleSelectChange(key as keyof SnmpConfig, val)}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              // Default for Input components (text or number)
              return (
                <div key={key} className="flex flex-col gap-1">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    name={key}
                    type={typeof value === "number" ? "number" : "text"}
                    value={value}
                    onChange={handleChange}
                  />
                </div>
              );
            })}

            {!isLoading && ( // Only show save button when not loading
              <div className="col-span-full">
                <Button className="w-full" onClick={writeConfig}>
                  <Save className="w-4 h-4 mr-2" /> Save Config
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}