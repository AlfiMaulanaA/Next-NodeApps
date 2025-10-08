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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Added CardHeader, CardTitle
import {
  useConfirmationDialog,
  ConfirmationDialog,
} from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RefreshCw, Save, Settings2, Wifi, Loader2, RotateCcw } from "lucide-react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import MqttStatus from "@/components/mqtt-status";
import type { MqttClient } from "mqtt";

// --- MQTT Topics ---
const SNMP_SETTING_TOPIC_COMMAND = "IOT/Containment/snmp/setting/command";
const SNMP_SETTING_TOPIC_DATA = "IOT/Containment/snmp/setting/data";
const SNMP_STATUS_TOPIC = "IOT/Containment/snmp/status";
const SNMP_STATUS_COMMAND_TOPIC = "IOT/Containment/snmp/status/command";
const SERVICE_COMMAND_TOPIC = "service/command";
const SERVICE_RESPONSE_TOPIC = "service/response";

// IP Synchronization Topics
const NETWORK_SYNC_COMMAND_TOPIC = "rpi/network/sync_ip";
const NETWORK_SYNC_RESPONSE_TOPIC = "rpi/network/sync_ip_response";

// --- Type Definitions ---
interface SnmpConfig {
  snmpIPaddress: string;
  snmpNetmask: string;
  snmpGateway: string;
  snmpVersion: string; // Ensure this is string
  authKey: string;
  privKey: string;
  securityName: string;
  securityLevel: string; // Ensure this is string
  snmpCommunity: string;
  snmpPort: string; // Kept as string for initial input handling
  sysOID: string;
  DeviceName: string;
  Site: string;
  snmpTrapEnabled: boolean;
  ipSnmpManager: string;
  portSnmpManager: string; // Kept as string for initial input handling
  snmpTrapComunity: string;
  snmpTrapVersion: string; // Ensure this is string
  timeDelaySnmpTrap: string; // Kept as string for initial input handling
}

