import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";

export type PageSkeletonVariant =
  | "dashboard"
  | "table"
  | "form"
  | "cards"
  | "settings"
  | "custom";

interface PageSkeletonProps {
  title?: string;
  icon?: LucideIcon;
  variant?: PageSkeletonVariant;
  showCards?: boolean;
  cardCount?: number;
  showTable?: boolean;
  tableRows?: number;
  showDeviceInfo?: boolean;
  showStats?: boolean;
  showSearch?: boolean;
  showHeader?: boolean;
}

export function PageSkeleton({
  title = "Loading...",
  icon: Icon,
  showCards = true,
  cardCount = 2,
  showTable = false,
  tableRows = 5,
  showDeviceInfo = false,
}: PageSkeletonProps) {
  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {Icon && <Icon className="h-5 w-5" />}
        <Skeleton className="h-6 w-48" />
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Device Information Card Skeleton */}
        {showDeviceInfo && (
          <Card className="mb-6">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* General Cards Skeleton */}
        {showCards && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {Array.from({ length: cardCount }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded" />
                      <div>
                        <Skeleton className="h-6 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-12" />
                    <div className="space-y-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Table Skeleton */}
        {showTable && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-80" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-28" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="w-full border-collapse border border-gray-300">
                  {/* Table Header */}
                  <div className="bg-gray-50 border-b border-gray-300">
                    <div className="grid grid-cols-6 gap-0">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="border-r border-gray-300 px-4 py-3"
                        >
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Table Rows */}
                  {Array.from({ length: tableRows }).map((_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="border-b border-gray-300 hover:bg-gray-50"
                    >
                      <div className="grid grid-cols-6 gap-0">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div
                            key={i}
                            className="border-r border-gray-300 px-4 py-3"
                          >
                            {i === 1 ? (
                              <Skeleton className="h-4 w-32" />
                            ) : i === 2 ? (
                              <Skeleton className="h-5 w-16 rounded-full" />
                            ) : i === 3 || i === 4 ? (
                              <Skeleton className="h-5 w-20 rounded-full" />
                            ) : (
                              <Skeleton className="h-4 w-12" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend Skeleton */}
              <div className="mt-6">
                <Skeleton className="h-5 w-16 mb-3" />
                <div className="flex flex-wrap gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Information Grid Skeleton */}
        {!showTable && showCards && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-40" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="text-center p-4 bg-muted/50 rounded-lg"
                  >
                    <Skeleton className="h-8 w-8 mx-auto mb-2" />
                    <Skeleton className="h-8 w-12 mx-auto mb-2" />
                    <Skeleton className="h-4 w-20 mx-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
}