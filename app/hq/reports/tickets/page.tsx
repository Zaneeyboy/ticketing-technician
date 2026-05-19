import { AlertTriangle } from 'lucide-react';
import { getHQTicketReport } from '@/lib/actions/hq-reports';
import { HQTicketAnalysis } from '@/components/hq-reports/hq-ticket-analysis';

export default async function HQTicketsPage() {
  const result = await getHQTicketReport();

  if (!result.success || !result.data) {
    return (
      <div className='flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground'>
        <AlertTriangle className='h-8 w-8 text-amber-500' />
        <p className='font-medium'>Unable to load report</p>
        <p className='text-sm'>{result.error}</p>
      </div>
    );
  }

  return <HQTicketAnalysis data={result.data} stores={result.stores ?? []} />;
}
