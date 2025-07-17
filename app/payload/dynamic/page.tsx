"use client";
import { useEffect, useRef, useState } from "react";
// import mqtt from "mqtt"; // Remove direct mqtt import
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Settings2, PlusCircle, Edit2, Trash2, ArrowUpDown } from "lucide-react";
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
import axios from "axios";
import { connectMQTT } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt"; // Import MqttClient type for useRef

interface Device {
  name: string;
  value_group?: string;
  keyOptions: string[];
  value_keys: { key: string; value: string }[];
}

interface SummaryGroup {
  summary_topic: string;
  included_devices: Device[];
  retain: boolean;
  qos: number;
  interval: number;
}

interface SummaryConfig {
  groups: SummaryGroup[];
}

export default function CustomPayloadPage() {
  const [status, setStatus] = useState<"connected"|"disconnected"|"error">("disconnected");
  const [config, setConfig] = useState<SummaryConfig | null>(null);
  const [devicesInfo, setDevicesInfo] = useState<Device[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const [summaryTopic, setSummaryTopic] = useState("");
  const [retain, setRetain] = useState(false);
  const [qos, setQos] = useState(0);
  const [interval, setIntervalValue] = useState(10);
  const [devices, setDevices] = useState<Device[]>([{ name:"", keyOptions: [], value_keys:[{key:"",value:""}] }]);

  const clientRef = useRef<MqttClient>(); // Use MqttClient type

  useEffect(() => {
    // Connect using the centralized function
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      setStatus("connected");
      // Subscribe to necessary topics
      mqttClientInstance.subscribe("config/device_info/response");
      mqttClientInstance.subscribe("config/summary_device/response");
      // Request initial data upon connection
      mqttClientInstance.publish("config/device_info", JSON.stringify({ command: "getDeviceInfo" }));
      mqttClientInstance.publish("config/summary_device", JSON.stringify({ command: "getData" }));
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setStatus("error");
    };
    const handleClose = () => setStatus("disconnected");

    const handleMessage = (topic: string, buf: Buffer) => {
      try {
        const msg = JSON.parse(buf.toString());
        if (topic.endsWith("/device_info/response")) {
          setDevicesInfo(msg);
        } else if (topic.endsWith("/summary_device/response")) {
          if (msg.command === "getDataResponse") {
              setConfig(msg.data); // Assuming msg.data contains the SummaryConfig
          } else if (msg.status === "success" || msg.status === "error") {
              toast[msg.status === "success" ? "success" : "error"](msg.message || "Operation completed.");
              // After a write/update/delete operation, request fresh data
              setTimeout(() => {
                  mqttClientInstance.publish("config/summary_device", JSON.stringify({ command: "getData" }));
              }, 500);
          }
        }
      } catch (err) {
        toast.error("Invalid payload format from broker");
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
        mqttClientInstance.unsubscribe("config/device_info/response");
        mqttClientInstance.unsubscribe("config/summary_device/response");
      }
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
      // Do NOT call client.end() here; it's managed globally.
    };
  }, []);

  // Load device keys from devices.json and merge into devicesInfo
  useEffect(() => {
    if (!devicesInfo.length) return;
    axios.get("/devices.json").then(res => {
      const keys: Record<string, string[]> = {};
      Object.entries(res.data).forEach(([_, devicesArray]: any) => { // Renamed 'devices' to 'devicesArray' to avoid conflict
        devicesArray.forEach((device: any) => {
          keys[device.name] = device.data.map((item: any) => item.var_name);
        });
      });
      setDevicesInfo(devicesInfo.map(d => ({ ...d, keyOptions: keys[d.name] || [] })));
    }).catch(error => {
      console.error("Failed to load devices.json:", error);
      toast.error("Failed to load device key options.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicesInfo.length]); // Depend on devicesInfo.length to re-run when devicesInfo is first populated

  const openEditor = (idx?: number) => {
    if (idx !== undefined && config) {
      const g = config.groups[idx];
      setSummaryTopic(g.summary_topic);
      setRetain(g.retain);
      setQos(g.qos);
      setIntervalValue(g.interval);
      setDevices(g.included_devices.map(d => ({
        ...d,
        // Ensure keyOptions are correctly populated for editing existing devices
        keyOptions: devicesInfo.find(x=>x.name===d.name)?.keyOptions||[],
      })));
      setEditIndex(idx);
    } else {
      setSummaryTopic(""); setRetain(false);
      setQos(0); setIntervalValue(10);
      setDevices([{ name:"", keyOptions:[], value_keys:[{key:"",value:""}] }]);
      setEditIndex(null);
    }
    setModalOpen(true);
  };

  const sendCommand = (command: string, data: any) => {
    if (!clientRef.current?.connected) {
      toast.error("MQTT not connected. Please wait for connection or refresh.");
      return;
    }
    clientRef.current.publish("config/summary_device", JSON.stringify({ command, data }), (err) => {
        if (err) {
            toast.error(`Failed to send command: ${err.message}`);
            console.error("Publish error:", err);
        }
    });
  };

  const saveGroup = () => {
    const payloadData = {
      summary_topic: summaryTopic,
      retain, qos, interval,
      included_devices: devices.map(d => ({
        name: d.name,
        value_group: d.value_group, // Ensure value_group is passed if available
        value_keys: Object.fromEntries(d.value_keys.map(kv => [kv.key, kv.value])),
      })),
    };

    if (editIndex === null) {
      sendCommand("writeData", payloadData);
      toast.info("Sending create command...");
    } else {
      // For update, you might need to send the old topic as well to identify the item to update
      // Or the backend can infer it from the summary_topic if it's unique
      sendCommand("updateData", payloadData);
      toast.info("Sending update command...");
    }
    setModalOpen(false);
  };

  const deleteGroup = (idx: number) => {
    const topic = config?.groups[idx].summary_topic;
    if (topic) {
      sendCommand("deleteData", { summary_topic: topic });
      toast.info(`Sending delete command for topic: ${topic}`);
    } else {
      toast.error("Could not find topic to delete.");
    }
  };

  // --- Pagination, Sort, and Search Logic ---
  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(config?.groups || [], ["summary_topic"]);
  const { sorted, sortField, sortDirection, handleSort } = useSortableTable(filteredData);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger/>
          <Separator orientation="vertical" className="h-4"/>
          <Settings2 className="w-5 h-5 text-muted-foreground"/>
          <h1 className="text-lg font-semibold">Custom Payload Data</h1>
        </div>
        <MQTTConnectionBadge />
      </header>
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={()=>clientRef.current?.publish("config/summary_device", JSON.stringify({ command:"getData" }))}>Get Data</Button>
            <Button size="sm" variant="default" onClick={()=>openEditor()}>Create New Data</Button>
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
              <TableHead onClick={() => handleSort('summary_topic' as keyof SummaryGroup)} className="cursor-pointer select-none">
                Topic <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" />
              </TableHead>
              <TableHead>Devices</TableHead>
              <TableHead onClick={() => handleSort('retain' as keyof SummaryGroup)} className="cursor-pointer select-none">Retain <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" /></TableHead>
              <TableHead onClick={() => handleSort('qos' as keyof SummaryGroup)} className="cursor-pointer select-none">QoS <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" /></TableHead>
              <TableHead onClick={() => handleSort('interval' as keyof SummaryGroup)} className="cursor-pointer select-none">Interval <ArrowUpDown className="inline w-4 h-4 ml-1 align-middle" /></TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length ? paginatedData.map((g,i)=>(
              <TableRow key={i}>
                <TableCell>{g.summary_topic}</TableCell>
                <TableCell>{g.included_devices.map(d=>d.name).join(", ")}</TableCell>
                <TableCell>{g.retain? "✔️":"❌"}</TableCell>
                <TableCell>{g.qos}</TableCell>
                <TableCell>{g.interval}s</TableCell>
                <TableCell>
                  <Button size="icon" onClick={()=>openEditor(i)}><Edit2 className="w-4 h-4" /></Button>
                  <Button size="icon" variant="destructive" onClick={()=>deleteGroup(i)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No custom payload configuration data. Click "Create New Data" to add a new configuration.
                </TableCell>
              </TableRow>
            )}
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

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editIndex===null ? "Add Custom Payload" : "Edit Custom Payload"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Input placeholder="Summary Topic" value={summaryTopic} onChange={e=>setSummaryTopic(e.target.value)}/>
              <div className="flex gap-2">
                <Input placeholder="QoS" type="number" value={qos} onChange={e=>setQos(Number(e.target.value))}/>
                <Input placeholder="Interval" type="number" value={interval} onChange={e=>setIntervalValue(Number(e.target.value))}/>
                <label className="flex items-center gap-2 text-sm font-medium leading-none">
                  <input type="checkbox" checked={retain} onChange={e=>setRetain(e.target.checked)}/> Retain
                </label>
              </div>
              {devices.map((d,di)=>(
                <div key={di} className="space-y-1 border p-2 rounded-md">
                  <div className="flex items-center justify-between">
                    <select className="border rounded p-1 text-sm" value={d.name} onChange={e=>{
                      const nd = [...devices];
                      nd[di].name = e.target.value;
                      nd[di].keyOptions = devicesInfo.find(x=>x.name===e.target.value)?.keyOptions||[];
                      nd[di].value_keys = [{key:"", value:""}]; // Reset keys when device changes
                      setDevices(nd);
                    }}>
                      <option value="">Select Device</option>
                      {devicesInfo.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}
                    </select>
                    {devices.length > 1 && (
                       <Button variant="destructive" size="sm" onClick={() => {
                         const nd = [...devices];
                         nd.splice(di, 1);
                         setDevices(nd);
                       }}>Remove Device</Button>
                    )}
                  </div>
                  <Input placeholder="Value Group (Optional)" value={d.value_group || ""} onChange={e => {
                    const nd = [...devices];
                    nd[di].value_group = e.target.value;
                    setDevices(nd);
                  }} className="mt-2" />
                  <h5 className="text-sm font-semibold mt-2">Value Keys:</h5>
                  {d.value_keys.map((kv,ki)=>(
                    <div key={ki} className="flex gap-2 items-center">
                      <select className="border rounded p-1 text-sm flex-1" value={kv.key}
                        onChange={e=>{
                          const nd=[...devices];
                          nd[di].value_keys[ki].key=e.target.value; setDevices(nd);
                        }}>
                        <option value="">Select Key</option>
                        {d.keyOptions.map(k=> <option key={k} value={k}>{k}</option>)}
                      </select>
                      <Input placeholder="Assign Value" value={kv.value} className="flex-1"
                        onChange={e=>{
                          const nd=[...devices];
                          nd[di].value_keys[ki].value=e.target.value;
                          setDevices(nd);
                        }}/>
                      <Button variant="destructive" size="icon" onClick={()=> {
                        const nd=[...devices];
                        nd[di].value_keys.splice(ki,1);
                        setDevices(nd);
                      }}>×</Button>
                    </div>
                  ))}
                  <Button size="sm" variant="secondary" onClick={()=> {
                    const nd=[...devices];
                    nd[di].value_keys.push({key:"",value:""});
                    setDevices(nd);
                  }}>Add Key</Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={()=> setDevices([...devices, { name:"", keyOptions:[], value_keys:[{key:"",value:""}] }])} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Device
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={saveGroup}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}