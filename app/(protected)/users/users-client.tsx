'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { showToast } from '@/lib/toast';
import { UserRole } from '@/lib/types';
import { createUserAction, deleteUserAction, listUsersAction, setUserDisabledAction, updateUserAction, updateUserPasswordAction, UserRecordSummary } from '@/lib/actions/users';
import { auth } from '@/lib/firebase/client';
import { sendPasswordResetEmail } from 'firebase/auth';
import { MoreVertical, Edit2, Lock, RotateCw, CheckCircle, XCircle } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/lib/hooks/useDebounce';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'call_admin', label: 'Call Administrator' },
  { value: 'management', label: 'Management' },
  { value: 'technician', label: 'Technician' },
];

const formatDate = (value?: number) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const formatDateTime = (value?: number) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

export default function UsersClient() {
  const [users, setUsers] = useState<UserRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecordSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'delete' | 'toggle';
    user: UserRecordSummary | null;
  }>({
    open: false,
    action: 'delete',
    user: null,
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'technician' as UserRole,
    password: '',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'technician' as UserRole,
    internalPayRate: '',
    chargeoutRate: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirm: '',
  });

  const loadUsers = async () => {
    setLoading(true);
    const result = await listUsersAction();
    if (result.success) {
      setUsers(result.users);
    } else {
      showToast.error('Failed to load users', result.error || 'Unknown error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Memoized form update handlers to prevent re-renders
  const updateFormField = useCallback((field: keyof typeof formData) => {
    return (value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    };
  }, []);

  const updateFormName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  }, []);

  const updateFormEmail = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, email: e.target.value }));
  }, []);

  const updateFormPassword = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, password: e.target.value }));
  }, []);

  const updateFormRole = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, role: value as UserRole }));
  }, []);

  const columns = useMemo<ColumnDef<UserRecordSummary>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => <div className='font-medium text-slate-900 dark:text-white'>{row.original.name || '—'}</div>,
      },
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => <span className='capitalize'>{row.original.role.replace('_', ' ')}</span>,
      },
      {
        accessorKey: 'disabled',
        header: 'Status',
        cell: ({ row }) => <Badge variant={row.original.disabled ? 'destructive' : 'secondary'}>{row.original.disabled ? 'Disabled' : 'Active'}</Badge>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: 'lastSignInTime',
        header: 'Last Sign-in',
        cell: ({ row }) => formatDateTime(row.original.lastSignInTime),
      },
    ],
    [],
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !normalizedSearch || user.name?.toLowerCase().includes(normalizedSearch) || user.email?.toLowerCase().includes(normalizedSearch);

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;

      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && !user.disabled) || (statusFilter === 'disabled' && user.disabled);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, roleFilter, debouncedSearchTerm, statusFilter]);

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!formData.name || !formData.email || !formData.password) {
      showToast.error('Missing fields', 'Name, email, and password are required');
      setSubmitting(false);
      return;
    }

    const result = await createUserAction(formData);
    if (result.success) {
      showToast.success('User created', 'New user account created successfully');
      setDialogOpen(false);
      setFormData({ name: '', email: '', role: 'technician', password: '' });
      await loadUsers();
    } else {
      showToast.error('Create failed', result.error || 'Unable to create user');
    }

    setSubmitting(false);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const internalPayRateValue = editFormData.internalPayRate.trim();
    const chargeoutRateValue = editFormData.chargeoutRate.trim();
    const internalPayRate = internalPayRateValue === '' ? undefined : Number(internalPayRateValue);
    const chargeoutRate = chargeoutRateValue === '' ? undefined : Number(chargeoutRateValue);

    if (internalPayRate !== undefined && (Number.isNaN(internalPayRate) || internalPayRate < 0)) {
      showToast.error('Invalid pay rate', 'Internal pay rate must be a non-negative number');
      return;
    }
    if (chargeoutRate !== undefined && (Number.isNaN(chargeoutRate) || chargeoutRate < 0)) {
      showToast.error('Invalid chargeout rate', 'Chargeout rate must be a non-negative number');
      return;
    }

    setSubmitting(true);
    const result = await updateUserAction(selectedUser.uid, {
      name: editFormData.name,
      email: editFormData.email,
      role: editFormData.role,
      internalPayRate,
      chargeoutRate,
    });
    if (result.success) {
      showToast.success('User updated', 'User details saved successfully');
      setEditDialogOpen(false);
      await loadUsers();
    } else {
      showToast.error('Update failed', result.error || 'Unable to update user');
    }
    setSubmitting(false);
  };

  const handleDisableToggle = async (user: UserRecordSummary) => {
    const result = await setUserDisabledAction(user.uid, !user.disabled);
    if (result.success) {
      showToast.success('Status updated', user.disabled ? 'User enabled' : 'User disabled');
      await loadUsers();
    } else {
      showToast.error('Update failed', result.error || 'Unable to update status');
    }
  };

  const handleDeleteUser = async (user: UserRecordSummary) => {
    const result = await deleteUserAction(user.uid);
    if (result.success) {
      showToast.success('User deleted', 'User removed successfully');
      await loadUsers();
    } else {
      showToast.error('Delete failed', result.error || 'Unable to delete user');
    }
  };

  const handleResetPassword = async (user: UserRecordSummary) => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast.success('Reset email sent', `Password reset sent to ${user.email}`);
    } catch (error: any) {
      showToast.error('Reset failed', error.message || 'Unable to send reset email');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!passwordForm.password || passwordForm.password.length < 6) {
      showToast.error('Invalid password', 'Password must be at least 6 characters');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      showToast.error('Passwords do not match', 'Please confirm the password');
      return;
    }

    setPasswordSubmitting(true);
    const result = await updateUserPasswordAction(selectedUser.uid, passwordForm.password);
    if (result.success) {
      showToast.success('Password updated', 'The user password has been changed');
      setPasswordDialogOpen(false);
      setPasswordForm({ password: '', confirm: '' });
    } else {
      showToast.error('Update failed', result.error || 'Unable to update password');
    }
    setPasswordSubmitting(false);
  };

  const openEditDialog = (user: UserRecordSummary) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      internalPayRate: user.internalPayRate !== undefined ? String(user.internalPayRate) : '',
      chargeoutRate: user.chargeoutRate !== undefined ? String(user.chargeoutRate) : '',
    });
    setEditDialogOpen(true);
  };

  const openPasswordDialog = (user: UserRecordSummary) => {
    setSelectedUser(user);
    setPasswordForm({ password: '', confirm: '' });
    setPasswordDialogOpen(true);
  };

  const openConfirmDialog = (action: 'delete' | 'toggle', user: UserRecordSummary) => {
    setConfirmDialog({
      open: true,
      action,
      user,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.user) return;

    if (confirmDialog.action === 'delete') {
      await handleDeleteUser(confirmDialog.user);
    } else {
      await handleDisableToggle(confirmDialog.user);
    }

    setConfirmDialog({ open: false, action: 'delete', user: null });
  };

  const confirmTitle = confirmDialog.action === 'delete' ? 'Delete user' : confirmDialog.user?.disabled ? 'Enable user' : 'Disable user';

  const confirmDescription =
    confirmDialog.action === 'delete'
      ? 'This will permanently remove the account and cannot be undone.'
      : confirmDialog.user?.disabled
        ? 'This will allow the user to sign in again.'
        : 'This will block the user from signing in until re-enabled.';

  const confirmActionLabel = confirmDialog.action === 'delete' ? 'Delete' : confirmDialog.user?.disabled ? 'Enable' : 'Disable';

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-slate-600 dark:text-slate-400'>Manage user access, roles, and credentials</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create User</Button>
            </DialogTrigger>
            <DialogContent className='max-w-lg'>
              <DialogHeader>
                <DialogTitle>Create User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='name'>Full Name</Label>
                  <Input id='name' value={formData.name} onChange={updateFormName} disabled={submitting} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input id='email' type='email' value={formData.email} onChange={updateFormEmail} disabled={submitting} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='role'>Role</Label>
                  <Select value={formData.role} onValueChange={updateFormRole}>
                    <SelectTrigger id='role'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='password'>Temporary Password</Label>
                  <Input id='password' type='password' value={formData.password} onChange={updateFormPassword} disabled={submitting} />
                </div>
                <div className='flex justify-end gap-2'>
                  <Button type='button' variant='outline' onClick={() => setDialogOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type='submit' disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <div className='flex flex-1 flex-col gap-3 sm:flex-row'>
            <Input placeholder='Search by name or email...' value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className='sm:max-w-xs' />
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | 'all')}>
              <SelectTrigger className='sm:w-52'>
                <SelectValue placeholder='Filter by role' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Roles</SelectItem>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'disabled')}>
              <SelectTrigger className='sm:w-48'>
                <SelectValue placeholder='Filter by status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Statuses</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='disabled'>Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='text-sm text-slate-500 dark:text-slate-400'>
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        <div className='rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                  ))}
                  <TableHead>Actions</TableHead>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: table.getAllColumns().length + 1 }).map((_, cellIdx) => (
                        <TableCell key={cellIdx}>
                          <Skeleton className='h-6 w-full' />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                            <MoreVertical className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem onClick={() => openEditDialog(row.original)}>
                            <Edit2 className='h-4 w-4 mr-2' />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPasswordDialog(row.original)}>
                            <Lock className='h-4 w-4 mr-2' />
                            Change Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetPassword(row.original)}>
                            <RotateCw className='h-4 w-4 mr-2' />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openConfirmDialog('toggle', row.original)}>
                            {row.original.disabled ? (
                              <>
                                <CheckCircle className='h-4 w-4 mr-2' />
                                Enable
                              </>
                            ) : (
                              <>
                                <XCircle className='h-4 w-4 mr-2' />
                                Disable
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getAllColumns().length + 1} className='text-center text-slate-500'>
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='edit-name'>Full Name</Label>
              <Input id='edit-name' value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-email'>Email</Label>
              <Input id='edit-email' type='email' value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-role'>Role</Label>
              <Select value={editFormData.role} onValueChange={(value) => setEditFormData({ ...editFormData, role: value as UserRole })}>
                <SelectTrigger id='edit-role'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-internal-pay-rate'>Internal Pay Rate</Label>
              <Input
                id='edit-internal-pay-rate'
                type='number'
                min='0'
                step='0.01'
                inputMode='decimal'
                placeholder='0.00'
                value={editFormData.internalPayRate}
                onChange={(e) => setEditFormData({ ...editFormData, internalPayRate: e.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-chargeout-rate'>Chargeout Rate</Label>
              <Input
                id='edit-chargeout-rate'
                type='number'
                min='0'
                step='0.01'
                inputMode='decimal'
                placeholder='0.00'
                value={editFormData.chargeoutRate}
                onChange={(e) => setEditFormData({ ...editFormData, chargeoutRate: e.target.value })}
              />
            </div>
            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='new-password'>New Password</Label>
              <Input id='new-password' type='password' value={passwordForm.password} onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='confirm-password'>Confirm Password</Label>
              <Input id='confirm-password' type='password' value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />
            </div>
            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => setPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={passwordSubmitting}>
                {passwordSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <p className='text-sm text-slate-600 dark:text-slate-400'>{confirmDescription}</p>
            {confirmDialog.user && (
              <div className='rounded-md border border-slate-200 dark:border-slate-700 p-3 text-sm'>
                <div className='font-medium text-slate-900 dark:text-white'>{confirmDialog.user.name || 'Unnamed user'}</div>
                <div className='text-slate-500 dark:text-slate-400'>{confirmDialog.user.email}</div>
              </div>
            )}
            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => setConfirmDialog({ open: false, action: 'delete', user: null })}>
                Cancel
              </Button>
              <Button type='button' variant={confirmDialog.action === 'delete' ? 'destructive' : 'default'} onClick={handleConfirmAction}>
                {confirmActionLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
