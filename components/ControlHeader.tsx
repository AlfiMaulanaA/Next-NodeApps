"use client";

import { ReactNode } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RotateCw, Search, LucideIcon } from "lucide-react";
import MqttStatus from "@/components/mqtt-status";

interface ControlHeaderProps {
  title: string;
  icon: LucideIcon;
  onRefresh?: () => void;
  onAddNew?: () => void;
  addButtonText?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}

export default function ControlHeader({
  title,
  icon: Icon,
  onRefresh,
  onAddNew,
  addButtonText = "Add New",
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  children
}: ControlHeaderProps) {
  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4 bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Icon className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <MqttStatus />
          {onRefresh && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onRefresh}
              title="Refresh Data"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
          {children}
        </div>
      </header>

      {/* Sub Header - Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          {onAddNew && (
            <Button size="sm" onClick={onAddNew}>
              {addButtonText}
            </Button>
          )}
        </div>
        {onSearchChange && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        )}
      </div>
    </SidebarInset>
  );
}