import Link from 'next/link';
import { BarChart3, ClipboardList, Package, Timer, Users, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const reportLinks = [
  {
    title: 'Store Comparison',
    description: 'Side-by-side KPI overview across all branches — tickets, resolution rates, technician counts, and more.',
    href: '/hq/reports/store-comparison',
    icon: BarChart3,
  },
  {
    title: 'Ticket Analysis',
    description: 'Cross-store ticket breakdown by status, priority, and assigned technician with full date-range filtering.',
    href: '/hq/reports/tickets',
    icon: ClipboardList,
  },
  {
    title: 'Technician Productivity',
    description: 'Hours worked, visits logged, tickets closed, and chargeout value per technician across all stores.',
    href: '/hq/reports/technician-performance',
    icon: Users,
  },
  {
    title: 'Parts Consumption',
    description: 'Parts consumed in service visits — ranked by volume, filterable by store and category.',
    href: '/hq/reports/parts-consumption',
    icon: Package,
  },
  {
    title: 'Machine Reliability',
    description: 'Machines ranked by ticket frequency — identify high-maintenance units and repeat failures platform-wide.',
    href: '/hq/reports/machine-reliability',
    icon: Wrench,
  },
  {
    title: 'Resolution Time Analysis',
    description: 'SLA analysis — average, fastest, and slowest ticket resolution times by store and technician.',
    href: '/hq/reports/resolution-times',
    icon: Timer,
  },
];

export default function HQReportsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Management Reports</h1>
        <p className='text-muted-foreground text-sm mt-1'>Platform-wide analytics across all Caribbean Roasters branches. Each report supports store filtering, date ranges, and Excel / PDF export.</p>
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
  );
}
