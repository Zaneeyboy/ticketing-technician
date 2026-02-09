import DashboardLayout from '@/components/dashboard-layout';
import { StatsSkeleton } from '@/components/skeletons/stats-skeleton';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';

export default function MachinesLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Summary Stats Skeleton */}
        <StatsSkeleton count={4} />

        {/* Table Skeleton */}
        <TableSkeleton rows={10} columns={7} showHeader />
      </div>
    </DashboardLayout>
  );
}
