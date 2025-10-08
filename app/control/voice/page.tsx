"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { connectMQTT } from "@/lib/mqttClient";
import { MqttClient } from "mqtt";
import { toast } from "sonner";
import { showToast } from "@/lib/toast-utils";
import {
  ConfirmationDialog,
  useConfirmationDialog,
} from "@/components/ui/confirmation-dialog";

// UI Components
import {
  RotateCw,
  Mic,
  PlusCircle,
  Trash2,
  Edit2,
  Volume2,
  Settings,
  Activity,
  Search,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import MqttStatus from "@/components/mqtt-status";

// Type definitions
interface VoiceControl {
  id: string;
  description: string;
  rule_name: string;
  device_name: string;
  part_number: string;
  pin: number;
  address: number;
  device_bus: number;
  mac: string;
  created_at: string;
  updated_at: string;
}

interface ModularDevice {
  id: string;
  name: string;
  address: number;
  device_bus: number;
  part_number: string;
  mac: string;
  manufacturer: string;
  device_type: string;
  topic: string;
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const ITEMS_PER_PAGE = 10;

const VoiceControlPage = () => {
  // MQTT Connection
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isConnected, setIsConnected] = useState(false);

  // Data States
  const [voiceControlData, setVoiceControlData] = useState<VoiceControl[]>([]);
  const [modularDevices, setModularDevices] = useState<ModularDevice[]>([]);
  const [filteredRelayDevices, setFilteredRelayDevices] = useState<ModularDevice[]>([]);

  // Voice Recognition State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedControl, setSelectedControl] = useState<string | null>(null);

  // Voice Control Form State
  const initialVoiceControl: VoiceControl = {
    id: "",
    description: "",
    rule_name: "",
    device_name: "",
    part_number: "",
    pin: 1,
    address: 0,
    device_bus: 0,
    mac: "",
    created_at: "",
    updated_at: "",
  };
  const [voiceControl, setVoiceControl] =
    useState<VoiceControl>(initialVoiceControl);

  // MQTT Topics - Simplified configuration
  const topicVoiceControlCommand = "command_control_voice";
  const topicVoiceControlResponse = "response_control_voice";
  const topicVoiceControlData = "voice_control/data";
  const topicModularAvailables = "MODULAR_DEVICE/AVAILABLES";
  const topicCommandAvailableDevice = "command_available_device";

  // Response handler for simplified topics
  const [responseData, setResponseData] = useState<any>(null);

  const formRef = useRef<HTMLFormElement>(null);

  // Confirmation Dialog
  const { confirmationProps, showConfirmation } = useConfirmationDialog();

  // Modal Functions
  const openModal = (item?: VoiceControl) => {
    if (item) {
      setIsEditing(true);
      setSelectedControl(item.id);
      setVoiceControl({ ...item });
    } else {
      setIsEditing(false);
      setSelectedControl(null);
      setVoiceControl({ ...initialVoiceControl, id: uuidv4() });
    }
    setIsModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setIsEditing(false);
    setSelectedControl(null);
    setVoiceControl({ ...initialVoiceControl });
  }, []);

  // Initialize MQTT Connection
  useEffect(() => {
    const initMQTT = async () => {
      try {
        const client = connectMQTT();
        setMqttClient(client);

        client.on("connect", () => {
          setConnectionStatus("connected");
          setIsConnected(true);
          console.log("MQTT: Voice Control - Connected");

          // Subscribe to topics
          client.subscribe([
            topicVoiceControlData,
            topicModularAvailables,
            topicVoiceControlResponse,
          ], (err) => {
            if (err) {
              console.error("Failed to subscribe to topics:", err);
            } else {
              console.log("Subscribed to voice control topics successfully");
            }
          });

          // Request modular devices data
          setTimeout(() => {
            client.publish(topicCommandAvailableDevice, "get_modular_devices");
            console.log("Requesting modular devices data...");
          }, 1000);
        });

        client.on("disconnect", () => {
          setConnectionStatus("disconnected");
          setIsConnected(false);
          console.log("MQTT: Voice Control - Disconnected");
        });

        client.on("error", (error) => {
          console.error("MQTT Error:", error);
          setConnectionStatus("error");
          setIsConnected(false);
        });
      } catch (error) {
        console.error("Failed to initialize MQTT:", error);
        setConnectionStatus("error");
      }
    };

    initMQTT();

    return () => {
      // Cleanup on unmount
      if (mqttClient) {
        mqttClient.removeAllListeners();
      }
    };
  }, []);

  // Publish Message Function
  const publishMessage = useCallback(
    (message: any, topic: string) => {
      if (mqttClient && isConnected) {
        mqttClient.publish(topic, JSON.stringify(message), (err) => {
          if (err) {
            console.error("Failed to publish message:", err);
            showToast.error("MQTT Error", "Failed to send command.");
          }
        });
      } else {
        showToast.error(
          "MQTT Disconnected",
          "Cannot send command, MQTT client is not connected."
        );
      }
    },
    [mqttClient, isConnected]
  );

  // Refresh Function - Use get action for simplified topics
  const refreshVoiceControlData = useCallback(() => {
    publishMessage({ action: "get" }, topicVoiceControlCommand);
    // Removed toast to avoid spam on automatic refreshes
  }, [publishMessage, topicVoiceControlCommand]);

  // Message Handlers
  useEffect(() => {
    if (!mqttClient || !isConnected) return;

    // Handler untuk data voice control
    const handleVoiceControlData = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        setVoiceControlData(payload || []);
        console.log("MQTT: Data voice control diterima:", payload);
      } catch (error) {
        console.error("MQTT: Gagal memproses data voice control", error);
        showToast.error(
          "Parsing Error",
          "An error occurred while processing voice control data."
        );
      }
    };

    // Handler untuk data modular devices
    const handleModularData = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log("MQTT: Raw modular data received:", payload);

        // Handle both wrapped and direct array formats
        if (payload.status === "success" && payload.data) {
          console.log("MQTT: Modular devices (wrapped format):", payload.data.length, payload.data);
          setModularDevices(payload.data);
        } else if (Array.isArray(payload)) {
          console.log("MQTT: Modular devices (direct array):", payload.length, payload);
          setModularDevices(payload);
        } else {
          console.log("MQTT: Invalid modular data format:", payload);
          setModularDevices([]);
        }
      } catch (error) {
        console.error("MQTT: Failed to parse modular devices data", error);
        console.error("MQTT: Raw message:", message.toString());
        showToast.error(
          "Parsing Error",
          "An error occurred while processing modular device data."
        );
      }
    };

    // Handler untuk response dari simplified topics
    const handleVoiceControlResponse = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log("MQTT: Response diterima:", payload);

        if (payload.status === "success") {
          // Only show toast for user-initiated operations, not automatic refreshes
          const isUserAction = payload.message && (
            payload.message.includes("created") ||
            payload.message.includes("updated") ||
            payload.message.includes("deleted")
          );

          if (isUserAction) {
            showToast.success("Success", payload.message);
          }

          // Auto close dialog on success
          closeModal();

          // Refresh data setelah operasi berhasil - but only if this was a user action
          if (isUserAction) {
            setTimeout(() => {
              refreshVoiceControlData();
            }, 500);
          }
        } else {
          showToast.error("Error", payload.message || "An error occurred");
        }
      } catch (error) {
        console.error("MQTT: Gagal memproses response", error);
      }
    };

    // Set up message handlers
    mqttClient.on("message", (topic: string, message: Buffer) => {
      if (topic === topicVoiceControlData) {
        handleVoiceControlData(topic, message);
      } else if (topic === topicModularAvailables) {
        handleModularData(topic, message);
      } else if (topic === topicVoiceControlResponse) {
        handleVoiceControlResponse(topic, message);
      }
    });

    // Request initial data
    console.log("MQTT: Meminta data awal setelah koneksi berhasil.");
    publishMessage({ action: "get" }, topicVoiceControlCommand);

    return () => {
      // Cleanup message handlers
      if (mqttClient) {
        mqttClient.removeAllListeners("message");
      }
    };
  }, [
    mqttClient,
    isConnected,
    publishMessage,
    topicVoiceControlData,
    topicModularAvailables,
    topicVoiceControlCommand,
    topicVoiceControlResponse,
    closeModal,
  ]);

  // Save Function
  const saveVoiceControl = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!voiceControl.rule_name || !voiceControl.device_name) {
      showToast.error(
        "Validation Error",
        "Please fill in Rule Name and Device Name."
      );
      return;
    }

    // Use simplified topic with action in payload
    const action = isEditing ? "set" : "add";
    const message = {
      action: action,
      data: voiceControl,
    };

    publishMessage(message, topicVoiceControlCommand);

    // Don't close modal immediately, wait for response
  };

  // Delete Function
  const deleteVoiceControl = (uuid: string) => {
    showConfirmation({
      type: "delete",
      title: "Delete Voice Control",
      description:
        "Are you sure you want to delete this voice control? This action cannot be undone.",
      confirmText: "Yes, delete it",
      cancelText: "Cancel",
      destructive: true,
      onConfirm: () => {
        // Use simplified topic with action in payload
        const message = {
          action: "delete",
          data: { id: uuid, uuid: uuid },
        };

        publishMessage(message, topicVoiceControlCommand);
      },
    });
  };

  // Filter devices - only RELAYMINI and RELAY
  useEffect(() => {
    const relayDevices = modularDevices.filter((device) => {
      // Validate device structure
      if (!device || !device.part_number) return false;

      const partNumber = device.part_number;
      return partNumber === "RELAYMINI" || partNumber === "RELAY";
    });
    setFilteredRelayDevices(relayDevices);
    console.log("Filtered relay devices:", relayDevices.length, relayDevices);
  }, [modularDevices]);

  // Get max pins based on part_number
  const getMaxPins = (deviceName: string): number => {
    const device = filteredRelayDevices.find((d) => d?.name === deviceName);
    const partNumber = device?.part_number || "";

    if (partNumber === "RELAYMINI") return 6;
    if (partNumber === "RELAY") return 8;
    return 8; // default
  };

  // Device Selection Handler
  const handleDeviceSelection = (deviceName: string) => {
    const selectedDevice = filteredRelayDevices.find(
      (d) => d?.name === deviceName
    );
    setVoiceControl((prev) => ({
      ...prev,
      device_name: deviceName,
      part_number: selectedDevice?.part_number || "",
      address: selectedDevice?.address || 0,
      device_bus: selectedDevice?.device_bus || 0,
      mac: selectedDevice?.mac || "",
    }));
  };

  // Process Voice Command
  const processVoiceCommand = useCallback((command: string) => {
    const lowerCommand = command.toLowerCase();

    // Detect action (nyalakan = ON, matikan = OFF)
    let action: 1 | 0 = 1;
    let objectName = "";

    if (lowerCommand.includes("nyalakan") || lowerCommand.includes("hidupkan")) {
      action = 1;
      objectName = lowerCommand.replace(/nyalakan|hidupkan/gi, "").trim();
    } else if (lowerCommand.includes("matikan") || lowerCommand.includes("mati")) {
      action = 0;
      objectName = lowerCommand.replace(/matikan|mati/gi, "").trim();
    } else {
      showToast.warning(
        "Command Not Recognized",
        'Please use "turn on" or "turn off" commands'
      );
      return;
    }

    // Find matching voice control by rule_name
    const matchedControl = voiceControlData.find((ctrl) => {
      const ctrlRuleName = ctrl.rule_name.toLowerCase();
      return ctrlRuleName.includes(objectName) || objectName.includes(ctrlRuleName);
    });

    if (!matchedControl) {
      showToast.warning(
        "Device Not Found",
        `No voice control found for "${objectName}"`
      );
      return;
    }

    // Build MQTT payload directly from matchedControl
    const payload = {
      mac: matchedControl.mac || "00:00:00:00:00:00",
      protocol_type: "Modular",
      device: matchedControl.part_number || "RELAYMINI",
      function: "write",
      value: {
        pin: matchedControl.pin,
        data: action,
      },
      address: matchedControl.address,
      device_bus: matchedControl.device_bus,
      Timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    // Publish to MQTT
    if (mqttClient && isConnected) {
      mqttClient.publish("modular", JSON.stringify(payload), (err) => {
        if (err) {
          console.error("Failed to publish voice command:", err);
          showToast.error("Control Failed", "Failed to send command to device");
        } else {
          showToast.success(
            "Command Sent",
            `${action === 1 ? "Turning ON" : "Turning OFF"} ${matchedControl.rule_name}`
          );
        }
      });
    } else {
      showToast.error(
        "MQTT Disconnected",
        "Cannot send command, MQTT is not connected"
      );
    }
  }, [voiceControlData, mqttClient, isConnected]);

  // Voice Recognition Setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "id-ID"; // Indonesian language

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setTranscript(transcript);
          processVoiceCommand(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          showToast.error("Voice Recognition Error", `Error: ${event.error}`);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        console.warn("Speech Recognition not supported");
      }
    }
  }, [processVoiceCommand]);


  // Toggle Voice Recognition
  const toggleVoiceRecognition = () => {
    if (!recognitionRef.current) {
      showToast.error(
        "Not Supported",
        "Speech recognition is not supported in this browser"
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Search and Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const filteredData = useMemo(() => {
    if (!searchQuery) {
      return voiceControlData;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return voiceControlData.filter(
      (item) =>
        item.rule_name.toLowerCase().includes(lowerCaseQuery) ||
        item.device_name.toLowerCase().includes(lowerCaseQuery)
    );
  }, [voiceControlData, searchQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Calculate summary data
  const totalVoiceControls = voiceControlData.length;
  const availableDevices = modularDevices.length;
  const usedPins = voiceControlData.length;
  const uniqueDevices = new Set(voiceControlData.map((v) => v.device_name))
    .size;

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Mic className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Voice Control</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />

          {/* Voice Control Button */}
          <Button
            variant={isListening ? "destructive" : "default"}
            size="sm"
            onClick={toggleVoiceRecognition}
            className={isListening ? "animate-pulse" : ""}
          >
            <Mic className={`h-4 w-4 mr-2 ${isListening ? "animate-bounce" : ""}`} />
            {isListening ? "Listening..." : "Voice Control"}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={refreshVoiceControlData}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => openModal()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Voice Control
          </Button>
        </div>
      </header>

      {/* Search and Voice Status */}
      <div className="px-4 py-2 border-b space-y-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search voice controls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Voice Transcript Display */}
        {transcript && (
          <div className="p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Last Command:</strong> {transcript}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Summary Cards - Consistent Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Voice Commands Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Voice Commands</CardTitle>
              <Mic className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalVoiceControls}</div>
              <p className="text-xs text-muted-foreground">
                Total configured commands
              </p>
            </CardContent>
          </Card>

          {/* Devices Used Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Devices Used</CardTitle>
              <Activity className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueDevices}</div>
              <p className="text-xs text-muted-foreground">
                Unique devices in use
              </p>
            </CardContent>
          </Card>

          {/* Available Devices Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Devices</CardTitle>
              <Settings className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableDevices}</div>
              <p className="text-xs text-muted-foreground">
                Connected relay devices
              </p>
            </CardContent>
          </Card>

          {/* Active Pins Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Pins</CardTitle>
              <PlusCircle className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usedPins}</div>
              <p className="text-xs text-muted-foreground">
                Pins in configuration
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Voice Controls Table */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Voice Controls</CardTitle>
            <CardDescription>
              Manage your voice command configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredData.length === 0 ? (
              <div className="text-center py-12">
                <Mic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">
                  No voice controls found
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first voice control command to get started
                </p>
                <Button onClick={() => openModal()}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Voice Control
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voice Command</TableHead>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Pin</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Bus</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.rule_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.device_name}</Badge>
                      </TableCell>
                      <TableCell>{item.pin}</TableCell>
                      <TableCell>{item.address}</TableCell>
                      <TableCell>{item.device_bus}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openModal(item)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteVoiceControl(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  {Math.min(
                    (currentPage - 1) * ITEMS_PER_PAGE + 1,
                    filteredData.length
                  )}{" "}
                  to{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}{" "}
                  of {filteredData.length} results
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice Control Dialog */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Mic className="h-5 w-5" />
                <span>
                  {isEditing ? "Edit Voice Control" : "Add New Voice Control"}
                </span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={saveVoiceControl} className="space-y-6">
              {/* Voice Command Settings */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Volume2 className="h-4 w-4" />
                  <h3 className="text-sm font-medium">
                    Voice Command Settings
                  </h3>
                </div>
                <div>
                  <Label htmlFor="rule_name">Rule Name (Voice Command) *</Label>
                  <Input
                    id="rule_name"
                    value={voiceControl.rule_name}
                    onChange={(e) =>
                      setVoiceControl((prev) => ({
                        ...prev,
                        rule_name: e.target.value,
                      }))
                    }
                    placeholder="e.g., main room light"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This phrase will be recognized after "turn on" or "turn off"
                  </p>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={voiceControl.description}
                    onChange={(e) =>
                      setVoiceControl((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="e.g., Turn on main meeting room light"
                  />
                </div>
              </div>

              {/* Device Configuration */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Device Configuration</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="device_name">Device Name *</Label>
                    <Select
                      value={voiceControl.device_name}
                      onValueChange={handleDeviceSelection}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredRelayDevices.map((device) => {
                          const deviceName = device?.name || "Unknown";
                          const partNumber = device?.part_number || "N/A";
                          return (
                            <SelectItem
                              key={device.id || deviceName}
                              value={deviceName}
                            >
                              {deviceName} ({partNumber})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pin">Pin *</Label>
                    <Select
                      value={voiceControl.pin.toString()}
                      onValueChange={(value) =>
                        setVoiceControl((prev) => ({
                          ...prev,
                          pin: parseInt(value),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pin" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: getMaxPins(voiceControl.device_name) }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            Pin {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      type="number"
                      value={voiceControl.address.toString()}
                      placeholder="Auto-filled"
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Address is automatically filled from device selection
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="device_bus">Device Bus</Label>
                    <Input
                      id="device_bus"
                      type="number"
                      value={voiceControl.device_bus.toString()}
                      placeholder="Auto-filled"
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Bus is automatically filled from device selection
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? "Update" : "Create"} Voice Control
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <ConfirmationDialog {...confirmationProps} />
      </div>
    </SidebarInset>
  );
};

export default VoiceControlPage;
