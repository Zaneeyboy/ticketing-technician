import DashboardLayout from '@/components/dashboard-layout';
import { StatsSkeleton } from '@/components/skeletons/stats-skeleton';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function CallAdminsLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-4 w-96 max-w-full' />
        </div>

        {/* Summary Stats Skeleton */}
        <StatsSkeleton count={4} />

        {/* Table Skeleton */}
        <TableSkeleton rows={8} columns={6} showHeader />
      </div>
    </DashboardLayout>
  );
}
