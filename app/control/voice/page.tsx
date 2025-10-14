"use client";

import { useEffect, useState } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Plus,
  Edit2,
  Trash2,
  Play,
  Square,
  TestTube,
  CheckCircle,
  AlertCircle,
  Activity,
  Settings,
  ToggleLeft,
  ToggleRight,
  Power,
  Zap,
  Volume2,
  VolumeX,
  Radio,
  Smartphone,
  Wifi,
  WifiOff,
  Sparkles,
  Command,
  Lightbulb,
  Fan,
  Home,
  Clock,
} from "lucide-react";

import MQTTConnectionBadge from "@/components/mqtt-status";

import {
  VoiceCommand,
  VoiceCommandForm,
  DeviceInfo,
  VoiceControlStatus,
  VoiceTestResult,
  VOICE_CONTROL_TOPICS,
  VOICE_LANGUAGES,
} from "./types/voice";

// Automation Voice MQTT Topics
const AUTOMATION_VOICE_TOPICS = {
  CREATE: "command/automation_voice/create",
  READ: "command/automation_voice/read",
  UPDATE: "command/automation_voice/update",
  DELETE: "command/automation_voice/delete",
  DISCOVER: "command/automation_voice/discover",
  RESULT: "response/automation_voice/result",
  DEVICE_AVAILABLE: "MODULAR_DEVICE/AVAILABLES",
};

// Voice Command Topics
const VOICE_COMMAND_TOPICS = {
  INPUT: "voice/command/input",
  TEST: "voice/command/test",
  RESULT: "voice/command/result",
  MODULAR: "modular", // For successful voice commands
};

import mqtt from "mqtt";

