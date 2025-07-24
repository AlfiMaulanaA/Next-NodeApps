"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import { toast } from "sonner";
import Swal from 'sweetalert2'; // Import SweetAlert2 for confirmation dialogs
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Network, RotateCw, Loader2, Save, Wifi } from "lucide-react";
import type { MqttClient } from "mqtt";
import MqttStatus from "@/components/mqtt-status";

// --- MQTT Topics ---
const IP_CONFIG_COMMAND_TOPIC = "command_device_ip"; // For readIP, changeIP, restartNetworking
const IP_CONFIG_RESPONSE_TOPIC = "response_device_ip"; // Backend response
const SERVICE_COMMAND_TOPIC = "service/command"; // To restart other services like 'Multiprocessing.service'
const SERVICE_RESPONSE_TOPIC = "service/response"; // Responses for service commands

// New MQTT Topics for dependent services
const MODBUS_TCP_SETTING_COMMAND_TOPIC = "IOT/Containment/modbustcp/setting/command";
const SNMP_SETTING_COMMAND_TOPIC = "IOT/Containment/snmp/setting/command";

// --- Type Definitions ---
interface NetworkConfig {
  address: string;
  netmask: string;
  gateway: string;
}

// Assume Modbus TCP current settings (especially port) might be needed
// In a real app, this might come from another config topic or a default.
interface ModbusTcpConfig {
    modbus_tcp_ip: string;
    modbus_tcp_port: number;
}

interface SnmpConfigPartial {
    snmpIPaddress: string;
    // Add other SNMP fields if the backend 'write' command expects a full payload
    // For this modification, we only focus on snmpIPaddress as requested.
    // Ideally, a 'read' would happen first to get current full config, then 'write' with updated IP.
}


