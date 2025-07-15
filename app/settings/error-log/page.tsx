"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mqtt from "mqtt";
import * as XLSX from "xlsx";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MqttStatus from "@/components/mqtt-status";
import { toast } from "sonner";
import {
  Trash2,
  Download,
  FileWarning,
  RotateCw,
  ArrowUpDown,
  AlertTriangle,
  CircleAlert,
  Bug,
  BarChart3, Hash,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { useSortableTable } from "@/hooks/use-sort-table";

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

  const { sorted, handleSort, sortField, sortDirection } = useSortableTable(logs);

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

  const deleteAll = () => {
    clientRef.current?.publish("subrack/error/data/delete", JSON.stringify({ command: "delete" }));
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "ErrorLogs.xlsx");
  };

  const totalPages = Math.ceil(sorted.length / logsPerPage);
  const currentLogs = sorted.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

  const getTypeBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t === "critical") return <Badge variant="destructive">{type}</Badge>;
    if (t === "major")
      return (
        <Badge variant="outline" className="bg-orange-300 border-orange-600 text-orange-600">
          {type}
        </Badge>
      );
    return <Badge variant="secondary">{type}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t === "critical") return <CircleAlert className="text-red-500 w-4 h-4 mr-1" />;
    if (t === "major") return <AlertTriangle className="text-orange-500 w-4 h-4 mr-1" />;
    return <Bug className="text-muted-foreground w-4 h-4 mr-1" />;
  };

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((log) => {
      const t = log.type.toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    });
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return {
      total: logs.length,
      counts,
      mostCommon,
    };
  }, [logs]);

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <FileWarning className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Error Log Viewer</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button variant="outline" size="icon" onClick={() => window.location.reload()} title="Reload">
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {/* Summary Cards */}
       
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  {/* Card 1: Total Errors */}
  <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Erros</CardTitle>
                  <Hash className="h-5 w-5 text-green-600" />
                </CardHeader>
    <CardContent>
              <div className="text-3xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">Error System Logs</p>
    </CardContent>
  </Card>

  {/* Card 2: By Type */}
  <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">By Type</CardTitle>
      <BarChart3 className="h-5 w-5 text-green-600" />
    </CardHeader>
            
    <CardContent className="space-y-1">
      {Object.entries(summary.counts).map(([type, count]) => (
        <div key={type} className="flex items-center gap-2">
          {getTypeIcon(type)}
          <span className="capitalize">{type}</span>: {count}
        </div>
      ))}
              <p className="text-xs text-muted-foreground">All type error</p>
    </CardContent>
  </Card>

  {/* Card 3: Most Common */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Most Common</CardTitle>
                <AlertTriangle className="h-5 w-5 text-green-600" />
              </CardHeader>
    
    <CardContent>
      {summary.mostCommon ? (
        <div className="flex items-center gap-2">
          {getTypeIcon(summary.mostCommon[0])}
          <span className="capitalize font-semibold">
            {summary.mostCommon[0]} ({summary.mostCommon[1]})
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground">No data</span>
              )}
              <p className="text-xs text-muted-foreground">Most Common Errors</p>
    </CardContent>
  </Card>
</div>


        {/* Table Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base">Error Logs</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={deleteAll} title="Delete all logs">
                <Trash2 className="w-4 h-4 mr-1" /> Delete All
              </Button>
              <Button size="sm" variant="secondary" onClick={exportExcel} title="Export logs to Excel">
                <Download className="w-4 h-4 mr-1" /> Export to Excel
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <Table className="bg-background mt-4">
              <TableCaption>Error logs from your devices. Export or clear as needed.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("data")}>Data <ArrowUpDown className="inline w-4 h-4 ml-1" /></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("type")}>Type <ArrowUpDown className="inline w-4 h-4 ml-1" /></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("Timestamp")}>Timestamp <ArrowUpDown className="inline w-4 h-4 ml-1" /></TableHead>
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

            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink href="#" isActive={currentPage === i + 1} onClick={() => setCurrentPage(i + 1)}>
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext href="#" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}
