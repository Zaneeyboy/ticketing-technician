import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HQTicketsLoading() {
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <Skeleton className='h-4 w-48' />
      </div>

      <Card>
        <CardContent className='p-0'>
          {/* Table header */}
          <div className='flex items-center border-b bg-muted/50 h-11 px-4 gap-6'>
            {['w-28', 'w-24', 'w-20', 'w-36', 'w-32', 'w-24'].map((w, i) => (
              <Skeleton key={i} className={`h-3 ${w}`} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className='flex items-center border-b last:border-0 h-13 px-4 gap-6'>
              <Skeleton className='h-4 w-28 font-mono' />
              <Skeleton className='h-5 w-24 rounded' />
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
