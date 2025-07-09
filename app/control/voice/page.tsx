"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, Mic, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { Client as PahoClient } from "paho-mqtt";

interface VoiceControlDevice {
  uuid: string;
  device_name: string;
  data: {
    pin: number;
    custom_name: string;
    address: number;
    bus: number;
  };
}

export default function VoiceControlPage() {
  const [voiceControls, setVoiceControls] = useState<VoiceControlDevice[]>([]);
  const [spokenText, setSpokenText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [mqttStatus, setMqttStatus] = useState("Disconnected");
  const mqttClientRef = useRef<PahoClient | null>(null);

  useEffect(() => {
    const broker = window.location.hostname;
    const client = new PahoClient(broker, Number(9001), `client-${Math.random()}`);

    client.onConnectionLost = () => {
      setMqttStatus("Disconnected");
    };

    client.onMessageArrived = (message) => {
      try {
        const payload = JSON.parse(message.payloadString);
        if (message.destinationName === "voice_control/data") {
          setVoiceControls(payload);
        }
      } catch (e) {
        console.error("MQTT parse error:", e);
      }
    };

    client.connect({
      onSuccess: () => {
        setMqttStatus("Connected");
        client.subscribe("voice_control/data");
      },
      onFailure: () => setMqttStatus("Failed to Connect")
    });

    mqttClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  const startSpeechRecognition = () => {
    const SpeechRecognition = typeof window !== "undefined"
      ? (window.SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;

    if (!SpeechRecognition) {
      toast.error("SpeechRecognition is not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = false;

    setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setSpokenText(transcript);
      handleVoiceCommand(transcript);
    };

    recognition.onerror = (e: any) => {
      console.error("Speech error:", e);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleVoiceCommand = (text: string) => {
    const cleanText = text.toLowerCase();
    let action = 0;

    if (cleanText.includes("nyalakan")) {
      action = 1;
    } else if (cleanText.includes("matikan")) {
      action = 0;
    }

    const deviceName = cleanText.replace("nyalakan", "").replace("matikan", "").trim();
    const found = voiceControls.find(v => v.data.custom_name.toLowerCase() === deviceName);

    if (!found) {
      toast.error("Device not found");
      return;
    }

    const relayData = {
      mac: "MAC_ADDRESS", // replace with actual MAC if available
      protocol_type: "Modular",
      device: "RELAYMINI",
      function: "write",
      value: {
        pin: found.data.pin,
        data: action
      },
      address: found.data.address,
      device_bus: found.data.bus,
      Timestamp: new Date().toISOString().slice(0, 19).replace("T", " ")
    };

    mqttClientRef.current?.send("modular", JSON.stringify(relayData));
    toast.success("Command sent to device");
  };

  const refreshDevices = () => {
    mqttClientRef.current?.send("command", JSON.stringify({ action: "get_voice_control" }));
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Voice Control</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`capitalize ${
              mqttStatus === "Connected"
                ? "text-green-600 border-green-600"
                : mqttStatus === "Failed to Connect"
                ? "text-yellow-600 border-yellow-600"
                : "text-red-600 border-red-600"
            }`}
          >
            {mqttStatus}
          </Badge>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={refreshDevices}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold">Devices</h2>
          <Button onClick={startSpeechRecognition}>
            <Mic className="h-4 w-4 mr-1" /> Start Voice Command
          </Button>
        </div>

        {spokenText && (
          <p className="text-sm text-muted-foreground">You said: <strong>{spokenText}</strong></p>
        )}

        {voiceControls.length > 0 ? (
          voiceControls.map((device, index) => (
            <Card key={device.uuid}>
              <CardHeader>
                <CardTitle className="text-base">{device.data.custom_name}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Address: {device.data.address} — Bus: {device.data.bus}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">Pin: {device.data.pin}</div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline">
                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              No voice control devices found.
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
}
