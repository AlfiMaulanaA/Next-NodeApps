"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Network,
  RefreshCw,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import MqttStatus from "@/components/mqtt-status";
import type { MqttClient } from "mqtt";
import { toast } from "@/components/ui/use-toast";
// Import dialog components for modals
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

// --- MQTT Topics ---
const MODBUS_SETTING_COMMAND_TOPIC =
  "IOT/Containment/modbustcp/setting/command";
const MODBUS_SETTING_DATA_TOPIC = "IOT/Containment/modbustcp/setting/data";
const MODBUS_STATUS_TOPIC = "IOT/Containment/modbustcp/status";
const SERVICE_COMMAND_TOPIC = "service/command";
const SERVICE_RESPONSE_TOPIC = "service/response"; // Topic to receive service command responses

export default function ModbusTCPSettingsPage() {
  // --- State Variables ---
  const [modbusIP, setModbusIP] = useState(""); // Current IP from backend
  const [modbusPort, setModbusPort] = useState(""); // Current Port from backend
  const [inputIP, setInputIP] = useState(""); // User input for IP
  const [inputPort, setInputPort] = useState(""); // User input for Port
  const [modbusStatus, setModbusStatus] = useState("Unknown"); // Status of Modbus TCP service
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial data fetch and config save
  const clientRef = useRef<MqttClient | null>(null); // Reference to the MQTT client instance

  // Dialog states for confirmation
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [confirmationDialogContent, setConfirmationDialogContent] = useState<{
    title: string;
    description: string;
    confirmAction: () => void;
  }>({ title: "", description: "", confirmAction: () => {} });

  // Helper function for showing confirmations
  const showConfirmation = (
    title: string,
    description: string,
    confirmAction: () => void
  ) => {
    setConfirmationDialogContent({ title, description, confirmAction });
    setConfirmationDialogOpen(true);
  };

  // --- Utility Functions ---

  /**
   * Requests the current Modbus TCP settings from the backend via MQTT.
   */
  const getCurrentSetting = useCallback(() => {
    const client = clientRef.current; // Use the ref for the client
    if (!client || !client.connected) {
      toast({
        title: "Warning",
        description: "MQTT not connected. Cannot retrieve settings.",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true); // Set loading true when requesting settings
    client.publish(
      MODBUS_SETTING_COMMAND_TOPIC,
      JSON.stringify({ command: "read" }),
      {},
      (err) => {
        if (err) {
          toast({
            title: "Error",
            description: `Failed to request settings: ${err.message}`,
            variant: "destructive",
          });
          console.error("Publish error (read command):", err);
          setIsLoading(false); // Stop loading if publish fails
        } else {
          toast({
            title: "Info",
            description: "Requesting Modbus TCP settings...",
          });
        }
      }
    );
  }, []); // Dependancy array is empty as clientRef.current is a stable ref

  /**
   * Sends a command (restart, stop, start) to a specific service via MQTT.
   * Includes a SweetAlert2 confirmation dialog.
   * @param serviceName The name of the service to command (e.g., "protocol_out.service").
   * @param action The action to perform ("restart", "stop", "start").
   * @param confirmMessage Optional message for the confirmation dialog.
   */
  const sendCommandRestartService = useCallback(
    async (serviceName: string, action: string, confirmMessage?: string) => {
      const client = clientRef.current; // Use the ref for the client
      if (!client || !client.connected) {
        toast({
          title: "Error",
          description:
            "MQTT not connected. Please wait for connection or refresh.",
          variant: "destructive",
        });
        return;
      }

      let proceed = true;
      if (confirmMessage) {
        // Use confirmation dialog instead of Swal
        await new Promise<void>((resolve) => {
          showConfirmation("Are you sure?", confirmMessage, () => {
            proceed = true;
            resolve();
          });
        });
      }

      if (proceed) {
        // The backend expects an array of services
        const payload = JSON.stringify({
          services: [serviceName],
          action: action,
        });

        client.publish(SERVICE_COMMAND_TOPIC, payload, {}, (err) => {
          if (err) {
            toast({
              title: "Error",
              description: `Failed to send command: ${err.message}`,
              variant: "destructive",
            });
            console.error("Publish error (service command):", err);
          } else {
            toast({
              title: "Processing",
              description: `${action.toUpperCase()} ${serviceName} initiated...`,
            });
          }
        });
      }
    },
    []
  ); // Dependancy array is empty as clientRef.current is a stable ref

  // --- useEffect for MQTT Connection and Message Handling ---
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      MODBUS_SETTING_DATA_TOPIC,
      MODBUS_STATUS_TOPIC,
      SERVICE_RESPONSE_TOPIC, // Subscribe to service command responses
    ];

    // Initial subscription attempt for all topics
    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });

    // If client is already connected on mount, fetch settings
    if (mqttClientInstance.connected) {
      getCurrentSetting();
    }

    // MQTT 'connect' event handler - re-subscribe and fetch data on reconnect
    const handleConnect = () => {
      topicsToSubscribe.forEach((topic) => {
        mqttClientInstance.subscribe(topic, (err) => {
          if (err)
            console.error(
              `Failed to re-subscribe to ${topic} on connect:`,
              err
            );
        });
      });
      getCurrentSetting(); // Request configuration every time connection succeeds
      toast({
        title: "Success",
        description: "MQTT Connected for Modbus TCP settings. Fetching data...",
      });
    };

    // MQTT 'message' event handler - process incoming messages
    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());

        if (topic === MODBUS_SETTING_DATA_TOPIC) {
          const { modbus_tcp_ip, modbus_tcp_port } = payload;
          setModbusIP(modbus_tcp_ip || "");
          setModbusPort(String(modbus_tcp_port || ""));

          // Only update input fields if they are empty or match the current displayed backend values.
          // This allows the user to type without their input being constantly overwritten by MQTT updates.
          if (inputIP === "" || inputIP === modbus_tcp_ip) {
            setInputIP(modbus_tcp_ip || "");
          }
          if (
            inputPort === "" ||
            String(inputPort) === String(modbus_tcp_port)
          ) {
            setInputPort(String(modbus_tcp_port || ""));
          }
          toast({
            title: "Success",
            description: "Modbus TCP settings loaded!",
          });
          setIsLoading(false); // Data successfully loaded, stop loading
        } else if (topic === MODBUS_STATUS_TOPIC) {
          setModbusStatus(payload.modbusTCPStatus || "Unknown");
        } else if (topic === SERVICE_RESPONSE_TOPIC) {
          if (payload.result === "success") {
            toast({
              title: "Success",
              description: payload.message || "Command executed successfully.",
            });
            // If the restarted service is protocol_out.service, re-fetch settings and status
            if (
              Array.isArray(payload.services) &&
              payload.services.includes("protocol_out.service")
            ) {
              // Give a small delay before fetching current settings to allow backend to fully restart
              setTimeout(() => {
                getCurrentSetting(); // Refresh settings after service restart
              }, 1000); // 1 second delay
            }
          } else {
            toast({
              title: "Error",
              description: payload.message || "Command failed.",
              variant: "destructive",
            });
            console.error("Service command error response:", payload);
          }
        }
      } catch (e) {
        toast({
          title: "Error",
          description: "Invalid response from MQTT. Check backend payload.",
          variant: "destructive",
        });
        console.error("Error parsing MQTT message:", message.toString(), e);
        setIsLoading(false); // Stop loading if parsing error occurs
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);
    mqttClientInstance.on("error", (err) => {
      // Add general error listener for MQTT client
      console.error("MQTT Client connection error:", err);
      toast({
        title: "Error",
        description: "MQTT connection error. Please check broker settings.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    // Cleanup function for unmounting
    return () => {
      if (clientRef.current) {
        topicsToSubscribe.forEach((topic) => {
          clientRef.current?.unsubscribe(topic);
        });
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("message", handleMessage);
        clientRef.current.off("error", () => {}); // Clean up the error listener as well
      }
    };
  }, [getCurrentSetting, modbusIP, modbusPort, inputIP, inputPort]); // Dependencies include states used in handling logic

  /**
   * Handles saving the Modbus TCP configuration.
   * Validates input, publishes to MQTT, and triggers a service restart.
   */
  const writeSetting = () => {
    const client = clientRef.current; // Use the ref for the client
    if (!client || !client.connected) {
      toast({
        title: "Error",
        description: "MQTT client not connected. Cannot save configuration.",
        variant: "destructive",
      });
      return;
    }

    const parsedPort = parseInt(inputPort, 10);
    if (isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      toast({
        title: "Error",
        description:
          "Invalid port number. Port must be a number between 1 and 65535.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      command: "write",
      modbus_tcp_ip: inputIP,
      modbus_tcp_port: parsedPort,
    };

    setIsLoading(true); // Set loading true when sending changes
    client.publish(
      MODBUS_SETTING_COMMAND_TOPIC,
      JSON.stringify(payload),
      {},
      (err) => {
        if (err) {
          toast({
            title: "Error",
            description: `Failed to send write command: ${err.message}`,
            variant: "destructive",
          });
          console.error("Publish error (write command):", err);
          setIsLoading(false); // Stop loading if publish fails
        } else {
          toast({
            title: "Processing",
            description: "Configuration sent. Verifying update...",
          });
          // After sending config, prompt user to restart service to apply changes.
          // The service response will handle dismissing the loading toast and updating UI.
          sendCommandRestartService(
            "protocol_out.service",
            "restart",
            "Modbus TCP settings updated. Do you want to restart the Modbus TCP service to apply changes?"
          );
        }
      }
    );
  };

  /**
   * Renders the status message for configuration matching.
   */
  const renderStatusConfig = () => {
    // Check if the user's current input matches the configuration received from the backend
    const currentInputMatchesBackend =
      inputIP === modbusIP && String(inputPort) === modbusPort;

    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading configuration...</span>
        </div>
      );
    }

    // If backend data exists and matches current input
    if (modbusIP && modbusPort && currentInputMatchesBackend) {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span>Configuration matched.</span>
        </div>
      );
    }

    // If backend data exists but doesn't match current input (meaning changes are pending or a mismatch occurred)
    if (modbusIP || modbusPort) {
      if (!currentInputMatchesBackend) {
        return (
          <div className="flex items-center gap-2 text-yellow-600">
            <XCircle className="w-4 h-4" />
            <span>Config mismatch. Save to apply changes.</span>
          </div>
        );
      }
    }

    // If no backend data loaded and not in a loading state, or if input is empty
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>No configuration loaded yet.</span>
      </div>
    );
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">
            Modbus TCP Settings
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="sm"
            onClick={getCurrentSetting}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Get Current Setting
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Current Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Modbus IP</label>
              <Input
                value={modbusIP}
                readOnly
                placeholder={isLoading ? "Loading..." : "N/A"}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Modbus Port</label>
              <Input
                value={modbusPort}
                readOnly
                placeholder={isLoading ? "Loading..." : "N/A"}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Modbus Status</label>
              <span className="text-sm">{modbusStatus}</span>
            </div>
            {renderStatusConfig()}
          </CardContent>
        </Card>

        {/* Update Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Update Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Modbus IP</label>
              <Input
                value={inputIP}
                onChange={(e) => setInputIP(e.target.value)}
                placeholder="192.168.0.179"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Modbus Port</label>
              <Input
                value={inputPort}
                onChange={(e) => setInputPort(e.target.value)}
                placeholder="502"
                type="number"
              />
            </div>
            <Button
              className="mt-4 w-full"
              onClick={writeSetting}
              disabled={isLoading}
            >
              <Save className="w-4 h-4 mr-2" /> Save Configuration
            </Button>
            {/* Restart Service Button */}
            <Button
              className="mt-2 w-full"
              variant="secondary"
              onClick={() =>
                sendCommandRestartService(
                  "protocol_out.service",
                  "restart",
                  "This will restart the Modbus TCP service. Any ongoing communication will be interrupted. Are you sure?"
                )
              }
              disabled={isLoading || !modbusIP} // Disable if loading or no IP is set
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Restart Modbus TCP Service
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationDialogOpen}
        onOpenChange={setConfirmationDialogOpen}
        title={confirmationDialogContent.title}
        description={confirmationDialogContent.description}
        onConfirm={confirmationDialogContent.confirmAction}
      />
    </SidebarInset>
  );
}
