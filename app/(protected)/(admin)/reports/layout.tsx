import { ReactNode } from 'react';
import { getReportBaseData } from '@/lib/actions/report-data';
import { ReportDataProvider } from '@/components/reports/report-data-provider';

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  const data = await getReportBaseData();

  return <ReportDataProvider data={data}>{children}</ReportDataProvider>;
}
