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
import { AlertTriangle, Trash2, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConfirmationType = "delete" | "warning" | "info" | "success";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: ConfirmationType;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  destructive?: boolean;
}

const iconMap = {
  delete: <Trash2 className="h-6 w-6 text-red-600" />,
  warning: <AlertTriangle className="h-6 w-6 text-orange-600" />,
  info: <Info className="h-6 w-6 text-blue-600" />,
  success: <CheckCircle2 className="h-6 w-6 text-green-600" />,
};

const colorMap = {
  delete: "text-red-600",
  warning: "text-orange-600",
  info: "text-blue-600",
  success: "text-green-600",
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  type = "warning",
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm();
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
          <AlertDialogCancel onClick={handleCancel}>
            {cancelText}
          </AlertDialogCancel>
          {destructive || type === "delete" ? (
            <Button variant="destructive" onClick={handleConfirm}>
              {confirmText}
            </Button>
          ) : (
            <AlertDialogAction onClick={handleConfirm}>
              {confirmText}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook for easy usage
export function useConfirmationDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    type: ConfirmationType;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    destructive?: boolean;
  }>({
    open: false,
    type: "warning",
    title: "",
    description: "",
  });

  const showConfirmation = React.useCallback(
    (options: Omit<typeof state, "open"> & { onConfirm: () => void }) => {
      setState({ ...options, open: true });
    },
    []
  );

  const hideConfirmation = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    confirmationProps: {
      ...state,
      onOpenChange: hideConfirmation,
      onConfirm: state.onConfirm || (() => {}),
    },
    showConfirmation,
    hideConfirmation,
  };
}