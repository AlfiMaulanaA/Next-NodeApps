"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, RefreshCw, Save, CheckCircle2, XCircle, Loader2 } from "lucide-react"; // Import Loader2
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import MqttStatus from "@/components/mqtt-status";
import type { MqttClient } from "mqtt";
import { toast } from "sonner";

export default function ModbusTCPSettingsPage() {
  const [modbusIP, setModbusIP] = useState("");
  const [modbusPort, setModbusPort] = useState("");
  const [inputIP, setInputIP] = useState("");
  const [inputPort, setInputPort] = useState("");
  const [modbusStatus, setModbusStatus] = useState("Unknown");
  const [matchConfig, setMatchConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // State untuk loading
  const clientRef = React.useRef<MqttClient | null>(null); // Referensi ke klien MQTT

  // Callback untuk mendapatkan pengaturan saat ini
  const getCurrentSetting = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.warning("MQTT not connected. Cannot retrieve settings.");
      setIsLoading(false); // Pastikan loading berhenti jika tidak terhubung
      return;
    }

    setIsLoading(true); // Set loading true saat request
    // Beri sedikit delay untuk memastikan subscribe sudah aktif di broker
    setTimeout(() => {
      client.publish("IOT/Containment/modbustcp/setting/command", JSON.stringify({ command: "read" }));
      toast.info("Requesting Modbus TCP settings...");
    }, 300); // Delay 300ms
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = [
      "IOT/Containment/modbustcp/setting/data",
      "IOT/Containment/modbustcp/status",
    ];

    // Subscribe semua topik segera
    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });

    // Jika klien sudah terhubung saat ini, langsung minta konfigurasi
    if (mqttClientInstance.connected) {
      getCurrentSetting();
    }

    // Listener untuk koneksi berhasil
    const handleConnect = () => {
      getCurrentSetting(); // Minta konfigurasi setiap kali koneksi berhasil
    };

    // Listener untuk pesan MQTT
    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());

        if (topic === "IOT/Containment/modbustcp/setting/data") {
          const { modbus_tcp_ip, modbus_tcp_port } = payload;
          setModbusIP(modbus_tcp_ip || "");
          setModbusPort(String(modbus_tcp_port || ""));
          setInputIP(modbus_tcp_ip || ""); // Set input field sesuai data yang diterima
          setInputPort(String(modbus_tcp_port || "")); // Set input field sesuai data yang diterima

          // Periksa apakah konfigurasi input cocok dengan yang diterima
          setMatchConfig(
            inputIP === modbus_tcp_ip && String(inputPort) === String(modbus_tcp_port)
          );
          toast.success("Modbus TCP settings loaded! 🎉");
          setIsLoading(false); // Data berhasil dimuat, hentikan loading
        } else if (topic === "IOT/Containment/modbustcp/status") {
          setModbusStatus(payload.modbusTCPStatus || "Unknown");
        }
      } catch (e) {
        toast.error("Invalid response from MQTT. Check backend payload.");
        console.error("Error parsing MQTT message:", message.toString(), e);
        setIsLoading(false); // Hentikan loading jika ada error parsing
      }
    };

    // Pasang event listener
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
  }, [getCurrentSetting, inputIP, inputPort]); // Tambahkan dependensi inputIP dan inputPort untuk setMatchConfig

  const writeSetting = () => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Cannot save configuration. 😔");
      return;
    }

    const parsedPort = parseInt(inputPort, 10);
    if (isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      toast.error("Invalid port number. Port must be a number between 1 and 65535.");
      return;
    }

    const payload = {
      command: "write",
      modbus_tcp_ip: inputIP,
      modbus_tcp_port: parsedPort,
    };

    setIsLoading(true); // Set loading true saat mengirim perubahan
    client.publish("IOT/Containment/modbustcp/setting/command", JSON.stringify(payload), {}, (err) => {
      if (err) {
        toast.error(`Failed to send write command: ${err.message} 😭`);
        setIsLoading(false); // Hentikan loading jika ada error
      } else {
        toast.success("Configuration sent. Verifying update...");
        // getCurrentSetting(); // Dapatkan setting terbaru setelah menulis
        // Tidak perlu panggil getCurrentSetting() di sini.
        // Backend harus mengirim balasan ke IOT/Containment/modbustcp/setting/data
        // secara otomatis setelah berhasil menulis, yang akan memicu update UI.
        // Jika tidak, Anda perlu memanggilnya setelah jeda waktu.
        setTimeout(() => {
          getCurrentSetting(); // Panggil setelah jeda untuk memastikan backend punya waktu memproses dan mempublikasi
        }, 1000); // Jeda 1 detik
      }
    });
  };

  const renderStatusConfig = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading configuration...</span>
        </div>
      );
    }
    if (matchConfig && modbusIP && modbusPort) {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span>Configuration matched.</span>
        </div>
      );
    }
    if (modbusIP || modbusPort) { // Jika ada data tapi belum match
      return (
        <div className="flex items-center gap-2 text-yellow-600">
          <XCircle className="w-4 h-4" />
          <span>Config mismatch. Save and get current setting again.</span>
        </div>
      );
    }
    // Jika tidak ada data dan tidak dalam proses loading
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
          <h1 className="text-lg font-semibold tracking-tight">Modbus TCP Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button variant="outline" size="sm" onClick={getCurrentSetting} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-1" /> Get Current Setting
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Modbus IP</label>
              <Input value={modbusIP} readOnly placeholder={isLoading ? "Loading..." : "N/A"} />
            </div>
            <div>
              <label className="text-sm font-medium">Modbus Port</label>
              <Input value={modbusPort} readOnly placeholder={isLoading ? "Loading..." : "N/A"} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Modbus Status</label>
              <span className="text-sm">{modbusStatus}</span>
            </div>
            {renderStatusConfig()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Modbus IP</label>
              <Input value={inputIP} onChange={(e) => setInputIP(e.target.value)} placeholder="192.168.0.179" />
            </div>
            <div>
              <label className="text-sm font-medium">Modbus Port</label>
              <Input value={inputPort} onChange={(e) => setInputPort(e.target.value)} placeholder="502" />
            </div>
            <Button className="mt-4 w-full" onClick={writeSetting} disabled={isLoading}>
              <Save className="w-4 h-4 mr-2" /> Save Configuration
            </Button>
            {/* !matchConfig && inputIP && inputPort dihapus dari sini karena sudah ditangani di renderStatusConfig */}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}