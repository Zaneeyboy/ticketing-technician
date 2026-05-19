'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { HQReportFilters, useHQFilters } from './hq-report-filters';
import type { HQTicketRow, HQStoreFilter } from '@/lib/actions/hq-reports';

interface Props {
  data: HQTicketRow[];
  stores: HQStoreFilter[];
}

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'In Progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Pending Parts': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'Signed Off': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  Closed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: 'text-red-600 font-medium',
  Medium: 'text-amber-600',
  Low: 'text-slate-500',
};

const exportColumns = [
  { key: 'ticketNumber', header: 'Ticket #' },
  { key: 'storeName', header: 'Store' },
  { key: 'island', header: 'Island' },
  { key: 'customerName', header: 'Customer' },
  { key: 'machineType', header: 'Machine Type' },
  { key: 'serialNumber', header: 'Serial No.' },
  { key: 'status', header: 'Status' },
  { key: 'priority', header: 'Priority' },
  { key: 'assignedToName', header: 'Assigned To' },
  { key: 'createdAt', header: 'Created' },
  { key: 'closedAt', header: 'Closed' },
  { key: 'daysToClose', header: 'Days to Close' },
];

export function HQTicketAnalysis({ data, stores }: Props) {
  const { selectedStoreIds, dateRange, setDateRange, toggleStore, toggleAll, inDateRange } = useHQFilters(stores);
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (!selectedStoreIds.has(row.storeId)) return false;
      if (!inDateRange(row.createdAt)) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      return true;
    });
  }, [data, selectedStoreIds, dateRange, statusFilter]);

  const totals = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const r of filtered) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    const closed = filtered.filter((r) => r.daysToClose !== null);
    const avgDays = closed.length > 0 ? Math.round((closed.reduce((s, r) => s + r.daysToClose!, 0) / closed.length) * 10) / 10 : null;
    return { total: filtered.length, byStatus, avgDays };
  }, [filtered]);

  const exportData = useMemo(
    () =>
      filtered.map((r) => ({
        ...r,
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
        closedAt: r.closedAt ? new Date(r.closedAt).toLocaleDateString() : '',
        assignedToName: r.assignedToName ?? 'Unassigned',
        daysToClose: r.daysToClose ?? '',
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
              <ClipboardList className='h-6 w-6 text-primary' />
              Ticket Analysis
            </h1>
            <p className='text-muted-foreground text-sm mt-0.5'>Cross-store ticket breakdown by status, priority, and resolution time.</p>
          </div>
        </div>
        <ExportButton
          data={exportData}
          columns={exportColumns}
          filename='hq-ticket-analysis'
          sheetName='Ticket Analysis'
          title='Cross-Store Ticket Analysis'
          subtitle='Caribbean Roasters — HQ Management Report'
        />
      </div>

      {/* Filters */}
      <HQReportFilters
        stores={stores}
        selectedStoreIds={selectedStoreIds}
        onStoreToggle={toggleStore}
        onSelectAllStores={toggleAll}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        extraFilters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='h-9 w-44'>
              <SelectValue placeholder='All Statuses' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Statuses</SelectItem>
              <SelectItem value='Open'>Open</SelectItem>
              <SelectItem value='Assigned'>Assigned</SelectItem>
              <SelectItem value='In Progress'>In Progress</SelectItem>
              <SelectItem value='Pending Parts'>Pending Parts</SelectItem>
              <SelectItem value='Closed'>Closed</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* KPI cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Open</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-amber-600'>{(totals.byStatus['Open'] ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-green-600'>{(totals.byStatus['Closed'] ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Avg Days to Close</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-primary'>{totals.avgDays !== null ? `${totals.avgDays}d` : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {filtered.length.toLocaleString()} ticket{filtered.length !== 1 ? 's' : ''}
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
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className='text-right'>Days to Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className='text-center text-muted-foreground py-10'>
                    No tickets match the current filters.
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
                    <TableCell className='text-sm'>
                      <div>{row.machineType}</div>
                      <div className='text-xs text-muted-foreground font-mono'>{row.serialNumber}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? ''}`}>{row.status}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${PRIORITY_COLORS[row.priority] ?? ''}`}>{row.priority}</span>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{row.assignedToName ?? 'Unassigned'}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className='text-right text-sm'>{row.daysToClose !== null ? `${row.daysToClose}d` : '—'}</TableCell>
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
