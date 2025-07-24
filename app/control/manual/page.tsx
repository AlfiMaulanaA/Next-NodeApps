"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, Cpu, Search, Server, CircleCheck, CircleX, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { connectMQTT } from "@/lib/mqttClient";
import { useSearchFilter } from "@/hooks/use-search-filter";
import MqttStatus from "@/components/mqtt-status";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

// Define the type for a device
interface Device {
  profile: {
    name: string;
    part_number: string;
    topic: string;
  };
  protocol_setting: {
    address: string;
    device_bus: string;
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
  value: string; // The 'value' field itself is a JSON string
  Timestamp: string;
}

// Define the type for the parsed 'value' content
interface ParsedValueData {
  [key: string]: boolean | undefined; // All drycontactInput are booleans
}

// State untuk menyimpan data payload dari setiap topik perangkat
interface DeviceTopicData {
  [topic: string]: FullDevicePayload;
}

export default function DeviceManagerPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [mqttBrokerData, setMqttBrokerData] = useState<MqttBrokerData | null>(null);
  const [deviceTopicPayloads, setDeviceTopicPayloads] = useState<DeviceTopicData>({});
  // State untuk melacak status tampil/sembunyi live data untuk setiap perangkat
  const [showLiveDataState, setShowLiveDataState] = useState<{ [topic: string]: boolean }>({});

  const clientRef = useRef<any>(null); // Tetap menggunakan any untuk clientRef jika mqttClient.ts tidak Typed

  // useEffect untuk koneksi MQTT dan langganan awal (response_device_i2c, mqtt_broker_server)
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
            setShowLiveDataState(prev => {
              const newState = { ...prev };
              (payload as Device[]).forEach((device: Device) => { // Type assertion
                if (newState[device.profile.topic] === undefined) {
                  newState[device.profile.topic] = true; // Default to showing live data for new devices
                }
              });
              // Hapus status untuk perangkat yang tidak lagi ada
              Object.keys(newState).forEach(existingTopic => {
                if (!(payload as Device[]).some((d: Device) => d.profile.topic === existingTopic)) { // Type assertion
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
        } else if (topic === "mqtt_broker_server") {
          console.log("[MQTT] Received mqtt_broker_server payload:", payload);
          setMqttBrokerData(payload as MqttBrokerData); // Type assertion untuk broker data
        } else {
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
    client.subscribe("mqtt_broker_server", { qos: 1 });

    client.publish("command_device_i2c", JSON.stringify({ command: "getDataI2C" }));

    return () => {
      client.unsubscribe("response_device_i2c");
      client.unsubscribe("mqtt_broker_server");
      client.off("message", handleMessage);
    };
  }, []); // Dependency array tetap kosong karena ini hanya untuk setup awal dan listener

  // useEffect untuk secara dinamis berlangganan topik perangkat
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;

    const currentSubscriptions = new Set(Object.keys(deviceTopicPayloads));
    const desiredSubscriptions = new Set(devices.map(d => d.profile.topic));

    currentSubscriptions.forEach(topic => {
      if (!desiredSubscriptions.has(topic) && topic !== "response_device_i2c" && topic !== "mqtt_broker_server") {
        client.unsubscribe(topic);
        setDeviceTopicPayloads(prev => {
          const newPayloads = { ...prev };
          delete newPayloads[topic];
          return newPayloads;
        });
        // Hapus status live data saat unsubscribe
        setShowLiveDataState(prev => {
          const newState = { ...prev };
          delete newState[topic];
          return newState;
        });
        console.log(`[MQTT] Unsubscribed from: ${topic}`);
      }
    });

    desiredSubscriptions.forEach(topic => {
      if (!currentSubscriptions.has(topic)) {
        client.subscribe(topic, { qos: 0 });
        console.log(`[MQTT] Subscribed to: ${topic}`);
      }
    });

    // Cleanup function untuk unsubscribe saat komponen unmount atau dependencies berubah
    return () => {
      desiredSubscriptions.forEach(topic => {
        client.unsubscribe(topic);
        console.log(`[MQTT] Unsubscribed from: ${topic} (cleanup)`);
      });
    };
  }, [devices, deviceTopicPayloads]); // Tambahkan deviceTopicPayloads sebagai dependency agar cleanup berfungsi

  const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(devices, [
    "profile.name",
    "profile.part_number",
    "profile.topic",
    "protocol_setting.address",
  ]);

  // Fungsi untuk mengirim perintah MQTT saat toggle diubah
  const handleToggleChange = (device: Device, inputKey: string, newState: boolean) => {
    if (!clientRef.current || !mqttBrokerData) {
      console.warn("MQTT client not available or broker data missing.");
      return;
    }

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
        data: newState ? 1 : 0
      },
      address: device.protocol_setting.address,
      device_bus: device.protocol_setting.device_bus,
      Timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    };

    const controlTopic = "modular";

    clientRef.current.publish(
      controlTopic,
      JSON.stringify(commandPayload)
    );
    console.log(`[MQTT] Sending command to ${controlTopic}: ${JSON.stringify(commandPayload)}`);

