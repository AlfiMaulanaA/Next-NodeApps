"use client";

import { useState } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Info, Network, Server, Zap } from "lucide-react";
import ApiScan from "@/components/tabs/ApiScan";
import ApiInfo from "@/components/tabs/ApiInfo";

export default function ApiPage() {
  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Network className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">
            API Management
          </h1>
        </div>
      </header>

      <div className="p-6">
        <Tabs defaultValue="scan" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Network Scan
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Device Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="mt-6">
            <ApiScan />
          </TabsContent>

          <TabsContent value="info" className="mt-6">
            <ApiInfo />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarInset>
  );
}
