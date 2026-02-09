import DashboardLayout from '@/components/dashboard-layout';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function UsersLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Header with Action Button Skeleton */}
        <div className='flex items-center justify-between'>
          <div className='space-y-1'>
            <Skeleton className='h-8 w-48' />
            <Skeleton className='h-4 w-72' />
          </div>
          <Skeleton className='h-10 w-32' />
        </div>

        {/* Filter/Search Skeleton */}
        <Card>
          <CardHeader>
            <div className='flex gap-4'>
              <Skeleton className='h-10 flex-1 max-w-sm' />
              <Skeleton className='h-10 w-32' />
            </div>
          </CardHeader>
        </Card>

        {/* Table Skeleton */}
        <TableSkeleton rows={10} columns={6} showHeader />
      </div>
    </DashboardLayout>
  );
}
