"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 flex flex-col">
      {/* Simplified header without sidebar components */}
      <header className="flex h-16 items-center border-b px-4 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">
            Page Not Found
          </h1>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center flex-1 p-4 sm:p-8">
        <Card className="w-full max-w-2xl mx-auto shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-6">
              <Image
                src="/images/ErrorNotFound.png"
                alt="Not Found"
                width={240}
                height={240}
                className="opacity-90 hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
            <CardTitle className="text-4xl sm:text-5xl font-bold text-foreground mb-2">
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
                <Link href="/settings/library">
                  <Home className="h-4 w-4" />
                  Settings
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
    </div>
  );
}
