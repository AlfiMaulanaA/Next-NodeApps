"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  PlusCircle,
  Edit2,
  Eye,
  ArrowUpDown,
  RotateCw,
  Search,
  Database,
  Activity,
  Target,
  Settings,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
import { connectMQTT, disconnectMQTT, getMQTTClient, connectMQTTAsync } from "@/lib/mqttClient";

interface PayloadField {
  key: string;
  type: string;
  value: string;
}
interface DataItem {
  id?: string;
  topic: string;
  data: Record<string, any>;
  interval: number;
  qos: number;
  lwt: boolean;
  retain: boolean;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

interface PayloadFormProps {
  initialMeta: {
    topic: string;
    interval: number;
    qos: number;
    lwt: boolean;
    retain: boolean;
  };
  initialFields: PayloadField[];
  onSubmit: (
    meta: {
      topic: string;
      interval: number;
      qos: number;
      lwt: boolean;
      retain: boolean;
    },
    fields: { key: string; value: any }[]
  ) => void;
  onClose: () => void;
  title: string;
}

function PayloadForm({
  initialMeta,
  initialFields,
  onSubmit,
  onClose,
  title,
}: PayloadFormProps) {
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
    const v = [...formFields];
    v.splice(idx, 1);
    setFormFields(v);
  }
  function updateField(
    idx: number,
    attr: "key" | "value" | "type",
    val: string
  ) {
    const v = [...formFields];
    v[idx] = { ...v[idx], [attr]: val };
    setFormFields(v);
  }

