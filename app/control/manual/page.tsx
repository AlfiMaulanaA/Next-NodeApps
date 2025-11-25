"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RotateCw,
  Cpu,
  Server,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  Activity,
} from "lucide-react";
import { connectMQTT } from "@/lib/mqttClient";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import MqttStatus from "@/components/mqtt-status";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Define the type for a device
interface Device {
  profile: {
    name: string;
    device_type: string;
    manufacturer: string;
    part_number: string;
    topic: string;
  };
  protocol_setting: {
    protocol: string;
    address: number;
    device_bus: number;
  };
}

// Define the type for MQTT Broker Data
interface MqttBrokerData {
  mac_address: string;
  broker_address: string;
  broker_port: number | string;
  username?: string;
  password?: string;
}

// Define the type for the full device topic payload as provided
interface FullDevicePayload {
  mac: string;
  protocol_type: string;
  number_address: number;
  value: string | object; // The 'value' field can be a JSON string or already parsed object
  Timestamp: string;
}

// Define the type for the parsed 'value' content
interface ParsedValueData {
  [key: string]: boolean | undefined; // All relay and drycontact inputs are booleans
}

// State untuk menyimpan data payload dari setiap topik perangkat
interface DeviceTopicData {
  [topic: string]: FullDevicePayload;
}

