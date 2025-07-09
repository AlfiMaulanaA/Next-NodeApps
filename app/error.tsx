// app/error.tsx
"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Optionally log error to an error reporting service
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h2 className="text-2xl font-bold mb-2">Something went wrong!</h2>
      <p className="mb-4 text-gray-600">{error.message}</p>
      <Button onClick={() => reset()}>Try Again</Button>
    </div>
  );
}