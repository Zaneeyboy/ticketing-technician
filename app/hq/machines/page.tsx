'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wrench } from 'lucide-react';
import { getHQMachines, type HQMachineRow } from '@/lib/actions/machines';
import { ExportButton } from '@/components/export-button';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { CountUp } from '@/components/ui/count-up';
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, ColumnDef, SortingState, flexRender } from '@tanstack/react-table';

const TYPE_COLORS: Record<string, string> = {
  'iPilot Machine':            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'EGRO Machine':              'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'Crescendo Machine':         'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  'Rancilio Espresso Machine': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'Silvia Espresso Machine':   'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'BUNN Grinder':              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'BUNN Kyro Grinder':         'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  'Samremo Grinder':           'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  'Brewer Machine':            'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
  'Smartwave Brewer Machine':  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  'BUNN Server':               'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Nitron RMV':                'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  'Water Machine':             'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  'Barista Tools':             'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

export default function HQMachinesPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<HQMachineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedFilter = useDebounce(globalFilter, 300);
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'storeName', desc: false }]);

  useEffect(() => {
    if (!authLoading) {
      getHQMachines().then((res) => {
        if (res.success) setRows(res.rows);
        setLoading(false);
      });
    }
  }, [authLoading]);

  const storeOptions = useMemo(() => [...new Set(rows.map((r) => r.storeName))].sort(), [rows]);
  const typeOptions = useMemo(() => [...new Set(rows.map((r) => r.type))].sort(), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (storeFilter !== 'all' && r.storeName !== storeFilter) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (debouncedFilter) {
        const q = debouncedFilter.toLowerCase();
        return (
          r.type.toLowerCase().includes(q) ||
          r.serialNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          r.storeName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, storeFilter, typeFilter, debouncedFilter]);

  const totalMachines = filteredRows.length;
  const uniqueTypes = new Set(filteredRows.map((r) => r.type)).size;
  const withParts = filteredRows.filter((r) => r.associatedPartsCount > 0).length;

  const columns: ColumnDef<HQMachineRow>[] = [
    {
      accessorKey: 'storeName',
      header: 'Store',
      cell: ({ row }) => <span className='font-medium'>{row.getValue('storeName')}</span>,
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => <span>{row.getValue('customerName')}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.getValue('type') as string;
        return <Badge className={TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-800'}>{type}</Badge>;
      },
    },
    {
      accessorKey: 'serialNumber',
      header: 'Serial Number',
      cell: ({ row }) => <code className='text-sm'>{row.getValue('serialNumber')}</code>,
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const loc = row.getValue('location') as string;
        return loc ? <span>{loc}</span> : <span className='text-muted-foreground'>—</span>;
      },
    },
    {
      accessorKey: 'associatedPartsCount',
      header: 'Parts',
      cell: ({ row }) => {
        const count = row.getValue('associatedPartsCount') as number;
        return count > 0 ? (
          <Badge variant='secondary'>{count}</Badge>
        ) : (
          <span className='text-muted-foreground'>—</span>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: { pagination: { pageSize: 30 } },
  });

  if (!user) return null;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between gap-4 flex-wrap'>
        <div>
          <h1 className='text-2xl font-bold'>Machines — All Stores</h1>
          <p className='text-sm text-muted-foreground mt-0.5'>Cross-store equipment overview (read-only)</p>
        </div>
        <ExportButton
          data={filteredRows as unknown as Record<string, any>[]}
          columns={[
            { header: 'Store', key: 'storeName' },
            { header: 'Customer', key: 'customerName' },
            { header: 'Type', key: 'type' },
            { header: 'Serial Number', key: 'serialNumber' },
            { header: 'Location', key: 'location', formatter: (v) => v ?? '' },
            { header: 'Parts Linked', key: 'associatedPartsCount', formatter: (v) => String(v ?? 0) },
          ]}
          filename='hq-machines-export'
          sheetName='Machines'
          title='HQ Machines Overview'
        />
      </div>

      {/* KPI strip */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <Card className='border-t-4 border-t-primary/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-primary/10 p-2.5'>
              <Wrench className='h-4 w-4 text-primary' />
            </div>
            <div>
              <p className='text-2xl font-bold'><CountUp value={totalMachines} /></p>
              <p className='text-xs text-muted-foreground'>Total Machines</p>
            </div>
          </CardContent>
        </Card>
        <Card className='border-t-4 border-t-purple-500/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-purple-500/10 p-2.5'>
              <Wrench className='h-4 w-4 text-purple-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-purple-700 dark:text-purple-400'><CountUp value={uniqueTypes} /></p>
              <p className='text-xs text-muted-foreground'>Machine Types</p>
            </div>
          </CardContent>
        </Card>
        <Card className='border-t-4 border-t-green-500/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-green-500/10 p-2.5'>
              <Wrench className='h-4 w-4 text-green-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-green-700 dark:text-green-400'><CountUp value={withParts} /></p>
              <p className='text-xs text-muted-foreground'>With Linked Parts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-3 items-center'>
        <Input
          placeholder='Search type, serial, customer...'
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className='max-w-xs'
        />
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className='w-48'>
            <SelectValue placeholder='All stores' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Stores</SelectItem>
            {storeOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className='w-52'>
            <SelectValue placeholder='All types' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className='pb-3 flex flex-row items-center justify-between'>
          <CardTitle className='text-base'>Equipment</CardTitle>
          <span className='text-sm text-muted-foreground'>{filteredRows.length} machines</span>
        </CardHeader>
        <CardContent className='p-0'>
          {loading ? (
            <TableSkeleton rows={10} columns={6} showHeader />
          ) : (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((h) => (
                        <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className='text-center py-10 text-muted-foreground'>
                        {rows.length === 0 ? 'No machines found across stores.' : 'No results match your filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={`${row.original.storeId}-${row.original.machineId}`}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className='flex items-center justify-between px-4 py-3 border-t border-border'>
                <span className='text-sm text-muted-foreground'>
                  Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                </span>
                <div className='flex gap-2'>
                  <Button variant='outline' size='sm' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
                  <Button variant='outline' size='sm' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
