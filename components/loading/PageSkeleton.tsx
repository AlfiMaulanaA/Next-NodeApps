import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon } from 'lucide-react';

interface PageSkeletonProps {
  title: string;
  icon?: LucideIcon;
  showDeviceInfo?: boolean;
  showTable?: boolean;
  tableRows?: number;
  showCards?: boolean;
  cardCount?: number;
}

export function PageSkeleton({
  title,
  icon: Icon,
  showDeviceInfo = false,
  showTable = false,
  tableRows = 5,
  showCards = false,
  cardCount = 3
}: PageSkeletonProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header Skeleton */}
      <div className="flex items-center gap-2 border-b pb-4">
        {Icon && <Icon className="h-5 w-5" />}
        <Skeleton className="h-6 w-48" />
      </div>

      {/* Device Info Skeleton */}
      {showDeviceInfo && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards Skeleton */}
      {showCards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: cardCount }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
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
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Table Header */}
              <div className="flex gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 flex-1" />
                ))}
              </div>

              {/* Table Rows */}
              {Array.from({ length: tableRows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4">
                  {Array.from({ length: 6 }).map((_, colIndex) => (
                    <Skeleton key={colIndex} className="h-4 flex-1" />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PageSkeleton;
