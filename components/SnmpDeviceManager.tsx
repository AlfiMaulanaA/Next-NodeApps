"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getMQTTClient } from "@/lib/mqttClient";
import { useMQTTStatus } from "@/hooks/useMQTTStatus";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Network, RefreshCw, UploadIcon } from "lucide-react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

const formSchema = z.object({
  ip: z.string().min(7, "IP tidak valid"),
  netmask: z.string(),
  gateway: z.string(),
  port: z.string(),
  version: z.string(),
  security_name: z.string().optional(),
  level: z.string().optional(),
  auth_key: z.string().optional(),
  priv_key: z.string().optional(),
  oid: z.string(),
  site: z.string().optional(),
  trap: z.string().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

export default function SnmpDeviceManager() {
  const status = useMQTTStatus();
  const isConnected = status === "connected";
  const client = getMQTTClient();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ip: "",
      netmask: "",
      gateway: "",
      port: "161",
      version: "2c",
      security_name: "",
      level: "",
      auth_key: "",
      priv_key: "",
      oid: "",
      site: "",
      trap: "",
    },
  });

  // GET DATA dari response MQTT
  useEffect(() => {
    if (!client || !isConnected) return;

    const topic = "snmp/config/response";
    client.subscribe(topic);

    const handler = (topic: string, message: Buffer) => {
      if (topic === "snmp/config/response") {
        try {
          const payload = JSON.parse(message.toString());
          if (payload?.data) {
            form.reset(payload.data);
          }
        } catch (err) {
          console.error("❌ Failed to parse SNMP config:", err);
        }
      }
    };

    client.on("message", handler);

    return () => {
      client.off("message", handler);
      client.unsubscribe(topic);
    };
  }, [client, isConnected, form]);

  // GET CONFIG (get status dan data)
  const handleGetConfig = () => {
    if (!isConnected) return;
    client?.publish("snmp/config/get", "");
  };

  // UPDATE CONFIG
  const handleUpdateConfig = (values: FormSchema) => {
    if (!isConnected) return;
    const payload = { data: values };
    client?.publish("snmp/config/update", JSON.stringify(payload));
  };

  return (
    <SidebarInset>
      {/* HEADER */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">SNMP Communication</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGetConfig} disabled={!isConnected}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Get Status
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={form.handleSubmit(handleUpdateConfig)}
            disabled={!isConnected}
          >
            <UploadIcon className="w-4 h-4 mr-1" />
            Update Config
          </Button>
        </div>
      </header>

      {/* FORM */}
      <div className="p-6 space-y-8">
        <Card className="mt-4">
          <CardContent className="p-6 space-y-4">
            <Form {...form}>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Network Info */}
                <div className="col-span-full text-sm font-medium text-muted-foreground">
                  Network Info
                </div>
                {["ip", "netmask", "gateway", "port", "version"].map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name as keyof FormSchema}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="capitalize">{name.replace("_", " ")}</FormLabel>
                        <FormControl>
                          <Input placeholder={name} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                {/* Security */}
                <div className="col-span-full text-sm font-medium text-muted-foreground">
                  Security Parameters
                </div>
                {["security_name", "level", "auth_key", "priv_key"].map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name as keyof FormSchema}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="capitalize">{name.replace("_", " ")}</FormLabel>
                        <FormControl>
                          <Input placeholder={name} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                {/* SNMP Info */}
                <div className="col-span-full text-sm font-medium text-muted-foreground">
                  SNMP Info
                </div>
                {["oid", "site", "trap"].map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name as keyof FormSchema}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="capitalize">{name}</FormLabel>
                        <FormControl>
                          <Input placeholder={name} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}
