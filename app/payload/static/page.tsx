"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, Edit2, Eye, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { useSortableTable } from "@/hooks/use-sort-table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import MQTTConnectionBadge from "@/components/mqtt-status";
import { connectMQTT } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";

interface PayloadField { key: string; type: string; value: string; }
interface DataItem {
  topic: string;
  data: Record<string, any>;
  interval: number; qos: number; lwt: boolean; retain: boolean;
}

// Refactor form into a reusable component
interface PayloadFormProps {
  initialMeta: { topic: string; interval: number; qos: number; lwt: boolean; retain: boolean; };
  initialFields: PayloadField[];
  onSubmit: (meta: typeof initialMeta, fields: { key: string; value: any }[]) => void;
  onClose: () => void;
  title: string;
}

function PayloadForm({ initialMeta, initialFields, onSubmit, onClose, title }: PayloadFormProps) {
  const [formMeta, setFormMeta] = useState(initialMeta);
  const [formFields, setFormFields] = useState(initialFields);

  useEffect(() => {
    setFormMeta(initialMeta);
    setFormFields(initialFields);
  }, [initialMeta, initialFields]); // Reset form when initial props change (e.g., for update)

  function addField() {
    setFormFields([...formFields, { key: "", type: "string", value: "" }]);
  }
  function removeField(idx: number) {
    const v = [...formFields]; v.splice(idx, 1); setFormFields(v);
  }
  function updateField(idx: number, attr: "key" | "value" | "type", val: string) {
    const v = [...formFields]; v[idx] = { ...v[idx], [attr]: val }; setFormFields(v);
  }

  // Helper to parse field values based on their declared type
  function parseField(f: PayloadField): any {
    if (f.type === "int") {
      const parsed = parseInt(f.value, 10);
      if (isNaN(parsed)) {
        toast.error(`Invalid integer value for key '${f.key}'. Please enter a number.`);
        throw new Error("Invalid integer value"); // Throw to stop form submission
      }
      return parsed;
    }
    if (f.type === "boolean") {
      if (f.value !== "true" && f.value !== "false") {
        toast.error(`Invalid boolean value for key '${f.key}'. Please use 'true' or 'false'.`);
        throw new Error("Invalid boolean value");
      }
      return f.value === "true";
    }
    if (f.type === "object" || f.type === "array") {
      try {
        return JSON.parse(f.value);
      } catch (e) {
        toast.error(`Invalid JSON for key '${f.key}'. Please ensure it's valid JSON.`);
        throw new Error("Invalid JSON value"); // Throw to stop form submission
      }
    }
    return f.value; // Default to string
  }

  const handleSubmit = () => {
    try {
      // Validate topic
      if (!formMeta.topic.trim()) { // ✨ Corrected: Using formMeta here
        toast.error("Topic cannot be empty.");
        return;
      }
      // Ensure all keys are unique and not empty
      const keys = formFields.map(f => f.key.trim());
      const uniqueKeys = new Set(keys);
      if (keys.length !== uniqueKeys.size) {
        toast.error("Duplicate keys found in data fields. Keys must be unique.");
        return;
      }
      if (keys.some(k => !k)) {
        toast.error("Data field keys cannot be empty.");
        return;
      }

      const parsedFields = formFields.map(f => ({ key: f.key, value: parseField(f) }));
      onSubmit(formMeta, parsedFields); // ✨ Corrected: Using formMeta here
    } catch (error) {
      // Errors are already toasted by parseField
      console.error("Form submission error:", error);
    }
  };

  const renderFields = () => {
    return formFields.map((f, i) => (
      <div key={i} className="flex gap-2 items-center mb-2">
        <Input placeholder="Key" value={f.key} onChange={e => updateField(i, "key", e.target.value)} />
        <select value={f.type} onChange={e => updateField(i, "type", e.target.value)} className="border rounded px-2 py-1">
          <option value="string">String</option>
          <option value="int">Integer</option>
          <option value="boolean">Boolean</option>
          <option value="object">Object</option>
          <option value="array">Array</option>
        </select>
        <Input placeholder={`Value (${f.type})`} value={f.value} onChange={e => updateField(i, "value", e.target.value)} />
        <Button variant="destructive" onClick={() => removeField(i)}>×</Button>
      </div>
    ));
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <Input placeholder="Topic" value={formMeta.topic} onChange={e => setFormMeta({ ...formMeta, topic: e.target.value })} disabled={title === "Update Data"} />
      <div className="flex gap-2 mt-2">
        <Input type="number" placeholder="Interval" value={formMeta.interval} onChange={e => setFormMeta({ ...formMeta, interval: Number(e.target.value) })} />
        <select value={formMeta.qos} onChange={e => setFormMeta({ ...formMeta, qos: Number(e.target.value) })} className="border rounded px-2 py-1">
          <option value={0}>Qos 0</option>
          <option value={1}>Qos 1</option>
          <option value={2}>Qos 2</option>
        </select>
        <select value={String(formMeta.lwt)} onChange={e => setFormMeta({ ...formMeta, lwt: e.target.value === "true" })} className="border rounded px-2 py-1">
          <option value="true">LWT True</option>
          <option value="false">LWT False</option>
        </select>
        <select value={String(formMeta.retain)} onChange={e => setFormMeta({ ...formMeta, retain: e.target.value === "true" })} className="border rounded px-2 py-1">
          <option value="true">Retain True</option>
          <option value="false">Retain False</option>
        </select>
      </div>
      <h4 className="mt-4">Data Fields</h4>
      {renderFields()}
      <Button size="sm" variant="default" onClick={addField}>Add Field</Button>
      <DialogFooter>
        <Button variant="default" onClick={handleSubmit}>Send Data</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function StaticPayloadPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [items, setItems] = useState<DataItem[]>([]);
  const [previewPayload, setPreviewPayload] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [updateIndex, setUpdateIndex] = useState<number | null>(null);

  const clientRef = useRef<MqttClient>();

  const [currentFormMeta, setCurrentFormMeta] = useState({ topic: "", interval: 0, qos: 0, lwt: false, retain: false });
  const [currentFormFields, setCurrentFormFields] = useState<PayloadField[]>([]);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      setStatus("connected");
      mqttClientInstance.subscribe("response/data/#");
      mqttClientInstance.publish("command/data/payload", JSON.stringify({ command: "getData" }));
      toast.info("Connected to MQTT. Requesting initial data...");
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setStatus("error");
      toast.error(`MQTT Error: ${err.message}`);
    };
    const handleClose = () => {
      setStatus("disconnected");
      toast.warning("Disconnected from MQTT broker.");
    };

    const handleMessage = (topic: string, buf: Buffer) => {
      try {
        const msg = JSON.parse(buf.toString());

        if (topic === "response/data/payload") {
          if (Array.isArray(msg)) {
            setItems(msg);
            toast.success("Received latest payload list.");
          } else {
            console.warn("Unexpected message format on response/data/payload:", msg);
          }
        } else if (topic === "response/data/write" || topic === "response/data/update" || topic === "response/data/delete") {
          setResponseMessage(msg.message);
          if (msg.status === "success") {
            toast.success(msg.message || "Operation successful!");
            setTimeout(() => {
                clientRef.current?.publish("command/data/payload", JSON.stringify({ command: "getData" }));
            }, 500);
          } else {
            toast.error(msg.message || "Operation failed!");
          }
        } else {
            console.log(`Received unknown message on topic ${topic}:`, msg);
        }
      } catch (err) {
        toast.error("Invalid payload from broker. Check console for details.");
        console.error("MQTT message parsing error:", err);
      }
    };

    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (mqttClientInstance.connected) {
        mqttClientInstance.unsubscribe("response/data/#");
      }
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
    };
  }, []);

  const send = (command: string, payload: any, responseTopic: string) => {
    if (status !== "connected" || !clientRef.current?.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }
    clientRef.current?.publish("command/data/payload", JSON.stringify({ command, ...payload }), (err) => {
      if (err) {
        toast.error(`Failed to send command: ${err.message}`);
        console.error("Publish error:", err);
      }
    });
  };

  // --- CRUD Handlers ---
  const handleGet = () => {
    setResponseMessage("");
    send("getData", {}, "response/data/payload");
  };

  const handleCreateSubmit = (meta: typeof currentFormMeta, parsedFields: { key: string; value: any }[]) => {
    const dataToSend = Object.fromEntries(parsedFields.map(f => [f.key, f.value]));
    send("writeData", { ...meta, data: dataToSend }, "response/data/write");
    setCreateOpen(false);
  };

  const handleUpdateSubmit = (meta: typeof currentFormMeta, parsedFields: { key: string; value: any }[]) => {
    const dataToSend = Object.fromEntries(parsedFields.map(f => [f.key, f.value]));
    send("updateData", { ...meta, data: dataToSend, topic: meta.topic }, "response/data/update");
    setUpdateOpen(false);
  };

  const handleDelete = (idx: number) => {
    const topicToDelete = items[idx].topic;
    send("deleteData", { topic: topicToDelete }, "response/data/delete");
  };

  // --- Modal Openers ---
  const openCreateModal = () => {
    setCurrentFormMeta({ topic: "", interval: 0, qos: 0, lwt: false, retain: false });
    setCurrentFormFields([]);
    setCreateOpen(true);
  };

  const openUpdateModal = (idx: number) => {
    setUpdateIndex(idx);
    const it = items[idx];
    setCurrentFormMeta({ topic: it.topic, interval: it.interval, qos: it.qos, lwt: it.lwt, retain: it.retain });
    // Convert data object to PayloadField array for form
    setCurrentFormFields(Object.entries(it.data).map(([k, v]) => ({
      key: k,
      type: typeof v === "number" ? "int" : typeof v === "boolean" ? "boolean" : Array.isArray(v) ? "array" : typeof v === "object" ? "object" : "string",
      value: typeof v === "object" ? JSON.stringify(v) : String(v)
    })));
    setUpdateOpen(true);
  };

  const openPreviewModal = (data: any) => {
    setPreviewPayload(data);
    setPreviewOpen(true);
  };

  // --- Pagination, Sort, and Search Logic ---
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(items, ["topic"]);
  const { sorted, sortField, sortDirection, handleSort } = useSortableTable(filteredData);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <FileText className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Static Custom Payload</h1>
        </div>
        <div className="flex items-center gap-2">
          <MQTTConnectionBadge />
        </div>
      </header>
      <div className="p-6">
        {responseMessage && <Alert className="mb-4">{responseMessage}</Alert>}
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleGet}>Get Data</Button>
            <Button size="sm" variant="default" onClick={openCreateModal}>Create New Data</Button>
          </div>
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
              <TableHead onClick={() => handleSort('topic' as keyof DataItem)} className="cursor-pointer select-none">
                Topic <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Config</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No data received yet. Click "Get Data" to fetch the data.</TableCell></TableRow>
            ) : paginatedData.map((it, i) => (
              <TableRow key={it.topic}>
                <TableCell>{(currentPage - 1) * pageSize + i + 1}</TableCell>
                <TableCell>{it.topic}</TableCell>
                <TableCell>
                  <Table className="text-xs">
                    <TableBody>
                      {Object.entries(it.data).map(([k, v]) => (
                        <TableRow key={k}><TableCell><b>{k}</b></TableCell><TableCell>{typeof v === "object" ? JSON.stringify(v) : String(v)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableCell>
                <TableCell>
                  <ul>
                    <li>Interval {it.interval} s</li>
                    <li>Qos {it.qos}</li>
                    <li>LWT <Badge variant={it.lwt ? "default" : "destructive"}>{String(it.lwt)}</Badge></li>
                    <li>Retain <Badge variant={it.retain ? "default" : "destructive"}>{String(it.retain)}</Badge></li>
                  </ul>
                </TableCell>
                <TableCell className="flex flex-col gap-1 items-start">
                  <Button size="sm" variant="outline" onClick={() => openPreviewModal(it.data)}>Preview</Button>
                  <Button size="sm" variant="default" onClick={() => openUpdateModal(i)}>Update</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(i)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
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

        {/* Create Modal */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <PayloadForm
            title="Create New Data"
            initialMeta={currentFormMeta}
            initialFields={currentFormFields}
            onSubmit={handleCreateSubmit}
            onClose={() => setCreateOpen(false)}
          />
        </Dialog>

        {/* Update Modal */}
        <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
          <PayloadForm
            title="Update Data"
            initialMeta={currentFormMeta}
            initialFields={currentFormFields}
            onSubmit={handleUpdateSubmit}
            onClose={() => setUpdateOpen(false)}
          />
        </Dialog>

        {/* Preview Modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Preview JSON Payload</DialogTitle></DialogHeader>
            <pre className="text-dark p-3 rounded text-xs bg-muted" style={{ fontSize: "0.9rem" }}>{JSON.stringify(previewPayload, null, 2)}</pre>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}