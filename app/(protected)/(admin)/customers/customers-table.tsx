'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
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
import { Edit2, Trash2, Plus, ArrowUpDown, Check, X, Upload, Download, Building2, UserCheck, UserX } from 'lucide-react';
import { createCustomer, updateCustomer, deleteCustomer, toggleCustomerDisabled, bulkCreateCustomers, type BulkCustomerRow } from '@/lib/actions/customers';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { BulkUploadDialog, type ParsedRow } from '@/components/bulk-upload-dialog';
import { ExportButton } from '@/components/export-button';

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

// ── CustomerFormDialog ─────────────────────────────────────────────────────
// Isolated component so form keystrokes don't re-render the entire table.
function CustomerFormDialog({
  open,
  onOpenChange,
  editingCustomer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingCustomer: Customer | null;
  onSaved: (customer: Customer) => void;
}) {
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Reset / populate form whenever the dialog opens or the target customer changes
  useEffect(() => {
    if (open) {
      setFormData(
        editingCustomer
          ? {
              companyName: editingCustomer.companyName,
              contactPerson: editingCustomer.contactPerson,
              phone: editingCustomer.phone,
              email: editingCustomer.email,
              address: editingCustomer.address,
            }
          : { companyName: '', contactPerson: '', phone: '', email: '', address: '' },
      );
    }
  }, [open, editingCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCustomer) {
        const result = await updateCustomer(editingCustomer.id, formData);
        if (result.success) {
          showToast.success('Customer updated successfully');
          onSaved({ ...editingCustomer, ...formData, updatedAt: new Date() });
          onOpenChange(false);
        } else {
          showToast.error(result.error || 'Failed to update customer');
        }
      } else {
        const result = await createCustomer(formData);
        if (result.success) {
          showToast.success('Customer created successfully');
          onSaved({ id: result.customerId!, ...formData, isDisabled: false, createdAt: new Date(), updatedAt: new Date() });
          onOpenChange(false);
        } else {
          showToast.error(result.error || 'Failed to create customer');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='companyName'>Company Name *</Label>
            <Input id='companyName' value={formData.companyName} onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))} required />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='contactPerson'>Contact Person *</Label>
            <Input id='contactPerson' value={formData.contactPerson} onChange={(e) => setFormData((p) => ({ ...p, contactPerson: e.target.value }))} required />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='phone'>Phone * (minimum 10 digits)</Label>
            <Input id='phone' type='tel' placeholder='e.g., 555-123-4567' value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} required minLength={10} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='email'>Email *</Label>
            <Input id='email' type='email' value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} required />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='address'>Address *</Label>
            <Input id='address' placeholder='Enter full address' value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} required />
          </div>
          <div className='flex gap-3'>
            <Button type='submit' disabled={submitting}>
              {submitting ? 'Saving...' : editingCustomer ? 'Update' : 'Create'}
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

