/**
 * MQTT Payload Remapping Data Models & Types
 * Following existing TypeScript patterns in the project
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export type DeviceType = "modbus" | "modular" | "snmp" | "unknown";
export type MappingStatus =
  | "enabled"
  | "disabled"
  | "running"
  | "stopped"
  | "error";
export type MergeStrategyType =
  | "flat_merge"
  | "nested_merge"
  | "array_aggregate";
export type AggregationStrategyType =
  | "fixed_window"
  | "sliding_window"
  | "event_triggered";
export type ConflictResolutionType =
  | "latest_wins"
  | "priority_wins"
  | "merge_arrays"
  | "custom";

// ============================================================================
// DEVICE DISCOVERY
// ============================================================================

export interface AvailableDevice {
  id: string;
  name: string;
  address: string;
  device_bus?: number | string;
  part_number: string;
  mac: string;
  manufacturer: string;
  device_type: string;
  topic: string;
  source: DeviceType;
  status?: "online" | "offline";
  last_seen?: string;
}

// ============================================================================
// MQTT CONFIGURATION
// ============================================================================

export interface MQTTConfig {
  broker_url: string;
  client_id: string;
  qos: 0 | 1 | 2;
  retain: boolean;
  username?: string;
  password?: string;
  keepalive?: number;
  reconnect_period?: number;
  connect_timeout?: number;
  clean_session?: boolean;
  will?: {
    topic: string;
    message: string;
    qos: 0 | 1 | 2;
    retain: boolean;
  };
}

// ============================================================================
// SINGLE DEVICE MAPPING
// ============================================================================

export interface KeyMapping {
  [originalKey: string]: string; // "temp": "temperature_celsius"
}

export interface SingleDeviceMapping {
  id: number;
  name: string;
  type: "single_device";
  device_id: string;
  device_topic: string;
  device_type: DeviceType;
  output_topic: string;
  key_mappings: KeyMapping;
  mqtt_config: MQTTConfig;
  status: MappingStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MULTI-DEVICE AGGREGATION
// ============================================================================

export interface AggregationDevice {
  device_id: string;
  device_name: string;
  source_topic: string;
  device_type: DeviceType;
  priority: number; // 1 = highest priority
  key_mappings: KeyMapping;
  data_received_at?: string;
  status?: MappingStatus;
}

export interface AggregationStrategy {
  type: AggregationStrategyType;
  window_size: number; // seconds
  time_tolerance: number; // seconds for sync
  slide_interval?: number; // for sliding window
}

export interface MergeStrategy {
  type: MergeStrategyType;
  conflict_resolution: ConflictResolutionType;
  group_by_categories?: boolean;
}

export interface ComputedField {
  field_name: string;
  calculation: string; // e.g., "avg(water_temp, air_temp)"
  data_type: "number" | "boolean" | "string";
}

export interface OutputStructure {
  [key: string]: any; // Flexible structure with placeholders
  // Example:
  // {
  //   "station_id": "WATER_PLANT_001",
  //   "sensor_data": {
  //     "quality_parameters": {
  //       "temperature": "{water_temperature}",
  //       "ph_level": "{water_ph_level}"
  //     }
  //   }
  // }
}

export interface MetadataSettings {
  enable_metadata: boolean;
  add_timestamps: boolean;
  add_data_quality_score: boolean;
  add_device_status: boolean;
}

export interface MultiDeviceAggregation {
  id: number;
  name: string;
  description?: string;
  type: "multi_device";
  devices: AggregationDevice[];
  aggregation_strategy: AggregationStrategy;
  merge_strategy: MergeStrategy;
  computed_fields?: ComputedField[];
  output_structure: OutputStructure;
  output_topic: string;
  mqtt_config: MQTTConfig;
  metadata_settings: MetadataSettings;
  status: MappingStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// STRUCTURE TEMPLATES
// ============================================================================

export interface StructureTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;
  template: OutputStructure;
  created_at: string;
}

// ============================================================================
// ACTIVE REMAPPINGS
// ============================================================================

export interface ActiveRemapping {
  id: string;
  config_type: "single_device_mappings" | "multi_device_aggregations";
  config_id: number;
  status: "running" | "stopped" | "error" | "connecting";
  started_at: string;
  mqtt_connection: "connected" | "disconnected" | "connecting" | "error";
  last_data_received?: string;
  error_message?: string;
}

// ============================================================================
// CONFIGURATION CONTAINER
// ============================================================================

export interface RemappingConfiguration {
  metadata: {
    version: string;
    created_at: string;
    updated_at: string;
  };
  active_remappings: ActiveRemapping[];
  single_device_mappings: SingleDeviceMapping[];
  multi_device_aggregations: MultiDeviceAggregation[];
  structure_templates: StructureTemplate[];
}

// ============================================================================
// MQTT MESSAGES
// ============================================================================

export interface MQTTCommandMessage {
  command: string;
  request_id?: string;
  data?: any;
  timestamp?: string;
}

export interface MQTTResponseMessage {
  command: string;
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  request_id?: string;
  timestamp: string;
}

// ============================================================================
// API/HOOK INTERFACES
// ============================================================================

export interface RemappingService {
  // Device discovery
  getAvailableDevices: () => Promise<AvailableDevice[]>;

  // Configuration management
  getAllConfigurations: () => Promise<RemappingConfiguration>;
  createSingleMapping: (
    config: Omit<SingleDeviceMapping, "id" | "created_at" | "updated_at">
  ) => Promise<SingleDeviceMapping>;
  createMultiAggregation: (
    config: Omit<MultiDeviceAggregation, "id" | "created_at" | "updated_at">
  ) => Promise<MultiDeviceAggregation>;
  updateConfiguration: (
    type: "single_device_mappings" | "multi_device_aggregations",
    id: number,
    data: any
  ) => Promise<void>;
  deleteConfiguration: (
    type: "single_device_mappings" | "multi_device_aggregations",
    id: number
  ) => Promise<void>;

  // Active mappings
  startMapping: (
    config_type: "single_device_mappings" | "multi_device_aggregations",
    config_id: number
  ) => Promise<void>;
  stopMapping: (active_id: string) => Promise<void>;

  // Monitoring
  getActiveMappings: () => Promise<ActiveRemapping[]>;
}

// ============================================================================
// REACT COMPONENT PROPS
// ============================================================================

export interface DeviceSelectorProps {
  devices: AvailableDevice[];
  selectedDevices: AvailableDevice[];
  onDeviceSelect: (device: AvailableDevice) => void;
  onDeviceDeselect: (deviceId: string) => void;
  multiSelect?: boolean;
  loading?: boolean;
}

export interface KeyValueMapperProps {
  inputData: Record<string, any>;
  mappings: KeyMapping;
  onMappingChange: (mappings: KeyMapping) => void;
  onMappingAdd: (originalKey: string, mappedKey: string) => void;
  onMappingRemove: (originalKey: string) => void;
  readOnly?: boolean;
}

export interface StructureBuilderProps {
  structure: OutputStructure;
  templates: StructureTemplate[];
  onStructureChange: (structure: OutputStructure) => void;
  onTemplateSelect: (template: StructureTemplate) => void;
  availableFields: string[]; // Available field names from device mappings
}

export interface AggregationPreviewProps {
  aggregation: MultiDeviceAggregation;
  mockData?: Record<string, any>; // Mock data for preview
  showMetadata?: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ConfigType =
  | "single_device_mappings"
  | "multi_device_aggregations"
  | "structure_templates"
  | "active_remappings";

export type AnyRemappingConfig =
  | SingleDeviceMapping
  | MultiDeviceAggregation
  | StructureTemplate
  | ActiveRemapping;

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface RemappingError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// ============================================================================
// MONITORING & ANALYTICS
// ============================================================================

export interface MappingStats {
  total_mappings: number;
  active_mappings: number;
  error_mappings: number;
  messages_processed: number;
  messages_per_second: number;
  average_latency_ms: number;
  last_updated: string;
}

export interface DataQualityScore {
  completeness: number; // 0-100
  accuracy: number; // 0-100
  timeliness: number; // 0-100
  overall_score: number; // 0-100
  issues: string[];
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

// Backward compatibility with existing TypeScript interfaces
export type KeyMappingType = KeyMapping;
export type DeviceInfo = AvailableDevice;

export default {};
