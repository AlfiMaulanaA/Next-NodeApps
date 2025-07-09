"use client";

import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, Cpu, Wifi, WifiOff } from "lucide-react";
import RealtimeClock from "@/components/realtime-clock";
import Refresh from "@/components/refresh-button";
import MqttStatus from "@/components/mqtt-status";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export default function OverviewDashboard() {
  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Node App</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
  <RealtimeClock />
  <Refresh />
</div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Cpu className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">All registered devices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <Wifi className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">Devices currently online</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <WifiOff className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground">Devices currently offline</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          <Tabs defaultValue="internal" className="w-full">
          <div className="flex items-center justify-between">
  <TabsList>
    <TabsTrigger value="internal">Internal Devices</TabsTrigger>
    <TabsTrigger value="external">External Devices</TabsTrigger>
  </TabsList>
  <MqttStatus />
</div>
            <TabsContent value="internal" className="mt-2">
              <Card>
                <CardHeader>
                  <CardTitle>Internal Devices</CardTitle>
                  <CardDescription>List of internal devices (dummy data)</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  - Device 001 (Online)  
                  <br />- Device 002 (Offline)  
                  <br />- Device 003 (Online)
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="external" className="mt-2">
              <Card>
                <CardHeader>
                  <CardTitle>External Devices</CardTitle>
                  <CardDescription>List of external devices (dummy data)</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  - Device A1 (Online)  
                  <br />- Device B2 (Offline)
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        
      </div>
    </SidebarInset>
  );
}
