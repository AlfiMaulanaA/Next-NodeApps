"use client";
import * as React from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <SidebarInset>
      <header className="flex h-16 items-center border-b px-4 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-lg font-semibold text-gray-900">Page Not Found</h1>
        </div>
      </header>
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-8 bg-gradient-to-br from-gray-50 to-white">
        <Image src="/public/not-found.svg" alt="Not Found" width={220} height={220} className="mb-6 opacity-80" />
        <h2 className="text-3xl font-bold mb-2 text-gray-800">404 - Page Not Found</h2>
        <p className="text-gray-600 mb-6 text-center max-w-md">
          Sorry, the page you are looking for does not exist or has been moved.<br />
          Please check the URL or return to the homepage.
        </p>
        <Link href="/">
          <Button variant="outline">Go to Homepage</Button>
        </Link>
      </main>
    </SidebarInset>
  );
}
