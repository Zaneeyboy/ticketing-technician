'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { setUserDisabledAction, exportUsersCSVAction } from '@/lib/actions/users';
import { inviteUserAction, cancelInvitationAction, resendInvitationAction, InvitationSummary } from '@/lib/actions/invitations';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UserRecordSummary } from '@/lib/actions/users';
import type { Store } from '@/lib/types';
import { Search, Mail, Copy, RefreshCw, X, Clock, CheckCircle, Download } from 'lucide-react';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  store_admin: 'Store Admin',
  store_manager: 'Store Manager',
  call_admin: 'Call Admin',
  technician: 'Technician',
};

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  super_admin: 'default',
  manager: 'default',
  store_admin: 'secondary',
  store_manager: 'secondary',
  call_admin: 'outline',
  technician: 'outline',
};

const INVITABLE_ROLES = [
  { value: 'store_admin', label: 'Store Admin' },
  { value: 'store_manager', label: 'Store Manager' },
  { value: 'call_admin', label: 'Call Admin' },
  { value: 'technician', label: 'Technician' },
  { value: 'manager', label: 'Manager (HQ)' },
] as const;

type InvitableRole = 'store_admin' | 'store_manager' | 'call_admin' | 'technician' | 'manager';
const STORE_SCOPED_ROLES: InvitableRole[] = ['store_admin', 'store_manager', 'call_admin', 'technician'];

interface HQUsersTableProps {
  users: UserRecordSummary[];
  currentUserId: string;
  currentUserRole: string;
  pendingInvitations: InvitationSummary[];
  stores: Store[];
}

