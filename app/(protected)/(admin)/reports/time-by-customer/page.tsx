'use client';

import DashboardLayout from '@/components/dashboard-layout';
import { TimeByCustomerReport } from '@/components/reports/time-by-customer-report';

export default function TimeByCustomerPage() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Time by Customer</h2>
          <p className='text-slate-600 dark:text-slate-400'>Analyze total technician hours per customer and drill into work summaries.</p>
        </div>
        <TimeByCustomerReport />
      </div>
    </DashboardLayout>
  );
}
