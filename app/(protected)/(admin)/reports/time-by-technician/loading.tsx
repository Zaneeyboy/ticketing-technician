import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function TimeByTechnicianLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div className='space-y-1'>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='h-4 w-80' />
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className='pt-5'>
            <div className='flex flex-wrap gap-3'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-9 w-36 rounded-md' />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main table */}
        <Card>
          <CardHeader>
            <Skeleton className='h-5 w-44' />
          </CardHeader>
          <CardContent className='p-0'>
            <div className='flex items-center border-b bg-muted/50 h-11 px-4 gap-6'>
              {['w-36', 'w-28', 'w-24', 'w-24', 'w-20'].map((w, i) => (
                <Skeleton key={i} className={`h-3 ${w}`} />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className='flex items-center border-b last:border-0 h-12 px-4 gap-6'>
                <Skeleton className='h-4 w-36' />
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-4 w-24' />
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
