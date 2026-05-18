import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsSkeleton } from '@/components/skeletons/stats-skeleton';

export default function HQStoreDetailLoading() {
  return (
    <div className='space-y-6'>
      {/* Viewing banner */}
      <div className='rounded-lg border h-10 bg-muted/40 animate-pulse' />

      {/* Back + header */}
      <div className='space-y-2'>
        <Skeleton className='h-4 w-28' />
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Skeleton className='h-7 w-48' />
            <Skeleton className='h-5 w-20 rounded-full' />
          </div>
          <Skeleton className='h-9 w-28' />
        </div>
      </div>

      {/* KPI cards */}
      <StatsSkeleton count={4} />

      {/* Two column detail cards */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className='h-5 w-32' />
            </CardHeader>
            <CardContent className='space-y-3'>
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className='flex justify-between'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-4 w-32' />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent tickets table */}
      <Card>
        <CardHeader>
          <Skeleton className='h-5 w-36' />
        </CardHeader>
        <CardContent className='p-0'>
          <div className='flex items-center border-b bg-muted/50 h-11 px-4 gap-6'>
            {['w-28', 'w-20', 'w-36', 'w-32', 'w-24'].map((w, i) => (
              <Skeleton key={i} className={`h-3 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center border-b last:border-0 h-12 px-4 gap-6'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-5 w-20 rounded-full' />
              <Skeleton className='h-4 w-36' />
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-4 w-24' />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
