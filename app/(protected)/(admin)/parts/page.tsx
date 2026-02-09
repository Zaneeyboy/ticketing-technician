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
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, SortingState } from '@tanstack/react-table';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Part } from '@/lib/types';
import { createPart, updatePart, deletePart } from '@/lib/actions/parts';
import { Plus, Edit2, Trash2, Eye, ArrowUpDown } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function PartsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [viewingPart, setViewingPart] = useState<Part | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Part | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantityInStock: 0,
    minQuantity: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getCategoryBadgeColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      Hardware: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      Software: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      Consumable: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      Maintenance: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      Accessory: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      Cable: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      Power: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      Filter: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    };
    return categoryColors[category] || 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
  };

  useEffect(() => {
    if (!user || !['admin', 'management'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    loadParts();
  }, [user]);

  const loadParts = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'parts'));
      const data = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Part,
      );
      setParts(data);
    } catch (error) {
      console.error('Error loading parts:', error);
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
      if (editingPart) {
        result = await updatePart(editingPart.id, formData);
        if (result.success) {
          showToast.success('Part updated successfully');
          setParts(parts.map((p) => (p.id === editingPart.id ? { ...p, ...formData } : p)));
          setDialogOpen(false);
        } else {
          const errorMsg = result.error || 'Failed to update part';
          setError(errorMsg);
          showToast.error(errorMsg);
        }
      } else {
        result = await createPart(formData);
        if (result.success) {
          showToast.success('Part created successfully');
          await loadParts();
          setDialogOpen(false);
        } else {
          const errorMsg = result.error || 'Failed to create part';
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

  const handleEdit = (part: Part) => {
    setEditingPart(part);
    setFormData({
      name: part.name,
      description: part.description,
      category: part.category || '',
      quantityInStock: part.quantityInStock,
      minQuantity: part.minQuantity || 0,
    });
    setDialogOpen(true);
  };

  const handleView = (part: Part) => {
    setViewingPart(part);
    setViewDialogOpen(true);
  };

  const handleDelete = async (part: Part) => {
    setSubmitting(true);
    try {
      const result = await deletePart(part.id);
      if (result.success) {
        showToast.success('Part deleted successfully');
        setParts(parts.filter((p) => p.id !== part.id));
        setDeleteDialog(null);
      } else {
        showToast.error(result.error || 'Failed to delete part');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openNewDialog = () => {
    setEditingPart(null);
    setFormData({ name: '', description: '', category: '', quantityInStock: 0, minQuantity: 0 });
    setDialogOpen(true);
  };

  const columns: ColumnDef<Part>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => <div className='font-medium'>{row.getValue('name')}</div>,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <div className='max-w-md truncate'>{row.getValue('description')}</div>,
    },
    {
      accessorKey: 'category',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Category
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const category = row.getValue('category') as string;
        return category ? <Badge className={getCategoryBadgeColor(category)}>{category}</Badge> : <span className='text-slate-400'>-</span>;
      },
    },
    {
      accessorKey: 'quantityInStock',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Quantity
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const quantity = row.getValue('quantityInStock') as number;
        const minQuantity = row.original.minQuantity || 0;
        const isLow = quantity <= minQuantity;
        return (
          <div className='flex items-center gap-2'>
            <span className={isLow ? 'text-red-600 font-semibold' : ''}>{quantity}</span>
            {isLow && (
              <Badge variant='destructive' className='text-xs'>
                Low Stock
              </Badge>
            )}
          </div>
        );
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
            <TooltipContent>View part</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='ghost' size='sm' onClick={() => handleEdit(row.original)} className='h-8 w-8 p-0'>
                <Edit2 className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit part</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='ghost' size='sm' onClick={() => setDeleteDialog(row.original)} className='h-8 w-8 p-0 text-destructive hover:text-destructive'>
                <Trash2 className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete part</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: parts,
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
            <p className='text-slate-600 dark:text-slate-400'>Manage parts inventory</p>
          </div>
        </div>

        <div className='space-y-4'>
          <div className='flex justify-between items-center gap-4'>
            <Input placeholder='Search parts...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-sm' />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewDialog} className='gap-2'>
                  <Plus className='h-4 w-4' />
                  Add Part
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPart ? 'Edit Part' : 'Add New Part'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='name'>Part Name *</Label>
                    <Input id='name' value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='description'>Description *</Label>
                    <Textarea id='description' value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required rows={3} />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='category'>Category</Label>
                    <Input id='category' value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder='e.g. Electrical, Mechanical, Filter' />
                  </div>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='quantityInStock'>Quantity in Stock *</Label>
                      <Input
                        id='quantityInStock'
                        type='number'
                        min='0'
                        value={formData.quantityInStock}
                        onChange={(e) => setFormData({ ...formData, quantityInStock: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='minQuantity'>Minimum Quantity</Label>
                      <Input
                        id='minQuantity'
                        type='number'
                        min='0'
                        value={formData.minQuantity}
                        onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 0 })}
                        placeholder='Low stock alert'
                      />
                    </div>
                  </div>
                  {error && <div className='text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded'>{error}</div>}
                  <div className='flex gap-3'>
                    <Button type='submit' disabled={submitting}>
                      {submitting ? 'Saving...' : editingPart ? 'Update' : 'Create'}
                    </Button>
                    <Button type='button' variant='outline' onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Parts</CardTitle>
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
                              No parts found
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
                      {table.getFilteredRowModel().rows.length} part(s) {table.getFilteredRowModel().rows.length !== parts.length && `(${parts.length} total)`}
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
            <DialogTitle>Part Details</DialogTitle>
          </DialogHeader>
          {viewingPart && (
            <div className='space-y-4'>
              <div>
                <Label className='text-slate-500'>Name</Label>
                <p className='font-medium'>{viewingPart.name}</p>
              </div>
              <div>
                <Label className='text-slate-500'>Description</Label>
                <p>{viewingPart.description}</p>
              </div>
              <div>
                <Label className='text-slate-500'>Category</Label>
                <p>{viewingPart.category || '-'}</p>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Label className='text-slate-500'>Quantity in Stock</Label>
                  <p className='font-medium text-lg'>{viewingPart.quantityInStock}</p>
                </div>
                <div>
                  <Label className='text-slate-500'>Minimum Quantity</Label>
                  <p className='font-medium text-lg'>{viewingPart.minQuantity || 0}</p>
                </div>
              </div>
              {viewingPart.quantityInStock <= (viewingPart.minQuantity || 0) && (
                <div className='bg-red-50 dark:bg-red-900/20 p-3 rounded flex items-center gap-2'>
                  <Badge variant='destructive'>Low Stock Alert</Badge>
                  <span className='text-sm'>This part is running low on inventory</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog !== null}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Part</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete {deleteDialog?.name}? This action cannot be undone.</AlertDialogDescription>
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
