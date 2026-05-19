'use client';

import DashboardLayout from '@/components/dashboard-layout';
import { MonthlyReport } from '@/components/reports/monthly-report';

export default function MonthlyReportPage() {
  return (
    <DashboardLayout>
      <MonthlyReport />
    </DashboardLayout>
  );
}
