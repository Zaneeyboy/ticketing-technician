'use client';

import { useCallback, useState, useTransition } from 'react';
import { AlertCircle, Calendar, CalendarRange, CheckCircle2, ChevronDown, Clock, Loader2, ShieldAlert, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/export-button';
import { type ExportColumn, type ExportMetadata } from '@/lib/export';
import { getServiceReport, type DailyTicketEntry, type PeriodServiceReportData, type TechDayEntry, type TechnicianPeriodRow, type UnassignedDayGroup } from '@/lib/actions/daily-service-report';

// --- Date Helpers -------------------------------------------------------------

const toTodayStr = () => new Date().toISOString().slice(0, 10);

const toFirstOfMonthStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const getNDaysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const getStartOfWeekStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString().slice(0, 10);
};

const getFirstOfLastMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}-01`
    .replace('-00-', `-${String(d.getMonth() === 0 ? 12 : d.getMonth()).padStart(2, '0')}-`)
    .split('-')
    .map((p, i) => {
      if (i === 0 && d.getMonth() === 0) return String(d.getFullYear() - 1);
      return p;
    })
    .join('-');
};

const getLastOfLastMonthStr = () => {
  const d = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
  return d.toISOString().slice(0, 10);
};

const getFirstOfYearStr = () => `${new Date().getFullYear()}-01-01`;

// Compute first-of-last-month cleanly
const getLastMonthRange = (): { start: string; end: string } => {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 86400000);
  const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1);
  return {
    start: firstOfLastMonth.toISOString().slice(0, 10),
    end: lastOfLastMonth.toISOString().slice(0, 10),
  };
};

const formatDayLabel = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const formatDateShort = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatTime = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// --- Date Range Presets -------------------------------------------------------

interface DatePreset {
  id: string;
  label: string;
  getRange: () => { start: string; end: string };
}

const DATE_PRESETS: DatePreset[] = [
  {
    id: 'today',
    label: 'Today',
    getRange: () => {
      const t = toTodayStr();
      return { start: t, end: t };
    },
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const y = getNDaysAgoStr(1);
      return { start: y, end: y };
    },
  },
  { id: 'last7', label: 'Last 7 Days', getRange: () => ({ start: getNDaysAgoStr(6), end: toTodayStr() }) },
  { id: 'thisweek', label: 'This Week', getRange: () => ({ start: getStartOfWeekStr(), end: toTodayStr() }) },
  { id: 'last30', label: 'Last 30 Days', getRange: () => ({ start: getNDaysAgoStr(29), end: toTodayStr() }) },
  { id: 'thismonth', label: 'This Month', getRange: () => ({ start: toFirstOfMonthStr(), end: toTodayStr() }) },
  { id: 'lastmonth', label: 'Last Month', getRange: () => getLastMonthRange() },
  { id: 'thisyear', label: 'This Year', getRange: () => ({ start: getFirstOfYearStr(), end: toTodayStr() }) },
];

// --- Export Helpers -----------------------------------------------------------

// Columns mirror the Excel format the business already uses.
const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'technicianName', header: 'Technician Name' },
  { key: 'date', header: 'Date' },
  { key: 'clientName', header: 'Client Name' },
  { key: 'dailyActivity', header: 'Daily Activity' },
  { key: 'comments', header: 'Comments' },
  { key: 'workDescription', header: 'Description of Work Carried Out' },
  { key: 'partsUsed', header: 'Parts Used/Replaced' },
];

function visitActivityLabel(activity: string): string {
  if (activity === 'visited_scheduled') return 'Customer visited as per schedule';
  if (activity === 'visited_emergency') return 'Emergency breakdown visit';
  return 'Customer not visited';
}

function sortEntries(entries: DailyTicketEntry[]): DailyTicketEntry[] {
  const order: Record<string, number> = { visited_scheduled: 0, visited_emergency: 1, not_visited: 2 };
  return [...entries].sort((a, b) => (order[a.visitActivity] ?? 3) - (order[b.visitActivity] ?? 3));
}

function flattenForExport(data: PeriodServiceReportData) {
  const rows: Record<string, unknown>[] = [];

  const processDay = (techName: string, dateStr: string, entries: DailyTicketEntry[]) => {
    const sorted = sortEntries(entries);

    for (const entry of sorted) {
      const { ticket, workLogs, visitActivity } = entry;
      const activityLabel = visitActivityLabel(visitActivity);
      const comments = ticket.briefDescription || ticket.issueDescription || '';

      if (workLogs.length === 0) {
        // No work logged — one row per machine
        const machines = ticket.machines.length > 0 ? ticket.machines : [{ machineId: '', machineType: '', serialNumber: '', customerName: 'Unknown', priority: undefined }];
        machines.forEach((m) => {
          rows.push({
            technicianName: techName,
            date: formatDateShort(dateStr),
            clientName: m.customerName,
            dailyActivity: activityLabel,
            comments,
            workDescription: '',
            partsUsed: '',
          });
        });
      } else {
        workLogs.forEach((wl) => {
          const customerName = ticket.machines.find((m) => m.machineId === wl.machineId)?.customerName || ticket.machines[0]?.customerName || '';
          rows.push({
            technicianName: techName,
            date: formatDateShort(dateStr),
            clientName: customerName,
            dailyActivity: activityLabel,
            comments,
            workDescription: wl.workPerformed || '',
            partsUsed: wl.partsUsed.map((p) => `${p.partName} x${p.quantity}`).join(', '),
          });
        });
      }
    }

    // Day summary row
    const visited = entries.filter((e) => e.visitActivity === 'visited_scheduled').length;
    const emergency = entries.filter((e) => e.visitActivity === 'visited_emergency').length;
    const missed = entries.filter((e) => e.visitActivity === 'not_visited').length;
    const totalVisits = visited + emergency;
    rows.push({
      technicianName: '',
      date: '',
      clientName: '',
      dailyActivity: `-- Day Summary: Scheduled Visits: ${visited + missed} | Completed: ${visited} | Missed: ${missed} | Emergency: ${emergency} | Total Visits: ${totalVisits}`,
      comments: '',
      workDescription: '',
      partsUsed: '',
    });
    rows.push({ technicianName: '', date: '', clientName: '', dailyActivity: '', comments: '', workDescription: '', partsUsed: '' }); // blank spacer
  };

  for (const tech of data.technicians) {
    for (const day of tech.days) {
      processDay(tech.technicianName, day.dateStr, day.tickets);
    }
  }
  for (const { dateStr, entries } of data.unassignedDays) {
    processDay('Unassigned', dateStr, entries);
  }

  return rows;
}

function buildExportMetadata(data: PeriodServiceReportData): ExportMetadata {
  return {
    title: 'Tech Team Service Report',
    subtitle: `${formatDateShort(data.startDate)} – ${formatDateShort(data.endDate)}`,

    filters: [
      { label: 'Period', value: `${formatDateShort(data.startDate)} – ${formatDateShort(data.endDate)}` },
      { label: 'Calendar Days', value: String(data.calendarDays) },
      { label: 'Total Planned Visits', value: String(data.totalScheduled) },
      { label: 'Visits Completed', value: String(data.totalVisited) },
      { label: 'Visits Missed', value: String(data.totalMissed) },
      { label: 'Emergency Visits', value: String(data.totalEmergency) },
    ],
  };
}

// --- Sub-Components -----------------------------------------------------------

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <Card>
      <CardContent className='flex items-center gap-3 py-4 px-4 sm:px-5'>
        <div className={`p-2 rounded-lg shrink-0 ${color}`}>
          <Icon className='h-4 w-4' />
        </div>
        <div className='min-w-0'>
          <p className='text-xl font-bold leading-none'>{value}</p>
          <p className='text-xs text-muted-foreground mt-1 leading-tight'>{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TicketCard({ entry, dateStr }: { entry: DailyTicketEntry; dateStr: string }) {
  const { ticket, workLogs, visitActivity } = entry;
  const isEmergency = visitActivity === 'visited_emergency';
  const isNotVisited = visitActivity === 'not_visited';
  const hasHighPriority = ticket.machines.some((m) => m.priority === 'High' || m.priority === 'Urgent');

  const cardClass = isNotVisited
    ? 'block rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors p-3 sm:p-4 no-underline'
    : isEmergency
      ? 'block rounded-lg border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 hover:bg-red-100/40 dark:hover:bg-red-900/30 transition-colors p-3 sm:p-4 no-underline'
      : 'block rounded-lg border bg-card hover:bg-muted/40 transition-colors p-3 sm:p-4 no-underline';

  return (
    <a href={`/tickets/${ticket.id}`} target='_blank' rel='noopener noreferrer' className={cardClass}>
      <div className='flex flex-wrap items-start gap-2 mb-2'>
        <span className='font-semibold text-sm text-foreground'>#{ticket.ticketNumber || ticket.id.slice(-6).toUpperCase()}</span>
        {ticket.briefDescription && <span className='text-xs text-muted-foreground truncate'>{ticket.briefDescription}</span>}
        <div className='flex flex-wrap gap-1 ml-auto'>
          {isNotVisited ? (
            <Badge variant='outline' className='text-[10px] h-4 px-1.5 text-amber-700 dark:text-amber-400 border-amber-400 dark:border-amber-600 font-semibold'>
              <AlertCircle className='h-2.5 w-2.5 mr-0.5' />
              Customer Not Visited
            </Badge>
          ) : (
            <Badge variant={isEmergency ? 'destructive' : 'secondary'} className='text-[10px] h-4 px-1.5'>
              {isEmergency ? 'Emergency' : 'Visited'}
            </Badge>
          )}
          {hasHighPriority && (
            <Badge variant='destructive' className='text-[10px] h-4 px-1.5 gap-0.5'>
              <ShieldAlert className='h-2.5 w-2.5' />
              {ticket.machines.find((m) => m.priority === 'Urgent' || m.priority === 'High')?.priority}
            </Badge>
          )}
          <Badge variant={ticket.status === 'Closed' ? 'default' : ticket.status === 'Assigned' ? 'secondary' : 'outline'} className='text-[10px] h-4 px-1.5'>
            {ticket.status}
          </Badge>
        </div>
      </div>

      {ticket.machines.length > 0 && (
        <div className='space-y-0.5 mb-2'>
          {ticket.machines.map((m) => (
            <p key={m.machineId} className='text-xs text-muted-foreground'>
              {m.machineType} &middot; SN: {m.serialNumber} &middot; <span className='font-medium text-foreground/80'>{m.customerName}</span>
              {m.priority && <span className={`ml-1 ${m.priority === 'Urgent' || m.priority === 'High' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>[{m.priority}]</span>}
            </p>
          ))}
        </div>
      )}

      {ticket.contactPerson && <p className='text-xs text-muted-foreground mb-2'>Contact: {ticket.contactPerson}</p>}

      {workLogs.length > 0 && (
        <div className='mt-2 space-y-2 border-t pt-2'>
          {workLogs.map((wl) => (
            <div key={wl.id} className='text-xs space-y-1'>
              <div className='flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground'>
                <span className='font-medium text-foreground/80'>{wl.machineType}</span>
                {wl.arrivalTime && (
                  <span className='flex items-center gap-1'>
                    <Clock className='h-3 w-3' />
                    {formatTime(wl.arrivalTime)}
                    {wl.departureTime && ` – ${formatTime(wl.departureTime)}`}
                    {wl.hoursWorked && ` (${wl.hoursWorked}h)`}
                  </span>
                )}
              </div>
              {wl.workPerformed && <p className='text-muted-foreground line-clamp-2'>{wl.workPerformed}</p>}
              {wl.outcome && <p className='text-muted-foreground italic line-clamp-1'>? {wl.outcome}</p>}
              {wl.partsUsed.length > 0 && <p className='text-muted-foreground'>Parts: {wl.partsUsed.map((p) => `${p.partName} x${p.quantity}`).join(', ')}</p>}
            </div>
          ))}
        </div>
      )}
    </a>
  );
}

