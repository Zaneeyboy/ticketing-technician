import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function MachineHealthLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div className='space-y-1'>
          <Skeleton className='h-8 w-40' />
          <Skeleton className='h-4 w-88' />
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className='pt-5'>
            <div className='flex flex-wrap gap-3'>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className='h-9 w-36 rounded-md' />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className='pb-2'>
                <Skeleton className='h-4 w-28' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-8 w-16' />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Machine table */}
        <Card>
          <CardHeader>
            <Skeleton className='h-5 w-36' />
          </CardHeader>
          <CardContent className='p-0'>
            <div className='flex items-center border-b bg-muted/50 h-11 px-4 gap-6'>
              {['w-32', 'w-28', 'w-20', 'w-24', 'w-20'].map((w, i) => (
                <Skeleton key={i} className={`h-3 ${w}`} />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className='flex items-center border-b last:border-0 h-12 px-4 gap-6'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-5 w-20 rounded-full' />
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-20' />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
