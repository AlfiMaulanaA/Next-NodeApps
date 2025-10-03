"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { connectMQTT, getMQTTClient, disconnectMQTT } from "@/lib/mqttClient";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RotateCw,
  Zap,
  PlusCircle,
  Trash2,
  Edit2,
  Play,
  Pause,
  Settings2,
  AlertTriangle,
  TrendingUp,
  Activity,
  Code,
  Eye,
  Calendar,
  MessageSquare,
  Power,
  Gauge,
} from "lucide-react";
import MqttStatus from "@/components/mqtt-status";

// Type definitions for Remapping Configuration
interface Device {
  id: string;
  name: string;
  part_number: string;
  manufacturer: string;
  topic: string;
  device_type?: string;
}

interface DeviceField {
  var_name: string;
  relative_address?: number;
  register_type?: string;
  word_length?: number;
  data_type?: string;
  multiplier?: number;
  uom?: string;
  gpio_number?: number;
}

interface KeyMapping {
  original_key: string;
  custom_key: string;
}

interface SourceDevice {
  device_id: string;
  device_name: string;
  mqtt_topic: string;
  available_keys: DeviceField[];
  key_mappings: KeyMapping[];
}

interface MQTTPublishConfig {
  broker_url: string;
  client_id: string;
  topic: string;
  qos: number;
  retain: boolean;
  lwt: boolean;
  publish_interval_seccond: number;
}

interface RemappingConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  source_devices: SourceDevice[];
  key_mappings: KeyMapping[];
  mqtt_publish_config: MQTTPublishConfig;
}

interface RemappingConfigData {
  remapping_configs: RemappingConfig[];
}

interface MQTTResponse {
  status: "success" | "error";
  message: string;
  data?: any;
  configs?: any;
  id?: string;
  count?: number;
  timestamp?: string;
}

interface RealTimeData {
  [key: string]: any;
}

