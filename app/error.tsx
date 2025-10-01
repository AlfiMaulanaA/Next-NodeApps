"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Home,
  RefreshCw,
  Bug,
  Sun,
  Moon,
  Menu,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.error("Application Error:", error);
  }, [error]);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  const handleReset = () => {
    reset();
  };

  const handleGoHome = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90">
      {/* Header with theme toggle */}
      <header className="flex items-center justify-between p-4 bg-card/50 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-2">
          <Image
            src="/images/gspe.jpg"
            alt="GSPE Logo"
            width={32}
            height={32}
            className="rounded-full"
          />
          <div>
            <h1 className="text-sm font-semibold text-foreground">GSPE</h1>
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="opacity-70 hover:opacity-100 transition-opacity"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </header>

      <main className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4 sm:p-8">
        <Card className="w-full max-w-2xl mx-auto shadow-2xl border-0 bg-card/95 backdrop-blur-sm animate-fadeInUp">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="bg-destructive/10 p-4 rounded-full">
                  <Bug className="h-12 w-12 text-destructive animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 bg-destructive rounded-full p-1">
                  <AlertTriangle className="h-4 w-4 text-destructive-foreground" />
                </div>
              </div>
            </div>
            <CardTitle className="text-3xl sm:text-4xl font-bold text-foreground mb-2 animate-fadeInUp">
              Oops! Something went wrong
            </CardTitle>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Badge variant="destructive" className="text-xs">
                Application Error
              </Badge>
              {error.digest && (
                <Badge variant="outline" className="text-xs">
                  Digest: {error.digest}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
              <h3 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Error Details
              </h3>
              <p className="text-sm text-destructive/80 leading-relaxed">
                {error.message ||
                  "An unexpected error occurred while rendering this page."}
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={handleReset}
                className="flex items-center gap-2 h-12 bg-primary hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>

              <Button
                onClick={handleGoHome}
                variant="outline"
                className="flex items-center gap-2 h-12 hover:bg-accent/50 transition-colors"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>

            {/* Quick navigation */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center mb-3">
                Quick navigation:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/settings/users">
                  <Button variant="ghost" size="sm" className="text-xs">
                    <Settings className="h-3 w-3 mr-1" />
                    User Management
                  </Button>
                </Link>
                <Link href="/devices/modbus">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Modbus Devices
                  </Button>
                </Link>
                <Link href="/devices/modular">
                  <Button variant="ghost" size="sm" className="text-xs">
                    I2C Devices
                  </Button>
                </Link>
                <Link href="/network/mqtt">
                  <Button variant="ghost" size="sm" className="text-xs">
                    MQTT Settings
                  </Button>
                </Link>
              </div>
            </div>

            {/* Error details toggle */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
                <Bug className="h-3 w-3" />
                Show Technical Details
              </summary>
              <div className="mt-3 p-3 bg-muted rounded-lg overflow-x-auto">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {`Error: ${error.name || "Unknown"}
Message: ${error.message}
Stack: ${error.stack}
Digest: ${error.digest || "N/A"}

Timestamp: ${new Date().toISOString()}
User Agent: ${
                    typeof window !== "undefined"
                      ? window.navigator.userAgent
                      : "SSR"
                  }
Theme: ${theme || "unknown"}`}
                </pre>
                <div className="mt-2 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive/80"
                    onClick={() =>
                      navigator.clipboard?.writeText(
                        JSON.stringify(
                          {
                            error: error.message,
                            stack: error.stack,
                            timestamp: new Date().toISOString(),
                            theme,
                            userAgent:
                              typeof window !== "undefined"
                                ? window.navigator.userAgent
                                : "SSR",
                          },
                          null,
                          2
                        )
                      )
                    }
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Copy Error Details
                  </Button>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
