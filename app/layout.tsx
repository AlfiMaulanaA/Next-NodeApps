import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";

const AppName = process.env.NEXT_PUBLIC_APP_NAME || "Acrylic Dashboard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${AppName} | Node Apps`,
  description: "Enterprise devices and user management system",
  icons: {
    icon: "/IOT.ico",
    shortcut: "/IOT.ico",
    apple: "/apple-touch-icon.png",
  },
};

// Client-only layout for sidebar logic
const ClientLayout = dynamic(() => import("@/components/ClientLayout"), {
  ssr: false,
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem>
          <ClientLayout>{children}</ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}