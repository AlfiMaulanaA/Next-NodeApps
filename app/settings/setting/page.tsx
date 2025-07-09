"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wifi, WifiOff, Loader2, PlugZap, Power, Terminal, RotateCw, Settings, Thermometer, Cpu, MemoryStick, HardDrive, Clock } from "lucide-react";
import mqtt from "mqtt";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import MqttStatus from '@/components/mqtt-status';

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
  const [mqttStatus, setMqttStatus] = useState("Disconnected");
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
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const client = mqtt.connect(`${process.env.NEXT_PUBLIC_MQTT_BROKER_URL}`);
    client.on("connect", () => {
      setMqttStatus("Connected");
      client.subscribe("system/status");
      client.subscribe("service/response");
    });

    client.on("error", () => {
      setMqttStatus("Failed to Connect");
    });

    client.on("close", () => {
      setMqttStatus("Disconnected");
    });

    client.on("message", (topic, payload) => {
      const msg = JSON.parse(payload.toString());
      if (topic === "system/status") setSystemInfo(msg);
      if (topic === "service/response") toast.success(msg.message);
    });

    clientRef.current = client;

    const ipInterval = setInterval(() => setIpIndex(i => (i + 1) % 2), 3000);
    return () => {
      clearInterval(ipInterval);
      client.end();
    };
  }, []);

  const sendCommand = (services: string[], action: string) => {
    const payload = JSON.stringify({ services, action });
    clientRef.current?.publish("service/command", payload);
    toast.loading(`${action.toUpperCase()} initiated...`);
  };

  const ipType = ipIndex === 0 ? "eth0" : "wlan0";
  const ipAddress = ipIndex === 0 ? systemInfo.eth0_ip_address : systemInfo.wlan0_ip_address;

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Logic Control Configurations</h1>
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
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.location.reload()}
          >
            <RotateCw />
          </Button>
        </div>
      </header>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>System Management</span>
              <span className="flex items-center gap-2 text-sm">
                MQTT Status:
                <MqttStatus />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 justify-between w-full">
              <div className="flex-1 min-w-[200px]">
                <h6 className="text-sm font-semibold mb-2">Automation</h6>
                <Button onClick={() => sendCommand(["scheduler_control.service"], "restart")} className="w-full mb-2 flex justify-between items-center">
                  <span className="flex items-center gap-2"><RotateCw className="h-4 w-4" />Restart Scheduler</span>
                </Button>
                <Button onClick={() => sendCommand(["drycontact_control.service"], "restart")} className="w-full mb-2 flex justify-between items-center">
                  <span className="flex items-center gap-2"><RotateCw className="h-4 w-4" />Restart Drycontact</span>
                </Button>
                <Button onClick={() => sendCommand(["device_config.service"], "restart")} className="w-full flex justify-between items-center">
                  <span className="flex items-center gap-2"><RotateCw className="h-4 w-4" />Restart Operation Device</span>
                </Button>
              </div>
              <div className="flex-1 min-w-[200px]">
                <h6 className="text-sm font-semibold mb-2">Config</h6>
                <Button onClick={() => sendCommand(["mqtt_config.service"], "restart")} className="w-full mb-2 flex justify-between items-center" variant="secondary">
                  <span className="flex items-center gap-2"><Settings className="h-4 w-4" />Restart MQTT + IP</span>
                </Button>
                <Button onClick={() => sendCommand(["modular_i2c.service"], "restart")} className="w-full mb-2 flex justify-between items-center" variant="secondary">
                  <span className="flex items-center gap-2"><Settings className="h-4 w-4" />Restart Device Modular</span>
                </Button>
                <Button onClick={() => sendCommand(["MODBUS_SNMP.service"], "restart")} className="w-full flex justify-between items-center" variant="secondary">
                  <span className="flex items-center gap-2"><Settings className="h-4 w-4" />Restart Device Modbus</span>
                </Button>
              </div>
              <div className="flex-1 min-w-[200px]">
                <h6 className="text-sm font-semibold mb-2">System</h6>
                <Button onClick={() => sendCommand([], "reset") } className="w-full mb-2 flex justify-between items-center" variant="destructive">
                  <span className="flex items-center gap-2"><Terminal className="h-4 w-4" />Reset System</span>
                </Button>
                <Button onClick={() => sendCommand([], "reboot") } className="w-full mb-2 flex justify-between items-center" variant="destructive">
                  <span className="flex items-center gap-2"><RotateCw className="h-4 w-4" />Reboot System</span>
                </Button>
                <Button onClick={() => sendCommand([], "shutdown now") } className="w-full flex justify-between items-center" variant="destructive">
                  <span className="flex items-center gap-2"><Power className="h-4 w-4" />Shutdown System</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <Thermometer className="h-6 w-6 text-orange-500" />
              <div>
                <h6 className="font-medium">CPU Temp</h6>
                <p className="text-sm text-muted-foreground">{systemInfo.cpu_temp}°C</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <Cpu className="h-6 w-6 text-purple-500" />
              <div>
                <h6 className="font-medium">CPU Usage</h6>
                <p className="text-sm text-muted-foreground">{systemInfo.cpu_usage}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <MemoryStick className="h-6 w-6 text-green-500" />
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
              <HardDrive className="h-6 w-6 text-pink-500" />
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
