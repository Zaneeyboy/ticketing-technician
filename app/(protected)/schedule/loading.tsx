import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function CalendarSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-6 w-36' />
          <div className='flex gap-2'>
            <Skeleton className='h-8 w-8 rounded-md' />
            <Skeleton className='h-8 w-14 rounded-md' />
            <Skeleton className='h-8 w-8 rounded-md' />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day-of-week headers */}
        <div className='grid grid-cols-7 gap-px mb-px'>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className='bg-muted h-9 flex items-center justify-center'>
              <Skeleton className='h-3 w-6' />
            </div>
          ))}
        </div>
        {/* Calendar grid — 5 weeks */}
        <div className='grid grid-cols-7 gap-px bg-border/50 rounded-lg overflow-hidden'>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className='h-24 bg-background p-2 space-y-1'>
              <Skeleton className='h-4 w-4' />
              {i % 7 === 2 || i % 7 === 5 ? <Skeleton className='h-4 w-full rounded' /> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScheduleLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Header */}
        <div className='space-y-1'>
          <Skeleton className='h-8 w-52' />
          <Skeleton className='h-4 w-80' />
        </div>

        {/* Filters bar */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Skeleton className='h-4 w-4' />
                <Skeleton className='h-5 w-16' />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className='space-y-2'>
                  <Skeleton className='h-4 w-20' />
                  <Skeleton className='h-10 w-full rounded-md' />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tab bar */}
        <div className='flex gap-2'>
          <Skeleton className='h-9 w-32 rounded-md' />
          <Skeleton className='h-9 w-28 rounded-md' />
        </div>

        {/* Calendar */}
        <CalendarSkeleton />
      </div>
    </DashboardLayout>
  );
}
