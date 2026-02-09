import DashboardLayout from '@/components/dashboard-layout';
import { StatsSkeleton } from '@/components/skeletons/stats-skeleton';
import { CardGridSkeleton } from '@/components/skeletons/card-grid-skeleton';

export default function TechniciansLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Summary Stats Skeleton */}
        <StatsSkeleton count={4} />

        {/* Technician Cards Skeleton */}
        <CardGridSkeleton count={6} columns={3} />
      </div>
    </DashboardLayout>
  );
}
