'use client';

import * as XLSX from 'xlsx';
import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { clientCache } from '@/lib/client-cache';
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
import { Machine, Customer, MachinePart } from '@/lib/types';
import { getMachines, createMachine, updateMachine, deleteMachine, bulkCreateMachines, getMachineTypes, addMachineType, setMachineAssociatedParts, type BulkMachineRow } from '@/lib/actions/machines';
import { getCustomers } from '@/lib/actions/customers';
import { Plus, Edit2, Trash2, Eye, ArrowUpDown, Upload, Download, Wrench, X, Package, ChevronsUpDown, Users, LayoutGrid } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { getParts, type Part } from '@/lib/actions/parts';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { PageHeader } from '@/components/page-header';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkUploadDialog, type ParsedRow } from '@/components/bulk-upload-dialog';
import { ExportButton } from '@/components/export-button';

// ── MachineFormDialog ─────────────────────────────────────────────────────
// Isolated so form keystrokes don't re-render the entire machines table.
function MachineFormDialog({
  open,
  onOpenChange,
  editingMachine,
  customers,
  machineTypes,
  parts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingMachine: Machine | null;
  customers: Customer[];
  machineTypes: string[];
  parts: Part[];
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    customerId: '',
    type: '' as string,
    serialNumber: '',
    location: '',
    notes: '',
  });
  const [associatedParts, setAssociatedParts] = useState<MachinePart[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const [partsOpen, setPartsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset / populate form whenever the dialog opens or the target machine changes
  useEffect(() => {
    if (open) {
      setError('');
      setPartSearch('');
      setPartsOpen(false);
      setAssociatedParts(editingMachine?.associatedParts ?? []);
      setFormData(
        editingMachine
          ? {
              customerId: editingMachine.customerId,
              type: editingMachine.type,
              serialNumber: editingMachine.serialNumber,
              location: editingMachine.location || '',
              notes: editingMachine.notes || '',
            }
          : { customerId: '', type: '', serialNumber: '', location: '', notes: '' },
      );
    }
  }, [open, editingMachine]);

  const removePart = (idx: number) => setAssociatedParts((prev) => prev.filter((_, i) => i !== idx));

  const togglePart = (part: Part) => {
    const isSelected = associatedParts.some((ap) => ap.partId === part.id || ap.partName.toLowerCase() === part.name.toLowerCase());
    if (isSelected) {
      setAssociatedParts((prev) => prev.filter((ap) => ap.partId !== part.id && ap.partName.toLowerCase() !== part.name.toLowerCase()));
    } else {
      setAssociatedParts((prev) => [...prev, { partId: part.id, partName: part.name, addedAt: new Date() }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingMachine) {
        const result = await updateMachine(editingMachine.id, formData);
        if (result.success) {
          // Save parts list separately (full replace)
          await setMachineAssociatedParts(
            editingMachine.id,
            associatedParts.map((p) => ({ partId: p.partId, partName: p.partName, addedAt: p.addedAt instanceof Date ? p.addedAt : new Date() })),
          );
          showToast.success('Machine updated successfully');
          onSaved();
          onOpenChange(false);
        } else {
          const msg = result.error || 'Failed to update machine';
          setError(msg);
          showToast.error(msg);
        }
      } else {
        const result = await createMachine(formData);
        if (result.success) {
          showToast.success('Machine created successfully');
          onSaved();
          onOpenChange(false);
        } else {
          const msg = result.error || 'Failed to create machine';
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
          <DialogTitle>{editingMachine ? 'Edit Machine' : 'Add New Machine'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='customerId'>Customer *</Label>
            <Select value={formData.customerId} onValueChange={(value) => setFormData((p) => ({ ...p, customerId: value }))} required>
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
            <Input
              id='type'
              value={formData.type}
              onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
              list='machine-types-list'
              placeholder='Select or type a machine type…'
              required
            />
            <datalist id='machine-types-list'>
              {machineTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <p className='text-xs text-muted-foreground'>Type a new value to add a custom machine type — it will be saved for future use.</p>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='serialNumber'>Serial Number *</Label>
            <Input id='serialNumber' value={formData.serialNumber} onChange={(e) => setFormData((p) => ({ ...p, serialNumber: e.target.value }))} required />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='location'>Location</Label>
            <Input id='location' value={formData.location} onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))} placeholder='e.g. Main Counter, Back Room' />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='notes'>Notes</Label>
            <Input id='notes' value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          {/* Associated Parts */}
          <div className='space-y-2'>
            <Label className='flex items-center gap-1.5'>
              <Package className='h-3.5 w-3.5' />
              Associated Parts
            </Label>
            <p className='text-xs text-muted-foreground'>Parts known to belong to or be used with this machine. Also populated automatically from work logs.</p>
            <Popover open={partsOpen} onOpenChange={setPartsOpen}>
              <PopoverTrigger asChild>
                <Button type='button' variant='outline' role='combobox' aria-expanded={partsOpen} className='w-full justify-between font-normal'>
                  {associatedParts.length > 0 ? `${associatedParts.length} part${associatedParts.length !== 1 ? 's' : ''} selected` : 'Select parts…'}
                  <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='p-0 w-80' align='start'>
                <div className='flex flex-col'>
                  <div className='p-2 border-b'>
                    <Input placeholder='Search parts…' value={partSearch} onChange={(e) => setPartSearch(e.target.value)} className='h-8 text-sm' />
                  </div>
                  <div className='max-h-52 overflow-y-auto'>
                    {parts.filter((p) => p.name.toLowerCase().includes(partSearch.toLowerCase())).length === 0 ? (
                      <p className='p-3 text-sm text-muted-foreground text-center'>No parts found.</p>
                    ) : (
                      parts
                        .filter((p) => p.name.toLowerCase().includes(partSearch.toLowerCase()))
                        .map((part) => {
                          const isSelected = associatedParts.some((ap) => ap.partId === part.id || ap.partName.toLowerCase() === part.name.toLowerCase());
                          return (
                            <button key={part.id} type='button' onClick={() => togglePart(part)} className='flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-accent text-left'>
                              <Checkbox checked={isSelected} className='pointer-events-none' tabIndex={-1} />
                              {part.name}
                            </button>
                          );
                        })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {associatedParts.length > 0 && (
              <div className='flex flex-wrap gap-1.5 pt-1'>
                {associatedParts.map((part, idx) => (
                  <span key={idx} className='inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium'>
                    {part.partName}
                    <button type='button' onClick={() => removePart(idx)} className='ml-0.5 text-slate-400 hover:text-destructive'>
                      <X className='h-3 w-3' />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <div className='text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded'>{error}</div>}
          <div className='flex gap-3'>
            <Button type='submit' disabled={submitting}>
              {submitting ? 'Saving...' : editingMachine ? 'Update' : 'Create'}
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

// ── MachinesPage ───────────────────────────────────────────────────────────────
export default function MachinesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machineTypes, setMachineTypes] = useState<string[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [viewingMachine, setViewingMachine] = useState<Machine | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Machine | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // ── Client-side cache ─────────────────────────────────────────────────────
  // Runs synchronously before browser paint: if cached data exists, populate
  // state immediately so the skeleton never appears on repeat visits.
  useLayoutEffect(() => {
    if (authLoading || !user?.storeId) return;
    const cached = clientCache.get<{
      machines: Machine[];
      customers: Customer[];
      machineTypes: string[];
      parts: Part[];
    }>(`machines:${user.storeId}`);
    if (!cached) return;
    setMachines(cached.machines);
    setCustomers(cached.customers);
    setMachineTypes(cached.machineTypes);
    setParts(cached.parts);
    setLoading(false);
  }, [authLoading, user?.storeId]);

  // Stats
  const typeCounts = machines.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1;
    return acc;
  }, {});
  const uniqueTypeCount = Object.keys(typeCounts).length;
  const topType = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0] ?? null;
  const uniqueCustomerCount = new Set(machines.map((m) => m.customerId)).size;

  // Bulk upload helpers
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Serial Number', 'Machine Type', 'Customer Name', 'Location', 'Notes'],
      ['SN-001234', 'Crescendo', 'Acme Coffee Ltd', 'Main Counter', 'Annual service due June'],
    ]);
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Machines');
    XLSX.writeFile(wb, 'machines-upload-template.xlsx');
  };

  const parseMachinesFile = (buffer: ArrayBuffer): { rows: ParsedRow[]; parseError?: string } => {
    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      const rows: ParsedRow[] = raw
        .map((r) => ({
          serialNumber: String(r['Serial Number'] ?? r['serialNumber'] ?? '').trim(),
          type: String(r['Machine Type'] ?? r['type'] ?? 'Other').trim(),
          customerName: String(r['Customer Name'] ?? r['customerName'] ?? '').trim(),
          location: String(r['Location'] ?? r['location'] ?? '').trim(),
          notes: String(r['Notes'] ?? r['notes'] ?? '').trim(),
        }))
        .filter((r) => r.serialNumber);
      if (rows.length === 0) return { rows: [], parseError: 'No valid rows found. Ensure the file has a "Serial Number" column.' };
      return { rows };
    } catch {
      return { rows: [], parseError: 'Failed to parse file. Use the provided template.' };
    }
  };

  const loadData = useCallback(async () => {
    if (!user?.storeId) return;
    const storeId = user.storeId;
    try {
      const [machinesData, customersData, typesData, partsData] = await Promise.all([getMachines(), getCustomers(), getMachineTypes(), getParts()]);
      const machines = machinesData as unknown as Machine[];
      const customers = customersData.filter((c) => !c.isDisabled) as unknown as Customer[];
      const machineTypes = typesData;
      const parts = partsData;
      // Persist in client cache so repeat visits skip the skeleton
      clientCache.set(`machines:${storeId}`, { machines, customers, machineTypes, parts });
      setMachines(machines);
      setCustomers(customers);
      setMachineTypes(machineTypes);
      setParts(parts);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.storeId]);

  /** Invalidate client cache then reload — call after any mutation. */
  const reloadData = useCallback(async () => {
    if (user?.storeId) clientCache.invalidate(`machines:${user.storeId}`);
    await loadData();
  }, [user?.storeId, loadData]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['store_admin', 'store_manager', 'call_admin'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    if (!user.storeId) return;
    loadData();
  }, [user, authLoading, loadData, router]);

  const handleEdit = useCallback((machine: Machine) => {
    setEditingMachine(machine);
    setDialogOpen(true);
  }, []);

  const handleView = useCallback((machine: Machine) => {
    setViewingMachine(machine);
    setViewDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (machine: Machine) => {
      setSubmitting(true);
      try {
        const result = await deleteMachine(machine.id);
        if (result.success) {
          showToast.success('Machine deleted successfully');
          setMachines((prev) => {
            const next = prev.filter((m) => m.id !== machine.id);
            // Keep client cache in sync with the optimistic removal
            if (user?.storeId) {
              const key = `machines:${user.storeId}`;
              const cached = clientCache.get<{ machines: Machine[]; customers: Customer[]; machineTypes: string[]; parts: Part[] }>(key);
              if (cached) clientCache.set(key, { ...cached, machines: next });
            }
            return next;
          });
          setDeleteDialog(null);
        } else {
          showToast.error(result.error || 'Failed to delete machine');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [user?.storeId],
  );

  const openNewDialog = useCallback(() => {
    setEditingMachine(null);
    setDialogOpen(true);
  }, []);

  const getCustomerName = useCallback(
    (customerId: string) => {
      return customers.find((c) => c.id === customerId)?.companyName || 'Unknown';
    },
    [customers],
  );

  const columns = useMemo<ColumnDef<Machine>[]>(
    () => [
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
            'iPilot Machine': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            'EGRO Machine': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
            'Crescendo Machine': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
            'Rancilio Espresso Machine': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
            'Silvia Espresso Machine': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
            'BUNN Grinder': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            'BUNN Kyro Grinder': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
            'Samremo Grinder': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
            'Brewer Machine': 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200',
            'Smartwave Brewer Machine': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
            'BUNN Server': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            'Nitron RMV': 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
            'Water Machine': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
            'Barista Tools': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
            'BUNN Brewer Part': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            'BUNN Part': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            'iPilot Parts': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            'Rancilio Part': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
            'Flo Jet Pump': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
            'Misc. Part': 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
            BUNN: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            'Espresso Part': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
            'EGRO Part (Rancilio)': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
          };
          return <Badge className={colorMap[type] ?? 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200'}>{type}</Badge>;
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
            {user?.role !== 'store_manager' && (
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
    ],
    [getCustomerName, handleView, handleEdit, user?.role],
  );

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
      globalFilter: debouncedGlobalFilter,
    },
  });

  if (!user || !['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Page Header */}
        <PageHeader
          title='Machines'
          description='Track and manage all registered equipment'
          icon={Wrench}
          actions={
            <>
              <ExportButton
                data={table.getFilteredRowModel().rows.map((r) => ({
                  ...r.original,
                  customerName: getCustomerName(r.original.customerId),
                }))}
                columns={[
                  { header: 'Customer', key: 'customerName' },
                  { header: 'Type', key: 'type' },
                  { header: 'Serial Number', key: 'serialNumber' },
                  { header: 'Location', key: 'location', formatter: (v) => v ?? '' },
                  { header: 'Notes', key: 'notes', formatter: (v) => v ?? '' },
                ]}
                filename='machines-export'
                sheetName='Machines'
                title='Machines Inventory'
              />
              {user?.role !== 'store_manager' && (
                <>
                  <Button variant='outline' size='sm' onClick={downloadTemplate} className='gap-2'>
                    <Download className='h-4 w-4' />
                    Template
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={customers.length === 0 ? 0 : -1} className={customers.length === 0 ? 'cursor-not-allowed' : ''}>
                        <Button variant='outline' size='sm' onClick={() => setImportOpen(true)} className='gap-2' disabled={customers.length === 0}>
                          <Upload className='h-4 w-4' />
                          Import
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {customers.length === 0 && <TooltipContent>Add at least one customer before importing machines.</TooltipContent>}
                  </Tooltip>
                  <Button size='sm' onClick={openNewDialog} className='gap-2'>
                    <Plus className='h-4 w-4' />
                    Add Machine
                  </Button>
                </>
              )}
            </>
          }
        />

        {/* Stats bar */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children'>
          {/* Total machines */}
          <Card className='animate-card-enter border-t-4 border-t-primary/60 bg-linear-to-br from-primary/8 via-background to-background'>
            <CardContent className='pt-4 sm:pt-5 px-3 sm:px-6 flex items-center gap-3'>
              <div className='rounded-lg bg-primary/10 p-2.5'>
                <Wrench className='h-4 w-4 text-primary' />
              </div>
              <div className='min-w-0'>
                <p className='text-2xl font-bold'>{machines.length}</p>
                <p className='text-xs text-muted-foreground'>Total Machines</p>
              </div>
            </CardContent>
          </Card>

          {/* Distinct types in use */}
          <Card className='animate-card-enter border-t-4 border-t-purple-500/60 bg-linear-to-br from-purple-500/8 via-background to-background'>
            <CardContent className='pt-4 sm:pt-5 px-3 sm:px-6 flex items-center gap-3'>
              <div className='rounded-lg bg-purple-500/10 p-2.5'>
                <LayoutGrid className='h-4 w-4 text-purple-600' />
              </div>
              <div className='min-w-0'>
                <p className='text-2xl font-bold text-purple-700 dark:text-purple-400'>{uniqueTypeCount}</p>
                <p className='text-xs text-muted-foreground'>Types In Use</p>
              </div>
            </CardContent>
          </Card>

          {/* Most common type */}
          <Card className='animate-card-enter border-t-4 border-t-amber-500/60 bg-linear-to-br from-amber-500/8 via-background to-background'>
            <CardContent className='pt-4 sm:pt-5 px-3 sm:px-6 flex items-center gap-3'>
              <div className='rounded-lg bg-amber-500/10 p-2.5 shrink-0'>
                <Wrench className='h-4 w-4 text-amber-600' />
              </div>
              <div className='min-w-0'>
                <p className='text-2xl font-bold text-amber-700 dark:text-amber-400'>{topType ? topType[1] : 0}</p>
                <p className='text-xs text-muted-foreground truncate' title={topType ? topType[0] : undefined}>
                  {topType ? topType[0] : 'Top Type'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Customers with machines */}
          <Card className='animate-card-enter border-t-4 border-t-teal-500/60 bg-linear-to-br from-teal-500/8 via-background to-background'>
            <CardContent className='pt-4 sm:pt-5 px-3 sm:px-6 flex items-center gap-3'>
              <div className='rounded-lg bg-teal-500/10 p-2.5'>
                <Users className='h-4 w-4 text-teal-600' />
              </div>
              <div className='min-w-0'>
                <p className='text-2xl font-bold text-teal-700 dark:text-teal-400'>{uniqueCustomerCount}</p>
                <p className='text-xs text-muted-foreground'>Customers Served</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='space-y-4 animate-fade-in stagger-4'>
          <div className='flex flex-wrap justify-between items-center gap-3'>
            <Input placeholder='Search machines...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-sm' />
          </div>

          <MachineFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editingMachine={editingMachine} customers={customers} machineTypes={machineTypes} parts={parts} onSaved={reloadData} />

          <Card>
            <CardHeader className='flex flex-row items-center justify-between pb-3'>
              <CardTitle>All Machines</CardTitle>
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
                                <Wrench className='h-8 w-8 opacity-30' />
                                <p className='font-medium'>No machines yet</p>
                                <p className='text-sm'>Add your first machine or import from Excel</p>
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
        <DialogContent aria-describedby={undefined}>
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
              <div>
                <Label className='text-slate-500 flex items-center gap-1.5'>
                  <Package className='h-3.5 w-3.5' />
                  Associated Parts
                </Label>
                {(viewingMachine.associatedParts?.length ?? 0) > 0 ? (
                  <div className='flex flex-wrap gap-1.5 mt-1'>
                    {viewingMachine.associatedParts!.map((part, idx) => (
                      <span key={idx} className='inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium'>
                        {part.partName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className='text-sm text-muted-foreground mt-0.5'>No parts associated yet. Parts are added automatically when logged in work visits.</p>
                )}
              </div>
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

      <BulkUploadDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityName='Machines'
        previewColumns={[
          { key: 'serialNumber', label: 'Serial Number', required: true },
          { key: 'type', label: 'Machine Type' },
          { key: 'customerName', label: 'Customer Name' },
          { key: 'location', label: 'Location' },
          { key: 'notes', label: 'Notes' },
        ]}
        onDownloadTemplate={downloadTemplate}
        parseFile={parseMachinesFile}
        validateRow={(row) => {
          const errors: Record<string, string> = {};
          if (!String(row.serialNumber ?? '').trim()) errors.serialNumber = 'Serial number is required';
          if (!String(row.type ?? '').trim()) errors.type = 'Machine type is required';
          const name = String(row.customerName ?? '').trim();
          if (!name) {
            errors.customerName = 'Customer name is required';
          } else {
            const match = customers.find((c) => c.companyName.toLowerCase() === name.toLowerCase());
            if (!match) errors.customerName = `"${name}" does not match any customer — fix the name or add the customer first`;
          }
          return errors;
        }}
        processChunk={async (rows) => {
          const result = await bulkCreateMachines(rows as unknown as BulkMachineRow[]);
          const allErrors = result.success ? result.errors : [...result.errors, result.error ?? 'Import failed'];
          return { created: result.created, skipped: result.skipped, errors: allErrors };
        }}
        onComplete={() => reloadData()}
      />
    </DashboardLayout>
  );
}
