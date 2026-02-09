'use client';

import DashboardLayout from '@/components/dashboard-layout';
import { MachineHealthReport } from '@/components/reports/machine-health-report';

export default function MachineHealthPage() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Machine Health</h2>
          <p className='text-slate-600 dark:text-slate-400'>Identify repeat issues, heavy ticket volume, and service history by machine.</p>
        </div>
        <MachineHealthReport />
      </div>
    </DashboardLayout>
  );
}
