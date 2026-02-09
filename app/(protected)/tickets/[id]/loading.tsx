import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function TicketDetailsLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Header Skeleton */}
        <div className='flex items-center justify-between'>
          <div className='space-y-2'>
            <Skeleton className='h-8 w-48' />
            <Skeleton className='h-4 w-64' />
          </div>
          <div className='flex gap-2'>
            <Skeleton className='h-10 w-24' />
            <Skeleton className='h-10 w-24' />
          </div>
        </div>

        {/* Status Badges Skeleton */}
        <div className='flex gap-2'>
          <Skeleton className='h-6 w-20' />
          <Skeleton className='h-6 w-20' />
        </div>

        {/* Main Content Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Left Column - Details */}
          <div className='lg:col-span-2 space-y-6'>
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <Skeleton className='h-6 w-48' />
              </CardHeader>
              <CardContent className='space-y-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className='grid grid-cols-2 gap-4'>
                    <div className='space-y-1'>
                      <Skeleton className='h-4 w-24' />
                      <Skeleton className='h-5 w-32' />
                    </div>
                    <div className='space-y-1'>
                      <Skeleton className='h-4 w-24' />
                      <Skeleton className='h-5 w-32' />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Description Card */}
            <Card>
              <CardHeader>
                <Skeleton className='h-6 w-32' />
              </CardHeader>
              <CardContent className='space-y-2'>
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-5/6' />
                <Skeleton className='h-4 w-4/6' />
              </CardContent>
            </Card>

            {/* Machines Card */}
            <Card>
              <CardHeader>
                <Skeleton className='h-6 w-32' />
              </CardHeader>
              <CardContent className='space-y-3'>
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className='p-3 border rounded-lg'>
                    <Skeleton className='h-5 w-full' />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Activity */}
          <div className='space-y-6'>
            <Card>
              <CardHeader>
                <Skeleton className='h-6 w-32' />
              </CardHeader>
              <CardContent className='space-y-4'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className='flex items-start gap-3'>
                    <Skeleton className='h-8 w-8 rounded-full' />
                    <div className='flex-1 space-y-2'>
                      <Skeleton className='h-4 w-full' />
                      <Skeleton className='h-3 w-24' />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
