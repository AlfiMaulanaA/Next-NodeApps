"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MqttStatus from "@/components/mqtt-status";
import { toast } from "sonner";
import Swal from 'sweetalert2';
import {
  Trash2,
  Download,
  FileWarning,
  ArrowUpDown,
  AlertTriangle,
  CircleAlert,
  Bug,
  BarChart3,
  CheckCircle,
  MessageSquareOff,
  RefreshCw,
  PieChart,
  TrendingUp,
  Calendar,
  Filter,
  Search,
  Activity,
  Clock,
  Target
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
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";

// --- UPDATED INTERFACE FOR NEW FIELDS (id, source, status, resolved_at) ---
interface ErrorLog {
  id: string; // Unique ID from backend
  data: string;
  type: string;
  Timestamp: string;
  source?: string; // Optional: Source of the error
  status?: "active" | "resolved"; // New: Status of the error
  resolved_at?: string; // New: Timestamp when resolved
}

export default function ErrorLogPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const clientRef = useRef<MqttClient | null>(null);

  const logsPerPage = 10;

  // Filtered logs based on search and filters
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.data.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.source && log.source.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter(log => log.type.toLowerCase() === filterType.toLowerCase());
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(log => {
        const status = log.status || "active";
        return status === filterStatus;
      });
    }

    // Date range filter
    if (dateRange !== "all") {
      const now = new Date();
      const filterDate = new Date();

      switch (dateRange) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      if (dateRange !== "all") {
        filtered = filtered.filter(log => {
          const logDate = new Date(log.Timestamp);
          return logDate >= filterDate;
        });
      }
    }

    return filtered;
  }, [logs, searchTerm, filterType, filterStatus, dateRange]);

  const { sorted, handleSort, sortField, sortDirection } = useSortableTable(filteredLogs);

  const refreshLogs = useCallback(() => {
    const client = getMQTTClient();
    if (!client || !client.connected) {
      toast.warning("MQTT not connected. Cannot refresh logs.");
      return;
    }
    // Asumsi: Backend akan mengirim ulang semua log saat ada koneksi atau permintaan,
    // atau Anda perlu menambahkan topik/perintah spesifik untuk "refresh" jika diperlukan.
    // Saat ini, log akan otomatis di-update saat MQTT connect atau backend publish data baru.
    toast.info("Attempting to refresh error logs (data will update automatically)...");
  }, []);

  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const topicsToSubscribe = ["subrack/error/data", "subrack/error/log"];

    topicsToSubscribe.forEach((topic) => {
      mqttClientInstance.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });

    const handleConnect = () => {
      toast.success("MQTT Connected for Error Logs. Data will update automatically.");
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      toast.error(`MQTT Error: ${err.message}`);
    };

    const handleClose = () => {
      toast.warning("MQTT disconnected. Log data may be outdated.");
    };

    const handleMessage = (topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString());
        if (topic === "subrack/error/data") {
          if (Array.isArray(data)) {
            const ignoredErrorPattern = "MODULAR I2C cannot connect to server broker mqtt";
            const filteredLogs = data.filter((logItem: ErrorLog) => {
              return logItem.data && !logItem.data.includes(ignoredErrorPattern);
            });
            setLogs(filteredLogs);
            toast.success("Error logs updated. ✔️");
          } else {
            toast.error("Received invalid log data format. ⚠️");
            console.warn("Expected array for logs, got:", data);
          }
          setCurrentPage(1); // Reset to first page on new data
        } else if (topic === "subrack/error/log") {
          console.log("Raw incoming error log:", data);
        }
      } catch (err) {
        toast.error("Invalid payload format received from MQTT. ❌");
        console.error("MQTT message parsing error:", err);
      }
    };

    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (clientRef.current?.connected) {
        topicsToSubscribe.forEach((topic) => {
          clientRef.current?.unsubscribe(topic);
        });
      }
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
    };
  }, []);

  const deleteAllLogs = useCallback(async () => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You are about to delete ALL error logs. This action cannot be undone!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete all!',
      reverseButtons: true, // Puts confirm button on the left
    });

    if (result.isConfirmed) {
      if (clientRef.current?.connected) {
        toast.info("Sending command to delete all logs...");
        clientRef.current.publish(
          "subrack/error/data/delete/all",
          JSON.stringify({ command: "delete_all" }),
          (err) => {
            if (err) {
              toast.error(`Failed to send delete all command: ${err.message} 🚫`);
              console.error("Publish error:", err);
              Swal.fire('Failed!', 'Could not send delete command.', 'error');
            } else {
              // Sukses toast akan muncul saat backend merespons dengan data baru (kosong)
              Swal.fire('Initiated!', 'Delete all logs command sent. Table will refresh shortly.', 'success');
            }
          }
        );
      } else {
        toast.error("MQTT not connected to send delete command. 🚨");
        Swal.fire('Error!', 'MQTT not connected.', 'error');
      }
    } else {
        toast.info("Delete all logs cancelled.");
    }
  }, []);

  const deleteErrorByMessage = useCallback(async (messageToDelete: string) => {
    const result = await Swal.fire({
      title: 'Delete specific logs?',
      html: `You are about to delete all logs with the message:<br><strong>"${messageToDelete}"</strong>.<br>This action cannot be undone for these specific logs!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete them!',
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      if (clientRef.current?.connected) {
        toast.info(`Sending command to delete logs with message: "${messageToDelete}"`);
        clientRef.current.publish(
          "subrack/error/data/delete/by_message",
          JSON.stringify({ message: messageToDelete }),
          (err) => {
            if (err) {
              toast.error(`Failed to send delete by message command: ${err.message} 🚫`);
              console.error("Publish error:", err);
              Swal.fire('Failed!', 'Could not send delete by message command.', 'error');
            } else {
              // Sukses toast akan muncul saat backend merespons dengan data baru (tanpa log yang dihapus)
              Swal.fire('Initiated!', 'Delete by message command sent. Table will refresh shortly.', 'success');
            }
          }
        );
      } else {
        toast.error("MQTT not connected to send delete by message command. 🚨");
        Swal.fire('Error!', 'MQTT not connected.', 'error');
      }
    } else {
        toast.info("Delete by message cancelled.");
    }
  }, []);

  const resolveError = useCallback(async (errorId: string) => {
    const result = await Swal.fire({
      title: 'Mark as Resolved?',
      text: "This action will mark the error as resolved in the system.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, resolve it!',
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      if (clientRef.current?.connected) {
        toast.info(`Sending command to resolve error ID: ${errorId}`);
        clientRef.current.publish(
          "subrack/error/data/resolve",
          JSON.stringify({ id: errorId }),
          (err) => {
            if (err) {
              toast.error(`Failed to send resolve command: ${err.message} 🚫`);
              console.error("Publish error:", err);
              Swal.fire('Failed!', 'Could not send resolve command.', 'error');
            } else {
              // Sukses toast akan muncul saat backend merespons dengan data baru
              Swal.fire('Initiated!', 'Resolve command sent. Table will refresh shortly.', 'success');
            }
          }
        );
      } else {
        toast.error("MQTT not connected to send resolve command. 🚨");
        Swal.fire('Error!', 'MQTT not connected.', 'error');
      }
    } else {
        toast.info("Resolve action cancelled.");
    }
  }, []);

  const exportExcel = useCallback(() => {
    if (logs.length === 0) {
      toast.info("No logs to export. 📝");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "ErrorLogs.xlsx");
    toast.success("Logs exported to Excel. 📊");
  }, [logs]);

  const totalPages = Math.ceil(sorted.length / logsPerPage);
  const currentLogs = sorted.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

  const getTypeBadge = (type: string, status?: string) => {
    const t = type.toLowerCase();
    const s = status?.toLowerCase();

    if (s === "resolved") {
      return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-500">Resolved</Badge>;
    }
    if (t === "critical") return <Badge variant="destructive">{type}</Badge>;
    if (t === "major")
      return (
        <Badge variant="outline" className="bg-orange-300 border-orange-600 text-orange-600">
          {type}
        </Badge>
      );
    return <Badge variant="secondary">{type}</Badge>;
  };

  const getTypeIcon = (type: string, status?: string) => {
    const t = type.toLowerCase();
    const s = status?.toLowerCase();

    if (s === "resolved") return <CheckCircle className="text-green-500 w-4 h-4 mr-1" />;
    if (t === "critical") return <CircleAlert className="text-red-500 w-4 h-4 mr-1" />;
    if (t === "major") return <AlertTriangle className="text-orange-500 w-4 h-4 mr-1" />;
    return <Bug className="text-muted-foreground w-4 h-4 mr-1" />;
  };

  // Enhanced analytics
  const analytics = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    const hourlyDistribution: Record<number, number> = {};
    const dailyTrends: Record<string, number> = {};
    let activeTotal = 0;
    let resolvedTotal = 0;

    // Initialize hourly distribution
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0;
    }

    filteredLogs.forEach((log) => {
      const t = log.type.toLowerCase();
      const source = log.source || "unknown";
      const logDate = new Date(log.Timestamp);
      const hour = logDate.getHours();
      const dayKey = logDate.toISOString().split('T')[0];

      // Type counts
      counts[t] = (counts[t] || 0) + 1;

      // Source counts
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;

      // Hourly distribution
      hourlyDistribution[hour]++;

      // Daily trends (last 7 days)
      dailyTrends[dayKey] = (dailyTrends[dayKey] || 0) + 1;

      // Status counts
      if (log.status === "resolved") {
        resolvedTotal++;
      } else {
        activeCounts[t] = (activeCounts[t] || 0) + 1;
        activeTotal++;
      }
    });

    const mostCommonActive = Object.entries(activeCounts).sort((a, b) => b[1] - a[1])[0];
    const mostActiveSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];

    // Calculate resolution rate
    const resolutionRate = logs.length > 0 ? (resolvedTotal / logs.length) * 100 : 0;

    return {
      total: filteredLogs.length,
      totalAll: logs.length,
      activeTotal,
      resolvedTotal,
      resolutionRate,
      counts,
      activeCounts,
      sourceCounts,
      hourlyDistribution,
      dailyTrends,
      mostCommonActive,
      mostActiveSource,
    };
  }, [filteredLogs, logs]);

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
          <Button variant="outline" size="icon" onClick={refreshLogs} title="Refresh Logs">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Quick Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalAll}</div>
              <p className="text-xs text-muted-foreground">All time errors</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Errors</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.activeTotal}</div>
              <p className="text-xs text-muted-foreground">Unresolved issues</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.resolvedTotal}</div>
              <p className="text-xs text-muted-foreground">Successfully resolved</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
              <Target className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.resolutionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Success rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileWarning className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Error Distribution by Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.counts).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(type)}
                          <span className="capitalize font-medium">{type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(count / analytics.total) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Error Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.sourceCounts).slice(0, 6).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between">
                        <span className="font-medium truncate">{source}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(count / analytics.total) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Active vs Resolved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-red-600">Active</span>
                        <span className="text-sm font-semibold">{analytics.activeTotal}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-red-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${analytics.totalAll > 0 ? (analytics.activeTotal / analytics.totalAll) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-green-600">Resolved</span>
                        <span className="text-sm font-semibold">{analytics.resolvedTotal}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-green-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${analytics.totalAll > 0 ? (analytics.resolvedTotal / analytics.totalAll) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="h-5 w-5" />
                    Most Critical Active
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.mostCommonActive ? (
                    <div className="text-center space-y-2">
                      <div className="text-3xl">
                        {getTypeIcon(analytics.mostCommonActive[0], "active")}
                      </div>
                      <div className="font-semibold capitalize">{analytics.mostCommonActive[0]}</div>
                      <div className="text-2xl font-bold">{analytics.mostCommonActive[1]}</div>
                      <div className="text-sm text-muted-foreground">Active errors</div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      No active errors
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Most Active Source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.mostActiveSource ? (
                    <div className="text-center space-y-2">
                      <div className="text-3xl">🔧</div>
                      <div className="font-semibold truncate">{analytics.mostActiveSource[0]}</div>
                      <div className="text-2xl font-bold">{analytics.mostActiveSource[1]}</div>
                      <div className="text-sm text-muted-foreground">Total errors</div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      No error sources
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Error Distribution by Hour (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(analytics.hourlyDistribution).map(([hour, count]) => (
                    <div key={hour} className="flex items-center gap-3">
                      <span className="text-xs w-8 text-right">{hour}:00</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Object.values(analytics.hourlyDistribution).length > 0 ? 
                              (count / Math.max(...Object.values(analytics.hourlyDistribution))) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                      <span className="text-xs w-6 text-left">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Daily Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.dailyTrends)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 7)
                    .map(([date, count]) => (
                    <div key={date} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{new Date(date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Object.values(analytics.dailyTrends).length > 0 ? 
                                (count / Math.max(...Object.values(analytics.dailyTrends))) * 100 : 0}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters & Search
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search errors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="minor">Minor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">Last 7 Days</SelectItem>
                        <SelectItem value="month">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

        {/* Table Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base">Error Logs</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={deleteAllLogs} title="Delete all logs" disabled={logs.length === 0}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete All
              </Button>
              <Button size="sm" variant="secondary" onClick={exportExcel} title="Export logs to Excel" disabled={logs.length === 0}>
                <Download className="w-4 h-4 mr-1" /> Export to Excel
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <Table className="bg-background mt-4">
              <TableCaption>Error logs from your devices. Export, clear, or manage as needed.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("source")}>
                    Source <ArrowUpDown className="inline w-4 h-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("data")}>
                    Data <ArrowUpDown className="inline w-4 h-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("type")}>
                    Type <ArrowUpDown className="inline w-4 h-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("Timestamp")}>
                    Timestamp <ArrowUpDown className="inline w-4 h-4 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                    Status <ArrowUpDown className="inline w-4 h-4 ml-1" />
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      <MessageSquareOff className="w-8 h-8 mx-auto mb-2" />
                      No logs available.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentLogs.map((log, i) => (
                    <TableRow key={log.id || i}>
                      <TableCell>{(currentPage - 1) * logsPerPage + i + 1}</TableCell>
                      <TableCell>{log.source || "N/A"}</TableCell>
                      <TableCell className="max-w-xs truncate" title={log.data}>{log.data}</TableCell>
                      <TableCell>{getTypeBadge(log.type, log.status)}</TableCell>
                      <TableCell>{log.Timestamp}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === "resolved" ? "outline" : "default"}
                               className={log.status === "resolved" ? "bg-green-100 text-green-700 border-green-500" : "bg-red-100 text-red-700 border-red-500"}>
                          {log.status || "active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2">
                        {log.status !== "resolved" && (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => resolveError(log.id)}
                            title="Mark as Resolved"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => deleteErrorByMessage(log.data)}
                          title="Delete all with this message"
                        >
                          <MessageSquareOff className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
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
          </TabsContent>
        </Tabs>
      </div>
    </SidebarInset>
  );
}