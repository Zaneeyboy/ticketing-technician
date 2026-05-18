import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function PartsUsageLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex items-center gap-3'>
          <Skeleton className='h-9 w-24 rounded-md' />
          <div className='space-y-1'>
            <Skeleton className='h-8 w-44' />
            <Skeleton className='h-4 w-72' />
          </div>
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

        {/* Search */}
        <Skeleton className='h-9 w-64 rounded-md' />

        {/* Tabs */}
        <Skeleton className='h-10 w-52 rounded-md' />

        {/* Stat cards */}
        <div className='grid grid-cols-3 gap-4'>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className='pt-6 space-y-2'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-8 w-16' />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <Skeleton className='h-5 w-40' />
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <Skeleton className='h-9 w-full rounded' />
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className='h-12 w-full rounded' />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
