// src/components/ScanAddressDialog.tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCw, ScanLine } from "lucide-react";
import { connectMQTT } from "@/lib/mqttClient"; // Pastikan path ini benar

interface ScanAddressDialogProps {
  onSelectAddress: (address: string) => void;
}

export default function ScanAddressDialog({ onSelectAddress }: ScanAddressDialogProps) {
  const [i2cResult, setI2cResult] = useState<string>("");
  const [hexInput, setHexInput] = useState<string>("");
  const [decimalResult, setDecimalResult] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false); // State untuk mengontrol dialog

  const client = connectMQTT();

  useEffect(() => {
    if (!client) return;

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        if (topic === "response/i2c_scan") {
          if (payload?.status === "success" && payload?.data) {
            setI2cResult(payload.data);
            setIsScanning(false); // Hentikan status scanning
          } else if (payload?.status === "error") {
            setI2cResult(`Error: ${payload.message || "Unknown error during scan."}`);
            setIsScanning(false);
          }
        }
      } catch (err) {
        console.error("Failed to parse MQTT message", err);
        setI2cResult("Error: Invalid response from device.");
        setIsScanning(false);
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
    setI2cResult("Scanning for I2C addresses...");
    setIsScanning(true); // Mulai status scanning
    client?.publish("command/i2c_scan", JSON.stringify({ command: "scan_i2c" }));
  };

  const convertHexToDecimal = (value: string) => {
    setHexInput(value);
    // Hapus awalan '0x' jika ada
    const cleanValue = value.startsWith('0x') ? value.substring(2) : value;
    try {
      if (cleanValue) {
        const decimal = parseInt(cleanValue, 16);
        if (!isNaN(decimal)) {
          setDecimalResult(decimal.toString());
        } else {
          setDecimalResult("Invalid hex");
        }
      } else {
        setDecimalResult("");
      }
    } catch (e) {
      setDecimalResult("Invalid hex");
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">Scan Address</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>I2C Address Tools</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Hex to Decimal Converter */}
          <div className="space-y-2">
            <h3 className="text-md font-semibold flex items-center gap-2">Hex to Decimal Converter</h3>
            <div>
              <Label htmlFor="hexValue">Hex Value</Label>
              <Input
                id="hexValue"
                placeholder="e.g. 0x3F or 3F"
                value={hexInput}
                onChange={(e) => convertHexToDecimal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="decimalResult">Decimal Result</Label>
              <Input id="decimalResult" value={decimalResult} readOnly />
            </div>
          </div>

          {/* I2C Scanner */}
          <div className="space-y-2">
            <h3 className="text-md font-semibold flex items-center gap-2">I2C Scanner <ScanLine className="h-4 w-4" /></h3>
            <Button onClick={checkI2CAddresses} disabled={isScanning}>
              {isScanning ? (
                <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" /> Scanning...
                </>
              ) : (
                <>
                  <ScanLine className="mr-2 h-4 w-4" /> Scan I2C Addresses
                </>
              )}
            </Button>
            <div className="mt-2">
              <Label>Scan Result</Label>
              <pre className="rounded bg-muted p-2 text-sm whitespace-pre-wrap max-h-40 overflow-auto">
                {i2cResult || "Click 'Scan I2C Addresses' to find devices."}
              </pre>
            </div>
            {i2cResult && !isScanning && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSelectAddress(i2cResult.split('\n')[0].split(': ')[1] || '')} // Asumsi format "Address: 0xXX"
                className="mt-2"
                disabled={!i2cResult.includes("0x")} // Only enable if a hex address is likely present
              >
                Use First Found Address
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}