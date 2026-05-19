import { AlertTriangle } from 'lucide-react';
import { getHQStoreComparison } from '@/lib/actions/hq-reports';
import { HQStoreComparison } from '@/components/hq-reports/hq-store-comparison';

export default async function HQStoreComparisonPage() {
  const result = await getHQStoreComparison();

  if (!result.success || !result.data) {
    return (
      <div className='flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground'>
        <AlertTriangle className='h-8 w-8 text-amber-500' />
        <p className='font-medium'>Unable to load report</p>
        <p className='text-sm'>{result.error}</p>
      </div>
    );
  }

  return <HQStoreComparison data={result.data} stores={result.stores ?? []} />;
}
