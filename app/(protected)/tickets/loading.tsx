import DashboardLayout from '@/components/dashboard-layout';
import { StatsSkeleton } from '@/components/skeletons/stats-skeleton';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function TicketsLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Filter Tabs Skeleton */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-9 w-24' />
              <Skeleton className='h-9 w-24' />
              <Skeleton className='h-9 w-24' />
            </div>
          </CardHeader>
        </Card>

        {/* Summary Stats Skeleton */}
        <StatsSkeleton count={4} />

        {/* Table Skeleton */}
        <TableSkeleton rows={8} columns={7} showHeader />
      </div>
    </DashboardLayout>
  );
}