const RemappingControl = () => {
  // MQTT Topics - simplified for remapping
  const TOPICS = useMemo(
    () => ({
      // MQTT Topics
      MODBUS_AVAILABLES: "MODBUS_DEVICE/AVAILABLES",
      MODULAR_AVAILABLES: "MODULAR_DEVICE/AVAILABLES",
    }),
    []
  );

  // Connection Status
  const [mqttConnectionStatus, setMqttConnectionStatus] =
    useState("Disconnected");

  // Data States
  const [remappingConfigs, setRemappingConfigs] = useState<RemappingConfigData>(
    { remapping_configs: [] }
  );
  const [modbusDevices, setModbusDevices] = useState<Device[]>([]);
  const [modularDevices, setModularDevices] = useState<Device[]>([]);
  const [deviceProfiles, setDeviceProfiles] = useState<
    Record<string, Record<string, any[]>>
  >({});
  const [loading, setLoading] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Background thread for config data publishing
  const configPublishIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time data state
  const [realTimeData, setRealTimeData] = useState<
    Record<string, RealTimeData>
  >({});

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<RemappingConfig | null>(
    null
  );

  // Preview Dialog State
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewTopic, setPreviewTopic] = useState<string>("");
  const [previewData, setPreviewData] = useState<RealTimeData>({});

  // Alert and Confirmation Dialog States
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertDialogContent, setAlertDialogContent] = useState<{
    title: string;
    description: string;
  }>({ title: "", description: "" });

  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [confirmationDialogContent, setConfirmationDialogContent] = useState<{
    title: string;
    description: string;
    confirmAction: () => void;
  }>({ title: "", description: "", confirmAction: () => {} });

  // Form States
  const [currentConfig, setCurrentConfig] = useState<RemappingConfig>({
    id: "",
    name: "",
    description: "",
    enabled: true,
    created_at: "",
    updated_at: "",
    source_devices: [],
    key_mappings: [],
    mqtt_publish_config: {
      broker_url: "mqtt://localhost:1883",
      client_id: "remapper_client_" + uuidv4().slice(0, 8),
      topic: "",
      qos: 1,
      retain: false,
      lwt: true,
      publish_interval_seccond: 10,
    },
  });

  // MQTT Publishers
  const publishToRemapping = useCallback((payload: any) => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("Cannot send command, MQTT client is not connected.");
      return;
    }
    client.publish("REMAP_COMMAND", JSON.stringify(payload));
  }, []);

  // Thread for pushing config data every 3 seconds
  const publishConfigToRemapResponse = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      return;
    }

    // Send current remapping config data to REMAP_RESPONSE topic
    const configData = {
      remapping_configs: remappingConfigs.remapping_configs,
      timestamp: new Date().toISOString(),
      source: "remapping_page_periodic_update",
    };

    client.publish("REMAP_RESPONSE", JSON.stringify(configData));
  }, [remappingConfigs]);

  const publishToAvailableDevices = useCallback((payload: any) => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("Cannot request devices, MQTT client is not connected.");
      return;
    }
    client.publish("command_available_devices", JSON.stringify(payload));
  }, []);

  // CRUD Operations
  const createConfig = useCallback(
    (config: RemappingConfig) => {
      setLoading(true);
      const configData = {
        ...config,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Remove root key_mappings as they are duplicated in source_devices
        key_mappings: undefined,
        // Clean source_devices to remove available_keys (derived data)
        source_devices: config.source_devices.map((device) => ({
          device_id: device.device_id,
          device_name: device.device_name,
          mqtt_topic: device.mqtt_topic,
          key_mappings: device.key_mappings,
        })),
      };
      publishToRemapping({
        command: "add",
        data: configData,
      });
    },
    [publishToRemapping]
  );

  const updateConfig = useCallback(
    (config: RemappingConfig) => {
      setLoading(true);
      const configData = {
        ...config,
        updated_at: new Date().toISOString(),
        // Remove root key_mappings as they are duplicated in source_devices
        key_mappings: undefined,
        // Clean source_devices to remove available_keys (derived data)
        source_devices: config.source_devices.map((device) => ({
          device_id: device.device_id,
          device_name: device.device_name,
          mqtt_topic: device.mqtt_topic,
          key_mappings: device.key_mappings,
        })),
      };
      publishToRemapping({
        command: "set",
        data: configData,
      });
    },
    [publishToRemapping]
  );

  const deleteConfig = useCallback(
    (configId: string) => {
      setLoading(true);
      publishToRemapping({
        command: "delete",
        data: { id: configId },
      });
    },
    [publishToRemapping]
  );

  const getConfigs = useCallback(() => {
    setLoading(true);
    publishToRemapping({
      command: "get",
    });
  }, [publishToRemapping]);

  // Load device profiles on mount
  useEffect(() => {
    const loadDeviceProfiles = async () => {
      try {
        setLoadingDevices(true);

        // Load modbus devices.json
        const modbusResponse = await fetch("/files/modbus/devices.json");
        const modbusData = await modbusResponse.json();
        setDeviceProfiles((prev) => ({ ...prev, modbus: modbusData }));

        // Load modular devices.json
        const modularResponse = await fetch("/files/modular/devices.json");
        const modularData = await modularResponse.json();
        setDeviceProfiles((prev) => ({ ...prev, modular: modularData }));
      } catch (error) {
        console.error("Error loading device profiles:", error);
        toast.error("Failed to load device profiles");
      } finally {
        setLoadingDevices(false);
      }
    };

    loadDeviceProfiles();
  }, []);

  // Get available devices for selection
  const availableDevices = useMemo(() => {
    const devices: Device[] = [];

    // Add modbus devices
    modbusDevices.forEach((device) => {
      devices.push({
        ...device,
        device_type: "modbus",
      });
    });

    // Add modular devices
    modularDevices.forEach((device) => {
      devices.push({
        ...device,
        device_type: "modular",
      });
    });

    return devices;
  }, [modbusDevices, modularDevices]);

  // Get fields for a specific device based on its type and profile
  const getDeviceFields = useCallback(
    (device: Device): DeviceField[] => {
      const { manufacturer, part_number, device_type } = device;

      try {
        if (device_type === "modbus") {
          const modbusProfiles = deviceProfiles.modbus || {};
          for (const category in modbusProfiles) {
            const profiles = modbusProfiles[category];
            if (Array.isArray(profiles)) {
              const profile = profiles.find(
                (p: any) =>
                  p.manufacturer === manufacturer &&
                  p.part_number === part_number
              );
              if (profile && profile.data && Array.isArray(profile.data)) {
                return profile.data;
              }
            }
          }
        } else if (device_type === "modular") {
          const modularProfiles = deviceProfiles.modular?.Modular || [];
          if (Array.isArray(modularProfiles)) {
            const profile = modularProfiles.find(
              (p: any) =>
                p.manufacturer === manufacturer && p.part_number === part_number
            );
            if (profile && profile.data && Array.isArray(profile.data)) {
              return profile.data;
            }
          }
        }
      } catch (error) {
        console.error("Error getting device fields:", error);
      }

      return [];
    },
    [deviceProfiles]
  );

  // MQTT message handling
  const handleMQTTMessage = useCallback(
    (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        switch (topic) {
          case TOPICS.MODBUS_AVAILABLES:
            setModbusDevices(Array.isArray(payload) ? payload : []);
            break;

          case TOPICS.MODULAR_AVAILABLES:
            setModularDevices(Array.isArray(payload) ? payload : []);
            break;

          case "REMAP_RESPONSE":
            handleRemappingResponse(payload);
            break;

          default:
            // Check if it's a device data topic for real-time preview
            Object.values(modbusDevices)
              .concat(Object.values(modularDevices))
              .forEach((device: Device) => {
                if (topic === device.topic) {
                  setRealTimeData((prev) => ({
                    ...prev,
                    [device.name]: payload,
                  }));
                }
              });
            break;
        }
      } catch (error) {
        console.error("Error parsing MQTT message:", error);
      }
    },
    [modbusDevices, modularDevices, TOPICS]
  );

  // Handle remapping response
  const handleRemappingResponse = (payload: MQTTResponse) => {
    setLoading(false);

    if (payload.status === "success") {
      toast.success(payload.message || "Operation successful");

      // Try to parse configs from get operations
      let configs = null;

      if (payload.data && Array.isArray(payload.data)) {
        // For get operations, data contains configs array
        configs = payload.data;
      } else if (
        payload.data &&
        payload.data.remapping_configs &&
        Array.isArray(payload.data.remapping_configs)
      ) {
        // Nested structure (fallback)
        configs = payload.data.remapping_configs;
      }

      if (configs && Array.isArray(configs)) {
        setRemappingConfigs({ remapping_configs: configs });
      } else {
        // For CRUD operations that don't return configs, refresh the list
        // Add a small delay to ensure backend operation completes
        setTimeout(() => {
          getConfigs();
        }, 500);
      }
    } else {
      toast.error(payload.message || "An error occurred");
    }

    // Close modal after successful operation
    if (isModalOpen && payload.status === "success") {
      closeModal();
    }
  };

  // Function to request available devices
  const requestAvailableDevices = useCallback(() => {
    if (getMQTTClient()?.connected) {
      publishToAvailableDevices({
        command: "get_all_availables",
      });

      // Fallback individual requests
      setTimeout(() => {
        publishToAvailableDevices({
          command: "get_modbus_availables",
        });
        publishToAvailableDevices({
          command: "get_modular_availables",
        });
      }, 1000);
    }
  }, [publishToAvailableDevices]);

  // Background config publishing thread
  useEffect(() => {
    // Start config publishing interval every 3 seconds
    configPublishIntervalRef.current = setInterval(() => {
      publishConfigToRemapResponse();
    }, 3000); // 3 seconds

    return () => {
      if (configPublishIntervalRef.current) {
        clearInterval(configPublishIntervalRef.current);
        configPublishIntervalRef.current = null;
      }
    };
  }, [publishConfigToRemapResponse]);

  // MQTT Connection and Message Handling
  useEffect(() => {
    let currentClient: any = null;
    let deviceRefreshInterval: NodeJS.Timeout | null = null;

    if (typeof window !== "undefined") {
      try {
        currentClient = connectMQTT();

        currentClient.on("connect", () => {
          setMqttConnectionStatus("Connected");

          // Subscribe to required topics - initially without device topics since devices may not be loaded yet
          currentClient.subscribe([
            TOPICS.MODBUS_AVAILABLES,
            TOPICS.MODULAR_AVAILABLES,
            "REMAP_RESPONSE",
            // Device topics will be subscribed to when devices are loaded
          ]);

          // Request available devices immediately after connection
          setTimeout(() => {
            requestAvailableDevices();
          }, 500);

          // Set up periodic device refresh every 10 seconds
          deviceRefreshInterval = setInterval(() => {
            console.log("Refreshing available devices...");
            requestAvailableDevices();
          }, 10000); // 10 seconds

          // Load initial configurations
          setTimeout(() => {
            getConfigs();
          }, 1000);
        });

        currentClient.on("error", (err: Error) => {
          console.error("MQTT Error:", err.message);
          setMqttConnectionStatus("Error: " + err.message);
        });

        currentClient.on("close", () => {
          setMqttConnectionStatus("Disconnected");
          // Clear interval when disconnected
          if (deviceRefreshInterval) {
            clearInterval(deviceRefreshInterval);
            deviceRefreshInterval = null;
          }
        });

        currentClient.on("message", (topic: string, message: Buffer) => {
          handleMQTTMessage(topic, message);
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Error connecting MQTT:", errorMessage);
        setMqttConnectionStatus("Connection failed: " + errorMessage);
      }
    }

    return () => {
      // Clean up on unmount
      if (currentClient) {
        currentClient.removeAllListeners("connect");
        currentClient.removeAllListeners("error");
        currentClient.removeAllListeners("close");
        currentClient.removeAllListeners("message");
      }
      if (deviceRefreshInterval) {
        clearInterval(deviceRefreshInterval);
      }
    };
  }, [
    handleMQTTMessage,
    TOPICS,
    modbusDevices,
    modularDevices,
    getConfigs,
    requestAvailableDevices,
  ]);

  // Modal Functions
  const openModal = (config?: RemappingConfig) => {
    if (config) {
      setIsEditing(true);
      setSelectedConfigId(config.id);
      setCurrentConfig({ ...config });
    } else {
      setIsEditing(false);
      setSelectedConfigId(null);
      setCurrentConfig({
        id: "",
        name: "",
        description: "",
        enabled: true,
        created_at: "",
        updated_at: "",
        source_devices: [],
        key_mappings: [],
        mqtt_publish_config: {
          broker_url: "mqtt://localhost:1883",
          client_id: "remapper_client_" + uuidv4().slice(0, 8),
          topic: "",
          qos: 1,
          retain: false,
          lwt: true,
          publish_interval_seccond: 10,
        },
      });
    }
    setIsModalOpen(true);
  };

  const openDetailDialog = (config: RemappingConfig) => {
    setSelectedConfig(config);
    setIsDetailDialogOpen(true);
  };

  const openPreviewDialog = (device: Device) => {
    setPreviewTopic(device.topic);
    setPreviewData(realTimeData[device.name] || {});
    setIsPreviewDialogOpen(true);
  };

  const closeDetailDialog = () => {
    setSelectedConfig(null);
    setIsDetailDialogOpen(false);
  };

  const closePreviewDialog = () => {
    setIsPreviewDialogOpen(false);
    setPreviewTopic("");
    setPreviewData({});
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setSelectedConfigId(null);
    setCurrentConfig({
      id: "",
      name: "",
      description: "",
      enabled: true,
      created_at: "",
      updated_at: "",
      source_devices: [],
      key_mappings: [],
      mqtt_publish_config: {
        broker_url: "mqtt://localhost:1883",
        client_id: "remapper_client_" + uuidv4().slice(0, 8),
        topic: "",
        qos: 1,
        retain: false,
        lwt: true,
        publish_interval_seccond: 10,
      },
    });
  };

  // Save Functions
  const saveConfig = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentConfig.name.trim()) {
      setAlertDialogContent({
        title: "Validation Error",
        description: "Please enter a configuration name.",
      });
      setAlertDialogOpen(true);
      return;
    }

    if (currentConfig.source_devices.length === 0) {
      setAlertDialogContent({
        title: "Validation Error",
        description: "Please add at least one source device.",
      });
      setAlertDialogOpen(true);
      return;
    }

    if (!currentConfig.mqtt_publish_config.topic.trim()) {
      setAlertDialogContent({
        title: "Validation Error",
        description: "Please enter a publish topic.",
      });
      setAlertDialogOpen(true);
      return;
    }

    if (isEditing && currentConfig.id) {
      updateConfig(currentConfig);
    } else {
      createConfig(currentConfig);
    }
  };

  const confirmDelete = (config: RemappingConfig) => {
    setConfirmationDialogContent({
      title: "Delete Remapping Configuration",
      description: `Are you sure you want to delete "${config.name}"? This action cannot be undone.`,
      confirmAction: () => deleteConfig(config.id),
    });
    setConfirmationDialogOpen(true);
  };

  // Helper functions for device management
  const addSourceDevice = () => {
    const newDevice: SourceDevice = {
      device_id: "",
      device_name: "",
      mqtt_topic: "",
      available_keys: [],
      key_mappings: [
        {
          original_key: "",
          custom_key: "",
        },
      ],
    };
    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: [...prev.source_devices, newDevice],
    }));
  };

  const removeSourceDevice = (index: number) => {
    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.filter((_, i) => i !== index),
    }));
  };

  const updateSourceDevice = (index: number, device: SourceDevice) => {
    const selectedDevice = availableDevices.find(
      (d) => d.name === device.device_name
    );
    const availableKeys = selectedDevice ? getDeviceFields(selectedDevice) : [];

    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.map((d, i) =>
        i === index
          ? {
              ...device,
              available_keys: availableKeys,
              mqtt_topic: selectedDevice?.topic || "",
            }
          : d
      ),
    }));
  };

  const addDeviceKeyMapping = (deviceIndex: number) => {
    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.map((device, i) =>
        i === deviceIndex
          ? {
              ...device,
              key_mappings: [
                ...device.key_mappings,
                { original_key: "", custom_key: "" },
              ],
            }
          : device
      ),
    }));
  };

  const removeDeviceKeyMapping = (
    deviceIndex: number,
    mappingIndex: number
  ) => {
    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.map((device, i) =>
        i === deviceIndex
          ? {
              ...device,
              key_mappings: device.key_mappings.filter(
                (_, mi) => mi !== mappingIndex
              ),
            }
          : device
      ),
    }));
  };

  const updateDeviceKeyMapping = (
    deviceIndex: number,
    mappingIndex: number,
    mapping: KeyMapping
  ) => {
    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.map((device, i) =>
        i === deviceIndex
          ? {
              ...device,
              key_mappings: device.key_mappings.map((m, mi) =>
                mi === mappingIndex ? mapping : m
              ),
            }
          : device
      ),
    }));
  };

  // Helper function to get available keys from all source devices
  const getAllAvailableKeys = useCallback(() => {
    const keys = new Set<string>();
    currentConfig.source_devices.forEach((device) => {
      device.available_keys.forEach((field) => {
        keys.add(field.var_name);
      });
    });
    return Array.from(keys);
  }, [currentConfig.source_devices]);

  // Helper function to get total key mappings
  const getTotalKeyMappings = () => {
    return remappingConfigs.remapping_configs.reduce(
      (sum, config) =>
        sum +
          config.source_devices?.reduce(
            (deviceSum, device) =>
              deviceSum + (device.key_mappings?.length || 0),
            0
          ) || 0,
      0
    );
  };

  // Calculate summary data
  const totalConfigs = remappingConfigs.remapping_configs.length;
  const totalSourceDevices = remappingConfigs.remapping_configs.reduce(
    (sum, config) => sum + (config.source_devices?.length || 0),
    0
  );
  const totalKeyMappings = getTotalKeyMappings();

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Code className="h-5 w-5" />
          <h1 className="text-lg font-semibold">MQTT Payload Remapping</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={getConfigs}
          >
            <RotateCw className="h-4 w-4" />
          </Button>

          <Button size="sm" onClick={() => openModal()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Remapping Config
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Configurations
              </CardTitle>
              <Settings2 className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalConfigs}</div>
              <p className="text-xs text-muted-foreground">
                Active remapping configurations
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Source Devices
              </CardTitle>
              <Activity className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSourceDevices}</div>
              <p className="text-xs text-muted-foreground">
                Devices being monitored
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Key Mappings
              </CardTitle>
              <Code className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalKeyMappings}</div>
              <p className="text-xs text-muted-foreground">
                Field transformations
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Real-time Status
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(realTimeData).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Active data streams
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Available Devices Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Available Devices ({availableDevices.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Devices discovered from MQTT topics that can be used for remapping
            </p>
          </CardHeader>
          <CardContent>
            {availableDevices.length === 0 ? (
              <div className="text-center py-8">
                <Eye className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No devices available
                </h3>
                <p className="text-muted-foreground">
                  Waiting for devices to be discovered from MQTT topics...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {availableDevices.map((device, index) => (
                  <Card key={device.id || index} className="h-fit">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        {device.name}
                        <Badge
                          variant={
                            device.device_type === "modbus"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {device.device_type}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {device.manufacturer} - {device.part_number}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Topic
                        </Label>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {device.topic}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Available Keys ({getDeviceFields(device).length})
                        </Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {getDeviceFields(device)
                            .slice(0, 3)
                            .map((field, fieldIndex) => (
                              <Badge
                                key={fieldIndex}
                                variant="outline"
                                className="text-xs"
                              >
                                {field.var_name}
                              </Badge>
                            ))}
                          {getDeviceFields(device).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{getDeviceFields(device).length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configurations Table */}
        <div className="rounded-lg border bg-background shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">
              Remapping Configurations (
              {remappingConfigs.remapping_configs.length})
            </h3>
          </div>
          <div className="p-4">
            {remappingConfigs.remapping_configs.length === 0 ? (
              <div className="text-center py-8">
                <Code className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No remapping configurations found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first remapping configuration to get started
                </p>
                <Button onClick={() => openModal()}>Add Configuration</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead className="min-w-48">Configuration</TableHead>
                      <TableHead className="min-w-64">
                        Source Devices & Keys
                      </TableHead>
                      <TableHead className="min-w-64">
                        Publish Settings
                      </TableHead>
                      <TableHead className="text-center w-32">
                        Controls
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remappingConfigs.remapping_configs.map((config, index) => (
                      <TableRow
                        key={config.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="text-center font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-base flex items-center gap-2">
                              {config.name}
                              <Switch checked={config.enabled} disabled />
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {config.description}
                            </div>
                            {config.created_at && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(config.created_at).toLocaleDateString(
                                  "id-ID",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="space-y-2 max-w-sm">
                            <div className="text-sm font-medium text-muted-foreground">
                              Devices ({config.source_devices?.length || 0})
                            </div>
                            {config.source_devices?.map((device, deviceIdx) => (
                              <div
                                key={deviceIdx}
                                className="border rounded-md p-2 bg-muted/20"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {device.device_name}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Topic: {device.mqtt_topic}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    Keys:
                                  </span>
                                  {device.available_keys
                                    ?.slice(0, 2)
                                    .map((key, keyIdx) => (
                                      <Badge
                                        key={keyIdx}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {key.var_name}
                                      </Badge>
                                    ))}
                                  {device.available_keys &&
                                    device.available_keys?.length > 2 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        +{device.available_keys.length - 2}
                                      </Badge>
                                    )}
                                </div>
                              </div>
                            ))}
                            <div className="text-sm font-medium text-muted-foreground">
                              Device Mappings (
                              {config.source_devices?.reduce(
                                (sum, device) =>
                                  sum + (device.key_mappings?.length || 0),
                                0
                              ) || 0}
                              )
                            </div>
                            {config.source_devices
                              ?.map((device, devIdx) =>
                                device.key_mappings
                                  ?.slice(0, 2)
                                  .map((mapping, mapIdx) => (
                                    <div
                                      key={`${devIdx}-${mapIdx}`}
                                      className="text-xs bg-background/60 rounded px-2 py-1"
                                    >
                                      <span className="text-muted-foreground">
                                        [{device.device_name}]
                                      </span>{" "}
                                      <span className="font-mono">
                                        {mapping.original_key}
                                      </span>{" "}
                                      →{" "}
                                      <span className="font-mono text-green-600">
                                        {mapping.custom_key}
                                      </span>
                                    </div>
                                  ))
                              )
                              .flat()
                              ?.slice(0, 3)}
                            {(() => {
                              const totalMappings =
                                config.source_devices?.reduce(
                                  (sum, device) =>
                                    sum + (device.key_mappings?.length || 0),
                                  0
                                ) || 0;
                              return totalMappings > 3 ? (
                                <div className="text-xs text-muted-foreground text-center py-1">
                                  +{totalMappings - 3} more mappings
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="space-y-2 max-w-sm">
                            <div className="text-sm font-medium">
                              {config.mqtt_publish_config.topic}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                QoS {config.mqtt_publish_config.qos}
                              </Badge>
                              {config.mqtt_publish_config.retain && (
                                <Badge variant="outline" className="text-xs">
                                  Retain
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Interval:{" "}
                              {
                                config.mqtt_publish_config
                                  .publish_interval_seccond
                              }
                              s
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDetailDialog(config)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openModal(config)}
                              title="Edit Configuration"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => confirmDelete(config)}
                              title="Delete Configuration"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Configuration Modal */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              <DialogTitle>
                {isEditing
                  ? "Edit Remapping Configuration"
                  : "Create Remapping Configuration"}
              </DialogTitle>
            </div>
            <DialogDescription>
              Configure MQTT payload remapping with custom key transformations
              and publish settings
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveConfig} className="space-y-6">
            {/* Basic Configuration */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Basic Configuration
                </div>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="configName">Configuration Name *</Label>
                  <Input
                    id="configName"
                    value={currentConfig.name}
                    onChange={(e) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Enter configuration name"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={currentConfig.enabled}
                    onCheckedChange={(checked) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        enabled: checked,
                      }))
                    }
                  />
                  <Label htmlFor="enabled">Enabled</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="configDescription">Description</Label>
                <Textarea
                  id="configDescription"
                  value={currentConfig.description}
                  onChange={(e) =>
                    setCurrentConfig((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Enter configuration description"
                  rows={2}
                />
              </div>
            </div>

            {/* Source Devices */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Source Devices
                </div>
              </h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Select devices to monitor and extract data from
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSourceDevice}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Device
                  </Button>
                </div>

                {currentConfig.source_devices.map((device, deviceIndex) => (
                  <Card key={deviceIndex} className="p-4 border-2">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {deviceIndex + 1}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-base font-semibold">
                            {device.device_name || "Source Device"}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Configure device data source and key mappings
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSourceDevice(deviceIndex)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-6">
                      {/* Device Selection */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">
                            Device Selection *
                          </Label>
                          <Select
                            value={device.device_name}
                            onValueChange={(value) => {
                              const selectedDevice = availableDevices.find(
                                (d) => d.name === value
                              );
                              updateSourceDevice(deviceIndex, {
                                ...device,
                                device_name: value,
                                device_id: selectedDevice?.id || "",
                                mqtt_topic: selectedDevice?.topic || "",
                                available_keys: selectedDevice
                                  ? getDeviceFields(selectedDevice)
                                  : [],
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDevices.map((dev) => (
                                <SelectItem key={dev.id} value={dev.name}>
                                  {dev.name} ({dev.manufacturer} -{" "}
                                  {dev.part_number})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">
                            MQTT Topic
                          </Label>
                          <Input
                            value={device.mqtt_topic}
                            readOnly
                            className="bg-muted text-sm font-mono"
                            placeholder="Topic will be set automatically"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label className="text-sm font-medium text-muted-foreground">
                            Available Keys ({device.available_keys?.length || 0}
                            )
                          </Label>
                          <div className="flex flex-wrap gap-2 mt-2 max-h-24 overflow-y-auto p-2 border rounded-md bg-muted/20">
                            {device.available_keys?.length ? (
                              device.available_keys.map((field, fieldIndex) => (
                                <Badge
                                  key={fieldIndex}
                                  variant="outline"
                                  className="text-sm"
                                >
                                  <Code className="h-3 w-3 mr-1" />
                                  {field.var_name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Select a device to see available keys
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Key Mappings for this device */}
                      <div className="space-y-4">
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <Code className="h-4 w-4" />
                                Key Mappings ({device.key_mappings?.length || 0}
                                )
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Transform this device's data keys to custom keys
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addDeviceKeyMapping(deviceIndex)}
                              disabled={!device.device_name}
                            >
                              <PlusCircle className="h-4 w-4 mr-2" />
                              Add Mapping
                            </Button>
                          </div>

                          {device.key_mappings?.length ? (
                            <div className="space-y-3">
                              {device.key_mappings.map(
                                (mapping, mappingIndex) => (
                                  <Card
                                    key={mappingIndex}
                                    className="p-3 border-l-4 border-l-primary"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                          {mappingIndex + 1}
                                        </div>
                                        <Label className="text-sm font-medium">
                                          Key Mapping
                                        </Label>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          removeDeviceKeyMapping(
                                            deviceIndex,
                                            mappingIndex
                                          )
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-xs font-medium">
                                          Original Key *
                                        </Label>
                                        <Select
                                          value={mapping.original_key}
                                          onValueChange={(value) =>
                                            updateDeviceKeyMapping(
                                              deviceIndex,
                                              mappingIndex,
                                              {
                                                ...mapping,
                                                original_key: value,
                                              }
                                            )
                                          }
                                        >
                                          <SelectTrigger className="text-sm">
                                            <SelectValue placeholder="Select original key" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {device.available_keys?.map(
                                              (key) => (
                                                <SelectItem
                                                  key={key.var_name}
                                                  value={key.var_name}
                                                >
                                                  {key.var_name}
                                                </SelectItem>
                                              )
                                            ) || []}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div>
                                        <Label className="text-xs font-medium">
                                          Custom Key *
                                        </Label>
                                        <Input
                                          value={mapping.custom_key}
                                          onChange={(e) =>
                                            updateDeviceKeyMapping(
                                              deviceIndex,
                                              mappingIndex,
                                              {
                                                ...mapping,
                                                custom_key: e.target.value,
                                              }
                                            )
                                          }
                                          placeholder="Enter custom key name"
                                          className="text-sm font-mono"
                                          required
                                        />
                                      </div>
                                    </div>

                                    {mapping.original_key &&
                                      mapping.custom_key && (
                                        <div className="mt-3 p-3 bg-muted/30 rounded-md text-sm">
                                          <div className="flex items-center justify-center gap-4">
                                            <div className="text-center">
                                              <Label className="text-xs text-muted-foreground">
                                                From
                                              </Label>
                                              <p className="font-mono font-medium text-primary">
                                                {mapping.original_key}
                                              </p>
                                            </div>
                                            <div className="text-2xl text-muted-foreground">
                                              →
                                            </div>
                                            <div className="text-center">
                                              <Label className="text-xs text-muted-foreground">
                                                To
                                              </Label>
                                              <p className="font-mono font-medium text-green-600">
                                                {mapping.custom_key}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                  </Card>
                                )
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-6 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                              <Code className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                              <h4 className="text-sm font-medium mb-1">
                                No key mappings
                              </h4>
                              <p className="text-xs text-muted-foreground mb-3">
                                Add mappings to transform this device's data
                                keys
                              </p>
                              {device.device_name && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    addDeviceKeyMapping(deviceIndex)
                                  }
                                >
                                  <PlusCircle className="h-4 w-4 mr-2" />
                                  Add First Mapping
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* MQTT Publish Configuration */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  MQTT Publish Configuration
                </div>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brokerUrl">Broker URL</Label>
                  <Input
                    id="brokerUrl"
                    value={currentConfig.mqtt_publish_config.broker_url}
                    onChange={(e) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        mqtt_publish_config: {
                          ...prev.mqtt_publish_config,
                          broker_url: e.target.value,
                        },
                      }))
                    }
                    placeholder="mqtt://localhost:1883"
                  />
                </div>

                <div>
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    value={currentConfig.mqtt_publish_config.client_id}
                    onChange={(e) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        mqtt_publish_config: {
                          ...prev.mqtt_publish_config,
                          client_id: e.target.value,
                        },
                      }))
                    }
                    placeholder="remapper_client_001"
                  />
                </div>

                <div>
                  <Label htmlFor="publishTopic">Publish Topic *</Label>
                  <Input
                    id="publishTopic"
                    value={currentConfig.mqtt_publish_config.topic}
                    onChange={(e) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        mqtt_publish_config: {
                          ...prev.mqtt_publish_config,
                          topic: e.target.value,
                        },
                      }))
                    }
                    placeholder="e.g., REMAP/sensor_data"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="qos">QoS Level</Label>
                  <Select
                    value={currentConfig.mqtt_publish_config.qos.toString()}
                    onValueChange={(value) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        mqtt_publish_config: {
                          ...prev.mqtt_publish_config,
                          qos: parseInt(value),
                        },
                      }))
                    }
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

                <div>
                  <Label htmlFor="publishInterval">
                    Publish Interval (seconds)
                  </Label>
                  <Input
                    id="publishInterval"
                    type="number"
                    min="1"
                    value={
                      currentConfig.mqtt_publish_config.publish_interval_seccond
                    }
                    onChange={(e) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        mqtt_publish_config: {
                          ...prev.mqtt_publish_config,
                          publish_interval_seccond:
                            parseInt(e.target.value) || 10,
                        },
                      }))
                    }
                    placeholder="10"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="retain"
                    checked={currentConfig.mqtt_publish_config.retain}
                    onCheckedChange={(checked) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        mqtt_publish_config: {
                          ...prev.mqtt_publish_config,
                          retain: checked,
                        },
                      }))
                    }
                  />
                  <div>
                    <Label htmlFor="retain">Retain Message</Label>
                    <p className="text-xs text-muted-foreground">
                      Keep message on broker
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="lwt"
                    checked={currentConfig.mqtt_publish_config.lwt}
                    onCheckedChange={(checked) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        mqtt_publish_config: {
                          ...prev.mqtt_publish_config,
                          lwt: checked,
                        },
                      }))
                    }
                  />
                  <div>
                    <Label htmlFor="lwt">Last Will and Testament</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable LWT for connection monitoring
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={loadingDevices}>
                {isEditing ? "Update Configuration" : "Create Configuration"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={closeDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              <DialogTitle>Configuration Details</DialogTitle>
            </div>
            <DialogDescription>
              Detailed view of remapping configuration
            </DialogDescription>
          </DialogHeader>

          {selectedConfig && (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings2 className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Configuration Name
                      </Label>
                      <p className="text-base font-medium">
                        {selectedConfig.name}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Status
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch checked={selectedConfig.enabled} disabled />
                        <span className="text-sm">
                          {selectedConfig.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Description
                      </Label>
                      <p className="text-base">{selectedConfig.description}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Configuration ID
                      </Label>
                      <p className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {selectedConfig.id}
                      </p>
                    </div>
                    {selectedConfig.created_at && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Created At
                        </Label>
                        <p className="text-base flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(
                            selectedConfig.created_at
                          ).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Source Devices */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5" />
                    Source Devices ({selectedConfig.source_devices?.length || 0}
                    )
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedConfig.source_devices?.map((device, deviceIdx) => (
                      <div
                        key={deviceIdx}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{device.device_name}</h4>
                          <Badge variant="secondary">
                            {device.device_name}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              MQTT Topic
                            </Label>
                            <p className="text-xs font-mono bg-background px-2 py-1 rounded">
                              {device.mqtt_topic}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              Available Keys
                            </Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {device.available_keys?.map((key, keyIdx) => (
                                <Badge
                                  key={keyIdx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {key.var_name}
                                </Badge>
                              )) || (
                                <span className="text-xs text-muted-foreground">
                                  No keys available
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Key Mappings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Code className="h-5 w-5" />
                    Key Mappings ({selectedConfig.key_mappings?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedConfig.key_mappings?.map((mapping, mapIdx) => (
                      <div
                        key={mapIdx}
                        className="bg-muted/50 rounded-md p-3 border"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {mapIdx + 1}
                          </div>
                          <Label className="text-sm font-medium">Mapping</Label>
                        </div>
                        <div className="bg-background/60 rounded p-3 text-sm">
                          <div className="flex items-center justify-center gap-4">
                            <div className="text-center">
                              <Label className="text-xs text-muted-foreground">
                                Original Key
                              </Label>
                              <p className="font-mono font-medium text-primary">
                                {mapping.original_key}
                              </p>
                            </div>
                            <div className="text-muted-foreground">→</div>
                            <div className="text-center">
                              <Label className="text-xs text-muted-foreground">
                                Custom Key
                              </Label>
                              <p className="font-mono font-medium text-green-600">
                                {mapping.custom_key}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* MQTT Publish Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5" />
                    MQTT Publish Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Publish Topic
                      </Label>
                      <p className="text-base font-mono bg-muted px-3 py-2 rounded">
                        {selectedConfig.mqtt_publish_config.topic}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        QoS Level
                      </Label>
                      <Badge variant="default" className="text-sm">
                        QoS {selectedConfig.mqtt_publish_config.qos}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Publish Interval
                      </Label>
                      <p className="text-base">
                        {
                          selectedConfig.mqtt_publish_config
                            .publish_interval_seccond
                        }{" "}
                        seconds
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Retain Message
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={selectedConfig.mqtt_publish_config.retain}
                          disabled
                        />
                        <span className="text-sm">
                          {selectedConfig.mqtt_publish_config.retain
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDetailDialog}>
              Close
            </Button>
            {selectedConfig && (
              <Button
                onClick={() => {
                  closeDetailDialog();
                  openModal(selectedConfig);
                }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Configuration
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={closePreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              <DialogTitle>Real-time Data Preview</DialogTitle>
            </div>
            <DialogDescription>
              Live data preview from MQTT topic:{" "}
              <code className="font-mono">{previewTopic}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {Object.keys(previewData).length === 0 ? (
              <div className="text-center py-8">
                <Activity className="mx-auto h-16 w-16 text-muted-foreground mb-4 animate-pulse" />
                <h3 className="text-lg font-semibold mb-2">
                  Waiting for data...
                </h3>
                <p className="text-muted-foreground">
                  No data received yet. Make sure the device is publishing to
                  this topic.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Latest Data ({Object.keys(previewData).length} fields)
                  </Label>
                  <div className="mt-2 space-y-2">
                    {Object.entries(previewData).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between bg-background p-3 rounded border"
                      >
                        <span className="font-mono text-sm font-medium">
                          {key}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    • This preview shows real-time data as it arrives from the
                    MQTT topic
                  </p>
                  <p>
                    • Data is automatically parsed and displayed in key-value
                    format
                  </p>
                  <p>
                    • Use this to understand what data is available for
                    remapping
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={closePreviewDialog}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertDialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmationDialogOpen}
        onOpenChange={setConfirmationDialogOpen}
        title={confirmationDialogContent.title}
        description={confirmationDialogContent.description}
        onConfirm={confirmationDialogContent.confirmAction}
      />
    </SidebarInset>
  );
};

export default RemappingControl;
