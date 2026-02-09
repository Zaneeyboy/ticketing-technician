'use client';

import DashboardLayout from '@/components/dashboard-layout';
import { TimeByTechnicianReport } from '@/components/reports/time-by-technician-report';

export default function TimeByTechnicianPage() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Time by Technician</h2>
          <p className='text-slate-600 dark:text-slate-400'>Break down technician hours by customer with totals and averages.</p>
        </div>
        <TimeByTechnicianReport />
      </div>
    </DashboardLayout>
  );
}
