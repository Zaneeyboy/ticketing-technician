'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReportData } from '@/components/reports/report-data-provider';
import { ExportButton } from '@/components/export-button';
import { buildReportMetadata, type ExportColumn } from '@/lib/export';
import { ArrowLeft, CalendarRange, Clock, TicketCheck, Users, Wrench } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_ORDER = ['Open', 'In Progress', 'Pending Parts', 'Closed'];

const TICKET_STATUS_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Status', key: 'status' },
  { header: 'Count', key: 'count' },
  { header: 'Share (%)', key: 'share' },
];

const TECH_SUMMARY_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Technician', key: 'technicianName' },
  { header: 'Visits Completed', key: 'visitsCompleted' },
  { header: 'Scheduled Visits', key: 'scheduledVisits' },
  { header: 'Missed Visits', key: 'missedVisits' },
  { header: 'Visit Rate (%)', key: 'visitRate' },
  { header: 'Hours Logged', key: 'hoursLogged' },
];

const PARTS_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Part Name', key: 'partName' },
  { header: 'Qty Used', key: 'qty' },
  { header: 'Times Used', key: 'timesUsed' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getYearMonthOptions(tickets: { createdAt: string | null }[]) {
  const seen = new Set<string>();
  const now = new Date();
  seen.add(`${now.getFullYear()}-${now.getMonth()}`);
  tickets.forEach((t) => {
    if (!t.createdAt) return;
    const d = new Date(t.createdAt);
    if (!Number.isNaN(d.getTime())) seen.add(`${d.getFullYear()}-${d.getMonth()}`);
  });
  return Array.from(seen)
    .map((key) => {
      const [year, month] = key.split('-').map(Number);
      return { year, month, key };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MonthlyReport() {
  const data = useReportData();
  const router = useRouter();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed

  const yearMonthOptions = useMemo(() => getYearMonthOptions(data.tickets), [data.tickets]);

  const uniqueYears = useMemo(() => [...new Set(yearMonthOptions.map((o) => o.year))].sort((a, b) => b - a), [yearMonthOptions]);

  // Build lookup maps
  const technicianMap = useMemo(() => new Map(data.technicians.map((t) => [t.id, t])), [data.technicians]);

  // All tickets and work logs for the selected month
  const monthStart = useMemo(() => new Date(selectedYear, selectedMonth, 1).getTime(), [selectedYear, selectedMonth]);
  const monthEnd = useMemo(() => new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).getTime(), [selectedYear, selectedMonth]);

  const inRange = (value?: string | null) => {
    if (!value) return false;
    const t = new Date(value).getTime();
    return !Number.isNaN(t) && t >= monthStart && t <= monthEnd;
  };

  const monthTickets = useMemo(() => data.tickets.filter((t) => inRange(t.createdAt)), [data.tickets, monthStart, monthEnd]);
  const monthWorkLogs = useMemo(
    () =>
      data.workLogs.filter((l) => {
        const logDate = l.arrivalTime || l.departureTime;
        return inRange(logDate);
      }),
    [data.workLogs, monthStart, monthEnd],
  );

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalTickets = monthTickets.length;
  const closedTickets = monthTickets.filter((t) => t.status === 'Closed').length;
  const totalHours = monthWorkLogs.reduce((s, l) => s + (l.hoursWorked ?? 0), 0);
  const activeTechIds = new Set(monthWorkLogs.map((l) => l.recordedBy).filter(Boolean));

  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    monthTickets.forEach((t) => {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    });
    return counts;
  }, [monthTickets]);

  const statusRows = useMemo(
    () =>
      STATUS_ORDER.filter((s) => statusCounts[s] !== undefined)
        .map((status) => ({
          status,
          count: statusCounts[status],
          share: totalTickets > 0 ? Math.round((statusCounts[status] / totalTickets) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count),
    [statusCounts, totalTickets],
  );

  // ── Technician summary ────────────────────────────────────────────────────
  const techRows = useMemo(() => {
    const techVisits: Record<string, Set<string>> = {};
    const techHours: Record<string, number> = {};
    monthWorkLogs.forEach((l) => {
      const techId = l.recordedBy;
      if (!techId) return;
      if (!techVisits[techId]) techVisits[techId] = new Set();
      techVisits[techId].add(l.ticketId);
      techHours[techId] = (techHours[techId] ?? 0) + (l.hoursWorked ?? 0);
    });

    // Scheduled visits: tickets with scheduledVisitDate in month assigned to that tech
    const scheduledByTech: Record<string, number> = {};
    data.tickets.forEach((t) => {
      if (t.assignedTo && inRange(t.scheduledVisitDate)) {
        scheduledByTech[t.assignedTo] = (scheduledByTech[t.assignedTo] ?? 0) + 1;
      }
    });

    return Object.entries(techVisits)
      .map(([techId, ticketSet]) => {
        const tech = technicianMap.get(techId);
        const completed = ticketSet.size;
        const scheduled = scheduledByTech[techId] ?? 0;
        const missed = Math.max(0, scheduled - completed);
        const visitRate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : null;
        return {
          technicianId: techId,
          technicianName: tech?.name ?? 'Unknown',
          visitsCompleted: completed,
          scheduledVisits: scheduled,
          missedVisits: missed,
          visitRate,
          hoursLogged: parseFloat((techHours[techId] ?? 0).toFixed(2)),
        };
      })
      .sort((a, b) => b.visitsCompleted - a.visitsCompleted);
  }, [monthWorkLogs, data.tickets, monthStart, monthEnd, technicianMap]);

  // ── Top parts ─────────────────────────────────────────────────────────────
  const topParts = useMemo(() => {
    const partsMap: Record<string, { qty: number; timesUsed: number }> = {};
    monthWorkLogs.forEach((l) => {
      (l.partsUsed ?? []).forEach((p) => {
        if (!partsMap[p.partName]) partsMap[p.partName] = { qty: 0, timesUsed: 0 };
        partsMap[p.partName].qty += p.quantity;
        partsMap[p.partName].timesUsed += 1;
      });
    });
    return Object.entries(partsMap)
      .map(([partName, stats]) => ({ partName, ...stats }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [monthWorkLogs]);

  // ── Export data ───────────────────────────────────────────────────────────
  const title = `Monthly Summary — ${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
  const exportMetadata = useMemo(
    () =>
      buildReportMetadata(
        title,
        { statuses: [], technicianIds: [], customerIds: [], partNames: [], partCategories: [] },
        {
          technicians: data.technicians,
          customers: data.customers,
        },
      ),
    [title, data.technicians, data.customers],
  );

  const statusExportRows = useMemo(() => statusRows.map((r) => ({ status: r.status, count: r.count, share: `${r.share}%` })), [statusRows]);
  const closureRate = totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0;

  return (
    <div className='space-y-6'>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className='flex flex-wrap items-center gap-3'>
        <Button variant='outline' size='sm' onClick={() => router.back()} className='gap-2 shrink-0'>
          <ArrowLeft className='h-4 w-4' />
          Back
        </Button>

        {/* Period selectors */}
        <div className='flex items-center gap-2 flex-1 flex-wrap'>
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className='w-24'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {uniqueYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ExportButton
          data={statusExportRows}
          columns={TICKET_STATUS_EXPORT_COLUMNS}
          filename={`monthly-summary-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
          sheetName='Status Breakdown'
          title={title}
          subtitle={`Generated ${new Date().toLocaleDateString()}`}
          metadata={exportMetadata}
        />
      </div>

      {/* ── Title ──────────────────────────────────────────────────────── */}
      <div className='flex items-center gap-3'>
        <div className='rounded-lg bg-primary/10 p-2.5 shrink-0'>
          <CalendarRange className='h-5 w-5 text-primary' />
        </div>
        <div>
          <h2 className='text-xl font-semibold'>{title}</h2>
          <p className='text-sm text-muted-foreground'>Store-level monthly performance overview</p>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-1.5'>
              <TicketCheck className='h-3.5 w-3.5' />
              Total Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{totalTickets}</div>
            <p className='text-xs text-muted-foreground mt-0.5'>Created this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-1.5'>
              <TicketCheck className='h-3.5 w-3.5' />
              Closed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{closedTickets}</div>
            <p className='text-xs text-muted-foreground mt-0.5'>{totalTickets > 0 ? `${closureRate}% closure rate` : 'No tickets'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-1.5'>
              <Users className='h-3.5 w-3.5' />
              Active Technicians
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{activeTechIds.size}</div>
            <p className='text-xs text-muted-foreground mt-0.5'>Logged work this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-1.5'>
              <Clock className='h-3.5 w-3.5' />
              Hours Logged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{totalHours.toFixed(1)}h</div>
            <p className='text-xs text-muted-foreground mt-0.5'>Across all work visits</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Status Breakdown ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between pb-3'>
          <CardTitle>Ticket Status Breakdown</CardTitle>
          <ExportButton
            data={statusExportRows}
            columns={TICKET_STATUS_EXPORT_COLUMNS}
            filename={`monthly-status-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
            sheetName='Status Breakdown'
            title={`${title} — Status Breakdown`}
          />
        </CardHeader>
        <CardContent>
          {statusRows.length === 0 ? (
            <div className='flex flex-col items-center gap-2 py-8 text-muted-foreground'>
              <TicketCheck className='h-8 w-8 opacity-30' />
              <p className='text-sm font-medium'>No tickets for this month</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {statusRows.map((row) => (
                <div key={row.status} className='flex items-center gap-3'>
                  <div className='w-28 shrink-0'>
                    <Badge
                      variant='outline'
                      className={
                        row.status === 'Closed'
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                          : row.status === 'In Progress'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                            : row.status === 'Pending Parts'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                              : 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30'
                      }
                    >
                      {row.status}
                    </Badge>
                  </div>
                  <div className='flex-1 h-2 rounded-full bg-muted overflow-hidden'>
                    <div
                      className={`h-2 rounded-full transition-all ${
                        row.status === 'Closed' ? 'bg-green-500' : row.status === 'In Progress' ? 'bg-blue-500' : row.status === 'Pending Parts' ? 'bg-amber-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${row.share}%` }}
                    />
                  </div>
                  <div className='w-16 shrink-0 text-right'>
                    <span className='font-semibold text-sm'>{row.count}</span>
                    <span className='text-xs text-muted-foreground ml-1'>({row.share}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Technician Visit Summary ────────────────────────────────────── */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between pb-3'>
          <CardTitle>Technician Visit Summary</CardTitle>
          <ExportButton
            data={techRows.map((r) => ({ ...r, visitRate: r.visitRate !== null ? `${r.visitRate}%` : '—', hoursLogged: r.hoursLogged.toFixed(2) }))}
            columns={TECH_SUMMARY_EXPORT_COLUMNS}
            filename={`monthly-techs-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
            sheetName='Technician Summary'
            title={`${title} — Technician Summary`}
          />
        </CardHeader>
        <CardContent>
          {techRows.length === 0 ? (
            <div className='flex flex-col items-center gap-2 py-8 text-muted-foreground'>
              <Users className='h-8 w-8 opacity-30' />
              <p className='text-sm font-medium'>No work logged this month</p>
            </div>
          ) : (
            <div className='border rounded-lg overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead className='text-right'>Visits Done</TableHead>
                    <TableHead className='text-right hidden sm:table-cell'>Scheduled</TableHead>
                    <TableHead className='text-right hidden sm:table-cell'>Missed</TableHead>
                    <TableHead className='text-right'>Visit Rate</TableHead>
                    <TableHead className='text-right hidden md:table-cell'>Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {techRows.map((row) => (
                    <TableRow key={row.technicianId}>
                      <TableCell className='font-medium'>
                        <div>{row.technicianName}</div>
                        <div className='text-xs text-muted-foreground md:hidden'>{row.hoursLogged.toFixed(1)}h logged</div>
                      </TableCell>
                      <TableCell className='text-right'>{row.visitsCompleted}</TableCell>
                      <TableCell className='text-right hidden sm:table-cell text-muted-foreground'>{row.scheduledVisits}</TableCell>
                      <TableCell className='text-right hidden sm:table-cell'>
                        {row.missedVisits > 0 ? <span className='text-destructive font-medium'>{row.missedVisits}</span> : <span className='text-muted-foreground'>0</span>}
                      </TableCell>
                      <TableCell className='text-right'>
                        {row.visitRate !== null ? (
                          <Badge
                            variant='outline'
                            className={
                              row.visitRate >= 80
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                                : row.visitRate >= 60
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30'
                            }
                          >
                            {row.visitRate}%
                          </Badge>
                        ) : (
                          <span className='text-muted-foreground text-xs'>—</span>
                        )}
                      </TableCell>
                      <TableCell className='text-right hidden md:table-cell'>{row.hoursLogged.toFixed(1)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Top Parts Used ──────────────────────────────────────────────── */}
      {topParts.length > 0 && (
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-3'>
            <CardTitle>Top Parts Used</CardTitle>
            <ExportButton
              data={topParts}
              columns={PARTS_EXPORT_COLUMNS}
              filename={`monthly-parts-${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
              sheetName='Parts Usage'
              title={`${title} — Parts Usage`}
            />
          </CardHeader>
          <CardContent>
            <div className='space-y-2.5'>
              {topParts.map((part, idx) => {
                const maxQty = topParts[0].qty;
                const pct = maxQty > 0 ? Math.round((part.qty / maxQty) * 100) : 0;
                return (
                  <div key={part.partName} className='flex items-center gap-3'>
                    <span className='w-5 shrink-0 text-xs text-muted-foreground text-right'>{idx + 1}</span>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between gap-2 mb-1'>
                        <span className='text-sm font-medium truncate'>{part.partName}</span>
                        <div className='flex items-center gap-2 shrink-0'>
                          <span className='text-sm font-semibold'>×{part.qty}</span>
                          <span className='text-xs text-muted-foreground hidden sm:inline'>
                            ({part.timesUsed} {part.timesUsed === 1 ? 'job' : 'jobs'})
                          </span>
                        </div>
                      </div>
                      <div className='h-1.5 w-full rounded-full bg-muted overflow-hidden'>
                        <div className='h-1.5 rounded-full bg-primary/70' style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty month notice */}
      {totalTickets === 0 && monthWorkLogs.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-12 text-muted-foreground'>
            <CalendarRange className='h-10 w-10 opacity-25' />
            <p className='font-medium'>
              No data for {MONTH_NAMES[selectedMonth]} {selectedYear}
            </p>
            <p className='text-sm text-center'>Try selecting a different month, or run the seed to generate test data.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
