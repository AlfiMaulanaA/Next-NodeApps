// app/error.tsx
"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Optionally log error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-8 max-w-md w-full text-center animate-fade-in">
        <div className="flex justify-center mb-4 text-red-500">
          <AlertTriangle size={48} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-red-600">Oops! Something went wrong.</h2>
        <p className="mb-4 text-gray-600 text-sm">{error.message}</p>
        <div className="flex flex-col gap-2">
          <Button onClick={reset} className="w-full">
            Try Again
          </Button>
          <Link href="/">
            <Button variant="outline" className="w-full">
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
