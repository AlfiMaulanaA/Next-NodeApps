"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, Edit2, Eye, ArrowUpDown, RotateCw, Search, Database, Activity, Target, Settings, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import MQTTConnectionBadge from "@/components/mqtt-status";
import { connectMQTT, disconnectMQTT, getMQTTClient } from "@/lib/mqttClient";

interface PayloadField { key: string; type: string; value: string; }
interface DataItem {
  topic: string;
  data: Record<string, any>;
  interval: number; qos: number; lwt: boolean; retain: boolean;
}

interface PayloadFormProps {
  initialMeta: { topic: string; interval: number; qos: number; lwt: boolean; retain: boolean; };
  initialFields: PayloadField[];
  onSubmit: (meta: { topic: string; interval: number; qos: number; lwt: boolean; retain: boolean; }, fields: { key: string; value: any }[]) => void;
  onClose: () => void;
  title: string;
}

function PayloadForm({ initialMeta, initialFields, onSubmit, onClose, title }: PayloadFormProps) {
  const [formMeta, setFormMeta] = useState(initialMeta);
  const [formFields, setFormFields] = useState(initialFields);

  useEffect(() => {
    setFormMeta(initialMeta);
    setFormFields(initialFields);
  }, [initialMeta, initialFields]);

  function addField() {
    setFormFields([...formFields, { key: "", type: "string", value: "" }]);
  }
  function removeField(idx: number) {
    const v = [...formFields]; v.splice(idx, 1); setFormFields(v);
  }
  function updateField(idx: number, attr: "key" | "value" | "type", val: string) {
    const v = [...formFields]; v[idx] = { ...v[idx], [attr]: val }; setFormFields(v);
  }

  function parseField(f: PayloadField): any {
    if (f.type === "int") {
      const parsed = parseInt(f.value, 10);
      if (isNaN(parsed)) {
        toast.error(`Invalid integer value for key '${f.key}'. Please enter a number.`);
        throw new Error("Invalid integer value");
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
        throw new Error("Invalid JSON value");
      }
    }
    return f.value;
  }

  const handleSubmit = () => {
    try {
      if (!formMeta.topic.trim()) {
        toast.error("Topic cannot be empty.");
        return;
      }
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
      onSubmit(formMeta, parsedFields);
    } catch (error) {
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

  const [currentFormMeta, setCurrentFormMeta] = useState({ topic: "", interval: 0, qos: 0, lwt: false, retain: false });
  const [currentFormFields, setCurrentFormFields] = useState<PayloadField[]>([]);

  useEffect(() => {
    // Memastikan koneksi hanya dilakukan sekali saat komponen di-mount
    connectMQTT();

    const handleConnect = () => {
      setStatus("connected");
      const client = getMQTTClient();
      if (client?.connected) {
        client.subscribe("response/data/#");
        client.publish("command/data/payload", JSON.stringify({ command: "getData" }));
        toast.info("Connected to MQTT. Requesting initial data...");
      }
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
              const client = getMQTTClient();
              if (client?.connected) {
                client.publish("command/data/payload", JSON.stringify({ command: "getData" }));
              }
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
    
    const client = getMQTTClient();
    if (client) {
      client.on("connect", handleConnect);
      client.on("error", handleError);
      client.on("close", handleClose);
      client.on("message", handleMessage);
      
      if (client.connected) {
        handleConnect();
      }
    }

    return () => {
      const client = getMQTTClient();
      if (client) {
        if (client.connected) {
          client.unsubscribe("response/data/#");
        }
        client.off("connect", handleConnect);
        client.off("error", handleError);
        client.off("close", handleClose);
        client.off("message", handleMessage);
      }
      disconnectMQTT();
    };
  }, []);

  const send = (command: string, payload: any, responseTopic: string) => {
    const client = getMQTTClient();
    if (!client?.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }
    client.publish("command/data/payload", JSON.stringify({ command, ...payload }), (err) => {
      if (err) {
        toast.error(`Failed to send command: ${err.message}`);
        console.error("Publish error:", err);
      }
    });
  };

  const handleGet = () => {
    setResponseMessage("");
    send("getData", {}, "response/data/payload");
  };

  const handleCreateSubmit = (meta: { topic: string; interval: number; qos: number; lwt: boolean; retain: boolean; }, parsedFields: { key: string; value: any }[]) => {
    const dataToSend = Object.fromEntries(parsedFields.map(f => [f.key, f.value]));
    send("writeData", { ...meta, data: dataToSend }, "response/data/write");
    setCreateOpen(false);
  };

  const handleUpdateSubmit = (meta: { topic: string; interval: number; qos: number; lwt: boolean; retain: boolean; }, parsedFields: { key: string; value: any }[]) => {
    const dataToSend = Object.fromEntries(parsedFields.map(f => [f.key, f.value]));
    send("updateData", { ...meta, data: dataToSend, topic: meta.topic }, "response/data/update");
    setUpdateOpen(false);
  };

  const handleDelete = (idx: number) => {
    const topicToDelete = items[idx].topic;
    send("deleteData", { topic: topicToDelete }, "response/data/delete");
  };

  const openCreateModal = () => {
    setCurrentFormMeta({ topic: "", interval: 0, qos: 0, lwt: false, retain: false });
    setCurrentFormFields([]);
    setCreateOpen(true);
  };

  const openUpdateModal = (idx: number) => {
    setUpdateIndex(idx);
    const it = items[idx];
    setCurrentFormMeta({ topic: it.topic, interval: it.interval, qos: it.qos, lwt: it.lwt, retain: it.retain });
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
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <FileText className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Static Custom Payload</h1>
        </div>
        <div className="flex items-center gap-2">
          <MQTTConnectionBadge />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleGet}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={openCreateModal}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Create New Data
          </Button>
        </div>
      </header>
      
      <div className="px-4 py-2 border-b">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {responseMessage && (
          <Alert>
            <AlertDescription>{responseMessage}</AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Payload Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <FileText className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{items.length}</div>
                <div className="text-sm text-muted-foreground">Total Payloads</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Activity className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{items.filter(item => item.interval > 0).length}</div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{items.filter(item => item.retain).length}</div>
                <div className="text-sm text-muted-foreground">Retained</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Settings className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{items.filter(item => item.qos > 0).length}</div>
                <div className="text-sm text-muted-foreground">QoS 0</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Static Payload Data</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead onClick={() => handleSort('topic' as keyof DataItem)} className="cursor-pointer select-none">
                    Topic <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" />
                  </TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No data found</h3>
                  <p className="text-muted-foreground mb-4">No payload data received yet. Click refresh to fetch the data.</p>
                  <Button onClick={handleGet}>
                    <RotateCw className="h-4 w-4 mr-2" />
                    Get Data
                  </Button>
                </TableCell></TableRow>
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
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => openPreviewModal(it.data)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openUpdateModal(i)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
            </Table>
          </CardContent>
        </Card>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {Math.min((currentPage - 1) * pageSize + 1, sorted.length)} to{" "}
              {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} results
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
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
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationContent>
            </Pagination>
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <PayloadForm
            title="Create New Data"
            initialMeta={currentFormMeta}
            initialFields={currentFormFields}
            onSubmit={handleCreateSubmit}
            onClose={() => setCreateOpen(false)}
          />
        </Dialog>

        <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
          <PayloadForm
            title="Update Data"
            initialMeta={currentFormMeta}
            initialFields={currentFormFields}
            onSubmit={handleUpdateSubmit}
            onClose={() => setUpdateOpen(false)}
          />
        </Dialog>

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