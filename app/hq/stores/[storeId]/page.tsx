import { getStoreDetail, setStoreStatus } from '@/lib/actions/stores';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Clock, Eye, Ticket, Users } from 'lucide-react';
import StoreActions from './store-actions';

export default async function HQStorePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const result = await getStoreDetail(storeId);

  if (!result.success) {
    if (result.error === 'Unauthorized') redirect('/hq/stores');
    notFound();
  }

  if (!result.store) {
    notFound();
  }

  const { store, stats, staff, recentTickets } = result;
  const s = stats ?? { open: 0, assigned: 0, closed: 0, total: 0 };

  const technicians = (staff ?? []).filter((u) => u.role === 'technician');
  const callAdmins = (staff ?? []).filter((u) => u.role === 'call_admin');
  const storeAdmin = (staff ?? []).find((u) => u.role === 'store_admin');

  const statusVariant = (st: string) => (st === 'active' ? 'default' : st === 'onboarding' ? 'outline' : 'secondary');

  const ticketStatusVariant = (st: string) => (st === 'Open' ? 'outline' : st === 'Assigned' ? 'default' : 'secondary');

  return (
    <div className='space-y-6'>
      {/* Viewing banner */}
      <div className='rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center justify-between'>
        <div className='flex items-center gap-2 text-sm font-medium text-primary'>
          <Eye className='h-4 w-4' />
          <span>
            Viewing: <strong>{store.name}</strong>
          </span>
        </div>
        <Button variant='ghost' size='sm' asChild className='text-xs text-muted-foreground hover:text-foreground'>
          <Link href='/hq/stores'>← HQ Overview</Link>
        </Button>
      </div>

      {/* Back + header */}
      <div>
        <Link href='/hq/stores' className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4'>
          <ArrowLeft className='h-4 w-4' />
          Back to Stores
        </Link>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <h2 className='text-xl font-semibold'>{store.name}</h2>
            <Badge variant={statusVariant(store.status)} className='capitalize'>
              {store.status}
            </Badge>
            {store.island && <span className='text-sm text-muted-foreground'>{store.island}</span>}
          </div>
          <StoreActions storeId={storeId} currentStatus={store.status} />
        </div>
      </div>

      {/* Ticket stats */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
        {[
          { label: 'Total Tickets', value: s.total, icon: Ticket, color: 'text-primary' },
          { label: 'Open', value: s.open, icon: Ticket, color: 'text-orange-500' },
          { label: 'Assigned', value: s.assigned, icon: Clock, color: 'text-yellow-500' },
          { label: 'Closed', value: s.closed, icon: CheckCircle, color: 'text-emerald-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-1'>
              <CardTitle className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Staff roster */}
        <Card className='lg:col-span-1'>
          <CardHeader>
            <CardTitle className='text-sm font-medium flex items-center gap-2'>
              <Users className='h-4 w-4 text-muted-foreground' />
              Staff Roster
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {storeAdmin && (
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2'>Store Admin</p>
                <div className='flex items-center justify-between py-1.5'>
                  <div>
                    <p className='text-sm font-medium'>{storeAdmin.name || '—'}</p>
                    <p className='text-xs text-muted-foreground'>{storeAdmin.email}</p>
                  </div>
                  {storeAdmin.disabled && (
                    <Badge variant='destructive' className='text-xs'>
                      Disabled
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {callAdmins.length > 0 && (
              <div>
                <Separator className='mb-3' />
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2'>Call Admins</p>
                <div className='space-y-1.5'>
                  {callAdmins.map((u) => (
                    <div key={u.uid} className='flex items-center justify-between py-1'>
                      <div>
                        <p className='text-sm font-medium'>{u.name || '—'}</p>
                        <p className='text-xs text-muted-foreground'>{u.email}</p>
                      </div>
                      {u.disabled && (
                        <Badge variant='destructive' className='text-xs'>
                          Disabled
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {technicians.length > 0 && (
              <div>
                <Separator className='mb-3' />
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2'>Technicians ({technicians.length})</p>
                <div className='space-y-1.5'>
                  {technicians.map((u) => (
                    <div key={u.uid} className='flex items-center justify-between py-1'>
                      <div>
                        <p className='text-sm font-medium'>{u.name || '—'}</p>
                        <p className='text-xs text-muted-foreground'>{u.email}</p>
                      </div>
                      {u.disabled && (
                        <Badge variant='destructive' className='text-xs'>
                          Disabled
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(staff ?? []).length === 0 && <p className='text-sm text-muted-foreground'>No staff assigned yet.</p>}
          </CardContent>
        </Card>

        {/* Recent tickets + contact info */}
        <div className='lg:col-span-2 space-y-4'>
          {/* Recent tickets */}
          <Card>
            <CardHeader>
              <CardTitle className='text-sm font-medium'>Recent Tickets</CardTitle>
            </CardHeader>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentTickets ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className='text-center text-muted-foreground py-6 text-sm'>
                        No tickets yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (recentTickets ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className='text-sm'>{t.customerName}</TableCell>
                        <TableCell>
                          <Badge variant={ticketStatusVariant(t.status) as any}>{t.status}</Badge>
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground'>{t.technicianName ?? 'Unassigned'}</TableCell>
                        <TableCell className='text-sm text-muted-foreground'>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Contact + settings */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-sm font-medium text-muted-foreground'>Contact Details</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-sm'>
                <div>
                  <span className='text-muted-foreground'>Address: </span>
                  {store.address || '—'}
                </div>
                <div>
                  <span className='text-muted-foreground'>Email: </span>
                  {store.contactEmail || '—'}
                </div>
                <div>
                  <span className='text-muted-foreground'>Phone: </span>
                  {store.contactPhone || '—'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-sm font-medium text-muted-foreground'>Settings</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-sm'>
                <div>
                  <span className='text-muted-foreground'>Timezone: </span>
                  {store.settings?.timezone || '—'}
                </div>
                <div>
                  <span className='text-muted-foreground'>Currency: </span>
                  {store.settings?.currency || '—'}
                </div>
                <div>
                  <span className='text-muted-foreground'>Modules: </span>
                  {store.modules
                    ? Object.entries(store.modules)
                        .filter(([, v]) => v)
                        .map(([k]) => k)
                        .join(', ') || '—'
                    : '—'}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