export default function VoiceControlPage() {
  // State management
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [availableDevices, setAvailableDevices] = useState<DeviceInfo[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<VoiceControlStatus>({
    is_active: false,
  });
  const [loading, setLoading] = useState(false);
  const [mqttClient, setMqttClient] = useState<mqtt.MqttClient | null>(null);
  const [mqttConnected, setMqttConnected] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadLocalData = () => {
      try {
        const savedCommands = localStorage.getItem('voice_commands');
        if (savedCommands) {
          const parsedCommands = JSON.parse(savedCommands);
          setCommands(parsedCommands);
          console.log('Voice Control: Loaded commands from localStorage');
        }

        const savedDevices = localStorage.getItem('available_devices');
        if (savedDevices) {
          const parsedDevices = JSON.parse(savedDevices);
          setAvailableDevices(parsedDevices);
          console.log('Voice Control: Loaded devices from localStorage');
        }
      } catch (error) {
        console.error('Voice Control: Error loading local data:', error);
      }
    };

    loadLocalData();
  }, []);

  // Save commands to localStorage whenever commands change
  useEffect(() => {
    if (commands.length > 0) {
      try {
        localStorage.setItem('voice_commands', JSON.stringify(commands));
      } catch (error) {
        console.error('Voice Control: Error saving commands to localStorage:', error);
      }
    }
  }, [commands]);

  // Save devices to localStorage whenever availableDevices change
  useEffect(() => {
    if (availableDevices.length > 0) {
      try {
        localStorage.setItem('available_devices', JSON.stringify(availableDevices));
      } catch (error) {
        console.error('Voice Control: Error saving devices to localStorage:', error);
      }
    }
  }, [availableDevices]);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState<VoiceCommandForm>({
    device_name: "",
    part_number: "",
    pin: 1,
    address: 0,
    device_bus: 0,
    object_name: "",
    description: "",
  });

  const [editingCommand, setEditingCommand] = useState<VoiceCommand | null>(null);
  const [deletingCommand, setDeletingCommand] = useState<VoiceCommand | null>(null);
  const [testCommand, setTestCommand] = useState("");
  const [testResult, setTestResult] = useState<VoiceTestResult | null>(null);
  const [lastVoiceResult, setLastVoiceResult] = useState<any>(null);
  const [partialSpeechText, setPartialSpeechText] = useState<string>("");
  const [showSpeechCard, setShowSpeechCard] = useState(false);

  // Device status tracking for toggles
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, boolean>>({});

  // Auto-hide voice recognition result after 10 seconds
  useEffect(() => {
    if (lastVoiceResult) {
      const timer = setTimeout(() => {
        setLastVoiceResult(null);
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [lastVoiceResult]);

  // Web Speech API state
  const [recognition, setRecognition] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if browser supports Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognitionInstance = new SpeechRecognition();

        // Configure speech recognition
        recognitionInstance.continuous = false; // Single utterance
        recognitionInstance.interimResults = true; // Get interim results
        recognitionInstance.lang = 'id-ID'; // Indonesian language (can be changed)
        recognitionInstance.maxAlternatives = 1;

        // Handle speech recognition results
        recognitionInstance.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Show interim results
          if (interimTranscript) {
            setPartialSpeechText(interimTranscript);
            setShowSpeechCard(true);
          }

          // Process final result
          if (finalTranscript) {
            console.log('Voice Control: Final transcript:', finalTranscript);
            setPartialSpeechText(finalTranscript);
            setShowSpeechCard(true);

            // Send the recognized speech to backend for processing
            handleSendVoiceCommand(finalTranscript);

            // Auto-hide after 10 seconds
            setTimeout(() => {
              setShowSpeechCard(false);
              setPartialSpeechText('');
            }, 10000);
          }
        };

        // Handle speech recognition start
        recognitionInstance.onstart = () => {
          console.log('Voice Control: Speech recognition started');
          setIsListening(true);
          setShowSpeechCard(true);
          setPartialSpeechText('Listening...');
          toast.info('🎤 Listening for voice commands...');
        };

        // Handle speech recognition end
        recognitionInstance.onend = () => {
          console.log('Voice Control: Speech recognition ended');
          setIsListening(false);

          // If voice control is still active, restart listening after a short delay
          if (voiceStatus.is_active) {
            setTimeout(() => {
              if (voiceStatus.is_active && recognitionInstance) {
                try {
                  recognitionInstance.start();
                } catch (error) {
                  console.error('Voice Control: Failed to restart speech recognition:', error);
                }
              }
            }, 1000); // 1 second delay before restarting
          }
        };

        // Handle speech recognition errors
        recognitionInstance.onerror = (event: any) => {
          console.error('Voice Control: Speech recognition error:', event.error);
          setIsListening(false);
          setShowSpeechCard(false);
          setPartialSpeechText('');

          let errorMessage = 'Speech recognition error';
          switch (event.error) {
            case 'no-speech':
              errorMessage = 'No speech detected. Please try again.';
              break;
            case 'audio-capture':
              errorMessage = 'Audio capture failed. Check your microphone.';
              break;
            case 'not-allowed':
              errorMessage = 'Microphone access denied. Please allow microphone access.';
              break;
            case 'network':
              errorMessage = 'Network error occurred.';
              break;
            default:
              errorMessage = `Speech recognition error: ${event.error}`;
          }

          toast.error(`🎤 ${errorMessage}`);
        };

        setRecognition(recognitionInstance);
      } else {
        console.warn('Voice Control: Web Speech API not supported in this browser');
        setSpeechSupported(false);
        toast.warning('🎤 Speech recognition not supported in this browser');
      }
    }
  }, [voiceStatus.is_active]);

  // Initialize MQTT connection
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    const initializeMQTT = () => {
      try {
        const client = mqtt.connect('ws://localhost:9000/mqtt', {
          clean: true,
          connectTimeout: 5000,
          reconnectPeriod: 3000,
          keepalive: 60,
          clientId: `voice-control-frontend-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        });

        client.on('connect', () => {
          console.log('Voice Control: MQTT connected');
          setMqttClient(client);
          setupMQTTSubscriptions(client);

          // Wait a bit for subscriptions to be ready, then load data
          setTimeout(() => {
            loadInitialData(client);
          }, 500);
        });

        client.on('error', (error) => {
          console.error('Voice Control: MQTT error:', error);

          // Retry connection if not exceeded max retries
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Voice Control: Retrying MQTT connection (${retryCount}/${maxRetries})...`);
            setTimeout(() => {
              initializeMQTT();
            }, retryDelay);
          } else {
            toast.error('Failed to connect to MQTT broker. Please ensure the backend service is running.');
          }
        });

        client.on('message', handleMQTTMessage);

        client.on('reconnect', () => {
          console.log('Voice Control: MQTT reconnecting...');
        });

        client.on('offline', () => {
          console.log('Voice Control: MQTT offline');
          toast.warning('MQTT connection lost. Attempting to reconnect...');
        });

      } catch (error) {
        console.error('Voice Control: Failed to initialize MQTT:', error);
        toast.error('Failed to initialize MQTT connection');
      }
    };

    initializeMQTT();

    return () => {
      if (mqttClient) {
        mqttClient.end(true);
      }
    };
  }, []);

  const setupMQTTSubscriptions = (client: mqtt.MqttClient) => {
    // Subscribe to Automation Voice response topics
    client.subscribe(AUTOMATION_VOICE_TOPICS.RESULT);
    client.subscribe(AUTOMATION_VOICE_TOPICS.DEVICE_AVAILABLE);

    // Subscribe to Voice Command topics
    client.subscribe(VOICE_COMMAND_TOPICS.RESULT);

    console.log('Voice Control: Subscribed to MQTT topics');
  };

  const loadInitialData = (client: mqtt.MqttClient) => {
    // Load automation voice configurations
    client.publish(AUTOMATION_VOICE_TOPICS.READ, JSON.stringify({}));
  };

  const handleMQTTMessage = (topic: string, message: Buffer) => {
    try {
      const payload = JSON.parse(message.toString());

      switch (topic) {
        case AUTOMATION_VOICE_TOPICS.RESULT:
          handleCRUDResponse(payload);
          break;
        case AUTOMATION_VOICE_TOPICS.DEVICE_AVAILABLE:
          // Filter devices to only show RELAYMINI and RELAY
          if (Array.isArray(payload)) {
            const filteredDevices = payload.filter((device: any) =>
              device.part_number === 'RELAYMINI' || device.part_number === 'RELAY'
            );
            setAvailableDevices(filteredDevices);
          }
          break;
        case VOICE_CONTROL_TOPICS.STATUS:
          handleStatusUpdate(payload);
          break;
        case VOICE_COMMAND_TOPICS.RESULT:
          handleVoiceCommandResult(payload);
          break;
        case VOICE_CONTROL_TOPICS.VOICE_RESULT:
          handleVoiceResult(payload);
          break;
      }
    } catch (error) {
      console.error('Voice Control: Error parsing MQTT message:', error);
    }
  };

  const handleCRUDResponse = (payload: any) => {
    if (payload.status === 'success') {
      // Handle READ response - update commands list
      if (payload.data && Array.isArray(payload.data)) {
        setCommands(payload.data);
        // Save to localStorage when data is loaded
        try {
          localStorage.setItem('voice_commands', JSON.stringify(payload.data));
        } catch (error) {
          console.error('Voice Control: Error saving to localStorage:', error);
        }
      } else {
        // Handle CREATE/UPDATE/DELETE responses
        toast.success(payload.message || 'Operation successful');

        // Reload commands after successful operation to get updated data with IDs
        if (mqttClient) {
          mqttClient.publish(AUTOMATION_VOICE_TOPICS.READ, JSON.stringify({}));
        }

        // Close dialogs
        setCreateDialogOpen(false);
        setEditDialogOpen(false);
        setDeleteDialogOpen(false);
        resetForm();
      }
    } else {
      toast.error(payload.message || 'Operation failed');
    }
  };

  const handleStatusUpdate = (payload: any) => {
    setVoiceStatus({
      is_active: payload.is_active || false,
      last_command: payload.last_command,
      last_result: payload.last_result,
      recognized_text: payload.recognized_text,
      executed_at: payload.executed_at,
    });
  };

  const handleVoiceCommandResult = (payload: any) => {
    // Handle partial speech recognition results
    if (payload.type === 'partial') {
      setPartialSpeechText(payload.text || '');
      setShowSpeechCard(true);

      // Auto-hide card after 3 seconds of no new partial results
      if (payload.text && payload.text.trim()) {
        setTimeout(() => {
          setShowSpeechCard(false);
          setPartialSpeechText('');
        }, 3000);
      }
      return;
    }

    // Handle final voice command results
    setLastVoiceResult(payload);

    // Hide speech card when final result is received
    setShowSpeechCard(false);
    setPartialSpeechText('');

    // Update device toggle status based on command result
    if (payload.success && payload.object_name) {
      const deviceKey = `${payload.device_name || 'unknown'}-${payload.object_name}`;
      const isOnCommand = payload.action === 'on' || payload.message?.toLowerCase().includes('nyalakan') || payload.message?.toLowerCase().includes('hidupkan');

      if (isOnCommand) {
        // Turn ON the device toggle
        setDeviceStatuses(prev => ({
          ...prev,
          [deviceKey]: true
        }));
        toast.success(`✅ ${payload.object_name} turned ON via voice command`);
      } else {
        // Turn OFF the device toggle (for 'off' commands)
        setDeviceStatuses(prev => ({
          ...prev,
          [deviceKey]: false
        }));
        toast.success(`✅ ${payload.object_name} turned OFF via voice command`);
      }
    } else if (!payload.success) {
      toast.error(payload.error || 'Voice command failed - device status unchanged');
    }

    if (payload.success) {
      toast.success(`Voice command executed: ${payload.message}`);
    } else {
      toast.error(payload.error || 'Voice command failed');
    }
  };

  const handleVoiceResult = (payload: any) => {
    // Handle microphone test response
    if (payload.message && payload.message.includes('Microphone')) {
      if (payload.success) {
        toast.success('🎤 Microphone test passed - proceeding with voice control');
        // Continue with speech recognition after successful microphone test
        setIsListening(true);
        setShowSpeechCard(false);
        setPartialSpeechText('');

        // Send speech recognition request to backend
        const speechPayload = {};
        mqttClient?.publish("voice/speech/start", JSON.stringify(speechPayload));

        // Auto-stop after 30 seconds for continuous listening
        setTimeout(() => {
          if (isListening) {
            setIsListening(false);
            setShowSpeechCard(false);
            setPartialSpeechText('');
          }
        }, 30000);
      } else {
        // Microphone test failed - enter demo mode
        toast.warning('🎭 Microphone not available - entering demo mode');
        enterDemoMode();
      }
      return;
    }

    // Handle regular voice command results
    setTestResult(payload);
    setLastVoiceResult(payload.result || payload);

    if (payload.status === 'success') {
      toast.success(`Voice command executed: ${payload.message}`);
    } else {
      toast.warning(payload.message || 'Voice command not recognized');
    }
  };

  const resetForm = () => {
    setFormData({
      device_name: "",
      part_number: "",
      pin: 1,
      address: 0,
      device_bus: 0,
      object_name: "",
      description: "",
    });
    setEditingCommand(null);
  };

  const handleCreate = () => {
    if (!mqttClient) return;

    // Validate form
    if (!formData.device_name || !formData.object_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    const selectedDevice = availableDevices.find(d => d.name === formData.device_name);

    // Generate automatic voice commands based on object name
    const objectName = formData.object_name.toLowerCase();
    const voiceCommandsArray = [
      `nyalakan ${objectName}`,
      `hidupkan ${objectName}`,
      `aktifkan ${objectName}`,
      `matikan ${objectName}`,
      `padamkan ${objectName}`,
      `nonaktifkan ${objectName}`,
      `turn on ${objectName}`,
      `turn off ${objectName}`,
      `enable ${objectName}`,
      `disable ${objectName}`
    ];

    const payload = {
      device_name: formData.device_name,
      desc: formData.description,
      object_name: formData.object_name,
      voice_commands: voiceCommandsArray,
      pin: formData.pin,
      address: selectedDevice?.address || 0,
      bus: selectedDevice?.device_bus || 0,
      part_number: selectedDevice?.part_number || "RELAY",
    };

    // Send to backend first, then update UI on success
    mqttClient.publish(AUTOMATION_VOICE_TOPICS.CREATE, JSON.stringify(payload));

    // Close dialog and reset form immediately
    setCreateDialogOpen(false);
    resetForm();

    // Show processing message
    toast.info('Creating voice command...');
  };

  const handleEdit = (command: VoiceCommand) => {
    setEditingCommand(command);
    setFormData({
      device_name: command.device_name,
      part_number: command.part_number,
      pin: command.pin,
      address: command.address,
      device_bus: command.device_bus,
      object_name: command.object_name,
      description: command.description || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!mqttClient || !editingCommand) return;

    const selectedDevice = availableDevices.find(d => d.name === formData.device_name);

    // Generate automatic voice commands based on object name
    const objectName = formData.object_name.toLowerCase();
    const voiceCommandsArray = [
      `nyalakan ${objectName}`,
      `hidupkan ${objectName}`,
      `aktifkan ${objectName}`,
      `matikan ${objectName}`,
      `padamkan ${objectName}`,
      `nonaktifkan ${objectName}`,
      `turn on ${objectName}`,
      `turn off ${objectName}`,
      `enable ${objectName}`,
      `disable ${objectName}`
    ];

    // Send update to backend first
    const payload = {
      id: editingCommand.id,
      data: {
        device_name: formData.device_name,
        desc: formData.description,
        object_name: formData.object_name,
        voice_commands: voiceCommandsArray,
        pin: formData.pin,
        address: selectedDevice?.address || 0,
        bus: selectedDevice?.device_bus || 0,
        part_number: selectedDevice?.part_number || "RELAY",
      }
    };

    mqttClient.publish(AUTOMATION_VOICE_TOPICS.UPDATE, JSON.stringify(payload));

    // Close dialog and reset form immediately
    setEditDialogOpen(false);
    resetForm();

    // Show processing message
    toast.info('Updating voice command...');
  };

  const handleDelete = (command: VoiceCommand) => {
    setDeletingCommand(command);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!mqttClient || !deletingCommand) return;

    // Send delete to backend first
    const payload = {
      id: deletingCommand.id
    };

    mqttClient.publish(AUTOMATION_VOICE_TOPICS.DELETE, JSON.stringify(payload));

    // Close dialog immediately
    setDeleteDialogOpen(false);

    // Show processing message
    toast.info('Deleting voice command...');

    // Reset deleting command
    setDeletingCommand(null);
  };

  const handleStopVoice = () => {
    if (!mqttClient) return;

    // Optimistic update - immediately update UI
    setVoiceStatus(prev => ({ ...prev, is_active: false }));

    // Stop speech recognition if active
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (error) {
        console.error('Voice Control: Error stopping speech recognition:', error);
      }
    }

    // Stop listening if active
    setIsListening(false);
    setShowSpeechCard(false);
    setPartialSpeechText('');

    toast.info('Voice control stopped');
  };

  const handleTestCommand = () => {
    if (!mqttClient || !testCommand.trim()) {
      toast.error('Please enter a command to test');
      return;
    }

    // Send test command to voice command processor
    const payload = {
      text: testCommand.trim()
    };

    mqttClient.publish(VOICE_COMMAND_TOPICS.TEST, JSON.stringify(payload));
    toast.info('Testing voice command...');
  };

  const handleSendVoiceCommand = (voiceText: string) => {
    if (!mqttClient || !voiceText.trim()) return;

    // Send actual voice command to be processed
    const payload = {
      text: voiceText.trim()
    };

    mqttClient.publish(VOICE_COMMAND_TOPICS.INPUT, JSON.stringify(payload));
  };

  const handleStartVoice = async () => {
    if (!mqttClient) {
      toast.error('MQTT client not connected');
      return;
    }

    // Check if Web Speech API is supported
    if (!speechSupported) {
      toast.error('🎤 Speech recognition not supported in this browser');
      return;
    }

    // Optimistically set voice control to active immediately
    setVoiceStatus(prev => ({ ...prev, is_active: true }));

    // Start speech recognition directly
    try {
      if (recognition) {
        recognition.start();
        toast.success('🎤 Voice control started - listening for commands...');
      } else {
        throw new Error('Speech recognition not initialized');
      }
    } catch (error) {
      console.error('Voice Control: Failed to start speech recognition:', error);
      toast.error('🎤 Failed to start speech recognition');
      setVoiceStatus(prev => ({ ...prev, is_active: false }));
    }
  };

  const enterDemoMode = async () => {
    toast.warning('🎭 Microphone not available - entering demo mode');

    // Optimistic update - immediately update UI
    setVoiceStatus(prev => ({ ...prev, is_active: true }));

    // Show demo speech card
    setShowSpeechCard(true);
    setPartialSpeechText('Demo Mode - Voice Control Active');

    // Simulate some demo voice commands
    setTimeout(() => {
      setPartialSpeechText('Demo: "Turn on living room light"');
    }, 2000);

    setTimeout(() => {
      setPartialSpeechText('Demo: "Set temperature to 25 degrees"');
    }, 4000);

    setTimeout(() => {
      setPartialSpeechText('Demo: "Play music in bedroom"');
    }, 6000);

    // Auto-stop demo after 10 seconds
    setTimeout(() => {
      handleStopVoice();
    }, 10000);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'offline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1 h-8 w-8" />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Mic className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Voice Control</h1>
                <p className="text-xs text-muted-foreground">Manage voice-controlled devices</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MQTTConnectionBadge />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Voice Control Status - Clean Monochromatic Design */}
        <Card className="border-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  {voiceStatus.is_active ? (
                    <Volume2 className="h-6 w-6 text-primary animate-pulse" />
                  ) : (
                    <VolumeX className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl">Voice Control</CardTitle>
                  <p className="text-muted-foreground">Smart home automation with voice commands</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${voiceStatus.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">
                    {voiceStatus.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="default"
                    variant={voiceStatus.is_active ? "secondary" : "default"}
                    onClick={handleStartVoice}
                    disabled={voiceStatus.is_active}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Listening
                  </Button>
                  <Button
                    size="default"
                    variant="outline"
                    onClick={handleStopVoice}
                    disabled={!voiceStatus.is_active}
                    className="gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Live Voice Command Display */}
            <div className="hidden">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Live command will appear here when you speak..."
                      value={testCommand}
                      readOnly
                      className="h-11 text-base bg-background"
                    />
                    <Mic className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button
                    size="default"
                    onClick={() => {
                      handleSendVoiceCommand(testCommand);
                      setTestCommand("");
                    }}
                    disabled={!testCommand.trim() || !mqttClient}
                    className="px-6"
                  >
                    Send Command
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  Voice commands appear here automatically • Click Send to execute
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Speech Recognition Card */}
        {showSpeechCard && partialSpeechText && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 animate-in slide-in-from-bottom-2 duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 animate-pulse">
                  <Mic className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-blue-900">🎤 Listening...</h3>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-blue-800 leading-relaxed">
                    "{partialSpeechText}"
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Real-time speech recognition • Auto-hides in 3 seconds
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Last Voice Result - Clean Monochrome Design */}
        {lastVoiceResult && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mic className="h-5 w-5" />
                Voice Recognition Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recognized Text - Highlighted */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">Recognized Speech</span>
                </div>
                <p className="text-lg font-semibold leading-relaxed">
                  "{lastVoiceResult.recognized_text || lastVoiceResult.command_text || 'No text recognized'}"
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Action Detected</span>
                    <span className="text-sm">{lastVoiceResult.action || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Target Object</span>
                    <span className="text-sm">{lastVoiceResult.object_name || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Device Status</span>
                    <Badge variant={lastVoiceResult.device_found ? "default" : "secondary"}>
                      {lastVoiceResult.device_found ? 'Connected' : 'Not Found'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Device Name</span>
                    <span className="text-sm">{lastVoiceResult.device_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Pin Number</span>
                    <span className="text-sm">{lastVoiceResult.pin || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Execution Status</span>
                    <Badge variant={lastVoiceResult.success ? "default" : "destructive"}>
                      {lastVoiceResult.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {lastVoiceResult.error_message && (
                <Alert className="border-destructive/50 bg-destructive/5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">
                    {lastVoiceResult.error_message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Timestamp */}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Processed at</span>
                  <span className="font-mono">
                    {lastVoiceResult.timestamp
                      ? new Date(lastVoiceResult.timestamp).toLocaleString()
                      : 'Unknown time'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats Dashboard - Monochromatic Design */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Voice Commands</p>
                  <p className="text-3xl font-bold">{commands.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Configured commands</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Command className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Devices</p>
                  <p className="text-3xl font-bold">
                    {new Set(commands.map(cmd => cmd.device_name)).size}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Connected devices</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Available Devices</p>
                  <p className="text-3xl font-bold">{availableDevices.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Discovered devices</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Voice Status</p>
                  <p className="text-3xl font-bold">
                    {voiceStatus.is_active ? 'ON' : 'OFF'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {voiceStatus.is_active ? 'Listening active' : 'Voice control off'}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  {voiceStatus.is_active ? (
                    <Volume2 className="h-6 w-6 text-primary animate-pulse" />
                  ) : (
                    <VolumeX className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Voice Commands - Modern Card Layout */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Voice Commands</h2>
              <p className="text-muted-foreground">Manage your smart home voice-controlled devices</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestDialogOpen(true)}
                className="gap-2"
              >
                <TestTube className="h-4 w-4" />
                Test Command
              </Button>
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-5 w-5" />
                Add Command
              </Button>
            </div>
          </div>

          {commands.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
                  <Mic className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No Voice Commands Yet</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Get started by creating your first voice command to control your smart home devices.
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Create Your First Command
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {commands.map((command) => {
                const deviceKey = `${command.device_name}-${command.object_name}`;
                const isDeviceOn = deviceStatuses[deviceKey] || false;

                // Choose appropriate icon based on object name
                const getDeviceIcon = (objectName: string) => {
                  const name = objectName.toLowerCase();
                  if (name.includes('lampu') || name.includes('light')) return Lightbulb;
                  if (name.includes('kipas') || name.includes('fan')) return Fan;
                  if (name.includes('ac') || name.includes('pendingin')) return Settings;
                  return Home;
                };

                const DeviceIcon = getDeviceIcon(command.object_name);

                return (
                  <Card key={command.id} className="relative overflow-hidden hover:shadow-lg transition-all duration-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            isDeviceOn
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <DeviceIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{command.object_name}</h3>
                            <p className="text-sm text-muted-foreground">{command.device_name}</p>
                          </div>
                        </div>

                        <Badge variant={command.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                          {command.status || 'unknown'}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Voice Commands */}
                      <div>
                        <p className="text-sm font-medium mb-2">Voice Commands</p>
                        <div className="flex flex-wrap gap-1">
                          {(command.voice_commands || []).slice(0, 3).map((cmd, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              "{cmd}"
                            </Badge>
                          ))}
                          {(command.voice_commands || []).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{(command.voice_commands || []).length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Device Control */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${isDeviceOn ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                            <span className="text-sm font-medium text-muted-foreground">Pin {command.pin}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Status Badge */}
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                            isDeviceOn
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isDeviceOn ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            {isDeviceOn ? 'ON' : 'OFF'}
                          </div>

                          {/* Modern Toggle Switch */}
                          <button
                            type="button"
                            className={`relative inline-flex h-10 w-16 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 hover:shadow-lg ${
                              isDeviceOn
                                ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-green-500/25'
                                : 'bg-gradient-to-r from-gray-200 to-gray-300 shadow-gray-400/25'
                            }`}
                            onClick={() => {
                              // Toggle device status manually
                              setDeviceStatuses(prev => ({
                                ...prev,
                                [deviceKey]: !isDeviceOn
                              }));

                              // Send manual control command
                              if (mqttClient) {
                                const manualPayload = {
                                  text: isDeviceOn ? `matikan ${command.object_name}` : `nyalakan ${command.object_name}`
                                };
                                mqttClient.publish(VOICE_COMMAND_TOPICS.INPUT, JSON.stringify(manualPayload));
                              }
                            }}
                          >
                            {/* Toggle Knob */}
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center transform rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out ${
                                isDeviceOn ? 'translate-x-9' : 'translate-x-1'
                              }`}
                            >
                              {/* Icon inside knob */}
                              <div className={`transition-all duration-200 ${
                                isDeviceOn ? 'text-green-600 scale-110' : 'text-gray-400 scale-100'
                              }`}>
                                {isDeviceOn ? (
                                  <Power className="h-4 w-4" />
                                ) : (
                                  <Power className="h-4 w-4 opacity-50" />
                                )}
                              </div>
                            </span>

                            {/* Background glow effect */}
                            <div className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
                              isDeviceOn ? 'opacity-20 bg-green-400' : 'opacity-0'
                            }`}></div>
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(command)}
                          className="gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(command)}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditDialogOpen(false);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0 pb-4">
              <DialogTitle className="text-xl font-semibold">
                {editingCommand ? 'Edit Voice Command' : 'Create Voice Command'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingCommand
                  ? 'Modify the voice command configuration for your device.'
                  : 'Create a new voice command to control your smart home device.'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="space-y-6">
              <div>
                <Label htmlFor="device_name">Device</Label>
                <Select
                  value={formData.device_name}
                  onValueChange={(value) => {
                    const device = availableDevices.find(d => d.name === value);
                    setFormData(prev => ({
                      ...prev,
                      device_name: value,
                      part_number: device?.part_number || '',
                      address: device?.address || 0,
                      device_bus: device?.device_bus || 0,
                      mac: device?.mac || '',
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDevices.map((device) => (
                      <SelectItem key={device.name} value={device.name}>
                        {device.name} ({device.part_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-populated device information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="part_number">Part Number</Label>
                  <Input
                    id="part_number"
                    value={formData.part_number}
                    readOnly
                    className="bg-muted/50"
                    placeholder="Auto-populated"
                  />
                </div>
                <div>
                  <Label htmlFor="mac">MAC Address</Label>
                  <Input
                    id="mac"
                    value={formData.mac}
                    readOnly
                    className={`bg-muted/50 font-mono text-xs ${formData.mac !== '00:00:00:00:00:00' ? 'text-green-700 bg-green-50' : 'text-muted-foreground'}`}
                    placeholder="Auto-detected"
                  />
                  {formData.mac !== '00:00:00:00:00:00' && (
                    <p className="text-xs text-green-600 mt-1">✅ MAC address detected</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address.toString()}
                    readOnly
                    className="bg-muted/50"
                    placeholder="Auto-populated"
                  />
                </div>
                <div>
                  <Label htmlFor="device_bus">Device Bus</Label>
                  <Input
                    id="device_bus"
                    value={formData.device_bus.toString()}
                    readOnly
                    className="bg-muted/50"
                    placeholder="Auto-populated"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="object_name">Target Name *</Label>
                <Input
                  id="object_name"
                  value={formData.object_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, object_name: e.target.value }))}
                  placeholder="e.g., Living Room Light"
                />
              </div>

              <div className="hidden">
                <Label htmlFor="voice_commands">Voice Commands (Auto-generated)</Label>
                <div className="p-3 bg-muted/50 rounded-md border">
                  <p className="text-sm text-muted-foreground mb-2">Commands will be automatically generated based on the target name:</p>
                  <div className="text-xs font-mono bg-background p-2 rounded border">
                    {formData.object_name ? (
                      <div className="space-y-1">
                        <div>• nyalakan {formData.object_name.toLowerCase()}</div>
                        <div>• hidupkan {formData.object_name.toLowerCase()}</div>
                        <div>• aktifkan {formData.object_name.toLowerCase()}</div>
                        <div>• matikan {formData.object_name.toLowerCase()}</div>
                        <div>• padamkan {formData.object_name.toLowerCase()}</div>
                        <div>• nonaktifkan {formData.object_name.toLowerCase()}</div>
                        <div>• turn on {formData.object_name.toLowerCase()}</div>
                        <div>• turn off {formData.object_name.toLowerCase()}</div>
                        <div>• enable {formData.object_name.toLowerCase()}</div>
                        <div>• disable {formData.object_name.toLowerCase()}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Enter a target name to see auto-generated commands</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="pin">Pin Number</Label>
                <Select
                  value={formData.pin.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, pin: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const selectedDevice = availableDevices.find(d => d.name === formData.device_name);
                      const maxPins = selectedDevice?.part_number === 'RELAYMINI' ? 6 : 8;
                      return Array.from({ length: maxPins }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          Pin {i + 1}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {(() => {
                    const selectedDevice = availableDevices.find(d => d.name === formData.device_name);
                    return selectedDevice?.part_number === 'RELAYMINI'
                      ? 'RELAYMINI supports 6 pins (1-6)'
                      : 'RELAY supports 8 pins (1-8)';
                  })()}
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
            </div>

            </div>

            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button variant="outline" onClick={() => {
                setCreateDialogOpen(false);
                setEditDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={editingCommand ? handleUpdate : handleCreate}>
                {editingCommand ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Voice Command</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Are you sure you want to delete the voice command for "{deletingCommand?.object_name}"?
                  This action cannot be undone.
                </AlertDescription>
              </Alert>

              {deletingCommand && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm">
                    <strong>Device:</strong> {deletingCommand.device_name}<br />
                    <strong>Commands:</strong> {deletingCommand.voice_commands.join(', ')}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Voice Command Dialog */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Voice Command</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="test_command">Voice Command</Label>
                <Input
                  id="test_command"
                  value={testCommand}
                  onChange={(e) => setTestCommand(e.target.value)}
                  placeholder="Enter voice command to test"
                />
              </div>

              {testResult && (
                <Alert className={testResult.success ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <AlertDescription className={testResult.success ? "text-green-800" : "text-yellow-800"}>
                    {testResult.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setTestDialogOpen(false);
                setTestCommand("");
                setTestResult(null);
              }}>
                Close
              </Button>
              <Button onClick={handleTestCommand}>
                Test Command
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}
