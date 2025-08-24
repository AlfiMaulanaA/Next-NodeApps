"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface SummaryItem {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

interface ControlSummaryCardProps {
  title: string;
  icon: LucideIcon;
  items: SummaryItem[];
  className?: string;
}

export default function ControlSummaryCard({
  title,
  icon: Icon,
  items,
  className = ""
}: ControlSummaryCardProps) {
  return (
    <Card className={`border-l-4 border-l-primary ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                {item.icon && <item.icon className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <Badge variant={item.variant || "secondary"} className="text-sm px-3 py-1">
                {item.value}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}