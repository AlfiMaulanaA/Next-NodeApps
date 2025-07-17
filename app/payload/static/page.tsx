"use client";
import { useEffect, useRef, useState } from "react";
// import mqtt from "mqtt"; // Remove direct mqtt import
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import type { MqttClient } from "mqtt"; // Import MqttClient type for useRef

interface PayloadField { key: string; type: string; value: string; }
interface DataItem {
  topic: string;
  data: Record<string, any>;
  interval: number; qos: number; lwt: boolean; retain: boolean;
}

export default function StaticPayloadPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [tab, setTab] = useState("list");
  const [items, setItems] = useState<DataItem[]>([]);
  const [previewPayload, setPreviewPayload] = useState<any>(null);
  const [formFields, setFormFields] = useState<PayloadField[]>([]);
  const [formMeta, setFormMeta] = useState({ topic: "", interval: 0, qos: 0, lwt: false, retain: false });
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [updateIndex, setUpdateIndex] = useState<number | null>(null);

  const clientRef = useRef<MqttClient>(); // Use MqttClient type

  useEffect(() => {
    // Connect using the centralized function
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      setStatus("connected");
      // Subscribe to the response topic
      mqttClientInstance.subscribe("response/data/payload");
      // Request initial data upon connection
      mqttClientInstance.publish("command/data/payload", JSON.stringify({ command: "getData" }));
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setStatus("error");
    };
    const handleClose = () => setStatus("disconnected");

    const handleMessage = (topic: string, buf: Buffer) => {
      try {
        const msg = JSON.parse(buf.toString());
        // Check if the message is a response to getData command
        if (topic === "response/data/payload") {
          if (Array.isArray(msg)) {
            setItems(msg);
            toast.success("Received latest payload list");
          } else if (msg.status === "success" || msg.status === "error") {
            // Handle success/error messages from create/update/delete commands
            setResponseMessage(msg.message);
            if (msg.status === "success") {
                toast.success(msg.message || "Operation successful!");
            } else {
                toast.error(msg.message || "Operation failed!");
            }
            // After an operation, refresh data (with a slight delay)
            setTimeout(() => {
                mqttClientInstance.publish("command/data/payload", JSON.stringify({ command: "getData" }));
            }, 500);
          }
        }
      } catch (err) {
        toast.error("Invalid payload from broker");
        console.error("MQTT message parsing error:", err);
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    // Cleanup function
    return () => {
      if (mqttClientInstance.connected) {
        mqttClientInstance.unsubscribe("response/data/payload");
      }
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
      // Do NOT call client.end() here; it's managed globally.
    };
  }, []);

  const send = (command: string, payload: any) => {
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
    send("getData", {});
  };

  const handleCreate = () => {
    send("writeData", { ...formMeta, data: Object.fromEntries(formFields.map(f => [f.key, parseField(f)])) });
    setCreateOpen(false);
    setResponseMessage("Create command sent. Waiting for response...");
    // Response will trigger handleGet via message listener
  };

  const handleUpdate = () => {
    send("updateData", { ...formMeta, data: Object.fromEntries(formFields.map(f => [f.key, parseField(f)])) });
    setUpdateOpen(false);
    setResponseMessage("Update command sent. Waiting for response...");
    // Response will trigger handleGet via message listener
  };

  const handleDelete = (idx: number) => {
    const topicToDelete = items[idx].topic;
    send("deleteData", { topic: topicToDelete });
    setResponseMessage(`Delete command sent for topic: ${topicToDelete}`);
    // Response will trigger handleGet via message listener
  };

  // --- Modal Openers ---
  const openCreateModal = () => {
    setFormMeta({ topic: "", interval: 0, qos: 0, lwt: false, retain: false });
    setFormFields([]);
    setCreateOpen(true);
  };
  const openUpdateModal = (idx: number) => {
    setUpdateIndex(idx);
    const it = items[idx];
    setFormMeta({ topic: it.topic, interval: it.interval, qos: it.qos, lwt: it.lwt, retain: it.retain });
    setFormFields(Object.entries(it.data).map(([k, v]) => ({ key: k, type: typeof v === "number" ? "int" : typeof v === "boolean" ? "boolean" : Array.isArray(v) ? "array" : typeof v === "object" ? "object" : "string", value: typeof v === "object" ? JSON.stringify(v) : String(v) })));
    setUpdateOpen(true);
  };
  const openPreviewModal = (data: any) => {
    setPreviewPayload(data);
    setPreviewOpen(true);
  };

  // --- Field UI ---
  function renderFields(fields: typeof formFields, setFields: typeof setFormFields) {
    return fields.map((f, i) => (
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
  }

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
        {responseMessage && <Alert className="mb-4">{responseMessage}</Alert>} {/* Use className for margin */}
        {/* Controls above table */}
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
        {/* Table with Sort and Pagination */}
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
              <TableRow key={i}>
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
        {/* Pagination */}
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
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Data</DialogTitle></DialogHeader>
            <Input placeholder="Topic" value={formMeta.topic} onChange={e => setFormMeta({ ...formMeta, topic: e.target.value })} />
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
            {renderFields(formFields, setFormFields)}
            <Button size="sm" variant="default" onClick={addField}>Add Field</Button>
            <DialogFooter>
              <Button variant="default" onClick={handleCreate}>Send Data</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Update Modal */}
        <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update Data</DialogTitle></DialogHeader>
            <Input placeholder="Topic" value={formMeta.topic} onChange={e => setFormMeta({ ...formMeta, topic: e.target.value })} />
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
            {renderFields(formFields, setFormFields)}
            <Button size="sm" variant="default" onClick={addField}>Add Field</Button>
            <DialogFooter>
              <Button variant="default" onClick={handleUpdate}>Send Update</Button>
            </DialogFooter>
          </DialogContent>
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

  // Helper functions for form fields
  function addField() {
    setFormFields([...formFields, { key: "", type: "string", value: "" }]);
  }
  function removeField(idx: number) {
    const v = [...formFields]; v.splice(idx,1); setFormFields(v);
  }
  function updateField(idx: number, attr: "key" | "value" | "type", val: string) {
    const v = [...formFields]; v[idx] = { ...v[idx], [attr]: val}; setFormFields(v);
  }
  function parseField(f: PayloadField) {
    // Handle "int" type explicitly
    if (f.type === "int") return parseInt(f.value, 10);
    if (f.type === "boolean") return f.value === "true";
    // Attempt to parse as JSON for object/array, otherwise return as string
    try { return JSON.parse(f.value); } catch { return f.value; }
  }
}