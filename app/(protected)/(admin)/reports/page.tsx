import DashboardLayout from '@/components/dashboard-layout';
import { StoreReportsClient } from '@/components/store-reports/store-reports-client';
import { getStoreModularReportData } from '@/lib/actions/store-report-data';
import { AlertTriangle } from 'lucide-react';

export default async function ReportsPage() {
  const result = await getStoreModularReportData();

  if (!result.success || !result.data) {
    return (
      <DashboardLayout>
        <div className='flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground'>
          <AlertTriangle className='h-8 w-8 text-amber-500' />
          <p className='font-medium'>Unable to load reports</p>
          <p className='text-sm'>{result.error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Reports</h2>
          <p className='text-muted-foreground text-sm mt-1'>Select a report below to view detailed insights for {result.data.storeName}.</p>
        </div>

        <StoreReportsClient data={result.data} />
      </div>
    </DashboardLayout>
  );
}
