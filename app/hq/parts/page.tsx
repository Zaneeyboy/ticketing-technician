'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Package } from 'lucide-react';
import { getHQParts, type HQPartRow } from '@/lib/actions/parts';
import { ExportButton } from '@/components/export-button';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { CountUp } from '@/components/ui/count-up';
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, ColumnDef, SortingState, flexRender } from '@tanstack/react-table';

export default function HQPartsPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<HQPartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedFilter = useDebounce(globalFilter, 300);
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'storeName', desc: false }]);

  useEffect(() => {
    if (!authLoading) {
      getHQParts().then((res) => {
        if (res.success) setRows(res.rows);
        setLoading(false);
      });
    }
  }, [authLoading]);

  const storeOptions = useMemo(() => {
    const names = [...new Set(rows.map((r) => r.storeName))].sort();
    return names;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (storeFilter !== 'all' && r.storeName !== storeFilter) return false;
      if (debouncedFilter) {
        const q = debouncedFilter.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.storeName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, storeFilter, debouncedFilter]);

  const totalParts = filteredRows.length;
  const totalUnits = filteredRows.reduce((s, r) => s + r.quantityInStock, 0);
  const lowStockCount = filteredRows.filter((r) => r.isLowStock).length;

  const columns: ColumnDef<HQPartRow>[] = [
    {
      accessorKey: 'storeName',
      header: 'Store',
      cell: ({ row }) => <span className='font-medium'>{row.getValue('storeName')}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Part Name',
      cell: ({ row }) => <span className='font-medium'>{row.getValue('name')}</span>,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <span className='text-muted-foreground truncate max-w-xs block'>{row.getValue('description') || '—'}</span>,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const cat = row.getValue('category') as string;
        return cat ? <Badge variant='secondary'>{cat}</Badge> : <span className='text-muted-foreground'>—</span>;
      },
    },
    {
      accessorKey: 'quantityInStock',
      header: 'In Stock',
      cell: ({ row }) => {
        const qty = row.getValue('quantityInStock') as number;
        const isLow = row.original.isLowStock;
        return (
          <div className='flex items-center gap-2'>
            <span className={isLow ? 'text-destructive font-semibold' : ''}>{qty}</span>
            {isLow && (
              <Badge variant='destructive' className='text-xs'>
                Low
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'minQuantity',
      header: 'Min Qty',
      cell: ({ row }) => <span className='text-muted-foreground'>{row.getValue('minQuantity')}</span>,
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
          <h1 className='text-2xl font-bold'>Parts — All Stores</h1>
          <p className='text-sm text-muted-foreground mt-0.5'>Cross-store inventory overview (read-only)</p>
        </div>
        <ExportButton
          data={filteredRows as unknown as Record<string, any>[]}
          columns={[
            { header: 'Store', key: 'storeName' },
            { header: 'Part Name', key: 'name' },
            { header: 'Description', key: 'description' },
            { header: 'Category', key: 'category' },
            { header: 'In Stock', key: 'quantityInStock', formatter: (v) => String(v ?? 0) },
            { header: 'Min Qty', key: 'minQuantity', formatter: (v) => String(v ?? 0) },
            { header: 'Status', key: 'isLowStock', formatter: (v) => (v ? 'Low Stock' : 'OK') },
          ]}
          filename='hq-parts-export'
          sheetName='Parts'
          title='HQ Parts Overview'
        />
      </div>

      {/* KPI strip */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <Card className='border-t-4 border-t-primary/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-primary/10 p-2.5'>
              <Package className='h-4 w-4 text-primary' />
            </div>
            <div>
              <p className='text-2xl font-bold'>
                <CountUp value={totalParts} />
              </p>
              <p className='text-xs text-muted-foreground'>Total Part Lines</p>
            </div>
          </CardContent>
        </Card>
        <Card className='border-t-4 border-t-blue-500/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-blue-500/10 p-2.5'>
              <Package className='h-4 w-4 text-blue-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-blue-700 dark:text-blue-400'>
                <CountUp value={totalUnits} />
              </p>
              <p className='text-xs text-muted-foreground'>Total Units in Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card className='border-t-4 border-t-destructive/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-destructive/10 p-2.5'>
              <AlertTriangle className='h-4 w-4 text-destructive' />
            </div>
            <div>
              <p className='text-2xl font-bold text-destructive'>
                <CountUp value={lowStockCount} />
              </p>
              <p className='text-xs text-muted-foreground'>Low Stock Items</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-3 items-center'>
        <Input placeholder='Search parts, store, category...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-xs' />
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className='w-48'>
            <SelectValue placeholder='All stores' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Stores</SelectItem>
            {storeOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className='pb-3 flex flex-row items-center justify-between'>
          <CardTitle className='text-base'>Inventory</CardTitle>
          <span className='text-sm text-muted-foreground'>{filteredRows.length} items</span>
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
                        {rows.length === 0 ? 'No parts found across stores.' : 'No results match your filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={`${row.original.storeId}-${row.original.partId}`}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {/* Pagination */}
              <div className='flex items-center justify-between px-4 py-3 border-t border-border'>
                <span className='text-sm text-muted-foreground'>
                  Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                </span>
                <div className='flex gap-2'>
                  <Button variant='outline' size='sm' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                    Previous
                  </Button>
                  <Button variant='outline' size='sm' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
