"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { connectMQTT } from "@/lib/mqttClient";
import { MqttClient } from "mqtt";
import { toast } from "sonner";
import { showToast } from "@/lib/toast-utils";
import {
  ConfirmationDialog,
  useConfirmationDialog,
} from "@/components/ui/confirmation-dialog";

// UI Components
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  AlertOctagon,
  Search,
  RefreshCw,
  Download,
  Trash2,
  ChevronDown,
  Filter,
  Calendar,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  BarChart3,
  PieChart,
  Dot,
  ArrowUpRight,
  TargetIcon,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MqttStatus from "@/components/mqtt-status";

// Type definitions
interface ErrorLog {
  id: string;
  data: string;
  type: "CRITICAL" | "ERROR" | "WARNING" | "INFO" | "MAJOR" | "MINOR";
  source: string;
  Timestamp: string;
  status: string;
  [key: string]: any; // Additional fields
}

interface ErrorStats {
  critical: number;
  error: number;
  warning: number;
  info: number;
  total: number;
  topService: string;
  topError: string;
}

const ITEMS_PER_PAGE = 15;
const ERROR_LOG_TOPIC = "subrack/error/log";

// Color mapping for error types
const getErrorColor = (type: string) => {
  const typeMap: Record<
    string,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    CRITICAL: {
      bg: "bg-red-100 dark:bg-red-950",
      text: "text-red-800 dark:text-red-200",
      icon: <AlertOctagon className="h-4 w-4" />,
    },
    ERROR: {
      bg: "bg-orange-100 dark:bg-orange-950",
      text: "text-orange-800 dark:text-orange-200",
      icon: <AlertCircle className="h-4 w-4" />,
    },
    WARNING: {
      bg: "bg-yellow-100 dark:bg-yellow-950",
      text: "text-yellow-800 dark:text-yellow-200",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    INFO: {
      bg: "bg-blue-100 dark:bg-blue-950",
      text: "text-blue-800 dark:text-blue-200",
      icon: <Info className="h-4 w-4" />,
    },
    MAJOR: {
      bg: "bg-red-100 dark:bg-red-950",
      text: "text-red-800 dark:text-red-200",
      icon: <AlertOctagon className="h-4 w-4" />,
    },
    MINOR: {
      bg: "bg-blue-100 dark:bg-blue-950",
      text: "text-blue-800 dark:text-blue-200",
      icon: <Info className="h-4 w-4" />,
    },
  };

  return typeMap[type] || typeMap["INFO"];
};

