"use client";

import { useState, useEffect } from "react";

export type DatabaseStatus = "connected" | "disconnected" | "error" | "loading";

export function useDatabaseStatus() {
  const [status, setStatus] = useState<DatabaseStatus>("loading");
  const [userCount, setUserCount] = useState<number>(0);
  const [lastCheck, setLastCheck] = useState<string>("");

  useEffect(() => {
    const checkDatabaseStatus = async () => {
      try {
        setStatus("loading");

        const response = await fetch("/api/users/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setStatus("connected");
            setUserCount(data.count || 0);
            setLastCheck(new Date().toLocaleTimeString());
          } else {
            setStatus("error");
          }
        } else {
          setStatus("error");
        }
      } catch (error) {
        console.error("Database status check failed:", error);
        setStatus("disconnected");
      }
    };

    // Initial check
    checkDatabaseStatus();

    // Check every 30 seconds
    const interval = setInterval(checkDatabaseStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    status,
    userCount,
    lastCheck,
  };
}