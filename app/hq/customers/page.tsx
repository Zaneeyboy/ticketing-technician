'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2 } from 'lucide-react';
import { getHQCustomers, type HQCustomerRow } from '@/lib/actions/customers';
import { ExportButton } from '@/components/export-button';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { CountUp } from '@/components/ui/count-up';
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, ColumnDef, SortingState, flexRender } from '@tanstack/react-table';

export default function HQCustomersPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<HQCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedFilter = useDebounce(globalFilter, 300);
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'storeName', desc: false }]);

  useEffect(() => {
    if (!authLoading) {
      getHQCustomers().then((res) => {
        if (res.success) setRows(res.rows);
        setLoading(false);
      });
    }
  }, [authLoading]);

  const storeOptions = useMemo(() => [...new Set(rows.map((r) => r.storeName))].sort(), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (storeFilter !== 'all' && r.storeName !== storeFilter) return false;
      if (statusFilter === 'active' && r.isDisabled) return false;
      if (statusFilter === 'disabled' && !r.isDisabled) return false;
      if (debouncedFilter) {
        const q = debouncedFilter.toLowerCase();
        return (
          r.companyName.toLowerCase().includes(q) ||
          r.contactPerson.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.storeName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, storeFilter, statusFilter, debouncedFilter]);

  const totalCustomers = filteredRows.length;
  const activeCount = filteredRows.filter((r) => !r.isDisabled).length;
  const disabledCount = filteredRows.filter((r) => r.isDisabled).length;

  const columns: ColumnDef<HQCustomerRow>[] = [
    {
      accessorKey: 'storeName',
      header: 'Store',
      cell: ({ row }) => <span className='font-medium'>{row.getValue('storeName')}</span>,
    },
    {
      accessorKey: 'companyName',
      header: 'Company',
      cell: ({ row }) => <span className='font-medium'>{row.getValue('companyName')}</span>,
    },
    {
      accessorKey: 'contactPerson',
      header: 'Contact',
      cell: ({ row }) => <span>{row.getValue('contactPerson') || '—'}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => {
        const phone = row.getValue('phone') as string;
        return phone ? <span className='text-sm'>{phone}</span> : <span className='text-muted-foreground'>—</span>;
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => {
        const email = row.getValue('email') as string;
        return email ? <span className='text-sm text-muted-foreground'>{email}</span> : <span className='text-muted-foreground'>—</span>;
      },
    },
    {
      accessorKey: 'isDisabled',
      header: 'Status',
      cell: ({ row }) => {
        const disabled = row.getValue('isDisabled') as boolean;
        return disabled ? (
          <Badge variant='secondary' className='text-xs'>
            Disabled
          </Badge>
        ) : (
          <Badge className='text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'>Active</Badge>
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
          <h1 className='text-2xl font-bold'>Customers — All Stores</h1>
          <p className='text-sm text-muted-foreground mt-0.5'>Cross-store customer overview (read-only)</p>
        </div>
        <ExportButton
          data={filteredRows as unknown as Record<string, any>[]}
          columns={[
            { header: 'Store', key: 'storeName' },
            { header: 'Company', key: 'companyName' },
            { header: 'Contact', key: 'contactPerson', formatter: (v) => v ?? '' },
            { header: 'Phone', key: 'phone', formatter: (v) => v ?? '' },
            { header: 'Email', key: 'email', formatter: (v) => v ?? '' },
            { header: 'Status', key: 'isDisabled', formatter: (v) => (v ? 'Disabled' : 'Active') },
          ]}
          filename='hq-customers-export'
          sheetName='Customers'
          title='HQ Customers Overview'
        />
      </div>

      {/* KPI strip */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <Card className='border-t-4 border-t-primary/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-primary/10 p-2.5'>
              <Building2 className='h-4 w-4 text-primary' />
            </div>
            <div>
              <p className='text-2xl font-bold'>
                <CountUp value={totalCustomers} />
              </p>
              <p className='text-xs text-muted-foreground'>Total Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card className='border-t-4 border-t-green-500/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-green-500/10 p-2.5'>
              <Building2 className='h-4 w-4 text-green-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-green-700 dark:text-green-400'>
                <CountUp value={activeCount} />
              </p>
              <p className='text-xs text-muted-foreground'>Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className='border-t-4 border-t-slate-400/60'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-slate-100 p-2.5'>
              <Building2 className='h-4 w-4 text-slate-500' />
            </div>
            <div>
              <p className='text-2xl font-bold text-slate-600 dark:text-slate-400'>
                <CountUp value={disabledCount} />
              </p>
              <p className='text-xs text-muted-foreground'>Disabled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap gap-3 items-center'>
        <Input placeholder='Search company, contact, email...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-xs' />
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-36'>
            <SelectValue placeholder='All statuses' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Statuses</SelectItem>
            <SelectItem value='active'>Active</SelectItem>
            <SelectItem value='disabled'>Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className='pb-3 flex flex-row items-center justify-between'>
          <CardTitle className='text-base'>Customer Directory</CardTitle>
          <span className='text-sm text-muted-foreground'>{filteredRows.length} customers</span>
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
                        {rows.length === 0 ? 'No customers found across stores.' : 'No results match your filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={`${row.original.storeId}-${row.original.customerId}`}>
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