// ── CustomersTable ──────────────────────────────────────────────────────────
export function CustomersTable({ initialData }: CustomersTableProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Customer[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disableDialog, setDisableDialog] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Stats
  const totalCount = data.length;
  const activeCount = data.filter((c) => !c.isDisabled).length;
  const disabledCount = data.filter((c) => c.isDisabled).length;

  // Bulk upload helpers
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Company Name', 'Contact Person', 'Phone', 'Email', 'Address'],
      ['Acme Coffee Ltd', 'Jane Smith', '868-555-1234', 'jane@acmecoffee.com', '10 Main St, Port of Spain'],
    ]);
    ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 36 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'customers-upload-template.xlsx');
  };

  const parseCustomersFile = (buffer: ArrayBuffer): { rows: ParsedRow[]; parseError?: string } => {
    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      const rows: ParsedRow[] = raw
        .map((r) => ({
          companyName: String(r['Company Name'] ?? r['companyName'] ?? r['Company'] ?? '').trim(),
          contactPerson: String(r['Contact Person'] ?? r['contactPerson'] ?? r['Contact'] ?? '').trim(),
          phone: String(r['Phone'] ?? r['phone'] ?? '').trim(),
          email: String(r['Email'] ?? r['email'] ?? '').trim(),
          address: String(r['Address'] ?? r['address'] ?? '').trim(),
        }))
        .filter((r) => r.companyName);
      if (rows.length === 0) return { rows: [], parseError: 'No valid rows found. Ensure the file has a "Company Name" column.' };
      return { rows };
    } catch {
      return { rows: [], parseError: 'Failed to parse file. Use the provided template.' };
    }
  };

  // Sync local table data whenever the server component re-renders with fresh initialData
  // (e.g., after router.refresh() is called from the bulk-upload onComplete callback)
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const openNewDialog = () => {
    setEditingCustomer(null);
    setDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setDialogOpen(true);
  };

  // Called by CustomerFormDialog when a customer is created or updated
  const handleCustomerSaved = (customer: Customer) => {
    setData((prev) => {
      const idx = prev.findIndex((c) => c.id === customer.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = customer;
        return next;
      }
      return [...prev, customer];
    });
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
        // Hide actions for read-only roles
        if (user?.role === 'call_admin' || user?.role === 'store_manager') {
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
    <div className='space-y-5'>
      {/* Stats bar */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children'>
        <Card className='animate-card-enter border-t-4 border-t-primary/60 bg-linear-to-br from-primary/8 via-background to-background'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-primary/10 p-2.5'>
              <Building2 className='h-4 w-4 text-primary' />
            </div>
            <div>
              <p className='text-2xl font-bold'>{totalCount}</p>
              <p className='text-xs text-muted-foreground'>Total Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card className='animate-card-enter border-t-4 border-t-green-500/60 bg-linear-to-br from-green-500/8 via-background to-background'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-green-500/10 p-2.5'>
              <UserCheck className='h-4 w-4 text-green-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-green-700 dark:text-green-400'>{activeCount}</p>
              <p className='text-xs text-muted-foreground'>Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className='animate-card-enter border-t-4 border-t-amber-500/60 bg-linear-to-br from-amber-500/8 via-background to-background'>
          <CardContent className='pt-5 flex items-center gap-3'>
            <div className='rounded-lg bg-amber-500/10 p-2.5'>
              <UserX className='h-4 w-4 text-amber-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-amber-700 dark:text-amber-400'>{disabledCount}</p>
              <p className='text-xs text-muted-foreground'>Disabled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='flex flex-wrap justify-between items-center gap-3'>
        <Input placeholder='Search customers...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-sm' />
        <div className='flex gap-2'>
          <ExportButton
            data={table.getFilteredRowModel().rows.map((r) => r.original) as unknown as Record<string, any>[]}
            columns={[
              { header: 'Company', key: 'companyName' },
              { header: 'Contact', key: 'contactPerson' },
              { header: 'Phone', key: 'phone' },
              { header: 'Email', key: 'email' },
              { header: 'Address', key: 'address' },
              { header: 'Status', key: 'isDisabled', formatter: (v) => (v ? 'Disabled' : 'Active') },
            ]}
            filename='customers-export'
            sheetName='Customers'
            title='Customers'
          />
          {user?.role !== 'call_admin' && user?.role !== 'store_manager' && (
            <>
              <Button variant='outline' onClick={downloadTemplate} className='gap-2'>
                <Download className='h-4 w-4' />
                Template
              </Button>
              <Button variant='outline' onClick={() => setImportOpen(true)} className='gap-2'>
                <Upload className='h-4 w-4' />
                Import Excel
              </Button>
              <Button onClick={openNewDialog} className='gap-2'>
                <Plus className='h-4 w-4' />
                Add Customer
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between pb-3'>
          <CardTitle>All Customers</CardTitle>
          <span className='text-sm text-muted-foreground'>
            {table.getFilteredRowModel().rows.length} result{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
          </span>
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
                    <TableCell colSpan={columns.length} className='h-36 text-center'>
                      <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                        <Building2 className='h-8 w-8 opacity-30' />
                        <p className='font-medium'>No customers yet</p>
                        <p className='text-sm'>Add your first customer or import from Excel</p>
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

      <CustomerFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editingCustomer={editingCustomer} onSaved={handleCustomerSaved} />

      <BulkUploadDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityName='Customers'
        previewColumns={[
          { key: 'companyName', label: 'Company Name', required: true },
          { key: 'contactPerson', label: 'Contact Person' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'address', label: 'Address' },
        ]}
        onDownloadTemplate={downloadTemplate}
        parseFile={parseCustomersFile}
        validateRow={(row) => {
          const errors: Record<string, string> = {};
          const name = String(row.companyName ?? '').trim();
          if (!name || name.length < 2) errors.companyName = 'Company name must be at least 2 characters';
          const phone = String(row.phone ?? '').trim();
          if (phone && phone.replace(/\D/g, '').length < 7) errors.phone = 'Phone number must have at least 7 digits';
          const email = String(row.email ?? '').trim();
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email address';
          return errors;
        }}
        processChunk={async (rows) => {
          const result = await bulkCreateCustomers(rows as unknown as BulkCustomerRow[]);
          const allErrors = result.success ? result.errors : [...result.errors, result.error ?? 'Import failed'];
          return { created: result.created, skipped: result.skipped, errors: allErrors };
        }}
        onComplete={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
