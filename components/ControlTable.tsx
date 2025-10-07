"use client";

import { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Eye, EyeOff, LucideIcon } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";

interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (value: any, item: any, index: number) => ReactNode;
}

interface TableAction {
  icon: LucideIcon;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  onClick: (item: any, index: number) => void;
  show?: (item: any) => boolean;
}

interface ControlTableProps {
  data: any[];
  columns: TableColumn[];
  actions?: TableAction[];
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  emptyState?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  className?: string;
}

export default function ControlTable({
  data,
  columns,
  actions = [],
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  emptyState,
  className = ""
}: ControlTableProps) {
  const startIndex = (currentPage - 1) * itemsPerPage;

  if (data.length === 0 && emptyState) {
    const EmptyIcon = emptyState.icon;
    return (
      <div className={`text-center py-12 border rounded-lg bg-muted/20 ${className}`}>
        {EmptyIcon && <EmptyIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />}
        <h3 className="text-lg font-semibold text-foreground mb-2">{emptyState.title}</h3>
        {emptyState.description && (
          <p className="text-muted-foreground mb-4">{emptyState.description}</p>
        )}
        {emptyState.action && (
          <Button variant="outline" onClick={emptyState.action.onClick}>
            {emptyState.action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-lg border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[60px] text-center">#</TableHead>
              {columns.map((column) => (
                <TableHead 
                  key={column.key} 
                  className={`${column.className || ""} ${column.sortable ? "cursor-pointer select-none" : ""}`}
                >
                  {column.label}
                </TableHead>
              ))}
              {actions.length > 0 && (
                <TableHead className="w-[120px] text-center">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                <TableCell className="text-center font-medium text-muted-foreground">
                  {startIndex + index + 1}
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className || ""}>
                    {column.render 
                      ? column.render(item[column.key], item, index)
                      : item[column.key]
                    }
                  </TableCell>
                ))}
                {actions.length > 0 && (
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      {actions.map((action, actionIndex) => {
                        if (action.show && !action.show(item)) return null;
                        
                        return (
                          <Button
                            key={actionIndex}
                            size="icon"
                            variant={action.variant || "ghost"}
                            onClick={() => action.onClick(item, index)}
                            title={action.label}
                            className="h-8 w-8"
                          >
                            <action.icon className="h-4 w-4" />
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="justify-center">
          <PaginationContent>
            <PaginationPrevious 
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
            {Array.from({ length: totalPages }, (_, idx) => (
              <PaginationItem key={idx}>
                <PaginationLink
                  isActive={currentPage === idx + 1}
                  onClick={() => onPageChange(idx + 1)}
                  className="cursor-pointer"
                >
                  {idx + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationNext 
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}