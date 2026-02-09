'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { ReportBaseData } from '@/lib/types/reporting';

const ReportDataContext = createContext<ReportBaseData | null>(null);

export function ReportDataProvider({ data, children }: { data: ReportBaseData; children: ReactNode }) {
  return <ReportDataContext.Provider value={data}>{children}</ReportDataContext.Provider>;
}

export function useReportData() {
  const context = useContext(ReportDataContext);
  if (!context) {
    throw new Error('useReportData must be used within ReportDataProvider');
  }
  return context;
}
