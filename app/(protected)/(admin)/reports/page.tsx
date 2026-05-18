'use client';

import Link from 'next/link';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, ClipboardList, Wrench } from 'lucide-react';

const reportLinks = [
  {
    title: 'Time by Customer',
    description: 'Total hours per customer with technician breakdowns and work summaries.',
    href: '/reports/time-by-customer',
    icon: ClipboardList,
  },
  {
    title: 'Time by Technician',
    description: 'Technician hours by customer with totals and averages.',
    href: '/reports/time-by-technician',
    icon: BarChart3,
  },
  {
    title: 'Machine Health',
    description: 'Problem machines, repeat issues, and parts usage by customer.',
    href: '/reports/machine-health',
    icon: Wrench,
  },
];

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Management Reports</h2>
          <p className='text-slate-600 dark:text-slate-400'>Choose a report to view detailed performance and service insights.</p>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {reportLinks.map((report) => {
            const Icon = report.icon;
            return (
              <Card key={report.href} className='h-full'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-lg'>
                    <Icon className='h-5 w-5 text-primary' />
                    {report.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className='flex h-full flex-col gap-4'>
                  <p className='text-sm text-muted-foreground'>{report.description}</p>
                  <div className='mt-auto'>
                    <Button asChild className='w-full'>
                      <Link href={report.href}>Open report</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
