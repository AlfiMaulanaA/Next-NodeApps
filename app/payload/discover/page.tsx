"use client";

import { useEffect, useRef, useState } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PlugZap,
  WifiOff,
  Wifi,
  Loader2,
  Inbox,Rss,
Radar,
RotateCw,
  List
} from "lucide-react";

interface Message {
  topic: string;
  payload: string;
  timestamp: string;
}

export default function MqttPage() {
  const [brokerHost, setBrokerHost] = useState("");
  const [brokerPort, setBrokerPort] = useState(9000);
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState("Disconnected");
  const [activeTab, setActiveTab] = useState("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [topicsMap, setTopicsMap] = useState<Map<string, string>>(new Map());
  const [topicListSet, setTopicListSet] = useState<Set<string>>(new Set());

  const clientRef = useRef<WebSocket | null>(null);

  const connectClient = () => {
    if (!brokerHost || !brokerPort) {
      toast.warning("Please enter broker host and port.");
      return;
    }

    setMqttConnectionStatus("Connecting...");

    const url = `ws://${brokerHost}:${brokerPort}`;
    const client = new WebSocket(url);

    client.onopen = () => {
      setMqttConnectionStatus("Connected");
      toast.success("Connected to MQTT broker");
      client.send(JSON.stringify({ action: "subscribe", topic: "#" }));
    };

    client.onerror = () => {
      setMqttConnectionStatus("Failed to Connect");
      toast.error("Failed to connect to broker");
    };

    client.onclose = () => {
      setMqttConnectionStatus("Disconnected");
      toast.error("Disconnected from broker");
    };

    client.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const timestamp = new Date().toLocaleString();
        const newMessage = {
          topic: data.topic,
          payload: data.payload,
          timestamp
        };
        setMessages((prev) => [newMessage, ...prev.slice(0, 99)]);
        setTopicsMap((prev) => new Map(prev).set(data.topic, data.payload));
        setTopicListSet((prev) => new Set(prev).add(data.topic));
      } catch (err) {
        console.error("Message parsing error:", err);
      }
    };

    clientRef.current = client;
  };

  const disconnectClient = () => {
    if (clientRef.current?.readyState === WebSocket.OPEN) {
      clientRef.current.close();
      toast.info("Disconnected from MQTT broker");
    }
  };

  const renderStatusIcon = () => {
    switch (mqttConnectionStatus) {
      case "Connected":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "Connecting...":
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case "Failed to Connect":
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <PlugZap className="h-4 w-4 text-gray-400" />;
    }
  };

    return (
      <SidebarInset>
            <header className="flex h-16 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Radar className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Logic Control Configurations</h1>
              </div>
              <div className="flex items-center gap-2">
                
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
          <CardTitle className="text-primary flex items-center gap-2">
            <PlugZap className="h-5 w-5" /> MQTT Manual Connect
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Broker Host</label>
            <Input
              placeholder="e.g. 192.168.0.100"
              value={brokerHost}
              onChange={(e) => setBrokerHost(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Port</label>
            <Input
              type="number"
              placeholder="e.g. 9000"
              value={brokerPort}
              onChange={(e) => setBrokerPort(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              className="w-full"
              disabled={mqttConnectionStatus === "Connected"}
              onClick={connectClient}
            >
              Connect
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              disabled={mqttConnectionStatus !== "Connected"}
              onClick={disconnectClient}
            >
              Disconnect
            </Button>
          </div>
          <div className="md:col-span-3 pt-2 flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <Badge variant="outline" className="flex items-center gap-2">
              {renderStatusIcon()}
              {mqttConnectionStatus}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="messages">
            <Inbox className="h-4 w-4 mr-1" /> Messages
          </TabsTrigger>
          <TabsTrigger value="topics">
            <Rss className="h-4 w-4 mr-1" /> Topics Discovery
          </TabsTrigger>
          <TabsTrigger value="allTopics">
            <List className="h-4 w-4 mr-1" /> All Topics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" /> Received Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[450px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground">No messages received yet.</p>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m, i) => (
                    <li key={i}>
                      <div className="text-sm font-semibold text-primary flex justify-between">
                        <span>{m.topic}</span>
                        <span className="text-xs text-muted-foreground">{m.timestamp}</span>
                      </div>
                      <div className="font-mono text-sm text-muted-foreground">{m.payload}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rss className="h-5 w-5" /> Discovered Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[450px] overflow-y-auto">
              {topicsMap.size === 0 ? (
                <p className="text-center text-muted-foreground">No topics discovered yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Array.from(topicsMap.entries()).map(([topic, payload], idx) => (
                    <li key={idx} className="flex justify-between text-sm">
                      <span className="font-medium">{topic}</span>
                      <span className="font-mono text-xs text-muted-foreground">{payload}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allTopics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" /> All Received Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[450px] overflow-y-auto">
              {topicListSet.size === 0 ? (
                <p className="text-center text-muted-foreground">No topics received yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {Array.from(topicListSet).map((topic, i) => (
                    <li key={i}>{i + 1}. <span className="font-medium">{topic}</span></li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </SidebarInset>
  );
}
