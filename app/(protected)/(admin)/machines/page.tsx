'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { showToast } from '@/lib/toast';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, SortingState } from '@tanstack/react-table';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Machine, Customer } from '@/lib/types';
import { createMachine, updateMachine, deleteMachine } from '@/lib/actions/machines';
import { Plus, Edit2, Trash2, Eye, ArrowUpDown } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function MachinesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [viewingMachine, setViewingMachine] = useState<Machine | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Machine | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [formData, setFormData] = useState({
    customerId: '',
    type: 'Crescendo' as 'Crescendo' | 'Espresso' | 'Grinder' | 'Other',
    serialNumber: '',
    location: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !['admin', 'management', 'call_admin'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [machinesSnap, customersSnap] = await Promise.all([getDocs(collection(db, 'machines')), getDocs(collection(db, 'customers'))]);

      const machinesData = machinesSnap.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Machine,
      );

      const customersData = customersSnap.docs
        .filter((doc) => !doc.data().isDisabled) // Filter out disabled customers
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Customer,
        );

      setMachines(machinesData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      let result;
      if (editingMachine) {
        result = await updateMachine(editingMachine.id, formData);
        if (result.success) {
          showToast.success('Machine updated successfully');
          await loadData();
          setDialogOpen(false);
        } else {
          const errorMsg = result.error || 'Failed to update machine';
          setError(errorMsg);
          showToast.error(errorMsg);
        }
      } else {
        result = await createMachine(formData);
        if (result.success) {
          showToast.success('Machine created successfully');
          await loadData();
          setDialogOpen(false);
        } else {
          const errorMsg = result.error || 'Failed to create machine';
          setError(errorMsg);
          showToast.error(errorMsg);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message;
      setError(errorMsg);
      showToast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setFormData({
      customerId: machine.customerId,
      type: machine.type,
      serialNumber: machine.serialNumber,
      location: machine.location || '',
      notes: machine.notes || '',
    });
    setDialogOpen(true);
  };

  const handleView = (machine: Machine) => {
    setViewingMachine(machine);
    setViewDialogOpen(true);
  };

  const handleDelete = async (machine: Machine) => {
    setSubmitting(true);
    try {
      const result = await deleteMachine(machine.id);
      if (result.success) {
        showToast.success('Machine deleted successfully');
        setMachines(machines.filter((m) => m.id !== machine.id));
        setDeleteDialog(null);
      } else {
        showToast.error(result.error || 'Failed to delete machine');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openNewDialog = () => {
    setEditingMachine(null);
    setFormData({ customerId: '', type: 'Crescendo', serialNumber: '', location: '', notes: '' });
    setDialogOpen(true);
  };

  const getCustomerName = (customerId: string) => {
    return customers.find((c) => c.id === customerId)?.companyName || 'Unknown';
  };

  const columns: ColumnDef<Machine>[] = [
    {
      accessorKey: 'customerId',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Customer
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => <div className='font-medium'>{getCustomerName(row.getValue('customerId'))}</div>,
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Type
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const type = row.getValue('type') as string;
        const colorMap: Record<string, string> = {
          Crescendo: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
          Espresso: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
          Grinder: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          Other: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
        };
        return <Badge className={colorMap[type] || colorMap.Other}>{type}</Badge>;
      },
    },
    {
      accessorKey: 'serialNumber',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Serial Number
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => <code className='text-sm'>{row.getValue('serialNumber')}</code>,
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const location = row.getValue('location') as string;
        return location || <span className='text-slate-400'>-</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex gap-2'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='ghost' size='sm' onClick={() => handleView(row.original)} className='h-8 w-8 p-0'>
                <Eye className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View machine</TooltipContent>
          </Tooltip>
          {user?.role !== 'call_admin' && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='ghost' size='sm' onClick={() => handleEdit(row.original)} className='h-8 w-8 p-0'>
                    <Edit2 className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit machine</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='ghost' size='sm' onClick={() => setDeleteDialog(row.original)} className='h-8 w-8 p-0 text-destructive hover:text-destructive'>
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete machine</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: machines,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
  });

  if (!user || !['admin', 'management'].includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div className='flex justify-between items-center'>
          <div>
            <p className='text-slate-600 dark:text-slate-400'>Manage machine inventory</p>
          </div>
        </div>

        <div className='space-y-4'>
          <div className='flex justify-between items-center gap-4'>
            <Input placeholder='Search machines...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-sm' />
            {user?.role !== 'call_admin' && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewDialog} className='gap-2'>
                    <Plus className='h-4 w-4' />
                    Add Machine
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingMachine ? 'Edit Machine' : 'Add New Machine'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className='space-y-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='customerId'>Customer *</Label>
                      <Select value={formData.customerId} onValueChange={(value) => setFormData({ ...formData, customerId: value })} required>
                        <SelectTrigger>
                          <SelectValue placeholder='Select customer' />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.companyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='type'>Machine Type *</Label>
                      <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })} required>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='Crescendo'>Crescendo</SelectItem>
                          <SelectItem value='Espresso'>Espresso</SelectItem>
                          <SelectItem value='Grinder'>Grinder</SelectItem>
                          <SelectItem value='Other'>Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='serialNumber'>Serial Number *</Label>
                      <Input id='serialNumber' value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} required />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='location'>Location</Label>
                      <Input id='location' value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder='e.g. Main Counter, Back Room' />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='notes'>Notes</Label>
                      <Input id='notes' value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                    </div>
                    {error && <div className='text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded'>{error}</div>}
                    <div className='flex gap-3'>
                      <Button type='submit' disabled={submitting}>
                        {submitting ? 'Saving...' : editingMachine ? 'Update' : 'Create'}
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
              <CardTitle>All Machines</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='text-center py-8'>Loading...</div>
              ) : (
                <>
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
                              No machines found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className='flex items-center justify-between mt-4'>
                    <p className='text-sm text-muted-foreground'>
                      Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                      {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of{' '}
                      {table.getFilteredRowModel().rows.length} machine(s) {table.getFilteredRowModel().rows.length !== machines.length && `(${machines.length} total)`}
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
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Machine Details</DialogTitle>
          </DialogHeader>
          {viewingMachine && (
            <div className='space-y-4'>
              <div>
                <Label className='text-slate-500'>Customer</Label>
                <p className='font-medium'>{getCustomerName(viewingMachine.customerId)}</p>
              </div>
              <div>
                <Label className='text-slate-500'>Type</Label>
                <p className='font-medium'>{viewingMachine.type}</p>
              </div>
              <div>
                <Label className='text-slate-500'>Serial Number</Label>
                <code className='text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded'>{viewingMachine.serialNumber}</code>
              </div>
              <div>
                <Label className='text-slate-500'>Location</Label>
                <p>{viewingMachine.location || '-'}</p>
              </div>
              {viewingMachine.notes && (
                <div>
                  <Label className='text-slate-500'>Notes</Label>
                  <p className='text-sm'>{viewingMachine.notes}</p>
                </div>
              )}
              {viewingMachine.installationDate && (
                <div>
                  <Label className='text-slate-500'>Installation Date</Label>
                  <p>
                    {viewingMachine.installationDate instanceof Date ? viewingMachine.installationDate.toLocaleDateString() : new Date(viewingMachine.installationDate as any).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog !== null}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Machine</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this {deleteDialog?.type} machine (S/N: {deleteDialog?.serialNumber})? This action cannot be undone.
          </AlertDialogDescription>
          <div className='flex gap-3 justify-end'>
            <AlertDialogCancel onClick={() => setDeleteDialog(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDialog && handleDelete(deleteDialog)} disabled={submitting} className='bg-destructive hover:bg-destructive/90'>
              {submitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
