'use client';

import DashboardLayout from '@/components/dashboard-layout';
import { DailyServiceReport } from '@/components/reports/daily-service-report';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';

export default function DailyServiceReportPage() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
          <div>
            <div className='flex items-center gap-2 mb-1'>
              <Button variant='ghost' size='sm' asChild className='gap-1.5 -ml-2 text-muted-foreground'>
                <Link href='/reports'>
                  <ArrowLeft className='h-4 w-4' />
                  Reports
                </Link>
              </Button>
            </div>
            <h2 className='text-2xl font-bold flex items-center gap-2'>
              <Users className='h-6 w-6 text-primary' />
              Tech Team Service Report
            </h2>
            <p className='text-slate-600 dark:text-slate-400 mt-1'>Period breakdown by technician — scheduled visits, emergency calls, work performed, and parts used. Select any date range.</p>
          </div>
        </div>

        <DailyServiceReport />
      </div>
    </DashboardLayout>
  );
}