export default function SNMPSettingPage() {
  // --- Confirmation Dialog ---
  const { confirmationProps, showConfirmation } = useConfirmationDialog();

  // --- State Variables ---
  const [formData, setFormData] = useState<SnmpConfig>({
    snmpIPaddress: "",
    snmpNetmask: "",
    snmpGateway: "",
    snmpVersion: "1", // Default to SNMPv1 (string)
    authKey: "",
    privKey: "",
    securityName: "",
    securityLevel: "authPriv", // Default to authPriv (string)
    snmpCommunity: "",
    snmpPort: "161", // Default to 161 (string)
    sysOID: "",
    DeviceName: "",
    Site: "",
    snmpTrapEnabled: true,
    ipSnmpManager: "",
    portSnmpManager: "162", // Default to 162 (string)
    snmpTrapComunity: "",
    snmpTrapVersion: "2", // Default to SNMP Trap v2 (string)
    timeDelaySnmpTrap: "30", // Default to 30 (string)
  });

  const [snmpStatus, setSnmpStatus] = useState<string>("Unknown");
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial fetch
  const [isSaving, setIsSaving] = useState(false); // New state for save operation
  const [isSyncing, setIsSyncing] = useState(false); // Loading state for IP sync operation
  const [loadingTimedOut, setLoadingTimedOut] = useState(false); // Flag for loading timeout
  const clientRef = useRef<MqttClient | null>(null);

  // --- Utility Functions ---

  /**
   * Helper function for IP address validation.
   */
  const isValidIP = (ip: string) =>
    ip === "" || /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip);

  /**
   * Helper function for Netmask validation.
   */
  const isValidNetmask = (mask: string) => {
    if (mask === "") return true; // Allow empty string for optional fields
    const parts = mask.split('.').map(Number);
    if (parts.length !== 4) return false;
    if (parts.some(p => p < 0 || p > 255)) return false;

    // Common valid netmasks
    const validMasks = [
      "255.255.255.255", "255.255.255.254", "255.255.255.252", "255.255.255.248",
      "255.255.255.240", "255.255.255.224", "255.255.255.192", "255.255.255.128",
      "255.255.255.0", "255.255.254.0", "255.255.252.0", "255.255.248.0",
      "255.255.240.0", "255.255.224.0", "255.255.192.0", "255.255.128.0",
      "255.255.0.0", "255.254.0.0", "255.252.0.0", "255.248.0.0",
      "255.240.0.0", "255.224.0.0", "255.192.0.0", "255.128.0.0", "255.0.0.0",
      "0.0.0.0"
    ];
    return validMasks.includes(mask);
  };

  /**
   * Sends a command (restart, stop, start) to a specific service via MQTT.
   * Includes a confirmation dialog.
   * @param serviceName The name of the service to command (e.g., "protocol_out.service").
   * @param action The action to perform ("restart", "stop", "start").
   * @param confirmMessage Optional message for the confirmation dialog.
   * @returns Promise<boolean> indicating if the command was proceeded (after confirmation)
   */
  const sendCommandRestartService = useCallback(async (serviceName: string, action: string, confirmMessage?: string): Promise<boolean> => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return false;
    }

    let proceed = true;
    if (confirmMessage) {
      await new Promise<void>((resolve) => {
        showConfirmation({
          type: "warning",
          title: "Are you sure?",
          description: confirmMessage,
          confirmText: "Yes, proceed!",
          destructive: true,
          onConfirm: () => {
            resolve();
          },
          onCancel: () => {
            proceed = false;
            toast.info("Action cancelled.");
            resolve();
          },
        });
      });
    }

    if (proceed) {
      const payload = JSON.stringify({ services: [serviceName], action: action });

      clientRef.current.publish(SERVICE_COMMAND_TOPIC, payload, (err) => {
        if (err) {
          toast.error(`Failed to send command: ${err.message}`);
          console.error("Publish error:", err);
          setIsSaving(false); // Stop saving state on publish error
        } else {
          toast.loading(`${action.toUpperCase()} ${serviceName} initiated...`, { id: "serviceCommand" });
        }
      });
    }
    return proceed;
  }, []);

  /**
   * Synchronize IP configuration from network settings to SNMP service
   */
  const syncIPToServices = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT not connected. Cannot sync IP.");
      return;
    }

    setIsSyncing(true);
    client.publish(NETWORK_SYNC_COMMAND_TOPIC, JSON.stringify({}), {}, (err) => {
      if (err) {
        console.error("[DEBUG] IP sync publish error:", err);
        toast.error(`Failed to start IP sync: ${err.message}`);
        setIsSyncing(false);
      } else {
        console.log("[DEBUG] Successfully published IP sync command");
        toast.loading("Synchronizing IP to all services...", { id: "ipSync" });
      }
    });
  }, []);

  /**
   * Requests the current SNMP settings from the backend via MQTT.
   */
  const getConfig = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.warning("MQTT not connected. Cannot retrieve SNMP settings.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingTimedOut(false); // Reset timeout flag when retrying
    // Add a small delay to ensure MQTT is ready to publish after connection
    setTimeout(() => {
      client.publish(SNMP_SETTING_TOPIC_COMMAND, JSON.stringify({ command: "read" }), {}, (err) => {
        if (err) {
          toast.error(`Failed to request config: ${err.message}`);
          console.error("Publish error (read command):", err);
          setIsLoading(false); // Stop loading if publish fails
        } else {
          toast.info("Requesting SNMP settings...");
        }
      });
    }, 300);
  }, []);

  /**
   * Requests the current SNMP service status from the backend via MQTT.
   */
  const checkStatus = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.warning("MQTT not connected. Cannot check SNMP status.");
      return;
    }
    client.publish(SNMP_STATUS_COMMAND_TOPIC, JSON.stringify({ command: "check status" }), {}, (err) => {
      if (err) {
        toast.error(`Failed to request status: ${err.message}`);
        console.error("Publish error (check status command):", err);
      } else {
        toast.info("Checking SNMP service status...");
      }
    });
  }, []);

  // --- useEffect for loading timeout ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isLoading) {
      timeoutId = setTimeout(() => {
        setIsLoading(false);
        setLoadingTimedOut(true);
        toast.warning("Loading SNMP settings timed out. Showing default values. You can retry or proceed with configuration.");
      }, 10000); // 10 seconds timeout
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading]);

  // --- useEffect for MQTT Connection and Message Handling ---
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      SNMP_SETTING_TOPIC_DATA,
      SNMP_STATUS_TOPIC,
      SERVICE_RESPONSE_TOPIC,
      NETWORK_SYNC_RESPONSE_TOPIC, // Subscribe to IP sync responses
    ];

    // Initial subscription attempt
    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });

    // If already connected on mount, fetch config and status
    if (mqttClientInstance.connected) {
      getConfig();
      checkStatus();
    }

    // MQTT 'connect' event handler
    const handleConnect = () => {
      topicsToSubscribe.forEach((topic) => {
        mqttClientInstance.subscribe(topic, (err) => {
          if (err) console.error(`Failed to re-subscribe to ${topic} on reconnect:`, err);
        });
      });
      getConfig();
      checkStatus();
      toast.success("MQTT Connected for SNMP settings. Fetching data...");
    };

    // MQTT 'message' event handler
    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log(`Received message on topic ${topic}:`, payload); // Debugging log

        if (topic === SNMP_SETTING_TOPIC_DATA) {
          // Ensure all incoming data is correctly mapped and converted to string for Select components
          const updatedFormData: SnmpConfig = {
            snmpIPaddress: payload.snmpIPaddress || "",
            snmpNetmask: payload.snmpNetmask || "",
            snmpGateway: payload.snmpGateway || "",
            snmpVersion: String(payload.snmpVersion || "1"), // Explicitly convert to string
            authKey: payload.authKey || "",
            privKey: payload.privKey || "",
            securityName: payload.securityName || "",
            securityLevel: String(payload.securityLevel || "authPriv"), // Explicitly convert to string
            snmpCommunity: payload.snmpCommunity || "",
            snmpPort: String(payload.snmpPort || "161"), // Explicitly convert to string
            sysOID: payload.sysOID || "",
            DeviceName: payload.DeviceName || "",
            Site: payload.Site || "",
            snmpTrapEnabled: typeof payload.snmpTrapEnabled === 'boolean' ? payload.snmpTrapEnabled : true,
            ipSnmpManager: payload.ipSnmpManager || "",
            portSnmpManager: String(payload.portSnmpManager || "162"), // Explicitly convert to string
            snmpTrapComunity: payload.snmpTrapComunity || "",
            snmpTrapVersion: String(payload.snmpTrapVersion || "2"), // Explicitly convert to string
            timeDelaySnmpTrap: String(payload.timeDelaySnmpTrap || "30"), // Explicitly convert to string
          };
          setFormData(updatedFormData);
          setLoadingTimedOut(false); // Reset timeout flag on successful load
          toast.success("SNMP settings loaded! 🎉");
          setIsLoading(false); // Stop loading after data is received
        } else if (topic === SNMP_STATUS_TOPIC) {
          setSnmpStatus(payload.snmpStatus || "Unknown");
          toast.info(`SNMP Status: ${payload.snmpStatus || "Unknown"}`);
        } else if (topic === SERVICE_RESPONSE_TOPIC) {
          toast.dismiss("serviceCommand"); // Dismiss loading toast for service command
          setIsSaving(false); // Stop saving state after service response

          if (payload.result === "success") {
            toast.success(payload.message || 'Service command executed successfully!');
            // After a successful service restart, re-check SNMP status
            if (payload.action === "restart" && Array.isArray(payload.services) && payload.services.includes("protocol_out.service")) {
                checkStatus(); // Re-check SNMP status
                // Optionally, if restarting might affect displayed config (e.g., reset to defaults), call getConfig()
                // getConfig();
            }
          } else {
            toast.error(payload.message || 'Failed to execute service command.');
          }
        } else if (topic === NETWORK_SYNC_RESPONSE_TOPIC) {
          setIsSyncing(false);
          if (payload.status === "success") {
            toast.success("IP synchronization completed successfully");
            // Re-fetch settings after IP sync to show updated configs
            setTimeout(() => getConfig(), 500);
          } else {
            toast.error(payload.message || "IP synchronization failed");
          }
        }
      } catch (e) {
        toast.error("Invalid response from MQTT. Check backend payload.");
        console.error("Error parsing MQTT message:", message.toString(), e);
        setIsLoading(false); // Stop loading on parse error
        setIsSaving(false); // Stop saving on parse error
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);
    mqttClientInstance.on("error", (err) => {
        console.error("MQTT Client error:", err);
        toast.error(`MQTT connection error: ${err.message}`);
        setIsLoading(false);
        setIsSaving(false);
    });

    // Cleanup function for unmounting
    return () => {
      if (clientRef.current) {
        topicsToSubscribe.forEach((topic) => {
          clientRef.current?.unsubscribe(topic);
        });
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("message", handleMessage);
        clientRef.current.off("error", () => {}); // Remove error listener cleanly
      }
    }
  }, [getConfig, checkStatus, sendCommandRestartService]);

  // --- Event Handlers for Form Inputs ---

  /**
   * Handles changes for text and number input fields.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  /**
   * Handles changes for Select (dropdown) components.
   * Converts string "true"/"false" for boolean selects.
   */
  const handleSelectChange = (name: keyof SnmpConfig, value: string) => {
    if (name === "snmpTrapEnabled") {
      setFormData((prev) => ({ ...prev, [name]: value === "true" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  /**
   * Handles saving the SNMP configuration.
   * Validates input, publishes to MQTT, and then triggers a service restart.
   */
  const writeConfig = async () => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Cannot save configuration. 😔");
      return;
    }

    // --- Input Validations ---
    // Validate IP addresses and Netmask only if they are not empty
    if (formData.snmpIPaddress !== "" && !isValidIP(formData.snmpIPaddress)) {
        toast.error("Invalid SNMP IP Address format.");
        return;
    }
    if (formData.snmpNetmask !== "" && !isValidNetmask(formData.snmpNetmask)) {
        toast.error("Invalid SNMP Netmask format.");
        return;
    }
    if (formData.snmpGateway !== "" && !isValidIP(formData.snmpGateway)) {
        toast.error("Invalid SNMP Gateway IP Address format.");
        return;
    }
    if (formData.ipSnmpManager !== "" && !isValidIP(formData.ipSnmpManager)) {
        toast.error("Invalid SNMP Manager IP Address format.");
        return;
    }

    const parsedPort = parseInt(formData.snmpPort, 10);
    const parsedTrapPort = parseInt(formData.portSnmpManager, 10);
    const parsedTimeDelay = parseInt(formData.timeDelaySnmpTrap, 10);

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

    // Prepare payload to send to backend (convert numbers back from string)
    const payloadToSend = {
      command: "write",
      ...formData,
      snmpPort: parsedPort,
      portSnmpManager: parsedTrapPort,
      timeDelaySnmpTrap: parsedTimeDelay,
    };

    setIsSaving(true); // Set saving state
    toast.loading("Sending configuration...", { id: "snmpConfigSave" });

    client.publish(SNMP_SETTING_TOPIC_COMMAND, JSON.stringify(payloadToSend), {}, async (err) => {
      if (err) {
        toast.dismiss("snmpConfigSave");
        toast.error(`Failed to send write command: ${err.message} 😭`);
        setIsSaving(false);
      } else {
        toast.success("SNMP configuration sent to device.", { id: "snmpConfigSave" });
        // Ask for confirmation to restart service after successful config write
        const proceedRestart = await sendCommandRestartService("protocol_out.service", "restart", "SNMP settings updated. Do you want to restart the SNMP service to apply changes?");
        if (!proceedRestart) {
            setIsSaving(false); // If user cancels restart, stop saving state
        }
        // If proceedRestart is true, setIsSaving will be handled by SERVICE_RESPONSE_TOPIC listener
      }
    });
  };

  // --- Rendered Component (JSX) ---
  return (
    <SidebarInset>
      {/* Header Section */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Settings2 className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">SNMP Communication</h1>
        </div>
        <div className="flex gap-2">
          <MqttStatus />
          <Button variant="outline" size="sm" onClick={getConfig} disabled={isLoading || isSaving}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />} Get Config
          </Button>
          <Button variant="outline" size="sm" onClick={checkStatus} disabled={isLoading || isSaving}>
            <Wifi className="w-4 h-4 mr-1" /> Check Status
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-4">
        <Card className="mb-4"> {/* Added mb-4 for spacing */}
          <CardHeader>
            <CardTitle className="text-md">SNMP Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Current Status: <strong className={snmpStatus === "RUNNING" ? "text-green-600" : "text-red-600"}>{snmpStatus}</strong>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-md">SNMP Configuration Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {/* Loading State */}
            {isLoading && (
              <div className="col-span-full flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <span className="text-lg text-blue-500">Loading SNMP Settings...</span>
                <p className="text-sm text-muted-foreground mt-2">Please ensure MQTT is connected and backend is running.</p>
              </div>
            )}

            {/* Timeout Warning */}
            {!isLoading && loadingTimedOut && (
              <div className="col-span-full mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ SNMP settings failed to load within 10 seconds. Showing default values. You can proceed with configuration or click "Get Config" to retry loading current settings.
                </p>
              </div>
            )}

            {/* Form Fields (conditionally rendered based on SNMP version) */}
            {!isLoading && (() => {
              const commonFields = [
                'snmpVersion',
                'snmpIPaddress',
                'snmpNetmask',
                'snmpGateway',
                'snmpPort',
                'sysOID',
                'DeviceName',
                'Site'
              ];

              // Fields for SNMP v1 and v2c
              const v1v2cFields = ['snmpCommunity'];

              // Fields for SNMP v3 (including traps which are primarily v3 feature)
              const v3Fields = [
                'securityName',
                'securityLevel',
                'authKey',
                'privKey',
                'snmpTrapEnabled',
                'ipSnmpManager',
                'portSnmpManager',
                'snmpTrapComunity',
                'snmpTrapVersion',
                'timeDelaySnmpTrap'
              ];

              // Determine which version-specific fields to show
              const versionSpecificFields = formData.snmpVersion === "3" ? v3Fields : v1v2cFields;

              // Combine all fields to display
              const fieldsToDisplay = [...commonFields, ...versionSpecificFields];

              return Object.entries(formData).map(([key, value]) => {
                // Skip fields not in the display list
                if (!fieldsToDisplay.includes(key)) {
                  return null;
                }

                // Better label generation that handles acronyms properly
                const toDisplayLabel = (fieldName: string): string => {
                  // Special handling for known acronyms
                  if (fieldName.includes('IP')) {
                    return fieldName.replace('snmpIPaddress', 'Snmp IP Address')
                                    .replace('ipSnmpManager', 'Ip Snmp Manager')
                                    .replace(/([a-z])([A-Z])/g, '$1 $2'); // Handle other camelCase
                  }

                  // General camelCase to spaced words
                  return fieldName.replace(/([a-z])([A-Z])/g, '$1 $2')
                                 .replace(/^./, str => str.toUpperCase());
                };

                const label = toDisplayLabel(key);
                const inputType = typeof value === "number" ? "number" : "text";

                // Determine if it's an IP/Netmask field for validation feedback
                const isIpField = ["snmpIPaddress", "snmpGateway", "ipSnmpManager"].includes(key);
                const isNetmaskField = key === "snmpNetmask";
                const showIpError = isIpField && value !== "" && !isValidIP(String(value));
                const showNetmaskError = isNetmaskField && value !== "" && !isValidNetmask(String(value));

                // Handle Select (dropdown) fields
                if (["snmpVersion", "securityLevel", "snmpTrapVersion", "snmpTrapEnabled"].includes(key)) {
                  let options: { value: string; label: string }[] = [];
                  if (key === "snmpVersion") {
                    options = [{ value: "1", label: "SNMP v1" }, { value: "2c", label: "SNMP v2c" }, { value: "3", label: "SNMP v3" }];
                  } else if (key === "securityLevel") {
                    options = [
                      { value: "noAuthNoPriv", label: "No Auth, No Priv" },
                      { value: "authNoPriv", label: "Auth, No Priv" },
                      { value: "authPriv", label: "Auth, Priv" }
                    ];
                  } else if (key === "snmpTrapVersion") {
                    options = [{ value: "1", label: "SNMP Trap v1" }, { value: "2c", label: "SNMP Trap v2c" }];
                  } else if (key === "snmpTrapEnabled") {
                    options = [{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }];
                  }

                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <Label htmlFor={key}>{label}</Label>
                      <Select
                        value={String(value)}
                        onValueChange={(val) => handleSelectChange(key as keyof SnmpConfig, val)}
                        disabled={isSaving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                // Handle password fields for sensitive data
                if (["authKey", "privKey"].includes(key)) {
                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <Label htmlFor={key}>{label}</Label>
                      <Input
                        id={key}
                        name={key}
                        type="password"
                        value={String(value)}
                        onChange={handleChange}
                        className={showIpError || showNetmaskError ? "border-red-500 focus-visible:ring-red-500" : ""}
                        disabled={isSaving}
                        placeholder={key === "authKey" ? "Enter authentication key" : "Enter privacy key"}
                      />
                      {showIpError && (
                        <p className="text-xs text-red-500 mt-1">Invalid IP Address format (e.g., 192.168.1.1).</p>
                      )}
                      {showNetmaskError && (
                        <p className="text-xs text-red-500 mt-1">Invalid Netmask format (e.g., 255.255.255.0).</p>
                      )}
                    </div>
                  );
                }

                // Handle regular Input fields (text or number)
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      name={key}
                      type={inputType}
                      value={String(value)}
                      onChange={handleChange}
                      className={(showIpError || showNetmaskError) ? "border-red-500 focus-visible:ring-red-500" : ""}
                      disabled={isSaving}
                    />
                    {showIpError && (
                      <p className="text-xs text-red-500 mt-1">Invalid IP Address format (e.g., 192.168.1.1).</p>
                    )}
                    {showNetmaskError && (
                      <p className="text-xs text-red-500 mt-1">Invalid Netmask format (e.g., 255.255.255.0).</p>
                    )}
                  </div>
                );
              });
            })()}

            {/* Save Button */}
            {!isLoading && (
              <div className="col-span-full">
                <Button className="w-full" onClick={writeConfig} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Config
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* IP Synchronization Section */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">IP Synchronization</CardTitle>
            <p className="text-sm text-muted-foreground">
              Synchronize current network IP to SNMP service configuration
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Current SNMP IP: {formData.snmpIPaddress || "Not configured"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will update the SNMP IP address to match the current network settings
                </p>
              </div>
              <Button
                onClick={syncIPToServices}
                disabled={isSyncing || isLoading || isSaving || !formData.snmpIPaddress}
                variant="outline"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Sync IP to SNMP
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog {...confirmationProps} />
    </SidebarInset>
  );
}
