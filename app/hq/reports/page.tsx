import { getHQModularReports } from '@/lib/actions/stores';
import { HQReportsClient } from '@/components/hq-reports/hq-reports-client';
import { AlertTriangle } from 'lucide-react';

export default async function HQReportsPage() {
  const result = await getHQModularReports();

  if (!result.success || !result.stores) {
    return (
      <div className='flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground'>
        <AlertTriangle className='h-8 w-8 text-amber-500' />
        <p className='font-medium'>Unable to load reports</p>
        <p className='text-sm'>{result.error}</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div>
        <h1 className='text-2xl font-bold'>Management Reports</h1>
        <p className='text-muted-foreground text-sm mt-1'>
          Platform-wide analytics across all Caribbean Roasters branches.
        </p>
      </div>

      <HQReportsClient stores={result.stores} />
    </div>
  );
}
