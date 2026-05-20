'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { MoreVertical, Edit2, Lock, RotateCw, CheckCircle, XCircle, Mail, Copy, RefreshCw, Clock, X, Download, Users, Search, Share2 } from 'lucide-react';
import { inviteUserAction, cancelInvitationAction, resendInvitationAction, listInvitationsAction, InvitationSummary } from '@/lib/actions/invitations';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { ExportButton } from '@/components/export-button';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'store_admin', label: 'Store Admin' },
  { value: 'store_manager', label: 'Store Manager' },
  { value: 'call_admin', label: 'Call Administrator' },
  { value: 'technician', label: 'Technician' },
];

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-primary/10 text-primary dark:bg-primary/20',
  manager: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  store_admin: 'bg-primary/10 text-primary dark:bg-primary/20',
  store_manager: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  call_admin: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  technician: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const formatDate = (value?: number) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const formatDateTime = (value?: number) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

// ── Isolated dialog components (local state → no parent re-render on keystroke) ─

function CreateUserDialog({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'technician' as UserRole, password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      showToast.error('Missing info', 'Please fill in the name, email, and password before creating the user');
      return;
    }
    setSubmitting(true);
    const result = await createUserAction(form);
    if (result.success) {
      showToast.success('Account created', "They're all set and ready to log in");
      setOpen(false);
      setForm({ name: '', email: '', role: 'technician', password: '' });
      await onSuccess();
    } else {
      showToast.error("Couldn't create account", result.error || 'Something went wrong — please try again');
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create User</Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='cu-name'>Full Name</Label>
            <Input id='cu-name' value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} disabled={submitting} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='cu-email'>Email</Label>
            <Input id='cu-email' type='email' value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={submitting} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='cu-role'>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v as UserRole }))}>
              <SelectTrigger id='cu-role'>
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
            <Label htmlFor='cu-password'>Temporary Password</Label>
            <Input id='cu-password' type='password' value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} disabled={submitting} />
          </div>
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='outline' onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type='submit' disabled={submitting}>
              {submitting ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteUserDialog({ onSuccess }: { onSuccess: (joinUrl: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'technician' as 'store_admin' | 'store_manager' | 'call_admin' | 'technician' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    const result = await inviteUserAction({ name: form.name, email: form.email, role: form.role });
    if (result.success && result.joinUrl) {
      const name = form.name;
      setOpen(false);
      setForm({ name: '', email: '', role: 'technician' as 'store_admin' | 'store_manager' | 'call_admin' | 'technician' });
      if (!result.emailSent) {
        showToast.warning('Invite created — email not sent', 'The invitation link was generated but the email could not be delivered. Share the link below manually.');
      }
      onSuccess(result.joinUrl, name);
    } else {
      showToast.error("Couldn't send invite", result.error || 'Something went wrong — please try again');
    }
    setInviting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline'>
          <Mail className='h-4 w-4 mr-2' />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>
        <p className='text-sm text-muted-foreground -mt-2'>An invitation link will be generated for you to share with the user.</p>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='inv-name'>Full Name</Label>
            <Input id='inv-name' value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="User's full name" disabled={inviting} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='inv-email'>Email</Label>
            <Input id='inv-email' type='email' value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder='user@example.com' disabled={inviting} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='inv-role'>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v as 'store_admin' | 'store_manager' | 'call_admin' | 'technician' }))}>
              <SelectTrigger id='inv-role'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='store_admin'>Store Admin</SelectItem>
                <SelectItem value='store_manager'>Store Manager</SelectItem>
                <SelectItem value='call_admin'>Call Administrator</SelectItem>
                <SelectItem value='technician'>Technician</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='outline' onClick={() => setOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button type='submit' disabled={inviting}>
              {inviting ? 'Sending...' : 'Generate Invite Link'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersClient() {
  const [users, setUsers] = useState<UserRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
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

  // ── Invitation state ──────────────────────────────────────────────────────────
  const [invitations, setInvitations] = useState<InvitationSummary[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [joinLinkDialog, setJoinLinkDialog] = useState<{ open: boolean; url: string; name: string }>({ open: false, url: '', name: '' });
  const [linkCopied, setLinkCopied] = useState(false);

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

  const loadInvitations = async () => {
    setInvitationsLoading(true);
    const result = await listInvitationsAction();
    if (result.success) {
      setInvitations(result.invitations.filter((i) => i.status === 'pending'));
    }
    setInvitationsLoading(false);
  };

  useEffect(() => {
    loadUsers();
    loadInvitations();
  }, []);

  const columns = useMemo<ColumnDef<UserRecordSummary>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
          const name = row.original.name || 'Unknown';
          const initials = row.original.name ? getInitials(row.original.name) : '?';
          return (
            <div className='flex items-center gap-3'>
              <div className='h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0'>
                <span className='text-xs font-semibold text-primary'>{initials}</span>
              </div>
              <div className='min-w-0'>
                <div className='font-medium text-foreground truncate'>{name}</div>
                <div className='text-xs text-muted-foreground truncate'>{row.original.email}</div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => {
          const role = row.original.role;
          const cls = ROLE_BADGE[role] ?? 'bg-muted text-muted-foreground';
          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>{role.replace(/_/g, ' ')}</span>;
        },
      },
      {
        accessorKey: 'disabled',
        header: 'Status',
        cell: ({ row }) =>
          row.original.disabled ? (
            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'>Disabled</span>
          ) : (
            <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'>Active</span>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => <span className='text-sm text-muted-foreground'>{formatDate(row.original.createdAt)}</span>,
      },
      {
        accessorKey: 'lastSignInTime',
        header: 'Last Sign-in',
        cell: ({ row }) => <span className='text-sm text-muted-foreground'>{formatDateTime(row.original.lastSignInTime)}</span>,
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

  const handleCopyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareLink = async (url: string, name: string) => {
    const shareData = {
      title: 'Caribbean Roasters — Invitation',
      text: `Hi ${name}, you've been invited to join the Caribbean Roasters Technician Portal. Use this link to set up your account (expires in 72 hours):`,
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user dismissed — no-op
      }
    } else {
      // Fallback: open a pre-filled mailto
      const subject = encodeURIComponent('Caribbean Roasters — Your Invitation Link');
      const body = encodeURIComponent(
        `Hi ${name},\n\nYou've been invited to join the Caribbean Roasters Technician Portal.\n\nClick the link below to set your password and complete account setup (expires in 72 hours):\n${url}\n\nIf you have any issues, contact your administrator.`,
      );
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    }
  };

  const handleResendInvitation = async (inv: InvitationSummary) => {
    const result = await resendInvitationAction(inv.id);
    if (result.success && result.joinUrl) {
      if (!result.emailSent) {
        showToast.warning('Resent — email not delivered', 'The invitation was renewed but the email could not be sent. Share the link below manually.');
      } else {
        showToast.success('Invitation resent', `A new invite email has been sent to ${inv.email}`);
      }
      setJoinLinkDialog({ open: true, url: result.joinUrl, name: inv.name });
      await loadInvitations();
    } else {
      showToast.error('Resend failed', result.error || 'Something went wrong — please try again');
    }
  };

  const handleCancelInvitation = async (invId: string) => {
    const result = await cancelInvitationAction(invId);
    if (result.success) {
      showToast.success('Invite cancelled', 'The invite link has been deactivated');
      await loadInvitations();
    } else {
      showToast.error("Couldn't cancel", result.error || 'Please try again');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const internalPayRateValue = editFormData.internalPayRate.trim();
    const chargeoutRateValue = editFormData.chargeoutRate.trim();
    const internalPayRate = internalPayRateValue === '' ? undefined : Number(internalPayRateValue);
    const chargeoutRate = chargeoutRateValue === '' ? undefined : Number(chargeoutRateValue);

    if (internalPayRate !== undefined && (Number.isNaN(internalPayRate) || internalPayRate < 0)) {
      showToast.error('Invalid pay rate', 'Enter a valid number — 0 or more');
      return;
    }
    if (chargeoutRate !== undefined && (Number.isNaN(chargeoutRate) || chargeoutRate < 0)) {
      showToast.error('Invalid chargeout rate', 'Enter a valid number — 0 or more');
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
      showToast.success('Changes saved', 'User profile has been updated');
      setEditDialogOpen(false);
      await loadUsers();
    } else {
      showToast.error("Couldn't save changes", result.error || 'Something went wrong — please try again');
    }
    setSubmitting(false);
  };

  const handleDisableToggle = async (user: UserRecordSummary) => {
    const result = await setUserDisabledAction(user.uid, !user.disabled);
    if (result.success) {
      showToast.success(user.disabled ? 'User disabled' : 'User enabled', user.disabled ? 'Their access has been revoked' : 'They can log in again now');
      await loadUsers();
    } else {
      showToast.error("Couldn't update status", result.error || 'Something went wrong');
    }
  };

  const handleDeleteUser = async (user: UserRecordSummary) => {
    const result = await deleteUserAction(user.uid);
    if (result.success) {
      showToast.success('User removed', 'Their account has been permanently deleted');
      await loadUsers();
    } else {
      showToast.error("Couldn't delete user", result.error || 'Something went wrong');
    }
  };

  const handleResetPassword = async (user: UserRecordSummary) => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast.success('Reset email sent', `Check ${user.email} for the reset link`);
    } catch (error: any) {
      showToast.error("Couldn't send reset email", error.message || 'Something went wrong');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!passwordForm.password || passwordForm.password.length < 6) {
      showToast.error('Password too short', 'It needs to be at least 6 characters');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      showToast.error("Passwords don't match", 'Double-check that both fields are the same');
      return;
    }

    setPasswordSubmitting(true);
    const result = await updateUserPasswordAction(selectedUser.uid, passwordForm.password);
    if (result.success) {
      showToast.success('Password updated', 'Their new password is now active');
      setPasswordDialogOpen(false);
      setPasswordForm({ password: '', confirm: '' });
    } else {
      showToast.error("Couldn't update password", result.error || 'Something went wrong — please try again');
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
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <div className='flex items-center gap-2 mb-1'>
              <Users className='h-5 w-5 text-primary' />
              <h1 className='text-2xl font-bold tracking-tight'>Users</h1>
            </div>
            <p className='text-muted-foreground text-sm'>Manage user access, roles, and credentials</p>
          </div>
          <div className='flex gap-2'>
            <ExportButton
              data={filteredUsers as unknown as Record<string, any>[]}
              columns={[
                { header: 'Name', key: 'name' },
                { header: 'Email', key: 'email' },
                { header: 'Role', key: 'role' },
                { header: 'Store', key: 'storeName', formatter: (v) => v ?? 'HQ' },
                { header: 'Status', key: 'disabled', formatter: (v) => (v ? 'Disabled' : 'Active') },
              ]}
              filename='users-export'
              sheetName='Users'
              title='Users'
            />
            <InviteUserDialog
              onSuccess={(url, name) => {
                setJoinLinkDialog({ open: true, url, name });
                loadInvitations();
              }}
            />
            <CreateUserDialog onSuccess={loadUsers} />
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────────── */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
          <div className='animate-card-enter rounded-xl bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 p-4'>
            <p className='text-xs font-semibold text-primary/70 uppercase tracking-wide mb-2'>Total Users</p>
            {loading ? <div className='h-8 w-12 bg-primary/10 rounded animate-pulse' /> : <p className='text-3xl font-bold text-primary'>{users.length}</p>}
          </div>
          <div className='animate-card-enter rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-4'>
            <p className='text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2'>Active</p>
            {loading ? (
              <div className='h-8 w-12 bg-emerald-500/10 rounded animate-pulse' />
            ) : (
              <p className='text-3xl font-bold text-emerald-600 dark:text-emerald-400'>{users.filter((u) => !u.disabled).length}</p>
            )}
          </div>
          <div className='animate-card-enter rounded-xl bg-linear-to-br from-red-500/10 to-red-500/5 border border-red-500/20 p-4'>
            <p className='text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2'>Disabled</p>
            {loading ? <div className='h-8 w-12 bg-red-500/10 rounded animate-pulse' /> : <p className='text-3xl font-bold text-red-600 dark:text-red-400'>{users.filter((u) => u.disabled).length}</p>}
          </div>
          <div className='animate-card-enter rounded-xl bg-linear-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-4'>
            <p className='text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2'>Pending Invites</p>
            {invitationsLoading ? <div className='h-8 w-12 bg-amber-500/10 rounded animate-pulse' /> : <p className='text-3xl font-bold text-amber-600 dark:text-amber-400'>{invitations.length}</p>}
          </div>
        </div>

        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <div className='flex flex-1 flex-col gap-3 sm:flex-row'>
            <div className='relative sm:max-w-xs w-full'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
              <Input placeholder='Search by name or email...' value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className='pl-9' />
            </div>
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
          <div className='text-sm text-muted-foreground'>
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        <div className='rounded-xl border border-border bg-card overflow-hidden shadow-sm'>
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
                  <TableCell colSpan={table.getAllColumns().length + 1} className='text-center text-muted-foreground'>
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Pending Invitations ────────────────────────────────────────────── */}
        <div className='rounded-xl border border-border bg-card overflow-hidden shadow-sm'>
          <div className='px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30'>
            <div className='flex items-center gap-2'>
              <Mail className='h-4 w-4 text-primary' />
              <h3 className='font-semibold text-sm'>Pending Invitations</h3>
              {invitations.length > 0 && (
                <span className='text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 font-semibold'>{invitations.length}</span>
              )}
            </div>
          </div>
          {invitationsLoading ? (
            <div className='px-4 py-6 text-center text-sm text-muted-foreground'>Loading invitations...</div>
          ) : invitations.length === 0 ? (
            <div className='px-4 py-6 text-center text-sm text-muted-foreground'>No pending invitations</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className='w-28'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => {
                  const expiresIn = Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / (1000 * 60 * 60)));
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className='font-medium'>{inv.name}</TableCell>
                      <TableCell className='text-muted-foreground'>{inv.email}</TableCell>
                      <TableCell>
                        <span className='capitalize text-sm'>{inv.role.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`flex items-center gap-1 text-sm font-medium ${expiresIn <= 12 ? 'text-red-600 dark:text-red-400' : expiresIn <= 24 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
                        >
                          <Clock className='h-3.5 w-3.5' />
                          {expiresIn}h left
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <Button size='sm' variant='ghost' className='h-7 w-7 p-0' title='Resend invitation' onClick={() => handleResendInvitation(inv)}>
                            <RefreshCw className='h-3.5 w-3.5' />
                          </Button>
                          <Button size='sm' variant='ghost' className='h-7 w-7 p-0 text-destructive hover:text-destructive' title='Cancel invitation' onClick={() => handleCancelInvitation(inv.id)}>
                            <X className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='max-w-lg' aria-describedby={undefined}>
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
        <DialogContent className='max-w-lg' aria-describedby={undefined}>
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
        <DialogContent className='max-w-md' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>{confirmDescription}</p>
            {confirmDialog.user && (
              <div className='rounded-md border border-slate-200 dark:border-slate-700 p-3 text-sm'>
                <div className='font-medium text-foreground'>{confirmDialog.user.name || 'Unnamed user'}</div>
                <div className='text-muted-foreground'>{confirmDialog.user.email}</div>
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

      {/* ── Join Link Dialog ─────────────────────────────────────────────── */}
      <Dialog open={joinLinkDialog.open} onOpenChange={(open) => setJoinLinkDialog((p) => ({ ...p, open }))}>
        <DialogContent className='max-w-md' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Invitation link ready</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              Share this link with <span className='font-medium text-foreground'>{joinLinkDialog.name}</span>. It expires in 72 hours and can only be used once.
            </p>
            <div className='flex items-center gap-2'>
              <Input value={joinLinkDialog.url} readOnly className='font-mono text-xs' />
              <Button size='sm' variant='outline' onClick={() => handleCopyLink(joinLinkDialog.url)} className='shrink-0'>
                {linkCopied ? <CheckCircle className='h-4 w-4 text-green-600' /> : <Copy className='h-4 w-4' />}
              </Button>
              <Button size='sm' variant='outline' onClick={() => handleShareLink(joinLinkDialog.url, joinLinkDialog.name)} className='shrink-0'>
                <Share2 className='h-4 w-4' />
              </Button>
            </div>
            <p className='text-xs text-muted-foreground'>The invitation is listed under Pending Invitations and can be resent if needed.</p>
            <div className='flex justify-end'>
              <Button onClick={() => setJoinLinkDialog((p) => ({ ...p, open: false }))}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