  function parseField(f: PayloadField): any {
    if (f.type === "int") {
      const parsed = parseInt(f.value, 10);
      if (isNaN(parsed)) {
        toast.error(
          `Invalid integer value for key '${f.key}'. Please enter a number.`
        );
        throw new Error("Invalid integer value");
      }
      return parsed;
    }
    if (f.type === "boolean") {
      if (f.value !== "true" && f.value !== "false") {
        toast.error(
          `Invalid boolean value for key '${f.key}'. Please use 'true' or 'false'.`
        );
        throw new Error("Invalid boolean value");
      }
      return f.value === "true";
    }
    if (f.type === "object" || f.type === "array") {
      try {
        return JSON.parse(f.value);
      } catch (e) {
        toast.error(
          `Invalid JSON for key '${f.key}'. Please ensure it's valid JSON.`
        );
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
      const keys = formFields.map((f) => f.key.trim());
      const uniqueKeys = new Set(keys);
      if (keys.length !== uniqueKeys.size) {
        toast.error(
          "Duplicate keys found in data fields. Keys must be unique."
        );
        return;
      }
      if (keys.some((k) => !k)) {
        toast.error("Data field keys cannot be empty.");
        return;
      }

      const parsedFields = formFields.map((f) => ({
        key: f.key,
        value: parseField(f),
      }));
      onSubmit(formMeta, parsedFields);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const renderFields = () => {
    return formFields.map((f, i) => (
      <div key={i} className="p-4 border rounded-lg bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-sm font-medium">Field #{i + 1}</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => removeField(i)}
            className="h-8 w-8 p-0"
          >
            ×
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Field Key
            </label>
            <Input
              placeholder="e.g., temperature, status"
              value={f.key}
              onChange={(e) => updateField(i, "key", e.target.value)}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Data Type
            </label>
            <select
              value={f.type}
              onChange={(e) => updateField(i, "type", e.target.value)}
              className="w-full h-10 px-3 border border-input bg-background text-sm ring-offset-background focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            >
              <option value="string">String - Text data</option>
              <option value="int">Integer - Whole numbers</option>
              <option value="boolean">Boolean - True/False</option>
              <option value="object">Object - JSON object</option>
              <option value="array">Array - JSON array</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Value
            </label>
            {f.type === "boolean" ? (
              <select
                value={f.value}
                onChange={(e) => updateField(i, "value", e.target.value)}
                className="w-full h-10 px-3 border border-input bg-background text-sm ring-offset-background focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              >
                <option value="true">True - Enabled/Active</option>
                <option value="false">False - Disabled/Inactive</option>
              </select>
            ) : (
              <Input
                placeholder={`Enter ${f.type} value`}
                value={f.value}
                onChange={(e) => updateField(i, "value", e.target.value)}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${f.key ? 'bg-green-500' : 'bg-orange-500'}`}></div>
            <span>
              {f.key ? `Field "${f.key}" ready` : 'Enter field key to continue'}
            </span>
          </div>
        </div>
      </div>
    ));
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader className="space-y-3 pb-4">
        <DialogTitle className="flex items-center gap-2 text-xl">
          <PlusCircle className="h-5 w-5 text-primary" />
          {title}
        </DialogTitle>
        <div className="w-full h-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-full"></div>
      </DialogHeader>

      <div className="space-y-6">
        {/* Topic Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            MQTT Topic
          </label>
          <Input
            placeholder="Enter MQTT topic (e.g., sensor/temperature)"
            value={formMeta.topic}
            onChange={(e) => setFormMeta({ ...formMeta, topic: e.target.value })}
            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Configuration Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <h4 className="font-medium text-foreground">Configuration</h4>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Interval Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Interval (seconds)
              </label>
              <div className="relative flex items-center">
                <Input
                  type="text"
                  placeholder="0"
                  value={formMeta.interval || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d+$/.test(value)) {
                      setFormMeta({ ...formMeta, interval: value === '' ? 0 : Number(value) });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      !/[0-9]/.test(e.key) &&
                      e.key !== 'Backspace' &&
                      e.key !== 'Delete' &&
                      e.key !== 'Tab' &&
                      e.key !== 'Escape' &&
                      e.key !== 'Enter' &&
                      e.key !== 'ArrowLeft' &&
                      e.key !== 'ArrowRight' &&
                      e.key !== 'ArrowUp' &&
                      e.key !== 'ArrowDown'
                    ) {
                      e.preventDefault();
                    }
                  }}
                  className="pr-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
                <div className="absolute right-0 top-0 bottom-0 flex flex-col w-8 border-l border-border/50">
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = formMeta.interval || 0;
                      setFormMeta({ ...formMeta, interval: currentValue + 1 });
                    }}
                    className="h-1/2 w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Increase value"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = formMeta.interval || 0;
                      if (currentValue > 0) {
                        setFormMeta({ ...formMeta, interval: currentValue - 1 });
                      }
                    }}
                    className="h-1/2 w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border/50"
                    title="Decrease value"
                    disabled={formMeta.interval <= 0}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* QoS Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Quality of Service
              </label>
              <select
                value={formMeta.qos}
                onChange={(e) =>
                  setFormMeta({ ...formMeta, qos: Number(e.target.value) })
                }
                className="w-full h-10 px-3 border border-input bg-background text-sm ring-offset-background focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              >
                <option value={0}>QoS 0 - At most once</option>
                <option value={1}>QoS 1 - At least once</option>
                <option value={2}>QoS 2 - Exactly once</option>
              </select>
            </div>

            {/* LWT Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Last Will Testament
              </label>
              <select
                value={String(formMeta.lwt)}
                onChange={(e) =>
                  setFormMeta({ ...formMeta, lwt: e.target.value === "true" })
                }
                className="w-full h-10 px-3 border border-input bg-background text-sm ring-offset-background focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>

            {/* Retain Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Retain Message
              </label>
              <select
                value={String(formMeta.retain)}
                onChange={(e) =>
                  setFormMeta({ ...formMeta, retain: e.target.value === "true" })
                }
                className="w-full h-10 px-3 border border-input bg-background text-sm ring-offset-background focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Fields Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-foreground">Data Fields</h4>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={addField}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Add Field
            </Button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {renderFields()}
          </div>
        </div>
      </div>

      <DialogFooter className="pt-6 border-t">
        <div className="flex gap-2 w-full">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            className="flex-1 gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            {title === "Create New Data" ? "Create Data" : "Update Data"}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export default function StaticPayloadPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">(
    "disconnected"
  );
  const [items, setItems] = useState<DataItem[]>([]);
  const [realtimeData, setRealtimeData] = useState<Record<string, any>>({});
  const [previewPayload, setPreviewPayload] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [updateIndex, setUpdateIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showRealtimeData, setShowRealtimeData] = useState(false);

  const [currentFormMeta, setCurrentFormMeta] = useState({
    topic: "",
    interval: 0,
    qos: 0,
    lwt: false,
    retain: false,
  });
  const [originalTopic, setOriginalTopic] = useState<string>("");
  const [currentFormFields, setCurrentFormFields] = useState<PayloadField[]>(
    []
  );

  // Real-time clock for timestamps
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    console.log("🔧 [DEBUG] StaticPayloadPage: Component mounted, initializing MQTT connection");

    const initializeConnection = async () => {
      try {
        // Ensure MQTT client is connected first
        console.log("🔄 [DEBUG] StaticPayloadPage: Ensuring MQTT connection...");
        const client = await connectMQTTAsync();

        console.log("✅ [DEBUG] StaticPayloadPage: MQTT client connected successfully");
        setStatus("connected");
        setupMQTTHandlers(client);

        // Immediately request data after connection is established
        console.log("📡 [DEBUG] StaticPayloadPage: Requesting initial data...");
        setTimeout(() => {
          handleGet();
        }, 500);

      } catch (error) {
        console.error("❌ [DEBUG] StaticPayloadPage: Failed to connect MQTT:", error);
        setStatus("error");

        // Retry connection after delay
        setTimeout(() => {
          console.log("🔄 [DEBUG] StaticPayloadPage: Retrying connection...");
          initializeConnection();
        }, 3000);
      }
    };

    initializeConnection();
  }, []);

  const setupMQTTHandlers = (client: any) => {
    const handleMessage = (topic: string, buf: Buffer) => {
      console.log(`📨 [DEBUG] MQTT Client: Received message on topic ${topic}`);
      console.log(`📨 [DEBUG] MQTT Client: Raw message buffer length: ${buf.length}`);

      try {
        const msgStr = buf.toString();
        console.log(`📨 [DEBUG] MQTT Client: Message string:`, msgStr);

        const msg = JSON.parse(msgStr);
        console.log(`📨 [DEBUG] MQTT Client: Parsed message:`, msg);

        if (topic === "response/data/payload") {
          console.log("🎯 [DEBUG] MQTT Client: Processing response/data/payload");
          if (Array.isArray(msg)) {
            console.log(`✅ [DEBUG] MQTT Client: Received array with ${msg.length} items`);
            console.log("📊 [DEBUG] MQTT Client: Array contents:", msg);
            setItems(msg);
            setStatus("connected");
            toast.success(`Received ${msg.length} payload items.`);

            // Subscribe to actual data topics for real-time updates
            const topicsToSubscribe = msg.map((item: DataItem) => item.topic);
            if (topicsToSubscribe.length > 0) {
              console.log("📡 [DEBUG] MQTT Client: Subscribing to data topics:", topicsToSubscribe);
              topicsToSubscribe.forEach((topic: string) => {
                client.subscribe(topic, { qos: 0 }, (err: any) => {
                  if (err) {
                    console.error(`❌ [DEBUG] MQTT Client: Failed to subscribe to ${topic}:`, err);
                  } else {
                    console.log(`✅ [DEBUG] MQTT Client: Successfully subscribed to ${topic} (will receive retained messages)`);
                  }
                });
              });
            }
          } else {
            console.warn("⚠️ [DEBUG] MQTT Client: Unexpected message format on response/data/payload:", msg);
            console.warn("⚠️ [DEBUG] MQTT Client: Expected array, got:", typeof msg);
          }
        } else if (
          topic === "response/data/write" ||
          topic === "response/data/update" ||
          topic === "response/data/delete"
        ) {
          console.log(`🔄 [DEBUG] MQTT Client: Processing ${topic} response`);
          setResponseMessage(msg.message);
          if (msg.status === "success") {
            toast.success(msg.message || "Operation successful!");
            // Immediate refresh for better UX
            if (client?.connected) {
              console.log("🔄 [DEBUG] MQTT Client: Auto-refreshing data after operation");
              client.publish(
                "command/data/payload",
                JSON.stringify({ command: "getData" })
              );
            } else {
              console.warn("⚠️ [DEBUG] MQTT Client: Cannot auto-refresh - client not connected");
            }
          } else {
            toast.error(msg.message || "Operation failed!");
          }
        } else {
          // Handle real-time data messages from actual topics
          console.log(` [DEBUG] MQTT Client: Processing real-time data on topic ${topic}`);
          setRealtimeData(prev => ({
            ...prev,
            [topic]: {
              data: msg,
              timestamp: new Date().toISOString(),
              topic: topic
            }
          }));
          console.log(`✅ [DEBUG] MQTT Client: Updated real-time data for ${topic}`);
        }
      } catch (err) {
        console.error("❌ [DEBUG] MQTT Client: Message parsing error:", err);
        console.error("❌ [DEBUG] MQTT Client: Raw buffer:", buf);
        console.error("❌ [DEBUG] MQTT Client: Buffer as string:", buf.toString());
        toast.error("Invalid payload from broker. Check console for details.");
      }
    };

    // Set up message handler for this page
    client.on("message", handleMessage);

    // Subscribe to response topic
    console.log("📡 [DEBUG] MQTT Client: Subscribing to response/data/payload");
    client.subscribe("response/data/payload", (err: any) => {
      if (err) {
        console.error("❌ [DEBUG] MQTT Client: Failed to subscribe to response/data/payload:", err);
      } else {
        console.log("✅ [DEBUG] MQTT Client: Successfully subscribed to response/data/payload");
      }
    });

    // Request initial data
    console.log(" [DEBUG] MQTT Client: Publishing getData command");
    client.publish(
      "command/data/payload",
      JSON.stringify({ command: "getData" }),
      (err: any) => {
        if (err) {
          console.error("❌ [DEBUG] MQTT Client: Failed to publish getData:", err);
          setStatus("error");
        } else {
          console.log("✅ [DEBUG] MQTT Client: Successfully published getData command");
          setStatus("connected");
        }
      }
    );

    // Cleanup function
    return () => {
      console.log("🧹 [DEBUG] StaticPayloadPage: Component unmounting, removing message handler");
      if (client) {
        client.off("message", handleMessage);
      }
    };
  };

  const send = async (command: string, payload: any, responseTopic: string) => {
    try {
      // Ensure MQTT client is connected
      let client = getMQTTClient();
      if (!client?.connected) {
        console.log("🔄 [CRUD] MQTT not connected, attempting to reconnect...");
        try {
          client = await connectMQTTAsync();
          console.log("✅ [CRUD] MQTT reconnected successfully");
        } catch (reconnectError) {
          console.error("❌ [CRUD] Failed to reconnect MQTT:", reconnectError);
          toast.error("MQTT not connected. Please wait for connection or refresh.");
          return false;
        }
      }

      setIsLoading(true);
      console.log(`📤 [CRUD] Sending ${command} command:`, payload);

      client.publish(
        "command/data/payload",
        JSON.stringify({ command, ...payload }),
        (err) => {
          setIsLoading(false);
          if (err) {
            console.error(`❌ [CRUD] Failed to send ${command}:`, err);
            toast.error(`Failed to ${command}: ${err.message}`);
          } else {
            console.log(`✅ [CRUD] ${command} command sent successfully`);
            // Don't show success toast here, wait for response
          }
        }
      );
      return true;
    } catch (error) {
      setIsLoading(false);
      console.error(`❌ [CRUD] Error sending ${command}:`, error);
      toast.error("Failed to send command. Please try again.");
      return false;
    }
  };

  const handleGet = () => {
    setResponseMessage("");
    send("getData", {}, "response/data/payload");
  };

  const handleCreateSubmit = async (
    meta: {
      topic: string;
      interval: number;
      qos: number;
      lwt: boolean;
      retain: boolean;
    },
    parsedFields: { key: string; value: any }[]
  ) => {
    const dataToSend = Object.fromEntries(
      parsedFields.map((f) => [f.key, f.value])
    );
    const success = await send("writeData", { ...meta, data: dataToSend }, "response/data/write");
    if (success) {
      setCreateOpen(false);

      // Immediate refresh for better UX
      console.log("🔄 [CREATE] Scheduling immediate data refresh");
      setTimeout(() => {
        console.log("🔄 [CREATE] Executing immediate data refresh");
        handleGet();
      }, 200); // Shorter delay for create operations
    }
    // If send fails, keep modal open so user can try again
  };

  const handleUpdateSubmit = async (
    meta: {
      topic: string;
      interval: number;
      qos: number;
      lwt: boolean;
      retain: boolean;
    },
    parsedFields: { key: string; value: any }[]
  ) => {
    console.log(`🔄 [UPDATE] Updating topic from: ${originalTopic} to: ${meta.topic}`);
    console.log(`🔄 [UPDATE] Meta data:`, meta);
    console.log(`🔄 [UPDATE] Parsed fields:`, parsedFields);

    // Send update command to backend with both original and new topic
    const success = await send(
      "updateData",
      {
        originalTopic: originalTopic,  // For identification
        topic: meta.topic,             // New topic value
        data: parsedFields,            // Backend expects array format: [{key: "field1", value: "value1"}, ...]
        interval: meta.interval,
        qos: meta.qos,
        lwt: meta.lwt,
        retain: meta.retain
      },
      "response/data/update"
    );

    if (success) {
      // Close modal immediately for better UX
      setUpdateOpen(false);

      // Show immediate feedback
      toast.success("Update request sent! Data will refresh automatically.");

      // Force refresh after backend processing time
      console.log("🔄 [UPDATE] Scheduling data refresh after backend processing");
      setTimeout(() => {
        console.log("🔄 [UPDATE] Executing scheduled data refresh");
        handleGet();
      }, 1000); // Give backend time to process and respond
    }
  };

  const handleDelete = (idx: number) => {
    setDeleteIndex(idx);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteIndex !== null) {
      const topicToDelete = items[deleteIndex].topic;
      console.log(`🗑️ [CRUD] Deleting topic: ${topicToDelete}`);
      const success = await send("deleteData", { topic: topicToDelete }, "response/data/delete");

      if (success) {
        // Close modal immediately for better UX
        setDeleteOpen(false);
        setDeleteIndex(null);

        // Show immediate feedback
        toast.success("Delete request sent! Data will refresh automatically.");

        // Force refresh after backend processing time
        console.log("🔄 [DELETE] Scheduling data refresh after backend processing");
        setTimeout(() => {
          console.log("🔄 [DELETE] Executing scheduled data refresh");
          handleGet();
        }, 1000); // Give backend time to process and respond
      }
    }
  };

  const openCreateModal = () => {
    setCurrentFormMeta({
      topic: "",
      interval: 0,
      qos: 0,
      lwt: false,
      retain: false,
    });
    setCurrentFormFields([]);
    setCreateOpen(true);
  };

  const openUpdateModal = (idx: number) => {
    setUpdateIndex(idx);
    const it = items[idx];
    setOriginalTopic(it.topic); // Store original topic for identification
    setCurrentFormMeta({
      topic: it.topic,
      interval: it.interval,
      qos: it.qos,
      lwt: it.lwt,
      retain: it.retain,
    });
    setCurrentFormFields(
      Object.entries(it.data).map(([k, v]) => ({
        key: k,
        type:
          typeof v === "number"
            ? "int"
            : typeof v === "boolean"
            ? "boolean"
            : Array.isArray(v)
            ? "array"
            : typeof v === "object"
            ? "object"
            : "string",
        value: typeof v === "object" ? JSON.stringify(v) : String(v),
      }))
    );
    setUpdateOpen(true);
  };

  const openPreviewModal = (data: any) => {
    setPreviewPayload(data);
    setPreviewOpen(true);
  };

  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(items, [
    "topic",
  ]);
  const { sorted, sortField, sortDirection, handleSort } =
    useSortableTable(filteredData);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedData = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <SidebarInset>
      {/* Modern Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1 h-8 w-8" />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Static Payload</h1>
                <p className="text-xs text-muted-foreground">Manage custom MQTT payload data</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MQTTConnectionBadge />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 transition-all duration-200 hover:scale-105"
              onClick={handleGet}
              disabled={isLoading}
              title="Refresh Data"
            >
              <RotateCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              size="sm"
              onClick={openCreateModal}
              disabled={isLoading}
              className="gap-2 transition-all duration-200 hover:scale-105"
            >
              <PlusCircle className="h-4 w-4" />
              Create Data
            </Button>
          </div>
        </div>
      </header>

      {/* Modern Search Bar */}
      <div className="border-b bg-muted/30">
        <div className="container px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search topics, data fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button
              variant={showRealtimeData ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRealtimeData(!showRealtimeData)}
              className="gap-2 transition-all duration-200 hover:scale-105"
              title={showRealtimeData ? "Hide Real-time Data" : "Show Real-time Data"}
            >
              <Eye className="h-4 w-4" />
              {showRealtimeData ? "Hide" : "Show"} Real-time
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status Messages */}
        {responseMessage && (
          <Alert className="animate-in slide-in-from-top-2 duration-300">
            <AlertDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {responseMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Real-time Data Display */}
        {showRealtimeData && Object.keys(realtimeData).length > 0 && (
          <Card className="animate-in fade-in-50 duration-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-lg">Real-time MQTT Data</CardTitle>
                </div>
                <Badge variant="secondary" className="animate-pulse">
                  {Object.keys(realtimeData).length} active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {Object.entries(realtimeData).map(([topic, data]: [string, any]) => (
                  <div key={topic} className="border rounded-lg p-4 bg-gradient-to-r from-muted/30 to-muted/10">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        {topic}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {new Date(data.timestamp).toLocaleTimeString()}
                      </Badge>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-md">
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(data.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Payloads</p>
                  <p className="text-2xl font-bold tracking-tight">{items.length}</p>
                </div>
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/10"></div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold tracking-tight text-green-600">
                    {items.filter((item) => item.interval > 0).length}
                  </p>
                </div>
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-100"></div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Retained</p>
                  <p className="text-2xl font-bold tracking-tight text-blue-600">
                    {items.filter((item) => item.retain).length}
                  </p>
                </div>
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-100"></div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">QoS &gt; 0</p>
                  <p className="text-2xl font-bold tracking-tight text-orange-600">
                    {items.filter((item) => item.qos > 0).length}
                  </p>
                </div>
                <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Settings className="h-5 w-5 text-orange-600" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-100"></div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Static Payload Data
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-muted/50">
                    <TableHead className="w-16 text-center font-semibold">#</TableHead>
                    <TableHead
                      onClick={() => handleSort("topic" as keyof DataItem)}
                      className="cursor-pointer select-none hover:bg-muted/80 transition-colors min-w-[200px]"
                    >
                      <div className="flex items-center gap-2">
                        Topic
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[300px]">Data Fields</TableHead>
                    <TableHead className="min-w-[200px]">Configuration</TableHead>
                    <TableHead className="w-32 text-center font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16">
                        <div className="flex flex-col items-center gap-4">
                          <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold">No data found</h3>
                            <p className="text-muted-foreground max-w-sm">
                              No payload data received yet. Click refresh to fetch the data.
                            </p>
                          </div>
                          <Button onClick={handleGet} className="mt-2">
                            <RotateCw className="h-4 w-4 mr-2" />
                            Get Data
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((it, i) => (
                      <TableRow key={it.topic} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center font-mono text-sm">
                          {(currentPage - 1) * pageSize + i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{it.topic}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                ID: {it.id}
                              </Badge>
                              {it.version && (
                                <Badge variant="secondary" className="text-xs">
                                  v{it.version}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            {Object.entries(it.data).length === 0 ? (
                              <span className="text-sm text-muted-foreground italic">No data fields</span>
                            ) : (
                              <div className="border rounded-lg overflow-hidden bg-card/50">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/30">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b">Field</th>
                                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b">Value</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(it.data).map(([k, v]) => (
                                        <tr key={k} className="hover:bg-muted/20 transition-colors">
                                          <td className="px-3 py-2 font-medium text-foreground border-b border-border/50">
                                            {k}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-foreground border-b border-border/50 max-w-[250px] truncate" title={typeof v === "object" ? JSON.stringify(v) : String(v)}>
                                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Interval:</span>
                                <div className="font-mono">{it.interval}s</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">QoS:</span>
                                <div className="font-mono">{it.qos}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">LWT:</span>
                                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                  it.lwt
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                }`}>
                                  <div className={`w-1 h-1 rounded-full ${it.lwt ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                  <span className="text-xs">{it.lwt ? 'ON' : 'OFF'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">Retain:</span>
                                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                  it.retain
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                }`}>
                                  <div className={`w-1 h-1 rounded-full ${it.retain ? 'bg-blue-500' : 'bg-slate-400'}`}></div>
                                  <span className="text-xs">{it.retain ? 'ON' : 'OFF'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPreviewModal(it.data)}
                              className="h-8 w-8 p-0"
                              title="Preview Data"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openUpdateModal(i)}
                              className="h-8 w-8 p-0"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(i)}
                              className="h-8 w-8 p-0"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              {Math.min((currentPage - 1) * pageSize + 1, sorted.length)} to{" "}
              {Math.min(currentPage * pageSize, sorted.length)} of{" "}
              {sorted.length} results
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
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
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
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
            <DialogHeader>
              <DialogTitle>Preview JSON Payload</DialogTitle>
            </DialogHeader>
            <pre
              className="text-dark p-3 rounded text-xs bg-muted"
              style={{ fontSize: "0.9rem" }}
            >
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader className="space-y-3 pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Trash2 className="h-5 w-5 text-destructive" />
                Confirm Delete
              </DialogTitle>
              <div className="w-full h-1 bg-gradient-to-r from-destructive/20 to-destructive/5 rounded-full"></div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-destructive/10 rounded-full flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Are you sure you want to delete this topic?</h4>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. The topic and all its associated data will be permanently removed.
                  </p>
                  {deleteIndex !== null && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-md border">
                      <div className="text-sm">
                        <span className="font-medium text-foreground">Topic to delete:</span>
                        <div className="font-mono text-destructive mt-1 break-all">
                          {items[deleteIndex]?.topic}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <p className="text-sm text-amber-800">
                  <strong>Warning:</strong> This will also stop any active publishing for this topic.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-6 border-t">
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteIndex(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={isLoading}
                  className="flex-1 gap-2"
                >
                  {isLoading ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Topic
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}
