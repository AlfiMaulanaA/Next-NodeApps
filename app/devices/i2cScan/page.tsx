"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, ScanLine } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { connectMQTT } from "@/lib/mqttClient";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";

export default function I2CScannerPage() {
  const [i2cResult, setI2cResult] = useState<string>("");
  const [hexInput, setHexInput] = useState<string>("");
  const [decimalResult, setDecimalResult] = useState<string>("");
  const status = useMQTTStatus();
  const client = connectMQTT();

  useEffect(() => {
    if (!client) return;

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload?.status === "success") {
          setI2cResult(payload.data);
        }
      } catch (err) {
        console.error("Failed to parse MQTT message", err);
      }
    };

    client.on("message", handleMessage);
    client.subscribe("response/i2c_scan");

    return () => {
      client.unsubscribe("response/i2c_scan");
      client.off("message", handleMessage);
    };
  }, [client]);

  const checkI2CAddresses = () => {
    setI2cResult("");
    client?.publish("command/i2c_scan", JSON.stringify({ command: "scan_i2c" }));
  };

  const convertHexToDecimal = (value: string) => {
    setHexInput(value);
    try {
      if (value) {
        setDecimalResult(parseInt(value, 16).toString());
      } else {
        setDecimalResult("");
      }
    } catch (e) {
      setDecimalResult("Invalid hexadecimal");
    }
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <ScanLine className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">I2C Scanner</h1>
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
            onClick={checkI2CAddresses}
          >
            <RotateCw />
          </Button>
        </div>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hex to Decimal Converter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label>Hex Value</Label>
              <Input
                placeholder="e.g. 0x3F"
                value={hexInput}
                onChange={(e) => convertHexToDecimal(e.target.value)}
              />
            </div>
            <div>
              <Label>Decimal Result</Label>
              <Input value={decimalResult} readOnly />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>I2C Addresses</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded bg-muted p-2 text-sm whitespace-pre-wrap">
              {i2cResult || "No result yet."}
            </pre>
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}