export default function DeviceManagerPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [mqttBrokerData, setMqttBrokerData] = useState<MqttBrokerData | null>(
    null
  );
  const [deviceTopicPayloads, setDeviceTopicPayloads] =
    useState<DeviceTopicData>({});
  // State untuk melacak status tampil/sembunyi live data untuk setiap perangkat
  const [showLiveDataState, setShowLiveDataState] = useState<{
    [topic: string]: boolean;
  }>({});

  // Track current subscriptions to avoid re-running subscription logic
  const [currentSubscriptions, setCurrentSubscriptions] = useState<Set<string>>(new Set());

  const clientRef = useRef<any>(null); // Tetap menggunakan any untuk clientRef jika mqttClient.ts tidak Typed

  // useEffect untuk koneksi MQTT dan langganan awal (response_device_i2c, mqtt_config topics)
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = connectMQTT();
    }
    const client = clientRef.current;

    if (!client) {
      console.warn("MQTT client not available.");
      return;
    }

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const messageString = message.toString();
        const payload = JSON.parse(messageString);

        if (topic === "response_device_i2c") {
          if (Array.isArray(payload)) {
            setDevices(payload as Device[]); // Type assertion untuk payload perangkat
            // Perbarui showLiveDataState: pertahankan status yang sudah ada, inisialisasi yang baru
            setShowLiveDataState((prev) => {
              const newState = { ...prev };
              (payload as Device[]).forEach((device: Device) => {
                // Type assertion
                if (newState[device.profile.topic] === undefined) {
                  newState[device.profile.topic] = true; // Default to showing live data for new devices
                }
              });
              // Hapus status untuk perangkat yang tidak lagi ada
              Object.keys(newState).forEach((existingTopic) => {
                if (
                  !(payload as Device[]).some(
                    (d: Device) => d.profile.topic === existingTopic
                  )
                ) {
                  // Type assertion
                  delete newState[existingTopic];
                }
              });
              return newState;
            });
          } else {
            console.warn(
              "[MQTT] DeviceManagerPage (I2C): Payload from response_device_i2c is not an array, skipping update:",
              payload
            );
          }
        } else if (topic === "mqtt_config/response_mac") {
          console.log("[MQTT] Received MAC address:", payload);
          setMqttBrokerData(prev => ({
            mac_address: payload.mac_address,
            broker_address: prev?.broker_address || "",
            broker_port: prev?.broker_port || 1883,
            username: prev?.username || "",
            password: prev?.password || ""
          }));
        } else if (topic === "mqtt_config/modbus/response") {
          console.log("[MQTT] Received MODBUS broker config:", payload);
          if (payload.status === "success") {
            setMqttBrokerData(prev => ({
              mac_address: prev?.mac_address || "",
              broker_address: payload.data.broker_address,
              broker_port: payload.data.broker_port,
              username: payload.data.username,
              password: payload.data.password
            }));
          }
        } else if (topic === "mqtt_config/modular/response") {
          console.log("[MQTT] Received MODULAR broker config:", payload);
          if (payload.status === "success") {
            setMqttBrokerData(prev => ({
              mac_address: payload.data.mac_address || prev?.mac_address || "",
              broker_address: payload.data.broker_address,
              broker_port: payload.data.broker_port,
              username: payload.data.username,
              password: payload.data.password
            }));
          }
        } else {
          console.log(
            `[MQTT] Received device data on topic ${topic}:`,
            payload
          );
          setDeviceTopicPayloads((prevPayloads) => ({
            ...prevPayloads,
            [topic]: payload as FullDevicePayload,
          }));
        }
      } catch (error) {
        console.error(
          `[MQTT] DeviceManagerPage: Invalid JSON from MQTT topic '${topic}' or processing error:`,
          error,
          "Raw message:",
          message.toString()
        );
      }
    };

    client.on("message", handleMessage);
    client.subscribe("response_device_i2c");
    client.subscribe("mqtt_config/response_mac", { qos: 1 });
    client.subscribe("mqtt_config/modbus/response", { qos: 1 });
    client.subscribe("mqtt_config/modular/response", { qos: 1 });

    // Request data dari backend
    client.publish("command_device_i2c", JSON.stringify({ command: "getDataI2C" }));
    client.publish("mqtt_config/get_mac_address", JSON.stringify({}));
    client.publish("mqtt_config/modbus/command", JSON.stringify({ command: "get" }));
    client.publish("mqtt_config/modular/command", JSON.stringify({ command: "get" }));

    return () => {
      client.unsubscribe("response_device_i2c");
      client.unsubscribe("mqtt_config/response_mac");
      client.unsubscribe("mqtt_config/modbus/response");
      client.unsubscribe("mqtt_config/modular/response");
      client.off("message", handleMessage);
    };
  }, []); // Dependency array tetap kosong karena ini hanya untuk setup awal dan listener

  // useEffect untuk secara dinamis berlangganan topik perangkat
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    const desiredSubscriptions = new Set(devices.map((d) => d.profile.topic));

    // Unsubscribe dari topic yang tidak lagi diinginkan
    setCurrentSubscriptions((currentSubs) => {
      // Buat copy dari current subscriptions untuk modify
      const newSubs = new Set(currentSubs);

      currentSubs.forEach((topic) => {
        if (
          !desiredSubscriptions.has(topic) &&
          topic !== "response_device_i2c" &&
          topic !== "mqtt_broker_server"
        ) {
          client.unsubscribe(topic);
          setDeviceTopicPayloads((prev) => {
            const newPayloads = { ...prev };
            delete newPayloads[topic];
            return newPayloads;
          });
          // Hapus status live data saat unsubscribe
          setShowLiveDataState((prev) => {
            const newState = { ...prev };
            delete newState[topic];
            return newState;
          });
          newSubs.delete(topic);
          console.log(`[MQTT] Unsubscribed from: ${topic}`);
        }
      });

      return newSubs;
    });

    // Subscribe ke topic baru
    desiredSubscriptions.forEach((topic) => {
      setCurrentSubscriptions((currentSubs) => {
        if (!currentSubs.has(topic)) {
          client.subscribe(topic, { qos: 0 });
          console.log(`[MQTT] Subscribed to: ${topic}`);
          return new Set([...currentSubs, topic]);
        }
        return currentSubs;
      });
    });

    // Cleanup function untuk unsubscribe saat komponen unmount
    return () => {
      setCurrentSubscriptions((currentSubs) => {
        currentSubs.forEach((topic) => {
          client.unsubscribe(topic);
          console.log(`[MQTT] Unsubscribed from: ${topic} (cleanup)`);
        });
        return new Set(); // Clear all subscriptions
      });
    };
  }, [devices]); // Hanya bergantung pada devices, tidak pada deviceTopicPayloads

  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(
    devices,
    [
      "profile.name",
      "profile.part_number",
      "profile.topic",
      "protocol_setting.address",
    ]
  );

  // Fungsi untuk mengirim perintah MQTT saat toggle diubah
  const handleToggleChange = (
    device: Device,
    inputKey: string,
    newState: boolean
  ) => {
    if (!clientRef.current || !mqttBrokerData) {
      console.warn("MQTT client not available or broker data missing.");
      toast.error("Cannot send command, MQTT client is not connected.");
      return;
    }

    // Show loading toast
    const toastId = toast.loading("Sending command...");

    // Ekstrak nomor PIN dari inputKey (misal: "drycontactInput1" -> 1)
    const pinNumberMatch = inputKey.match(/\d+/);
    const pin = pinNumberMatch ? parseInt(pinNumberMatch[0], 10) : 0;

    // Buat payload perintah sesuai format yang diminta
    const commandPayload = {
      mac: mqttBrokerData.mac_address,
      protocol_type: "Modular",
      device: "RELAYMINI",
      function: "write",
      value: {
        pin: pin,
        data: newState ? 1 : 0,
      },
      address: device.protocol_setting.address,
      device_bus: device.protocol_setting.device_bus,
      Timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    };

    const controlTopic = "modular";

    try {
      clientRef.current.publish(controlTopic, JSON.stringify(commandPayload));
      console.log(
        `[MQTT] Sending command to ${controlTopic}: ${JSON.stringify(
          commandPayload
        )}`
      );

      // Update loading toast to success
      toast.success(`${device.profile.name} pin ${pin} set to ${newState ? "ON" : "OFF"}`, { id: toastId });
    } catch (error) {
      console.error("Failed to publish MQTT message:", error);
      toast.error("Failed to send command", { id: toastId });
    }

    // Opsional: Perbarui UI secara optimis
    setDeviceTopicPayloads((prevPayloads) => {
      const currentPayload = prevPayloads[device.profile.topic];
      if (currentPayload) {
        try {
          let parsedValue: ParsedValueData;
          if (typeof currentPayload.value === "string") {
            parsedValue = JSON.parse(currentPayload.value);
          } else if (typeof currentPayload.value === "object" && currentPayload.value !== null) {
            parsedValue = currentPayload.value as ParsedValueData;
          } else {
            return prevPayloads;
          }

          // Pastikan parsedValue adalah objek sebelum mencoba memperbarui properti
          if (typeof parsedValue === "object" && parsedValue !== null) {
            parsedValue[inputKey] = newState;
            return {
              ...prevPayloads,
              [device.profile.topic]: {
                ...currentPayload,
                value: typeof currentPayload.value === "string" ? JSON.stringify(parsedValue) : parsedValue,
              },
            };
          }
        } catch (e) {
          console.error("Error updating optimistic UI:", e);
        }
      }
      return prevPayloads;
    });
  };

  // Fungsi untuk mengubah status tampil/sembunyi live data
  const toggleLiveDataVisibility = (topic: string) => {
    setShowLiveDataState((prevState) => ({
      ...prevState,
      [topic]: !prevState[topic],
    }));
  };

  const refreshData = () => {
    if (!clientRef.current) {
      toast.error("Cannot refresh data, MQTT client is not connected.");
      return;
    }

    clientRef.current.publish(
      "command_device_i2c",
      JSON.stringify({ command: "getDataI2C" })
    );

    toast.success("Device data refreshed successfully");
  };

  // Calculate summary data
  const totalDevices = devices.length;
  const activeDevices = Object.keys(deviceTopicPayloads).length;
  const relayDevices = devices.filter((d) =>
    ["RELAY", "RELAYMINI"].includes(d.profile.part_number)
  ).length;
  const sensorDevices = totalDevices - relayDevices;

  const summaryItems = [
    { label: "Total", value: totalDevices, icon: Server },
    {
      label: "Active",
      value: activeDevices,
      icon: Activity,
      variant: "default" as const,
    },
    {
      label: "Relays",
      value: relayDevices,
      icon: CircleCheck,
      variant: "secondary" as const,
    },
    {
      label: "Sensors",
      value: sensorDevices,
      icon: CircleX,
      variant: "outline" as const,
    },
  ];

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Cpu className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Modular Devices Monitoring</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={refreshData}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-2 border-b">
        <Input
          placeholder="Search devices by name, part number, topic, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary Cards - Consistent with other control pages */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Server className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDevices}</div>
              <p className="text-xs text-muted-foreground">
                Connected devices
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
              <Activity className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeDevices}</div>
              <p className="text-xs text-muted-foreground">
                With live data
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Relay Devices</CardTitle>
              <CircleCheck className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{relayDevices}</div>
              <p className="text-xs text-muted-foreground">
                Control devices
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sensor Devices</CardTitle>
              <CircleX className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sensorDevices}</div>
              <p className="text-xs text-muted-foreground">
                Input devices
              </p>
            </CardContent>
          </Card>
        </div>

        {/* MQTT Broker Info Card */}
        <Card className="border-l-4 border-l-gray-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-500" /> MQTT Broker Server
              Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mqttBrokerData ? (
              <div className="bg-card text-card-foreground rounded-lg shadow-sm p-4 border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <span className="font-medium">MAC:</span>{" "}
                    {mqttBrokerData.mac_address}
                  </div>
                  <div>
                    <span className="font-medium">Broker Address:</span>{" "}
                    {mqttBrokerData.broker_address}
                  </div>
                  <div>
                    <span className="font-medium">Broker Port:</span>{" "}
                    {mqttBrokerData.broker_port}
                  </div>
                  <div>
                    <span className="font-medium">Broker Username:</span>{" "}
                    {mqttBrokerData.username || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Broker Password:</span>{" "}
                    {mqttBrokerData.password ? "********" : "-"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-center py-4">
                No broker server data received yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Devices Grid */}
        <Card className="border-l-4 border-l-gray-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-gray-500" /> Connected Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredData.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                {filteredData.map((device: Device) => {
                  const fullDevicePayload =
                    deviceTopicPayloads[device.profile.topic];
                  const showLiveData = showLiveDataState[device.profile.topic];

                  let parsedValue: ParsedValueData | null = null;
                  if (fullDevicePayload) {
                    if (typeof fullDevicePayload.value === "string") {
                      try {
                        parsedValue = JSON.parse(fullDevicePayload.value);
                        console.log(
                          `Parsed value for ${device.profile.topic}:`,
                          parsedValue
                        );
                      } catch (e) {
                        console.error(
                          `Error parsing value for topic ${device.profile.topic}:`,
                          e,
                          "Raw value:",
                          fullDevicePayload.value
                        );
                      }
                    } else if (typeof fullDevicePayload.value === "object" && fullDevicePayload.value !== null) {
                      parsedValue = fullDevicePayload.value as ParsedValueData;
                      console.log(
                        `Parsed value for ${device.profile.topic} (already object):`,
                        parsedValue
                      );
                    }
                  }

  const isControlDisabled = !(
    device.profile.part_number === "RELAY" ||
    device.profile.part_number === "RELAYMINI" ||
    device.profile.part_number === "GPIO" ||
    device.protocol_setting.protocol === "I2C" ||
    fullDevicePayload?.protocol_type === "I2C MODULAR"
  );

                  return (
                    <Card
                      key={device.profile.topic}
                      className="border-l-4 border-gray-400 shadow-sm"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg font-semibold truncate">
                            {device.profile.name}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toggleLiveDataVisibility(device.profile.topic)
                            }
                            className="h-7 w-7"
                          >
                            {showLiveData ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          PN: {device.profile.part_number}
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Addr:</span>
                            <Badge
                              variant="outline"
                              className="text-xs px-1 py-0"
                            >
                              {device.protocol_setting.address}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bus:</span>
                            <Badge
                              variant="outline"
                              className="text-xs px-1 py-0"
                            >
                              {device.protocol_setting.device_bus}
                            </Badge>
                          </div>
                          <div className="col-span-2 mt-1">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground text-xs">
                                Topic:
                              </span>
                              <Badge
                                variant="outline"
                                className="text-xs max-w-[180px] truncate px-1 py-0"
                              >
                                {device.profile.topic}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {showLiveData && (
                          <>
                            <div className="border-t mt-2 pt-2">
                              <div className="text-xs text-muted-foreground mb-1">
                                Live Data:
                              </div>
                              {fullDevicePayload ? (
                                <>
                                  <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="font-medium">
                                      Timestamp:
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {fullDevicePayload.Timestamp}
                                    </Badge>
                                  </div>
                                  {parsedValue ? (
                                    <div className="grid grid-cols-7 gap-2">
                                      {Object.entries(parsedValue)
                                        .filter(
                                          ([key]) =>
                                            key.startsWith("relayMiniOutput") ||
                                            key.startsWith("drycontactInput") ||
                                            key.startsWith("optocouplerInput") ||
                                            key.startsWith("optocouplerOutput")
                                        )
                                        .map(([key, value]) => {
                                          if (typeof value !== "boolean")
                                            return null;

                                          const isRelayOutput =
                                            key.startsWith("relayMiniOutput");
                                          const isDryContactInput =
                                            key.startsWith("drycontactInput");
                                          const isOptocouplerOutput =
                                            key.startsWith("optocouplerOutput");
                                          const isOptocouplerInput =
                                            key.startsWith("optocouplerInput");
                                          const isOutput = isRelayOutput || isOptocouplerOutput;
                                          const isInput = isDryContactInput || isOptocouplerInput;

                                          const numberMatch = key.match(/\d+/);
                                          const number = numberMatch
                                            ? parseInt(numberMatch[0])
                                            : 0;
                                          const displayKey = `${number}`;

                                          return (
                                            <div
                                              key={key}
                                              className="flex flex-col items-center gap-2"
                                            >
                                              <span className="text-xs font-medium text-muted-foreground">
                                                {isOutput ? "OUT" : "IN"} {number}
                                              </span>
                                              <Toggle
                                                pressed={value}
                                                aria-label={`Toggle ${displayKey} status`}
                                                onPressedChange={(newState) =>
                                                  handleToggleChange(
                                                    device,
                                                    key,
                                                    newState
                                                  )
                                                }
                                                size="sm"
                                                className={cn(
                                                  "data-[state=on]:bg-green-500 data-[state=off]:bg-red-500",
                                                  "data-[state=on]:text-white data-[state=off]:text-white",
                                                  "w-12 h-6 flex items-center justify-center text-xs"
                                                )}
                                                disabled={isControlDisabled || isInput}
                                              >
                                                {isOutput ? (
                                                  value ? (
                                                    "ON"
                                                  ) : (
                                                    "OFF"
                                                  )
                                                ) : value ? (
                                                  <CircleCheck className="h-3 w-3" />
                                                ) : (
                                                  <CircleX className="h-3 w-3" />
                                                )}
                                              </Toggle>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground text-center">
                                      Value data not available.
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-xs text-muted-foreground text-center">
                                  No live data yet.
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Cpu className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <div className="text-lg mb-2">No devices found</div>
                <div className="text-sm">
                  Try adjusting your search criteria or refresh the data.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}
