"use client";

import * as React from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Home, Search, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NotFound() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <SidebarInset>
      <header className="flex h-16 items-center border-b px-4 bg-gradient-to-r from-background via-background/80 to-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold text-foreground">
              Page Not Found
            </h1>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4 sm:p-8">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90 -z-10" />

        <Card className="w-full max-w-2xl mx-auto shadow-2xl border-0 bg-card/95 backdrop-blur-sm animate-fadeInUp">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-6">
              <Image
                src={
                  theme === "dark"
                    ? "/images/ErrorNotFound-dark.png"
                    : "/images/ErrorNotFound.png"
                }
                alt="Not Found"
                width={240}
                height={240}
                className="opacity-90 hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
            <CardTitle className="text-4xl sm:text-5xl font-bold text-foreground mb-2 animate-fadeInUp">
              404
            </CardTitle>
            <h2 className="text-xl sm:text-2xl font-semibold text-muted-foreground mb-3">
              Oops! Page Not Found
            </h2>
          </CardHeader>

          <CardContent className="space-y-6">
            <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md mx-auto leading-relaxed">
              The page you're looking for seems to have wandered off into the
              digital void. Don't worry, it happens to the best of us! Let's get
              you back on track.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={goBack}
                variant="outline"
                size="lg"
                className="flex items-center gap-2 hover:bg-accent/50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>

              <Button
                asChild
                size="lg"
                className="flex items-center gap-2 bg-primary hover:bg-primary/90"
              >
                <Link href="/">
                  <Home className="h-4 w-4" />
                  Homepage
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="flex items-center gap-2 hover:bg-accent/50 transition-colors"
              >
                <Link href="/settings/users">
                  <Search className="h-4 w-4" />
                  User Management
                </Link>
              </Button>
            </div>

            {/* Helpful links */}
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center mb-3">
                Try these popular pages:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { href: "/", label: "Dashboard" },
                  { href: "/devices/modbus", label: "Modbus Devices" },
                  { href: "/devices/modular", label: "I2C Devices" },
                  { href: "/control/manual", label: "Control Center" },
                  { href: "/network/mqtt", label: "MQTT Settings" },
                ].map((link) => (
                  <Link key={link.href} href={link.href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs hover:bg-accent/30 transition-colors"
                    >
                      {link.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </SidebarInset>
  );
}
