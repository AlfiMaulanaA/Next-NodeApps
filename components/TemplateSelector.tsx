"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  Cloud,
  Server,
  Database,
  Shield,
  Info,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff
} from "lucide-react";

interface BrokerTemplate {
  template_id: string;
  name: string;
  description: string;
  category: string;
  config: {
    protocol: string;
    host: string;
    port: number;
    ssl: boolean;
    qos: number;
    retain: boolean;
    keepalive: number;
  };
  metadata: {
    created_by: string;
    version: string;
    last_updated: string;
  };
}

interface TemplateSelectorProps {
  selectedTemplateId?: string;
  onTemplateChange: (templateId: string) => void;
  onConfigChange?: (config: any) => void;
  disabled?: boolean;
}

const categoryIcons: Record<string, any> = {
  development: Database,
  production: Shield,
  edge: Server,
  backup: Cloud,
};

const categoryColors: Record<string, string> = {
  development: "bg-blue-100 text-blue-800 border-blue-200",
  production: "bg-green-100 text-green-800 border-green-200",
  edge: "bg-purple-100 text-purple-800 border-purple-200",
  backup: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function TemplateSelector({
  selectedTemplateId,
  onTemplateChange,
  onConfigChange,
  disabled = false
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<BrokerTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      // Clear any existing templates first
      setTemplates([]);

      console.log('TemplateSelector: Starting template load...');

      // Wait for MQTT to be ready, then try to connect
      setTimeout(async () => {
        try {
          console.log('TemplateSelector: Attempting MQTT connection...');
          const { connectMQTTAsync } = await import('@/lib/mqttClient');
          const client = await connectMQTTAsync();

          console.log('TemplateSelector: MQTT client obtained, checking connection...');

          // Double check if client is connected
          if (!client || !client.connected) {
            console.error('TemplateSelector: MQTT client not connected');
            throw new Error('MQTT client not connected');
          }

          console.log('TemplateSelector: MQTT client connected, subscribing to topics...');

          // Subscribe to response topic
          client.subscribe('broker-templates/response', { qos: 1 }, (err) => {
            if (err) {
              console.error('TemplateSelector: Failed to subscribe to response topic:', err);
            } else {
              console.log('TemplateSelector: Subscribed to broker-templates/response');
            }
          });

          const requestMessage = {
            action: 'get_all',
            request_id: `req_${Date.now()}`,
            timestamp: new Date().toISOString()
          };

          console.log('TemplateSelector: Publishing get_all request...');
          client.publish('broker-templates/requests', JSON.stringify(requestMessage), { qos: 1 });

          // Listen for response with timeout
          let responseReceived = false;

          const handleResponse = (topic: string, message: Buffer) => {
            try {
              console.log(`TemplateSelector: Received message on ${topic}`);
              const payload = JSON.parse(message.toString());
              console.log('TemplateSelector: Parsed payload:', payload);

              if (payload.action === 'get_all_response' && payload.templates) {
                console.log(`TemplateSelector: Received ${payload.templates.length} templates`);
                responseReceived = true;
                setTemplates(payload.templates);
                setLoading(false);

                // Cache templates in localStorage for future use
                localStorage.setItem('broker-templates-cache', JSON.stringify(payload.templates));

                // Auto-select first template if none selected
                if (!selectedTemplateId && payload.templates.length > 0) {
                  onTemplateChange(payload.templates[0].template_id);
                }

                // Cleanup listener
                client.off('message', handleResponse);
                client.unsubscribe('broker-templates/response', (err) => {
                  if (err) console.error('TemplateSelector: Failed to unsubscribe:', err);
                });
              }
            } catch (error) {
              console.error('TemplateSelector: Error processing MQTT response:', error);
            }
          };

          client.on('message', handleResponse);

          // Timeout - if no response, show error
          setTimeout(() => {
            if (!responseReceived) {
              console.error('TemplateSelector: Response timeout');
              client.off('message', handleResponse);
              client.unsubscribe('broker-templates/response', (err) => {
                if (err) console.error('TemplateSelector: Failed to unsubscribe on timeout:', err);
              });
              setError("MQTT connection timeout. Please check if BrokerTemplateManager is running.");
              setLoading(false);
            }
          }, 10000); // Increased timeout to 10 seconds

        } catch (mqttError) {
          console.error('TemplateSelector: MQTT connection failed:', mqttError);
          setError("Cannot connect to MQTT broker. Please ensure BrokerTemplateManager is running.");
          setLoading(false);
        }
      }, 1000); // Wait 1 second for MQTT to initialize

    } catch (err) {
      console.error("TemplateSelector: Template loading error:", err);
      setError("Failed to initialize template loading");
      setLoading(false);
    }
  };

  // Default templates as ultimate fallback
  const getDefaultTemplates = (): BrokerTemplate[] => {
    return [
      {
        template_id: "default_local",
        name: "Local MQTT Broker",
        description: "Default local MQTT broker configuration",
        category: "development",
        config: {
          protocol: "mqtt",
          host: "localhost",
          port: 1883,
          ssl: false,
          qos: 0,
          retain: false,
          keepalive: 60,
        },
        metadata: {
          created_by: "system",
          version: "1.0",
          last_updated: new Date().toISOString(),
        },
      },
      {
        template_id: "default_websocket",
        name: "WebSocket MQTT Broker",
        description: "Default WebSocket MQTT broker configuration",
        category: "development",
        config: {
          protocol: "ws",
          host: "localhost",
          port: 9000,
          ssl: false,
          qos: 0,
          retain: false,
          keepalive: 60,
        },
        metadata: {
          created_by: "system",
          version: "1.0",
          last_updated: new Date().toISOString(),
        },
      },
    ];
  };

  const selectedTemplate = templates.find(t => t.template_id === selectedTemplateId);

  const getCategoryIcon = (category: string) => {
    const IconComponent = categoryIcons[category] || Settings;
    return <IconComponent className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="space-y-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" />
          Broker Template Selection
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose a pre-configured broker template for your payload
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Template Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Select Broker Template
          </label>
          <Select
            value={selectedTemplateId || ""}
            onValueChange={onTemplateChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a broker template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.template_id} value={template.template_id}>
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(template.category)}
                    <span>{template.name}</span>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-xs ${categoryColors[template.category] || 'bg-gray-100'}`}
                    >
                      {template.category}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Template Details */}
        {selectedTemplate && (
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getCategoryIcon(selectedTemplate.category)}
                <h4 className="font-medium text-sm">{selectedTemplate.name}</h4>
                <Badge className={categoryColors[selectedTemplate.category]}>
                  {selectedTemplate.category}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {selectedTemplate.config.ssl ? (
                  <Shield className="h-4 w-4 text-green-600" />
                ) : (
                  <Shield className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {selectedTemplate.description}
            </p>

            {/* Template Configuration Details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Host:</span>
                  <span className="font-mono">{selectedTemplate.config.host}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Port:</span>
                  <span className="font-mono">{selectedTemplate.config.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protocol:</span>
                  <span className="font-mono">{selectedTemplate.config.protocol}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">QoS:</span>
                  <span className="font-mono">{selectedTemplate.config.qos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retain:</span>
                  <span className={`font-mono ${selectedTemplate.config.retain ? 'text-green-600' : 'text-gray-500'}`}>
                    {selectedTemplate.config.retain ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Keepalive:</span>
                  <span className="font-mono">{selectedTemplate.config.keepalive}s</span>
                </div>
              </div>
            </div>

            {/* SSL Status */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              {selectedTemplate.config.ssl ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-700">SSL/TLS encryption enabled</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-orange-700">No encryption (development only)</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Template Categories Info */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-muted-foreground">Template Categories:</h5>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3 text-blue-600" />
              <span>Development - Local testing</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-green-600" />
              <span>Production - Secure cloud</span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="h-3 w-3 text-purple-600" />
              <span>Edge - Local processing</span>
            </div>
            <div className="flex items-center gap-2">
              <Cloud className="h-3 w-3 text-orange-600" />
              <span>Backup - Failover support</span>
            </div>
          </div>
        </div>

        {/* Override Settings */}
        {selectedTemplate && (
          <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Template Override Settings</span>
            </div>
            <p className="text-xs text-blue-700">
              You can override QoS, interval, and other settings after selecting a template.
              The broker connection settings from the template will be preserved.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}