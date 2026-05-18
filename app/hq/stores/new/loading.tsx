import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HQStoresNewLoading() {
  return (
    <div className='max-w-2xl mx-auto space-y-6'>
      {/* Progress steps */}
      <div className='flex items-center gap-2'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='flex items-center gap-2'>
            <Skeleton className='h-8 w-8 rounded-full' />
            {i < 3 && <Skeleton className='h-px w-12' />}
          </div>
        ))}
      </div>

      {/* Step card */}
      <Card>
        <CardHeader className='space-y-2'>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='h-4 w-72' />
        </CardHeader>
        <CardContent className='space-y-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='space-y-2'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-10 w-full rounded-md' />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className='flex justify-between'>
        <Skeleton className='h-10 w-24 rounded-md' />
        <Skeleton className='h-10 w-28 rounded-md' />
      </div>
    </div>
  );
}
