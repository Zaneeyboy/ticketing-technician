'use client';

import DashboardLayout from '@/components/dashboard-layout';
import { PartsUsageReport } from '@/components/reports/parts-usage-report';

export default function PartsUsagePage() {
  return (
    <DashboardLayout>
      <PartsUsageReport />
    </DashboardLayout>
  );
}
