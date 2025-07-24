"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { FileBarChart, Download, RotateCw, Plus, Trash, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Assuming you have a Label component
import { connectMQTT } from "@/lib/mqttClient";
import type { MqttClient } from "mqtt";

// --- TOPICS dari middleware Python Anda ---
const TOPIC_LIBRARY_DEVICES_SUMMARY = "library/devices/summary";
const TOPIC_LIBRARY_SEARCH_COMMAND = "library/devices/summary/search";
const TOPIC_LIBRARY_SEARCH_RESPONSE = "library/devices/summary/search/response";
const TOPIC_LIBRARY_COMMAND = "library/devices/command";
const TOPIC_LIBRARY_COMMAND_RESPONSE = "library/devices/command/response";

// Topik yang sudah ada
// const TOPIC_FILE_UPLOAD_COMMAND = "command_upload_file";
// const TOPIC_FILE_UPLOAD_RESPONSE = "response_file_transfer";
// const TOPIC_FILE_DOWNLOAD_COMMAND = "command_download_file";
// const TOPIC_FILE_DOWNLOAD_RESPONSE = "download_file_response";
// const TOPIC_SERVICE_COMMAND = "service/command";
// const TOPIC_SERVICE_RESPONSE = "service/response";

export default function FileLibraryPage() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const [fileName, setFileName] = useState<string | null>(null);
  const clientRef = useRef<MqttClient | null>(null);

  // --- NEW: State for Device Library Management ---
  const [deviceSummary, setDeviceSummary] = useState<any>({}); // To display the overall device summary
  const [newSectionName, setNewSectionName] = useState<string>(""); // For Create New Section
  const [sectionToDelete, setSectionToDelete] = useState<string>(""); // For Delete Section
  const [searchSection, setSearchSection] = useState<string>(""); // For Search Device
  const [searchManufacturer, setSearchManufacturer] = useState<string>("");
  const [searchPartNumber, setSearchPartNumber] = useState<string>("");
  const [searchProtocol, setSearchProtocol] = useState<string>("");
  const [searchResult, setSearchResult] = useState<any>(null); // To display search results

  // Define restartService outside useEffect or use useCallback
  const restartService = () => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot restart service.");
      return;
    }

    const cmd = JSON.stringify({
      action: "restart",
      services: ["MODBUS_SNMP.service"],
    });
    clientRef.current.publish("service/command", cmd, (err) => {
      if (err) {
        toast.error(`Failed to send restart command: ${err.message}`, { id: "restartToast" });
        console.error("Publish error:", err);
      } else {
        toast.loading("Restarting MODBUS_SNMP.service...", { id: "restartToast" });
      }
    });
  };

  // Connect to MQTT broker and subscribe to topics
  useEffect(() => {
    const mqttClientInstance = connectMQTT();
    clientRef.current = mqttClientInstance;

    const handleConnect = () => {
      setStatus("connected");
      // Existing subscriptions
      mqttClientInstance.subscribe("response_file_transfer");
      mqttClientInstance.subscribe("service/response");
      mqttClientInstance.subscribe("download_file_response");
      // --- NEW: Subscribe to device library topics ---
      mqttClientInstance.subscribe(TOPIC_LIBRARY_DEVICES_SUMMARY);
      mqttClientInstance.subscribe(TOPIC_LIBRARY_SEARCH_RESPONSE);
      mqttClientInstance.subscribe(TOPIC_LIBRARY_COMMAND_RESPONSE);
      toast.success("Connected to MQTT Broker.");
    };

    const handleError = (err: Error) => {
      console.error("MQTT Client Error:", err);
      setStatus("error");
      toast.error(`MQTT Error: ${err.message}`);
    };

    const handleClose = () => {
      setStatus("disconnected");
      toast.warning("Disconnected from MQTT Broker.");
    };

    const handleMessage = (topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString());
        // console.log(`Received message on topic ${topic}:`, data); // For debugging

        if (topic === "response_file_transfer") {
          if (data.status === "success" && data.action === "upload") {
            toast.success("devices.json uploaded successfully.");
            if (clientRef.current) {
              restartService();
            } else {
              console.warn("ClientRef is null when trying to restart service after upload success.");
            }
          } else if (data.status === "error") {
            toast.error(data.message || "Upload failed");
            console.error("File upload error response:", data);
          }
        } else if (topic === "service/response") {
          if (data.result === "success") {
            toast.success(data.message || "Service restarted successfully.");
          } else {
            toast.error(data.message || "Service restart failed.");
            console.error("Service restart error response:", data);
          }
        } else if (topic === "download_file_response") {
          if (data.status === "success" && data.action === "download" && data.content) {
            const blob = new Blob([atob(data.content)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "devices.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("devices.json downloaded successfully.");
          } else if (data.status === "error") {
            toast.error(data.message || "Download failed");
            console.error("File download error response:", data);
          }
        }
        // --- NEW: Handle device library responses ---
        else if (topic === TOPIC_LIBRARY_DEVICES_SUMMARY) {
          setDeviceSummary(data);
          toast.info("Device library summary updated.");
        } else if (topic === TOPIC_LIBRARY_SEARCH_RESPONSE) {
          setSearchResult(data);
          if (data.status === "success" && data.data) {
            toast.success("Device found!");
          } else {
            toast.info(data.message || "Device not found.");
          }
        } else if (topic === TOPIC_LIBRARY_COMMAND_RESPONSE) {
          if (data.status === "success") {
            toast.success(data.message || "Command executed successfully.");
            // Optionally, re-request summary after a successful command that changes data
            if (clientRef.current && clientRef.current.connected) {
              clientRef.current.publish(TOPIC_LIBRARY_COMMAND, JSON.stringify({ command: "Get All Data" })); // Trigger summary update
            }
          } else {
            toast.error(data.message || "Command failed.");
            console.error("Library command error response:", data);
          }
        }
      } catch (err) {
        toast.error("Invalid payload format received from MQTT.");
        console.error("MQTT message parsing error:", err);
      }
    };

    mqttClientInstance.on("connect", handleConnect);
    mqttClientInstance.on("error", handleError);
    mqttClientInstance.on("close", handleClose);
    mqttClientInstance.on("message", handleMessage);

    return () => {
      if (mqttClientInstance.connected) {
        // Unsubscribe from all topics when component unmounts
        mqttClientInstance.unsubscribe("response_file_transfer");
        mqttClientInstance.unsubscribe("service/response");
        mqttClientInstance.unsubscribe("download_file_response");
        mqttClientInstance.unsubscribe(TOPIC_LIBRARY_DEVICES_SUMMARY);
        mqttClientInstance.unsubscribe(TOPIC_LIBRARY_SEARCH_RESPONSE);
        mqttClientInstance.unsubscribe(TOPIC_LIBRARY_COMMAND_RESPONSE);
      }
      mqttClientInstance.off("connect", handleConnect);
      mqttClientInstance.off("error", handleError);
      mqttClientInstance.off("close", handleClose);
      mqttClientInstance.off("message", handleMessage);
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const confirmDownload = () => {
    if (confirm("Download devices.json file?")) {
      downloadFile();
    }
  };

  const confirmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (file.name !== "devices.json") {
      toast.error("Invalid file. Please select devices.json");
      return;
    }

    if (confirm("Upload and replace devices.json file? This will restart the MODBUS_SNMP service.")) {
      uploadFile(file);
    }
    e.target.value = '';
  };

  const downloadFile = () => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot download file.");
      return;
    }
    toast.loading("Requesting devices.json download...", { id: "downloadToast" });
    const cmd = JSON.stringify({
      action: "download",
      filepath: "../MODBUS_SNMP/JSON/Config/Library/devices.json",
    });
    clientRef.current.publish("command_download_file", cmd, (err) => {
      if (err) {
        toast.error(`Failed to send download command: ${err.message}`, { id: "downloadToast" });
        console.error("Publish error:", err);
      }
    });
  };

  const uploadFile = (file: File) => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot upload file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = btoa(reader.result as string);
      const cmd = JSON.stringify({
        action: "upload",
        filepath: "../MODBUS_SNMP/JSON/Config/Library/devices.json",
        content: content,
      });
      clientRef.current?.publish("command_upload_file", cmd, (err) => {
        if (err) {
          toast.error(`Failed to send upload command: ${err.message}`, { id: "uploadToast" });
          console.error("Publish error:", err);
        } else {
          toast.loading("Uploading devices.json...", { id: "uploadToast" });
        }
      });
    };
    reader.onerror = () => {
      toast.error("Failed to read file.");
    };
    reader.readAsBinaryString(file);
  };

  const refreshData = () => {
    toast.info("Refreshing page for MQTT connection re-initialization...");
    window.location.reload();
  };

  // --- NEW: Device Library Management Functions ---

  const handleCreateNewSection = () => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot create section.");
      return;
    }
    if (!newSectionName.trim()) {
      toast.error("Section name cannot be empty.");
      return;
    }

    const cmd = JSON.stringify({
      command: "Create New Section",
      data: newSectionName.trim(),
    });
    clientRef.current.publish(TOPIC_LIBRARY_COMMAND, cmd, (err) => {
      if (err) {
        toast.error(`Failed to send create section command: ${err.message}`);
        console.error("Publish error:", err);
      } else {
        toast.loading("Creating new section...", { id: "createSectionToast" });
        setNewSectionName(""); // Clear input
      }
    });
  };

  const handleDeleteSection = () => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot delete section.");
      return;
    }
    if (!sectionToDelete.trim()) {
      toast.error("Section name to delete cannot be empty.");
      return;
    }
    if (!confirm(`Are you sure you want to delete section "${sectionToDelete}"? This action cannot be undone.`)) {
      return;
    }

    const cmd = JSON.stringify({
      command: "Delete Section",
      data: sectionToDelete.trim(),
    });
    clientRef.current.publish(TOPIC_LIBRARY_COMMAND, cmd, (err) => {
      if (err) {
        toast.error(`Failed to send delete section command: ${err.message}`);
        console.error("Publish error:", err);
      } else {
        toast.loading("Deleting section...", { id: "deleteSectionToast" });
        setSectionToDelete(""); // Clear input
      }
    });
  };

  const handleSearchDevice = () => {
    if (!clientRef.current || !clientRef.current.connected) {
      toast.error("MQTT not connected. Cannot search device.");
      return;
    }
    if (!searchSection.trim()) {
      toast.error("Section is required for device search.");
      return;
    }

    const searchParams: { [key: string]: string } = {
      section: searchSection.trim(),
    };
    if (searchManufacturer.trim()) searchParams.manufacturer = searchManufacturer.trim();
    if (searchPartNumber.trim()) searchParams.part_number = searchPartNumber.trim();
    if (searchProtocol.trim()) searchParams.protocol = searchProtocol.trim();

    const cmd = JSON.stringify({
      command: "Get Data",
      search_params: searchParams,
    });
    clientRef.current.publish(TOPIC_LIBRARY_SEARCH_COMMAND, cmd, (err) => {
      if (err) {
        toast.error(`Failed to send search command: ${err.message}`);
        console.error("Publish error:", err);
      } else {
        toast.loading("Searching for device...", { id: "searchDeviceToast" });
        setSearchResult(null); // Clear previous result
      }
    });
  };

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <FileBarChart className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">File Library Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`capitalize ${
              status === "connected"
                ? "text-green-600 border-green-600"
                : status === "error"
                ? "text-red-600 border-red-600"
                : "text-yellow-600 border-yellow-600"
            }`}
          >
            {status}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={refreshData}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* File Control Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">devices.json File Control</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Button onClick={confirmDownload} className="w-full" disabled={status !== "connected"}>
              <Download className="mr-2 h-4 w-4" /> Download devices.json
            </Button>
            <div>
              <Input
                type="file"
                accept=".json"
                onChange={confirmUpload}
                disabled={status !== "connected"}
              />
              {fileName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {fileName}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- NEW: Device Library Summary Card --- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Device Library Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(deviceSummary).length > 0 ? (
              <div className="max-h-60 overflow-y-auto bg-muted p-3 rounded-md text-sm">
                <pre>{JSON.stringify(deviceSummary, null, 2)}</pre>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No device summary available or loading... Ensure the backend service is running.
              </p>
            )}
            <Button
              onClick={() => {
                // Manually request the summary if needed, though it's sent periodically
                if (clientRef.current && clientRef.current.connected) {
                  // The backend publishes summary periodically, but if you need an immediate refresh:
                  // You might need a specific command in backend to trigger immediate summary publish
                  // For now, relies on periodic update or successful command response
                  toast.info("Waiting for next periodic summary update or command response.");
                } else {
                  toast.error("MQTT not connected.");
                }
              }}
              className="mt-4"
              variant="outline"
              size="sm"
              disabled={status !== "connected"}
            >
              <RotateCw className="mr-2 h-4 w-4" /> Refresh Summary (Periodic)
            </Button>
          </CardContent>
        </Card>

        {/* --- NEW: Manage Sections Card --- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create New Section */}
            <div>
              <Label htmlFor="new-section-name" className="mb-2 block">Create New Section</Label>
              <div className="flex gap-2">
                <Input
                  id="new-section-name"
                  placeholder="Enter new section name (e.g., Modbus RTU)"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  disabled={status !== "connected"}
                />
                <Button onClick={handleCreateNewSection} disabled={status !== "connected" || !newSectionName.trim()}>
                  <Plus className="mr-2 h-4 w-4" /> Create
                </Button>
              </div>
            </div>

            {/* Delete Section */}
            <div>
              <Label htmlFor="delete-section-name" className="mb-2 block">Delete Section</Label>
              <div className="flex gap-2">
                <Input
                  id="delete-section-name"
                  placeholder="Enter section name to delete"
                  value={sectionToDelete}
                  onChange={(e) => setSectionToDelete(e.target.value)}
                  disabled={status !== "connected"}
                />
                <Button variant="destructive" onClick={handleDeleteSection} disabled={status !== "connected" || !sectionToDelete.trim()}>
                  <Trash className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* --- NEW: Search Device Card --- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="search-section">Section (Required)</Label>
                <Input id="search-section" value={searchSection} onChange={(e) => setSearchSection(e.target.value)} placeholder="e.g., Modbus TCP" disabled={status !== "connected"} />
              </div>
              <div>
                <Label htmlFor="search-manufacturer">Manufacturer</Label>
                <Input id="search-manufacturer" value={searchManufacturer} onChange={(e) => setSearchManufacturer(e.target.value)} placeholder="e.g., Siemens" disabled={status !== "connected"} />
              </div>
              <div>
                <Label htmlFor="search-part-number">Part Number</Label>
                <Input id="search-part-number" value={searchPartNumber} onChange={(e) => setSearchPartNumber(e.target.value)} placeholder="e.g., S7-1200" disabled={status !== "connected"} />
              </div>
              <div>
                <Label htmlFor="search-protocol">Protocol</Label>
                <Input id="search-protocol" value={searchProtocol} onChange={(e) => setSearchProtocol(e.target.value)} placeholder="e.g., MODBUS_TCP" disabled={status !== "connected"} />
              </div>
            </div>
            <Button onClick={handleSearchDevice} disabled={status !== "connected" || !searchSection.trim()}>
              <Search className="mr-2 h-4 w-4" /> Search Device
            </Button>

            {searchResult && (
              <div className="mt-4">
                <h3 className="text-md font-semibold mb-2">Search Result:</h3>
                {searchResult.status === "success" && searchResult.data ? (
                  <div className="bg-muted p-3 rounded-md text-sm max-h-40 overflow-y-auto">
                    <pre>{JSON.stringify(searchResult.data, null, 2)}</pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {searchResult.message || "No results found or error occurred."}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* NOTE: Fitur 'Create Data' (Add New Device) dan 'Update Data' (Update Device Data) akan lebih kompleks
            karena melibatkan input form yang dinamis untuk struktur data perangkat yang bervariasi (data array).
            Untuk kesederhanaan, saya hanya menambahkan fungsionalitas dasar yang menunjukkan alur komunikasi MQTT.
            Anda dapat memperluas ini dengan form yang lebih canggih jika diperlukan.
            Demikian pula, 'Update Section' juga dapat ditambahkan dengan pola yang sama seperti 'Create/Delete Section'.
        */}
      </div>
    </SidebarInset>
  );
}