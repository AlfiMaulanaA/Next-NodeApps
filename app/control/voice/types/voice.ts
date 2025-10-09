// Voice Control Types and Interfaces

export interface VoiceCommand {
  id: string;
  device_name: string;
  part_number: string;
  pin: number;
  address: number;
  device_bus: number;
  mac: string;
  voice_commands: string[]; // Array of voice commands (e.g., ["turn on", "nyalakan"])
  object_name: string; // Human readable name (e.g., "living room light")
  description?: string;
  status?: 'online' | 'offline' | 'unknown';
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

export interface VoiceCommandForm {
  device_name: string;
  part_number: string;
  pin: number;
  address: number;
  device_bus: number;
  mac?: string;
  voice_commands: string;
  object_name: string;
  description?: string;
}

export interface VoiceControlStatus {
  is_active: boolean;
  last_command?: string;
  last_result?: 'success' | 'error' | 'no_match';
  recognized_text?: string;
  executed_at?: string;
}

export interface DeviceInfo {
  name: string;
  part_number: string;
  address: number;
  device_bus: number;
  mac: string;
  available_pins: number[];
}

// MQTT Topics for Voice Control
export const VOICE_CONTROL_TOPICS = {
  // Command topics (Frontend → Backend)
  CREATE: 'command/control/voice/create',
  READ: 'command/control/voice/read',
  UPDATE: 'command/control/voice/update',
  DELETE: 'command/control/voice/delete',
  START_VOICE: 'command/control/voice/start',
  STOP_VOICE: 'command/control/voice/stop',
  TEST_COMMAND: 'command/control/voice/test',
  LAST_RESULT: 'command/control/voice/last-result',

  // Response topics (Backend → Frontend)
  RESULT: 'response/control/voice/result',
  STATUS: 'response/control/voice/status',
  VOICE_RESULT: 'response/control/voice/voice_result',

  // Device topics
  DEVICE_AVAILABLE: 'MODULAR_DEVICE/AVAILABLES',
  DEVICE_HEARTBEAT: 'device/heartbeat/',
  DEVICE_STATUS: 'device/status/',
} as const;

// Voice Recognition Languages
export const VOICE_LANGUAGES = {
  INDONESIAN: 'id-ID',
  ENGLISH: 'en-US',
} as const;

// Voice Command Templates
export const VOICE_COMMAND_TEMPLATES = {
  INDONESIAN: {
    TURN_ON: ['nyalakan', 'hidupkan', 'aktifkan'],
    TURN_OFF: ['matikan', 'padamkan', 'nonaktifkan'],
  },
  ENGLISH: {
    TURN_ON: ['turn on', 'switch on', 'activate'],
    TURN_OFF: ['turn off', 'switch off', 'deactivate'],
  },
} as const;

// API Response Types
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  timestamp?: string;
}

export interface VoiceTestResult {
  success: boolean;
  recognized_text: string;
  message?: string;
  matched_command?: VoiceCommand;
  executed_action?: string;
  error?: string;
}

// Form Validation Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidation {
  isValid: boolean;
  errors: ValidationError[];
}
