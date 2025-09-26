// components/ClientLayout.tsx
"use client";

import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { MQTTModeProvider } from "@/contexts/MQTTModeContext";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Hide sidebar for auth pages
  const hideSidebar = pathname.startsWith("/auth/");

  return (
    <AuthProvider>
      <MQTTModeProvider>
        <SidebarProvider>
          {/* Sidebar hanya ditampilkan jika hideSidebar adalah false */}
          {!hideSidebar && <AppSidebar />}
          <main className="flex-1 overflow-auto">{children}</main>
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </SidebarProvider>
      </MQTTModeProvider>
    </AuthProvider>
  );
}
