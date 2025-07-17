"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react"; // Add useCallback
import * as XLSX from "xlsx";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BarChart3,
  Hash,
  Loader2, // Import Loader2 for loading state
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
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient"; // Ensure getMQTTClient is imported
import type { MqttClient } from "mqtt";

interface ErrorLog {
  data: string;
  type: string;
  Timestamp: string;
}

export default function ErrorLogPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true); // New loading state
  const logsPerPage = 10;
  const clientRef = useRef<MqttClient | null>(null); // Use MqttClient type

  const { sorted, handleSort, sortField, sortDirection } = useSortableTable(logs);

  // Function to request all logs from the device
  const requestAllLogs = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.warning("MQTT not connected. Cannot request logs.");
      setIsLoading(false); // Stop loading if not connected
      return;
    }
    setIsLoading(true); // Start loading state
    setTimeout(() => {
      client.publish("subrack/error/data/request", JSON.stringify({ command: "get_all" }));
      toast.info("Requesting error logs from device...");
    }, 300); // Small delay to ensure subscription is active
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    // If client is already connected on mount, request logs immediately
    if (mqttClientInstance.connected) {
      requestAllLogs();
    }

    // Subscribe to topics immediately
    mqttClientInstance.subscribe("subrack/error/data", (err) => {
      if (err) console.error("Failed to subscribe to subrack/error/data:", err);
    });
    mqttClientInstance.subscribe("subrack/error/data/delete", (err) => {
      if (err) console.error("Failed to subscribe to subrack/error/data/delete:", err);
    });

    const handleConnect = () => {
      // Re-subscribe on connect (though mqtt.js often handles this)
      mqttClientInstance.subscribe("subrack/error/data");
      mqttClientInstance.subscribe("subrack/error/data/delete");
      requestAllLogs(); // Request logs every time connection is established (including re-connects)
      toast.success("MQTT Connected for Error Logs. Fetching data...");
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      // setStatus("error"); // MqttStatus component already handles this internally
      toast.error(`MQTT Error: ${err.message}`);
      setIsLoading(false); // Stop loading on error
    };

    const handleClose = () => {
      // setStatus("disconnected"); // MqttStatus component already handles this internally
      toast.warning("MQTT disconnected. Log data may be outdated.");
      setIsLoading(false); // Stop loading on close
    };

    const handleMessage = (topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString());
        if (topic === "subrack/error/data/delete") {
          if (data.command === "delete_success") {
            setLogs([]);
            toast.success("All logs deleted successfully. 🗑️");
          } else {
            toast.error(data.message || "Failed to delete logs.");
          }
          setIsLoading(false); // Stop loading after delete response
        } else if (topic === "subrack/error/data") {
          if (Array.isArray(data)) {
            setLogs(data);
            toast.success("Error logs updated. ✔️");
          } else {
            toast.error("Received invalid log data format. ⚠️");
            console.warn("Expected array for logs, got:", data);
          }
          setCurrentPage(1); // Reset to first page on log update
          setIsLoading(false); // Stop loading after data is received
        }
      } catch (err) {
        toast.error("Invalid payload format received from MQTT. ❌");
        console.error("MQTT message parsing error:", err);
        setIsLoading(false); // Stop loading on parsing error
      }
    };

    // Attach event listeners
    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    // Cleanup function
    return () => {
      if (clientRef.current?.connected) { // Only unsubscribe if connected
        clientRef.current.unsubscribe("subrack/error/data");
        clientRef.current.unsubscribe("subrack/error/data/delete");
      }
      // Detach all listeners to prevent memory leaks
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
      // Do NOT call client.end() here; it's managed globally by mqttClient.ts.
    };
  }, [requestAllLogs]); // Add requestAllLogs as a dependency

  const deleteAll = () => {
    // Publish a command to delete all logs
    if (clientRef.current?.connected) {
      toast.info("Sending command to delete all logs...");
      clientRef.current.publish("subrack/error/data/command", JSON.stringify({ command: "delete_all" }), (err) => {
        if (err) {
          toast.error(`Failed to send delete command: ${err.message} 🚫`);
          console.error("Publish error:", err);
        }
      });
    } else {
      toast.error("MQTT not connected to send delete command. 🚨");
    }
  };

  const exportExcel = () => {
    if (logs.length === 0) {
      toast.info("No logs to export. 📝");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "ErrorLogs.xlsx");
    toast.success("Logs exported to Excel. 📊");
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
          <Button variant="outline" size="icon" onClick={requestAllLogs} title="Refresh Logs" disabled={isLoading}>
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Errors */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
              <Hash className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">System Logs</p>
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
              <p className="text-xs text-muted-foreground">All error types</p>
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
              <p className="text-xs text-muted-foreground">Most frequent errors</p>
            </CardContent>
          </Card>
        </div>

        {/* Table Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base">Error Logs</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={deleteAll} title="Delete all logs" disabled={logs.length === 0 || isLoading}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete All
              </Button>
              <Button size="sm" variant="secondary" onClick={exportExcel} title="Export logs to Excel" disabled={logs.length === 0}>
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
                  <TableHead className="cursor-pointer" onClick={() => handleSort("data")}>
                    Data <ArrowUpDown className="inline w-4 h-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("type")}>
                    Type <ArrowUpDown className="inline w-4 h-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("Timestamp")}>
                    Timestamp <ArrowUpDown className="inline w-4 h-4 ml-1" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-blue-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Fetching logs...
                    </TableCell>
                  </TableRow>
                ) : currentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      No logs available.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentLogs.map((log, i) => (
                    <TableRow key={i}>
                      <TableCell>{(currentPage - 1) * logsPerPage + i + 1}</TableCell>
                      <TableCell className="max-w-xs truncate" title={log.data}>{log.data}</TableCell>
                      <TableCell>{getTypeBadge(log.type)}</TableCell>
                      <TableCell>{log.Timestamp}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && !isLoading && (
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