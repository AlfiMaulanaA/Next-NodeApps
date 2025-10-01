"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface NotificationToastProps {
  type: "face" | "palm";
  result: {
    name: string;
    success: boolean;
    authorized?: boolean;
    score?: number;
    distance?: number;
  };
  onClose?: () => void;
}

export function NotificationToast({
  type,
  result,
  onClose,
}: NotificationToastProps) {
  useEffect(() => {
    const showToast = () => {
      const isSuccess =
        type === "face"
          ? result.success && result.authorized
          : result.success && (result.score || 0) >= 0.8;

      const icon = type === "face" ? "👤" : "🖐️";
      const recognitionType = type === "face" ? "Face" : "Palm";
      const confidence = type === "face"
        ? `Confidence: ${((1 - (result.distance || 0)) * 100).toFixed(1)}%`
        : `Score: ${((result.score || 0) * 100).toFixed(1)}%`;
      const timestamp = new Date().toLocaleTimeString();

      if (isSuccess) {
        toast.success(`${icon} ${recognitionType} Recognition Success`, {
          description: (
            <div className="space-y-1">
              <p className="font-semibold text-green-700">{result.name}</p>
              <p className="text-sm text-gray-600">{confidence}</p>
              <p className="text-xs text-gray-500">{timestamp}</p>
            </div>
          ),
          duration: 4000,
          onDismiss: onClose,
          onAutoClose: onClose,
        });
      } else if (result.name === "No Face Detected") {
        toast.info("👤 No Face Detected", {
          description: "Please position your face clearly in front of the camera",
          duration: 4000,
          onDismiss: onClose,
          onAutoClose: onClose,
        });
      } else if (result.name === "Unknown Person") {
        toast.warning("❓ Unknown Person", {
          description: (
            <div className="space-y-1">
              <p className="text-sm">Face detected but not recognized</p>
              <p className="text-xs text-gray-500">{confidence}</p>
            </div>
          ),
          duration: 4000,
          onDismiss: onClose,
          onAutoClose: onClose,
        });
      } else {
        toast.error(`🚫 ${recognitionType} Recognition Failed`, {
          description: (
            <div className="space-y-1">
              <p className="font-semibold text-red-700">{result.name}</p>
              <p className="text-sm text-gray-600">Access denied</p>
              <p className="text-xs text-gray-500">{timestamp}</p>
            </div>
          ),
          duration: 4000,
          onDismiss: onClose,
          onAutoClose: onClose,
        });
      }
    };

    showToast();
  }, [type, result, onClose]);

  return null;
}
