'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { HQReportFilters, useHQFilters } from './hq-report-filters';
import type { HQStoreComparisonRow, HQStoreFilter } from '@/lib/actions/hq-reports';

interface Props {
  data: HQStoreComparisonRow[];
  stores: HQStoreFilter[];
}

const exportColumns = [
  { key: 'storeName', header: 'Store' },
  { key: 'island', header: 'Island' },
  { key: 'status', header: 'Status' },
  { key: 'totalTickets', header: 'Total Tickets' },
  { key: 'openTickets', header: 'Open' },
  { key: 'assignedTickets', header: 'Assigned / In Progress' },
  { key: 'closedTickets', header: 'Closed' },
  { key: 'resolutionRate', header: 'Resolution Rate (%)' },
  { key: 'avgDaysToClose', header: 'Avg Days to Close' },
  { key: 'techCount', header: 'Technicians' },
  { key: 'customerCount', header: 'Customers' },
  { key: 'machineCount', header: 'Machines' },
];

export function HQStoreComparison({ data, stores }: Props) {
  const { selectedStoreIds, dateRange, setDateRange, toggleStore, toggleAll } = useHQFilters(stores);

  // Store comparison is not date-range filtered (it reflects all-time data per store).
  // We only filter by store inclusion/exclusion.
  const filtered = useMemo(() => data.filter((row) => selectedStoreIds.has(row.storeId)), [data, selectedStoreIds]);

  // KPI totals
  const totals = useMemo(
    () => ({
      totalTickets: filtered.reduce((s, r) => s + r.totalTickets, 0),
      openTickets: filtered.reduce((s, r) => s + r.openTickets, 0),
      closedTickets: filtered.reduce((s, r) => s + r.closedTickets, 0),
      avgResolution: filtered.length > 0 ? Math.round(filtered.reduce((s, r) => s + r.resolutionRate, 0) / filtered.length) : 0,
    }),
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
              <BarChart3 className='h-6 w-6 text-primary' />
              Store Comparison
            </h1>
            <p className='text-muted-foreground text-sm mt-0.5'>Side-by-side KPI overview across all Caribbean Roasters branches.</p>
          </div>
        </div>
        <ExportButton
          data={filtered}
          columns={exportColumns}
          filename='hq-store-comparison'
          sheetName='Store Comparison'
          title='Store Performance Comparison'
          subtitle='Caribbean Roasters — HQ Management Report'
        />
      </div>

      {/* Filters */}
      <HQReportFilters stores={stores} selectedStoreIds={selectedStoreIds} onStoreToggle={toggleStore} onSelectAllStores={toggleAll} dateRange={dateRange} onDateRangeChange={setDateRange} />

      {/* KPI cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.totalTickets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-amber-600'>{totals.openTickets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Closed Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-green-600'>{totals.closedTickets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Avg Resolution Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-primary'>{totals.avgResolution}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {filtered.length} store{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Island</TableHead>
                <TableHead className='text-center'>Status</TableHead>
                <TableHead className='text-right'>Total</TableHead>
                <TableHead className='text-right'>Open</TableHead>
                <TableHead className='text-right'>Assigned</TableHead>
                <TableHead className='text-right'>Closed</TableHead>
                <TableHead className='text-right'>Resolution</TableHead>
                <TableHead className='text-right'>Avg Days</TableHead>
                <TableHead className='text-right'>Techs</TableHead>
                <TableHead className='text-right'>Customers</TableHead>
                <TableHead className='text-right'>Machines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className='text-center text-muted-foreground py-10'>
                    No stores selected.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.storeId}>
                    <TableCell className='font-medium'>{row.storeName}</TableCell>
                    <TableCell className='text-muted-foreground'>{row.island}</TableCell>
                    <TableCell className='text-center'>
                      <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className='text-right font-medium'>{row.totalTickets}</TableCell>
                    <TableCell className='text-right text-amber-600'>{row.openTickets}</TableCell>
                    <TableCell className='text-right text-blue-600'>{row.assignedTickets}</TableCell>
                    <TableCell className='text-right text-green-600'>{row.closedTickets}</TableCell>
                    <TableCell className='text-right'>
                      <span className={row.resolutionRate >= 80 ? 'text-green-600 font-medium' : row.resolutionRate >= 50 ? 'text-amber-600 font-medium' : 'text-red-600 font-medium'}>
                        {row.resolutionRate}%
                      </span>
                    </TableCell>
                    <TableCell className='text-right'>{row.avgDaysToClose !== null ? `${row.avgDaysToClose}d` : '—'}</TableCell>
                    <TableCell className='text-right'>{row.techCount}</TableCell>
                    <TableCell className='text-right'>{row.customerCount}</TableCell>
                    <TableCell className='text-right'>{row.machineCount}</TableCell>
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
