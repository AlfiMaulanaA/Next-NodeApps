"use client";
import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
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

  const clientRef = useRef<mqtt.MqttClient>();

  useEffect(() => {
    const cl = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_BROKER_URL!);
    cl.on("connect", () => {
      setStatus("connected");
      cl.subscribe("config/device_info/response");
      cl.subscribe("config/summary_device/response");
      cl.publish("config/device_info", JSON.stringify({ command: "getDeviceInfo" }));
    });
    cl.on("error", () => setStatus("error"));
    cl.on("close", () => setStatus("disconnected"));
    cl.on("message", (_, buf) => {
      const msg = JSON.parse(buf.toString());
      if (_.endsWith("/device_info/response")) setDevicesInfo(msg);
      if (_.endsWith("/summary_device/response")) setConfig(msg);
    });
    clientRef.current = cl;
    return () => { cl.end(); };
  }, []);

  // Load device keys from devices.json and merge into devicesInfo
  useEffect(() => {
    if (!devicesInfo.length) return;
    axios.get("/devices.json").then(res => {
      const keys: Record<string, string[]> = {};
      Object.entries(res.data).forEach(([_, devices]: any) => {
        devices.forEach((device: any) => {
          keys[device.name] = device.data.map((item: any) => item.var_name);
        });
      });
      setDevicesInfo(devicesInfo.map(d => ({ ...d, keyOptions: keys[d.name] || [] })));
    });
    // eslint-disable-next-line
  }, [devicesInfo.length]);

  const openEditor = (idx?: number) => {
    if (idx !== undefined && config) {
      const g = config.groups[idx];
      setSummaryTopic(g.summary_topic);
      setRetain(g.retain);
      setQos(g.qos);
      setIntervalValue(g.interval);
      setDevices(g.included_devices.map(d => ({
        ...d,
        keyOptions: devicesInfo.find(x=>x.name===d.name)?.keyOptions||[],
      })));
      setEditIndex(idx);
    } else {
      setSummaryTopic(""); setRetain(false);
      setQos(0); setIntervalValue(10);
      setDevices([{ name:"", keyOptions: [], value_keys:[{key:"",value:""}] }]);
      setEditIndex(null);
    }
    setModalOpen(true);
  };

  const saveGroup = () => {
    const payload = {
      command: editIndex===null ? "writeData" : "updateData",
      data: {
        summary_topic: summaryTopic,
        retain, qos, interval,
        included_devices: devices.map(d=>({
          name:d.name,
          value_group:d.value_group,
          value_keys:Object.fromEntries(d.value_keys.map(kv=>[kv.key,kv.value])),
        })),
      }
    };
    clientRef.current?.publish("config/summary_device", JSON.stringify(payload));
    setModalOpen(false);
    toast.success("Summary saved");
    clientRef.current?.publish("config/summary_device", JSON.stringify({ command: "getData" }));
  };

  const deleteGroup = (idx:number) => {
    const topic = config?.groups[idx].summary_topic;
    clientRef.current?.publish("config/summary_device", JSON.stringify({ command:"deleteData", data:{ summary_topic:topic } }));
    toast.success("Deleted");
    clientRef.current?.publish("config/summary_device", JSON.stringify({ command:"getData" }));
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
                  <Button size="icon" onClick={()=>openEditor(i)}><Edit2/></Button>
                  <Button size="icon" variant="destructive" onClick={()=>deleteGroup(i)}><Trash2/></Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Tidak ada data konfigurasi custom payload. Klik "Add Data" untuk menambah konfigurasi baru.
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
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={retain} onChange={e=>setRetain(e.target.checked)}/> Retain
                </label>
              </div>
              {devices.map((d,di)=>(
                <div key={di} className="space-y-1 border p-2">
                  <select className="border rounded p-1" value={d.name} onChange={e=>{
                    const nd = [...devices];
                    nd[di].name = e.target.value;
                    nd[di].keyOptions = devicesInfo.find(x=>x.name===e.target.value)?.keyOptions||[];
                    setDevices(nd);
                  }}>
                    <option value="">Select Device</option>
                    {devicesInfo.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}
                  </select>
                  {d.value_keys.map((kv,ki)=>(
                    <div key={ki} className="flex gap-2">
                      <select className="border rounded p-1" value={kv.key}
                        onChange={e=>{
                          const nd=[...devices];
                          nd[di].value_keys[ki].key=e.target.value; setDevices(nd);
                        }}>
                        <option value="">Key</option>
                        {d.keyOptions.map(k=> <option key={k}>{k}</option>)}
                      </select>
                      <Input placeholder="Value" value={kv.value}
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
              <Button size="sm" variant="secondary" onClick={()=> setDevices([...devices, { name:"", keyOptions:[], value_keys:[{key:"",value:""}] }])}>
                <PlusCircle /> Add Device
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
