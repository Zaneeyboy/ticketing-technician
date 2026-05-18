import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HQStoresLoading() {
  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-9 w-28 rounded-full' />
      </div>

      <Card>
        <CardContent className='p-0'>
          {/* Table header */}
          <div className='flex items-center border-b bg-muted/50 h-11 px-4 gap-6'>
            {['w-40', 'w-28', 'w-20', 'w-36', 'w-16'].map((w, i) => (
              <Skeleton key={i} className={`h-3 ${w}`} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='flex items-center border-b last:border-0 h-14 px-4 gap-6'>
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-5 w-20 rounded-full' />
              <Skeleton className='h-4 w-36' />
              <Skeleton className='h-8 w-16 rounded-md' />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
