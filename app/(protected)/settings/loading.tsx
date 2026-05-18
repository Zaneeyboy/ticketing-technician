import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <DashboardLayout>
      <div className='max-w-2xl space-y-6'>
        {/* Store Information card */}
        <Card>
          <CardHeader className='space-y-1'>
            <Skeleton className='h-6 w-40' />
            <Skeleton className='h-4 w-72' />
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-1'>
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-10 w-full rounded-md' />
              </div>
              <div className='space-y-1'>
                <Skeleton className='h-4 w-14' />
                <Skeleton className='h-10 w-full rounded-md' />
              </div>
            </div>
            <Skeleton className='h-px w-full' />
            {['Contact Email', 'Contact Phone', 'Address'].map((_, i) => (
              <div key={i} className='space-y-2'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-10 w-full rounded-md' />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Regional settings card */}
        <Card>
          <CardHeader className='space-y-1'>
            <Skeleton className='h-6 w-36' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent className='space-y-4'>
            {[1, 2].map((i) => (
              <div key={i} className='space-y-2'>
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-10 w-full rounded-md' />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Save button */}
        <Skeleton className='h-10 w-28 rounded-md' />
      </div>
    </DashboardLayout>
  );
}
