import DashboardLayout from '@/components/dashboard-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function DailyServiceLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div className='space-y-2'>
          <Skeleton className='h-8 w-72' />
          <Skeleton className='h-4 w-96' />
        </div>
        <Card>
          <CardContent className='py-4 px-6'>
            <div className='flex gap-3'>
              <Skeleton className='h-9 w-40' />
              <Skeleton className='h-9 w-36' />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
