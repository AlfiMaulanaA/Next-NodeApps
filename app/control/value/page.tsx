"use client";
import { useEffect, useRef, useState } from "react";
import { connectMQTT } from "@/lib/mqttClient";
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Zap, Edit2, Trash2, ArrowUpDown, CircleCheck, CircleX, Target } from "lucide-react";
import MQTTConnectionBadge from "@/components/mqtt-status";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { useSortableTable } from "@/hooks/use-sort-table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { MqttClient } from "mqtt";

// --- INTERFACE DEFINITIONS ---

// Interface untuk perangkat Modbus (Trigger Device)
interface ModbusDeviceProfile {
  profile: {
    name: string;
    data_topic: string; // Topik tempat data sensor perangkat ini dipublikasikan
  };
  data?: any[]; // Data sensor aktual dari perangkat
  protocol_setting?: any; // Pengaturan protokol perangkat
}

// Interface untuk perangkat Modular (Relay Output Device)
interface ModularDeviceProfile {
  profile: {
    name: string;
    device_bus: number; // Tipe diubah menjadi number sesuai konfirmasi
    address: number;     // Tipe diubah menjadi number sesuai konfirmasi
  };
  data?: any[]; // Data aktual dari perangkat modular (misal: status pin)
}

// Interface untuk nilai Automasi
interface AutomationValue {
  name: string; // Nama unik untuk aturan automasi (misal: "Lampu Ruang Tamu Otomatis")
  topic: string; // Topik MQTT dari perangkat pemicu (misal: "modbus/sensor/temperature")
  config: {
    key_value: string; // Kunci data sensor yang akan dipantau (misal: "temperature_c")
    value: number;     // Nilai ambang batas untuk pemicu
    logic: string;     // Logika perbandingan (misal: ">", "<", "==")
    auto?: boolean;    // Mode otomatis: true jika relay diatur otomatis oleh rule, false jika hanya notifikasi/trigger manual
  };
  relay: {
    name: string;      // Nama perangkat relay (misal: "RELAYMINI_1")
    pin: string;       // Pin relay yang akan dikontrol (misal: "1", "2")
    logic: boolean;    // Logika output relay saat terpicu (true = ON, false = OFF)
    address?: number;  // Alamat perangkat relay (misal: 32 untuk 0x20)
    bus?: number;      // Bus perangkat relay (misal: 1 untuk i2c-1)
  };
}

// --- CONSTANTS ---
const ITEMS_PER_PAGE = 10; // Jumlah item per halaman untuk tabel