export default function NetworkPage() {
  // --- State Variables ---
  const [config, setConfig] = useState<NetworkConfig | null>(null); // Current active config from backend
  const [editConfig, setEditConfig] = useState<NetworkConfig>({ address: "", netmask: "", gateway: "" }); // Config being edited in the dialog
  const [open, setOpen] = useState(false); // State for managing the dialog open/close
  const clientRef = useRef<MqttClient | null>(null); // Ref to hold the MQTT client instance
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial fetch and update operations (start true for initial fetch)

  // Assuming you need to know the Modbus TCP port for the payload
  // In a more complex app, this might be fetched from a dedicated Modbus config topic.
  const [currentModbusTcpPort, setCurrentModbusTcpPort] = useState<number>(502); // Default Modbus TCP port, you might fetch this.

  // --- Input Validation Functions ---
  const isValidIP = (ip: string) =>
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip);

  const isValidNetmask = (mask: string) => {
    const parts = mask.split('.').map(Number);
    if (parts.length !== 4) return false;
    if (parts.some(p => p < 0 || p > 255)) return false;

    // List of common valid netmasks (full octets)
    const validMasks = [
        "255.255.255.255", "255.255.255.254", "255.255.255.252", "255.255.255.248",
        "255.255.255.240", "255.255.255.224", "255.255.255.192", "255.255.255.128",
        "255.255.255.0", "255.255.254.0", "255.255.252.0", "255.255.248.0",
        "255.255.240.0", "255.255.224.0", "255.255.192.0", "255.255.128.0",
        "255.255.0.0", "255.254.0.0", "255.252.0.0", "255.248.0.0",
        "255.240.0.0", "255.224.0.0", "255.192.0.0", "255.128.0.0", "255.0.0.0",
        "0.0.0.0" // Loopback or default
    ];
    return validMasks.includes(mask);
  };

  // --- Event Handlers ---
  const handleInput = (field: keyof NetworkConfig, value: string) => {
    setEditConfig(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Requests the current network configuration (specifically for eth0) from the backend via MQTT.
   */
  const requestNetworkConfig = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      setIsLoading(true); // Set loading true when initiating request
      // Add a small delay to ensure MQTT is ready to publish after connection/page load
      setTimeout(() => {
        client.publish(IP_CONFIG_COMMAND_TOPIC, JSON.stringify({ command: "readIP", interface: "eth0" }), {}, (err) => {
          if (err) {
            toast.error(`Failed to request config: ${err.message}`);
            console.error("Publish error (readIP command):", err);
            setIsLoading(false); // Stop loading if publish fails
          } else {
            toast.info("Requesting network configuration...");
          }
        });
      }, 300);
    } else {
      toast.warning("MQTT not connected. Cannot request network configuration.");
      setIsLoading(false); // Stop loading if MQTT is not connected
    }
  }, []); // No dependencies for useCallback as it relies on getMQTTClient() which is external

  /**
   * Sends a command (restart, stop, start) to a specific service via MQTT.
   * Includes a SweetAlert2 confirmation dialog.
   * @param serviceName The name of the service to command (e.g., "networking.service").
   * @param action The action to perform ("restart", "stop", "start").
   * @param confirmMessage Optional message for the confirmation dialog.
   * @param topic Optional: specify a different command topic (default: SERVICE_COMMAND_TOPIC)
   * @param customPayload Optional: provide a custom payload object instead of default service command.
   */
  const sendCommandToService = useCallback(async (serviceName: string, action: string, confirmMessage?: string, topic: string = SERVICE_COMMAND_TOPIC, customPayload?: object) => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }

    let proceed = true;
    if (confirmMessage) {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: confirmMessage,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, proceed!'
      });

      if (!result.isConfirmed) {
        proceed = false;
        toast.info("Action cancelled.");
      }
    }

    if (proceed) {
      let payload: any;
      let toastId = "serviceCommand";

      if (customPayload) {
          payload = customPayload; // Use provided custom payload
      } else if (topic === SERVICE_COMMAND_TOPIC) {
        // For general service commands, backend expects 'services' array
        payload = { services: [serviceName], action: action };
      } else if (topic === IP_CONFIG_COMMAND_TOPIC && action === "restartNetworking") {
        // Specific payload for backend's restartNetworking command on IP_CONFIG_COMMAND_TOPIC
        payload = { command: "restartNetworking" }; // Ensure this matches backend expected command
        toastId = "networkRestart"; // Use specific ID for network restart toast
      } else {
          console.warn("Unhandled payload construction scenario for sendCommandToService.");
          return;
      }

      client.publish(topic, JSON.stringify(payload), {}, (err) => {
        if (err) {
          toast.dismiss(toastId);
          toast.error(`Failed to send command: ${err.message}`);
          console.error(`Publish error to ${topic}:`, err);
        } else {
          toast.loading(`${action.toUpperCase()} ${serviceName} initiated...`, { id: toastId });
        }
      });
    }
  }, []); // Empty dependency array as it only depends on clientRef.current, which is stable

  /**
   * Handles updating the network configuration.
   * Sends 'changeIP' command to backend.
   * AFTER successful sending of IP change, it also publishes the new IP to Modbus TCP and SNMP topics.
   */
  const updateConfig = async () => {
    if (
      !isValidIP(editConfig.address) ||
      !isValidIP(editConfig.gateway) ||
      !isValidNetmask(editConfig.netmask)
    ) {
      toast.error("Invalid input format for IP Address, Netmask, or Gateway. Please check values.");
      return;
    }

    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT not connected. Cannot update configuration.");
      return;
    }

    const result = await Swal.fire({
      title: 'Apply Network Changes?',
      html: "Changing network settings will require the **device to reboot** to apply the changes. This may temporarily disconnect the device. Are you sure you want to proceed?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, update and reboot!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) {
      toast.info("Network update cancelled.");
      return;
    }

    setIsLoading(true); // Set loading true when sending changes
    toast.loading("Sending configuration update...", { id: "networkUpdate" });

    const newIP = editConfig.address; // Capture the new IP address here

    const networkPayload = {
      command: "changeIP",
      interface: "eth0",
      method: "static", // Assuming static configuration
      static_ip: newIP,
      netmask: editConfig.netmask,
      gateway: editConfig.gateway,
    };

    client.publish(IP_CONFIG_COMMAND_TOPIC, JSON.stringify(networkPayload), {}, (err) => {
      if (err) {
        toast.dismiss("networkUpdate");
        Swal.fire({
          position: 'top-end',
          icon: 'error',
          title: `Failed to send update command: ${err.message}`,
          showConfirmButton: false,
          timer: 3000,
          toast: true
        });
        setIsLoading(false); // Stop loading if publish fails
      } else {
        setOpen(false); // Close dialog immediately after sending the network config

        // --- NEW LOGIC: PUBLISH NEW IP TO MODBUS TCP AND SNMP TOPICS ---
        // These publishes are "best-effort" from the client side.
        // For a more robust solution, the backend should ideally handle this propagation
        // after it has successfully applied the network changes and possibly rebooted.

        // 1. Publish to Modbus TCP
        const modbusTcpPayload: ModbusTcpConfig & { command: string } = {
          command: "write",
          modbus_tcp_ip: newIP,
          modbus_tcp_port: currentModbusTcpPort, // Use the state variable for Modbus Port
        };
        client.publish(MODBUS_TCP_SETTING_COMMAND_TOPIC, JSON.stringify(modbusTcpPayload), {}, (modbusErr) => {
          if (modbusErr) {
            console.error("Failed to publish new IP to Modbus TCP:", modbusErr);
            toast.error("Failed to update Modbus TCP IP. Check manually after network change.");
          } else {
            console.log("Published new IP to Modbus TCP successfully.");
            // No toast for this, as the main network update toast handles feedback.
          }
        });

        // 2. Publish to SNMP
        const snmpPayload: SnmpConfigPartial & { command: string } = {
          command: "write",
          snmpIPaddress: newIP,
          // IMPORTANT: If your SNMP backend requires ALL settings for a 'write' command,
          // you MUST fetch the current SNMP config first, update the IP, then send the full config.
          // Otherwise, other SNMP settings might be reset to default or null.
          // For now, this assumes the backend can merge partial updates.
        };
        client.publish(SNMP_SETTING_COMMAND_TOPIC, JSON.stringify(snmpPayload), {}, (snmpErr) => {
          if (snmpErr) {
            console.error("Failed to publish new IP to SNMP:", snmpErr);
            toast.error("Failed to update SNMP IP. Check manually after network change.");
          } else {
            console.log("Published new IP to SNMP successfully.");
            // No toast for this, as the main network update toast handles feedback.
          }
        });
        // --- END NEW LOGIC ---

        // The success/error toast and re-fetch for network config are handled by the response_device_ip listener
      }
    });
  };

  /**
   * Handles direct network service restart button.
   */
  const handleRestartNetworkButton = () => {
    sendCommandToService(
      "networking.service",
      "restart",
      "Are you sure you want to restart the networking service? This will temporarily disrupt network connectivity. If you've just changed IP, a full reboot is recommended."
    );
  };

  // --- useEffect for MQTT Connection and Message Handling ---
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      IP_CONFIG_RESPONSE_TOPIC,
      SERVICE_RESPONSE_TOPIC,
      // You might add specific response topics for MODBUS_TCP_SETTING_COMMAND_TOPIC and SNMP_SETTING_COMMAND_TOPIC
      // if those services provide direct confirmation of settings applied.
    ];

    // Initial subscription attempt
    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });

    // If already connected on mount, fetch config
    if (mqttClientInstance.connected) {
      requestNetworkConfig();
    }

    // MQTT 'connect' event handler
    const handleConnect = () => {
      topicsToSubscribe.forEach((topic) => {
        mqttClientInstance.subscribe(topic, (err) => {
          if (err) console.error(`Failed to re-subscribe to ${topic} on connect:`, err);
        });
      });
      requestNetworkConfig();
      toast.success("MQTT Connected for Network settings. Fetching data...");
    };

    // MQTT 'message' event handler
    const handleMessage = (topic: string, messageBuf: Buffer) => {
      try {
        const data = JSON.parse(messageBuf.toString());
        console.log(`Received message on topic ${topic}:`, data); // Log all incoming messages for debugging

        if (topic === IP_CONFIG_RESPONSE_TOPIC) {
          toast.dismiss("networkUpdate"); // Dismiss update toast if active
          toast.dismiss("networkRestart"); // Dismiss restart toast if active

          if (data.status === "success") {
            if (data.data && data.data.eth0) {
              // This is a 'readIP' response
              setConfig(data.data.eth0);
              setEditConfig(data.data.eth0); // Also update edit form with current data
              Swal.fire({
                position: 'top-end',
                icon: 'success',
                title: 'Network configuration loaded!',
                showConfirmButton: false,
                timer: 1500,
                toast: true
              });
            } else if (data.command === "changeIP") {
              // This is a 'changeIP' response
              Swal.fire({
                position: 'top-end',
                icon: 'success',
                title: data.message || "Change IP command successful!",
                html: data.restart_networking ? `Device rebooting or network restarting to apply changes...` : '',
                showConfirmButton: false,
                timer: 5000, // Longer timer for critical network changes
                toast: true
              });
              // No immediate requestNetworkConfig here, as device might be rebooting.
              // A manual refresh or waiting for device to come back online is more appropriate.
            } else if (data.command === "restartNetworking") {
              // This is a 'restartNetworking' response
              Swal.fire({
                position: 'top-end',
                icon: 'success',
                title: data.message || "Network service restarted successfully!",
                showConfirmButton: false,
                timer: 3000,
                toast: true
              });
              // After network restart, request config again to confirm changes
              setTimeout(() => {
                requestNetworkConfig();
              }, 2000); // Give networking service a moment to stabilize
            }
          } else if (data.status === "error") {
            Swal.fire({
              position: 'top-end',
              icon: 'error',
              title: data.message || "Network operation failed!",
              showConfirmButton: false,
              timer: 3000,
              toast: true
            });
          }
          setIsLoading(false); // Stop loading after processing IP config response
        } else if (topic === SERVICE_RESPONSE_TOPIC) {
          toast.dismiss("serviceCommand"); // Dismiss generic service command toast

          if (data.result === "success") { // Note: backend uses 'result' for SERVICE_RESPONSE_TOPIC
            Swal.fire({
              position: 'top-end',
              icon: 'success',
              title: data.message || 'Service command executed successfully!',
              showConfirmButton: false,
              timer: 3000,
              toast: true
            });
            // After a service command (e.g., multiprocessing restart), re-request network config
            // to ensure displayed data is fresh, especially if it was a networking service.
            // This is a general safety measure, might not always be needed depending on service.
            setTimeout(() => {
              requestNetworkConfig();
            }, 2000);
          } else {
            Swal.fire({
              position: 'top-end',
              icon: 'error',
              title: 'Error!',
              text: data.message || 'Failed to execute service command.',
              showConfirmButton: false,
              timer: 3000,
              toast: true
            });
          }
        }
        // You would add handling for MODBUS_TCP_SETTING_RESPONSE_TOPIC and SNMP_SETTING_RESPONSE_TOPIC here
        // if your backend provides specific responses for those config changes.
      } catch (err) {
        toast.error("Invalid response from MQTT. Check backend payload.");
        console.error("Error parsing MQTT message:", messageBuf.toString(), err);
        setIsLoading(false);
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("message", handleMessage);
    mqttClientInstance.on("error", (err) => {
      console.error("MQTT Client connection error:", err);
      toast.error("MQTT connection error. Please check broker settings.");
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
        clientRef.current.off("error", () => {}); // Remove error listener
      }
    };
  }, [requestNetworkConfig, sendCommandToService]); // Added sendCommandToService to dependencies

  // --- Rendered Component (JSX) ---
  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Network Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button variant="outline" size="icon" onClick={requestNetworkConfig} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>IP Configuration (eth0)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !config ? ( // Show loading only if config is not yet loaded
              <p className="text-sm text-muted-foreground flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 mr-2 animate-spin text-blue-500" />
                Fetching network data...
              </p>
            ) : config ? (
              <>
                <table className="text-sm w-full">
                  <tbody>
                    <tr>
                      <td className="font-medium pr-4 py-1">IP Address</td>
                      <td className="py-1">{config.address}</td>
                    </tr>
                    <tr>
                      <td className="font-medium pr-4 py-1">Netmask</td>
                      <td className="py-1">{config.netmask}</td>
                    </tr>
                    <tr>
                      <td className="font-medium pr-4 py-1">Gateway</td>
                      <td className="py-1">{config.gateway}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="default" disabled={isLoading}>Edit IP</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit IP Configuration</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input
                          placeholder="IP Address"
                          value={editConfig.address}
                          onChange={e => handleInput("address", e.target.value)}
                          className={!isValidIP(editConfig.address) && editConfig.address !== "" ? "border-red-500" : ""}
                        />
                        {!isValidIP(editConfig.address) && editConfig.address !== "" && (
                          <p className="text-xs text-red-500">Invalid IP Address format (e.g., 192.168.1.1).</p>
                        )}
                        <Input
                          placeholder="Netmask"
                          value={editConfig.netmask}
                          onChange={e => handleInput("netmask", e.target.value)}
                          className={!isValidNetmask(editConfig.netmask) && editConfig.netmask !== "" ? "border-red-500" : ""}
                        />
                        {!isValidNetmask(editConfig.netmask) && editConfig.netmask !== "" && (
                          <p className="text-xs text-red-500">Invalid Netmask format (e.g., 255.255.255.0).</p>
                        )}
                        <Input
                          placeholder="Gateway"
                          value={editConfig.gateway}
                          onChange={e => handleInput("gateway", e.target.value)}
                          className={!isValidIP(editConfig.gateway) && editConfig.gateway !== "" ? "border-red-500" : ""}
                        />
                        {!isValidIP(editConfig.gateway) && editConfig.gateway !== "" && (
                          <p className="text-xs text-red-500">Invalid Gateway IP Address format (e.g., 192.168.1.254).</p>
                        )}
                        <Button
                          onClick={updateConfig}
                          disabled={isLoading || !isValidIP(editConfig.address) || !isValidIP(editConfig.gateway) || !isValidNetmask(editConfig.netmask)}
                          className="w-full"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="secondary" onClick={handleRestartNetworkButton} disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />} Restart Networking
                  </Button>
                </div>
              </>
            ) : (
              // Case when config is null and not loading (e.g., initial load failed or MQTT not connected)
              <p className="text-sm text-muted-foreground flex items-center justify-center py-8">
                <Network className="w-5 h-5 mr-2" />
                No network configuration loaded. Ensure MQTT is connected and try refreshing.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}