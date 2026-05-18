'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { type ExportColumn } from '@/lib/export';
import { type StoreModularReportData, type StoreTicketRow } from '@/lib/actions/store-report-data';
import { Activity, AlertTriangle, BarChart3, Building2, CalendarRange, CheckCircle2, Clock, Package, Search, TrendingDown, TrendingUp, Users, Wrench } from 'lucide-react';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ReportType = 'overview' | 'technicians' | 'parts' | 'customers' | 'monthly';
type DateRange = 'week' | 'month' | 'last-month' | 'quarter' | 'year' | 'all';

// â”€â”€â”€ Report selector config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const REPORTS: { id: ReportType; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Ticket Overview', shortLabel: 'Overview', icon: BarChart3 },
  { id: 'technicians', label: 'Technician Performance', shortLabel: 'Techs', icon: Users },
  { id: 'parts', label: 'Parts & Inventory', shortLabel: 'Parts', icon: Package },
  { id: 'customers', label: 'Customer Health', shortLabel: 'Customers', icon: Building2 },
  { id: 'monthly', label: 'Monthly Review', shortLabel: 'Monthly', icon: CalendarRange },
];

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'quarter', label: 'Last 3 Months' },
  { value: 'year', label: 'This Year' },
];

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getDateBounds(range: DateRange): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (range === 'all') return { start: null, end: null };
  if (range === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (range === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  if (range === 'last-month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range === 'quarter') {
    const start = new Date(now);
    start.setMonth(now.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (range === 'year') {
    return { start: new Date(now.getFullYear(), 0, 1), end: now };
  }
  return { start: null, end: null };
}

function filterByRange(tickets: StoreTicketRow[], range: DateRange): StoreTicketRow[] {
  const { start, end } = getDateBounds(range);
  if (!start) return tickets;
  return tickets.filter((t) => {
    if (!t.createdAt) return false;
    const d = new Date(t.createdAt);
    return d >= start && (!end || d <= end);
  });
}

function daysSince(isoStr: string | null): number {
  if (!isoStr) return 0;
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(isoStr: string | null): string {
  if (!isoStr) return 'â€”';
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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

function statusBadge(status: string) {
  if (status === 'Closed') return <Badge className='bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] py-0 px-1.5'>Closed</Badge>;
  if (status === 'Assigned') return <Badge className='bg-primary/10 text-primary text-[10px] py-0 px-1.5'>Assigned</Badge>;
  return <Badge className='bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] py-0 px-1.5'>Open</Badge>;
}

function stockBadge(qty: number, min: number) {
  if (qty === 0)
    return (
      <Badge variant='destructive' className='text-[10px] py-0 px-1.5'>
        Out of Stock
      </Badge>
    );
  if (qty <= min) return <Badge className='bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] py-0 px-1.5'>Low Stock</Badge>;
  return <Badge className='bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] py-0 px-1.5'>OK</Badge>;
}

function getLast12Months(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  });
}

// â”€â”€â”€ KPI Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KpiCard({
  label,
  value,
  icon: Icon,
  color = 'text-primary',
  bg = 'bg-primary/10',
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  bg?: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className='pt-4 pb-3 px-4'>
        <div className='flex items-start justify-between gap-2'>
          <div>
            <p className='text-xs text-muted-foreground font-medium'>{label}</p>
            <p className='text-2xl font-bold mt-0.5'>{value}</p>
            {sub && <p className='text-xs text-muted-foreground mt-0.5'>{sub}</p>}
          </div>
          <div className={`rounded-lg p-2 shrink-0 ${bg}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// â”€â”€â”€ Report 1: Ticket Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OverviewReport({ data }: { data: StoreModularReportData }) {
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => filterByRange(data.tickets, dateRange), [data.tickets, dateRange]);

  const kpis = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let open = 0,
      assigned = 0,
      closed = 0,
      overdue = 0,
      totalClose = 0,
      closeCount = 0;
    filtered.forEach((t) => {
      if (t.status === 'Closed') {
        closed++;
        if (t.createdAt && t.closedAt) {
          totalClose += (new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          closeCount++;
        }
      } else if (t.status === 'Assigned') {
        assigned++;
        if (t.createdAt && new Date(t.createdAt) < sevenDaysAgo) overdue++;
      } else {
        open++;
        if (t.createdAt && new Date(t.createdAt) < sevenDaysAgo) overdue++;
      }
    });
    const total = open + assigned + closed;
    const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 0;
    const avgDays = closeCount > 0 ? Math.round((totalClose / closeCount) * 10) / 10 : null;
    return { open, assigned, closed, overdue, total, resolutionRate, avgDays };
  }, [filtered]);

  const overdueTickets = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return filtered.filter((t) => t.status !== 'Closed' && t.createdAt && new Date(t.createdAt) < sevenDaysAgo).sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  }, [filtered]);

  const tableRows = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (t) =>
        t.ticketNumber.toLowerCase().includes(q) || t.customerName.toLowerCase().includes(q) || (t.assignedToName ?? '').toLowerCase().includes(q) || (t.machineType ?? '').toLowerCase().includes(q),
    );
  }, [filtered, search]);

  const exportCols: ExportColumn[] = [
    { header: 'Ticket #', key: 'ticketNumber' },
    { header: 'Status', key: 'status' },
    { header: 'Customer', key: 'customerName' },
    { header: 'Machine', key: 'machineType', formatter: (v) => v ?? 'â€”' },
    { header: 'Serial #', key: 'serialNumber', formatter: (v) => v ?? 'â€”' },
    { header: 'Assigned To', key: 'assignedToName', formatter: (v) => v ?? 'Unassigned' },
    { header: 'Created', key: 'createdAt', formatter: fmtDate },
    { header: 'Closed', key: 'closedAt', formatter: (v) => (v ? fmtDate(v) : 'â€”') },
  ];

  return (
    <div className='space-y-5'>
      {/* Date range filter */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
        <p className='text-sm font-medium text-muted-foreground shrink-0'>Date range:</p>
        <div className='flex flex-wrap gap-2'>
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                dateRange === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3'>
        <KpiCard label='Total Tickets' value={kpis.total} icon={BarChart3} />
        <KpiCard label='Open' value={kpis.open} icon={Activity} color='text-amber-600 dark:text-amber-400' bg='bg-amber-500/10' />
        <KpiCard label='Assigned' value={kpis.assigned} icon={Wrench} />
        <KpiCard label='Closed' value={kpis.closed} icon={CheckCircle2} color='text-emerald-600 dark:text-emerald-400' bg='bg-emerald-500/10' />
        <KpiCard
          label='Overdue (7d+)'
          value={kpis.overdue}
          icon={AlertTriangle}
          color={kpis.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}
          bg={kpis.overdue > 0 ? 'bg-red-500/10' : 'bg-muted'}
        />
        <KpiCard label='Resolution Rate' value={`${kpis.resolutionRate}%`} icon={TrendingUp} color={resolutionColor(kpis.resolutionRate)} bg='bg-muted' />
        <KpiCard label='Avg Close Time' value={kpis.avgDays !== null ? `${kpis.avgDays}d` : 'â€”'} icon={Clock} color='text-muted-foreground' bg='bg-muted' />
      </div>

      {/* Status distribution */}
      {kpis.total > 0 && (
        <Card>
          <CardContent className='pt-4 pb-3 px-4'>
            <p className='text-xs font-semibold text-muted-foreground mb-2'>Status Distribution</p>
            <div className='flex h-3 rounded-full overflow-hidden gap-px'>
              {kpis.open > 0 && <div className='bg-amber-400 h-full' style={{ width: `${(kpis.open / kpis.total) * 100}%` }} title={`Open: ${kpis.open}`} />}
              {kpis.assigned > 0 && <div className='bg-primary h-full' style={{ width: `${(kpis.assigned / kpis.total) * 100}%` }} title={`Assigned: ${kpis.assigned}`} />}
              {kpis.closed > 0 && <div className='bg-emerald-500 h-full' style={{ width: `${(kpis.closed / kpis.total) * 100}%` }} title={`Closed: ${kpis.closed}`} />}
            </div>
            <div className='flex gap-4 mt-2'>
              {[
                { label: 'Open', color: 'bg-amber-400', count: kpis.open },
                { label: 'Assigned', color: 'bg-primary', count: kpis.assigned },
                { label: 'Closed', color: 'bg-emerald-500', count: kpis.closed },
              ].map((s) => (
                <span key={s.label} className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <span className={`h-2 w-2 rounded-full ${s.color}`} />
                  {s.label} ({s.count})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue alerts */}
      {overdueTickets.length > 0 && (
        <Card className='border-red-200 dark:border-red-900/50'>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-sm flex items-center gap-2 text-red-700 dark:text-red-400'>
              <AlertTriangle className='h-4 w-4' />
              Overdue Tickets â€” open or assigned for 7+ days ({overdueTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b text-left'>
                    <th className='pb-1.5 font-medium text-muted-foreground text-xs'>Ticket</th>
                    <th className='pb-1.5 font-medium text-muted-foreground text-xs'>Customer</th>
                    <th className='pb-1.5 font-medium text-muted-foreground text-xs hidden sm:table-cell'>Status</th>
                    <th className='pb-1.5 font-medium text-muted-foreground text-xs hidden md:table-cell'>Assigned To</th>
                    <th className='pb-1.5 font-medium text-muted-foreground text-xs text-right'>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueTickets.slice(0, 10).map((t) => (
                    <tr key={t.id} className='border-b last:border-0'>
                      <td className='py-2 font-mono text-xs text-primary'>{t.ticketNumber || t.id.slice(0, 8)}</td>
                      <td className='py-2'>{t.customerName}</td>
                      <td className='py-2 hidden sm:table-cell'>{statusBadge(t.status)}</td>
                      <td className='py-2 hidden md:table-cell text-muted-foreground'>{t.assignedToName ?? 'Unassigned'}</td>
                      <td className='py-2 text-right'>
                        <span className='text-red-600 dark:text-red-400 font-medium text-xs'>{daysSince(t.createdAt)}d</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets table */}
      <Card>
        <CardHeader className='pb-2 pt-4 px-4'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
            <CardTitle className='text-sm'>All Tickets ({tableRows.length})</CardTitle>
            <div className='flex items-center gap-2'>
              <div className='relative'>
                <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground' />
                <Input placeholder='Search ticketsâ€¦' value={search} onChange={(e) => setSearch(e.target.value)} className='h-8 pl-8 text-sm w-48' />
              </div>
              <ExportButton data={tableRows} columns={exportCols} filename={`tickets-${dateRange}`} />
            </div>
          </div>
        </CardHeader>
        <CardContent className='px-0 pb-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs pl-4'>Ticket #</TableHead>
                  <TableHead className='text-xs'>Status</TableHead>
                  <TableHead className='text-xs'>Customer</TableHead>
                  <TableHead className='text-xs hidden md:table-cell'>Machine</TableHead>
                  <TableHead className='text-xs hidden lg:table-cell'>Assigned To</TableHead>
                  <TableHead className='text-xs hidden sm:table-cell'>Created</TableHead>
                  <TableHead className='text-xs hidden lg:table-cell'>Closed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className='text-center text-muted-foreground py-8 text-sm'>
                      No tickets found
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.slice(0, 200).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className='font-mono text-xs text-primary pl-4'>{t.ticketNumber || t.id.slice(0, 8)}</TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                      <TableCell className='font-medium text-sm'>
                        {t.customerName}
                        <span className='block text-xs text-muted-foreground md:hidden'>{t.machineType ?? ''}</span>
                      </TableCell>
                      <TableCell className='text-sm hidden md:table-cell'>
                        {t.machineType ?? 'â€”'}
                        {t.serialNumber && <span className='block text-xs text-muted-foreground'>{t.serialNumber}</span>}
                      </TableCell>
                      <TableCell className='text-sm hidden lg:table-cell text-muted-foreground'>{t.assignedToName ?? 'Unassigned'}</TableCell>
                      <TableCell className='text-xs hidden sm:table-cell text-muted-foreground'>{fmtDate(t.createdAt)}</TableCell>
                      <TableCell className='text-xs hidden lg:table-cell text-muted-foreground'>{t.closedAt ? fmtDate(t.closedAt) : 'â€”'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// â”€â”€â”€ Report 2: Technician Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TechniciansReport({ data }: { data: StoreModularReportData }) {
  const rows = useMemo(() => {
    const techMap: Record<string, { name: string; email: string; open: number; assigned: number; closed: number }> = {};

    data.technicians.forEach((t) => {
      techMap[t.uid] = { name: t.name, email: t.email, open: 0, assigned: 0, closed: 0 };
    });

    data.tickets.forEach((t) => {
      if (!t.assignedTo) return;
      if (!techMap[t.assignedTo]) {
        techMap[t.assignedTo] = { name: t.assignedToName ?? 'Unknown', email: '', open: 0, assigned: 0, closed: 0 };
      }
      if (t.status === 'Closed') techMap[t.assignedTo].closed++;
      else if (t.status === 'Assigned') techMap[t.assignedTo].assigned++;
      else techMap[t.assignedTo].open++;
    });

    return Object.entries(techMap)
      .map(([uid, v]) => {
        const total = v.open + v.assigned + v.closed;
        const resolutionRate = total > 0 ? Math.round((v.closed / total) * 100) : 0;
        return { uid, ...v, total, resolutionRate };
      })
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const totalHandled = rows.reduce((a, r) => a + r.total, 0);
  const bestTech = [...rows].sort((a, b) => b.resolutionRate - a.resolutionRate)[0];
  const avgTickets = rows.length > 0 ? Math.round(totalHandled / rows.length) : 0;

  const exportCols: ExportColumn[] = [
    { header: 'Name', key: 'name' },
    { header: 'Email', key: 'email' },
    { header: 'Open', key: 'open' },
    { header: 'Assigned', key: 'assigned' },
    { header: 'Closed', key: 'closed' },
    { header: 'Total', key: 'total' },
    { header: 'Resolution %', key: 'resolutionRate', formatter: (v) => `${v}%` },
  ];

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <KpiCard label='Active Technicians' value={rows.filter((r) => r.total > 0).length} icon={Users} />
        <KpiCard label='Total Tickets Handled' value={totalHandled} icon={BarChart3} />
        <KpiCard
          label='Best Resolution Rate'
          value={bestTech ? `${bestTech.resolutionRate}%` : 'â€”'}
          icon={TrendingUp}
          color={bestTech ? resolutionColor(bestTech.resolutionRate) : 'text-muted-foreground'}
          bg='bg-muted'
          sub={bestTech?.name}
        />
        <KpiCard label='Avg Tickets / Tech' value={avgTickets} icon={Activity} color='text-muted-foreground' bg='bg-muted' />
      </div>

      <Card>
        <CardHeader className='pb-2 pt-4 px-4'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-sm'>Technician Breakdown</CardTitle>
            <ExportButton data={rows} columns={exportCols} filename='technician-performance' />
          </div>
        </CardHeader>
        <CardContent className='px-0 pb-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs pl-4 w-8'>#</TableHead>
                  <TableHead className='text-xs'>Technician</TableHead>
                  <TableHead className='text-xs text-right'>Open</TableHead>
                  <TableHead className='text-xs text-right hidden sm:table-cell'>Assigned</TableHead>
                  <TableHead className='text-xs text-right'>Closed</TableHead>
                  <TableHead className='text-xs text-right'>Total</TableHead>
                  <TableHead className='text-xs hidden md:table-cell'>Resolution</TableHead>
                  <TableHead className='text-xs hidden lg:table-cell'>Workload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.uid}>
                    <TableCell className='text-xs text-muted-foreground pl-4'>{i + 1}</TableCell>
                    <TableCell className='font-medium text-sm'>
                      {r.name}
                      <span className='block text-xs text-muted-foreground'>{r.email}</span>
                    </TableCell>
                    <TableCell className='text-right text-sm text-amber-700 dark:text-amber-400'>{r.open}</TableCell>
                    <TableCell className='text-right text-sm text-primary hidden sm:table-cell'>{r.assigned}</TableCell>
                    <TableCell className='text-right text-sm text-emerald-700 dark:text-emerald-400'>{r.closed}</TableCell>
                    <TableCell className='text-right text-sm font-semibold'>{r.total}</TableCell>
                    <TableCell className='hidden md:table-cell'>
                      <div className='flex items-center gap-2'>
                        <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden'>
                          <div className={`h-full rounded-full ${resolutionBg(r.resolutionRate)}`} style={{ width: `${r.resolutionRate}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${resolutionColor(r.resolutionRate)}`}>{r.resolutionRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className='hidden lg:table-cell'>
                      {totalHandled > 0 && (
                        <div className='flex items-center gap-2'>
                          <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden'>
                            <div className='h-full rounded-full bg-primary' style={{ width: `${(r.total / totalHandled) * 100}%` }} />
                          </div>
                          <span className='text-xs text-muted-foreground'>{Math.round((r.total / totalHandled) * 100)}%</span>
                        </div>
                      )}
                    </TableCell>
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

// â”€â”€â”€ Report 3: Parts & Inventory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PartsReport({ data }: { data: StoreModularReportData }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const categories = useMemo(() => ['all', ...Array.from(new Set(data.parts.map((p) => p.category))).sort()], [data.parts]);

  const outOfStock = data.parts.filter((p) => p.quantityInStock === 0);
  const lowStock = data.parts.filter((p) => p.quantityInStock > 0 && p.quantityInStock <= p.minQuantity);
  const okStock = data.parts.filter((p) => p.quantityInStock > p.minQuantity);

  const tableRows = useMemo(() => {
    const q = search.toLowerCase();
    return data.parts.filter((p) => {
      const matchCat = category === 'all' || p.category === category;
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [data.parts, search, category]);

  const exportCols: ExportColumn[] = [
    { header: 'Part Name', key: 'name' },
    { header: 'Category', key: 'category' },
    { header: 'In Stock', key: 'quantityInStock' },
    { header: 'Min Required', key: 'minQuantity' },
    { header: 'Status', key: 'quantityInStock', formatter: (v, row) => (v === 0 ? 'Out of Stock' : v <= (row?.minQuantity ?? 0) ? 'Low Stock' : 'OK') },
  ];

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <KpiCard label='Total Items' value={data.parts.length} icon={Package} />
        <KpiCard label='In Stock (OK)' value={okStock.length} icon={CheckCircle2} color='text-emerald-600 dark:text-emerald-400' bg='bg-emerald-500/10' />
        <KpiCard
          label='Low Stock'
          value={lowStock.length}
          icon={AlertTriangle}
          color={lowStock.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}
          bg={lowStock.length > 0 ? 'bg-amber-500/10' : 'bg-muted'}
        />
        <KpiCard
          label='Out of Stock'
          value={outOfStock.length}
          icon={AlertTriangle}
          color={outOfStock.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}
          bg={outOfStock.length > 0 ? 'bg-red-500/10' : 'bg-muted'}
        />
      </div>

      {outOfStock.length > 0 && (
        <Card className='border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10'>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-sm text-red-700 dark:text-red-400 flex items-center gap-2'>
              <AlertTriangle className='h-4 w-4' /> Out of Stock ({outOfStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4'>
            <div className='flex flex-wrap gap-2'>
              {outOfStock.map((p) => (
                <span key={p.id} className='rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 text-xs px-2.5 py-1 font-medium'>
                  {p.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card className='border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10'>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2'>
              <AlertTriangle className='h-4 w-4' /> Low Stock ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4'>
            <div className='flex flex-wrap gap-2'>
              {lowStock.map((p) => (
                <span key={p.id} className='rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs px-2.5 py-1 font-medium'>
                  {p.name} ({p.quantityInStock}/{p.minQuantity})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className='pb-2 pt-4 px-4'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
            <CardTitle className='text-sm'>Full Inventory ({tableRows.length})</CardTitle>
            <div className='flex items-center gap-2 flex-wrap'>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className='h-8 text-xs w-40'>
                  <SelectValue placeholder='All categories' />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c} className='text-xs'>
                      {c === 'all' ? 'All Categories' : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className='relative'>
                <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground' />
                <Input placeholder='Search partsâ€¦' value={search} onChange={(e) => setSearch(e.target.value)} className='h-8 pl-8 text-sm w-40' />
              </div>
              <ExportButton data={tableRows} columns={exportCols} filename='parts-inventory' />
            </div>
          </div>
        </CardHeader>
        <CardContent className='px-0 pb-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs pl-4'>Part Name</TableHead>
                  <TableHead className='text-xs hidden sm:table-cell'>Category</TableHead>
                  <TableHead className='text-xs text-right'>In Stock</TableHead>
                  <TableHead className='text-xs text-right hidden md:table-cell'>Min Required</TableHead>
                  <TableHead className='text-xs'>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='text-center py-8 text-muted-foreground text-sm'>
                      No parts found
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className='font-medium text-sm pl-4'>
                        {p.name}
                        <span className='block text-xs text-muted-foreground sm:hidden'>{p.category}</span>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground hidden sm:table-cell'>{p.category}</TableCell>
                      <TableCell className='text-right font-semibold text-sm'>{p.quantityInStock}</TableCell>
                      <TableCell className='text-right text-sm text-muted-foreground hidden md:table-cell'>{p.minQuantity}</TableCell>
                      <TableCell>{stockBadge(p.quantityInStock, p.minQuantity)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// â”€â”€â”€ Report 4: Customer Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CustomersReport({ data }: { data: StoreModularReportData }) {
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    // Build customer map from customers collection
    const map: Record<string, { companyName: string; isDisabled: boolean; open: number; assigned: number; closed: number; lastTicket: string | null }> = {};

    data.customers.forEach((c) => {
      map[c.id] = { companyName: c.companyName, isDisabled: c.isDisabled, open: 0, assigned: 0, closed: 0, lastTicket: null };
    });

    data.tickets.forEach((t) => {
      const key = t.customerId ?? `__name__${t.customerName}`;
      if (!map[key]) {
        map[key] = { companyName: t.customerName, isDisabled: false, open: 0, assigned: 0, closed: 0, lastTicket: null };
      }
      if (t.status === 'Closed') map[key].closed++;
      else if (t.status === 'Assigned') map[key].assigned++;
      else map[key].open++;

      if (t.createdAt && (!map[key].lastTicket || t.createdAt > map[key].lastTicket!)) {
        map[key].lastTicket = t.createdAt;
      }
    });

    return Object.entries(map)
      .map(([id, v]) => {
        const total = v.open + v.assigned + v.closed;
        const resolutionRate = total > 0 ? Math.round((v.closed / total) * 100) : 0;
        return { id, ...v, total, resolutionRate };
      })
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const withOpenTickets = rows.filter((r) => r.open + r.assigned > 0).length;
  const avgTickets = rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.total, 0) / rows.filter((r) => r.total > 0).length) : 0;
  const topCustomer = rows[0];

  const tableRows = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.companyName.toLowerCase().includes(q));
  }, [rows, search]);

  const exportCols: ExportColumn[] = [
    { header: 'Customer', key: 'companyName' },
    { header: 'Open', key: 'open' },
    { header: 'Assigned', key: 'assigned' },
    { header: 'Closed', key: 'closed' },
    { header: 'Total', key: 'total' },
    { header: 'Resolution %', key: 'resolutionRate', formatter: (v) => `${v}%` },
    { header: 'Last Ticket', key: 'lastTicket', formatter: fmtDate },
  ];

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <KpiCard label='Total Customers' value={data.customers.length} icon={Building2} />
        <KpiCard
          label='With Open Tickets'
          value={withOpenTickets}
          icon={Activity}
          color={withOpenTickets > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}
          bg={withOpenTickets > 0 ? 'bg-amber-500/10' : 'bg-muted'}
        />
        <KpiCard label='Avg Tickets / Customer' value={avgTickets} icon={BarChart3} color='text-muted-foreground' bg='bg-muted' />
        <KpiCard label='Most Active' value={topCustomer?.total ?? 0} icon={TrendingUp} sub={topCustomer?.companyName} />
      </div>

      <Card>
        <CardHeader className='pb-2 pt-4 px-4'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
            <CardTitle className='text-sm'>Customer Breakdown ({tableRows.length})</CardTitle>
            <div className='flex items-center gap-2'>
              <div className='relative'>
                <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground' />
                <Input placeholder='Search customersâ€¦' value={search} onChange={(e) => setSearch(e.target.value)} className='h-8 pl-8 text-sm w-44' />
              </div>
              <ExportButton data={tableRows} columns={exportCols} filename='customer-health' />
            </div>
          </div>
        </CardHeader>
        <CardContent className='px-0 pb-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs pl-4'>Customer</TableHead>
                  <TableHead className='text-xs text-right'>Open</TableHead>
                  <TableHead className='text-xs text-right hidden sm:table-cell'>Assigned</TableHead>
                  <TableHead className='text-xs text-right'>Closed</TableHead>
                  <TableHead className='text-xs text-right'>Total</TableHead>
                  <TableHead className='text-xs hidden md:table-cell'>Resolution</TableHead>
                  <TableHead className='text-xs hidden lg:table-cell'>Last Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className='text-center py-8 text-muted-foreground text-sm'>
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((r) => (
                    <TableRow key={r.id} className={r.open >= 3 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                      <TableCell className='font-medium text-sm pl-4'>
                        {r.companyName}
                        {r.open >= 3 && <Badge className='ml-2 text-[10px] py-0 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'>{r.open} open</Badge>}
                        {r.isDisabled && (
                          <Badge variant='secondary' className='ml-2 text-[10px] py-0 px-1.5'>
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-right text-sm text-amber-700 dark:text-amber-400'>{r.open}</TableCell>
                      <TableCell className='text-right text-sm text-primary hidden sm:table-cell'>{r.assigned}</TableCell>
                      <TableCell className='text-right text-sm text-emerald-700 dark:text-emerald-400'>{r.closed}</TableCell>
                      <TableCell className='text-right text-sm font-semibold'>{r.total}</TableCell>
                      <TableCell className='hidden md:table-cell'>
                        {r.total > 0 ? (
                          <div className='flex items-center gap-2'>
                            <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden'>
                              <div className={`h-full rounded-full ${resolutionBg(r.resolutionRate)}`} style={{ width: `${r.resolutionRate}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${resolutionColor(r.resolutionRate)}`}>{r.resolutionRate}%</span>
                          </div>
                        ) : (
                          <span className='text-xs text-muted-foreground'>â€”</span>
                        )}
                      </TableCell>
                      <TableCell className='text-xs text-muted-foreground hidden lg:table-cell'>{fmtDate(r.lastTicket)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// â”€â”€â”€ Report 5: Monthly Review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MonthlyReport({ data }: { data: StoreModularReportData }) {
  const months = useMemo(() => getLast12Months(), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);

  const { current, previous } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevMonthStr = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;

    function getMonthStats(monthStr: string) {
      const [y, m] = monthStr.split('-').map(Number);
      const opened = data.tickets.filter((t) => {
        if (!t.createdAt) return false;
        const d = new Date(t.createdAt);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      });
      const closed = data.tickets.filter((t) => {
        if (!t.closedAt) return false;
        const d = new Date(t.closedAt);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      });

      const techActivity: Record<string, { name: string; open: number; assigned: number; closed: number }> = {};
      opened.forEach((t) => {
        if (!t.assignedTo) return;
        if (!techActivity[t.assignedTo]) techActivity[t.assignedTo] = { name: t.assignedToName ?? 'Unknown', open: 0, assigned: 0, closed: 0 };
        if (t.status === 'Closed') techActivity[t.assignedTo].closed++;
        else if (t.status === 'Assigned') techActivity[t.assignedTo].assigned++;
        else techActivity[t.assignedTo].open++;
      });

      const totalOpened = opened.length;
      const totalClosed = closed.length;
      const totalForRate = opened.length;
      const closedInMonth = opened.filter((t) => t.status === 'Closed').length;
      const resolutionRate = totalForRate > 0 ? Math.round((closedInMonth / totalForRate) * 100) : 0;

      return {
        totalOpened,
        totalClosed,
        resolutionRate,
        net: totalOpened - totalClosed,
        techActivity: Object.entries(techActivity)
          .map(([uid, v]) => ({ uid, ...v, total: v.open + v.assigned + v.closed }))
          .sort((a, b) => b.total - a.total),
      };
    }

    return { current: getMonthStats(selectedMonth), previous: getMonthStats(prevMonthStr) };
  }, [data.tickets, selectedMonth]);

  function DeltaBadge({ curr, prev }: { curr: number; prev: number }) {
    const delta = curr - prev;
    if (delta === 0) return <span className='text-xs text-muted-foreground'>no change</span>;
    const isGood = delta < 0; // fewer open tickets is good; but for closed more is good
    return (
      <span className={`text-xs flex items-center gap-0.5 ${delta > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {delta > 0 ? <TrendingUp className='h-3 w-3' /> : <TrendingDown className='h-3 w-3' />}
        {delta > 0 ? '+' : ''}
        {delta} vs prev month
      </span>
    );
  }

  const exportCols: ExportColumn[] = [
    { header: 'Technician', key: 'name' },
    { header: 'Open', key: 'open' },
    { header: 'Assigned', key: 'assigned' },
    { header: 'Closed', key: 'closed' },
    { header: 'Total', key: 'total' },
  ];

  return (
    <div className='space-y-5'>
      {/* Month selector */}
      <div className='flex items-center gap-3'>
        <p className='text-sm font-medium text-muted-foreground shrink-0'>Month:</p>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className='h-9 text-sm w-52'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value} className='text-sm'>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards with delta */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='pt-4 pb-3 px-4'>
            <div className='flex items-start justify-between gap-2'>
              <div>
                <p className='text-xs text-muted-foreground font-medium'>Tickets Opened</p>
                <p className='text-2xl font-bold mt-0.5'>{current.totalOpened}</p>
                <DeltaBadge curr={current.totalOpened} prev={previous.totalOpened} />
              </div>
              <div className='rounded-lg p-2 shrink-0 bg-primary/10'>
                <BarChart3 className='h-4 w-4 text-primary' />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3 px-4'>
            <div className='flex items-start justify-between gap-2'>
              <div>
                <p className='text-xs text-muted-foreground font-medium'>Tickets Closed</p>
                <p className='text-2xl font-bold mt-0.5'>{current.totalClosed}</p>
                <DeltaBadge curr={current.totalClosed} prev={previous.totalClosed} />
              </div>
              <div className='rounded-lg p-2 shrink-0 bg-emerald-500/10'>
                <CheckCircle2 className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3 px-4'>
            <div className='flex items-start justify-between gap-2'>
              <div>
                <p className='text-xs text-muted-foreground font-medium'>Net Flow</p>
                <p className={`text-2xl font-bold mt-0.5 ${current.net > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {current.net > 0 ? '+' : ''}
                  {current.net}
                </p>
                <p className='text-xs text-muted-foreground'>opened âˆ’ closed</p>
              </div>
              <div className={`rounded-lg p-2 shrink-0 ${current.net > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                {current.net > 0 ? <TrendingUp className='h-4 w-4 text-amber-600 dark:text-amber-400' /> : <TrendingDown className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3 px-4'>
            <div className='flex items-start justify-between gap-2'>
              <div>
                <p className='text-xs text-muted-foreground font-medium'>Resolution Rate</p>
                <p className='text-2xl font-bold mt-0.5'>{current.resolutionRate}%</p>
                <DeltaBadge curr={current.resolutionRate} prev={previous.resolutionRate} />
              </div>
              <div className='rounded-lg p-2 shrink-0 bg-muted'>
                <TrendingUp className={`h-4 w-4 ${resolutionColor(current.resolutionRate)}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technician activity for this month */}
      <Card>
        <CardHeader className='pb-2 pt-4 px-4'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-sm'>Technician Activity This Month</CardTitle>
            <ExportButton data={current.techActivity} columns={exportCols} filename={`monthly-techs-${selectedMonth}`} />
          </div>
        </CardHeader>
        <CardContent className='px-0 pb-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs pl-4'>Technician</TableHead>
                  <TableHead className='text-xs text-right'>Open</TableHead>
                  <TableHead className='text-xs text-right hidden sm:table-cell'>Assigned</TableHead>
                  <TableHead className='text-xs text-right'>Closed</TableHead>
                  <TableHead className='text-xs text-right'>Total This Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.techActivity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='text-center py-8 text-muted-foreground text-sm'>
                      No technician activity this month
                    </TableCell>
                  </TableRow>
                ) : (
                  current.techActivity.map((t) => (
                    <TableRow key={t.uid}>
                      <TableCell className='font-medium text-sm pl-4'>{t.name}</TableCell>
                      <TableCell className='text-right text-sm text-amber-700 dark:text-amber-400'>{t.open}</TableCell>
                      <TableCell className='text-right text-sm text-primary hidden sm:table-cell'>{t.assigned}</TableCell>
                      <TableCell className='text-right text-sm text-emerald-700 dark:text-emerald-400'>{t.closed}</TableCell>
                      <TableCell className='text-right text-sm font-semibold'>{t.total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// â”€â”€â”€ Main Client Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function StoreReportsClient({ data }: { data: StoreModularReportData }) {
  const [selected, setSelected] = useState<ReportType>('overview');

  return (
    <div className='space-y-5'>
      {/* Horizontal report selector */}
      <div className='overflow-x-auto pb-1'>
        <div className='flex gap-2 min-w-max'>
          {REPORTS.map((r) => {
            const Icon = r.icon;
            const active = selected === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Icon className='h-4 w-4 shrink-0' />
                <span className='hidden sm:inline'>{r.label}</span>
                <span className='sm:hidden'>{r.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active report */}
      {selected === 'overview' && <OverviewReport data={data} />}
      {selected === 'technicians' && <TechniciansReport data={data} />}
      {selected === 'parts' && <PartsReport data={data} />}
      {selected === 'customers' && <CustomersReport data={data} />}
      {selected === 'monthly' && <MonthlyReport data={data} />}
    </div>
  );
}
