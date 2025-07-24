// app/mqtt-dashboard/page.tsx
"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { toast } from "sonner"; // Assuming you have 'sonner' for toasts
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button"; // Assuming Shadcn UI buttons
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"; // Assuming Shadcn UI dialogs
import { Input } from "@/components/ui/input"; // Assuming Shadcn UI inputs
import { Label } from "@/components/ui/label"; // Assuming Shadcn UI labels
import { Mic, Edit2, Trash2, Wifi, ArrowUpDown } from "lucide-react"; // Icons from lucide-react
import MqttStatus from "@/components/mqtt-status"; // Your custom MQTT status component
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"; // Shadcn UI table
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"; // Shadcn UI select
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination"; // Shadcn UI pagination

// Import MQTT client utility functions
import { connectMQTT, getMQTTClient, disconnectMQTT } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt"; // Import type from 'mqtt' library


// --- INTERFACE DEFINITIONS ---

// Struktur untuk data broker MQTT
interface MqttBrokerInfo {
  broker_address: string;
  broker_port: number;
  username?: string;
  password?: string;
  mac_address: string;
}

// Struktur untuk data Modular Device (dari modular_value/data)
interface ModularDeviceProfile {
  profile: { name: string; device_bus: number; address: number; };
  data?: any[];
  protocol_setting: {
    address: number;
    device_bus: number;
  };
}

// STRUKTUR BARU UNTUK VOICE CONTROL VALUE (tanpa target_logic dan confirm_message)
interface VoiceControlValue {
  uuid: string;
  device_name: string; // Nama perangkat target (Relay_1, Lampu Depan, dll.)
  data: {
    pin: number;
    custom_name: string; // Frasa perintah suara (e.g., "Lampu", "Kipas", "Lampu Ruang Tamu")
    address: number;
    bus: number;
  };
}

// --- GLOBAL DECLARATIONS for Web Speech API ---
declare global {
  interface SpeechRecognitionErrorCode {
    readonly ABORT: 'aborted';
    readonly AUDIO_CAPTURE: 'audio-capture';
    readonly NETWORK: 'network';
    readonly NOT_ALLOWED: 'not-allowed';
    readonly NO_SPEECH: 'no-speech';
    readonly SERVICE_NOT_ALLOWED: 'service-not-allowed';
    readonly BAD_GRAMMAR: 'bad-grammar';
    readonly LANGUAGE_NOT_SUPPORTED: 'language-not-supported';
  }

  interface SpeechRecognition extends EventTarget {
    grammars: SpeechGrammarList;
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    serviceURI: string;

    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  
    abort(): void;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: SpeechRecognitionErrorCode | string;
    readonly message: string;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
    readonly resultIndex: number;
  }

  interface SpeechGrammar {
    src: string;
    weight: number;
  }

  interface SpeechGrammarList {
    readonly length: number;
    addFromString(string: string, weight?: number): void;
    addFromURI(src: string, weight?: number): void;
    item(index: number): SpeechGrammar;
    [index: number]: SpeechGrammar;
  }

  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
      prototype: SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
      prototype: SpeechRecognition;
    };
  }
}

const ITEMS_PER_PAGE = 10;

