import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HQUserDetailLoading() {
  return (
    <div className='space-y-6 max-w-2xl'>
      {/* Back link */}
      <Skeleton className='h-4 w-28' />

      {/* User header card */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex items-start gap-4'>
            <Skeleton className='h-16 w-16 rounded-full' />
            <div className='space-y-2 flex-1'>
              <Skeleton className='h-7 w-48' />
              <Skeleton className='h-4 w-64' />
              <div className='flex gap-2 mt-1'>
                <Skeleton className='h-5 w-24 rounded-full' />
                <Skeleton className='h-5 w-20 rounded-full' />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail rows */}
      <Card>
        <CardHeader>
          <Skeleton className='h-5 w-32' />
        </CardHeader>
        <CardContent className='space-y-4'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center gap-3'>
              <Skeleton className='h-4 w-4' />
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-4 w-40' />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