// --- MAIN COMPONENT ---
export default function AutomationValuesPage() {
  // --- STATE MANAGEMENT ---
  const [status, setStatus] = useState<"connected"|"disconnected"|"error">("disconnected");
  const [automationValues, setAutomationValues] = useState<AutomationValue[]>([]);
  const [modbusDevices, setModbusDevices] = useState<ModbusDeviceProfile[]>([]);
  const [modularDevices, setModularDevices] = useState<ModularDeviceProfile[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationValue | null>(null);

  // Form states for Automation Rule (Trigger Configuration)
  const [automationName, setAutomationName] = useState("");
  const [selectedDeviceTrigger, setSelectedDeviceTrigger] = useState("");
  const [selectedTopicTrigger, setSelectedTopicTrigger] = useState("");
  const [selectedVarTrigger, setSelectedVarTrigger] = useState("");
  const [logicTrigger, setLogicTrigger] = useState("");
  const [valueTrigger, setValueTrigger] = useState<number>(0);
  const [autoMode, setAutoMode] = useState<boolean>(false);

  // Form states for Relay Output Configuration
  const [selectedDeviceOutput, setSelectedDeviceOutput] = useState("");
  const [outputPin, setOutputPin] = useState("");
  const [outputLogic, setOutputLogic] = useState<boolean>(false);

  // MQTT Client Reference
  const clientRef = useRef<MqttClient>();

  // --- EFFECT HOOKS ---

  // Effect untuk inisialisasi MQTT client dan subscription
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      setStatus("connected");
      // Subscribe topics setelah koneksi berhasil
      mqttClientInstance.subscribe("automation_value/data");
      mqttClientInstance.subscribe("modbus_value/data");
      mqttClientInstance.subscribe("modular_value/data");
      console.log("Subscribed to automation, modbus, and modular data topics.");
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setStatus("error");
      toast.error(`MQTT connection error: ${err.message}`);
    };

    const handleClose = () => {
      setStatus("disconnected");
      console.warn("MQTT connection closed.");
    };

    const handleMessage = (topic: string, messageBuf: Buffer) => {
      try {
        const msg = JSON.parse(messageBuf.toString());
        if (topic === "automation_value/data") {
          setAutomationValues(msg);
          console.log("Received automation data:", msg);
        } else if (topic === "modbus_value/data") {
          setModbusDevices(msg);
          console.log("Received modbus device data:", msg);
        } else if (topic === "modular_value/data") {
          setModularDevices(msg);
          console.log("Received modular device data:", msg);
        }
      } catch (e) {
        console.error("Failed to parse MQTT message:", e, "Topic:", topic, "Message:", messageBuf.toString());
        toast.error(`Failed to parse message from ${topic}`);
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    // Cleanup function: unsubscribe dari topik dan hapus listener saat komponen unmount
    return () => {
      if (mqttClientInstance.connected) {
        mqttClientInstance.unsubscribe("automation_value/data");
        mqttClientInstance.unsubscribe("modbus_value/data");
        mqttClientInstance.unsubscribe("modular_value/data");
        console.log("Unsubscribed from MQTT topics.");
      }
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
    };
  }, []); // Dependensi kosong agar useEffect hanya berjalan sekali saat mount

  // Effect untuk memperbarui selectedTopicTrigger saat selectedDeviceTrigger berubah
  useEffect(() => {
    const device = modbusDevices.find(d => d.profile.name === selectedDeviceTrigger);
    if (device) {
      setSelectedTopicTrigger(device.profile.data_topic || "");
    } else {
      setSelectedTopicTrigger("");
    }
  }, [selectedDeviceTrigger, modbusDevices]);

  // --- FORM & CRUD LOGIC ---

  // Mereset semua state form ke nilai default
  const resetForm = () => {
    setAutomationName("");
    setSelectedDeviceTrigger("");
    setSelectedTopicTrigger("");
    setSelectedVarTrigger("");
    setLogicTrigger("");
    setValueTrigger(0);
    setAutoMode(false);

    setSelectedDeviceOutput("");
    setOutputPin("");
    setOutputLogic(false);
    setEditing(null);
  };

  // Membuka modal untuk menambah atau mengedit automasi
  const openModal = (item?: AutomationValue) => {
    if (item) {
      setEditing(item);
      setAutomationName(item.name);
      // Asumsi nama automasi sama dengan nama device trigger untuk pengeditan
      setSelectedDeviceTrigger(item.name);
      setSelectedTopicTrigger(item.topic);
      setSelectedVarTrigger(item.config.key_value);
      setLogicTrigger(item.config.logic);
      setValueTrigger(item.config.value);
      setAutoMode(item.config.auto || false);

      setSelectedDeviceOutput(item.relay.name);
      setOutputPin(item.relay.pin);
      setOutputLogic(item.relay.logic);
    } else {
      resetForm(); // Reset form jika menambah baru
    }
    setModalOpen(true);
  };

  // Menyimpan atau memperbarui automasi
  const save = () => {
    // Basic validation
    if (!automationName || !selectedDeviceTrigger || !selectedTopicTrigger || !selectedVarTrigger || !logicTrigger || !selectedDeviceOutput || !outputPin) {
      toast.error("Please fill all required fields for Trigger and Relay.");
      return;
    }

    // Validate valueTrigger for numerical comparisons
    if (['>', '<', '>=', '<=', '==', '!='].includes(logicTrigger)) {
      if (isNaN(valueTrigger)) {
        toast.error("Trigger Value must be a number for selected logic.");
        return;
      }
    }

    // Get relay device details for address and bus
    const selectedModularDevice = modularDevices.find(d => d.profile.name === selectedDeviceOutput);
    // Menggunakan nullish coalescing operator (??) untuk memberikan nilai default 0 (number)
    const relayAddress = selectedModularDevice?.profile?.address ?? 0;
    const relayBus = selectedModularDevice?.profile?.device_bus ?? 0;

    const payload: AutomationValue = editing
      ? {
          ...editing, // Pertahankan properti lain jika ada di 'editing'
          name: automationName,
          topic: selectedTopicTrigger,
          config: {
            key_value: selectedVarTrigger,
            logic: logicTrigger,
            value: valueTrigger,
            auto: autoMode,
          },
          relay: {
            name: selectedDeviceOutput,
            pin: outputPin,
            logic: outputLogic,
            address: relayAddress,
            bus: relayBus,
          },
        }
      : {
          name: automationName,
          topic: selectedTopicTrigger,
          config: {
            key_value: selectedVarTrigger,
            logic: logicTrigger,
            value: valueTrigger,
            auto: autoMode,
          },
          relay: {
            name: selectedDeviceOutput,
            pin: outputPin,
            logic: outputLogic,
            address: relayAddress,
            bus: relayBus,
          },
        };

    const topic = editing ? "automation_value/update" : "automation_value/create";

    clientRef.current?.publish(topic, JSON.stringify(payload), (err) => {
      if (err) {
        toast.error(`Failed to publish automation: ${err.message}`);
        console.error("Publish automation error:", err);
      } else {
        toast.success(editing ? "Automation Rule Updated" : "New Automation Rule Created");
        setModalOpen(false);
        resetForm(); // Reset form setelah berhasil disimpan
      }
    });
  };

  // Menghapus automasi
  const remove = (item: AutomationValue) => {
    const msg = JSON.stringify({ name: item.name });
    clientRef.current?.publish("automation_value/delete", msg, (err) => {
      if (err) {
        toast.error(`Failed to delete automation: ${err.message}`);
        console.error("Delete automation publish error:", err);
      } else {
        toast.success("Automation Rule Deleted");
      }
    });
  };

  // --- TABLE LOGIC (Search, Sort, Pagination) ---
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(automationValues, ["name", "topic"]);
  const { sorted, sortField, sortDirection, handleSort } = useSortableTable(filteredData);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedData = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- RENDER UI ---
  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger/>
          <Separator orientation="vertical" className="h-4"/>
          <Zap className="w-5 h-5 text-muted-foreground"/>
          <h1 className="text-lg font-semibold">Automation Values</h1>
        </div>
        <MQTTConnectionBadge />
      </header>
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <Button size="sm" variant="default" onClick={() => openModal()}>Add Automation</Button>
          <Input
            type="text"
            placeholder="Search automation by name or topic..."
            className="w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Table>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[50px]">#</TableHead> {/* Lebar tetap untuk nomor */}
      <TableHead onClick={() => handleSort('name' as keyof AutomationValue)} className="cursor-pointer select-none min-w-[150px]">
        Name <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" />
      </TableHead>
      <TableHead className="min-w-[200px]">Trigger Device / Topic</TableHead>
      <TableHead className="text-center min-w-[150px]">Trigger Rule</TableHead>
      <TableHead className="text-center min-w-[150px]">Relay Output</TableHead>
      <TableHead className="text-center w-[100px]">Auto Mode</TableHead>
      <TableHead className="text-center w-[120px]">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {paginatedData.length > 0 ? paginatedData.map((item, i) => (
      <TableRow key={item.name}>
        <TableCell className="align-top py-3">{(currentPage - 1) * ITEMS_PER_PAGE + i + 1}</TableCell>
        <TableCell className="font-semibold align-top py-3">{item.name}</TableCell>
        <TableCell className="align-top py-3">
          <div className="flex items-start space-x-2"> {/* Gunakan items-start untuk top alignment */}
            <Zap className="w-4 h-4 text-blue-500 mt-1" /> {/* mt-1 untuk align dengan teks */}
            <div>
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-muted-foreground text-xs break-all leading-relaxed">{item.topic || "N/A"}</div> {/* Tambah N/A jika kosong */}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center align-top py-3">
          <span className="font-mono text-xs md:text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md inline-block whitespace-nowrap">
            {item.config.key_value} {item.config.logic} {item.config.value}
          </span>
        </TableCell>
        <TableCell className="text-center align-top py-3">
          <div className="flex items-start justify-center space-x-2"> {/* Gunakan items-start */}
            <Target className="w-4 h-4 text-green-500 mt-1" /> {/* mt-1 untuk align dengan teks */}
            <div>
              <div className="font-medium text-sm">{item.relay.name}</div>
              <div className="text-muted-foreground text-xs">Pin: {item.relay.pin}</div>
              <strong className={`text-sm ${item.relay.logic ? "text-green-600" : "text-red-600"}`}>
                {item.relay.logic ? "ON" : "OFF"}
              </strong>
              {item.relay.address !== undefined && item.relay.bus !== undefined && (
                <div className="text-muted-foreground text-xs">Bus: {item.relay.bus}, Addr: {item.relay.address}</div>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center align-top py-3">
          <div className="flex flex-col items-center justify-center space-y-1">
            {item.config.auto ? (
              <>
                <CircleCheck className="w-5 h-5 text-green-600" />
                <span className="text-xs text-muted-foreground">Yes</span>
              </>
            ) : (
              <>
                <CircleX className="w-5 h-5 text-red-600" />
                <span className="text-xs text-muted-foreground">No</span>
              </>
            )}
          </div>
        </TableCell>
        <TableCell className="flex gap-1 justify-center align-top py-3">
          <Button size="icon" variant="ghost" onClick={() => openModal(item)}><Edit2 className="w-4 h-4" /></Button>
          <Button size="icon" variant="destructive" onClick={() => remove(item)}><Trash2 className="w-4 h-4" /></Button>
        </TableCell>
      </TableRow>
    )) : (
      <TableRow>
        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
          No automation data. Click "Add Automation" to create one.
        </TableCell>
      </TableRow>
    )}
  </TableBody>
</Table>
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
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Automation Rule" : "Add New Automation Rule"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {/* Automation Rule Name */}
              <div className="col-span-2">
                <Label>Automation Rule Name</Label>
                <Input
                  value={automationName}
                  onChange={e => setAutomationName(e.target.value)}
                  placeholder="e.g., Living Room Light Automation"
                  disabled={!!editing} // Disable editing name for existing rules
                />
              </div>

              {/* Trigger Configuration */}
              <div className="col-span-2 text-lg font-semibold border-b pb-2 mb-2">Trigger Configuration</div>
              <div>
                <Label>Trigger Device</Label>
                <Select value={selectedDeviceTrigger} onValueChange={setSelectedDeviceTrigger}>
                  <SelectTrigger><SelectValue placeholder="Select device to monitor" /></SelectTrigger>
                  <SelectContent>
                    {modbusDevices.map(d => (
                      <SelectItem key={d.profile.name} value={d.profile.name}>{d.profile.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trigger Topic</Label>
                <Input value={selectedTopicTrigger} disabled placeholder="Auto-filled from selected device" />
              </div>
              <div>
                <Label>Variable (Key Value)</Label>
                <Input value={selectedVarTrigger} onChange={e => setSelectedVarTrigger(e.target.value)} placeholder="e.g., temperature" />
              </div>
              <div>
                <Label>Logic</Label>
                <Select value={logicTrigger} onValueChange={setLogicTrigger}>
                  <SelectTrigger><SelectValue placeholder="Select logic" /></SelectTrigger>
                  <SelectContent>
                    {[">", "<", ">=", "<=", "==", "!="].map(lo => (
                      <SelectItem key={lo} value={lo}>{lo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trigger Value</Label>
                <Input type="number" value={valueTrigger} onChange={e => setValueTrigger(Number(e.target.value))} placeholder="e.g., 25" />
              </div>
              <div className="col-span-1 flex items-center space-x-2">
                <Checkbox
                  id="auto-mode"
                  checked={autoMode}
                  onCheckedChange={(checked) => setAutoMode(Boolean(checked))}
                />
                <Label htmlFor="auto-mode">Enable Automatic Mode</Label>
              </div>

              {/* Relay Output Configuration */}
              <div className="col-span-2 text-lg font-semibold border-b pb-2 mb-2 mt-4">Relay Output Configuration</div>
              <div>
                <Label>Relay Device</Label>
                <Select value={selectedDeviceOutput} onValueChange={setSelectedDeviceOutput}>
                  <SelectTrigger><SelectValue placeholder="Select relay device" /></SelectTrigger>
                  <SelectContent>
                    {modularDevices.map(d => (
                      <SelectItem key={d.profile.name} value={d.profile.name}>{d.profile.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Relay Pin</Label>
                <Input value={outputPin} onChange={e => setOutputPin(e.target.value)} placeholder="e.g., 1" />
              </div>
              <div>
                <Label>Output Logic (True/False)</Label>
                <Select value={outputLogic ? "true" : "false"} onValueChange={v => setOutputLogic(v === "true") }>
                  <SelectTrigger><SelectValue placeholder="Set output logic" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">ON (True)</SelectItem>
                    <SelectItem value="false">OFF (False)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save}>{editing ? "Update Automation" : "Create Automation"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}