'use client';

import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { clientCache } from '@/lib/client-cache';
import { useDebounce } from '@/lib/hooks/useDebounce';
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
import { Part } from '@/lib/types';
import { getParts, createPart, updatePart, deletePart, bulkCreateParts, type BulkPartRow } from '@/lib/actions/parts';
import { getMachineTypes } from '@/lib/actions/machines';
import { Plus, Edit2, Trash2, Eye, ArrowUpDown, Upload, Download, Package } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import * as XLSX from 'xlsx';
import { BulkUploadDialog, type ParsedRow } from '@/components/bulk-upload-dialog';
import { ExportButton } from '@/components/export-button';

// ── PartFormDialog ───────────────────────────────────────────────────────────────
// Isolated so form keystrokes don't re-render the entire parts table.
function PartFormDialog({
  open,
  onOpenChange,
  editingPart,
  machineTypes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingPart: Part | null;
  machineTypes: string[];
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantityInStock: 0,
    minQuantity: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset / populate form whenever the dialog opens or the target part changes
  useEffect(() => {
    if (open) {
      setError('');
      setFormData(
        editingPart
          ? {
              name: editingPart.name,
              description: editingPart.description,
              category: editingPart.category || '',
              quantityInStock: editingPart.quantityInStock,
              minQuantity: editingPart.minQuantity || 0,
            }
          : { name: '', description: '', category: '', quantityInStock: 0, minQuantity: 0 },
      );
    }
  }, [open, editingPart]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingPart) {
        const result = await updatePart(editingPart.id, formData);
        if (result.success) {
          showToast.success('Part updated successfully');
          onSaved();
          onOpenChange(false);
        } else {
          const msg = result.error || 'Failed to update part';
          setError(msg);
          showToast.error(msg);
        }
      } else {
        const result = await createPart(formData);
        if (result.success) {
          showToast.success('Part created successfully');
          onSaved();
          onOpenChange(false);
        } else {
          const msg = result.error || 'Failed to create part';
          setError(msg);
          showToast.error(msg);
        }
      }
    } catch (err: any) {
      const msg = err.message;
      setError(msg);
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingPart ? 'Edit Part' : 'Add New Part'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='name'>Part Name *</Label>
            <Input id='name' value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='description'>Description *</Label>
            <Textarea id='description' value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} required rows={3} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='category'>Machine Type / Category</Label>
            <Input
              id='category'
              value={formData.category}
              onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
              list='part-category-list'
              placeholder='Select or type the machine type this part belongs to…'
            />
            <datalist id='part-category-list'>
              {machineTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <p className='text-xs text-muted-foreground'>Link this part to a machine type so it can be filtered when logging work.</p>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='quantityInStock'>Quantity in Stock *</Label>
              <Input
                id='quantityInStock'
                type='number'
                min='0'
                value={formData.quantityInStock}
                onChange={(e) => setFormData((p) => ({ ...p, quantityInStock: parseInt(e.target.value) || 0 }))}
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
                onChange={(e) => setFormData((p) => ({ ...p, minQuantity: parseInt(e.target.value) || 0 }))}
                placeholder='Low stock alert'
              />
            </div>
          </div>
          {error && <div className='text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded'>{error}</div>}
          <div className='flex gap-3'>
            <Button type='submit' disabled={submitting}>
              {submitting ? 'Saving...' : editingPart ? 'Update' : 'Create'}
            </Button>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── PartsPage ───────────────────────────────────────────────────────────────
export default function PartsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [parts, setParts] = useState<Part[]>([]);
  const [machineTypes, setMachineTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [viewingPart, setViewingPart] = useState<Part | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Part | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // ── Client-side cache ─────────────────────────────────────────────────────
  // Runs before browser paint: if data is already cached, populate state
  // immediately so the skeleton never appears on repeat visits.
  useLayoutEffect(() => {
    if (authLoading || !user?.storeId) return;
    const cached = clientCache.get<{ parts: Part[]; machineTypes: string[] }>(`parts:${user.storeId}`);
    if (!cached) return;
    setParts(cached.parts);
    setMachineTypes(cached.machineTypes);
    setLoading(false);
  }, [authLoading, user?.storeId]);

  // Stats
  const lowStockCount = parts.filter((p) => p.quantityInStock <= (p.minQuantity || 0)).length;
  const totalQty = parts.reduce((sum, p) => sum + (p.quantityInStock || 0), 0);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Part Number', 'Description', 'Qty', 'Unit', 'Category / Machine Type'],
      ['MACH BREWER 38200.0017', 'BTX-B(D), 2PK HI Alt', 14, 'ea', 'Brewer machine'],
      ['FILTER PAPER A4', 'Standard A4 filter paper for espresso', 50, 'ea', 'Filter'],
    ]);
    ws['!cols'] = [{ wch: 32 }, { wch: 45 }, { wch: 8 }, { wch: 6 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parts');
    XLSX.writeFile(wb, 'parts-upload-template.xlsx');
  };

  const parsePartsFile = (buffer: ArrayBuffer): { rows: ParsedRow[]; parseError?: string } => {
    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][];

      // Detect header row by looking for 'Part Number' / 'Part No' / 'Part Name' in col[0]
      let headerRowIdx = raw.findIndex((r) => {
        const c0 = String(r[0]).toLowerCase();
        return c0.includes('part number') || c0.includes('part no') || c0.includes('part name');
      });
      if (headerRowIdx === -1) headerRowIdx = 0; // fallback to first row

      const headerRow = raw[headerRowIdx] as any[];

      // Auto-detect category column from header labels (col 3 or 4 depending on file format)
      let categoryColIdx = 4; // default: col E (after Name, Desc, Qty, Unit)
      headerRow.forEach((cell: any, i: number) => {
        const h = String(cell).toLowerCase();
        if (h.includes('categ') || h.includes('machine') || h.includes('type')) {
          categoryColIdx = i;
        }
      });

      // If the row right after the header is blank, skip it (blank spacer); otherwise start immediately
      const nextRowIdx = headerRowIdx + 1;
      const nextRow = raw[nextRowIdx] ?? [];
      const nextRowHasContent = nextRow.some((c: any) => String(c).trim() !== '');
      const dataStartIdx = nextRowHasContent ? nextRowIdx : nextRowIdx + 1;

      const dataRows = raw.slice(dataStartIdx);

      const rows: ParsedRow[] = dataRows
        .filter((r) => String(r[0]).trim())
        .map((r) => ({
          name: String(r[0]).trim(),
          description: String(r[1]).trim() || String(r[0]).trim(),
          quantityInStock: Number(r[2]) || 0,
          category: String(r[categoryColIdx] ?? '').trim() || undefined,
          minQuantity: 5,
        }));

      if (rows.length === 0) return { rows: [], parseError: 'No valid rows found. Ensure the file has a "Part Number" column.' };
      return { rows };
    } catch {
      return { rows: [], parseError: 'Failed to parse file. Use the provided template.' };
    }
  };

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

  const canWrite = ['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user?.role ?? '');

  const loadParts = useCallback(async () => {
    if (!user?.storeId) return;
    const storeId = user.storeId;
    try {
      const [data, types] = await Promise.all([getParts(), getMachineTypes()]);
      const parts = data as unknown as Part[];
      const machineTypes = types;
      clientCache.set(`parts:${storeId}`, { parts, machineTypes });
      setParts(parts);
      setMachineTypes(machineTypes);
    } catch (error) {
      console.error('Error loading parts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.storeId]);

  /** Invalidate client cache then reload — call after any mutation. */
  const reloadParts = useCallback(async () => {
    if (user?.storeId) clientCache.invalidate(`parts:${user.storeId}`);
    await loadParts();
  }, [user?.storeId, loadParts]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    if (!user.storeId) return;
    loadParts();
  }, [user, authLoading, loadParts]);

  const handleEdit = (part: Part) => {
    setEditingPart(part);
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
        setParts((prev) => {
          const next = prev.filter((p) => p.id !== part.id);
          if (user?.storeId) {
            const key = `parts:${user.storeId}`;
            const cached = clientCache.get<{ parts: Part[]; machineTypes: string[] }>(key);
            if (cached) clientCache.set(key, { ...cached, parts: next });
          }
          return next;
        });
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
          {canWrite && (
            <>
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
            </>
          )}
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
      globalFilter: debouncedGlobalFilter,
    },
  });
  if (!user || !['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Page Header */}
        <PageHeader
          title='Parts'
          description='Manage your parts inventory and stock levels'
          icon={Package}
          actions={
            <>
              <ExportButton
                data={table.getFilteredRowModel().rows.map((r) => r.original) as unknown as Record<string, any>[]}
                columns={[
                  { header: 'Part Name', key: 'name' },
                  { header: 'Description', key: 'description' },
                  { header: 'Category', key: 'category', formatter: (v) => v ?? '' },
                  { header: 'Qty in Stock', key: 'quantityInStock', formatter: (v) => String(v ?? 0) },
                  { header: 'Min Qty', key: 'minQuantity', formatter: (v) => String(v ?? 0) },
                  {
                    header: 'Status',
                    key: 'quantityInStock',
                    formatter: (v, row) => (v <= (row?.minQuantity ?? 0) ? 'Low Stock' : 'OK'),
                  },
                ]}
                filename='parts-export'
                sheetName='Parts'
                title='Parts Inventory'
              />
              {canWrite && (
                <>
                  <Button variant='outline' size='sm' onClick={downloadTemplate} className='gap-2'>
                    <Download className='h-4 w-4' />
                    Template
                  </Button>
                  <Button variant='outline' size='sm' onClick={() => setImportOpen(true)} className='gap-2'>
                    <Upload className='h-4 w-4' />
                    Import
                  </Button>
                  <Button size='sm' onClick={openNewDialog} className='gap-2'>
                    <Plus className='h-4 w-4' />
                    Add Part
                  </Button>
                </>
              )}
            </>
          }
        />

        {/* Stats bar */}
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children'>
          <Card className='animate-card-enter border-t-4 border-t-primary/60 bg-linear-to-br from-primary/8 via-background to-background'>
            <CardContent className='pt-5 flex items-center gap-3'>
              <div className='rounded-lg bg-primary/10 p-2.5'>
                <Package className='h-4 w-4 text-primary' />
              </div>
              <div>
                <p className='text-2xl font-bold'>{parts.length}</p>
                <p className='text-xs text-muted-foreground'>Total Parts</p>
              </div>
            </CardContent>
          </Card>
          <Card className='animate-card-enter border-t-4 border-t-blue-500/60 bg-linear-to-br from-blue-500/8 via-background to-background'>
            <CardContent className='pt-5 flex items-center gap-3'>
              <div className='rounded-lg bg-blue-500/10 p-2.5'>
                <Package className='h-4 w-4 text-blue-600' />
              </div>
              <div>
                <p className='text-2xl font-bold text-blue-700 dark:text-blue-400'>{totalQty.toLocaleString()}</p>
                <p className='text-xs text-muted-foreground'>Total Units in Stock</p>
              </div>
            </CardContent>
          </Card>
          <Card className='animate-card-enter border-t-4 border-t-red-500/60 bg-linear-to-br from-red-500/8 via-background to-background'>
            <CardContent className='pt-5 flex items-center gap-3'>
              <div className='rounded-lg bg-red-500/10 p-2.5'>
                <Package className='h-4 w-4 text-red-600' />
              </div>
              <div>
                <p className='text-2xl font-bold text-red-700 dark:text-red-400'>{lowStockCount}</p>
                <p className='text-xs text-muted-foreground'>Low Stock Items</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='space-y-4 animate-fade-in stagger-4'>
          <div className='flex flex-wrap justify-between items-center gap-3'>
            <Input placeholder='Search parts...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-sm' />
          </div>

          <PartFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editingPart={editingPart} machineTypes={machineTypes} onSaved={reloadParts} />

          <Card>
            <CardHeader className='flex flex-row items-center justify-between pb-3'>
              <CardTitle>All Parts</CardTitle>
              <span className='text-sm text-muted-foreground'>
                {table.getFilteredRowModel().rows.length} result{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
              </span>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={8} columns={5} showHeader />
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
                            <TableCell colSpan={columns.length} className='h-36 text-center'>
                              <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                                <Package className='h-8 w-8 opacity-30' />
                                <p className='font-medium'>No parts yet</p>
                                <p className='text-sm'>Add your first part or import from Excel</p>
                              </div>
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
        <DialogContent aria-describedby={undefined}>
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

      <BulkUploadDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityName='Parts'
        previewColumns={[
          { key: 'name', label: 'Part Number', required: true },
          { key: 'description', label: 'Description' },
          { key: 'quantityInStock', label: 'Qty', inputType: 'number' },
          { key: 'category', label: 'Category / Machine Type' },
        ]}
        onDownloadTemplate={downloadTemplate}
        parseFile={parsePartsFile}
        validateRow={(row) => {
          const errors: Record<string, string> = {};
          const name = String(row.name ?? '').trim();
          if (!name || name.length < 2) errors.name = 'Part name must be at least 2 characters';
          const qty = Number(row.quantityInStock);
          if (isNaN(qty) || qty < 0 || !Number.isFinite(qty)) errors.quantityInStock = 'Must be a whole number ≥ 0';
          return errors;
        }}
        processChunk={async (rows, updateExisting) => {
          const result = await bulkCreateParts(rows as unknown as BulkPartRow[], updateExisting);
          const allErrors = result.success ? result.errors : [...result.errors, result.error ?? 'Import failed — check the server logs for details'];
          return { created: result.created, updated: result.updated, skipped: result.skipped, errors: allErrors };
        }}
        showUpdateToggle
        chunkSize={1000}
        onComplete={() => reloadParts()}
      />
    </DashboardLayout>
  );
}
