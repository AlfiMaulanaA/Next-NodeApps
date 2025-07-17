"use client";
import { useEffect, useRef, useState } from "react";
// Hapus import mqtt dan mqttBrokerUrl yang lama
// import mqtt from "mqtt";
// import { mqttBrokerUrl } from "@/lib/config";

// Import fungsi connectMQTT dan getMQTTClient dari lib/mqttClient.ts
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient"; // <-- Perbaikan: Impor dari sini

import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Zap, Edit2, Trash2, ArrowUpDown } from "lucide-react";
import MQTTConnectionBadge from "@/components/mqtt-status";
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
import type { MqttClient } from "mqtt"; // Import tipe MqttClient untuk useRef

interface DeviceProfile { profile: any; data?: any[]; protocol_setting?: any; }
interface AutomationValue {
  name: string;
  topic: string;
  config: { key_value: string; value: number; logic: string };
  relay: { name: string; pin: string; logic: boolean };
}

export default function AutomationValuesPage() {
  const [status, setStatus] = useState<"connected"|"disconnected"|"error">("disconnected");
  const [automationValues, setAutomationValues] = useState<AutomationValue[]>([]);
  const [modbusDevices, setModbusDevices] = useState<DeviceProfile[]>([]);
  const [modularDevices, setModularDevices] = useState<DeviceProfile[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationValue | null>(null);

  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedVar, setSelectedVar] = useState("");
  const [logic, setLogic] = useState("");
  const [valueTrigger, setValueTrigger] = useState<number>(0);

  const [selectedDeviceOutput, setSelectedDeviceOutput] = useState("");
  const [outputPin, setOutputPin] = useState("");
  const [outputLogic, setOutputLogic] = useState<boolean>(false);

  // clientRef sekarang akan menyimpan instance MqttClient yang dikelola oleh mqttClient.ts
  const clientRef = useRef<MqttClient>(); // <-- Gunakan tipe MqttClient dari 'mqtt'

  useEffect(() => {
    // Panggil connectMQTT untuk mendapatkan atau membuat instance klien
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance; // Simpan ke ref

    // Pasang event listener pada instance klien yang didapat
    const handleConnect = () => {
      setStatus("connected");
      // Subscribe topic di sini setelah koneksi berhasil
      mqttClientInstance.subscribe("automation_value/data");
      mqttClientInstance.subscribe("modbus_value/data");
      mqttClientInstance.subscribe("modular_value/data");
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setStatus("error");
    };

    const handleClose = () => setStatus("disconnected");

    const handleMessage = (topic: string, messageBuf: Buffer) => {
      try {
        const msg = JSON.parse(messageBuf.toString());
        // Gunakan perbandingan topic string secara langsung
        if (topic === "automation_value/data") {
          setAutomationValues(msg);
        } else if (topic === "modbus_value/data") {
          setModbusDevices(msg);
        } else if (topic === "modular_value/data") {
          setModularDevices(msg);
        }
      } catch (e) {
        console.error("Failed to parse MQTT message:", e);
      }
    };

    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    // Cleanup function: unsubscribe dari topik dan hapus listener
    return () => {
      if (mqttClientInstance.connected) {
        mqttClientInstance.unsubscribe("automation_value/data");
        mqttClientInstance.unsubscribe("modbus_value/data");
        mqttClientInstance.unsubscribe("modular_value/data");
      }
      // Hapus event listener untuk mencegah memory leak
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
      // Jangan panggil mqttClientInstance.end() di sini karena mqttClient.ts mengelola satu instance global.
    };
  }, []); // Dependensi kosong agar useEffect hanya berjalan sekali

  const resetForm = () => {
    setSelectedDevice(""); setSelectedTopic("");
    setSelectedVar(""); setLogic(""); setValueTrigger(0);
    setSelectedDeviceOutput(""); setOutputPin(""); setOutputLogic(false);
    setEditing(null);
  };

  const openModal = (item?: AutomationValue) => {
    if (item) {
      setEditing(item);
      setSelectedDevice(item.name);
      setSelectedTopic(item.topic);
      setSelectedVar(item.config.key_value);
      setLogic(item.config.logic);
      setValueTrigger(item.config.value);
      setSelectedDeviceOutput(item.relay.name);
      setOutputPin(item.relay.pin);
      setOutputLogic(item.relay.logic);
    } else resetForm();
    setModalOpen(true);
  };

  const save = () => {
    const payload = editing
      ? { ...editing, config: { key_value: selectedVar, logic, value: valueTrigger }, relay: { name: selectedDeviceOutput, pin: outputPin, logic: outputLogic } }
      : { name: selectedDevice, topic: selectedTopic, config: { key_value: selectedVar, logic, value: valueTrigger }, relay: { name: selectedDeviceOutput, pin: outputPin, logic: outputLogic } };
    const topic = editing ? "automation_value/update" : "automation_value/create";

    // Gunakan klien dari ref untuk publish
    clientRef.current?.publish(topic, JSON.stringify(payload), (err) => {
        if (err) {
            toast.error(`Failed to publish: ${err.message}`);
            console.error("Publish error:", err);
        } else {
            toast.success(editing ? "Updated" : "Created");
            setModalOpen(false);
        }
    });
  };

  const remove = (item: AutomationValue) => {
    const msg = JSON.stringify({ name: item.name });
    // Gunakan klien dari ref untuk publish
    clientRef.current?.publish("automation_value/delete", msg, (err) => {
        if (err) {
            toast.error(`Failed to delete: ${err.message}`);
            console.error("Delete publish error:", err);
        } else {
            toast.success("Deleted");
        }
    });
  };

  // --- Pagination, Sort, and Search Logic ---
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(automationValues, ["name", "topic"]);
  const { sorted, sortField, sortDirection, handleSort } = useSortableTable(filteredData);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderStatus = status === "connected" ? "text-green-600" : status === "error" ? "text-red-600" : "text-yellow-600";

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger/>
          <Separator orientation="vertical" className="h-4"/>
          <Zap className="w-5 h-5 text-muted-foreground"/>
          <h1 className="text-lg font-semibold">Automation Values</h1>
        </div>
        <MQTTConnectionBadge /> {/* Pastikan badge ini juga membaca status koneksi dari klien global */}
      </header>
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <Button size="sm" variant="default" onClick={() => openModal()}>Add Automation</Button>
          <input
            type="text"
            placeholder="Search..."
            className="border rounded px-2 py-1 w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead onClick={() => handleSort('name' as keyof AutomationValue)} className="cursor-pointer select-none">
                Name / Topic <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" />
              </TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Relay</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length ? paginatedData.map((item, i) => (
              <TableRow key={i}>
                <TableCell>{(currentPage - 1) * pageSize + i + 1}</TableCell>
                <TableCell>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-muted text-xs">{item.topic}</div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="badge">{item.config.key_value} {item.config.logic} {item.config.value}</span>
                </TableCell>
                <TableCell className="text-center">
                  {item.relay.name} pin {item.relay.pin} = <strong>{item.relay.logic ? "ON" : "OFF"}</strong>
                </TableCell>
                <TableCell className="flex gap-1 justify-center">
                  <Button size="icon" onClick={() => openModal(item)}><Edit2 /></Button>
                  <Button size="icon" variant="destructive" onClick={() => remove(item)}><Trash2 /></Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Automation" : "Add Automation"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label>Device</label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger><SelectValue placeholder="Select.." /></SelectTrigger>
                  <SelectContent>
                    {modbusDevices.map(d => (
                      <SelectItem key={d.profile.name} value={d.profile.name}>{d.profile.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label>Topic</label>
                <Input value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} />
              </div>
              <div>
                <label>Variable</label>
                <Input value={selectedVar} onChange={e => setSelectedVar(e.target.value)} />
              </div>
              <div>
                <label>Logic</label>
                <Select value={logic} onValueChange={setLogic}>
                  <SelectTrigger><SelectValue placeholder="Select.." /></SelectTrigger>
                  <SelectContent>
                    {[">", "<", ">=", "<=", "==", "!="].map(lo => (
                      <SelectItem key={lo} value={lo}>{lo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label>Value</label>
                <Input type="number" value={valueTrigger} onChange={e => setValueTrigger(Number(e.target.value))} />
              </div>
              <div>
                <label>Relay Device</label>
                <Select value={selectedDeviceOutput} onValueChange={setSelectedDeviceOutput}>
                  <SelectTrigger><SelectValue placeholder="Select.." /></SelectTrigger>
                  <SelectContent>
                    {modularDevices.map(d => (
                      <SelectItem key={d.profile.name} value={d.profile.name}>{d.profile.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label>Pin</label>
                <Input value={outputPin} onChange={e => setOutputPin(e.target.value)} />
              </div>
              <div>
                <label>Output Logic</label>
                <Select value={outputLogic ? "true" : "false"} onValueChange={v => setOutputLogic(v === "true") }>
                  <SelectTrigger><SelectValue placeholder="Select.." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}