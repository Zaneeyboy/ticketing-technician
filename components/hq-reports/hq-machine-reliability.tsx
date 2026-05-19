'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { HQReportFilters, useHQFilters } from './hq-report-filters';
import type { HQMachineRow, HQStoreFilter } from '@/lib/actions/hq-reports';

interface Props {
  data: HQMachineRow[];
  stores: HQStoreFilter[];
}

const exportColumns = [
  { key: 'machineType', header: 'Machine Type' },
  { key: 'serialNumber', header: 'Serial No.' },
  { key: 'location', header: 'Location' },
  { key: 'customerName', header: 'Customer' },
  { key: 'storeName', header: 'Store' },
  { key: 'island', header: 'Island' },
  { key: 'totalTickets', header: 'Total Tickets' },
  { key: 'openTickets', header: 'Open Tickets' },
  { key: 'closedTickets', header: 'Closed Tickets' },
  { key: 'lastTicketDate', header: 'Last Ticket Date' },
];

export function HQMachineReliability({ data, stores }: Props) {
  const { selectedStoreIds, dateRange, setDateRange, toggleStore, toggleAll } = useHQFilters(stores);
  const [machineTypeFilter, setMachineTypeFilter] = useState('all');

  const machineTypes = useMemo(() => {
    const types = new Set(data.map((r) => r.machineType).filter(Boolean));
    return Array.from(types).sort();
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (!selectedStoreIds.has(row.storeId)) return false;
      if (machineTypeFilter !== 'all' && row.machineType !== machineTypeFilter) return false;
      return true;
    });
  }, [data, selectedStoreIds, machineTypeFilter]);

  const exportData = useMemo(
    () =>
      filtered.map((r) => ({
        ...r,
        lastTicketDate: r.lastTicketDate ? new Date(r.lastTicketDate).toLocaleDateString() : '',
      })),
    [filtered],
  );

  const totals = useMemo(
    () => ({
      totalMachines: filtered.length,
      withTickets: filtered.filter((r) => r.totalTickets > 0).length,
      highRepeat: filtered.filter((r) => r.totalTickets >= 3).length,
      avgTickets: filtered.length > 0 ? Math.round((filtered.reduce((s, r) => s + r.totalTickets, 0) / filtered.length) * 10) / 10 : 0,
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
              <Wrench className='h-6 w-6 text-primary' />
              Machine Reliability
            </h1>
            <p className='text-muted-foreground text-sm mt-0.5'>Machines ranked by ticket frequency — identify high-maintenance units platform-wide.</p>
          </div>
        </div>
        <ExportButton
          data={exportData}
          columns={exportColumns}
          filename='hq-machine-reliability'
          sheetName='Machine Reliability'
          title='Cross-Store Machine Reliability'
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
          <Select value={machineTypeFilter} onValueChange={setMachineTypeFilter}>
            <SelectTrigger className='h-9 w-52'>
              <SelectValue placeholder='All Machine Types' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Machine Types</SelectItem>
              {machineTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* KPI cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total Machines</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.totalMachines.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>With Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-amber-600'>{totals.withTickets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>High Repeat (3+)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-red-600'>{totals.highRepeat}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Avg Tickets / Machine</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.avgTickets}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {filtered.length} machine{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine Type</TableHead>
                <TableHead>Serial No.</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className='text-right'>Total Tickets</TableHead>
                <TableHead className='text-right'>Open</TableHead>
                <TableHead className='text-right'>Closed</TableHead>
                <TableHead>Last Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className='text-center text-muted-foreground py-10'>
                    No machines match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={`${row.storeId}-${row.machineId}`}>
                    <TableCell className='font-medium'>{row.machineType}</TableCell>
                    <TableCell className='font-mono text-xs text-muted-foreground'>{row.serialNumber}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{row.location}</TableCell>
                    <TableCell className='text-sm'>{row.customerName}</TableCell>
                    <TableCell className='text-sm'>
                      <div>{row.storeName}</div>
                      <div className='text-xs text-muted-foreground'>{row.island}</div>
                    </TableCell>
                    <TableCell className='text-right'>
                      <span className={row.totalTickets >= 3 ? 'font-bold text-red-600' : row.totalTickets > 0 ? 'font-medium text-amber-600' : 'text-muted-foreground'}>{row.totalTickets}</span>
                    </TableCell>
                    <TableCell className='text-right text-amber-600'>{row.openTickets}</TableCell>
                    <TableCell className='text-right text-green-600'>{row.closedTickets}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{row.lastTicketDate ? new Date(row.lastTicketDate).toLocaleDateString() : '—'}</TableCell>
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
