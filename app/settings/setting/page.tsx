"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wifi, Power, Terminal, RotateCw, Settings, Thermometer, Cpu, MemoryStick, HardDrive, Clock, Moon, Sun } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import MqttStatus from '@/components/mqtt-status';

// Import SweetAlert2
import Swal from 'sweetalert2';

// Import centralized MQTT client functions
import { connectMQTT } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt"; // Import MqttClient type for useRef

// Define the interface for SystemInfore
interface SystemInfo {
  cpu_usage: number;
  cpu_temp: string;
  memory_usage: number;
  used_memory: number;
  total_memory: number;
  disk_usage: number;
  used_disk: number;
  total_disk: number;
  eth0_ip_address: string;
  wlan0_ip_address: string;
  uptime: number;
}

export default function AutomationControlPage() {
  // State variables for MQTT status, system info, IP display, and theme
  const [mqttStatus, setMqttStatus] = useState<"Connected" | "Disconnected" | "Failed to Connect">("Disconnected");
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    cpu_usage: 0,
    cpu_temp: "N/A",
    memory_usage: 0,
    used_memory: 0,
    total_memory: 0,
    disk_usage: 0,
    used_disk: 0,
    total_disk: 0,
    eth0_ip_address: "N/A",
    wlan0_ip_address: "N/A",
    uptime: 0,
  });

  const [ipIndex, setIpIndex] = useState(0);
  const clientRef = useRef<MqttClient | null>(null);
  const { theme, setTheme } = useTheme();

  // useEffect hook to handle MQTT connection and event listeners
  useEffect(() => {
    // Connect using the centralized function
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    // MQTT event handlers
    const handleConnect = () => {
      setMqttStatus("Connected");
      // Subscribe to necessary topics
      mqttClientInstance.subscribe("system/status");
      mqttClientInstance.subscribe("service/response");
      // NEW: Subscribe to the topic for hardware-initiated resets if your UI needs to react
      mqttClientInstance.subscribe("command/reset_config"); // You might subscribe here if the UI needs to know about button presses
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setMqttStatus("Failed to Connect");
      toast.error("MQTT connection error. Please check broker settings.");
    };

    const handleClose = () => {
      setMqttStatus("Disconnected");
    };

    const handleMessage = (topic: string, payload: Buffer) => {
      try {
        const msg = JSON.parse(payload.toString());
        if (topic === "system/status") {
          setSystemInfo(msg);
        } else if (topic === "service/response") {
          // Dismiss the loading toast if it exists
          toast.dismiss("serviceCommand");
          // Dismiss the specific reset config toast if it exists
          toast.dismiss("resetConfigCommand");

          if (msg.result === "success") {
            toast.success(msg.message || "Command executed successfully.");
          } else {
            toast.error(msg.message || "Command failed.");
            console.error("Service command error response:", msg);
          }
        } else if (topic === "command/reset_config") {
          // Handle messages from the NanoPi button press if necessary
          // For now, just log and inform
          console.log("Received reset_config command from hardware:", msg);
          if (msg.action === "reset") {
            toast.info("Hardware button initiated a configuration reset. System may reboot soon.");
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

    // Interval to toggle IP address display
    const ipInterval = setInterval(() => setIpIndex(i => (i + 1) % 2), 3000);

    // Cleanup function: runs when the component unmounts
    return () => {
      clearInterval(ipInterval); // Clear the IP display interval
      if (mqttClientInstance.connected) {
        // Unsubscribe from topics if still connected
        mqttClientInstance.unsubscribe("system/status");
        mqttClientInstance.unsubscribe("service/response");
        mqttClientInstance.unsubscribe("command/reset_config"); // Unsubscribe the new topic
      }
      // Remove all event listeners to prevent memory leaks
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
      // Do NOT call client.end() here; it's managed globally by connectMQTT.
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  /**
   * Sends a command to the MQTT broker after an optional confirmation.
   * This is for generic service commands (e.g., restart specific services, reboot, shutdown).
   * It publishes to "service/command".
   * @param services An array of service names to apply the action to (can be empty for system-wide commands).
   * @param action The action to perform (e.g., "restart", "reboot", "reset", "shutdown now").
   * @param confirmMessage An optional message to display in a SweetAlert2 confirmation dialog.
   */
  const sendCommand = async (services: string[], action: string, confirmMessage?: string) => {
    // Ensure MQTT client is connected before publishing
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }

    let proceed = true; // Flag to determine if the command should proceed

    // If a confirmation message is provided, show the SweetAlert2 dialog
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
        proceed = false; // If the user cancels, do not proceed with the command
        toast.info("Action cancelled."); // Inform the user that the action was cancelled
      }
    }

    // Only proceed if the user confirmed or no confirmation was required
    if (proceed) {
      const payload = JSON.stringify({ services, action });
      clientRef.current.publish("service/command", payload, (err) => {
        if (err) {
          toast.error(`Failed to send command: ${err.message}`);
          console.error("Publish error:", err);
        } else {
          // Show a loading toast while waiting for the response
          toast.loading(`${action.toUpperCase()} initiated...`, { id: "serviceCommand" });
        }
      });
    }
  };

  /**
   * Publishes a specific "reset config" command directly to "command/reset_config".
   * This is intended to directly trigger the Python script's reset function.
   * @param confirmMessage An optional message for the confirmation dialog.
   */
  const resetConfig = async (confirmMessage?: string) => {
    if (!clientRef.current || !clientRef.current.connected) {
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
      // Directly publish to "command/reset_config" with the specified payload
      const payload = JSON.stringify({ action: "reset" });
      clientRef.current.publish("command/reset_config", payload, (err) => {
        if (err) {
          toast.error(`Failed to send reset config command: ${err.message}`);
          console.error("Publish error for reset config:", err);
        } else {
          // Show a loading toast specifically for this command
          toast.loading("Resetting configurations...", { id: "resetConfigCommand" });
        }
      });
    }
  };


  // Determine which IP address to display based on ipIndex
  const ipType = ipIndex === 0 ? "eth0" : "wlan0";
  const ipAddress = ipIndex === 0 ? systemInfo.eth0_ip_address : systemInfo.wlan0_ip_address;

  // Render the UI
  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">General Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-yellow-400 transition-all duration-200" />
            ) : (
              <Moon className="h-5 w-5 text-blue-600 transition-all duration-200" />
            )}
          </Button>
          <span className="text-xs font-medium min-w-[70px] text-center select-none">
            {theme === "dark" ? "Dark Mode" : "Light Mode"}
          </span>
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.location.reload()} // A simple full refresh to re-init MQTT for now
          >
            <RotateCw />
          </Button>
        </div>
      </header>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Services Management</span>
              <span className="flex items-center gap-2 text-sm">
                <MqttStatus /> {/* This component will show the status based on its own internal state */}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 justify-between w-full">
              {/* Config Services Section */}
              <div className="flex-1 min-w-[200px]">
                <h6 className="text-sm font-semibold mb-2">Config</h6>
                {/* NEW: Reset Configuration Button */}
                
                <Button
                  onClick={() => sendCommand(["Multiprocesing.service"], "restart", "This will restart MQTT and IP configurations. Are you sure?")}
                  className="w-full mb-2 flex justify-between items-center"
                  variant="secondary"
                  disabled={mqttStatus !== "Connected"}
                >
                  <span className="flex items-center gap-2"><Settings className="h-4 w-4" />Restart MQTT + IP</span>
                </Button>
                <Button
                  onClick={() => sendCommand(["Multiprocesing.service"], "restart", "This will restart Device Modular configurations. Are you sure?")}
                  className="w-full mb-2 flex justify-between items-center"
                  variant="secondary"
                  disabled={mqttStatus !== "Connected"}
                >
                  <span className="flex items-center gap-2"><Settings className="h-4 w-4" />Restart Device Modular</span>
                </Button>
                <Button
                  onClick={() => sendCommand(["Multiprocesing.service"], "restart", "This will restart Device Modbus configurations. Are you sure?")}
                  className="w-full flex justify-between items-center"
                  variant="secondary"
                  disabled={mqttStatus !== "Connected"}
                >
                  <span className="flex items-center gap-2"><Settings className="h-4 w-4" />Restart Device Modbus</span>
                </Button>
              </div>
              {/* System Services Section */}
              <div className="flex-1 min-w-[200px]">
                <h6 className="text-sm font-semibold mb-2">System</h6>
                {/* The "Reset System" button which now implies a "Full System Reset" if your backend interprets "action: reset" as such */}
                <Button
                  onClick={() => resetConfig("This will reset specific configurations to their defaults. This action may cause a temporary service interruption. Are you sure?")}
                  className="w-full mb-2 flex justify-between items-center"
                  variant="destructive" // Using default variant for configuration reset
                  disabled={mqttStatus !== "Connected"}
                >
                  <span className="flex items-center gap-2"><Terminal className="h-4 w-4" />Reset System to Default</span>
                </Button>
                <Button
                  onClick={() => sendCommand([], "sudo reboot", "This will reboot the system. All current operations will be interrupted. Are you sure?")}
                  className="w-full mb-2 flex justify-between items-center"
                  variant="destructive"
                  disabled={mqttStatus !== "Connected"}
                >
                  <span className="flex items-center gap-2"><RotateCw className="h-4 w-4" />Reboot System</span>
                </Button>
                <Button
                  onClick={() => sendCommand([], "sudo shutdown now", "This will shut down the system. You will need physical access to power it back on. Are you sure?")}
                  className="w-full flex justify-between items-center"
                  variant="destructive"
                  disabled={mqttStatus !== "Connected"}
                >
                  <span className="flex items-center gap-2"><Power className="h-4 w-4" />Shutdown System</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <Wifi className="h-6 w-6 text-blue-500" />
              <div>
                <h6 className="font-medium">IP Address</h6>
                <p className="text-sm text-muted-foreground"><strong>{ipType}:</strong> {ipAddress}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <Thermometer className="h-6 w-6 text-red-500" />
              <div>
                <h6 className="font-medium">CPU Temp</h6>
                <p className="text-sm text-muted-foreground">{systemInfo.cpu_temp}°C</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <Cpu className="h-6 w-6 text-green-700" />
              <div>
                <h6 className="font-medium">CPU Usage</h6>
                <p className="text-sm text-muted-foreground">{systemInfo.cpu_usage}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <MemoryStick className="h-6 w-6 text-green-600" />
              <div>
                <h6 className="font-medium">Memory Usage</h6>
                <p className="text-sm text-muted-foreground">
                  {systemInfo.memory_usage}% ({systemInfo.used_memory}/{systemInfo.total_memory} MB)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <HardDrive className="h-6 w-6 text-black-500" />
              <div>
                <h6 className="font-medium">Disk Usage</h6>
                <p className="text-sm text-muted-foreground">
                  {systemInfo.disk_usage}% ({systemInfo.used_disk}/{systemInfo.total_disk} MB)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <Clock className="h-6 w-6 text-indigo-500" />
              <div>
                <h6 className="font-medium">Uptime</h6>
                <p className="text-sm text-muted-foreground">{Math.floor(systemInfo.uptime / 3600)}h {Math.floor((systemInfo.uptime % 3600) / 60)}m</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarInset>
  );
}