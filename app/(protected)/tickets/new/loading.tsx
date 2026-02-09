import DashboardLayout from '@/components/dashboard-layout';
import { FormSkeleton } from '@/components/skeletons/form-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewTicketLoading() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Header Skeleton */}
        <div className='space-y-2'>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='h-4 w-72' />
        </div>

        {/* Form Skeleton */}
        <FormSkeleton fields={8} sections={3} />
      </div>
    </DashboardLayout>
  );
}
