"use client";

import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LucideIcon, X } from "lucide-react";

interface ControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: LucideIcon;
  isEditing?: boolean;
  onSave: () => void;
  onCancel?: () => void;
  saveText?: string;
  cancelText?: string;
  children: ReactNode;
  className?: string;
  subtitle?: string;
}

export default function ControlDialog({
  open,
  onOpenChange,
  title,
  icon: Icon,
  isEditing = false,
  onSave,
  onCancel,
  saveText,
  cancelText = "Cancel",
  children,
  className = "sm:max-w-[600px]",
  subtitle
}: ControlDialogProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  const defaultSaveText = isEditing ? "Update" : "Create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5 text-primary" />}
              <DialogTitle className="text-xl font-semibold">
                {title}
              </DialogTitle>
            </div>
            <Badge variant={isEditing ? "secondary" : "default"} className="text-xs">
              {isEditing ? "Edit Mode" : "Create Mode"}
            </Badge>
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </DialogHeader>
        
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {children}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button type="submit" onClick={onSave}>
            {saveText || defaultSaveText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}