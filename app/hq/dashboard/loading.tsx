import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsSkeleton } from '@/components/skeletons/stats-skeleton';

export default function HQDashboardLoading() {
  return (
    <div className='space-y-8'>
      {/* KPI Cards */}
      <StatsSkeleton count={5} />

      {/* Store Breakdown heading */}
      <Skeleton className='h-6 w-40' />

      {/* Store cards grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className='pb-2 space-y-1'>
              <div className='flex items-center justify-between'>
                <Skeleton className='h-5 w-36' />
                <Skeleton className='h-5 w-16 rounded-full' />
              </div>
              <Skeleton className='h-3 w-24' />
            </CardHeader>
            <CardContent>
              <div className='flex gap-4'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-4 w-16' />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
