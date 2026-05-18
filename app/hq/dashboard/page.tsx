import { getHQStats, listStores } from '@/lib/actions/stores';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Trophy } from 'lucide-react';
import Link from 'next/link';
import { HQKpiCards } from './hq-kpi-cards';
import { HQActivityFeed } from './activity-feed';

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

      {/* Top Performer */}
      {/* Top Performer + Activity Feed */}
      {!noStores && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {stats.topStore ? (
            <Card className='border border-yellow-200/80 dark:border-yellow-800/40 bg-yellow-50/50 dark:bg-yellow-950/20'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium flex items-center gap-2'>
                  <Trophy className='h-4 w-4 text-yellow-500' />
                  Top Performing Store
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          ) : (
            <div />
          )}
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
                          <span className='text-muted-foreground ml-1'>assigned</span>
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
