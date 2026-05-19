'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { HQReportFilters, useHQFilters } from './hq-report-filters';
import type { HQPartsRow, HQStoreFilter } from '@/lib/actions/hq-reports';

interface Props {
  data: HQPartsRow[];
  stores: HQStoreFilter[];
}

const exportColumns = [
  { key: 'partName', header: 'Part Name' },
  { key: 'category', header: 'Category' },
  { key: 'storeName', header: 'Store' },
  { key: 'island', header: 'Island' },
  { key: 'totalQuantityUsed', header: 'Qty Used' },
  { key: 'timesUsed', header: 'Times Used (Work Logs)' },
];

export function HQPartsConsumption({ data, stores }: Props) {
  const { selectedStoreIds, dateRange, setDateRange, toggleStore, toggleAll } = useHQFilters(stores);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = useMemo(() => {
    const cats = new Set(data.map((r) => r.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      if (!selectedStoreIds.has(row.storeId)) return false;
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
      return true;
    });
  }, [data, selectedStoreIds, categoryFilter]);

  const totals = useMemo(
    () => ({
      totalQty: filtered.reduce((s, r) => s + r.totalQuantityUsed, 0),
      totalTimesUsed: filtered.reduce((s, r) => s + r.timesUsed, 0),
      uniqueParts: new Set(filtered.map((r) => r.partName.toLowerCase())).size,
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
              <Package className='h-6 w-6 text-primary' />
              Parts Consumption
            </h1>
            <p className='text-muted-foreground text-sm mt-0.5'>Parts used in service visits across all stores — ranked by consumption volume.</p>
          </div>
        </div>
        <ExportButton
          data={filtered}
          columns={exportColumns}
          filename='hq-parts-consumption'
          sheetName='Parts Consumption'
          title='Cross-Store Parts Consumption'
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className='h-9 w-48'>
              <SelectValue placeholder='All Categories' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* KPI cards */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total Units Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.totalQty.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Unique Parts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.uniqueParts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Work Log Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold'>{totals.totalTimesUsed.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {filtered.length} part{filtered.length !== 1 ? 's' : ''} across selected stores
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className='text-right'>Qty Used</TableHead>
                <TableHead className='text-right'>Times Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-center text-muted-foreground py-10'>
                    No parts consumption data for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row, i) => (
                  <TableRow key={`${row.storeId}-${row.partName}-${i}`}>
                    <TableCell className='font-medium'>{row.partName}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{row.category}</TableCell>
                    <TableCell className='text-sm'>
                      <div>{row.storeName}</div>
                      <div className='text-xs text-muted-foreground'>{row.island}</div>
                    </TableCell>
                    <TableCell className='text-right font-medium'>{row.totalQuantityUsed}</TableCell>
                    <TableCell className='text-right text-muted-foreground'>{row.timesUsed}</TableCell>
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
