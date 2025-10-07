"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import mqtt, { MqttClient } from "mqtt";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  RotateCw,
  Zap,
  Send,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Settings,
  Activity,
  MessageSquare,
  Wifi,
  WifiOff,
  Play,
  Square,
  Delete,
  Copy,
  Search,
  Timer,
  Clock,
  Zap as ZapIcon,
  Compass,
} from "lucide-react";

// MQTT Message Interface
interface MQTTMessage {
  id: string;
  topic: string;
  payload: any;
  timestamp: Date;
  qos?: 0 | 1 | 2;
  retained?: boolean;
}

// MQTT Configuration Interface
interface MQTTConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId: string;
  keepalive?: number;
  reconnectPeriod?: number;
  connectTimeout?: number;
}

const MQTTDiscoverPage = () => {
  // MQTT Client reference
  const mqttClientRef = useRef<MqttClient | null>(null);

  // MQTT Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [discoveryMode, setDiscoveryMode] = useState(false);

  // MQTT Configuration
  const [mqttConfig, setMqttConfig] = useState<MQTTConfig>({
    host: "localhost",
    port: 1883,
    username: "",
    password: "",
    clientId: `mqtt-discover-${Date.now()}`,
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 30000,
  });

  // Custom MQTT Publishing
  const [customTopic, setCustomTopic] = useState("");
  const [customPayload, setCustomPayload] = useState("");
  const [publishQos, setPublishQos] = useState<0 | 1 | 2>(0);
  const [publishRetained, setPublishRetained] = useState(false);

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [newSubscription, setNewSubscription] = useState("");

  // Messages and Discovery
  const [messages, setMessages] = useState<MQTTMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<MQTTMessage[]>([]);
  const [topicFilter, setTopicFilter] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  // Statistics
  const [stats, setStats] = useState({
    totalMessages: 0,
    uniqueTopics: 0,
    messagesPerSecond: 0,
    lastMessageTime: null as Date | null,
  });

  // Refs for scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);
  const lastStatsUpdate = useRef(Date.now());

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll]);

  // Update filtered messages based on topic filter
  useEffect(() => {
    if (topicFilter) {
      const filtered = messages.filter(msg =>
        msg.topic.toLowerCase().includes(topicFilter.toLowerCase())
      );
      setFilteredMessages(filtered);
    } else {
      setFilteredMessages(messages);
    }
  }, [messages, topicFilter]);

  // Update statistics
  useEffect(() => {
    const uniqueTopics = new Set(messages.map(m => m.topic)).size;
    const now = Date.now();
    const timeDiff = (now - lastStatsUpdate.current) / 1000; // seconds
    const messagesPerSecond = timeDiff > 0 ? (messages.length - messageCountRef.current) / timeDiff : 0;

    setStats({
      totalMessages: messages.length,
      uniqueTopics,
      messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
      lastMessageTime: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
    });

    messageCountRef.current = messages.length;
    lastStatsUpdate.current = now;
  }, [messages]);

  // Auto-scroll effect
  useEffect(() => {
    scrollToBottom();
  }, [filteredMessages, scrollToBottom]);

  // Connect to MQTT Broker
  const connectToMQTT = useCallback(() => {
    try {
      setConnectionStatus("Connecting...");

      // Disconnect existing client if connected
      if (mqttClientRef.current && mqttClientRef.current.connected) {
        mqttClientRef.current.end();
      }

      // Create MQTT connection URL
      const mqttUrl = `mqtt://${mqttConfig.host}:${mqttConfig.port}`;

      // Create connection options
      const options: any = {
        clientId: mqttConfig.clientId,
        clean: true,
        connectTimeout: mqttConfig.connectTimeout,
        reconnectPeriod: mqttConfig.reconnectPeriod,
        keepalive: mqttConfig.keepalive,
      };

      if (mqttConfig.username) {
        options.username = mqttConfig.username;
      }
      if (mqttConfig.password) {
        options.password = mqttConfig.password;
      }

      // Create MQTT client
      const client = mqtt.connect(mqttUrl, options);
      mqttClientRef.current = client;

      client.on("connect", () => {
        setIsConnected(true);
        setConnectionStatus("Connected");
        toast.success("Connected to MQTT Broker");

        if (discoveryMode) {
          // Subscribe to all topics (#) for discovery
          client.subscribe("#", { qos: 0 }, (err: any) => {
            if (err) {
              toast.error("Failed to subscribe to all topics");
            } else {
              toast.success("Discovery mode: Listening to all topics");
              setSubscriptions(["#"]);
            }
          });
        } else {
          // Re-subscribe to existing topics
          subscriptions.forEach(topic => {
            if (topic !== "#") {
              client.subscribe(topic, { qos: 0 }, (err: any) => {
                if (err) {
                  toast.error(`Failed to subscribe to ${topic}`);
                }
              });
            }
          });
        }
      });

      client.on("error", (error: any) => {
        setIsConnected(false);
        setConnectionStatus(`Error: ${error.message}`);
        toast.error(`MQTT Error: ${error.message}`);
      });

      client.on("close", () => {
        setIsConnected(false);
        setConnectionStatus("Disconnected");
      });

      client.on("message", (topic: string, message: Buffer, packet: any) => {
        const newMessage: MQTTMessage = {
          id: `${topic}-${Date.now()}-${Math.random()}`,
          topic,
          payload: message.toString(),
          timestamp: new Date(),
          qos: packet.qos as 0 | 1 | 2,
          retained: packet.retain,
        };

        setMessages(prev => {
          const newMessages = [...prev, newMessage];
          // Keep only last 1000 messages to prevent memory issues
          return newMessages.length > 1000 ? newMessages.slice(-1000) : newMessages;
        });
      });
    } catch (error) {
      setConnectionStatus(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error("Failed to connect to MQTT Broker");
    }
  }, [mqttConfig, discoveryMode, subscriptions]);

  // Disconnect from MQTT Broker
  const disconnectFromMQTT = useCallback(() => {
    if (mqttClientRef.current) {
      mqttClientRef.current.end();
      mqttClientRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus("Disconnected");
    setSubscriptions([]);
    toast.success("Disconnected from MQTT Broker");
  }, []);

  // Toggle Discovery Mode
  const toggleDiscoveryMode = useCallback(() => {
    const client = mqttClientRef.current;
    if (!isConnected || !client) {
      setDiscoveryMode(!discoveryMode);
      return;
    }

    if (client && client.connected) {
      if (discoveryMode) {
        // Exit discovery mode
        client.unsubscribe("#", () => {
          setSubscriptions([]);
          setDiscoveryMode(false);
          toast.success("Exited discovery mode");
        });
      } else {
        // Enter discovery mode
        client.subscribe("#", { qos: 0 }, (err: any) => {
          if (err) {
            toast.error("Failed to enter discovery mode");
          } else {
            setSubscriptions(["#"]);
            setDiscoveryMode(true);
            toast.success("Discovery mode: Listening to all topics");
          }
        });
      }
    }
  }, [discoveryMode, isConnected]);

  // Add subscription
  const addSubscription = useCallback(() => {
    if (!newSubscription.trim()) return;

    const client = mqttClientRef.current;
    if (client && client.connected) {
      client.subscribe(newSubscription, { qos: 0 }, (err: any) => {
        if (err) {
          toast.error(`Failed to subscribe to ${newSubscription}`);
        } else {
          setSubscriptions(prev => [...prev, newSubscription]);
          setNewSubscription("");
          toast.success(`Subscribed to ${newSubscription}`);
        }
      });
    }
  }, [newSubscription]);

  // Remove subscription
  const removeSubscription = useCallback((topic: string) => {
    const client = mqttClientRef.current;
    if (client && client.connected) {
      client.unsubscribe(topic, (err: any) => {
        if (err) {
          toast.error(`Failed to unsubscribe from ${topic}`);
        } else {
          setSubscriptions(prev => prev.filter(t => t !== topic));
          toast.success(`Unsubscribed from ${topic}`);
        }
      });
    }
  }, []);

  // Publish custom message
  const publishCustomMessage = useCallback(() => {
    if (!customTopic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    try {
      const payloadToSend = customPayload.trim() || "";
      const client = mqttClientRef.current;

      if (client && client.connected) {
        client.publish(customTopic, payloadToSend, {
          qos: publishQos,
          retain: publishRetained
        }, (err: any) => {
          if (err) {
            toast.error(`Failed to publish to ${customTopic}`);
          } else {
            toast.success(`Published to ${customTopic}`);
            // Add to messages list as sent message
            const sentMessage: MQTTMessage = {
              id: `sent-${customTopic}-${Date.now()}`,
              topic: customTopic,
              payload: payloadToSend,
              timestamp: new Date(),
              qos: publishQos,
              retained: publishRetained,
            };
            setMessages(prev => [...prev, sentMessage]);
          }
        });
      } else {
        toast.error("Not connected to MQTT Broker");
      }
    } catch (error) {
      toast.error("Invalid JSON payload");
    }
  }, [customTopic, customPayload, publishQos, publishRetained]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setFilteredMessages([]);
  }, []);

  // Copy message to clipboard
  const copyMessage = useCallback((message: MQTTMessage) => {
    const text = `[${message.timestamp.toISOString()}] ${message.topic}: ${JSON.stringify(message.payload, null, 2)}`;
    navigator.clipboard.writeText(text);
    toast.success("Message copied to clipboard");
  }, []);

  // Format payload for display
  const formatPayload = (payload: any): string => {
    try {
      // Try to parse as JSON first
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return typeof payload === 'string' ? payload : String(payload);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString('id-ID', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Activity className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Payload Discover & Publisher</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connectionStatus}
          </Badge>
          <Button
            variant={isConnected ? "destructive" : "default"}
            size="sm"
            onClick={isConnected ? disconnectFromMQTT : connectToMQTT}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMessages}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Topics</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueTopics}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages/sec</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.messagesPerSecond}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Message</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {stats.lastMessageTime
                  ? formatTimestamp(stats.lastMessageTime)
                  : "None"
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MQTT Configuration - Outside tabs since it's shared */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              MQTT Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={mqttConfig.host}
                  onChange={(e) => setMqttConfig(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="localhost"
                />
              </div>
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={mqttConfig.port}
                  onChange={(e) => setMqttConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 1883 }))}
                  placeholder="1883"
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={mqttConfig.username}
                  onChange={(e) => setMqttConfig(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={mqttConfig.password}
                  onChange={(e) => setMqttConfig(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={mqttConfig.clientId}
                  onChange={(e) => setMqttConfig(prev => ({ ...prev, clientId: e.target.value }))}
                  placeholder="mqtt-discover-..."
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="discovery-mode"
                  checked={discoveryMode}
                  onCheckedChange={toggleDiscoveryMode}
                  disabled={isConnected}
                />
                <Label htmlFor="discovery-mode" className="text-sm">
                  Discovery Mode (Subscribe to all topics)
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="publish-subscribe" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="publish-subscribe" className="flex items-center gap-2">
              <ZapIcon className="h-4 w-4" />
              Publish & Subscribe
            </TabsTrigger>
            <TabsTrigger value="discovery" className="flex items-center gap-2">
              <Compass className="h-4 w-4" />
              Discovery
            </TabsTrigger>
          </TabsList>

          <TabsContent value="publish-subscribe" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Panel - Publish & Subscribe Tools */}
              <div className="space-y-6">
                {/* Custom Publisher */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      Custom Publisher
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="custom-topic">Topic</Label>
                      <Input
                        id="custom-topic"
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder="sensor/temperature"
                      />
                    </div>

                    <div>
                      <Label htmlFor="custom-payload">Payload</Label>
                      <Textarea
                        id="custom-payload"
                        value={customPayload}
                        onChange={(e) => setCustomPayload(e.target.value)}
                        placeholder='{"temperature": 25.5, "humidity": 60}'
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>QoS</Label>
                        <Select value={publishQos.toString()} onValueChange={(value) => setPublishQos(parseInt(value) as 0 | 1 | 2)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 - At most once</SelectItem>
                            <SelectItem value="1">1 - At least once</SelectItem>
                            <SelectItem value="2">2 - Exactly once</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="retained-pub"
                          checked={publishRetained}
                          onCheckedChange={setPublishRetained}
                        />
                        <Label htmlFor="retained-pub" className="text-sm">Retained</Label>
                      </div>
                    </div>

                    <Button
                      onClick={publishCustomMessage}
                      disabled={!isConnected || !customTopic.trim()}
                      className="w-full"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Publish Message
                    </Button>
                  </CardContent>
                </Card>

                {/* Subscriptions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Subscriptions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!discoveryMode && (
                      <div className="flex gap-2">
                        <Input
                          value={newSubscription}
                          onChange={(e) => setNewSubscription(e.target.value)}
                          placeholder="topic/to/subscribe"
                          onKeyDown={(e) => e.key === 'Enter' && addSubscription()}
                        />
                        <Button onClick={addSubscription} disabled={!isConnected || !newSubscription.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2">
                      {subscriptions.filter(topic => topic !== "#").map((topic, index) => (
                        <div key={index} className="flex items-center justify-between bg-muted/50 rounded p-2">
                          <span className="font-mono text-sm">{topic}</span>
                          {!discoveryMode && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeSubscription(topic)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {subscriptions.filter(topic => topic !== "#").length === 0 && (
                        <div className="text-center text-muted-foreground py-4">
                          No manual subscriptions
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Panel - Messages */}
              <div className="lg:col-span-2 space-y-4">
                {/* Controls */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Message Stream ({filteredMessages.length})
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="auto-scroll-sub"
                            checked={autoScroll}
                            onCheckedChange={setAutoScroll}
                          />
                          <Label htmlFor="auto-scroll-sub" className="text-sm">Auto-scroll</Label>
                        </div>
                        <Input
                          placeholder="Filter topics..."
                          value={topicFilter}
                          onChange={(e) => setTopicFilter(e.target.value)}
                          className="w-48"
                        />
                        <Button variant="outline" size="sm" onClick={clearMessages}>
                          <Delete className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Messages List */}
                <Card className="flex-1">
                  <CardContent className="p-0">
                    <ScrollArea className="h-[600px] p-4">
                      <div className="space-y-2">
                        {filteredMessages.map((message) => (
                          <div
                            key={message.id}
                            className="border rounded-lg p-3 bg-muted/20 hover:bg-muted/40 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {formatTimestamp(message.timestamp)}
                                </Badge>
                                {message.retained && (
                                  <Badge variant="secondary" className="text-xs">
                                    Retained
                                  </Badge>
                                )}
                                <Badge variant="default" className="text-xs">
                                  QoS {message.qos || 0}
                                </Badge>
                                {message.id.startsWith('sent-') && (
                                  <Badge variant="destructive" className="text-xs">
                                    Sent
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyMessage(message)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="font-medium text-sm mb-1 break-all">
                              {message.topic}
                            </div>
                            <pre className="text-xs bg-background p-2 rounded border overflow-x-auto whitespace-pre-wrap break-all">
                              {formatPayload(message.payload)}
                            </pre>
                          </div>
                        ))}
                        {filteredMessages.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No messages received yet</p>
                            {topicFilter && <p className="text-sm">Try adjusting your topic filter</p>}
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="discovery" className="space-y-6">
            <div className="grid grid-cols-1 space-y-6">
              {/* Discovery Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Compass className="h-5 w-5" />
                    Discovery Mode
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Listen to All Topics</h3>
                      <p className="text-sm text-muted-foreground">
                        Subscribe to # (all topics) to discover available MQTT topics and messages.
                      </p>
                    </div>
                    <Badge variant={discoveryMode ? "default" : "secondary"} className="flex items-center gap-1">
                      {discoveryMode ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {discoveryMode ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {!discoveryMode && (
                    <Button
                      onClick={() => setDiscoveryMode(true)}
                      disabled={isConnected}
                      className="w-full"
                    >
                      <Compass className="h-4 w-4 mr-2" />
                      {isConnected ? "Activate Discovery Mode" : "Connect First"}
                    </Button>
                  )}

                  {discoveryMode && (
                    <Button
                      variant="destructive"
                      onClick={() => setDiscoveryMode(false)}
                      className="w-full"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop Discovery Mode
                    </Button>
                  )}

                  {discoveryMode && subscriptions.includes("#") && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                        <Wifi className="h-4 w-4" />
                        <span className="font-medium">Discovery Active</span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Listening to all topics (#) to discover available MQTT traffic.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Discovery Messages */}
              <Card className="flex-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Discovery Results ({discoveryMode && filteredMessages.length > 10 ? "10+" : filteredMessages.length})
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="auto-scroll-disc"
                          checked={autoScroll}
                          onCheckedChange={setAutoScroll}
                        />
                        <Label htmlFor="auto-scroll-disc" className="text-sm">Auto-scroll</Label>
                      </div>
                      <Input
                        placeholder="Filter discovered topics..."
                        value={topicFilter}
                        onChange={(e) => setTopicFilter(e.target.value)}
                        className="w-64"
                      />
                      <Button variant="outline" size="sm" onClick={clearMessages}>
                        <Delete className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px] p-4">
                    <div className="space-y-2">
                      {discoveryMode ? (
                        filteredMessages.length > 0 ? (
                          filteredMessages.slice(0, 100).map((message) => (
                            <div
                              key={message.id}
                              className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 hover:bg-blue-100/50 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono text-xs bg-background">
                                    {formatTimestamp(message.timestamp)}
                                  </Badge>
                                  {message.retained && (
                                    <Badge variant="secondary" className="text-xs">
                                      Retained
                                    </Badge>
                                  )}
                                  <Badge variant="default" className="text-xs">
                                    QoS {message.qos || 0}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                    Discovered
                                  </Badge>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyMessage(message)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="font-medium text-sm mb-1 break-all text-blue-900 dark:text-blue-100">
                                {message.topic}
                              </div>
                              <pre className="text-xs bg-background p-2 rounded border overflow-x-auto whitespace-pre-wrap break-all text-blue-800 dark:text-blue-200">
                                {formatPayload(message.payload)}
                              </pre>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Compass className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Topics Discovered</h3>
                            <p>Activate discovery mode above to start listening for MQTT topics.</p>
                          </div>
                        )
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <EyeOff className="h-16 w-16 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-semibold mb-2">Discovery Mode Inactive</h3>
                          <p>Switch to discovery mode to explore available MQTT topics.</p>
                        </div>
                      )}

                      {discoveryMode && filteredMessages.length >= 100 && (
                        <div className="text-center py-4 text-muted-foreground">
                          <p className="text-sm">Showing first 100 messages. Use filters to narrow down results.</p>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarInset>
  );
};

export default MQTTDiscoverPage;
