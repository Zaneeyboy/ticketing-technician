'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { HQReportFilters, useHQFilters } from './hq-report-filters';
import type { HQResolutionRow, HQStoreFilter } from '@/lib/actions/hq-reports';

interface Props {
  data: HQResolutionRow[];
  stores: HQStoreFilter[];
}

const exportColumns = [
  { key: 'ticketNumber', header: 'Ticket #' },
  { key: 'storeName', header: 'Store' },
  { key: 'island', header: 'Island' },
  { key: 'customerName', header: 'Customer' },
  { key: 'machineType', header: 'Machine Type' },
  { key: 'assignedToName', header: 'Technician' },
  { key: 'priority', header: 'Priority' },
  { key: 'createdAt', header: 'Opened' },
  { key: 'closedAt', header: 'Closed' },
  { key: 'daysToClose', header: 'Days to Close' },
];

const PRIORITY_COLORS: Record<string, string> = {
  High: 'text-red-600 font-medium',
  Medium: 'text-amber-600',
  Low: 'text-slate-500',
};

export function HQResolutionTimes({ data, stores }: Props) {
  const { selectedStoreIds, dateRange, setDateRange, toggleStore, toggleAll, inDateRange } = useHQFilters(stores);

  const filtered = useMemo(() => data.filter((row) => selectedStoreIds.has(row.storeId) && inDateRange(row.closedAt)), [data, selectedStoreIds, dateRange]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return { avg: null, min: null, max: null, within1Day: 0, within7Days: 0 };
    const days = filtered.map((r) => r.daysToClose).sort((a, b) => a - b);
    const avg = Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10;
    return {
      avg,
      min: days[0],
      max: days[days.length - 1],
      within1Day: days.filter((d) => d <= 1).length,
      within7Days: days.filter((d) => d <= 7).length,
    };
  }, [filtered]);

  const exportData = useMemo(
    () =>
      filtered.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt).toLocaleDateString(),
        closedAt: new Date(r.closedAt).toLocaleDateString(),
        assignedToName: r.assignedToName ?? 'Unassigned',
      })),
    [filtered],
  );

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='sm' asChild>
            <Link href='/hq/reports'>
              <ArrowLeft className='h-4 w-4 mr-1' />
              Reports
            </Link>
          </Button>
          <div>
            <h1 className='text-2xl font-bold flex items-center gap-2'>
              <Timer className='h-6 w-6 text-primary' />
              Resolution Time Analysis
            </h1>
            <p className='text-muted-foreground text-sm mt-0.5'>SLA analysis — time from ticket creation to closure across all stores.</p>
          </div>
        </div>
        <ExportButton
          data={exportData}
          columns={exportColumns}
          filename='hq-resolution-times'
          sheetName='Resolution Times'
          title='Cross-Store Resolution Time Analysis'
          subtitle='Caribbean Roasters — HQ Management Report'
        />
      </div>

      {/* Filters */}
      <HQReportFilters stores={stores} selectedStoreIds={selectedStoreIds} onStoreToggle={toggleStore} onSelectAllStores={toggleAll} dateRange={dateRange} onDateRangeChange={setDateRange} />

      {/* KPI cards */}
      <div className='grid gap-4 md:grid-cols-5'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Tickets Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{filtered.length.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Avg Days to Close</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-primary'>{stats.avg !== null ? `${stats.avg}d` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Fastest (days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-green-600'>{stats.min !== null ? `${stats.min}d` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Slowest (days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-red-600'>{stats.max !== null ? `${stats.max}d` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Closed ≤ 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-green-600'>{stats.within7Days}</p>
            <p className='text-xs text-muted-foreground mt-1'>{filtered.length > 0 ? `${Math.round((stats.within7Days / filtered.length) * 100)}% of total` : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {filtered.length.toLocaleString()} closed ticket{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead className='text-right'>Days to Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className='text-center text-muted-foreground py-10'>
                    No closed tickets match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.ticketId}>
                    <TableCell className='font-mono text-xs'>{row.ticketNumber}</TableCell>
                    <TableCell className='text-sm'>
                      <div>{row.storeName}</div>
                      <div className='text-xs text-muted-foreground'>{row.island}</div>
                    </TableCell>
                    <TableCell className='text-sm'>{row.customerName}</TableCell>
                    <TableCell className='text-sm'>{row.machineType}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{row.assignedToName ?? 'Unassigned'}</TableCell>
                    <TableCell>
                      <span className={`text-sm ${PRIORITY_COLORS[row.priority] ?? ''}`}>{row.priority}</span>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{new Date(row.closedAt).toLocaleDateString()}</TableCell>
                    <TableCell className='text-right'>
                      <span className={row.daysToClose <= 1 ? 'text-green-600 font-bold' : row.daysToClose <= 7 ? 'text-amber-600 font-medium' : 'text-red-600 font-medium'}>{row.daysToClose}d</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