function DaySection({ day }: { day: TechDayEntry }) {
  const totalPlanned = day.visitedScheduledCount + day.missedCount;
  const totalVisits = day.visitedScheduledCount + day.emergencyCount;
  const sorted = sortEntries(day.tickets);

  return (
    <div>
      <div className='flex flex-wrap items-center gap-2 mb-3'>
        <p className='text-sm font-semibold'>{formatDayLabel(day.dateStr)}</p>
        <div className='flex gap-1 flex-wrap'>
          {day.visitedScheduledCount > 0 && (
            <span className='text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium'>{day.visitedScheduledCount} visited</span>
          )}
          {day.emergencyCount > 0 && (
            <span className='text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full font-medium'>{day.emergencyCount} emergency</span>
          )}
          {day.missedCount > 0 && (
            <span className='text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium'>{day.missedCount} missed</span>
          )}
          {totalPlanned > 0 && (
            <span className='text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium'>
              {totalVisits}/{totalPlanned} planned
            </span>
          )}
          {day.hoursLogged > 0 && (
            <span className='text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-medium'>{day.hoursLogged.toFixed(2)}h</span>
          )}
        </div>
      </div>
      <div className='space-y-2'>
        {sorted.map((entry) => (
          <TicketCard key={`${entry.ticket.id}-${day.dateStr}`} entry={entry} dateStr={day.dateStr} />
        ))}
      </div>
    </div>
  );
}

