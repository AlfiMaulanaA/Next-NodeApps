// components/ClientLayout.tsx
"use client";

import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar"; // Pastikan path ini benar
import { AppSidebar } from "@/components/app-sidebar";   // Pastikan path ini benar
import { usePathname } from "next/navigation";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Memeriksa apakah path saat ini dimulai dengan "/auth/login" atau "/auth/register"
  // Ini lebih robust terhadap trailing slashes atau sub-path
  const hideSidebar = pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register");

  return (
    <SidebarProvider>
      {/* Sidebar hanya ditampilkan jika hideSidebar adalah false */}
      {!hideSidebar && <AppSidebar />}
      <main className="flex-1 overflow-auto">{children}</main>
    </SidebarProvider>
  );
}