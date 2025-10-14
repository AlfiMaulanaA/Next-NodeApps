"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  PlusCircle,
  Edit2,
  Trash2,
  Settings,
  Database,
  Shield,
  Server,
  Cloud,
  CheckCircle,
  AlertCircle,
  Save,
  X,
  RefreshCw,
  Eye,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import { connectMQTTAsync } from "@/lib/mqttClient";

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
    username?: string;
    password?: string;
    qos: number;
    retain: boolean;
    keepalive: number;
    connection_timeout: number;
    reconnect_period: number;
  };
  fallback_brokers?: Array<{
    host: string;
    port: number;
    protocol: string;
    path?: string;
  }>;
  metadata: {
    created_by: string;
    version: string;
    last_updated: string;
    created_at?: string;
    updated_at?: string;
  };
  connection_status?: 'connected' | 'disconnected' | 'checking' | 'error' | 'unknown';
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

export default function BrokerTemplatesEmbedded() {
  const [templates, setTemplates] = useState<BrokerTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<BrokerTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string>("");
  const [mqttClient, setMqttClient] = useState<any>(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, 'connected' | 'disconnected' | 'checking' | 'error' | 'unknown'>>({});

  // Form state
  const [formData, setFormData] = useState<Partial<BrokerTemplate>>({
    template_id: "",
    name: "",
    description: "",
    category: "development",
    config: {
      protocol: "mqtt",
      host: "localhost",
      port: 1883,
      ssl: false,
      username: "",
      password: "",
      qos: 0,
      retain: false,
      keepalive: 60,
      connection_timeout: 5,
      reconnect_period: 3,
    },
    fallback_brokers: [],
    metadata: {
      created_by: "user",
      version: "1.0",
      last_updated: new Date().toISOString(),
    },
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  // MQTT Connection and Message Handling
  useEffect(() => {
    let mounted = true;

    const initializeMQTT = async () => {
      try {
        console.log('BrokerTemplatesEmbedded: Initializing MQTT connection...');
        const client = await connectMQTTAsync();

        if (!mounted) return;

        setMqttClient(client);
        setMqttConnected(true);

        // Subscribe to broker templates topics
        const topics = [
          'broker-templates/create',
          'broker-templates/update',
          'broker-templates/delete',
          'broker-templates/error'
        ];

        topics.forEach(topic => {
          client.subscribe(topic, { qos: 1 }, (err) => {
            if (err) {
              console.error(`Failed to subscribe to ${topic}:`, err);
            } else {
              console.log(`Subscribed to ${topic}`);
            }
          });
        });

        // Handle incoming MQTT messages
        const handleMessage = (topic: string, message: Buffer) => {
          try {
            const payload = JSON.parse(message.toString());
            console.log(`BrokerTemplatesEmbedded: Received MQTT message on ${topic}:`, payload);

            switch (topic) {
              case 'broker-templates/create':
                if (payload.action === 'create' && payload.template) {
                  setTemplates(prev => {
                    // Check if template already exists
                    const existingIndex = prev.findIndex(t => t.template_id === payload.template.template_id);
                    if (existingIndex >= 0) {
                      // Update existing template
                      const updated = [...prev];
                      updated[existingIndex] = payload.template;
                      return updated;
                    } else {
                      // Add new template
                      return [...prev, payload.template];
                    }
                  });
                  toast.success(`Template "${payload.template.name}" created via MQTT`);
                }
                break;

              case 'broker-templates/update':
                if (payload.action === 'update' && payload.template) {
                  setTemplates(prev => prev.map(t =>
                    t.template_id === payload.template.template_id ? payload.template : t
                  ));
                  toast.success(`Template "${payload.template.name}" updated via MQTT`);
                }
                break;

              case 'broker-templates/delete':
                if (payload.action === 'delete' && payload.template_id) {
                  setTemplates(prev => prev.filter(t => t.template_id !== payload.template_id));
                  toast.success(`Template deleted via MQTT`);
                }
                break;

              case 'broker-templates/error':
                if (payload.action === 'error') {
                  console.error('Broker templates MQTT error:', payload);
                  toast.error(`MQTT Error: ${payload.error || 'Unknown error'}`);
                }
                break;

              case 'broker-templates/response':
                if (payload.action === 'get_all_response' && payload.templates) {
                  console.log(`BrokerTemplatesEmbedded: Received get_all response with ${payload.total_count} templates`);
                  setTemplates(payload.templates);
                  setLoading(false);
                  toast.success(`Loaded ${payload.total_count} templates via MQTT`);
                }
                break;
            }
          } catch (error) {
            console.error('Error processing MQTT message:', error);
          }
        };

        client.on('message', handleMessage);

        // Store cleanup function
        return () => {
          console.log('BrokerTemplatesEmbedded: Cleaning up MQTT listeners...');
          client.off('message', handleMessage);
          topics.forEach(topic => {
            client.unsubscribe(topic, (err) => {
              if (err) console.error(`Failed to unsubscribe from ${topic}:`, err);
            });
          });
        };

      } catch (error) {
        console.error('BrokerTemplatesEmbedded: Failed to initialize MQTT:', error);
        if (mounted) {
          setMqttConnected(false);
          toast.error('Failed to connect to MQTT broker');
        }
      }
    };

    initializeMQTT();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (mqttClient) {
        console.log('BrokerTemplatesEmbedded: Disconnecting MQTT on unmount...');
        // Note: We don't disconnect the global MQTT client here
        // as it might be used by other components
      }
    };
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);

      console.log('BrokerTemplatesEmbedded: Starting template load...');

      // Wait for MQTT to be ready, then check connection
      setTimeout(async () => {
        try {
          console.log('BrokerTemplatesEmbedded: Attempting MQTT connection...');
          const { connectMQTTAsync } = await import('@/lib/mqttClient');
          const client = await connectMQTTAsync();

          console.log('BrokerTemplatesEmbedded: MQTT client obtained, checking connection...');

          // Double check if client is connected
          if (!client || !client.connected) {
            console.error('BrokerTemplatesEmbedded: MQTT client not connected');
            throw new Error('MQTT client not connected');
          }

          console.log('BrokerTemplatesEmbedded: MQTT client connected, subscribing to topics...');

          // Subscribe to response topic
          client.subscribe('broker-templates/response', { qos: 1 }, (err) => {
            if (err) {
              console.error('BrokerTemplatesEmbedded: Failed to subscribe to response topic:', err);
            } else {
              console.log('BrokerTemplatesEmbedded: Subscribed to broker-templates/response');
            }
          });

          const requestMessage = {
            action: 'get_all',
            request_id: `req_${Date.now()}`,
            timestamp: new Date().toISOString()
          };

          console.log('BrokerTemplatesEmbedded: Publishing get_all request...');
          client.publish('broker-templates/requests', JSON.stringify(requestMessage), { qos: 1 });

          // Listen for response with timeout
          let responseReceived = false;

          const handleResponse = (topic: string, message: Buffer) => {
            try {
              console.log(`BrokerTemplatesEmbedded: Received message on ${topic}`);
              const payload = JSON.parse(message.toString());
              console.log('BrokerTemplatesEmbedded: Parsed payload:', payload);

              if (payload.action === 'get_all_response' && payload.templates) {
                console.log(`BrokerTemplatesEmbedded: Received ${payload.templates.length} templates`);
                responseReceived = true;
                setTemplates(payload.templates);
                setLoading(false);
                toast.success(`Loaded ${payload.templates.length} templates via MQTT`);

                // Cleanup listener
                client.off('message', handleResponse);
                client.unsubscribe('broker-templates/response', (err) => {
                  if (err) console.error('BrokerTemplatesEmbedded: Failed to unsubscribe:', err);
                });
              }
            } catch (error) {
              console.error('BrokerTemplatesEmbedded: Error processing MQTT response:', error);
            }
          };

          client.on('message', handleResponse);

          // Timeout - if no response, show error
          setTimeout(() => {
            if (!responseReceived) {
              console.error('BrokerTemplatesEmbedded: Response timeout');
              client.off('message', handleResponse);
              client.unsubscribe('broker-templates/response', (err) => {
                if (err) console.error('BrokerTemplatesEmbedded: Failed to unsubscribe on timeout:', err);
              });
              toast.error('MQTT connection timeout. Please check if BrokerTemplateManager is running.');
              setTemplates([]);
              setLoading(false);
            }
          }, 10000); // Increased timeout to 10 seconds

        } catch (mqttError) {
          console.error('BrokerTemplatesEmbedded: MQTT connection failed:', mqttError);
          toast.error('Cannot connect to MQTT broker. Please ensure BrokerTemplateManager is running.');
          setTemplates([]);
          setLoading(false);
        }
      }, 1000); // Wait 1 second for MQTT to initialize
    } catch (error) {
      console.error('BrokerTemplatesEmbedded: Error initializing template load:', error);
      toast.error('Failed to initialize template loading');
      setTemplates([]);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      template_id: "",
      name: "",
      description: "",
      category: "development",
      config: {
        protocol: "mqtt",
        host: "localhost",
        port: 1883,
        ssl: false,
        username: "",
        password: "",
        qos: 0,
        retain: false,
        keepalive: 60,
        connection_timeout: 5,
        reconnect_period: 3,
      },
      fallback_brokers: [],
      metadata: {
        created_by: "user",
        version: "1.0",
        last_updated: new Date().toISOString(),
      },
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (template: BrokerTemplate) => {
    setFormData({ ...template });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (templateId: string) => {
    setDeleteTemplateId(templateId);
    setDeleteDialogOpen(true);
  };

  const openPreviewDialog = (template: BrokerTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      // Validate form
      if (!formData.template_id?.trim()) {
        toast.error("Template ID is required");
        return;
      }
      if (!formData.name?.trim()) {
        toast.error("Template name is required");
        return;
      }
      if (!formData.config?.host?.trim()) {
        toast.error("Host is required");
        return;
      }
      if (!formData.config?.port || formData.config.port < 1 || formData.config.port > 65535) {
        toast.error("Valid port number is required (1-65535)");
        return;
      }

      if (!mqttClient || !mqttConnected) {
        toast.error("MQTT not connected. Cannot save template.");
        return;
      }

      setSaving(true);

      const isEdit = editDialogOpen;
      const action = isEdit ? 'update' : 'create';
      const topic = `broker-templates/${action}`;

      const message = {
        action: action,
        template_id: isEdit ? formData.template_id : undefined,
        template: {
          ...formData,
          metadata: {
            ...formData.metadata,
            last_updated: new Date().toISOString(),
            ...(isEdit ? {} : { created_at: new Date().toISOString() }),
          },
        },
        request_id: `req_${Date.now()}`,
        timestamp: new Date().toISOString()
      };

      console.log(`BrokerTemplatesEmbedded: Publishing ${action} message to ${topic}`);
      mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });

      toast.success(`Template ${isEdit ? 'update' : 'create'} request sent via MQTT`);
      setCreateDialogOpen(false);
      setEditDialogOpen(false);
      resetForm();

    } catch (error: any) {
      console.error('Error sending MQTT message:', error);
      toast.error(error.message || 'Failed to send MQTT message');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (!mqttClient || !mqttConnected) {
        toast.error("MQTT not connected. Cannot delete template.");
        return;
      }

      setSaving(true);

      const message = {
        action: 'delete',
        template_id: deleteTemplateId,
        request_id: `req_${Date.now()}`,
        timestamp: new Date().toISOString()
      };

      console.log(`BrokerTemplatesEmbedded: Publishing delete message for ${deleteTemplateId}`);
      mqttClient.publish('broker-templates/delete', JSON.stringify(message), { qos: 1 });

      toast.success('Template delete request sent via MQTT');
      setDeleteDialogOpen(false);
      setDeleteTemplateId("");

    } catch (error: any) {
      console.error('Error sending MQTT delete message:', error);
      toast.error(error.message || 'Failed to send MQTT delete message');
    } finally {
      setSaving(false);
    }
  };

  const copyTemplateId = (templateId: string) => {
    navigator.clipboard.writeText(templateId);
    toast.success('Template ID copied to clipboard');
  };

  const getCategoryIcon = (category: string) => {
    const IconComponent = categoryIcons[category] || Settings;
    return <IconComponent className="h-4 w-4" />;
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateConfig = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config!,
        [field]: value,
      },
    }));
  };

  // Check connection status for a broker template - now uses backend API
  const checkConnectionStatus = async (template: BrokerTemplate): Promise<'connected' | 'disconnected'> => {
    // Connection status is now provided by backend in the template data
    // This function is kept for compatibility but status comes from MQTT response
    const status = template.connection_status;
    return status === 'connected' ? 'connected' : 'disconnected';
  };

  // Update connection status for all templates
  const updateConnectionStatuses = async () => {
    if (templates.length === 0) return;

    // Set all to checking first
    const checkingStatuses: Record<string, 'checking'> = {};
    templates.forEach(template => {
      checkingStatuses[template.template_id] = 'checking';
    });
    setConnectionStatuses(checkingStatuses);

    // Check each template's connection status
    const statusPromises = templates.map(async (template) => {
      const status = await checkConnectionStatus(template);
      return { templateId: template.template_id, status };
    });

    const results = await Promise.all(statusPromises);
    const newStatuses: Record<string, 'connected' | 'disconnected'> = {};
    results.forEach(({ templateId, status }) => {
      newStatuses[templateId] = status;
    });

    setConnectionStatuses(newStatuses);
  };

  // Update connection statuses when templates change
  useEffect(() => {
    if (templates.length > 0) {
      updateConnectionStatuses();
    }
  }, [templates]);

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
          username: "",
          password: "",
          qos: 0,
          retain: false,
          keepalive: 60,
          connection_timeout: 5,
          reconnect_period: 3,
        },
        fallback_brokers: [],
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
          username: "",
          password: "",
          qos: 0,
          retain: false,
          keepalive: 60,
          connection_timeout: 5,
          reconnect_period: 3,
        },
        fallback_brokers: [],
        metadata: {
          created_by: "system",
          version: "1.0",
          last_updated: new Date().toISOString(),
        },
      },
    ];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Templates</p>
                <p className="text-2xl font-bold tracking-tight">{templates.length}</p>
              </div>
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Development</p>
                <p className="text-2xl font-bold tracking-tight text-blue-600">
                  {templates.filter(t => t.category === 'development').length}
                </p>
              </div>
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Production</p>
                <p className="text-2xl font-bold tracking-tight text-green-600">
                  {templates.filter(t => t.category === 'production').length}
                </p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Edge & Backup</p>
                <p className="text-2xl font-bold tracking-tight text-purple-600">
                  {templates.filter(t => ['edge', 'backup'].includes(t.category)).length}
                </p>
              </div>
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Server className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Broker Templates
            </div>
            <Button size="sm" onClick={openCreateDialog} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create Template
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="w-16 text-center font-semibold">#</TableHead>
                  <TableHead className="min-w-[200px]">Template</TableHead>
                  <TableHead className="min-w-[150px]">Category</TableHead>
                  <TableHead className="min-w-[200px]">Broker Config</TableHead>
                  <TableHead className="min-w-[120px]">Connection Status</TableHead>
                  <TableHead className="min-w-[120px]">Version</TableHead>
                  <TableHead className="w-32 text-center font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                          <Settings className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold">No templates found</h3>
                          <p className="text-muted-foreground max-w-sm">
                            Create your first broker template to get started.
                          </p>
                        </div>
                        <Button onClick={openCreateDialog}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Create Template
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((template, index) => (
                    <TableRow key={template.template_id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center font-mono text-sm">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-sm flex items-center gap-2">
                            {getCategoryIcon(template.category)}
                            {template.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {template.description}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              ID: {template.template_id}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={categoryColors[template.category] || 'bg-gray-100'}>
                          {template.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Host:</span>
                            <span className="font-mono">{template.config.host}:{template.config.port}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">QoS:</span>
                            <span>{template.config.qos}</span>
                            <span className="font-medium">SSL:</span>
                            {template.config.ssl ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <X className="h-3 w-3 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {template.connection_status === 'checking' ? (
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Checking...</span>
                            </div>
                          ) : template.connection_status === 'connected' ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-xs text-green-600 font-medium">Connected</span>
                            </div>
                          ) : template.connection_status === 'disconnected' ? (
                            <div className="flex items-center gap-2">
                              <X className="h-4 w-4 text-red-600" />
                              <span className="text-xs text-red-600 font-medium">Disconnected</span>
                            </div>
                          ) : template.connection_status === 'error' ? (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                              <span className="text-xs text-orange-600 font-medium">Error</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Settings className="h-4 w-4 text-gray-600" />
                              <span className="text-xs text-gray-600 font-medium">Unknown</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="font-mono">v{template.metadata.version}</div>
                          <div className="text-muted-foreground">
                            {new Date(template.metadata.last_updated).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPreviewDialog(template)}
                            className="h-8 w-8 p-0"
                            title="Preview"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyTemplateId(template.template_id)}
                            className="h-8 w-8 p-0"
                            title="Copy ID"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(template)}
                            className="h-8 w-8 p-0"
                            title="Edit"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDeleteDialog(template.template_id)}
                            className="h-8 w-8 p-0"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Template Dialog */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {createDialogOpen ? <PlusCircle className="h-5 w-5" /> : <Edit2 className="h-5 w-5" />}
              {createDialogOpen ? 'Create New Broker Template' : 'Edit Broker Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template_id">Template ID *</Label>
                  <Input
                    id="template_id"
                    placeholder="e.g., my_custom_broker_v1"
                    value={formData.template_id || ''}
                    onChange={(e) => updateFormData('template_id', e.target.value)}
                    disabled={editDialogOpen} // Can't change ID when editing
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., My Custom Broker"
                    value={formData.name || ''}
                    onChange={(e) => updateFormData('name', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this broker template..."
                  value={formData.description || ''}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category || 'development'}
                  onValueChange={(value) => updateFormData('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Development
                      </div>
                    </SelectItem>
                    <SelectItem value="production">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Production
                      </div>
                    </SelectItem>
                    <SelectItem value="edge">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Edge Computing
                      </div>
                    </SelectItem>
                    <SelectItem value="backup">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4" />
                        Backup/Failover
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.category === 'development' && "Local development and testing environments"}
                  {formData.category === 'production' && "Secure production environments with high reliability"}
                  {formData.category === 'edge' && "Edge computing and IoT gateway deployments"}
                  {formData.category === 'backup' && "Failover and backup broker configurations"}
                </p>
              </div>
            </div>

            {/* Broker Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Broker Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="protocol">Protocol</Label>
                  <Select
                    value={formData.config?.protocol || 'mqtt'}
                    onValueChange={(value) => updateConfig('protocol', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mqtt">MQTT</SelectItem>
                      <SelectItem value="ws">WebSocket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="host">Host *</Label>
                  <Input
                    id="host"
                    placeholder="e.g., localhost, mqtt.example.com"
                    value={formData.config?.host || ''}
                    onChange={(e) => updateConfig('host', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="1883"
                    min="1"
                    max="65535"
                    value={formData.config?.port || ''}
                    onChange={(e) => updateConfig('port', parseInt(e.target.value) || 1883)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssl">SSL/TLS Encryption</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ssl"
                      checked={formData.config?.ssl || false}
                      onCheckedChange={(checked) => updateConfig('ssl', checked)}
                    />
                    <Label htmlFor="ssl" className="text-sm">
                      {formData.config?.ssl ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                </div>
              </div>

              {/* Authentication */}
              <div className="space-y-4">
                <h4 className="font-medium">Authentication (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="MQTT username"
                      value={formData.config?.username || ''}
                      onChange={(e) => updateConfig('username', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="MQTT password"
                      value={formData.config?.password || ''}
                      onChange={(e) => updateConfig('password', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* MQTT Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">MQTT Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="qos">QoS Level</Label>
                    <Select
                      value={String(formData.config?.qos || 0)}
                      onValueChange={(value) => updateConfig('qos', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">QoS 0 - At most once</SelectItem>
                        <SelectItem value="1">QoS 1 - At least once</SelectItem>
                        <SelectItem value="2">QoS 2 - Exactly once</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retain">Retain Messages</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="retain"
                        checked={formData.config?.retain || false}
                        onCheckedChange={(checked) => updateConfig('retain', checked)}
                      />
                      <Label htmlFor="retain" className="text-sm">
                        {formData.config?.retain ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keepalive">Keep Alive (seconds)</Label>
                    <Input
                      id="keepalive"
                      type="number"
                      placeholder="60"
                      min="10"
                      max="3600"
                      value={formData.config?.keepalive || 60}
                      onChange={(e) => updateConfig('keepalive', parseInt(e.target.value) || 60)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="connection_timeout">Connection Timeout (seconds)</Label>
                    <Input
                      id="connection_timeout"
                      type="number"
                      placeholder="5"
                      min="1"
                      max="60"
                      value={formData.config?.connection_timeout || 5}
                      onChange={(e) => updateConfig('connection_timeout', parseInt(e.target.value) || 5)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reconnect_period">Reconnect Period (seconds)</Label>
                    <Input
                      id="reconnect_period"
                      type="number"
                      placeholder="3"
                      min="1"
                      max="300"
                      value={formData.config?.reconnect_period || 3}
                      onChange={(e) => updateConfig('reconnect_period', parseInt(e.target.value) || 3)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editDialogOpen ? 'Update Template' : 'Create Template'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Template Preview
            </DialogTitle>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getCategoryIcon(selectedTemplate.category)}
                <h3 className="text-lg font-medium">{selectedTemplate.name}</h3>
                <Badge className={categoryColors[selectedTemplate.category]}>
                  {selectedTemplate.category}
                </Badge>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(selectedTemplate, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Trash2 className="h-5 w-5 text-destructive" />
              Confirm Delete
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Are you sure you want to delete this broker template? This action cannot be undone.
              </AlertDescription>
            </Alert>

            {deleteTemplateId && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">
                  <strong>Template ID:</strong> {deleteTemplateId}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
