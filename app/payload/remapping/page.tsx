"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { connectMQTT, getMQTTClient, disconnectMQTT } from "@/lib/mqttClient";

// Drag and Drop imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import {
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";

// Add DraggableItem component for sortable functionality
function DraggableItem({
  id,
  children,
  ...props
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      {...props}
    >
      {children}
    </div>
  );
}

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Info,
  Copy,
  Globe,
  Shuffle,
  ArrowLeftRight,
  Layers,
  Database,
  Server,
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
  group?: string;
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
  remapping_configs?: any[];
}

interface RealTimeData {
  [key: string]: any;
}

// Sortable Item Components for Drag and Drop
function DeviceEditor({
  device,
  index,
  onUpdate,
  onRemove,
  availableDevices,
}: {
  device: SourceDevice;
  index: number;
  onUpdate: (device: SourceDevice) => void;
  onRemove: () => void;
  availableDevices: Device[];
}) {
  const availableDeviceFields = device.available_keys || [];

  // State for showing/hiding available fields
  const [showAvailableFields, setShowAvailableFields] = useState(false);

  return (
    <Card className="p-4 border-2 border-dashed hover:border-primary/50 transition-colors">
      {/* DRAG HANDLE - Klik atau drag area ini untuk drag and drop */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1 flex-1">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" />
            Device {index + 1}
          </Label>
          <p className="text-sm text-muted-foreground">
            Configure data source and transformation mappings
          </p>
        </div>

        {/* Visual drag and drop indicator */}
        <div className="flex items-center gap-2 ml-4">
          <div className="flex flex-col items-center gap-0.5 px-2 py-1 bg-muted/30 rounded text-xs text-muted-foreground">
            <div className="flex items-center justify-center w-4 h-4 bg-primary/10 rounded cursor-move">
              <ArrowLeftRight className="h-3 w-3" />
            </div>
            <span className="text-xs font-medium">DRAG</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>



      <div className="space-y-4">
        {/* Device Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Source Device *</Label>
            <Select
              value={device.device_name}
              onValueChange={(value) => {
                const selectedDevice = availableDevices.find(d => d.name === value);
                if (selectedDevice) {
                  onUpdate({
                    ...device,
                    device_id: selectedDevice.id,
                    device_name: selectedDevice.name,
                    mqtt_topic: selectedDevice.topic,
                    available_keys: getDeviceFields(selectedDevice),
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                {availableDevices.map((dev) => (
                  <SelectItem key={dev.id} value={dev.name}>
                    <div className="flex items-center gap-2">
                      <Badge variant={dev.device_type === "modbus" ? "default" : "secondary"} className="text-xs">
                        {dev.device_type}
                      </Badge>
                      {dev.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              Grouping Key
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </Label>
            <Input
              value={device.group || ""}
              onChange={(e) => onUpdate({ ...device, group: e.target.value || undefined })}
              placeholder="e.g., sensors, relays, status"
            />
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onUpdate({ ...device, group: "values" })}
                >
                  Auto: values
                </Button>
              </div>
              
            </div>
          </div>
        </div>

        {/* MQTT Topic Display */}
        {device.mqtt_topic && (
          <div>
            <Label className="text-xs text-muted-foreground">MQTT Topic</Label>
            <div className="bg-muted px-3 py-2 rounded font-mono text-sm">
              {device.mqtt_topic}
            </div>
          </div>
        )}

        {/* Available Keys Preview */}
        {availableDeviceFields.length > 0 && (
          <div>
            <Label
              className="text-sm font-medium flex items-center gap-2 cursor-pointer hover:text-primary/70 transition-colors"
              onClick={() => setShowAvailableFields(!showAvailableFields)}
            >
              <Eye className="h-3 w-3" />
              Available Data Fields ({availableDeviceFields.length})
            </Label>
            {showAvailableFields && (
              <div className="flex flex-wrap gap-1 mt-2 animate-in slide-in-from-top-1 duration-200">
                {availableDeviceFields.slice(0, 10).map((field, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs text-muted-foreground">
                    {field.var_name}
                  </Badge>
                ))}
                {availableDeviceFields.length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{availableDeviceFields.length - 10} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Key Mappings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ArrowLeftRight className="h-3 w-3" />
              Key Mappings ({device.key_mappings?.length || 0})
            </Label>
            <div className="flex items-center gap-2">
              {device.key_mappings && device.key_mappings.length > 1 && (
                <div className="text-xs text-muted-foreground">
                  <ArrowLeftRight className="inline h-3 w-3 mr-1" />
                  Drag to reorder
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onUpdate({
                  ...device,
                  key_mappings: [...(device.key_mappings || []), { original_key: "", custom_key: "" }]
                })}
              >
                <PlusCircle className="h-3 w-3 mr-1" />
                Add Mapping
              </Button>
            </div>
          </div>

          {(!device.key_mappings || device.key_mappings.length === 0) ? (
            <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded">
              <ArrowLeftRight className="mx-auto h-6 w-6 mb-2" />
              <p className="text-sm">No key mappings configured</p>
              <p className="text-xs">Add mappings to transform device data fields</p>
            </div>
          ) : (
            <SortableContext
              items={device.key_mappings.map((_, mappingIndex) => `${index}-mapping-${mappingIndex}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {device.key_mappings.map((mapping, mappingIndex) => (
                  <MappingDraggableItem
                    key={`${index}-mapping-${mappingIndex}`}
                    mapping={mapping}
                    mappingIndex={mappingIndex}
                    deviceIndex={index}
                    availableFields={availableDeviceFields}
                    onUpdate={(newMapping) => {
                      const newMappings = [...(device.key_mappings || [])];
                      newMappings[mappingIndex] = newMapping;
                      onUpdate({ ...device, key_mappings: newMappings });
                    }}
                    onRemove={() => {
                      const newMappings = [...(device.key_mappings || [])];
                      newMappings.splice(mappingIndex, 1);
                      onUpdate({ ...device, key_mappings: newMappings });
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      </div>
    </Card>
  );
}

// Draggable Device Editor Component
function DraggableDeviceEditor({
  id,
  device,
  index,
  onUpdate,
  onRemove,
  availableDevices,
}: {
  id: string;
  device: SourceDevice;
  index: number;
  onUpdate: (device: SourceDevice) => void;
  onRemove: () => void;
  availableDevices: Device[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DeviceEditor
        device={device}
        index={index}
        onUpdate={onUpdate}
        onRemove={onRemove}
        availableDevices={availableDevices}
      />
    </div>
  );
}

// Mapping Draggable Item Component
function MappingDraggableItem({
  mapping,
  mappingIndex,
  deviceIndex,
  availableFields,
  onUpdate,
  onRemove,
}: {
  mapping: KeyMapping;
  mappingIndex: number;
  deviceIndex: number;
  availableFields: DeviceField[];
  onUpdate: (mapping: KeyMapping) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${deviceIndex}-mapping-${mappingIndex}` });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card className="p-3 border-l-4 border-l-primary">
        <div className="flex items-center gap-2 mb-2">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-muted hover:bg-muted/80 cursor-grab active:cursor-grabbing transition-colors"
          >
            <ArrowLeftRight className="h-3 w-3" />
          </div>

          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
            {mappingIndex + 1}
          </div>
          <Label className="text-sm font-medium">Mapping Rule</Label>
          {mapping.original_key && mapping.custom_key && (
            <div className="text-xs text-green-600 bg-green-50 rounded px-2 py-1 border border-green-200">
              <ArrowLeftRight className="inline h-3 w-3 mr-1" />
              {mapping.original_key} → {mapping.custom_key}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="ml-auto text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Original Key</Label>
            <Select
              value={mapping.original_key}
              onValueChange={(value) => onUpdate({ ...mapping, original_key: value })}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select source key" />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((field) => (
                  <SelectItem key={field.var_name} value={field.var_name}>
                    {field.var_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Custom Key *</Label>
            <Input
              value={mapping.custom_key}
              onChange={(e) => onUpdate({ ...mapping, custom_key: e.target.value })}
              placeholder="e.g., WaterTemperature"
              className="h-8"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// Global helper function
const getDeviceFields = (device: Device): DeviceField[] => {
  // This will be defined below in the component scope
  return [];
};

const RemappingControl = () => {
  // Drag and Drop Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    const activeType = active.id.toString();
    const overType = over.id.toString();

    // Handle device reordering
    if (activeType.startsWith('device-') && overType.startsWith('device-')) {
      const oldIndex = parseInt(activeType.split('-')[1]);
      const newIndex = parseInt(overType.split('-')[1]);

      setCurrentConfig((prev) => {
        const reorderedDevices = arrayMove(prev.source_devices, oldIndex, newIndex);

        // Repopulate available_keys after reordering to ensure they remain intact
        const devicesWithKeys = reorderedDevices.map((device, index) => {
          if (device.available_keys && device.available_keys.length > 0) {
            // If device already has keys, keep them
            return device;
          }
          // If not, try to repopulate them
          const selectedDevice = availableDevices.find((d) => d.name === device.device_name);
          const availableKeys = selectedDevice ? getDeviceFields(selectedDevice) : [];
          return {
            ...device,
            available_keys: availableKeys,
            mqtt_topic: selectedDevice?.topic || device.mqtt_topic || "",
          };
        });

        return {
          ...prev,
          source_devices: devicesWithKeys,
        };
      });
    }

    // Handle key mapping reordering within the same device (format: "deviceIndex-mappingIndex")
    if (activeType.includes('-mapping') && overType.includes('-mapping')) {
      const activeParts = activeType.split('-');
      const overParts = overType.split('-');

      if (activeParts[0] === overParts[0]) { // Same device
        const deviceIndex = parseInt(activeParts[0]);
        const oldIndex = parseInt(activeParts[2]);
        const newIndex = parseInt(overParts[2]);

        setCurrentConfig((prev) => ({
          ...prev,
          source_devices: prev.source_devices.map((device, dIdx) =>
            dIdx === deviceIndex ? {
              ...device,
              key_mappings: arrayMove(device.key_mappings || [], oldIndex, newIndex)
            } : device
          ),
        }));
      }
    }

    setActiveId(null);
  };

  // MQTT Topics
  const TOPICS = useMemo(
    () => ({
      MODBUS_AVAILABLES: "MODBUS_DEVICE/AVAILABLES",
      MODULAR_AVAILABLES: "MODULAR_DEVICE/AVAILABLES",
    }),
    []
  );

  // Connection Status
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState("Disconnected");

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
  const [realTimeData, setRealTimeData] = useState<Record<string, RealTimeData>>({});

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<RemappingConfig | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewTopic, setPreviewTopic] = useState<string>("");
  const [previewData, setPreviewData] = useState<RealTimeData>({});
  const [isGroupInfoDialogOpen, setIsGroupInfoDialogOpen] = useState(false);
  const [isDataPreviewDialogOpen, setIsDataPreviewDialogOpen] = useState(false);
  const [previewConfigData, setPreviewConfigData] = useState<RealTimeData>({});

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

  // Form State
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

  // Publish config data to REMAP_RESPONSE
  const publishConfigToRemapResponse = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) return;

    if (remappingConfigs.remapping_configs.length === 0) return;

    const configData = {
      remapping_configs: remappingConfigs.remapping_configs,
      timestamp: new Date().toISOString(),
      source: "remapping_page_periodic_update",
    };

    client.publish("REMAP_RESPONSE", JSON.stringify(configData));
  }, [remappingConfigs]);

  // Events
  const publishToAvailableDevices = useCallback((payload: any) => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("Cannot request devices, MQTT client is not connected.");
      return;
    }
    client.publish("command_available_devices", JSON.stringify(payload));
  }, []);

  // CRUD Operations
  const createConfig = useCallback((config: RemappingConfig) => {
    setLoading(true);
    const configData = {
      ...config,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      key_mappings: undefined,
      source_devices: config.source_devices.map((device) => ({
        device_id: device.device_id,
        device_name: device.device_name,
        mqtt_topic: device.mqtt_topic,
        key_mappings: device.key_mappings,
        group: device.group,
      })),
    };
    publishToRemapping({
      command: "add",
      data: configData,
    });
  }, [publishToRemapping]);

  const updateConfig = useCallback((config: RemappingConfig) => {
    setLoading(true);
    const configData = {
      ...config,
      updated_at: new Date().toISOString(),
      key_mappings: undefined,
      source_devices: config.source_devices.map((device) => ({
        device_id: device.device_id,
        device_name: device.device_name,
        mqtt_topic: device.mqtt_topic,
        key_mappings: device.key_mappings,
        group: device.group,
      })),
    };
    publishToRemapping({
      command: "set",
      data: configData,
    });
  }, [publishToRemapping]);

  const deleteConfig = useCallback((configId: string) => {
    setLoading(true);
    publishToRemapping({
      command: "delete",
      data: { id: configId },
    });
  }, [publishToRemapping]);

  const getConfigs = useCallback(() => {
    setLoading(true);
    publishToRemapping({ command: "get" });
  }, [publishToRemapping]);

  // Load device profiles
  useEffect(() => {
    const loadDeviceProfiles = async () => {
      try {
        setLoadingDevices(true);

        const modbusResponse = await fetch("/files/modbus/devices.json");
        const modbusData = await modbusResponse.json();
        setDeviceProfiles((prev) => ({ ...prev, modbus: modbusData }));

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

  // Available devices
  const availableDevices = useMemo(() => {
    const devices: Device[] = [];

    modbusDevices.forEach((device) => {
      devices.push({ ...device, device_type: "modbus" });
    });

    modularDevices.forEach((device) => {
      devices.push({ ...device, device_type: "modular" });
    });

    return devices;
  }, [modbusDevices, modularDevices]);

  // Get device fields
  const getDeviceFields = useCallback((device: Device): DeviceField[] => {
    const { manufacturer, part_number, device_type } = device;

    try {
      if (device_type === "modbus") {
        const modbusProfiles = deviceProfiles.modbus || {};
        for (const category in modbusProfiles) {
          const profiles = modbusProfiles[category];
          if (Array.isArray(profiles)) {
            const profile = profiles.find((p: any) =>
              p.manufacturer === manufacturer && p.part_number === part_number
            );
            if (profile && profile.data && Array.isArray(profile.data)) {
              return profile.data;
            }
          }
        }
      } else if (device_type === "modular") {
        const modularProfiles = deviceProfiles.modular?.Modular || [];
        if (Array.isArray(modularProfiles)) {
          const profile = modularProfiles.find((p: any) =>
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
  }, [deviceProfiles]);

  // MQTT message handler - FIXED: Remove stale dependency issue
  const handleMQTTMessage = useCallback((topic: string, message: Buffer) => {
    try {
      const payload = JSON.parse(message.toString());

      // Temporarily handle device topics by checking the state inside callback
      const checkRealTimeData = (topicToCheck: string) => {
        // We need to access the current state without dependency
        setModbusDevices(currentModbus => {
          setModularDevices(currentModular => {
            setRealTimeData(currentRealTime => {
              const allDevices = [...currentModbus, ...currentModular];
              const device = allDevices.find(d => d.topic === topicToCheck);
              if (device) {
                return { ...currentRealTime, [device.name]: payload };
              }
              return currentRealTime;
            });
            return currentModular; // Return unchanged
          });
          return currentModbus; // Return unchanged
        });
      };

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
          checkRealTimeData(topic);
          break;
      }
    } catch (error) {
      console.error("Error parsing MQTT message:", error, "Raw message:", message.toString());
    }
  }, [TOPICS]); // Only depend on TOPICS, not state arrays

  // Populate available keys
  const populateAvailableKeys = useCallback((configs: RemappingConfig[]): RemappingConfig[] => {
    return configs.map(config => ({
      ...config,
      source_devices: config.source_devices.map(device => {
        // Try to find the actual device from available devices list to get complete data
        const actualDevice = availableDevices.find(ad => ad.name === device.device_name);

        let availableKeys: DeviceField[] = [];
        if (actualDevice) {
          // Use actual device data if available
          availableKeys = getDeviceFields(actualDevice);
        } else {
          // Fallback: try to get device fields using stored info and guess device type
          const fallbackDevice = {
            id: device.device_id,
            name: device.device_name,
            part_number: "unknown",
            manufacturer: "unknown",
            topic: device.mqtt_topic,
            device_type: device.device_name.toLowerCase().includes("relay") ||
                        device.device_name.toLowerCase().includes("drycontact") ? "modular" : "modbus"
          };
          availableKeys = getDeviceFields(fallbackDevice);
        }

        return {
          ...device,
          available_keys: availableKeys,
          key_mappings: device.key_mappings || [],
          group: device.group
        };
      }),
      key_mappings: config.key_mappings || []
    }));
  }, [getDeviceFields, availableDevices]);

  // Update configs when device profiles are loaded
  useEffect(() => {
    if (Object.keys(deviceProfiles).length > 0 && remappingConfigs.remapping_configs.length > 0) {
      const updatedConfigs = populateAvailableKeys(remappingConfigs.remapping_configs);
      setRemappingConfigs({ remapping_configs: updatedConfigs });
    }
  }, [deviceProfiles, populateAvailableKeys, remappingConfigs.remapping_configs.length]);

  // Handle remapping response
  const handleRemappingResponse = (payload: MQTTResponse) => {
    const wasModalOpen = isModalOpen;
    const wasCreating = !isEditing;
    const configId = selectedConfigId;

    setLoading(false);

    if (payload.remapping_configs && Array.isArray(payload.remapping_configs)) {
      const configsWithKeys = populateAvailableKeys(payload.remapping_configs);
      setRemappingConfigs({ remapping_configs: configsWithKeys });
      return;
    }

    if (payload.status === "success") {
      // Handle different response formats first - try to get configs from response
      let configs: RemappingConfig[] | null = null;

      if (payload.data && Array.isArray(payload.data)) {
        configs = payload.data;
      } else if (payload.data && payload.data.remapping_configs && Array.isArray(payload.data.remapping_configs)) {
        configs = payload.data.remapping_configs;
      }

      // Update configs immediately if available
      if (configs && Array.isArray(configs)) {
        const configsWithKeys = populateAvailableKeys(configs);
        setRemappingConfigs({ remapping_configs: configsWithKeys });

        // Show success message and close modal for create/edit operations
        if (wasModalOpen) {
          const operationType = wasCreating ? "created" : "updated";
          toast.success(`Configuration ${operationType} successfully!`);
          // Close modal after successful operation
          setTimeout(() => {
            closeModal();
          }, 300); // Small delay to show toast
        } else {
          // This was a delete operation
          if (configId) {
            toast.success("Configuration deleted successfully!");
            // Clear selected config id after successful delete
            setSelectedConfigId(null);
          } else {
            toast.success(payload.message || "Operation completed successfully");
          }
        }
      } else {
        // No configs in response, show message and potentially refresh
        if (wasModalOpen) {
          const operationType = wasCreating ? "created" : "updated";
          toast.success(`Configuration ${operationType} successfully!`);
          // Close modal
          setTimeout(() => {
            closeModal();
          }, 300);
        } else {
          toast.success(payload.message || "Operation completed successfully");
        }

        // For operations that don't return full config list, refresh configs immediately
        setTimeout(() => getConfigs(), 100);
      }

      // General success feedback
      if (!payload.message) {
        toast.success("Operation completed successfully");
      }

    } else {
      // Error handling
      toast.error(payload.message || "An error occurred");

      // For errors, don't close modal - let user retry
      if (payload.message && payload.message.includes("already exists")) {
        toast.error("Configuration name already exists. Please choose a different name");
      }
    }
  };

  // Request available devices
  const requestAvailableDevices = useCallback(() => {
    if (getMQTTClient()?.connected) {
      publishToAvailableDevices({ command: "get_all_availables" });
      setTimeout(() => {
        publishToAvailableDevices({ command: "get_modbus_availables" });
        publishToAvailableDevices({ command: "get_modular_availables" });
      }, 1000);
    }
  }, [publishToAvailableDevices]);

  // Background config publishing
  useEffect(() => {
    configPublishIntervalRef.current = setInterval(() => {
      publishConfigToRemapResponse();
    }, 3000);

    return () => {
      if (configPublishIntervalRef.current) {
        clearInterval(configPublishIntervalRef.current);
        configPublishIntervalRef.current = null;
      }
    };
  }, [publishConfigToRemapResponse]);

  // MQTT Connection
  useEffect(() => {
    let currentClient: any = null;
    let deviceRefreshInterval: NodeJS.Timeout | null = null;

    if (typeof window !== "undefined") {
      try {
        currentClient = connectMQTT();

        // Define message handler inside useEffect to avoid stale closure
        const messageHandler = (topic: string, message: Buffer) => {
          try {
            const payload = JSON.parse(message.toString());

            // Temporarily handle device topics by checking the state inside callback
            const checkRealTimeData = (topicToCheck: string) => {
              // We need to access the current state without dependency
              setModbusDevices(currentModbus => {
                setModularDevices(currentModular => {
                  setRealTimeData(currentRealTime => {
                    const allDevices = [...currentModbus, ...currentModular];
                    const device = allDevices.find(d => d.topic === topicToCheck);
                    if (device) {
                      return { ...currentRealTime, [device.name]: payload };
                    }
                    return currentRealTime;
                  });
                  return currentModular; // Return unchanged
                });
                return currentModbus; // Return unchanged
              });
            };

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
                checkRealTimeData(topic);
                break;
            }
          } catch (error) {
            console.error("Error parsing MQTT message:", error, "Raw message:", message.toString());
          }
        };

        currentClient.on("connect", () => {
          setMqttConnectionStatus("Connected");
          currentClient.subscribe([
            TOPICS.MODBUS_AVAILABLES,
            TOPICS.MODULAR_AVAILABLES,
            "REMAP_RESPONSE",
          ]);

          setTimeout(() => {
            requestAvailableDevices();
          }, 500);

          deviceRefreshInterval = setInterval(() => {
            requestAvailableDevices();
          }, 10000);

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
          if (deviceRefreshInterval) {
            clearInterval(deviceRefreshInterval);
            deviceRefreshInterval = null;
          }
        });

        currentClient.on("message", messageHandler);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error connecting MQTT:", errorMessage);
        setMqttConnectionStatus("Connection failed: " + errorMessage);
      }
    }

    return () => {
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
  }, [TOPICS, getConfigs, requestAvailableDevices, handleRemappingResponse]); // Minimal dependencies

  // Modal functions
  const openModal = (config?: RemappingConfig) => {
    if (config) {
      setIsEditing(true);
      setSelectedConfigId(config.id);
      // Ensure available_keys are populated when editing
      const configWithKeys = populateAvailableKeys([config])[0];
      setCurrentConfig({ ...configWithKeys });
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
        source_devices: [
          {
            device_id: "",
            device_name: "",
            mqtt_topic: "",
            available_keys: [],
            key_mappings: [
              {
                original_key: "",
                custom_key: ""
              }
            ]
          }
        ],
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

  // Form handlers
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

  // Device management functions
  const addSourceDevice = () => {
    const newDevice: SourceDevice = {
      device_id: "",
      device_name: "",
      mqtt_topic: "",
      available_keys: [],
      key_mappings: [{ original_key: "", custom_key: "" }],
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
    const selectedDevice = availableDevices.find((d) => d.name === device.device_name);
    const availableKeys = selectedDevice ? getDeviceFields(selectedDevice) : [];

    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.map((d, i) =>
        i === index ? {
          ...device,
          available_keys: availableKeys,
          mqtt_topic: selectedDevice?.topic || "",
        } : d
      ),
    }));
  };

  const addDeviceKeyMapping = (deviceIndex: number) => {
    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.map((device, i) =>
        i === deviceIndex ? {
          ...device,
          key_mappings: [...device.key_mappings, { original_key: "", custom_key: "" }],
        } : device
      ),
    }));
  };

  const removeDeviceKeyMapping = (deviceIndex: number, mappingIndex: number) => {
    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.map((device, i) =>
        i === deviceIndex ? {
          ...device,
          key_mappings: device.key_mappings.filter((_, mi) => mi !== mappingIndex),
        } : device
      ),
    }));
  };

  const updateDeviceKeyMapping = (deviceIndex: number, mappingIndex: number, mapping: KeyMapping) => {
    setCurrentConfig((prev) => ({
      ...prev,
      source_devices: prev.source_devices.map((device, i) =>
        i === deviceIndex ? {
          ...device,
          key_mappings: device.key_mappings.map((m, mi) =>
            mi === mappingIndex ? mapping : m
          ),
        } : device
      ),
    }));
  };

  // Calculate summary data
  const totalConfigs = remappingConfigs.remapping_configs.length;
  const totalSourceDevices = remappingConfigs.remapping_configs.reduce(
    (sum, config) => sum + (config.source_devices?.length || 0), 0
  );
  const totalKeyMappings = remappingConfigs.remapping_configs.reduce(
    (sum, config) => sum + config.source_devices?.reduce(
      (deviceSum, device) => deviceSum + (device.key_mappings?.length || 0), 0
    ) || 0, 0
  );

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <ArrowLeftRight className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Payload Remapping</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={getConfigs}>
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
              <CardTitle className="text-sm font-medium">Configurations</CardTitle>
              <Settings2 className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalConfigs}</div>
              <p className="text-xs text-muted-foreground">Active remapping configurations</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Source Devices</CardTitle>
              <Activity className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSourceDevices}</div>
              <p className="text-xs text-muted-foreground">Devices being monitored</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Key Mappings</CardTitle>
              <Code className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalKeyMappings}</div>
              <p className="text-xs text-muted-foreground">Field transformations</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Real-time Status</CardTitle>
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(realTimeData).length}</div>
              <p className="text-xs text-muted-foreground">Active data streams</p>
            </CardContent>
          </Card>
        </div>

        {/* Available Devices */}
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
                <h3 className="text-lg font-semibold mb-2">No devices available</h3>
                <p className="text-muted-foreground">Waiting for devices to be discovered...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {availableDevices.map((device, index) => (
                  <Card key={device.id || index} className="h-fit">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        {device.name}
                        <Badge variant={device.device_type === "modbus" ? "default" : "secondary"}>
                          {device.device_type}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {device.manufacturer} - {device.part_number}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Topic</Label>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded">{device.topic}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Available Keys ({getDeviceFields(device).length})
                        </Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {getDeviceFields(device).slice(0, 3).map((field, fieldIndex) => (
                            <Badge key={fieldIndex} variant="outline" className="text-xs">
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
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Remapping Configurations ({remappingConfigs.remapping_configs.length})
            </h3>
            <Button size="sm" onClick={() => openModal()}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </div>
          <div className="p-4">
            {remappingConfigs.remapping_configs.length === 0 ? (
              <div className="text-center py-8">
                <Code className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No remapping configurations</h3>
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
                      <TableHead className="min-w-36">Configuration</TableHead>
                      <TableHead className="min-w-40">MQTT Broker</TableHead>
                      <TableHead className="min-w-64">Source Devices & Keys</TableHead>
                      <TableHead className="min-w-48">Publish Settings</TableHead>
                      <TableHead className="text-center w-32">Controls</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remappingConfigs.remapping_configs.map((config, index) => (
                      <TableRow key={config.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-base flex items-center gap-2">
                              {config.name}
                              <Switch checked={config.enabled} disabled className="scale-75" />
                              <Badge variant={config.enabled ? "default" : "secondary"} className="text-xs">
                                {config.enabled ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">{config.description}</div>
                            {config.created_at && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(config.created_at).toLocaleDateString("id-ID", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono bg-muted/50 rounded px-2 py-1 text-xs whitespace-nowrap">
                            {config.mqtt_publish_config.broker_url}
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="space-y-2 max-w-sm">
                            <div className="text-sm font-medium text-muted-foreground">
                              Devices ({config.source_devices?.length || 0})
                            </div>
                            {config.source_devices?.slice(0, 2).map((device, deviceIdx) => (
                              <div key={deviceIdx} className="border rounded-md p-2 bg-muted/20">
                                <div className="flex items-center justify-between mb-1">
                                  <Badge variant="secondary" className="text-xs">{device.device_name}</Badge>
                                  <div className="flex items-center gap-1">
                                    <Badge variant="default" className="text-xs">
                                      {device.key_mappings?.length || 0}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {device.available_keys?.length || 0}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">Topic: {device.mqtt_topic}</div>
                              </div>
                            ))}
                            {(config.source_devices?.length || 0) > 2 && (
                              <div className="text-xs text-muted-foreground text-center py-1">
                                +{(config.source_devices?.length || 0) - 2} more devices
                              </div>
                            )}
                            <div className="text-sm font-medium text-muted-foreground">
                              Total Mappings: {config.source_devices?.reduce((sum, device) => sum + (device.key_mappings?.length || 0), 0) || 0}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="space-y-1">
                            <div className="text-sm font-medium font-mono bg-muted/50 rounded px-2 py-1 text-xs truncate">
                              {config.mqtt_publish_config.topic}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                QoS {config.mqtt_publish_config.qos}
                              </Badge>
                              {config.mqtt_publish_config.retain && (
                                <Badge variant="outline" className="text-xs">Retain</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Interval: {config.mqtt_publish_config.publish_interval_seccond}s
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openDetailDialog(config)} title="View Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openModal(config)} title="Edit Configuration">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmDelete(config)} title="Delete">
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
                {isEditing ? "Edit Remapping Configuration" : "Create Remapping Configuration"}
              </DialogTitle>
            </div>
            <DialogDescription>
              Configure MQTT payload remapping with custom key transformations
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
                    onChange={(e) => setCurrentConfig((prev) => ({...prev, name: e.target.value }))}
                    placeholder="Enter configuration name"
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={currentConfig.enabled}
                    onCheckedChange={(checked) => setCurrentConfig((prev) => ({...prev, enabled: checked }))}
                  />
                  <Label htmlFor="enabled">Enabled</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="configDescription">Description</Label>
                <Textarea
                  id="configDescription"
                  value={currentConfig.description}
                  onChange={(e) => setCurrentConfig((prev) => ({...prev, description: e.target.value}))}
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
                  <Button type="button" variant="outline" size="sm" onClick={addSourceDevice}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Device
                  </Button>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  {/* DRAG & DROP AREA HEADER */}
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <Shuffle className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium text-blue-900">Device Order</h4>
                    <Badge variant="outline" className="text-xs">
                      {currentConfig.source_devices.length} device{currentConfig.source_devices.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    <SortableContext items={currentConfig.source_devices.map((_, index) => `device-${index}`)} strategy={verticalListSortingStrategy}>
                      {currentConfig.source_devices.map((device, deviceIndex) => (
                        <DraggableDeviceEditor
                          key={`device-${deviceIndex}`}
                          id={`device-${deviceIndex}`}
                          device={device}
                          index={deviceIndex}
                          onUpdate={(updatedDevice) => updateSourceDevice(deviceIndex, updatedDevice)}
                          onRemove={() => removeSourceDevice(deviceIndex)}
                          availableDevices={availableDevices}
                        />
                      ))}
                    </SortableContext>

                    {currentConfig.source_devices.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shuffle className="mx-auto h-12 w-12 mb-3 opacity-40" />
                        <p className="font-semibold mb-1">Drop Zone Ready</p>
                        <p className="text-sm">Add devices above to enable drag and drop reordering</p>
                      </div>
                    )}
                  </div>

                  {currentConfig.source_devices.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded">
                      <Layers className="mx-auto h-8 w-8 mb-2" />
                      <p className="font-medium">No devices added yet</p>
                      <p className="text-sm">Click "Add Device" to get started</p>
                    </div>
                  )}
                </DndContext>
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
                    onChange={(e) => setCurrentConfig((prev) => ({
                      ...prev,
                      mqtt_publish_config: {
                        ...prev.mqtt_publish_config,
                        broker_url: e.target.value,
                      },
                    }))}
                    placeholder="mqtt://localhost:1883"
                  />
                </div>

                <div>
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    value={currentConfig.mqtt_publish_config.client_id}
                    onChange={(e) => setCurrentConfig((prev) => ({
                      ...prev,
                      mqtt_publish_config: {
                        ...prev.mqtt_publish_config,
                        client_id: e.target.value,
                      },
                    }))}
                    placeholder="remapper_client_001"
                  />
                </div>

                <div>
                  <Label htmlFor="publishTopic">Publish Topic *</Label>
                  <Input
                    id="publishTopic"
                    value={currentConfig.mqtt_publish_config.topic}
                    onChange={(e) => setCurrentConfig((prev) => ({
                      ...prev,
                      mqtt_publish_config: {
                        ...prev.mqtt_publish_config,
                        topic: e.target.value,
                      },
                    }))}
                    placeholder="e.g., REMAP/sensor_data"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="qos">QoS Level</Label>
                  <Select
                    value={currentConfig.mqtt_publish_config.qos.toString()}
                    onValueChange={(value) => setCurrentConfig((prev) => ({
                      ...prev,
                      mqtt_publish_config: {
                        ...prev.mqtt_publish_config,
                        qos: parseInt(value),
                      },
                    }))}
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
                  <Label htmlFor="publishInterval">Publish Interval (seconds)</Label>
                  <Input
                    id="publishInterval"
                    type="number"
                    min="1"
                    value={currentConfig.mqtt_publish_config.publish_interval_seccond}
                    onChange={(e) => setCurrentConfig((prev) => ({
                      ...prev,
                      mqtt_publish_config: {
                        ...prev.mqtt_publish_config,
                        publish_interval_seccond: parseInt(e.target.value) || 10,
                      },
                    }))}
                    placeholder="10"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="retain"
                    checked={currentConfig.mqtt_publish_config.retain}
                    onCheckedChange={(checked) => setCurrentConfig((prev) => ({
                      ...prev,
                      mqtt_publish_config: {
                        ...prev.mqtt_publish_config,
                        retain: checked,
                      },
                    }))}
                  />
                  <div>
                    <Label htmlFor="retain">Retain Message</Label>
                    <p className="text-xs text-muted-foreground">Keep message on broker</p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDataPreviewDialogOpen(true)}
                disabled={!currentConfig.name}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Output
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loadingDevices}>
                  {isEditing ? "Update Configuration" : "Create Configuration"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialogContent.description}</AlertDialogDescription>
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

      {/* Data Preview Dialog (for configuration output preview) */}
      <Dialog open={isDataPreviewDialogOpen} onOpenChange={setIsDataPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              <DialogTitle>Configuration Output Preview</DialogTitle>
            </div>
            <DialogDescription>
              Preview of the remapped data structure that will be published to MQTT
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              // Generate preview JSON based on current configuration
              const previewOutput: any = {};
              const configName = currentConfig.name || "Unknown_Config";

              // Process each device and apply mappings
              currentConfig.source_devices.forEach((device) => {
                if (!device.key_mappings || device.key_mappings.length === 0) return;

                device.key_mappings.forEach((mapping) => {
                  const { original_key, custom_key } = mapping;
                  if (!original_key || !custom_key) return;

                  // Simulate sample data for each key
                  const sampleValue = (() => {
                    const deviceFields = device.available_keys.find(f => f.var_name === original_key);
                    if (deviceFields?.data_type === "float") return Math.random() * 100;
                    if (deviceFields?.data_type === "int") return Math.floor(Math.random() * 1000);
                    if (deviceFields?.data_type === "bool") return Math.random() > 0.5;
                    return `Sample_${original_key}`;
                  })();

                  // Apply grouping logic
                  if (device.group) {
                    if (!previewOutput[device.group]) {
                      previewOutput[device.group] = {};
                    }
                    previewOutput[device.group][custom_key] = sampleValue;
                  } else {
                    previewOutput[custom_key] = sampleValue;
                  }
                });
              });

              // Add configuration name at root level
              if (!previewOutput.name) {
                previewOutput.name = configName;
              }

              // Add timestamp
              previewOutput.Timestamp = new Date().toISOString();

              return (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Output JSON Preview
                      </CardTitle>
                      <CardDescription>
                        This is how the data will be published to MQTT topic: <code className="font-mono">{currentConfig.mqtt_publish_config.topic || "Not configured"}</code>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                        {JSON.stringify(previewOutput, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Grouping Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {currentConfig.source_devices
                          .filter(device => device.group)
                          .map((device, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>{device.device_name}:</span>
                              <Badge variant="outline">{device.group}</Badge>
                            </div>
                          ))}
                        {currentConfig.source_devices.filter(device => device.group).length === 0 && (
                          <p className="text-sm text-muted-foreground">No grouped devices</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Mapping Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-2xl font-bold">
                          {currentConfig.source_devices.reduce((sum, device) => sum + (device.key_mappings?.length || 0), 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total key transformations</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 p-4 rounded">
                    <h4 className="font-medium mb-1">How the remapping works:</h4>
                    <p>• Original sensor readings are mapped to custom field names</p>
                    <p>• Devices with the same "group" key are merged together in a nested object</p>
                    <p>• Configuration name is added at the root level</p>
                    <p>• Timestamp indicates when the data was processed</p>
                    <p>• Data is published periodically or when new sensor data arrives</p>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDataPreviewDialogOpen(false)}>
              Close Preview
            </Button>
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
              Live data preview from MQTT topic: <code className="font-mono">{previewTopic}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {Object.keys(previewData).length === 0 ? (
              <div className="text-center py-8">
                <Activity className="mx-auto h-16 w-16 text-muted-foreground mb-4 animate-pulse" />
                <h3 className="text-lg font-semibold mb-2">Waiting for data...</h3>
                <p className="text-muted-foreground">
                  No data received yet. Make sure the device is publishing to this topic.
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
                      <div key={key} className="flex items-center justify-between bg-background p-3 rounded border">
                        <span className="font-mono text-sm font-medium">{key}</span>
                        <span className="text-sm text-muted-foreground">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• This preview shows real-time data as it arrives from the MQTT topic</p>
                  <p>• Data is automatically parsed and displayed in key-value format</p>
                  <p>• Use this to understand what data is available for remapping</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={closePreviewDialog}>Close Preview</Button>
          </DialogFooter>
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
            <DialogDescription>Detailed view of remapping configuration</DialogDescription>
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
                      <Label className="text-sm font-medium text-muted-foreground">Configuration Name</Label>
                      <p className="text-base font-medium">{selectedConfig.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      <div className="flex items-center gap-2">
                        <Switch checked={selectedConfig.enabled} disabled />
                        <span className="text-sm">{selectedConfig.enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                      <p className="text-base">{selectedConfig.description}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Configuration ID</Label>
                      <p className="text-sm font-mono bg-muted px-2 py-1 rounded">{selectedConfig.id}</p>
                    </div>
                    {selectedConfig.created_at && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Created At</Label>
                        <p className="text-base flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(selectedConfig.created_at).toLocaleDateString("id-ID", {
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
                      <Label className="text-sm font-medium text-muted-foreground">Publish Topic</Label>
                      <p className="text-base font-mono bg-muted px-3 py-2 rounded">
                        {selectedConfig.mqtt_publish_config.topic}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">QoS Level</Label>
                      <Badge variant="default" className="text-sm">
                        QoS {selectedConfig.mqtt_publish_config.qos}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Publish Interval</Label>
                      <p className="text-base">{selectedConfig.mqtt_publish_config.publish_interval_seccond} seconds</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Retain Message</Label>
                      <div className="flex items-center gap-2">
                        <Switch checked={selectedConfig.mqtt_publish_config.retain} disabled />
                        <span className="text-sm">
                          {selectedConfig.mqtt_publish_config.retain ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDetailDialog}>Close</Button>
            {selectedConfig && (
              <Button onClick={() => {
                closeDetailDialog();
                openModal(selectedConfig);
              }}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Configuration
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
};

export default RemappingControl;