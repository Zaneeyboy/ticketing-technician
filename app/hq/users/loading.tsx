import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HQUsersLoading() {
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <Skeleton className='h-4 w-40' />
      </div>

      {/* Tabs skeleton */}
      <div className='flex gap-2 border-b pb-0'>
        <Skeleton className='h-9 w-20' />
        <Skeleton className='h-9 w-24' />
      </div>

      <Card>
        <CardContent className='p-0'>
          {/* Table header */}
          <div className='flex items-center border-b bg-muted/50 h-11 px-4 gap-6'>
            {['w-36', 'w-48', 'w-24', 'w-28', 'w-20'].map((w, i) => (
              <Skeleton key={i} className={`h-3 ${w}`} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className='flex items-center border-b last:border-0 h-14 px-4 gap-6'>
              <Skeleton className='h-4 w-36' />
              <Skeleton className='h-4 w-48' />
              <Skeleton className='h-5 w-24 rounded-full' />
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-8 w-16 rounded-md' />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
