import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsSkeleton } from '@/components/skeletons/stats-skeleton';

export default function DashboardLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Welcome Section Skeleton */}
        <div className='space-y-2'>
          <Skeleton className='h-8 w-64' />
          <Skeleton className='h-4 w-96' />
        </div>

        {/* Stats Grid Skeleton */}
        <StatsSkeleton count={4} />

        {/* Charts Section Skeleton */}
        <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
          {/* Recent Activity */}
          <Card className='xl:col-span-2'>
            <CardHeader className='space-y-2'>
              <Skeleton className='h-6 w-48' />
              <Skeleton className='h-4 w-72' />
            </CardHeader>
            <CardContent className='space-y-4'>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className='flex items-start gap-4 pb-4 border-b last:border-0'>
                  <Skeleton className='h-10 w-10 rounded-full' />
                  <div className='flex-1 space-y-2'>
                    <Skeleton className='h-4 w-3/4' />
                    <Skeleton className='h-3 w-1/2' />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className='xl:col-span-1'>
            <CardHeader className='space-y-2'>
              <Skeleton className='h-6 w-36' />
            </CardHeader>
            <CardContent className='space-y-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className='flex justify-between items-center'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-6 w-12' />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
