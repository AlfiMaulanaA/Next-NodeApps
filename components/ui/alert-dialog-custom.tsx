"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertDialogCustomProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: AlertType;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

const iconMap = {
  success: <CheckCircle2 className="h-6 w-6 text-green-600" />,
  error: <XCircle className="h-6 w-6 text-red-600" />,
  warning: <AlertTriangle className="h-6 w-6 text-orange-600" />,
  info: <Info className="h-6 w-6 text-blue-600" />,
};

const colorMap = {
  success: "text-green-600",
  error: "text-red-600",
  warning: "text-orange-600",
  info: "text-blue-600",
};

export function AlertDialogCustom({
  open,
  onOpenChange,
  type = "info",
  title,
  description,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  showCancel = false,
}: AlertDialogCustomProps) {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">{iconMap[type]}</div>
            <AlertDialogTitle className={colorMap[type]}>
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {showCancel && (
            <AlertDialogCancel onClick={handleCancel}>
              {cancelText}
            </AlertDialogCancel>
          )}
          <AlertDialogAction onClick={handleConfirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for easy usage
export function useAlertDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    type: AlertType;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    showCancel?: boolean;
  }>({
    open: false,
    type: "info",
    title: "",
    description: "",
  });

  const showAlert = React.useCallback(
    (options: Omit<typeof state, "open">) => {
      setState({ ...options, open: true });
    },
    []
  );

  const hideAlert = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    alertProps: {
      ...state,
      onOpenChange: hideAlert,
    },
    showAlert,
    hideAlert,
  };
}