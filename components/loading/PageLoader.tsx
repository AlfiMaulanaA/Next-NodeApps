import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "./LoadingSpinner";
import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PageLoaderProps {
  title?: string;
  icon?: LucideIcon;
  loadingText?: string;
  showHeader?: boolean;
  className?: string;
}

export function PageLoader({
  title,
  icon: Icon,
  loadingText = "Loading...",
  showHeader = true,
  className
}: PageLoaderProps) {
  return (
    <SidebarInset className={className}>
      {showHeader && (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {Icon ? (
            <Icon className="h-5 w-5" />
          ) : (
            <Skeleton className="h-5 w-5 rounded" />
          )}
          {title ? (
            <h1 className="text-lg font-semibold">{title}</h1>
          ) : (
            <Skeleton className="h-6 w-48" />
          )}
        </header>
      )}

      <div className="flex flex-1 items-center justify-center p-8">
        <LoadingSpinner size="lg" text={loadingText} />
      </div>
    </SidebarInset>
  );
}