    // Opsional: Perbarui UI secara optimis
    setDeviceTopicPayloads(prevPayloads => {
      const currentPayload = prevPayloads[device.profile.topic];
      if (currentPayload) {
        try {
          const parsedValue = JSON.parse(currentPayload.value);
          // Pastikan parsedValue adalah objek sebelum mencoba memperbarui properti
          if (typeof parsedValue === 'object' && parsedValue !== null) {
            parsedValue[inputKey] = newState;
            return {
              ...prevPayloads,
              [device.profile.topic]: {
                ...currentPayload,
                value: JSON.stringify(parsedValue)
              }
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
    setShowLiveDataState(prevState => ({
      ...prevState,
      [topic]: !prevState[topic]
    }));
  };

  return (
    <SidebarInset>
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
            onClick={() => {
              clientRef.current?.publish(
                "command_device_i2c",
                JSON.stringify({ command: "getDataI2C" })
              );
            }}
          >
            <RotateCw />
          </Button>
        </div>
      </header>

      {/* Bagian untuk menampilkan data MQTT Broker Server */}
      <Card className="m-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" /> MQTT Broker Server Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mqttBrokerData ? (
            <div className="bg-card text-card-foreground rounded-lg shadow-sm p-4 border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="col-span-2"><span className="font-medium">MAC:</span> {mqttBrokerData.mac_address}</div>
                <div><span className="font-medium">Broker Address:</span> {mqttBrokerData.broker_address}</div>
                <div><span className="font-medium">Broker Port:</span> {mqttBrokerData.broker_port}</div>
                <div><span className="font-medium">Broker Username:</span> {mqttBrokerData.username || '-'}</div>
                <div><span className="font-medium">Broker Password:</span> {mqttBrokerData.password ? '********' : '-'}</div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No broker server data received yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="m-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Connected Devices</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices by name, part number, topic, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredData.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredData.map((device: Device) => { // Hapus 'index' karena tidak digunakan sebagai key lagi
                const fullDevicePayload = deviceTopicPayloads[device.profile.topic];
                const showLiveData = showLiveDataState[device.profile.topic];

                let parsedValue: ParsedValueData | null = null;
                if (fullDevicePayload && typeof fullDevicePayload.value === 'string') {
                  try {
                    parsedValue = JSON.parse(fullDevicePayload.value);
                  } catch (e) {
                    console.error(`Error parsing value for topic ${device.profile.topic}:`, e);
                  }
                }

                // Tentukan apakah toggle harus dinonaktifkan
                const isControlDisabled = !(device.profile.part_number === "RELAY" || device.profile.part_number === "RELAYMINI");

                return (
                  // Gunakan device.profile.topic sebagai key yang lebih stabil
                  <Card key={device.profile.topic} className="border-l-4 border-green-500 shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg font-semibold truncate">
                          {device.profile.name}
                        </CardTitle>
                        {/* Tombol Toggle Live Data */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleLiveDataVisibility(device.profile.topic)}
                          className="h-7 w-7"
                        >
                          {showLiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">PN: {device.profile.part_number}</p>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p className="flex justify-between items-center">
                        <span className="text-muted-foreground">Address:</span>
                        <Badge variant="secondary">{device.protocol_setting.address}</Badge>
                      </p>
                      <p className="flex justify-between items-center mt-1">
                        <span className="text-muted-foreground">Bus:</span>
                        <Badge variant="secondary">{device.protocol_setting.device_bus}</Badge>
                      </p>
                      <p className="flex justify-between items-center mt-1">
                        <span className="text-muted-foreground">Topic:</span>
                        <Badge variant="secondary" className="max-w-[150px] truncate">{device.profile.topic}</Badge>
                      </p>

                      {/* Konten Live Data, ditampilkan berdasarkan showLiveData */}
                      {showLiveData && (
                        <>
                          <Separator className="my-2" />
                          <div className="text-xs text-muted-foreground mb-1">Live Data:</div>
                          {fullDevicePayload ? (
                            <>
                              <div className="flex justify-between items-center col-span-2 text-sm">
                                <span className="font-medium">Timestamp:</span>
                                <Badge variant="outline" className="text-foreground">{fullDevicePayload.Timestamp}</Badge>
                              </div>
                              {parsedValue ? (
                                <div className="grid grid-cols-2 gap-1 text-sm mt-2">
                                  {Object.entries(parsedValue).map(([key, value]) => {
                                    // Ekstrak nomor dari key, e.g., "drycontactInput1" -> "1"
                                    const inputNumberMatch = key.match(/\d+/);
                                    const displayKey = inputNumberMatch ? `Input ${inputNumberMatch[0]}` : key;

                                    // Hanya tampilkan jika key adalah drycontactInputX dan valuenya boolean
                                    if (key.startsWith('drycontactInput') && typeof value === 'boolean') {
                                      return (
                                        <div key={key} className="flex justify-between items-center col-span-2">
                                          <span className="font-medium">{displayKey}:</span>
                                          <Toggle
                                            pressed={value}
                                            aria-label={`Toggle ${displayKey} status`}
                                            onPressedChange={(newState) => handleToggleChange(device, key, newState)}
                                            size="sm"
                                            className={cn(
                                              "data-[state=on]:bg-green-500 data-[state=off]:bg-red-500",
                                              "data-[state=on]:text-white data-[state=off]:text-white",
                                              "w-20 h-7 flex items-center justify-center text-xs gap-1"
                                            )}
                                            disabled={isControlDisabled}
                                          >
                                            {value ? (
                                                <>ON <CircleCheck className="h-4 w-4" /></>
                                            ) : (
                                                <>OFF <CircleX className="h-4 w-4" /></>
                                            )}
                                          </Toggle>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center">Value data not available or malformed.</p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center">No live data yet.</p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No devices found matching your search.
            </div>
          )}
        </CardContent>
      </Card>
    </SidebarInset>
  );
}