const ErrorLogPage = () => {
  // MQTT Connection
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isConnected, setIsConnected] = useState(false);

  // Data States
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Confirmation Dialog
  const { confirmationProps, showConfirmation } = useConfirmationDialog();

  // Initialize MQTT Connection
  useEffect(() => {
    const initMQTT = async () => {
      try {
        const client = connectMQTT();
        setMqttClient(client);

        client.on("connect", () => {
          setConnectionStatus("connected");
          setIsConnected(true);
          console.log("MQTT: Error Log - Connected");

          // Subscribe to error log topic
          client.subscribe([ERROR_LOG_TOPIC], (err) => {
            if (err) {
              console.error("Failed to subscribe to error log topic:", err);
            } else {
              console.log("Subscribed to error log topic successfully");
            }
          });
        });

        client.on("disconnect", () => {
          setConnectionStatus("disconnected");
          setIsConnected(false);
          console.log("MQTT: Error Log - Disconnected");
        });

        client.on("error", (error) => {
          console.error("MQTT Error:", error);
          setConnectionStatus("error");
          setIsConnected(false);
        });
      } catch (error) {
        console.error("Failed to initialize MQTT:", error);
        setConnectionStatus("error");
      }
    };

    initMQTT();

    return () => {
      if (mqttClient) {
        mqttClient.removeAllListeners();
      }
    };
  }, []);

  // Message Handlers
  useEffect(() => {
    if (!mqttClient || !isConnected) return;

    const handleErrorLogMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log("MQTT: Error log received:", payload);

        // Add to logs with timestamp when received
        const logWithTimestamp = {
          ...payload,
          receivedAt: new Date().toISOString(),
        };

        setErrorLogs((prevLogs) => [logWithTimestamp, ...prevLogs]);
      } catch (error) {
        console.error("MQTT: Failed to parse error log", error);
      }
    };

    // Set up message handler
    mqttClient.on("message", (topic: string, message: Buffer) => {
      if (topic === ERROR_LOG_TOPIC) {
        handleErrorLogMessage(topic, message);
      }
    });

    return () => {
      if (mqttClient) {
        mqttClient.removeAllListeners("message");
      }
    };
  }, [mqttClient, isConnected]);

  // Get unique sources
  const uniqueSources = useMemo(() => {
    return Array.from(new Set(errorLogs.map((log) => log.source)));
  }, [errorLogs]);

  // Filter and search logic
  const filteredLogs = useMemo(() => {
    return errorLogs.filter((log) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        log.data.toLowerCase().includes(searchLower) ||
        log.source.toLowerCase().includes(searchLower) ||
        log.id.toLowerCase().includes(searchLower);

      // Type filter
      const matchesType = selectedType === "all" || log.type === selectedType;

      // Source filter
      const matchesSource =
        selectedSource === "all" || log.source === selectedSource;

      // Date filter
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const logDate = new Date(log.Timestamp);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && logDate >= fromDate;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && logDate <= toDate;
        }
      }

      return matchesSearch && matchesType && matchesSource && matchesDate;
    });
  }, [errorLogs, searchQuery, selectedType, selectedSource, dateFrom, dateTo]);

  // Calculate statistics
  const stats = useMemo<ErrorStats>(() => {
    const stats = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
      total: errorLogs.length,
      topService: "",
      topError: "",
    };

    const sourceCount: Record<string, number> = {};
    const errorCount: Record<string, number> = {};

    errorLogs.forEach((log) => {
      if (log.type === "CRITICAL") stats.critical++;
      else if (log.type === "ERROR" || log.type === "MAJOR") stats.error++;
      else if (log.type === "WARNING") stats.warning++;
      else if (log.type === "INFO" || log.type === "MINOR") stats.info++;

      // Count by source
      sourceCount[log.source] = (sourceCount[log.source] || 0) + 1;

      // Count by error message
      errorCount[log.data] = (errorCount[log.data] || 0) + 1;
    });

    // Find top service
    let maxSourceCount = 0;
    for (const [source, count] of Object.entries(sourceCount)) {
      if (count > maxSourceCount) {
        maxSourceCount = count;
        stats.topService = source;
      }
    }

    // Find top error
    let maxErrorCount = 0;
    for (const [error, count] of Object.entries(errorCount)) {
      if (count > maxErrorCount) {
        maxErrorCount = count;
        stats.topError = error.substring(0, 50);
      }
    }

    return stats;
  }, [errorLogs]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedType("all");
    setSelectedSource("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }, []);

  // Delete log
  const deleteLog = (id: string) => {
    showConfirmation({
      type: "delete",
      title: "Delete Error Log",
      description: "Are you sure you want to delete this error log?",
      confirmText: "Yes, delete it",
      cancelText: "Cancel",
      destructive: true,
      onConfirm: () => {
        setErrorLogs((prevLogs) => prevLogs.filter((log) => log.id !== id));
        showToast.success("Success", "Error log deleted");
      },
    });
  };

  // Clear all logs
  const clearAllLogs = () => {
    showConfirmation({
      type: "delete",
      title: "Clear All Logs",
      description:
        "Are you sure you want to delete all error logs? This action cannot be undone.",
      confirmText: "Yes, clear all",
      cancelText: "Cancel",
      destructive: true,
      onConfirm: () => {
        setErrorLogs([]);
        setCurrentPage(1);
        showToast.success("Success", "All error logs cleared");
      },
    });
  };

  // Export logs
  const exportLogs = () => {
    const dataToExport = filteredLogs.length > 0 ? filteredLogs : errorLogs;
    const csvContent = [
      ["ID", "Type", "Source", "Message", "Timestamp", "Status"],
      ...dataToExport.map((log) => [
        log.id,
        log.type,
        log.source,
        log.data,
        log.Timestamp,
        log.status,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast.success("Success", "Logs exported to CSV");
  };

  // Toggle row expansion
  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <Dot className="h-3 w-3 absolute -top-1 -right-1 text-green-500 animate-pulse" />
            </div>
            <h1 className="text-lg font-bold">System Error Logs</h1>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-medium">
            Live Monitoring
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setErrorLogs([...errorLogs])}
            title="Refresh logs"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportLogs}
            title="Download as CSV"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearAllLogs}
            disabled={errorLogs.length === 0}
            title="Clear all logs"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </header>

      {/* Filter Section */}
      <div className="px-4 py-4 border-b space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by message, source, or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Type Filter */}
          <Select
            value={selectedType}
            onValueChange={(value) => {
              setSelectedType(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="MAJOR">Major</SelectItem>
              <SelectItem value="MINOR">Minor</SelectItem>
            </SelectContent>
          </Select>

          {/* Source Filter */}
          <Select
            value={selectedSource}
            onValueChange={(value) => {
              setSelectedSource(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {uniqueSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date From */}
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="w-40"
            placeholder="From date"
          />

          {/* Date To */}
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="w-40"
            placeholder="To date"
          />

          {/* Clear Filters */}
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={
              !searchQuery &&
              selectedType === "all" &&
              selectedSource === "all" &&
              !dateFrom &&
              !dateTo
            }
          >
            <Filter className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Statistics Cards - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Critical Card */}
          <Card
            className={`shadow-sm hover:shadow-lg transition-all border-l-4 border-red-500 ${
              stats.critical > 0 ? "bg-red-50 dark:bg-red-950/30" : ""
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Critical</CardTitle>
              <AlertOctagon className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {stats.critical}
              </div>
              <p className="text-xs text-muted-foreground">
                Needs immediate attention
              </p>
              {stats.critical > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                  <ArrowUpRight className="h-3 w-3" /> Action Required
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Card */}
          <Card
            className={`shadow-sm hover:shadow-lg transition-all border-l-4 border-orange-500 ${
              stats.error > 0 ? "bg-orange-50 dark:bg-orange-950/30" : ""
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Errors</CardTitle>
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {stats.error}
              </div>
              <p className="text-xs text-muted-foreground">System issues</p>
            </CardContent>
          </Card>

          {/* Warning Card */}
          <Card
            className={`shadow-sm hover:shadow-lg transition-all border-l-4 border-yellow-500 ${
              stats.warning > 0 ? "bg-yellow-50 dark:bg-yellow-950/30" : ""
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Warnings</CardTitle>
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {stats.warning}
              </div>
              <p className="text-xs text-muted-foreground">Potential issues</p>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="shadow-sm hover:shadow-lg transition-all border-l-4 border-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Info</CardTitle>
              <Info className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {stats.info}
              </div>
              <p className="text-xs text-muted-foreground">
                Informational messages
              </p>
            </CardContent>
          </Card>

          {/* Total Card */}
          <Card className="shadow-sm hover:shadow-lg transition-all border-l-4 border-purple-500 bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Total</CardTitle>
              <Activity className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {stats.total}
              </div>
              <p className="text-xs text-muted-foreground">
                All recorded events
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Issues Summary - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Most Active Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-lg font-bold text-blue-600">
                  {stats.topService || "No data"}
                </p>
                {stats.topService && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${
                              (errorLogs.filter(
                                (l) => l.source === stats.topService
                              ).length /
                                stats.total) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {
                          errorLogs.filter((l) => l.source === stats.topService)
                            .length
                        }
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(
                        (errorLogs.filter((l) => l.source === stats.topService)
                          .length /
                          stats.total) *
                          100
                      )}
                      % of total errors
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-600" />
                Most Common Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-bold text-amber-600 line-clamp-2">
                  {stats.topError || "No data"}
                </p>
                {stats.topError && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-amber-600 h-2 rounded-full"
                          style={{
                            width: `${
                              (errorLogs.filter(
                                (l) => l.data === stats.topError
                              ).length /
                                stats.total) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {
                          errorLogs.filter((l) => l.data === stats.topError)
                            .length
                        }
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {
                        errorLogs.filter((l) => l.data === stats.topError)
                          .length
                      }{" "}
                      occurrences
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Insights */}
        {stats.total > 0 && (
          <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600" />
                Quick Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {stats.critical > 0 && (
                  <li className="flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-600" />
                    <span className="text-red-700 dark:text-red-400">
                      <strong>{stats.critical}</strong> critical issue
                      {stats.critical > 1 ? "s" : ""} require immediate
                      attention
                    </span>
                  </li>
                )}
                {stats.error > 0 && (
                  <li className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span>
                      <strong className="text-orange-700 dark:text-orange-400">
                        {stats.error}
                      </strong>{" "}
                      error{stats.error > 1 ? "s" : ""} in system operations
                    </span>
                  </li>
                )}
                {stats.warning > 0 && (
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span>
                      <strong className="text-yellow-700 dark:text-yellow-400">
                        {stats.warning}
                      </strong>{" "}
                      warning{stats.warning > 1 ? "s" : ""} about potential
                      issues
                    </span>
                  </li>
                )}
                {stats.critical === 0 &&
                  stats.error === 0 &&
                  stats.warning === 0 && (
                    <li className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>✓ All systems operating normally</span>
                    </li>
                  )}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Error Logs Table */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Error Logs</CardTitle>
            <CardDescription>
              {filteredLogs.length} of {errorLogs.length} errors
              {searchQuery || selectedType !== "all" || selectedSource !== "all"
                ? " (filtered)"
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">
                  {errorLogs.length === 0
                    ? "No error logs yet"
                    : "No logs match your filters"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {errorLogs.length === 0
                    ? "Error logs will appear here as they occur"
                    : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-12 text-center">Expand</TableHead>
                      <TableHead className="w-32">Type</TableHead>
                      <TableHead className="w-40">Source</TableHead>
                      <TableHead className="flex-1 min-w-64">Message</TableHead>
                      <TableHead className="w-56">Timestamp</TableHead>
                      <TableHead className="w-20 text-center">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => {
                      const isExpanded = expandedRows.has(log.id);
                      const errorColor = getErrorColor(log.type);

                      return [
                        <TableRow
                          key={log.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="w-12 text-center cursor-pointer py-3">
                            <button
                              onClick={() => toggleExpanded(log.id)}
                              className="hover:bg-muted rounded p-1 transition-colors inline-flex"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isExpanded ? "transform rotate-180" : ""
                                }`}
                              />
                            </button>
                          </TableCell>
                          <TableCell className="w-32 py-3">
                            <div
                              className={`flex items-center gap-2 px-2 py-1 rounded-md w-fit ${errorColor.bg}`}
                            >
                              {errorColor.icon}
                              <span
                                className={`text-xs font-semibold ${errorColor.text}`}
                              >
                                {log.type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-40 py-3">
                            <Badge variant="outline">{log.source}</Badge>
                          </TableCell>
                          <TableCell className="flex-1 min-w-64 py-3">
                            <p className="truncate text-sm">{log.data}</p>
                          </TableCell>
                          <TableCell className="w-56 py-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span>
                                {new Date(log.Timestamp).toLocaleString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-20 text-center py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteLog(log.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>,
                        // Expanded Row - Details
                        isExpanded && (
                          <TableRow
                            key={`${log.id}-expanded`}
                            className="bg-muted/30 hover:bg-muted/30"
                          >
                            <TableCell colSpan={6} className="p-4">
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                                      Log ID
                                    </p>
                                    <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                                      {log.id}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                                      Status
                                    </p>
                                    <Badge variant="secondary">
                                      {log.status}
                                    </Badge>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                                    Full Message
                                  </p>
                                  <p className="text-sm bg-muted p-3 rounded break-words">
                                    {log.data}
                                  </p>
                                </div>

                                {Object.keys(log).length > 6 && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                                      Additional Information
                                    </p>
                                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                                      {JSON.stringify(
                                        Object.fromEntries(
                                          Object.entries(log).filter(
                                            ([key]) =>
                                              ![
                                                "id",
                                                "data",
                                                "type",
                                                "source",
                                                "Timestamp",
                                                "status",
                                                "receivedAt",
                                              ].includes(key)
                                          )
                                        ),
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ),
                      ];
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * ITEMS_PER_PAGE + 1,
                        filteredLogs.length
                      )}{" "}
                      to{" "}
                      {Math.min(
                        currentPage * ITEMS_PER_PAGE,
                        filteredLogs.length
                      )}{" "}
                      of {filteredLogs.length} results
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog {...confirmationProps} />
    </SidebarInset>
  );
};

export default ErrorLogPage;
