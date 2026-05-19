import { AlertTriangle } from 'lucide-react';
import { getHQResolutionTimes } from '@/lib/actions/hq-reports';
import { HQResolutionTimes } from '@/components/hq-reports/hq-resolution-times';

export default async function HQResolutionTimesPage() {
  const result = await getHQResolutionTimes();

  if (!result.success || !result.data) {
    return (
      <div className='flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground'>
        <AlertTriangle className='h-8 w-8 text-amber-500' />
        <p className='font-medium'>Unable to load report</p>
        <p className='text-sm'>{result.error}</p>
      </div>
    );
  }

  return <HQResolutionTimes data={result.data} stores={result.stores ?? []} />;
}
