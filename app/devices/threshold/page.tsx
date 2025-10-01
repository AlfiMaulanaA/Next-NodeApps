"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectMQTT } from "@/lib/mqttClient";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RotateCw, Network } from "lucide-react";
import MQTTStatus from "@/components/mqtt-status";
import { toast } from "@/components/ui/use-toast";

// ✅ Schema validasi menggunakan zod
const schema = z.object({
  AC_INPUT_THRESHOLD: z.number().min(0, "Must be a non-negative number."),
  DC_BATTERY_VOLTAGE: z.number().min(0, "Must be a non-negative number."),
  DC_BATTERY_TOLERANCE: z.number().min(0, "Must be a non-negative number."),
  DC_OUTPUT_THRESHOLD: z.number().min(0, "Must be a non-negative number."),
  DC_OUTPUT_THRESHOLD_NORMAL: z
    .number()
    .min(0, "Must be a non-negative number."),
  MIN_CURRENT_THRESHOLD: z.number().min(0, "Must be a non-negative number."),
});

type FormValues = z.infer<typeof schema>;

export default function BatteryThresholdPage() {
  const [open, setOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<Partial<FormValues>>({});

  const {
    register,
    handleSubmit,
    setValue, // Keep setValue if needed elsewhere, though reset handles initial values
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      AC_INPUT_THRESHOLD: 0,
      DC_BATTERY_VOLTAGE: 0,
      DC_BATTERY_TOLERANCE: 0,
      DC_OUTPUT_THRESHOLD: 0,
      DC_OUTPUT_THRESHOLD_NORMAL: 0,
      MIN_CURRENT_THRESHOLD: 0,
    },
  });

  useEffect(() => {
    const client = connectMQTT();
    if (!client) {
      toast({
        title: "Error",
        description: "MQTT client not initialized.",
        variant: "destructive",
      });
      return;
    }

    client.subscribe("batteryCharger/config/response");
    client.subscribe("batteryCharger/config/update/response"); // Subscribe to update response

    const handleMessage = (topic: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (topic === "batteryCharger/config/response") {
          setCurrentConfig(data);
          reset(data); // Reset form with fetched data
        } else if (topic === "batteryCharger/config/update/response") {
          // Dismiss loading toast (if applicable)
          if (data.status === "success") {
            toast({
              title: "Success",
              description:
                data.message || "Configuration updated successfully!",
            });
            // Optionally, re-fetch config to ensure UI is in sync with device
            client.publish("batteryCharger/config/get", "");
          } else {
            toast({
              title: "Error",
              description: data.message || "Failed to update configuration.",
              variant: "destructive",
            });
          }
        }
      } catch (e) {
        console.error("Failed to parse MQTT message:", e);
        toast({
          title: "Error",
          description: "Received invalid data from MQTT.",
          variant: "destructive",
        });
      }
    };

    client.on("message", handleMessage);

    // GET konfigurasi awal
    client.publish("batteryCharger/config/get", "");

    return () => {
      client.off("message", handleMessage);
      client.unsubscribe("batteryCharger/config/response");
      client.unsubscribe("batteryCharger/config/update/response");
    };
  }, [reset]); // Added reset to dependency array

  // ✅ Fungsi update konfigurasi
  const onSubmit = (data: FormValues) => {
    const client = connectMQTT();
    if (!client || !client.connected) {
      toast({
        title: "Error",
        description: "MQTT not connected. Please wait or refresh.",
        variant: "destructive",
      });
      return;
    }

    // Convert numbers to strings if the device expects strings (common in MQTT configs)
    // Or ensure your backend handles numbers directly. Assuming numbers for now.
    client.publish(
      "batteryCharger/config/update",
      JSON.stringify(data),
      (err) => {
        if (err) {
          toast({
            title: "Error",
            description: `Failed to send update command: ${err.message}`,
            variant: "destructive",
          });
          console.error("Publish error:", err);
        } else {
          toast({
            title: "Processing",
            description: "Updating configuration...",
          });
        }
      }
    );
    setOpen(false); // Close dialog immediately after sending, response will handle feedback
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">
            Battery Threshold Configuration
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <MQTTStatus />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const client = connectMQTT();
              if (client) {
                client.publish("batteryCharger/config/get", "");
                toast({
                  title: "Info",
                  description: "Requesting latest configuration...",
                });
              } else {
                toast({
                  title: "Error",
                  description: "MQTT client not available.",
                  variant: "destructive",
                });
              }
            }}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Battery Threshold Configuration</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
          {Object.entries(schema.shape).map(([key]) => (
            <div
              key={key}
              className="flex flex-col bg-muted p-4 rounded-md border text-sm"
            >
              <span className="text-muted-foreground text-xs">{key}</span>
              <span className="font-medium">
                {currentConfig?.[key as keyof FormValues] ?? "—"}
              </span>
            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Edit Threshold</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Battery Threshold</DialogTitle>
              <DialogDescription>
                Modify only values you want to update
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
              {Object.keys(schema.shape).map((key) => (
                <div key={key} className="grid gap-1">
                  <label htmlFor={key} className="text-sm font-medium">
                    {key}
                  </label>
                  <Input
                    id={key}
                    type="number"
                    step="any"
                    {...register(key as keyof FormValues, {
                      valueAsNumber: true,
                    })}
                  />
                  {errors?.[key as keyof FormValues] && (
                    <span className="text-sm text-red-500">
                      {errors[key as keyof FormValues]?.message?.toString()}
                    </span>
                  )}
                </div>
              ))}
              <DialogFooter>
                <Button type="submit">Update</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}