export default function HQUsersTable({ users, currentUserId, currentUserRole, pendingInvitations: initialInvitations, stores }: HQUsersTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [loadingUid, setLoadingUid] = useState<string | null>(null);

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; role: InvitableRole; storeId: string }>({
    name: '',
    email: '',
    role: 'technician',
    storeId: '',
  });
  const [joinLinkDialog, setJoinLinkDialog] = useState<{ open: boolean; url: string; name: string }>({ open: false, url: '', name: '' });
  const [linkCopied, setLinkCopied] = useState(false);
  const [invitations, setInvitations] = useState<InvitationSummary[]>(initialInvitations);

  const isSuperAdmin = currentUserRole === 'super_admin';
  const needsStore = STORE_SCOPED_ROLES.includes(inviteForm.role);

  const handleExportCSV = async () => {
    const result = await exportUsersCSVAction();
    if (!result.success || !result.csv) {
      showToast.error("Couldn't export users", result.error);
      return;
    }
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast.success('Exported', 'User list downloaded as CSV');
  };

  // Derive unique stores for filter
  const filterStores = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.storeId && u.storeName) map.set(u.storeId, u.storeName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (storeFilter !== 'all' && u.storeId !== storeFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, search, roleFilter, storeFilter]);

  const handleToggleDisabled = async (user: UserRecordSummary) => {
    if (user.uid === currentUserId) {
      showToast.error("You can't lock yourself out", 'To disable this account, ask another admin');
      return;
    }
    setLoadingUid(user.uid);
    try {
      const result = await setUserDisabledAction(user.uid, !user.disabled);
      if (result.success) {
        showToast.success(user.disabled ? 'User enabled' : 'User disabled', user.disabled ? 'They can log in again now' : 'Their access has been revoked');
        router.refresh();
      } else showToast.error("Couldn't update user", result.error);
    } finally {
      setLoadingUid(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    const result = await inviteUserAction({
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role,
      storeId: needsStore ? inviteForm.storeId || null : null,
    });
    if (result.success && result.joinUrl) {
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'technician', storeId: '' });
      setJoinLinkDialog({ open: true, url: result.joinUrl, name: inviteForm.name });
      // Optimistically add to invitations list (router.refresh() will get the real data)
      router.refresh();
    } else {
      showToast.error("Couldn't send invite", result.error || 'Something went wrong — please try again');
    }
    setInviting(false);
  };

  const handleCopyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleResend = async (inv: InvitationSummary) => {
    const result = await resendInvitationAction(inv.id);
    if (result.success && result.joinUrl) {
      setJoinLinkDialog({ open: true, url: result.joinUrl, name: inv.name });
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      router.refresh();
    } else showToast.error('Resend failed', result.error || 'Something went wrong — please try again');
  };

  const handleCancel = async (invId: string) => {
    const result = await cancelInvitationAction(invId);
    if (result.success) {
      showToast.success('Invite cancelled', 'The link has been deactivated');
      setInvitations((prev) => prev.filter((i) => i.id !== invId));
    } else showToast.error("Couldn't cancel", result.error || 'Please try again');
  };

  return (
    <div className='space-y-6'>
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className='flex flex-wrap gap-3 items-center justify-between'>
        <div className='flex flex-wrap gap-3 flex-1'>
          <div className='relative flex-1 min-w-48'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input placeholder='Search name or email…' value={search} onChange={(e) => setSearch(e.target.value)} className='pl-9' />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='All roles' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All roles</SelectItem>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterStores.length > 0 && (
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className='w-48'>
                <SelectValue placeholder='All stores' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All stores</SelectItem>
                {filterStores.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={handleExportCSV}>
            <Download className='h-4 w-4 mr-2' />
            Export CSV
          </Button>

          {isSuperAdmin && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Mail className='h-4 w-4 mr-2' />
                  Invite User
                </Button>
              </DialogTrigger>{' '}
              <DialogContent className='max-w-md' aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>Invite User</DialogTitle>
                </DialogHeader>
                <p className='text-sm text-muted-foreground -mt-2'>An invitation link will be generated for you to share.</p>
                <form onSubmit={handleInvite} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='hq-inv-name'>Full Name</Label>
                    <Input id='hq-inv-name' value={inviteForm.name} onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))} disabled={inviting} />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='hq-inv-email'>Email</Label>
                    <Input id='hq-inv-email' type='email' value={inviteForm.email} onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))} disabled={inviting} />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='hq-inv-role'>Role</Label>
                    <Select value={inviteForm.role} onValueChange={(v) => setInviteForm((p) => ({ ...p, role: v as InvitableRole, storeId: '' }))}>
                      <SelectTrigger id='hq-inv-role'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVITABLE_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {needsStore && (
                    <div className='space-y-2'>
                      <Label htmlFor='hq-inv-store'>Assign to Store</Label>
                      <Select value={inviteForm.storeId} onValueChange={(v) => setInviteForm((p) => ({ ...p, storeId: v }))}>
                        <SelectTrigger id='hq-inv-store'>
                          <SelectValue placeholder='Select store…' />
                        </SelectTrigger>
                        <SelectContent>
                          {stores.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className='flex justify-end gap-2'>
                    <Button type='button' variant='outline' onClick={() => setInviteOpen(false)} disabled={inviting}>
                      Cancel
                    </Button>
                    <Button type='submit' disabled={inviting}>
                      {inviting ? 'Generating…' : 'Generate Invite Link'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Users table ───────────────────────────────────────────────────── */}
      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className='text-center text-muted-foreground py-8'>
                    No users match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((user) => (
                <TableRow key={user.uid} className={user.disabled ? 'opacity-60' : ''}>
                  <TableCell className='font-medium'>
                    <Link href={`/hq/users/${user.uid}`} className='hover:underline underline-offset-4'>
                      {user.name || '—'}
                    </Link>
                    {user.uid === currentUserId && <span className='ml-2 text-xs text-muted-foreground'>(you)</span>}
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANTS[user.role] ?? 'outline'} className='capitalize'>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{user.storeName ?? <span className='italic'>Platform</span>}</TableCell>
                  <TableCell>
                    {user.disabled ? (
                      <Badge variant='destructive'>Disabled</Badge>
                    ) : (
                      <Badge variant='secondary' className='text-emerald-600 dark:text-emerald-400'>
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className='text-right'>
                    {isSuperAdmin && user.uid !== currentUserId && (
                      <Button variant='ghost' size='sm' disabled={loadingUid === user.uid} onClick={() => handleToggleDisabled(user)}>
                        {user.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Pending Invitations ───────────────────────────────────────────── */}
      {isSuperAdmin && (
        <div className='rounded-lg border border-border bg-card overflow-hidden'>
          <div className='px-4 py-3 border-b border-border flex items-center gap-2'>
            <Mail className='h-4 w-4 text-muted-foreground' />
            <h3 className='font-semibold text-sm'>Pending Invitations</h3>
            {invitations.length > 0 && <span className='text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium'>{invitations.length}</span>}
          </div>
          {invitations.length === 0 ? (
            <div className='px-4 py-6 text-center text-sm text-muted-foreground'>No pending invitations</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className='w-24'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => {
                  const expiresIn = Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / (1000 * 60 * 60)));
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className='font-medium'>{inv.name}</TableCell>
                      <TableCell className='text-muted-foreground text-sm'>{inv.email}</TableCell>
                      <TableCell>
                        <span className='text-sm capitalize'>{ROLE_LABELS[inv.role] ?? inv.role}</span>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>{inv.storeName ?? <span className='italic'>Platform</span>}</TableCell>
                      <TableCell>
                        <span className='flex items-center gap-1 text-sm text-muted-foreground'>
                          <Clock className='h-3.5 w-3.5' />
                          {expiresIn}h
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <Button size='sm' variant='ghost' className='h-7 w-7 p-0' title='Resend invitation' onClick={() => handleResend(inv)}>
                            <RefreshCw className='h-3.5 w-3.5' />
                          </Button>
                          <Button size='sm' variant='ghost' className='h-7 w-7 p-0 text-destructive hover:text-destructive' title='Cancel invitation' onClick={() => handleCancel(inv.id)}>
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
      )}

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
            </div>
            <p className='text-xs text-muted-foreground'>The invitation appears under Pending Invitations and can be resent if needed.</p>
            <div className='flex justify-end'>
              <Button onClick={() => setJoinLinkDialog((p) => ({ ...p, open: false }))}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
