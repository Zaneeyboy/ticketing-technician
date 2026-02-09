import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export function TableSkeleton({ rows = 5, columns = 5, showHeader = true }: TableSkeletonProps) {
  return (
    <Card>
      {showHeader && (
        <CardHeader className='space-y-2'>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='h-4 w-72' />
        </CardHeader>
      )}
      <CardContent>
        <div className='w-full overflow-auto'>
          <div className='w-full'>
            {/* Table Header */}
            <div className='flex items-center border-b bg-muted/50 h-12 px-4 gap-4'>
              {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className='h-4 flex-1' />
              ))}
            </div>
            {/* Table Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={rowIndex} className='flex items-center border-b h-12 px-4 gap-4'>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton key={colIndex} className='h-4 flex-1' />
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
