'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { type ExportColumn } from '@/lib/export';
import { type StoreReportRow } from '@/lib/actions/stores';
import { Activity, AlertTriangle, BarChart3, Building2, CheckCircle2, ChevronRight, Globe, MapPin, Package, Search, TicketCheck, TrendingUp, Users, Wrench } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'summary' | 'tickets-by-store' | 'tickets-by-island' | 'parts-by-store' | 'parts-by-island' | 'techs-by-store' | 'techs-by-island';

interface IslandGroup {
  island: string;
  stores: StoreReportRow[];
  tickets: { open: number; assigned: number; closed: number; overdue: number; total: number; resolutionRate: number };
  technicianCount: number;
  partCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolutionColor(rate: number) {
  if (rate >= 70) return 'text-emerald-700 dark:text-emerald-400';
  if (rate >= 40) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
}
function resolutionBg(rate: number) {
  if (rate >= 70) return 'bg-emerald-500';
  if (rate >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}
function stockBadge(qty: number, min: number) {
  if (qty === 0)
    return (
      <Badge variant='destructive' className='text-[10px] py-0 px-1.5'>
        Out
      </Badge>
    );
  if (qty <= min) return <Badge className='bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] py-0 px-1.5'>Low</Badge>;
  return <Badge className='bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] py-0 px-1.5'>OK</Badge>;
}

function groupByIsland(stores: StoreReportRow[]): IslandGroup[] {
  const map: Record<string, StoreReportRow[]> = {};
  stores.forEach((s) => {
    const k = s.island || 'Unknown';
    if (!map[k]) map[k] = [];
    map[k].push(s);
  });
  return Object.entries(map)
    .map(([island, storeList]) => {
      const open = storeList.reduce((acc, s) => acc + s.tickets.open, 0);
      const assigned = storeList.reduce((acc, s) => acc + s.tickets.assigned, 0);
      const closed = storeList.reduce((acc, s) => acc + s.tickets.closed, 0);
      const overdue = storeList.reduce((acc, s) => acc + s.tickets.overdue, 0);
      const total = open + assigned + closed;
      const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 0;
      return {
        island,
        stores: storeList,
        tickets: { open, assigned, closed, overdue, total, resolutionRate },
        technicianCount: storeList.reduce((acc, s) => acc + s.technicians.length, 0),
        partCount: storeList.reduce((acc, s) => acc + s.parts.length, 0),
      };
    })
    .sort((a, b) => b.tickets.total - a.tickets.total);
}

// ─── Summary KPI ─────────────────────────────────────────────────────────────

function SummaryKPI({ stores }: { stores: StoreReportRow[] }) {
  const totals = useMemo(() => {
    const open = stores.reduce((a, s) => a + s.tickets.open, 0);
    const assigned = stores.reduce((a, s) => a + s.tickets.assigned, 0);
    const closed = stores.reduce((a, s) => a + s.tickets.closed, 0);
    const overdue = stores.reduce((a, s) => a + s.tickets.overdue, 0);
    const total = open + assigned + closed;
    const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 0;
    const islandCount = new Set(stores.map((s) => s.island)).size;
    const techCount = stores.reduce((a, s) => a + s.technicians.length, 0);
    const lowStockItems = stores.reduce((a, s) => a + s.parts.filter((p) => p.quantityInStock <= p.minQuantity).length, 0);
    return { open, assigned, closed, overdue, total, resolutionRate, islandCount, techCount, lowStockItems };
  }, [stores]);

  const cards = [
    { label: 'Total Tickets', value: totals.total, icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Open', value: totals.open, icon: Activity, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Assigned', value: totals.assigned, icon: Wrench, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Closed', value: totals.closed, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    {
      label: 'Overdue',
      value: totals.overdue,
      icon: AlertTriangle,
      color: totals.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
      bg: totals.overdue > 0 ? 'bg-red-500/10' : 'bg-muted',
    },
    { label: 'Resolution Rate', value: `${totals.resolutionRate}%`, icon: TrendingUp, color: resolutionColor(totals.resolutionRate), bg: 'bg-muted' },
    { label: 'Stores', value: stores.length, icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Islands', value: totals.islandCount, icon: Globe, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Technicians', value: totals.techCount, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    {
      label: 'Low Stock Items',
      value: totals.lowStockItems,
      icon: Package,
      color: totals.lowStockItems > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
      bg: totals.lowStockItems > 0 ? 'bg-amber-500/10' : 'bg-muted',
    },
  ];

  return (
    <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className='pt-4 pb-3 px-4'>
            <div className='flex items-start justify-between gap-2'>
              <div>
                <p className='text-xs font-medium text-muted-foreground mb-1.5'>{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
              <div className={`rounded-lg p-1.5 shrink-0 ${c.bg}`}>
                <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Tickets by Store ─────────────────────────────────────────────────────────

const TICKET_STORE_COLS: ExportColumn[] = [
  { header: 'Store', key: 'storeName' },
  { header: 'Island', key: 'island' },
  { header: 'Open', key: 'tickets.open' },
  { header: 'Assigned', key: 'tickets.assigned' },
  { header: 'Closed', key: 'tickets.closed' },
  { header: 'Overdue', key: 'tickets.overdue' },
  { header: 'Total', key: 'tickets.total' },
  { header: 'Resolution %', key: 'tickets.resolutionRate' },
  { header: 'Avg Days to Close', key: 'tickets.avgDaysToClose', formatter: (v) => (v != null ? `${v}d` : '—') },
];

function TicketsByStore({ stores }: { stores: StoreReportRow[] }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => stores.filter((s) => s.storeName.toLowerCase().includes(search.toLowerCase()) || s.island.toLowerCase().includes(search.toLowerCase())), [stores, search]);
  const maxTotal = Math.max(...stores.map((s) => s.tickets.total), 1);

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between'>
        <div className='relative flex-1 max-w-xs'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
          <Input className='pl-8 h-8 text-sm' placeholder='Filter by store or island…' value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ExportButton
          data={filtered as any}
          columns={TICKET_STORE_COLS}
          filename='tickets-by-store'
          sheetName='Tickets by Store'
          title='Tickets by Store'
          metadata={{ title: 'Tickets by Store', subtitle: 'Caribbean Roasters — HQ Report' }}
          size='sm'
        />
      </div>
      <Card>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className='hidden sm:table-cell'>Island</TableHead>
                  <TableHead className='text-center w-16'>Open</TableHead>
                  <TableHead className='text-center w-20 hidden md:table-cell'>Assigned</TableHead>
                  <TableHead className='text-center w-16'>Closed</TableHead>
                  <TableHead className='text-center w-16 hidden lg:table-cell'>Overdue</TableHead>
                  <TableHead className='text-center w-16'>Total</TableHead>
                  <TableHead className='w-32 hidden sm:table-cell'>Resolution</TableHead>
                  <TableHead className='text-right w-28 hidden lg:table-cell'>Avg Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className='text-center py-10 text-muted-foreground'>
                      No stores match your filter.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((s) => (
                  <TableRow key={s.storeId}>
                    <TableCell>
                      <p className='font-medium text-sm'>{s.storeName}</p>
                      <p className='text-xs text-muted-foreground sm:hidden'>{s.island}</p>
                    </TableCell>
                    <TableCell className='hidden sm:table-cell text-sm text-muted-foreground'>{s.island}</TableCell>
                    <TableCell className='text-center'>
                      <span className='text-sm font-semibold text-amber-700 dark:text-amber-400'>{s.tickets.open}</span>
                    </TableCell>
                    <TableCell className='text-center hidden md:table-cell'>
                      <span className='text-sm font-semibold text-primary'>{s.tickets.assigned}</span>
                    </TableCell>
                    <TableCell className='text-center'>
                      <span className='text-sm font-semibold text-emerald-700 dark:text-emerald-400'>{s.tickets.closed}</span>
                    </TableCell>
                    <TableCell className='text-center hidden lg:table-cell'>
                      {s.tickets.overdue > 0 ? (
                        <span className='text-sm font-semibold text-red-700 dark:text-red-400'>{s.tickets.overdue}</span>
                      ) : (
                        <span className='text-sm text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                    <TableCell className='text-center font-bold text-sm'>{s.tickets.total}</TableCell>
                    <TableCell className='hidden sm:table-cell'>
                      <div className='flex items-center gap-2'>
                        <div className='flex-1 h-1.5 rounded-full bg-muted overflow-hidden'>
                          <div className={`h-1.5 rounded-full ${resolutionBg(s.tickets.resolutionRate)}`} style={{ width: `${s.tickets.resolutionRate}%` }} />
                        </div>
                        <span className={`text-xs font-semibold w-9 text-right shrink-0 ${resolutionColor(s.tickets.resolutionRate)}`}>{s.tickets.resolutionRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className='text-right text-sm text-muted-foreground hidden lg:table-cell'>{s.tickets.avgDaysToClose != null ? `${s.tickets.avgDaysToClose}d` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {/* Volume bars */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm font-medium'>Ticket Volume by Store</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {filtered.map((s) => (
            <div key={s.storeId} className='flex items-center gap-3'>
              <span className='text-xs text-muted-foreground w-28 shrink-0 truncate'>{s.storeName}</span>
              <div className='flex-1 h-4 bg-muted rounded-full overflow-hidden'>
                <div className='h-4 bg-primary/70 rounded-full transition-all duration-500' style={{ width: `${Math.max(4, (s.tickets.total / maxTotal) * 100)}%` }} />
              </div>
              <span className='text-xs font-bold w-8 text-right shrink-0'>{s.tickets.total}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tickets by Island ────────────────────────────────────────────────────────

const TICKET_ISLAND_COLS: ExportColumn[] = [
  { header: 'Island', key: 'island' },
  { header: 'Stores', key: 'stores.length' },
  { header: 'Open', key: 'tickets.open' },
  { header: 'Assigned', key: 'tickets.assigned' },
  { header: 'Closed', key: 'tickets.closed' },
  { header: 'Overdue', key: 'tickets.overdue' },
  { header: 'Total', key: 'tickets.total' },
  { header: 'Resolution %', key: 'tickets.resolutionRate' },
];

function TicketsByIsland({ stores }: { stores: StoreReportRow[] }) {
  const islands = useMemo(() => groupByIsland(stores), [stores]);
  const maxTotal = Math.max(...islands.map((g) => g.tickets.total), 1);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <ExportButton
          data={islands as any}
          columns={TICKET_ISLAND_COLS}
          filename='tickets-by-island'
          sheetName='Tickets by Island'
          title='Tickets by Island'
          metadata={{ title: 'Tickets by Island', subtitle: 'Caribbean Roasters — HQ Report' }}
          size='sm'
        />
      </div>
      <div className='space-y-3'>
        {islands.map((g) => (
          <Card key={g.island}>
            <CardContent className='p-0'>
              <button
                className='w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-muted/40 transition-colors rounded-t-lg'
                onClick={() => setExpanded(expanded === g.island ? null : g.island)}
              >
                <div className='flex items-center gap-2 flex-1 min-w-0'>
                  <MapPin className='h-4 w-4 text-primary shrink-0' />
                  <div>
                    <p className='font-semibold text-sm'>{g.island}</p>
                    <p className='text-xs text-muted-foreground'>
                      {g.stores.length} store{g.stores.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className='hidden sm:flex items-center gap-6 text-sm shrink-0'>
                  <span className='text-amber-700 dark:text-amber-400 font-semibold'>{g.tickets.open} open</span>
                  <span className='text-emerald-700 dark:text-emerald-400 font-semibold'>{g.tickets.closed} closed</span>
                  <span className={`font-semibold ${resolutionColor(g.tickets.resolutionRate)}`}>{g.tickets.resolutionRate}%</span>
                </div>
                <div className='hidden md:flex items-center gap-2 w-32 shrink-0'>
                  <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden'>
                    <div className={`h-1.5 rounded-full ${resolutionBg(g.tickets.resolutionRate)}`} style={{ width: `${g.tickets.resolutionRate}%` }} />
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expanded === g.island ? 'rotate-90' : ''}`} />
              </button>
              {/* Mobile summary row */}
              <div className='flex sm:hidden items-center gap-4 px-4 pb-2 text-xs text-muted-foreground'>
                <span className='text-amber-700 dark:text-amber-400 font-semibold'>{g.tickets.open} open</span>
                <span className='text-emerald-700 dark:text-emerald-400 font-semibold'>{g.tickets.closed} closed</span>
                <span className={`font-semibold ${resolutionColor(g.tickets.resolutionRate)}`}>{g.tickets.resolutionRate}%</span>
              </div>
              {/* Volume bar */}
              <div className='px-4 pb-3'>
                <div className='h-2 bg-muted rounded-full overflow-hidden'>
                  <div className='h-2 bg-primary/60 rounded-full transition-all duration-500' style={{ width: `${Math.max(4, (g.tickets.total / maxTotal) * 100)}%` }} />
                </div>
                <p className='text-xs text-muted-foreground mt-1'>{g.tickets.total} total tickets</p>
              </div>
              {/* Expanded store breakdown */}
              {expanded === g.island && (
                <div className='border-t'>
                  <div className='overflow-x-auto'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className='pl-6'>Store</TableHead>
                          <TableHead className='text-center'>Open</TableHead>
                          <TableHead className='text-center hidden sm:table-cell'>Assigned</TableHead>
                          <TableHead className='text-center'>Closed</TableHead>
                          <TableHead className='text-center hidden md:table-cell'>Overdue</TableHead>
                          <TableHead className='text-center'>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.stores.map((s) => (
                          <TableRow key={s.storeId}>
                            <TableCell className='pl-6 font-medium text-sm'>{s.storeName}</TableCell>
                            <TableCell className='text-center'>
                              <span className='text-sm text-amber-700 dark:text-amber-400 font-semibold'>{s.tickets.open}</span>
                            </TableCell>
                            <TableCell className='text-center hidden sm:table-cell'>
                              <span className='text-sm text-primary font-semibold'>{s.tickets.assigned}</span>
                            </TableCell>
                            <TableCell className='text-center'>
                              <span className='text-sm text-emerald-700 dark:text-emerald-400 font-semibold'>{s.tickets.closed}</span>
                            </TableCell>
                            <TableCell className='text-center hidden md:table-cell'>
                              {s.tickets.overdue > 0 ? (
                                <span className='text-sm text-red-700 dark:text-red-400 font-semibold'>{s.tickets.overdue}</span>
                              ) : (
                                <span className='text-muted-foreground text-sm'>—</span>
                              )}
                            </TableCell>
                            <TableCell className='text-center font-bold text-sm'>{s.tickets.total}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Parts by Store ───────────────────────────────────────────────────────────

const PARTS_STORE_COLS: ExportColumn[] = [
  { header: 'Store', key: 'storeName' },
  { header: 'Island', key: 'island' },
  { header: 'Part Name', key: 'name' },
  { header: 'Category', key: 'category' },
  { header: 'In Stock', key: 'quantityInStock' },
  { header: 'Min Qty', key: 'minQuantity' },
  { header: 'Status', key: 'status' },
];

function PartsByStore({ stores }: { stores: StoreReportRow[] }) {
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const flatParts = useMemo(() => {
    return stores.flatMap((s) =>
      s.parts.map((p) => ({
        ...p,
        storeName: s.storeName,
        island: s.island,
        storeId: s.storeId,
        status: p.quantityInStock === 0 ? 'Out of Stock' : p.quantityInStock <= p.minQuantity ? 'Low Stock' : 'In Stock',
      })),
    );
  }, [stores]);

  const filtered = useMemo(() => {
    return flatParts.filter((p) => {
      const matchStore = storeFilter === 'all' || p.storeId === storeFilter;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
      return matchStore && matchSearch;
    });
  }, [flatParts, storeFilter, search]);

  const storesWithParts = useMemo(() => stores.filter((s) => s.parts.length > 0), [stores]);

  const lowStockCount = filtered.filter((p) => p.quantityInStock > 0 && p.quantityInStock <= p.minQuantity).length;
  const outOfStockCount = filtered.filter((p) => p.quantityInStock === 0).length;

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row gap-3'>
        <div className='relative flex-1 max-w-xs'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
          <Input className='pl-8 h-8 text-sm' placeholder='Search parts…' value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className='h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 max-w-xs' value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value='all'>All Stores</option>
          {storesWithParts.map((s) => (
            <option key={s.storeId} value={s.storeId}>
              {s.storeName}
            </option>
          ))}
        </select>
        <ExportButton
          data={filtered}
          columns={PARTS_STORE_COLS}
          filename='parts-by-store'
          sheetName='Parts by Store'
          title='Parts by Store'
          metadata={{ title: 'Parts by Store', subtitle: `Filter: ${storeFilter === 'all' ? 'All Stores' : stores.find((s) => s.storeId === storeFilter)?.storeName}` }}
          size='sm'
        />
      </div>
      {/* Summary badges */}
      <div className='flex items-center gap-3 flex-wrap'>
        <Badge variant='outline' className='text-xs'>
          {filtered.length} parts shown
        </Badge>
        {outOfStockCount > 0 && (
          <Badge variant='destructive' className='text-xs'>
            {outOfStockCount} out of stock
          </Badge>
        )}
        {lowStockCount > 0 && <Badge className='bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs'>{lowStockCount} low stock</Badge>}
      </div>
      <Card>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead className='hidden sm:table-cell'>Store</TableHead>
                  <TableHead className='hidden md:table-cell'>Island</TableHead>
                  <TableHead className='hidden lg:table-cell'>Category</TableHead>
                  <TableHead className='text-center w-20'>In Stock</TableHead>
                  <TableHead className='text-center w-16 hidden sm:table-cell'>Min Qty</TableHead>
                  <TableHead className='text-center w-20'>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className='text-center py-10 text-muted-foreground'>
                      No parts found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p, i) => (
                  <TableRow key={`${p.storeId}-${p.id}-${i}`}>
                    <TableCell>
                      <p className='font-medium text-sm'>{p.name}</p>
                      <p className='text-xs text-muted-foreground sm:hidden'>{p.storeName}</p>
                    </TableCell>
                    <TableCell className='hidden sm:table-cell text-sm text-muted-foreground'>{p.storeName}</TableCell>
                    <TableCell className='hidden md:table-cell text-sm text-muted-foreground'>{p.island}</TableCell>
                    <TableCell className='hidden lg:table-cell text-xs text-muted-foreground'>{p.category || '—'}</TableCell>
                    <TableCell className='text-center font-bold text-sm'>{p.quantityInStock}</TableCell>
                    <TableCell className='text-center text-sm text-muted-foreground hidden sm:table-cell'>{p.minQuantity}</TableCell>
                    <TableCell className='text-center'>{stockBadge(p.quantityInStock, p.minQuantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Parts by Island ──────────────────────────────────────────────────────────

const PARTS_ISLAND_COLS: ExportColumn[] = [
  { header: 'Island', key: 'island' },
  { header: 'Store', key: 'storeName' },
  { header: 'Part Name', key: 'name' },
  { header: 'Category', key: 'category' },
  { header: 'In Stock', key: 'quantityInStock' },
  { header: 'Min Qty', key: 'minQuantity' },
  { header: 'Status', key: 'status' },
];

function PartsByIsland({ stores }: { stores: StoreReportRow[] }) {
  const islands = useMemo(() => groupByIsland(stores), [stores]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const flatPartsForExport = useMemo(
    () =>
      stores.flatMap((s) =>
        s.parts.map((p) => ({
          ...p,
          storeName: s.storeName,
          island: s.island,
          status: p.quantityInStock === 0 ? 'Out of Stock' : p.quantityInStock <= p.minQuantity ? 'Low Stock' : 'In Stock',
        })),
      ),
    [stores],
  );

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <ExportButton
          data={flatPartsForExport}
          columns={PARTS_ISLAND_COLS}
          filename='parts-by-island'
          sheetName='Parts by Island'
          title='Parts by Island'
          metadata={{ title: 'Parts by Island', subtitle: 'Caribbean Roasters — HQ Report' }}
          size='sm'
        />
      </div>
      <div className='space-y-3'>
        {islands.map((g) => {
          const islandParts = g.stores.flatMap((s) => s.parts.map((p) => ({ ...p, storeName: s.storeName, storeId: s.storeId })));
          const lowStock = islandParts.filter((p) => p.quantityInStock > 0 && p.quantityInStock <= p.minQuantity).length;
          const outOfStock = islandParts.filter((p) => p.quantityInStock === 0).length;
          return (
            <Card key={g.island}>
              <CardContent className='p-0'>
                <button
                  className='w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-muted/40 transition-colors rounded-t-lg'
                  onClick={() => setExpanded(expanded === g.island ? null : g.island)}
                >
                  <MapPin className='h-4 w-4 text-primary shrink-0' />
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-sm'>{g.island}</p>
                    <p className='text-xs text-muted-foreground'>
                      {islandParts.length} parts across {g.stores.length} store{g.stores.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    {outOfStock > 0 && (
                      <Badge variant='destructive' className='text-[10px] py-0 px-1.5'>
                        {outOfStock} out
                      </Badge>
                    )}
                    {lowStock > 0 && <Badge className='bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] py-0 px-1.5'>{lowStock} low</Badge>}
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expanded === g.island ? 'rotate-90' : ''}`} />
                </button>
                {expanded === g.island && (
                  <div className='border-t'>
                    <div className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='pl-6'>Part</TableHead>
                            <TableHead className='hidden sm:table-cell'>Store</TableHead>
                            <TableHead className='hidden md:table-cell'>Category</TableHead>
                            <TableHead className='text-center w-20'>In Stock</TableHead>
                            <TableHead className='text-center w-16 hidden sm:table-cell'>Min</TableHead>
                            <TableHead className='text-center w-20'>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {islandParts.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className='text-center py-6 text-muted-foreground text-sm'>
                                No parts data for this island.
                              </TableCell>
                            </TableRow>
                          )}
                          {islandParts.map((p, i) => (
                            <TableRow key={`${p.storeId}-${p.id}-${i}`}>
                              <TableCell className='pl-6'>
                                <p className='font-medium text-sm'>{p.name}</p>
                                <p className='text-xs text-muted-foreground sm:hidden'>{p.storeName}</p>
                              </TableCell>
                              <TableCell className='hidden sm:table-cell text-sm text-muted-foreground'>{p.storeName}</TableCell>
                              <TableCell className='hidden md:table-cell text-xs text-muted-foreground'>{p.category || '—'}</TableCell>
                              <TableCell className='text-center font-bold text-sm'>{p.quantityInStock}</TableCell>
                              <TableCell className='text-center text-sm text-muted-foreground hidden sm:table-cell'>{p.minQuantity}</TableCell>
                              <TableCell className='text-center'>{stockBadge(p.quantityInStock, p.minQuantity)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Technicians by Store ─────────────────────────────────────────────────────

const TECH_STORE_COLS: ExportColumn[] = [
  { header: 'Technician', key: 'name' },
  { header: 'Email', key: 'email' },
  { header: 'Store', key: 'storeName' },
  { header: 'Island', key: 'island' },
  { header: 'Open', key: 'open' },
  { header: 'Assigned', key: 'assigned' },
  { header: 'Closed', key: 'closed' },
  { header: 'Total', key: 'total' },
  { header: 'Resolution %', key: 'resolutionRate', formatter: (v) => `${v}%` },
];

function TechniciansByStore({ stores }: { stores: StoreReportRow[] }) {
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const flatTechs = useMemo(() => {
    return stores
      .flatMap((s) =>
        s.technicians.map((t) => ({
          ...t,
          storeName: s.storeName,
          island: s.island,
          storeId: s.storeId,
          resolutionRate: t.total > 0 ? Math.round((t.closed / t.total) * 100) : 0,
        })),
      )
      .sort((a, b) => b.closed + b.assigned - (a.closed + a.assigned));
  }, [stores]);

  const filtered = useMemo(() => {
    return flatTechs.filter((t) => {
      const matchStore = storeFilter === 'all' || t.storeId === storeFilter;
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.email.toLowerCase().includes(search.toLowerCase());
      return matchStore && matchSearch;
    });
  }, [flatTechs, storeFilter, search]);

  const storesWithTechs = stores.filter((s) => s.technicians.length > 0);
  const maxTotal = Math.max(...filtered.map((t) => t.total), 1);

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row gap-3'>
        <div className='relative flex-1 max-w-xs'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
          <Input className='pl-8 h-8 text-sm' placeholder='Search technicians…' value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className='h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 max-w-xs' value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value='all'>All Stores</option>
          {storesWithTechs.map((s) => (
            <option key={s.storeId} value={s.storeId}>
              {s.storeName}
            </option>
          ))}
        </select>
        <ExportButton data={filtered} columns={TECH_STORE_COLS} filename='technicians-by-store' sheetName='Techs by Store' title='Technicians by Store' size='sm' />
      </div>
      <Card>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='pl-4 w-8'>#</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead className='hidden sm:table-cell'>Store</TableHead>
                  <TableHead className='hidden md:table-cell'>Island</TableHead>
                  <TableHead className='text-center w-16'>Open</TableHead>
                  <TableHead className='text-center w-20 hidden sm:table-cell'>Assigned</TableHead>
                  <TableHead className='text-center w-16'>Closed</TableHead>
                  <TableHead className='text-center w-16'>Total</TableHead>
                  <TableHead className='w-28 hidden md:table-cell'>Resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className='text-center py-10 text-muted-foreground'>
                      No technicians found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((t, i) => (
                  <TableRow key={`${t.storeId}-${t.uid}`}>
                    <TableCell className='pl-4 text-muted-foreground text-sm font-mono'>{i + 1}</TableCell>
                    <TableCell>
                      <p className='font-medium text-sm'>{t.name}</p>
                      <p className='text-xs text-muted-foreground sm:hidden'>{t.storeName}</p>
                      <p className='text-xs text-muted-foreground hidden sm:block'>{t.email}</p>
                    </TableCell>
                    <TableCell className='hidden sm:table-cell text-sm text-muted-foreground'>{t.storeName}</TableCell>
                    <TableCell className='hidden md:table-cell text-sm text-muted-foreground'>{t.island}</TableCell>
                    <TableCell className='text-center'>
                      <span className='text-sm font-semibold text-amber-700 dark:text-amber-400'>{t.open}</span>
                    </TableCell>
                    <TableCell className='text-center hidden sm:table-cell'>
                      <span className='text-sm font-semibold text-primary'>{t.assigned}</span>
                    </TableCell>
                    <TableCell className='text-center'>
                      <span className='text-sm font-semibold text-emerald-700 dark:text-emerald-400'>{t.closed}</span>
                    </TableCell>
                    <TableCell className='text-center font-bold text-sm'>{t.total}</TableCell>
                    <TableCell className='hidden md:table-cell'>
                      <div className='flex items-center gap-2'>
                        <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden'>
                          <div className={`h-1.5 rounded-full ${resolutionBg(t.resolutionRate)}`} style={{ width: `${t.resolutionRate}%` }} />
                        </div>
                        <span className={`text-xs font-semibold w-9 text-right shrink-0 ${resolutionColor(t.resolutionRate)}`}>{t.resolutionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {/* Performance bars */}
      {filtered.length > 0 && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm font-medium'>Tickets Closed — Top Technicians</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {filtered.slice(0, 10).map((t) => (
              <div key={`bar-${t.storeId}-${t.uid}`} className='flex items-center gap-3'>
                <span className='text-xs text-muted-foreground w-28 shrink-0 truncate'>{t.name}</span>
                <div className='flex-1 h-4 bg-muted rounded-full overflow-hidden'>
                  <div className='h-4 bg-emerald-500/70 rounded-full transition-all duration-500' style={{ width: `${Math.max(4, (t.closed / maxTotal) * 100)}%` }} />
                </div>
                <span className='text-xs font-bold w-8 text-right shrink-0'>{t.closed}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Technicians by Island ────────────────────────────────────────────────────

const TECH_ISLAND_COLS: ExportColumn[] = [
  { header: 'Island', key: 'island' },
  { header: 'Store', key: 'storeName' },
  { header: 'Technician', key: 'name' },
  { header: 'Open', key: 'open' },
  { header: 'Assigned', key: 'assigned' },
  { header: 'Closed', key: 'closed' },
  { header: 'Total', key: 'total' },
];

function TechniciansByIsland({ stores }: { stores: StoreReportRow[] }) {
  const islands = useMemo(() => groupByIsland(stores), [stores]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const flatForExport = useMemo(() => stores.flatMap((s) => s.technicians.map((t) => ({ ...t, storeName: s.storeName, island: s.island }))), [stores]);

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <ExportButton
          data={flatForExport}
          columns={TECH_ISLAND_COLS}
          filename='technicians-by-island'
          sheetName='Techs by Island'
          title='Technicians by Island'
          metadata={{ title: 'Technicians by Island', subtitle: 'Caribbean Roasters — HQ Report' }}
          size='sm'
        />
      </div>
      <div className='space-y-3'>
        {islands.map((g) => {
          const islandTechs = g.stores.flatMap((s) => s.technicians.map((t) => ({ ...t, storeName: s.storeName, storeId: s.storeId })));
          const totalClosed = islandTechs.reduce((a, t) => a + t.closed, 0);
          const totalAssigned = islandTechs.reduce((a, t) => a + t.assigned, 0);
          return (
            <Card key={g.island}>
              <CardContent className='p-0'>
                <button
                  className='w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-muted/40 transition-colors rounded-t-lg'
                  onClick={() => setExpanded(expanded === g.island ? null : g.island)}
                >
                  <MapPin className='h-4 w-4 text-primary shrink-0' />
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-sm'>{g.island}</p>
                    <p className='text-xs text-muted-foreground'>
                      {islandTechs.length} technician{islandTechs.length !== 1 ? 's' : ''} across {g.stores.length} store{g.stores.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className='hidden sm:flex items-center gap-6 text-sm shrink-0'>
                    <span className='text-primary font-semibold'>{totalAssigned} assigned</span>
                    <span className='text-emerald-700 dark:text-emerald-400 font-semibold'>{totalClosed} closed</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expanded === g.island ? 'rotate-90' : ''}`} />
                </button>
                {expanded === g.island && (
                  <div className='border-t'>
                    <div className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='pl-6'>#</TableHead>
                            <TableHead>Technician</TableHead>
                            <TableHead className='hidden sm:table-cell'>Store</TableHead>
                            <TableHead className='text-center'>Assigned</TableHead>
                            <TableHead className='text-center'>Closed</TableHead>
                            <TableHead className='text-center'>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {islandTechs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className='text-center py-6 text-muted-foreground text-sm'>
                                No technicians for this island.
                              </TableCell>
                            </TableRow>
                          )}
                          {islandTechs.map((t, i) => (
                            <TableRow key={`${t.storeId}-${t.uid}`}>
                              <TableCell className='pl-6 text-muted-foreground text-sm font-mono'>{i + 1}</TableCell>
                              <TableCell>
                                <p className='font-medium text-sm'>{t.name}</p>
                                <p className='text-xs text-muted-foreground sm:hidden'>{t.storeName}</p>
                              </TableCell>
                              <TableCell className='hidden sm:table-cell text-sm text-muted-foreground'>{t.storeName}</TableCell>
                              <TableCell className='text-center'>
                                <span className='text-sm text-primary font-semibold'>{t.assigned}</span>
                              </TableCell>
                              <TableCell className='text-center'>
                                <span className='text-sm text-emerald-700 dark:text-emerald-400 font-semibold'>{t.closed}</span>
                              </TableCell>
                              <TableCell className='text-center font-bold text-sm'>{t.total}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Report Selector + Main Shell ─────────────────────────────────────────────

const REPORTS: { id: ReportType; label: string; shortLabel: string; icon: React.ElementType; description: string }[] = [
  { id: 'summary', label: 'Summary', shortLabel: 'Summary', icon: BarChart3, description: 'Platform-wide KPIs at a glance' },
  { id: 'tickets-by-store', label: 'Tickets by Store', shortLabel: 'By Store', icon: Building2, description: 'Branch performance breakdown' },
  { id: 'tickets-by-island', label: 'Tickets by Island', shortLabel: 'By Island', icon: Globe, description: 'Ticket volumes grouped by island' },
  { id: 'parts-by-store', label: 'Parts by Store', shortLabel: 'Parts/Store', icon: Package, description: 'Parts inventory per branch' },
  { id: 'parts-by-island', label: 'Parts by Island', shortLabel: 'Parts/Island', icon: MapPin, description: 'Parts inventory grouped by island' },
  { id: 'techs-by-store', label: 'Technicians by Store', shortLabel: 'Techs/Store', icon: Users, description: 'Technician performance per branch' },
  { id: 'techs-by-island', label: 'Techs by Island', shortLabel: 'Techs/Island', icon: Wrench, description: 'Technician stats grouped by island' },
];

export function HQReportsClient({ stores }: { stores: StoreReportRow[] }) {
  const [active, setActive] = useState<ReportType>('summary');
  const current = REPORTS.find((r) => r.id === active)!;

  return (
    <div className='space-y-6'>
      {/* ── Report Selector ── */}
      <div className='overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0'>
        <div className='flex gap-2 min-w-max sm:min-w-0 sm:flex-wrap'>
          {REPORTS.map((r) => (
            <button
              key={r.id}
              onClick={() => setActive(r.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                active === r.id
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground'
              }`}
            >
              <r.icon className='h-3.5 w-3.5 shrink-0' />
              <span className='hidden sm:inline'>{r.label}</span>
              <span className='sm:hidden'>{r.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Active Report Header ── */}
      <div className='flex items-center gap-3'>
        <div className='rounded-xl bg-primary/10 p-2.5'>
          <current.icon className='h-5 w-5 text-primary' />
        </div>
        <div>
          <h2 className='text-lg font-bold'>{current.label}</h2>
          <p className='text-sm text-muted-foreground'>{current.description}</p>
        </div>
      </div>

      {/* ── Report Body ── */}
      {active === 'summary' && <SummaryKPI stores={stores} />}
      {active === 'tickets-by-store' && <TicketsByStore stores={stores} />}
      {active === 'tickets-by-island' && <TicketsByIsland stores={stores} />}
      {active === 'parts-by-store' && <PartsByStore stores={stores} />}
      {active === 'parts-by-island' && <PartsByIsland stores={stores} />}
      {active === 'techs-by-store' && <TechniciansByStore stores={stores} />}
      {active === 'techs-by-island' && <TechniciansByIsland stores={stores} />}
    </div>
  );
}
