// app/vpn/config/page.tsx
"use client";

import { useState } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, Lock, Zap, Settings } from "lucide-react";
import MqttStatus from "@/components/mqtt-status";
import { Button } from "@/components/ui/button";

import OpenVPNForm from "./components/OpenVPNForm";
import IKEv2Form from "./components/IKEv2Form";
import WireGuardForm from "./components/WireGuardForm";

export default function VPNConfigPage() {
  const [activeTab, setActiveTab] = useState<"openvpn" | "ikev2" | "wireguard">(
    "openvpn"
  );

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-base font-semibold">VPN Configuration</h1>
              <p className="text-xs text-muted-foreground">
                Manage VPN connections and settings
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MqttStatus />
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">VPN Protocols</h2>
            <p className="text-muted-foreground">
              Configure OpenVPN, IKEv2, or WireGuard connections
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="openvpn" className="gap-2">
              <Shield className="w-4 h-4" />
              OpenVPN
            </TabsTrigger>
            <TabsTrigger value="ikev2" className="gap-2">
              <Lock className="w-4 h-4" />
              IKEv2
            </TabsTrigger>
            <TabsTrigger value="wireguard" className="gap-2">
              <Zap className="w-4 h-4" />
              WireGuard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="openvpn" className="mt-6">
            <OpenVPNForm />
          </TabsContent>

          <TabsContent value="ikev2" className="mt-6">
            <IKEv2Form />
          </TabsContent>

          <TabsContent value="wireguard" className="mt-6">
            <WireGuardForm />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarInset>
  );
}
