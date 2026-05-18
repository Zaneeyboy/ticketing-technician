import DashboardLayout from '@/components/dashboard-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';

export default function MachinesLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-5'>
        {/* Stats bar skeleton — 4 columns for machines */}
        <div className='grid grid-cols-4 gap-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className='pt-5 flex items-center gap-3'>
                <Skeleton className='h-9 w-9 rounded-lg' />
                <div className='space-y-1.5'>
                  <Skeleton className='h-7 w-10' />
                  <Skeleton className='h-3 w-20' />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action bar skeleton */}
        <div className='flex justify-between items-center gap-3'>
          <Skeleton className='h-9 w-64' />
          <div className='flex gap-2'>
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-28' />
            <Skeleton className='h-9 w-28' />
          </div>
        </div>

        {/* Table skeleton */}
        <TableSkeleton rows={8} columns={5} />
      </div>
    </DashboardLayout>
  );
}
