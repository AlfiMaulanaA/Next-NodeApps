"use client";

import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = ["/auth/login", "/auth/register"].includes(pathname);
  return (
    <SidebarProvider>
      {!hideSidebar && <AppSidebar />}
      <main className="flex-1 overflow-auto">{children}</main>
    </SidebarProvider>
  );
}