export default function MqttDashboardPage() {
  // --- STATE MANAGEMENT ---
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [mqttBrokerData, setMqttBrokerData] = useState<MqttBrokerInfo | null>(null);
  const [parsedModularData, setParsedModularData] = useState<ModularDeviceProfile[]>([]);
  const [voiceControlList, setVoiceControlList] = useState<VoiceControlValue[]>([]);

  // Form states for Voice Control CRUD
  const [showCrudModal, setShowCrudModal] = useState(false);
  const [form, setForm] = useState<VoiceControlValue | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Speech Recognition states
  const [showSpeechModal, setShowSpeechModal] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  // voiceCommandResult sekarang hanya akan menyimpan command yang cocok,
  // logika ON/OFF ditentukan saat runtime
  const [voiceCommandResult, setVoiceCommandResult] = useState<VoiceControlValue | null>(null);
  const [isListening, setIsListening] = useState(false);

  const mqttClientInstanceRef = useRef<MqttClient | null>(null);

  // --- MQTT CONNECTION & SUBSCRIPTIONS ---
  useEffect(() => {
    mqttClientInstanceRef.current = connectMQTT();
    const client = mqttClientInstanceRef.current;

    const handleConnect = () => {
      setMqttConnectionStatus("connected");
      console.log("MQTT Client connected!");
      client?.subscribe("modular_value/data", { qos: 1 });
      client?.subscribe("mqtt_broker_server", { qos: 1 });
      client?.subscribe("voice_control/data", { qos: 1 });
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setMqttConnectionStatus("error");
      toast.error(`MQTT connection error: ${err.message}`);
    };

    const handleClose = () => {
      setMqttConnectionStatus("disconnected");
      console.log("MQTT Client disconnected!");
    };

    const handleMessage = (topic: string, messageBuf: Buffer) => {
      try {
        const msg = JSON.parse(messageBuf.toString());
        if (topic === "modular_value/data") {
          setParsedModularData(msg);
        } else if (topic === "mqtt_broker_server") {
          setMqttBrokerData(msg);
        } else if (topic === "voice_control/data") {
          setVoiceControlList(msg);
        }
      } catch (e) {
        console.error("Failed to parse MQTT message:", e, "Topic:", topic);
        toast.error(`Failed to parse message from ${topic}`);
      }
    };

    client.on("connect", handleConnect);
    client.on("error", handleError);
    client.on("close", handleClose);
    client.on("message", handleMessage);

    if (client.connected) {
      setMqttConnectionStatus("connected");
      client?.subscribe("modular_value/data", { qos: 1 });
      client?.subscribe("mqtt_broker_server", { qos: 1 });
      client?.subscribe("voice_control/data", { qos: 1 });
    }

    return () => {
      client.off("connect", handleConnect);
      client.off("error", handleError);
      client.off("close", handleClose);
      client.off("message", handleMessage);
      if (client.connected) {
         client.unsubscribe("modular_value/data");
         client.unsubscribe("mqtt_broker_server");
         client.unsubscribe("voice_control/data");
      }
    };
  }, []);

  // --- FORM & CRUD LOGIC (Voice Control) ---

  const resetForm = useCallback(() => {
    setForm({
      uuid: '',
      device_name: '',
      data: {
        pin: 0,
        custom_name: '',
        address: 0,
        bus: 0,
      },
      // target_logic tidak lagi ada di form
    });
    setIsEditing(false);
  }, []);

  const openCrudModal = useCallback((item?: VoiceControlValue) => {
    if (item) {
      setForm({ ...item });
      setIsEditing(true);
    } else {
      resetForm();
    }
    setShowCrudModal(true);
  }, [resetForm]);

  const onDeviceSelected = useCallback((deviceName: string) => {
    const selectedDevice = parsedModularData.find(device => device.profile.name === deviceName);
    setForm(prevForm => {
      if (!prevForm) return null;
      return {
        ...prevForm,
        device_name: deviceName,
        data: {
          ...prevForm.data,
          address: selectedDevice?.protocol_setting.address || 0,
          bus: selectedDevice?.protocol_setting.device_bus || 0,
        },
      };
    });
  }, [parsedModularData]);

  const saveVoiceControl = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.data.custom_name || !form.device_name || !form.data.pin) {
      toast.error("Please fill all required fields.");
      return;
    }

    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Please check connection.");
      return;
    }

    // Payload disesuaikan tanpa target_logic
    const payloadToSend: VoiceControlValue = {
      uuid: form.uuid || crypto.randomUUID(),
      device_name: form.device_name,
      data: {
        pin: form.data.pin,
        custom_name: form.data.custom_name,
        address: form.data.address,
        bus: form.data.bus,
      },
    };

    const topic = isEditing ? "voice_control/update" : "voice_control/create";

    client.publish(topic, JSON.stringify(payloadToSend), { qos: 1 }, (err) => {
      if (err) {
        toast.error(`Failed to publish voice control: ${err.message}`);
        console.error("Publish voice control error:", err);
      } else {
        toast.success(isEditing ? "Voice Command Updated" : "New Voice Command Created");
        setShowCrudModal(false);
        resetForm();
      }
    });
  }, [form, isEditing, resetForm]);

  const deleteVoiceControl = useCallback((uuid: string) => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Please check connection.");
      return;
    }

    const msg = JSON.stringify({ uuid });
    client.publish("voice_control/delete", msg, { qos: 1 }, (err) => {
      if (err) {
        toast.error(`Failed to delete voice command: ${err.message}`);
        console.error("Delete voice command publish error:", err);
      } else {
        toast.success("Voice Command Deleted");
      }
    });
  }, []);

  // --- SPEECH RECOGNITION LOGIC ---
  const startSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') {
      console.warn("Speech Recognition API is only available in a browser environment.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Speech Recognition API is not supported in this browser.');
      console.error('Speech Recognition API is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;

    setIsListening(true);
    setSpokenText("");
    setVoiceCommandResult(null);
    setShowSpeechModal(true); // Open the speech modal

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setSpokenText(transcript);
      console.log(`Speech recognized: ${transcript}`);
      findVoiceControlDevice(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event);
      toast.error(`Speech recognition error: ${event.error} - ${event.message}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, []);

  const findVoiceControlDevice = useCallback((text: string) => {
    const lowerCaseText = text.toLowerCase();
    let action: 0 | 1 | null = null; // Default null, akan ditentukan

    // Tentukan aksi berdasarkan kata kunci "nyalakan" atau "matikan"
    if (lowerCaseText.startsWith("nyalakan ")) {
      action = 1; // ON
    } else if (lowerCaseText.startsWith("matikan ")) {
      action = 0; // OFF
    } else {
      toast.info('Please use "nyalakan [device]" or "matikan [device]".');
      setVoiceCommandResult(null);
      return;
    }

    // Ambil bagian nama perangkat dari kalimat yang diucapkan
    const devicePhrase = lowerCaseText.replace(/(nyalakan|matikan)\s*/, '').trim();
    if (!devicePhrase) {
        toast.info('Please specify a device name after "nyalakan" or "matikan".');
        setVoiceCommandResult(null);
        return;
    }

    // Cari perintah yang custom_name-nya cocok dengan devicePhrase
    const foundCommand = voiceControlList.find(
      (command) => command.data.custom_name.toLowerCase() === devicePhrase
    );

    if (foundCommand && action !== null) {
      setVoiceCommandResult(foundCommand); // Tampilkan seluruh command yang ditemukan di modal
      publishRelayCommand(foundCommand, action);
    } else {
      setVoiceCommandResult(null);
      console.log('Voice command device not found for:', devicePhrase);
      toast.error(`Device command "${devicePhrase}" not found.`);
    }
  }, [voiceControlList]);

  // publishRelayCommand kini menerima `action` (0 atau 1) langsung
  const publishRelayCommand = useCallback((command: VoiceControlValue, action: 0 | 1) => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.error("MQTT client not connected. Cannot send command.");
      console.error("MQTT client not available or connected. Cannot send command.");
      return;
    }
    if (!mqttBrokerData) {
      toast.error("MQTT Broker information not available. Cannot send command.");
      console.error("MQTT Broker data is null. Cannot send command.");
      return;
    }

    const relayPayload = {
      mac: mqttBrokerData.mac_address,
      protocol_type: "Modular",
      device: "RELAYMINI",
      function: "write",
      value: {
        pin: command.data.pin,
        data: action, // Gunakan action (0 atau 1) yang ditentukan saat runtime
      },
      address: command.data.address,
      device_bus: command.data.bus,
      Timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    };

    console.log("Publishing relay command:", relayPayload);
    client.publish("modular", JSON.stringify(relayPayload), { qos: 1 }, (err) => {
      if (err) {
        toast.error(`Failed to send relay command: ${err.message}`);
        console.error("Relay command publish error:", err);
      } else {
        toast.success(`Command for "${command.data.custom_name}" (${action === 1 ? 'ON' : 'OFF'}) sent successfully.`);
        console.log("Relay command published successfully.");
      }
    });
  }, [mqttBrokerData]);


  // --- TABLE LOGIC (Search, Sort, Pagination) ---
  const [searchQuery, setSearchQuery] = useState("");
  const filteredData = useMemo(() => {
    if (!searchQuery) {
      return voiceControlList;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return voiceControlList.filter(item =>
      item.data.custom_name.toLowerCase().includes(lowerCaseQuery) ||
      item.device_name.toLowerCase().includes(lowerCaseQuery)
    );
  }, [voiceControlList, searchQuery]);

  const [sortField, setSortField] = useState<keyof VoiceControlValue | string>('data.custom_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: keyof VoiceControlValue | string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedVoiceControl = useMemo(() => {
    if (!sortField) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Only sortable fields are data.custom_name and device_name directly
      if (sortField === 'data.custom_name') {
        aValue = a.data.custom_name;
        bValue = b.data.custom_name;
      } else if (sortField === 'device_name') {
        aValue = a.device_name;
        bValue = b.device_name;
      } else {
        // Fallback for other direct properties if any (though there are none now)
        aValue = (a as any)[sortField];
        bValue = (b as any)[sortField];
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(sortedVoiceControl.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedVoiceControl.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedVoiceControl, currentPage]);

  const getStatusClass = useMemo(() => {
    if (mqttConnectionStatus === 'connected') return 'text-green-600 font-semibold';
    if (mqttConnectionStatus === 'disconnected') return 'text-red-600 font-semibold';
    if (mqttConnectionStatus === 'error') return 'text-yellow-600 font-semibold';
    return '';
  }, [mqttConnectionStatus]);

  // --- RENDER UI ---
  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <Wifi className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">MQTT Dashboard & Voice Control</h1>
        </div>
        <MqttStatus />
      </header>
      <div className="p-6 space-y-6">
        {/* MQTT Broker Server Info */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h5 className="text-xl font-semibold">MQTT Broker Server Info</h5>
            <span className={`text-sm ${getStatusClass}`}>
              {mqttConnectionStatus === 'connected' ? 'Connected' : mqttConnectionStatus === 'disconnected' ? 'Disconnected' : 'Error'}
            </span>
          </div>

          {mqttBrokerData ? (
            <div className="bg-card text-card-foreground rounded-lg shadow-sm p-4 border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="col-span-2"><span className="font-medium">MAC:</span> {mqttBrokerData.mac_address}</div>
                <div><span className="font-medium">Broker Address:</span> {mqttBrokerData.broker_address}</div>
                <div><span className="font-medium">Broker Port:</span> {mqttBrokerData.broker_port}</div>
                <div><span className="font-medium">Broker Username:</span> {mqttBrokerData.username || '-'}</div>
                <div><span className="font-medium">Broker Password:</span> {mqttBrokerData.password ? '********' : '-'}</div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No broker server data received yet.</p>
          )}
        </div>

        <hr className="my-6 border-t border-muted" />

        {/* Voice Command Control & Add/Edit Section */}
        <div className="flex justify-between items-center mb-3">
          <h5 className="text-xl font-semibold">Voice Control Devices</h5>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openCrudModal()}>+ Add Voice Control</Button>
            <Button size="sm" onClick={startSpeechRecognition}>
              <Mic className="w-4 h-4 mr-2" /> Start Voice Command
            </Button>
          </div>
        </div>

        {/* Voice Command Recognition Modal */}
        <Dialog open={showSpeechModal} onOpenChange={setShowSpeechModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Voice Recognition Control</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-center">
              {isListening && (
                <p className="mt-3 text-muted-foreground animate-pulse flex items-center justify-center">
                  <Mic className="w-5 h-5 mr-2" /> Listening...
                </p>
              )}
              {spokenText && <p className="mt-3 text-lg">You said: <strong>{spokenText}</strong></p>}
              {voiceCommandResult && (
                <div className="mt-3 p-3 bg-secondary rounded-md text-sm text-left">
                  <p className="font-medium">Command Detected:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Keyword: {voiceCommandResult.data.custom_name}</li>
                    <li>Device Name: {voiceCommandResult.device_name}</li>
                    <li>Pin: {voiceCommandResult.data.pin}</li>
                    {/* Aksi (ON/OFF) tidak ditampilkan di sini karena ditentukan saat runtime,
                        tapi bisa ditambahkan jika ingin menampilkan aksi yang terdeteksi
                        misal: <li>Aksi Terdeteksi: {aksiSaatIni === 1 ? "ON" : "OFF"}</li>
                    */}
                    <li>Address: {voiceCommandResult.data.address}</li>
                    <li>Bus: {voiceCommandResult.data.bus}</li>
                  </ul>
                </div>
              )}
              {!isListening && !spokenText && !voiceCommandResult && (
                <p className="text-muted-foreground">Click "Start Voice Command" to begin.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => {
                setShowSpeechModal(false);
                setSpokenText("");
                setVoiceCommandResult(null);
              }} disabled={isListening}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Voice Control Devices Table */}
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <Input
            type="text"
            placeholder="Search voice commands..."
            className="w-full md:w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {paginatedData.length > 0 ? (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead onClick={() => handleSort('data.custom_name')} className="cursor-pointer select-none min-w-[150px]">
                    Keyword <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" />
                  </TableHead>
                  <TableHead onClick={() => handleSort('device_name')} className="cursor-pointer select-none min-w-[150px]">
                    Target Device <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" />
                  </TableHead>
                  <TableHead className="text-center w-[80px]">Pin</TableHead>
                  {/* Kolom Output (target_logic) dihapus */}
                  <TableHead className="text-center w-[80px]">Address</TableHead>
                  <TableHead className="text-center w-[80px]">Bus</TableHead>
                  <TableHead className="text-center w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((item, i) => (
                  <TableRow key={item.uuid}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + i + 1}</TableCell>
                    <TableCell className="font-medium">{item.data.custom_name}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.device_name}</div>
                      <div className="text-muted-foreground text-xs">Modular</div>
                    </TableCell>
                    <TableCell className="text-center">{item.data.pin}</TableCell>
                    {/* Data Output (target_logic) tidak ditampilkan lagi */}
                    <TableCell className="text-center">{item.data.address}</TableCell>
                    <TableCell className="text-center">{item.data.bus}</TableCell>
                    <TableCell className="flex gap-1 justify-center">
                      <Button size="icon" variant="ghost" onClick={() => openCrudModal(item)}><Edit2 className="w-4 h-4" /></Button>
                      <Button size="icon" variant="destructive" onClick={() => deleteVoiceControl(item.uuid)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No voice control devices found. Click "Add Voice Control" to create one.</p>
        )}

        {/* Pagination Controls */}
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
            {Array.from({ length: totalPages }, (_, idx) => (
              <PaginationItem key={idx}>
                <PaginationLink
                  isActive={currentPage === idx + 1}
                  onClick={() => setCurrentPage(idx + 1)}
                >
                  {idx + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
          </PaginationContent>
        </Pagination>

        {/* Voice Control Add/Edit Modal */}
        <Dialog open={showCrudModal} onOpenChange={setShowCrudModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Update Voice Control' : 'Add Voice Control'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveVoiceControl}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="customName">Keyword / Voice Phrase</Label>
                  <Input
                    id="customName"
                    value={form?.data.custom_name || ''}
                    onChange={e => setForm(prev => prev ? { ...prev, data: { ...prev.data, custom_name: e.target.value } } : null)}
                    placeholder="e.g., lampu ruang tamu"
                    required
                  />
                  <p className="text-sm text-muted-foreground">This phrase will be recognized after "nyalakan" or "matikan".</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="deviceName">Target Device Name</Label>
                  <Select
                    value={form?.device_name || ''}
                    onValueChange={onDeviceSelected}
                    required
                  >
                    <SelectTrigger id="deviceName">
                      <SelectValue placeholder="Select target device" />
                    </SelectTrigger>
                    <SelectContent>
                      {parsedModularData.length > 0 ? (
                        parsedModularData.map(device => (
                          <SelectItem key={device.profile.name} value={device.profile.name}>
                            {device.profile.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-center text-muted-foreground">
                          No Modular devices found.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="pin">Pin</Label>
                    <Select
                      value={form?.data.pin?.toString() || ''}
                      onValueChange={v => setForm(prev => prev ? { ...prev, data: { ...prev.data, pin: Number(v) } } : null)}
                      required
                    >
                      <SelectTrigger id="pin">
                        <SelectValue placeholder="Select pin" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => i + 1).map(pin => (
                          <SelectItem key={pin} value={pin.toString()}>PinOut {pin}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Input Output Logic dihapus */}
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      type="number"
                      value={form?.data.address || 0}
                      onChange={e => setForm(prev => prev ? { ...prev, data: { ...prev.data, address: Number(e.target.value) } } : null)}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Pindahkan Bus agar sejajar dengan Pin jika tidak ada Output Logic */}
                  <div className="grid gap-2">
                    <Label htmlFor="bus">Bus</Label>
                    <Input
                      id="bus"
                      type="number"
                      value={form?.data.bus || 0}
                      onChange={e => setForm(prev => prev ? { ...prev, data: { ...prev.data, bus: Number(e.target.value) } } : null)}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{isEditing ? 'Ubpdate Command' : 'Save Command'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}