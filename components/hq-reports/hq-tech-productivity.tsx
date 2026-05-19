'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { HQReportFilters, useHQFilters } from './hq-report-filters';
import type { HQTechRow, HQStoreFilter } from '@/lib/actions/hq-reports';

interface Props {
  data: HQTechRow[];
  stores: HQStoreFilter[];
}

const exportColumns = [
  { key: 'techName', header: 'Technician' },
  { key: 'storeName', header: 'Store' },
  { key: 'island', header: 'Island' },
  { key: 'totalHours', header: 'Total Hours' },
  { key: 'totalVisits', header: 'Total Visits' },
  { key: 'avgHoursPerVisit', header: 'Avg Hours / Visit' },
  { key: 'ticketsClosed', header: 'Tickets Closed' },
  { key: 'internalPayRate', header: 'Internal Rate ($/hr)' },
  { key: 'chargeoutRate', header: 'Chargeout Rate ($/hr)' },
  { key: 'internalCost', header: 'Internal Cost ($)' },
  { key: 'chargeoutValue', header: 'Chargeout Value ($)' },
];

export function HQTechProductivity({ data, stores }: Props) {
  const { selectedStoreIds, dateRange, setDateRange, toggleStore, toggleAll } = useHQFilters(stores);

  // Tech productivity isn't date-filtered at query time; filter by store only.
  // (Work logs don't carry a per-row date in this dataset; filtering by store is the primary dimension.)
  const filtered = useMemo(() => data.filter((row) => selectedStoreIds.has(row.storeId)), [data, selectedStoreIds]);

  const exportData = useMemo(
    () =>
      filtered.map((r) => ({
        ...r,
        internalCost: r.internalPayRate !== null ? Math.round(r.totalHours * r.internalPayRate * 100) / 100 : '',
        chargeoutValue: r.chargeoutRate !== null ? Math.round(r.totalHours * r.chargeoutRate * 100) / 100 : '',
        internalPayRate: r.internalPayRate ?? '',
        chargeoutRate: r.chargeoutRate ?? '',
      })),
    [filtered],
  );

  const totals = useMemo(
    () => ({
      totalHours: Math.round(filtered.reduce((s, r) => s + r.totalHours, 0) * 100) / 100,
      totalVisits: filtered.reduce((s, r) => s + r.totalVisits, 0),
      ticketsClosed: filtered.reduce((s, r) => s + r.ticketsClosed, 0),
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
              <Users className='h-6 w-6 text-primary' />
              Technician Productivity
            </h1>
            <p className='text-muted-foreground text-sm mt-0.5'>Hours worked, visits, and tickets closed per technician across all stores.</p>
          </div>
        </div>
        <ExportButton
          data={exportData}
          columns={exportColumns}
          filename='hq-technician-productivity'
          sheetName='Tech Productivity'
          title='Technician Productivity Report'
          subtitle='Caribbean Roasters — HQ Management Report'
        />
      </div>

      {/* Filters */}
      <HQReportFilters stores={stores} selectedStoreIds={selectedStoreIds} onStoreToggle={toggleStore} onSelectAllStores={toggleAll} dateRange={dateRange} onDateRangeChange={setDateRange} />

      {/* KPI cards */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total Hours Logged</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.totalHours.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.totalVisits.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Tickets Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold text-green-600'>{totals.ticketsClosed.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {filtered.length} technician{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technician</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className='text-right'>Hours</TableHead>
                <TableHead className='text-right'>Visits</TableHead>
                <TableHead className='text-right'>Avg Hrs / Visit</TableHead>
                <TableHead className='text-right'>Tickets Closed</TableHead>
                <TableHead className='text-right'>Internal Rate</TableHead>
                <TableHead className='text-right'>Chargeout Rate</TableHead>
                <TableHead className='text-right'>Internal Cost</TableHead>
                <TableHead className='text-right'>Chargeout Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className='text-center text-muted-foreground py-10'>
                    No technician data for the selected stores.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row, i) => {
                  const internalCost = row.internalPayRate !== null ? Math.round(row.totalHours * row.internalPayRate * 100) / 100 : null;
                  const chargeoutValue = row.chargeoutRate !== null ? Math.round(row.totalHours * row.chargeoutRate * 100) / 100 : null;
                  return (
                    <TableRow key={`${row.storeId}-${row.techUid}-${i}`}>
                      <TableCell className='font-medium'>{row.techName}</TableCell>
                      <TableCell className='text-sm'>
                        <div>{row.storeName}</div>
                        <div className='text-xs text-muted-foreground'>{row.island}</div>
                      </TableCell>
                      <TableCell className='text-right font-medium'>{row.totalHours}</TableCell>
                      <TableCell className='text-right'>{row.totalVisits}</TableCell>
                      <TableCell className='text-right text-muted-foreground'>{row.avgHoursPerVisit}</TableCell>
                      <TableCell className='text-right text-green-600 font-medium'>{row.ticketsClosed}</TableCell>
                      <TableCell className='text-right text-muted-foreground'>{row.internalPayRate !== null ? `$${row.internalPayRate}/hr` : '—'}</TableCell>
                      <TableCell className='text-right text-muted-foreground'>{row.chargeoutRate !== null ? `$${row.chargeoutRate}/hr` : '—'}</TableCell>
                      <TableCell className='text-right'>{internalCost !== null ? `$${internalCost.toLocaleString()}` : '—'}</TableCell>
                      <TableCell className='text-right font-medium text-primary'>{chargeoutValue !== null ? `$${chargeoutValue.toLocaleString()}` : '—'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
