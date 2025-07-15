"use client";

import { useEffect, useState } from "react";

function getCurrentTime() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `${date} - ${time}`;
}

export default function RealtimeClockWithRefresh() {
  const [time, setTime] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);

    const timer = setInterval(() => {
      setTime(getCurrentTime());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!hydrated) return null;

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span>{time}</span>
    </div>
  );
}
