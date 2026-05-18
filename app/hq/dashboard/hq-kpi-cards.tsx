'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountUp } from '@/components/ui/count-up';
import { Building2, Ticket, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface HQKpiCardsProps {
  storeCount: number;
  totalOpen: number;
  totalAssigned: number;
  totalClosed: number;
  totalOverdue: number;
}

const KPI_CARDS = [
  { key: 'storeCount', title: 'Active Stores', icon: Building2, color: 'text-blue-500' },
  { key: 'totalOpen', title: 'Open Tickets', icon: Ticket, color: 'text-orange-500' },
  { key: 'totalAssigned', title: 'Assigned Tickets', icon: Clock, color: 'text-yellow-500' },
  { key: 'totalClosed', title: 'Closed Tickets', icon: CheckCircle, color: 'text-green-500' },
  { key: 'totalOverdue', title: 'Overdue (7d+)', icon: AlertTriangle, color: 'text-destructive' },
] as const;

export function HQKpiCards({ storeCount, totalOpen, totalAssigned, totalClosed, totalOverdue }: HQKpiCardsProps) {
  const values: Record<string, number> = { storeCount, totalOpen, totalAssigned, totalClosed, totalOverdue };

  return (
    <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8'>
      {KPI_CARDS.map(({ key, title, icon: Icon, color }) => (
        <Card key={key}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>{title}</CardTitle>
            <Icon className={`h-4 w-4 ${key === 'totalOverdue' && values[key] > 0 ? 'text-destructive' : color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${key === 'totalOverdue' && values[key] > 0 ? 'text-destructive' : ''}`}>
              <CountUp value={values[key]} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
