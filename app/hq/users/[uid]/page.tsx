import { getUserDetailAction } from '@/lib/actions/users';
import { getCurrentUser } from '@/lib/auth/session';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Shield, Store as StoreIcon, Mail, Calendar, Clock, UserRound } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

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

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(ts?: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(ts?: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function UserDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;

  const [currentUser, result] = await Promise.all([getCurrentUser(), getUserDetailAction(uid)]);
  if (!result.success || !result.user) notFound();

  const user = result.user;
  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className='max-w-2xl mx-auto space-y-6'>
      {/* Back */}
      <Button variant='ghost' size='sm' asChild className='-ml-2'>
        <Link href='/hq/users'>
          <ArrowLeft className='h-4 w-4 mr-1.5' />
          Back to Users
        </Link>
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex items-start gap-4'>
            {/* Avatar */}
            <div className='h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0'>
              <span className='text-xl font-semibold text-primary'>{user.name ? initials(user.name) : <UserRound className='h-7 w-7' />}</span>
            </div>

            <div className='flex-1 min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <h1 className='text-xl font-bold truncate'>{user.name || 'Unnamed User'}</h1>
                {user.isProtected && (
                  <Badge variant='outline' className='text-xs gap-1'>
                    <Shield className='h-3 w-3' />
                    Protected
                  </Badge>
                )}
              </div>
              <p className='text-sm text-muted-foreground mt-0.5'>{user.email}</p>
              <div className='flex flex-wrap gap-2 mt-2'>
                <Badge variant={ROLE_VARIANTS[user.role] ?? 'outline'}>{ROLE_LABELS[user.role] ?? user.role}</Badge>
                {user.disabled ? (
                  <Badge variant='destructive'>Disabled</Badge>
                ) : (
                  <Badge variant='secondary' className='text-emerald-600 dark:text-emerald-400'>
                    Active
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Account Details</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='flex items-start gap-3'>
              <Mail className='h-4 w-4 mt-0.5 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Email</p>
                <p className='text-sm font-medium'>{user.email}</p>
              </div>
            </div>

            <div className='flex items-start gap-3'>
              <StoreIcon className='h-4 w-4 mt-0.5 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Store</p>
                {user.storeId ? (
                  <Link href={`/hq/stores/${user.storeId}`} className='text-sm font-medium text-primary hover:underline'>
                    {user.storeName ?? user.storeId}
                  </Link>
                ) : (
                  <p className='text-sm font-medium italic text-muted-foreground'>Platform-level</p>
                )}
              </div>
            </div>

            <div className='flex items-start gap-3'>
              <Calendar className='h-4 w-4 mt-0.5 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Account Created</p>
                <p className='text-sm font-medium'>{formatDate(user.createdAt)}</p>
              </div>
            </div>

            <div className='flex items-start gap-3'>
              <Clock className='h-4 w-4 mt-0.5 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Last Sign In</p>
                <p className='text-sm font-medium'>{formatDateTime(user.lastSignInTime)}</p>
              </div>
            </div>
          </div>

          {(user.internalPayRate != null || user.chargeoutRate != null) && (
            <>
              <Separator />
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                {user.internalPayRate != null && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Internal Pay Rate</p>
                    <p className='text-sm font-medium'>${user.internalPayRate.toFixed(2)}/hr</p>
                  </div>
                )}
                {user.chargeoutRate != null && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Chargeout Rate</p>
                    <p className='text-sm font-medium'>${user.chargeoutRate.toFixed(2)}/hr</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions — super_admin only */}
      {isSuperAdmin && uid !== currentUser.uid && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground mb-4'>
              Status changes and deletions can be made from the{' '}
              <Link href='/hq/users' className='text-primary underline underline-offset-4'>
                Users table
              </Link>
              .
            </p>
            <Button variant='outline' asChild>
              <Link href='/hq/users'>Manage in Users Table</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
