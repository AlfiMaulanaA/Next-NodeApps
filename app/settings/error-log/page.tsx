"use client";

import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import * as XLSX from "xlsx";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Trash2,
  Download,
  Wifi,
  WifiOff,
  Loader2,
  FileWarning,
  ChevronsLeft,
  ChevronsRight,
  RotateCw,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

interface ErrorLog {
  data: string;
  type: string;
  Timestamp: string;
}

export default function ErrorLogPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    const client = mqtt.connect(`${process.env.NEXT_PUBLIC_MQTT_BROKER_URL}`);

    client.on("connect", () => {
      setStatus("connected");
      client.subscribe("subrack/error/data");
      client.subscribe("subrack/error/data/delete");
    });

    client.on("error", () => setStatus("error"));
    client.on("close", () => setStatus("disconnected"));

    client.on("message", (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (topic === "subrack/error/data/delete" && data.command === "delete") {
          setLogs([]);
        } else {
          setLogs(Array.isArray(data) ? data : []);
        }
        setCurrentPage(1);
      } catch {
        toast.error("Invalid payload format");
      }
    });

    clientRef.current = client;
    return () => {
      client.end();
    };
  }, []);

  const totalPages = Math.ceil(logs.length / logsPerPage);
  const currentLogs = logs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

  const renderStatusIcon = () => {
    if (status === "connected") return <Wifi className="w-4 h-4 text-green-500" />;
    if (status === "error") return <WifiOff className="w-4 h-4 text-red-500" />;
    return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
  };

  const getTypeBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t === "critical") return <Badge variant="destructive">{type}</Badge>;
    if (t === "major") return <Badge variant="outline" className="text-orange-600 border-orange-600">{type}</Badge>;
    return <Badge variant="secondary">{type}</Badge>;
  };

  const deleteAll = () => {
    clientRef.current?.publish("subrack/error/data/delete", JSON.stringify({ command: "delete" }));
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "ErrorLogs.xlsx");
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4 bg-muted/40">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <FileWarning className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Error Log Viewer</h1>
        </div>
        <div className="flex items-center gap-2">
          {renderStatusIcon()}
          <span className="capitalize text-sm">{status}</span>
          <Button variant="outline" size="icon" onClick={() => window.location.reload()} title="Reload">
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Error Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-end gap-2 mb-3">
              <Button size="sm" variant="destructive" onClick={deleteAll} title="Delete all logs">
                <Trash2 className="w-4 h-4 mr-1" /> Delete All
              </Button>
              <Button size="sm" variant="secondary" onClick={exportExcel} title="Export logs to Excel">
                <Download className="w-4 h-4 mr-1" /> Export to Excel
              </Button>
            </div>

            <Table className="border rounded-md bg-background">
              <TableCaption>Error logs from your devices. Export or clear as needed.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentLogs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell>{(currentPage - 1) * logsPerPage + i + 1}</TableCell>
                    <TableCell className="max-w-xs truncate" title={log.data}>{log.data}</TableCell>
                    <TableCell>{getTypeBadge(log.type)}</TableCell>
                    <TableCell>{log.Timestamp}</TableCell>
                  </TableRow>
                ))}
                {currentLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      No logs available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
                <span className="text-sm text-muted-foreground">
                  Showing <b>{currentLogs.length}</b> of <b>{logs.length}</b> entries
                </span>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button
                      key={i}
                      size="icon"
                      variant={currentPage === i + 1 ? "default" : "ghost"}
                      onClick={() => setCurrentPage(i + 1)}
                      aria-label={`Page ${i + 1}`}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}
