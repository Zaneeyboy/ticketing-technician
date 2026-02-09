'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, SortingState } from '@tanstack/react-table';
import { Customer } from '@/lib/actions/customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit2, Trash2, Plus, ArrowUpDown, Check, X } from 'lucide-react';
import { createCustomer, updateCustomer, deleteCustomer, toggleCustomerDisabled } from '@/lib/actions/customers';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface CustomersTableProps {
  initialData: Customer[];
}

interface FormData {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}

export function CustomersTable({ initialData }: CustomersTableProps) {
  const { user } = useAuth();
  const [data, setData] = useState<Customer[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disableDialog, setDisableDialog] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openNewDialog = () => {
    setEditingCustomer(null);
    setFormData({ companyName: '', contactPerson: '', phone: '', email: '', address: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      companyName: customer.companyName,
      contactPerson: customer.contactPerson,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingCustomer) {
        const result = await updateCustomer(editingCustomer.id, formData);
        if (result.success) {
          showToast.success('Customer updated successfully');
          setData(data.map((c) => (c.id === editingCustomer.id ? { ...c, ...formData } : c)));
          setDialogOpen(false);
        } else {
          showToast.error(result.error || 'Failed to update customer');
        }
      } else {
        const result = await createCustomer(formData);
        if (result.success) {
          showToast.success('Customer created successfully');
          const newCustomer: Customer = {
            id: result.customerId!,
            ...formData,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setData([...data, newCustomer]);
          setDialogOpen(false);
        } else {
          showToast.error(result.error || 'Failed to create customer');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisable = async (customer: Customer) => {
    if (user?.role === 'call_admin') return; // Read-only for call admins

    setSubmitting(true);
    try {
      const result = await toggleCustomerDisabled(customer.id, !customer.isDisabled);
      if (result.success) {
        showToast.success(customer.isDisabled ? 'Customer enabled successfully' : 'Customer disabled successfully');
        setData(
          data.map((c) =>
            c.id === customer.id
              ? {
                  ...c,
                  isDisabled: !customer.isDisabled,
                }
              : c,
          ),
        );
        setDisableDialog(null);
      } else {
        showToast.error(result.error || 'Failed to update customer');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'companyName',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Company Name
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => <div className='font-medium'>{row.getValue('companyName')}</div>,
    },
    {
      accessorKey: 'contactPerson',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Contact Person
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Phone
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Email
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
    },
    {
      accessorKey: 'address',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Address
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => <div className='max-w-xs truncate'>{row.getValue('address')}</div>,
    },
    {
      accessorKey: 'isDisabled',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.isDisabled ? 'destructive' : 'default'}>{row.original.isDisabled ? 'Disabled' : 'Active'}</Badge>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        // Hide actions for call admins (read-only access)
        if (user?.role === 'call_admin') {
          return null;
        }

        return (
          <div className='flex gap-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='sm' onClick={() => openEditDialog(row.original)} className='h-8 w-8 p-0'>
                  <Edit2 className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit customer</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setDisableDialog(row.original)}
                  className={`h-8 w-8 p-0 ${row.original.isDisabled ? 'text-green-600 hover:text-green-600' : 'text-amber-600 hover:text-amber-600'}`}
                >
                  {row.original.isDisabled ? <Check className='h-4 w-4' /> : <X className='h-4 w-4' />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{row.original.isDisabled ? 'Enable customer' : 'Disable customer'}</TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter: debouncedGlobalFilter,
    },
  });

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center gap-4'>
        <Input placeholder='Search customers...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-sm' />
        {user?.role !== 'call_admin' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog} className='gap-2'>
                <Plus className='h-4 w-4' />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='companyName'>Company Name *</Label>
                  <Input id='companyName' value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} required />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='contactPerson'>Contact Person *</Label>
                  <Input id='contactPerson' value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} required />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='phone'>Phone * (minimum 10 digits)</Label>
                  <Input id='phone' type='tel' placeholder='e.g., 555-123-4567' value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required minLength={10} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='email'>Email *</Label>
                  <Input id='email' type='email' value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='address'>Address *</Label>
                  <Input id='address' placeholder='Enter full address' value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required />
                </div>
                <div className='flex gap-3'>
                  <Button type='submit' disabled={submitting}>
                    {submitting ? 'Saving...' : editingCustomer ? 'Update' : 'Create'}
                  </Button>
                  <Button type='button' variant='outline' onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-hidden'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className='h-24 text-center'>
                      No customers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className='flex items-center justify-between mt-4'>
            <p className='text-sm text-muted-foreground'>
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of {table.getFilteredRowModel().rows.length}{' '}
              customer(s) {table.getFilteredRowModel().rows.length !== data.length && `(${data.length} total)`}
            </p>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                Previous
              </Button>
              <Button variant='outline' size='sm' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={disableDialog !== null}>
        <AlertDialogContent>
          <AlertDialogTitle>{disableDialog?.isDisabled ? 'Enable Customer' : 'Disable Customer'}</AlertDialogTitle>
          <AlertDialogDescription>
            {disableDialog?.isDisabled
              ? `Are you sure you want to enable ${disableDialog?.companyName}? This customer will become available for selection in tickets.`
              : `Are you sure you want to disable ${disableDialog?.companyName}? This customer will no longer be available for selection in tickets.`}
          </AlertDialogDescription>
          <div className='flex gap-3 justify-end'>
            <AlertDialogCancel onClick={() => setDisableDialog(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disableDialog && handleToggleDisable(disableDialog)}
              disabled={submitting}
              className={disableDialog?.isDisabled ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}
            >
              {submitting ? 'Updating...' : disableDialog?.isDisabled ? 'Enable' : 'Disable'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
