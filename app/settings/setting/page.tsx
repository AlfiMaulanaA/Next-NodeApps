"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wifi,
  Power,
  Terminal,
  RotateCw,
  Settings,
  Thermometer,
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  Moon,
  Sun,
  BatteryCharging,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import MqttStatus from "@/components/mqtt-status";

import Swal from "sweetalert2";

import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";

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

export default function SettingsPage() {
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

  const requestSystemStatus = useCallback(() => {
    const client = getMQTTClient();
    if (client && client.connected) {
      toast.info("Requesting system status...");
    } else {
      toast.warning("MQTT not connected. Cannot request system status.");
    }
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      "system/status",
      "service/response",
      "command/reset_config",
      "batteryCharger/reset/energy/response",
      "batteryCharger/reset/cycle/response",
    ];

    const subscribeToTopics = () => {
      topicsToSubscribe.forEach((topic) => {
        mqttClientInstance.subscribe(topic, (err) => {
          if (err) console.error(`Failed to subscribe to ${topic}:`, err);
        });
      });
    };

    const handleConnect = () => {
      subscribeToTopics();
      requestSystemStatus();
      toast.success("MQTT Connected. Fetching system data...");
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      toast.error("MQTT connection error. Please check broker settings.");
    };

    const handleClose = () => {
      console.log("MQTT client disconnected.");
    };

    const handleMessage = (topic: string, payload: Buffer) => {
      try {
        const msg = JSON.parse(payload.toString());

        if (topic === "system/status") {
          setSystemInfo(msg);
        } else if (topic === "service/response") {
          toast.dismiss("serviceCommand");
          toast.dismiss("resetConfigCommand");

          if (msg.result === "success") {
            Swal.fire({
              position: "top-end",
              icon: "success",
              title: msg.message || "Command executed successfully.",
              showConfirmButton: false,
              timer: 3000,
              toast: true,
            });
          } else {
            Swal.fire({
              position: "top-end",
              icon: "error",
              title: "Error!",
              text: msg.message || "Command failed.",
              showConfirmButton: false,
              timer: 3000,
              toast: true,
            });
            console.error("Service command error response:", msg);
          }
        } else if (topic === "command/reset_config") {
          console.log("Received reset_config command from hardware:", msg);
          if (msg.action === "reset") {
            toast.info(
              "Hardware button initiated a configuration reset. System may reboot soon."
            );
          }
        } else if (topic === "batteryCharger/reset/energy/response") {
          Swal.close(); // Close any active SweetAlert2 instance (e.g., loading spinner)

          if (msg.status === "reset") {
            Swal.fire({
              position: "top-end",
              icon: "success",
              title: "Success!",
              text: msg.message || "Energy counters reset successfully.",
              showConfirmButton: false,
              timer: 3000,
              toast: true,
            });
          } else if (msg.status === "error") {
            Swal.fire({
              position: "top-end",
              icon: "error",
              title: "Error!",
              text: msg.message || "Failed to reset energy counters.",
              showConfirmButton: false,
              timer: 3000,
              toast: true,
            });
            console.error("Energy reset error response:", msg);
          }
        } else if (topic === "batteryCharger/reset/cycle/response") {
          Swal.close(); // Close any active SweetAlert2 instance

          if (msg.status === "reset") {
            Swal.fire({
              position: "top-end",
              icon: "success",
              title: "Success!",
              text: msg.message || "Cycle counters reset successfully.",
              showConfirmButton: false,
              timer: 3000,
              toast: true,
            });
          } else if (msg.status === "error") {
            Swal.fire({
              position: "top-end",
              icon: "error",
              title: "Error!",
              text: msg.message || "Failed to reset cycle counters.",
              showConfirmButton: false,
              timer: 3000,
              toast: true,
            });
            console.error("Cycle reset error response:", msg);
          }
        }
      } catch (err) {
        toast.error("Invalid payload format received from MQTT.");
        console.error("MQTT message parsing error:", err);
      }
    };

    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    if (mqttClientInstance.connected) {
      subscribeToTopics();
      requestSystemStatus();
    }

    const ipInterval = setInterval(() => setIpIndex((i) => (i + 1) % 2), 3000);

    return () => {
      clearInterval(ipInterval);
      if (clientRef.current) {
        topicsToSubscribe.forEach((topic) => {
          clientRef.current?.unsubscribe(topic);
        });
        clientRef.current.off("connect", handleConnect);
        clientRef.current.off("error", handleError);
        clientRef.current.off("close", handleClose);
        clientRef.current.off("message", handleMessage);
      }
    };
  }, [requestSystemStatus]);

  const sendCommand = async (
    services: string[],
    action: string,
    confirmMessage?: string
  ) => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }

    let proceed = true;
    if (confirmMessage) {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: confirmMessage,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, proceed!",
      });

      if (!result.isConfirmed) {
        proceed = false;
        toast.info("Action cancelled.");
      }
    }

    if (proceed) {
      const payload = JSON.stringify({ services, action });
      clientRef.current.publish("service/command", payload, (err) => {
        if (err) {
          toast.error(`Failed to send command: ${err.message}`);
          console.error("Publish error:", err);
        } else {
          Swal.fire({
            title: "Processing...",
            text: `${action.toUpperCase()} initiated. Please wait for a response.`,
            icon: "info",
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });
        }
      });
    }
  };

  const resetConfig = async (confirmMessage?: string) => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }

    let proceed = true;
    if (confirmMessage) {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: confirmMessage,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, proceed!",
      });

      if (!result.isConfirmed) {
        proceed = false;
        toast.info("Action cancelled.");
      }
    }

    if (proceed) {
      const payload = JSON.stringify({ action: "reset" });
      clientRef.current.publish("command/reset_config", payload, (err) => {
        if (err) {
          toast.error(`Failed to send reset config command: ${err.message}`);
          console.error("Publish error for reset config:", err);
        } else {
          Swal.fire({
            title: "Resetting Configuration...",
            text: "This may take a moment. Please wait.",
            icon: "info",
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });
        }
      });
    }
  };

  const resetEnergyCounters = async () => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }

    const result = await Swal.fire({
      title: "Reset Energy Counters?",
      text: "This action will reset the energy measurement counters to zero. Are you sure?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, reset it!",
    });

    if (result.isConfirmed) {
      clientRef.current.publish("batteryCharger/reset/energy", "", (err) => {
        if (err) {
          toast.error(`Failed to send energy reset command: ${err.message}`);
          console.error("Publish error for energy reset:", err);
        } else {
          Swal.fire({
            title: "Resetting Energy...",
            html: "Please wait, this will take approximately <b></b> seconds.",
            timer: 10000,
            timerProgressBar: true,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
              const b = Swal.getHtmlContainer()?.querySelector("b");
              let timerInterval: NodeJS.Timeout | null = null; // Declare timerInterval with null
              if (b) {
                timerInterval = setInterval(() => {
                  if (Swal.getTimerLeft()) {
                    b.textContent = String(
                      Math.ceil(Swal.getTimerLeft()! / 1000)
                    );
                  }
                }, 100);
              }
              // Fix: Assign a function that returns the timerInterval or undefined
              Swal.stopTimer = () => {
                if (timerInterval) {
                  clearInterval(timerInterval);
                }
                return undefined; // Explicitly return undefined
              };
            },
            willClose: () => {
              // No change needed here, as the response handler will close Swal.
              // If Swal is still open after the timer, it means no response came.
            },
          });
        }
      });
    } else {
      toast.info("Energy reset cancelled.");
    }
  };

  const resetCycleCounters = async () => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }

    const result = await Swal.fire({
      title: "Reset Cycle Counters?",
      text: "This action will reset the battery cycle count to zero. Are you sure?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, reset it!",
    });

    if (result.isConfirmed) {
      clientRef.current.publish("batteryCharger/reset/cycle", "", (err) => {
        if (err) {
          toast.error(`Failed to send cycle reset command: ${err.message}`);
          console.error("Publish error for cycle reset:", err);
        } else {
          Swal.fire({
            title: "Resetting Cycle Count...",
            html: "Please wait, this will take approximately <b></b> seconds.",
            timer: 10000,
            timerProgressBar: true,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
              const b = Swal.getHtmlContainer()?.querySelector("b");
              let timerInterval: NodeJS.Timeout | null = null; // Declare timerInterval with null
              if (b) {
                timerInterval = setInterval(() => {
                  if (Swal.getTimerLeft()) {
                    b.textContent = String(
                      Math.ceil(Swal.getTimerLeft()! / 1000)
                    );
                  }
                }, 100);
              }
              // Fix: Assign a function that returns the timerInterval or undefined
              Swal.stopTimer = () => {
                if (timerInterval) {
                  clearInterval(timerInterval);
                }
                return undefined; // Explicitly return undefined
              };
            },
            willClose: () => {
              // No change needed here.
            },
          });
        }
      });
    } else {
      toast.info("Cycle reset cancelled.");
    }
  };

  const ipType = ipIndex === 0 ? "eth0" : "wlan0";
  const ipAddress =
    ipIndex === 0 ? systemInfo.eth0_ip_address : systemInfo.wlan0_ip_address;

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">General Settings</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 border-border hover:bg-muted/50"
          onClick={() => window.location.reload()}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </header>
      <div className="p-6 space-y-6">
        {/* Theme Settings Card */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Appearance Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-foreground">
                  Theme Mode
                </h4>
                <p className="text-xs text-muted-foreground">
                  Choose your preferred theme for the application
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Light mode"
                    className={`h-8 w-8 p-0 transition-all duration-200 ${
                      theme === "light"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-background/80"
                    }`}
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Dark mode"
                    className={`h-8 w-8 p-0 transition-all duration-200 ${
                      theme === "dark"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-background/80"
                    }`}
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="h-4 w-4" />
                  </Button>
                </div>
                <Badge variant="outline" className="px-3 py-1">
                  {theme === "dark" ? "Dark Mode" : "Light Mode"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Services Management
              </span>
              <span className="flex items-center gap-2 text-sm">
                <MqttStatus />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 justify-between w-full">
              <div className="flex-1 min-w-[200px]">
                <h6 className="text-sm font-semibold mb-2">Config</h6>
                <Button
                  onClick={() =>
                    sendCommand(
                      ["Multiprocesing.service"],
                      "restart",
                      "This will restart MQTT and IP configurations. Are you sure?"
                    )
                  }
                  className="w-full mb-2 flex justify-between items-center"
                  variant="secondary"
                  disabled={!clientRef.current || !clientRef.current.connected}
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Restart MQTT + IP
                  </span>
                </Button>
                <Button
                  onClick={() =>
                    sendCommand(
                      ["Multiprocesing.service"],
                      "restart",
                      "This will restart Device Modbus configurations. Are you sure?"
                    )
                  }
                  className="w-full flex justify-between items-center"
                  variant="secondary"
                  disabled={!clientRef.current || !clientRef.current.connected}
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Restart Device Modbus
                  </span>
                </Button>
                {/* <Button
                  onClick={resetEnergyCounters}
                  className="w-full mt-2 flex justify-between items-center"
                  variant="secondary"
                  disabled={!clientRef.current || !clientRef.current.connected}
                >
                  <span className="flex items-center gap-2"><BatteryCharging className="h-4 w-4" />Reset Energy Counters</span>
                </Button>
                <Button
                  onClick={resetCycleCounters}
                  className="w-full mt-2 flex justify-between items-center"
                  variant="secondary"
                  disabled={!clientRef.current || !clientRef.current.connected}
                >
                  <span className="flex items-center gap-2"><BatteryCharging className="h-4 w-4" />Reset Cycle Counters</span>
                </Button> */}
              </div>
              <div className="flex-1 min-w-[200px]">
                <h6 className="text-sm font-semibold mb-2">System</h6>
                <Button
                  onClick={() =>
                    resetConfig(
                      "This will reset specific configurations to their defaults. This action may cause a temporary service interruption. Are you sure?"
                    )
                  }
                  className="w-full mb-2 flex justify-between items-center"
                  variant="destructive"
                  disabled={!clientRef.current || !clientRef.current.connected}
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Reset System to Default
                  </span>
                </Button>
                <Button
                  onClick={() =>
                    sendCommand(
                      [],
                      "sudo reboot",
                      "This will reboot the system. All current operations will be interrupted. Are you sure?"
                    )
                  }
                  className="w-full mb-2 flex justify-between items-center"
                  variant="destructive"
                  disabled={!clientRef.current || !clientRef.current.connected}
                >
                  <span className="flex items-center gap-2">
                    <RotateCw className="h-4 w-4" />
                    Reboot System
                  </span>
                </Button>
                <Button
                  onClick={() =>
                    sendCommand(
                      [],
                      "sudo shutdown now",
                      "This will shut down the system. You will need physical access to power it back on. Are you sure?"
                    )
                  }
                  className="w-full flex justify-between items-center"
                  variant="destructive"
                  disabled={!clientRef.current || !clientRef.current.connected}
                >
                  <span className="flex items-center gap-2">
                    <Power className="h-4 w-4" />
                    Shutdown System
                  </span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <Wifi className="h-6 w-6 text-blue-500 dark:text-blue-400" />
              <div>
                <h6 className="font-medium text-foreground">IP Address</h6>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{ipType}:</strong>{" "}
                  {ipAddress}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <Thermometer className="h-6 w-6 text-red-500 dark:text-red-400" />
              <div>
                <h6 className="font-medium text-foreground">CPU Temp</h6>
                <p className="text-sm text-muted-foreground">
                  {systemInfo.cpu_temp}°C
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <Cpu className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <h6 className="font-medium text-foreground">CPU Usage</h6>
                <p className="text-sm text-muted-foreground">
                  {systemInfo.cpu_usage}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <MemoryStick className="h-6 w-6 text-purple-500 dark:text-purple-400" />
              <div>
                <h6 className="font-medium text-foreground">Memory Usage</h6>
                <p className="text-sm text-muted-foreground">
                  {systemInfo.memory_usage}% ({systemInfo.used_memory}/
                  {systemInfo.total_memory} MB)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <HardDrive className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              <div>
                <h6 className="font-medium text-foreground">Disk Usage</h6>
                <p className="text-sm text-muted-foreground">
                  {systemInfo.disk_usage}% ({systemInfo.used_disk}/
                  {systemInfo.total_disk} MB)
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <Clock className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
              <div>
                <h6 className="font-medium text-foreground">Uptime</h6>
                <p className="text-sm text-muted-foreground">
                  {Math.floor(systemInfo.uptime / 3600)}h{" "}
                  {Math.floor((systemInfo.uptime % 3600) / 60)}m
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarInset>
  );
}
