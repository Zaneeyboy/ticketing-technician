import { getHQStats, listStores } from '@/lib/actions/stores';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart2, Building2, Plus, Ticket, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { HQKpiCards } from './hq-kpi-cards';
import { HQActivityFeed } from './activity-feed';

const QUICK_ACTIONS = [
  {
    label: 'Add Store',
    desc: 'Onboard a new location',
    href: '/hq/stores/new',
    icon: Plus,
  },
  {
    label: 'All Stores',
    desc: 'View and manage stores',
    href: '/hq/stores',
    icon: Building2,
  },
  {
    label: 'Reports',
    desc: 'Platform-wide analytics',
    href: '/hq/reports',
    icon: BarChart2,
  },
  {
    label: 'Users',
    desc: 'Staff and permissions',
    href: '/hq/users',
    icon: Users,
  },
  {
    label: 'Tickets',
    desc: 'All tickets across stores',
    href: '/hq/tickets',
    icon: Ticket,
  },
] as const;

export default async function HQDashboardPage() {
  const [statsResult, storesResult] = await Promise.all([getHQStats(), listStores()]);

  const stats = statsResult.success ? statsResult : { totalOpen: 0, totalAssigned: 0, totalClosed: 0, totalOverdue: 0, storeCount: 0, storeBreakdown: [], topStore: null };
  const stores = storesResult.success ? storesResult.stores : [];

  // Use the full stores list (all statuses) to determine if any stores exist,
  // not stats.storeCount which only counts active stores.
  const noStores = stores.length === 0;

  return (
    <div className='space-y-8'>
      {/* KPI Cards */}
      <HQKpiCards storeCount={stats.storeCount} totalOpen={stats.totalOpen} totalAssigned={stats.totalAssigned} totalClosed={stats.totalClosed} totalOverdue={stats.totalOverdue} />

      {/* Quick Actions */}
      <div>
        <h2 className='text-lg font-semibold mb-4'>Quick Actions</h2>
        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
          {QUICK_ACTIONS.map(({ label, desc, href, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className='hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer h-full'>
                <CardContent className='pt-5 pb-4 flex flex-col gap-2'>
                  <div className='h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center'>
                    <Icon className='h-4 w-4 text-primary' />
                  </div>
                  <p className='font-medium text-sm leading-tight'>{label}</p>
                  <p className='text-xs text-muted-foreground leading-snug'>{desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Empty state — no stores yet */}
      {noStores && (
        <Card className='border-dashed border-2 border-primary/30 bg-primary/5'>
          <CardContent className='py-12 text-center space-y-4'>
            <Building2 className='mx-auto h-10 w-10 text-primary/50' />
            <div>
              <p className='text-lg font-semibold'>No stores yet</p>
              <p className='text-sm text-muted-foreground mt-1'>Create your first store to get the platform up and running.</p>
            </div>
            <Button asChild>
              <Link href='/hq/stores/new'>
                <Plus className='h-4 w-4 mr-1.5' />
                Create First Store
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Top Performer + Activity Feed */}
      {!noStores && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {/* Top Performer — always rendered, empty state when no data */}
          <Card className={stats.topStore ? 'border border-yellow-200/80 dark:border-yellow-800/40 bg-yellow-50/50 dark:bg-yellow-950/20' : ''}>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium flex items-center gap-2'>
                <Trophy className='h-4 w-4 text-yellow-500' />
                Top Performing Store
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topStore ? (
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-semibold'>{stats.topStore.storeName}</p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      {stats.topStore.closed} closed · {stats.topStore.open + stats.topStore.assigned} active
                    </p>
                  </div>
                  <Button variant='outline' size='sm' asChild>
                    <Link href={`/hq/stores/${stats.topStore.storeId}`}>View</Link>
                  </Button>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>Stores need at least 3 tickets before a top performer is ranked.</p>
              )}
            </CardContent>
          </Card>

          <HQActivityFeed />
        </div>
      )}

      {/* Store Breakdown */}
      {!noStores && (
        <>
          <h2 className='text-lg font-semibold'>Store Breakdown</h2>
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
            {stats.storeBreakdown.map((s) => {
              const store = stores.find((st) => st.id === s.storeId);
              return (
                <Link key={s.storeId} href={`/hq/stores/${s.storeId}`}>
                  <Card className='hover:border-primary/50 transition-colors cursor-pointer'>
                    <CardHeader className='pb-2'>
                      <div className='flex items-center justify-between'>
                        <CardTitle className='text-base'>{s.storeName}</CardTitle>
                        {store && (
                          <Badge variant={store.status === 'active' ? 'default' : 'secondary'} className='capitalize'>
                            {store.status}
                          </Badge>
                        )}
                      </div>
                      {store?.island && <p className='text-xs text-muted-foreground'>{store.island}</p>}
                    </CardHeader>
                    <CardContent>
                      <div className='flex gap-4 text-sm'>
                        <div>
                          <span className='font-medium text-orange-500'>{s.open}</span>
                          <span className='text-muted-foreground ml-1'>open</span>
                        </div>
                        <div>
                          <span className='font-medium text-yellow-500'>{s.assigned}</span>
                          <span className='text-muted-foreground ml-1'>active</span>
                        </div>
                        <div>
                          <span className='font-medium text-green-500'>{s.closed}</span>
                          <span className='text-muted-foreground ml-1'>closed</span>
                        </div>
                        {s.overdue > 0 && (
                          <div>
                            <span className='font-medium text-destructive'>{s.overdue}</span>
                            <span className='text-muted-foreground ml-1'>overdue</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
