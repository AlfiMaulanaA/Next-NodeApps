// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
// @ts-ignore - CSS import side effect
import "./globals.css";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";

// Mengambil nama aplikasi dan ikon dari environment variables atau menggunakan nilai default
const AppName = process.env.NEXT_PUBLIC_APP_NAME || " MQTT Gateway";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${AppName} | GSPE`,
  description: "Enterprise devices and user management system",
  icons: {
    icon: "/node-icon.svg",
    shortcut: "/node-icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

// ClientLayout dimuat secara dinamis dengan SSR dinonaktifkan
// Ini penting karena ClientLayout menggunakan hooks yang hanya berjalan di sisi klien
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
            attribute="class" // Menggunakan class HTML untuk theme (misal: "dark")
            defaultTheme="dark" // Theme default
            enableSystem // Memungkinkan sistem OS menentukan theme
          >
          {/* Semua konten aplikasi dibungkus oleh ClientLayout */}
          <ClientLayout>{children}</ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
