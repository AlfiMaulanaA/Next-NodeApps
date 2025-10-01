"use client";

import { Toaster } from "@/components/ui/sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        classNames: {
          toast: "group toast",
          title: "text-sm font-semibold",
          description: "text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toast]:bg-green-50 group-[.toast]:border-green-200 group-[.toast]:text-green-900",
          error: "group-[.toast]:bg-red-50 group-[.toast]:border-red-200 group-[.toast]:text-red-900",
          warning: "group-[.toast]:bg-orange-50 group-[.toast]:border-orange-200 group-[.toast]:text-orange-900",
          info: "group-[.toast]:bg-blue-50 group-[.toast]:border-blue-200 group-[.toast]:text-blue-900",
        },
      }}
      richColors
      closeButton
      expand
    />
  );
}