function TechnicianSection({ row }: { row: TechnicianPeriodRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className='overflow-hidden border-l-4 border-l-primary'>
      <button type='button' className='w-full text-left select-none group' onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <div className='py-4 px-4 sm:px-6 group-hover:bg-muted/40 transition-colors duration-150 cursor-pointer'>
          <div className='flex items-center justify-between gap-4'>
            <div className='min-w-0 flex-1'>
              <p className='font-semibold text-base'>{row.technicianName}</p>
              <div className='flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-muted-foreground'>
                <span>
                  {row.totalTickets} ticket{row.totalTickets !== 1 ? 's' : ''}
                </span>
                <span className='opacity-40'>&middot;</span>
                <span>
                  {row.activeDaysCount} active day{row.activeDaysCount !== 1 ? 's' : ''}
                </span>
                {row.totalScheduled > 0 && (
                  <>
                    <span className='opacity-40'>&middot;</span>
                    <span>{row.totalScheduled} scheduled</span>
                  </>
                )}
                {row.totalEmergency > 0 && (
                  <>
                    <span className='opacity-40'>&middot;</span>
                    <span className='text-red-500 dark:text-red-400'>{row.totalEmergency} emergency</span>
                  </>
                )}
                {row.totalNotCompleted > 0 && (
                  <>
                    <span className='opacity-40'>&middot;</span>
                    <span className='text-amber-500 dark:text-amber-400'>{row.totalNotCompleted} incomplete</span>
                  </>
                )}
                {row.totalHours > 0 && (
                  <>
                    <span className='opacity-40'>&middot;</span>
                    <span>{row.totalHours.toFixed(2)}h logged</span>
                  </>
                )}
              </div>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              {!expanded && <span className='hidden sm:block text-[10px] text-muted-foreground/60 font-medium tracking-wide uppercase'>Expand</span>}
              <div
                className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  expanded ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border text-muted-foreground group-hover:border-primary/60 group-hover:text-primary'
                }`}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Animated collapsible using CSS grid-template-rows trick */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className='overflow-hidden'>
          <CardContent className='px-4 sm:px-6 pb-5 pt-0'>
            <Separator className='-mx-4 sm:-mx-6 w-auto mb-4' />
            {row.days.length === 0 ? (
              <p className='text-sm text-muted-foreground italic py-2'>No visits recorded in this period.</p>
            ) : (
              <div className='space-y-0 divide-y'>
                {row.days.map((day) => (
                  <div key={day.dateStr} className='py-4 first:pt-0 last:pb-0'>
                    <DaySection day={day} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

function UnassignedSection({ days }: { days: UnassignedDayGroup[] }) {
  const [expanded, setExpanded] = useState(false);
  const totalTickets = days.reduce((s, d) => s + d.entries.length, 0);

  return (
    <Card className='overflow-hidden border-l-4 border-l-amber-400/70 border-dashed'>
      <button type='button' className='w-full text-left select-none group' onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <div className='py-4 px-4 sm:px-6 group-hover:bg-amber-50/40 dark:group-hover:bg-amber-900/10 transition-colors duration-150 cursor-pointer'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <p className='font-semibold text-base text-amber-700 dark:text-amber-400'>Unassigned Tickets</p>
              <div className='flex items-center gap-2 mt-1.5 text-xs text-muted-foreground'>
                <span>
                  {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
                </span>
                <span className='opacity-40'>&middot;</span>
                <span>
                  {days.length} day{days.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              {!expanded && <span className='hidden sm:block text-[10px] text-muted-foreground/60 font-medium tracking-wide uppercase'>Expand</span>}
              <div
                className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  expanded ? 'bg-amber-500 border-amber-500 text-white' : 'bg-background border-border text-muted-foreground group-hover:border-amber-400 group-hover:text-amber-600'
                }`}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
              </div>
            </div>
          </div>
        </div>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className='overflow-hidden'>
          <CardContent className='px-4 sm:px-6 pb-5 pt-0'>
            <Separator className='-mx-4 sm:-mx-6 w-auto mb-4' />
            <div className='divide-y'>
              {days.map(({ dateStr, entries }) => (
                <div key={dateStr} className='py-4 first:pt-0 last:pb-0'>
                  <p className='text-sm font-semibold mb-2'>{formatDayLabel(dateStr)}</p>
                  <div className='space-y-2'>
                    {entries.map((entry) => (
                      <TicketCard key={`${entry.ticket.id}-${dateStr}`} entry={entry} dateStr={dateStr} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

function SummaryTable({ data }: { data: PeriodServiceReportData }) {
  if (data.technicians.length === 0) return null;

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-sm font-semibold'>Period Summary by Technician</CardTitle>
        <p className='text-xs text-muted-foreground'>
          {formatDateShort(data.startDate)} &ndash; {formatDateShort(data.endDate)} &middot; {data.calendarDays} days
        </p>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technician</TableHead>
                <TableHead className='text-center'>Planned</TableHead>
                <TableHead className='text-center'>Completed</TableHead>
                <TableHead className='text-center'>Missed</TableHead>
                <TableHead className='text-center'>Emergency</TableHead>
                <TableHead className='text-center'>Total Visits</TableHead>
                <TableHead className='text-center'>Active Days</TableHead>
                <TableHead className='text-right'>Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.technicians.map((tech) => (
                <TableRow key={tech.technicianId}>
                  <TableCell className='font-medium'>{tech.technicianName}</TableCell>
                  <TableCell className='text-center'>{tech.totalScheduled}</TableCell>
                  <TableCell className='text-center'>
                    <span className={tech.totalVisited === tech.totalScheduled ? 'text-green-600 dark:text-green-400' : ''}>{tech.totalVisited}</span>
                  </TableCell>
                  <TableCell className='text-center'>
                    {tech.totalMissed > 0 ? <span className='text-amber-600 dark:text-amber-400 font-medium'>{tech.totalMissed}</span> : <span className='text-green-600 dark:text-green-400'>0</span>}
                  </TableCell>
                  <TableCell className='text-center'>{tech.totalEmergency > 0 ? <span className='text-red-600 dark:text-red-400 font-medium'>{tech.totalEmergency}</span> : '0'}</TableCell>
                  <TableCell className='text-center font-medium'>{tech.totalVisited + tech.totalEmergency}</TableCell>
                  <TableCell className='text-center'>{tech.activeDaysCount}</TableCell>
                  <TableCell className='text-right font-medium'>{tech.totalHours.toFixed(2)}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className='h-20 rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-48 rounded-xl' />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className='h-16 rounded-xl' />
      ))}
    </div>
  );
}

// --- Main Component -----------------------------------------------------------

export function DailyServiceReport() {
  const [startDate, setStartDate] = useState(toFirstOfMonthStr());
  const [endDate, setEndDate] = useState(toTodayStr());
  const [reportData, setReportData] = useState<PeriodServiceReportData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>('thismonth');

  const loadReport = useCallback((start: string, end: string) => {
    startTransition(async () => {
      const data = await getServiceReport(start, end);
      setReportData(data);
      setHasLoaded(true);
    });
  }, []);

  const handlePreset = (preset: DatePreset) => {
    const { start, end } = preset.getRange();
    setStartDate(start);
    setEndDate(end);
    setActivePreset(preset.id);
    loadReport(start, end);
  };

  const handleGenerate = () => {
    if (startDate && endDate && startDate <= endDate) {
      setActivePreset(null);
      loadReport(startDate, endDate);
    }
  };

  const exportData = reportData ? flattenForExport(reportData) : [];
  const exportFilename = reportData ? `tech-service-report-${reportData.startDate}-to-${reportData.endDate}` : 'tech-service-report';
  const exportSubtitle = reportData ? `${formatDateShort(reportData.startDate)} – ${formatDateShort(reportData.endDate)}` : '';
  const exportMetadata = reportData ? buildExportMetadata(reportData) : undefined;

  const isEmpty = reportData !== null && reportData.technicians.length === 0 && reportData.unassignedDays.length === 0;

  return (
    <div className='space-y-6'>
      {/* Date range selector */}
      <Card>
        <CardContent className='py-4 px-4 sm:px-6 space-y-4'>
          {/* Preset pills */}
          <div className='flex flex-wrap gap-1.5'>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type='button'
                onClick={() => handlePreset(preset)}
                disabled={isPending}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                  activePreset === preset.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <Separator />

          {/* Date inputs + actions */}
          <div className='flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between'>
            <div className='flex flex-col sm:flex-row gap-3 sm:items-end'>
              <div className='flex flex-col gap-1'>
                <label htmlFor='start-date' className='text-xs font-medium text-muted-foreground'>
                  From
                </label>
                <input
                  id='start-date'
                  type='date'
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset(null);
                  }}
                  max={endDate || toTodayStr()}
                  className='h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-44'
                />
              </div>
              <div className='flex flex-col gap-1'>
                <label htmlFor='end-date' className='text-xs font-medium text-muted-foreground'>
                  To
                </label>
                <input
                  id='end-date'
                  type='date'
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset(null);
                  }}
                  min={startDate}
                  max={toTodayStr()}
                  className='h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-44'
                />
              </div>
              <Button onClick={handleGenerate} disabled={isPending || !startDate || !endDate || startDate > endDate} size='sm' variant='outline' className='gap-2 sm:self-end w-full sm:w-auto'>
                <CalendarRange className='h-4 w-4' />
                {isPending && !activePreset ? 'Loading…' : 'Generate'}
              </Button>
            </div>

            {reportData && !isEmpty && (
              <ExportButton
                data={exportData}
                columns={EXPORT_COLUMNS}
                filename={exportFilename}
                sheetName='Service Report'
                title='Tech Team Service Report'
                subtitle={exportSubtitle}
                metadata={exportMetadata}
              />
            )}
          </div>

          {reportData && (
            <p className='text-xs text-muted-foreground'>
              {formatDateShort(reportData.startDate)} &ndash; {formatDateShort(reportData.endDate)} &middot; {reportData.calendarDays} calendar days &middot; {reportData.totalTickets} total ticket
              {reportData.totalTickets !== 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* First-load skeleton */}
      {isPending && !hasLoaded && <ReportSkeleton />}

      {/* Prompt to generate */}
      {!isPending && !hasLoaded && (
        <div className='flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3'>
          <CalendarRange className='h-10 w-10 opacity-30' />
          <p className='text-sm'>
            Select a date range or a preset above and click <strong>Generate</strong> to view the tech team service summary.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isPending && hasLoaded && isEmpty && (
        <div className='flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3'>
          <CheckCircle2 className='h-10 w-10 opacity-30' />
          <p className='text-sm'>No scheduled visits or work logged in the selected period.</p>
        </div>
      )}

      {/* Report output — stays visible during re-fetch with overlay */}
      {hasLoaded && reportData && !isEmpty && (
        <div className='relative'>
          {/* Re-fetch overlay (shown when refreshing existing data) */}
          {isPending && (
            <div className='absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-start justify-center pt-10 rounded-lg pointer-events-none'>
              <div className='flex items-center gap-2 bg-card border rounded-full px-4 py-2 shadow-md text-sm text-muted-foreground'>
                <Loader2 className='h-3.5 w-3.5 animate-spin text-primary' />
                Updating report…
              </div>
            </div>
          )}

          <div className={`space-y-4 transition-opacity duration-200 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
            {/* Summary stat cards */}
            <div className='grid grid-cols-2 lg:grid-cols-5 gap-4'>
              <StatCard label='Planned Visits' value={reportData.totalScheduled} icon={Calendar} color='bg-primary/10 text-primary' />
              <StatCard label='Completed' value={reportData.totalVisited} icon={CheckCircle2} color='bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' />
              <StatCard label='Missed Visits' value={reportData.totalMissed} icon={AlertCircle} color='bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' />
              <StatCard label='Emergency Visits' value={reportData.totalEmergency} icon={ShieldAlert} color='bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' />
              <StatCard label='Hours Logged' value={`${reportData.totalHours.toFixed(2)}h`} icon={Clock} color='bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' />
            </div>

            {/* Summary table */}
            <SummaryTable data={reportData} />

            {/* Per-technician sections */}
            {reportData.technicians.map((row) => (
              <TechnicianSection key={row.technicianId} row={row} />
            ))}

            {/* Unassigned section */}
            {reportData.unassignedDays.length > 0 && <UnassignedSection days={reportData.unassignedDays} />}
          </div>
        </div>
      )}
    </div>
  );
}
