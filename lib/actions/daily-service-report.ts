'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DailyReportMachine {
  machineId: string;
  machineType: string;
  serialNumber: string;
  customerName: string;
  priority?: string;
}

export interface DailyReportWorkLog {
  id: string;
  ticketId: string;
  machineId: string;
  machineType: string;
  serialNumber: string;
  arrivalTime: string | null;
  departureTime: string | null;
  hoursWorked: number | null;
  workPerformed: string | null;
  outcome: string | null;
  partsUsed: Array<{ partId: string; partName: string; quantity: number }>;
}

export interface DailyReportTicket {
  id: string;
  ticketNumber: string;
  status: string;
  scheduledVisitDate: string | null;
  createdAt: string | null;
  closedAt: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  issueDescription: string;
  briefDescription: string | null;
  contactPerson: string | null;
  machines: DailyReportMachine[];
  missedVisits: string[]; // explicit missed dates — YYYY-MM-DD
}

export type DailyVisitType = 'scheduled' | 'emergency';

/**
 * Primary classification used in the report and export.
 *
 * visited_scheduled — had a scheduledVisitDate in the range and work was logged on a date in the range
 * visited_emergency — no scheduledVisitDate in the range; tech showed up unscheduled
 * not_visited       — had a scheduledVisitDate for this date but no work was logged (missed visit)
 */
export type VisitActivity = 'visited_scheduled' | 'visited_emergency' | 'not_visited';

export interface DailyTicketEntry {
  ticket: DailyReportTicket;
  workLogs: DailyReportWorkLog[];
  visitType: DailyVisitType; // kept for backwards compat; derived from visitActivity
  visitActivity: VisitActivity;
}

export interface TechDayEntry {
  dateStr: string;
  visitedScheduledCount: number;
  missedCount: number;
  emergencyCount: number;
  hoursLogged: number;
  tickets: DailyTicketEntry[];
}

export interface TechnicianPeriodRow {
  technicianId: string;
  technicianName: string;
  totalScheduled: number; // visitedScheduled + missed (all planned visits)
  totalVisited: number; // visitedScheduled only (completed planned visits)
  totalNotCompleted: number; // alias for totalMissed — kept for UI compat
  totalMissed: number; // missed visits (scheduled, no work logged)
  totalEmergency: number;
  totalHours: number;
  totalTickets: number;
  activeDaysCount: number;
  avgScheduledPerDay: number;
  avgHoursPerDay: number;
  days: TechDayEntry[];
}

export interface UnassignedDayGroup {
  dateStr: string;
  entries: DailyTicketEntry[];
}

export interface PeriodServiceReportData {
  startDate: string;
  endDate: string;
  calendarDays: number;
  technicians: TechnicianPeriodRow[];
  unassignedDays: UnassignedDayGroup[];
  totalScheduled: number;
  totalVisited: number;
  totalNotCompleted: number;
  totalMissed: number;
  totalEmergency: number;
  totalHours: number;
  totalTickets: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// ─── Private fetcher (no auth, called via cached wrapper) ──────────────────

async function _fetchReportData(storeId: string, startDate: string, endDate: string): Promise<PeriodServiceReportData> {
  const storeCol = (col: string) => adminDb.collection('stores').doc(storeId).collection(col);

  const toIso = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof (v as Record<string, unknown>)?.toDate === 'function') {
      const d = (v as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
    if (typeof v === 'string' && v.length >= 10) return v;
    return null;
  };

  const rangeStart = new Date(`${startDate}T00:00:00Z`);
  const rangeEnd = new Date(`${endDate}T23:59:59Z`);

  const isInRange = (isoStr: string | null): boolean => {
    if (!isoStr) return false;
    const d = new Date(isoStr);
    return d >= rangeStart && d <= rangeEnd;
  };

  const [ticketsSnap, workLogsSnap, techSnap] = await Promise.all([
    storeCol('tickets').get(),
    storeCol('machineWorkLogs').get(),
    adminDb.collection('users').where('role', '==', 'technician').where('storeId', '==', storeId).where('disabled', '==', false).get(),
  ]);

  const techMap = new Map<string, string>();
  techSnap.docs.forEach((doc) => {
    techMap.set(doc.id, (doc.data().name as string) || 'Unknown');
  });

  const allTickets: DailyReportTicket[] = ticketsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      ticketNumber: (d.ticketNumber as string) || '',
      status: (d.status as string) || 'Open',
      scheduledVisitDate: toIso(d.scheduledVisitDate),
      createdAt: toIso(d.createdAt),
      closedAt: toIso(d.closedAt),
      assignedTo: (d.assignedTo as string) || null,
      assignedToName: (d.assignedToName as string) || null,
      issueDescription: (d.issueDescription as string) || '',
      briefDescription: (d.briefDescription as string) || null,
      contactPerson: (d.contactPerson as string) || null,
      missedVisits: Array.isArray(d.missedVisits) ? (d.missedVisits as string[]) : [],
      machines: Array.isArray(d.machines)
        ? (d.machines as Record<string, unknown>[]).map((m) => ({
            machineId: (m.machineId as string) || '',
            machineType: (m.machineType as string) || 'Unknown',
            serialNumber: (m.serialNumber as string) || '',
            customerName: (m.customerName as string) || 'Unknown',
            priority: m.priority as string | undefined,
          }))
        : [],
    };
  });

  const ticketById = new Map<string, DailyReportTicket>();
  for (const ticket of allTickets) {
    ticketById.set(ticket.id, ticket);
  }

  const allWorkLogs: DailyReportWorkLog[] = workLogsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      ticketId: (d.ticketId as string) || '',
      machineId: (d.machineId as string) || '',
      machineType: (d.machineType as string) || 'Unknown',
      serialNumber: (d.machineSerialNumber as string) || '',
      arrivalTime: toIso(d.arrivalTime),
      departureTime: toIso(d.departureTime),
      hoursWorked: typeof d.hoursWorked === 'number' ? (d.hoursWorked as number) : null,
      workPerformed: (d.workPerformed as string) || null,
      outcome: (d.outcome as string) || null,
      partsUsed: Array.isArray(d.partsUsed) ? (d.partsUsed as Array<{ partId: string; partName: string; quantity: number }>) : [],
    };
  });

  const scheduledByDate = new Map<string, DailyReportTicket[]>();
  for (const ticket of allTickets) {
    if (!isInRange(ticket.scheduledVisitDate)) continue;
    const dateStr = ticket.scheduledVisitDate!.slice(0, 10);
    if (!scheduledByDate.has(dateStr)) scheduledByDate.set(dateStr, []);
    scheduledByDate.get(dateStr)!.push(ticket);
  }

  const workLogsByTicketByDate = new Map<string, Map<string, DailyReportWorkLog[]>>();
  const workLogTicketsByDate = new Map<string, Set<string>>();
  for (const wl of allWorkLogs) {
    if (!wl.arrivalTime || !isInRange(wl.arrivalTime)) continue;
    const dateStr = wl.arrivalTime.slice(0, 10);

    if (!workLogsByTicketByDate.has(wl.ticketId)) workLogsByTicketByDate.set(wl.ticketId, new Map());
    const byDate = workLogsByTicketByDate.get(wl.ticketId)!;
    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr)!.push(wl);

    if (!workLogTicketsByDate.has(dateStr)) workLogTicketsByDate.set(dateStr, new Set());
    workLogTicketsByDate.get(dateStr)!.add(wl.ticketId);
  }

  const techDayMap = new Map<string, Map<string, TechDayEntry>>();
  const unassignedDayMap = new Map<string, DailyTicketEntry[]>();

  const addEntry = (entry: DailyTicketEntry, dateStr: string, techId: string | null) => {
    if (!techId) {
      if (!unassignedDayMap.has(dateStr)) unassignedDayMap.set(dateStr, []);
      unassignedDayMap.get(dateStr)!.push(entry);
      return;
    }

    if (!techDayMap.has(techId)) techDayMap.set(techId, new Map());
    const dayMap = techDayMap.get(techId)!;

    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, {
        dateStr,
        visitedScheduledCount: 0,
        missedCount: 0,
        emergencyCount: 0,
        hoursLogged: 0,
        tickets: [],
      });
    }

    const dayEntry = dayMap.get(dateStr)!;
    dayEntry.tickets.push(entry);

    if (entry.visitActivity === 'visited_scheduled') {
      dayEntry.visitedScheduledCount++;
    } else if (entry.visitActivity === 'not_visited') {
      dayEntry.missedCount++;
    } else {
      dayEntry.emergencyCount++;
    }

    for (const wl of entry.workLogs) {
      if (wl.hoursWorked) dayEntry.hoursLogged += wl.hoursWorked;
    }
  };

  const allDates = getDatesInRange(startDate, endDate);
  const processedPairs = new Set<string>();

  // IDs of tickets that have a scheduledVisitDate anywhere in the range.
  // Tickets worked on a non-scheduled day are a late visit (visited_scheduled),
  // NOT an emergency — the scheduled entry on the original date handles not_visited.
  const scheduledInRangeIds = new Set<string>(allTickets.filter((t) => isInRange(t.scheduledVisitDate)).map((t) => t.id));

  for (const dateStr of allDates) {
    const scheduledTickets = scheduledByDate.get(dateStr) ?? [];
    const workedTicketIds = workLogTicketsByDate.get(dateStr) ?? new Set<string>();
    const scheduledIds = new Set(scheduledTickets.map((t) => t.id));

    // ── 1. Process scheduled visits for this date ──────────────────────────
    for (const ticket of scheduledTickets) {
      const key = `${ticket.id}:${dateStr}`;
      if (processedPairs.has(key)) continue;
      processedPairs.add(key);

      const workLogsForDay = workLogsByTicketByDate.get(ticket.id)?.get(dateStr) ?? [];
      const hasWork = workLogsForDay.length > 0;

      // Missed if: explicitly marked OR no work logged for this scheduled date
      const visitActivity: VisitActivity = hasWork ? 'visited_scheduled' : 'not_visited';
      const visitType: DailyVisitType = 'scheduled';

      addEntry({ ticket, workLogs: workLogsForDay, visitType, visitActivity }, dateStr, ticket.assignedTo);
    }

    // ── 2. Process tickets worked on this date but not scheduled on this date ─
    for (const ticketId of workedTicketIds) {
      if (scheduledIds.has(ticketId)) continue; // already handled as scheduled above

      const key = `${ticketId}:${dateStr}`;
      if (processedPairs.has(key)) continue;
      processedPairs.add(key);

      const ticket = ticketById.get(ticketId);
      if (!ticket) continue;

      const workLogsForDay = workLogsByTicketByDate.get(ticketId)?.get(dateStr) ?? [];

      // If this ticket had a scheduled date elsewhere in the range, this is a late
      // visit for a planned appointment — still classify as visited_scheduled.
      // If no scheduled date at all → genuine emergency breakdown call.
      const visitActivity: VisitActivity = scheduledInRangeIds.has(ticketId) ? 'visited_scheduled' : 'visited_emergency';
      const visitType: DailyVisitType = scheduledInRangeIds.has(ticketId) ? 'scheduled' : 'emergency';

      addEntry({ ticket, workLogs: workLogsForDay, visitType, visitActivity }, dateStr, ticket.assignedTo);
    }
  }

  const calendarDays = allDates.length;

  const techRows: TechnicianPeriodRow[] = Array.from(techDayMap.entries()).map(([techId, dayMap]) => {
    const techName = techMap.get(techId) ?? 'Unknown Technician';
    const days = Array.from(dayMap.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const totalVisited = days.reduce((s, d) => s + d.visitedScheduledCount, 0);
    const totalMissed = days.reduce((s, d) => s + d.missedCount, 0);
    const totalScheduled = totalVisited + totalMissed; // all planned visits
    const totalEmergency = days.reduce((s, d) => s + d.emergencyCount, 0);
    const totalHours = Math.round(days.reduce((s, d) => s + d.hoursLogged, 0) * 100) / 100;
    const totalTickets = days.reduce((s, d) => s + d.tickets.length, 0);
    const activeDaysCount = days.length;

    return {
      technicianId: techId,
      technicianName: techName,
      totalScheduled,
      totalVisited,
      totalNotCompleted: totalMissed, // alias kept for UI compat
      totalMissed,
      totalEmergency,
      totalHours,
      totalTickets,
      activeDaysCount,
      avgScheduledPerDay: calendarDays > 0 ? Math.round((totalScheduled / calendarDays) * 10) / 10 : 0,
      avgHoursPerDay: activeDaysCount > 0 ? Math.round((totalHours / activeDaysCount) * 100) / 100 : 0,
      days,
    };
  });

  techRows.sort((a, b) => a.technicianName.localeCompare(b.technicianName));

  const unassignedDays: UnassignedDayGroup[] = Array.from(unassignedDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, entries]) => ({ dateStr, entries }));

  const totalVisited = techRows.reduce((s, t) => s + t.totalVisited, 0);
  const totalMissed = techRows.reduce((s, t) => s + t.totalMissed, 0);
  const totalScheduled = totalVisited + totalMissed;
  const totalEmergency = techRows.reduce((s, t) => s + t.totalEmergency, 0);
  const totalHours = Math.round(techRows.reduce((s, t) => s + t.totalHours, 0) * 100) / 100;
  const totalTickets = techRows.reduce((s, t) => s + t.totalTickets, 0) + unassignedDays.reduce((s, d) => s + d.entries.length, 0);

  return {
    startDate,
    endDate,
    calendarDays,
    technicians: techRows,
    unassignedDays,
    totalScheduled,
    totalVisited,
    totalNotCompleted: totalMissed,
    totalMissed,
    totalEmergency,
    totalHours,
    totalTickets,
  };
}

// ─── Server Action ──────────────────────────────────────────────────────────

export async function getServiceReport(startDate: string, endDate: string): Promise<PeriodServiceReportData> {
  const empty: PeriodServiceReportData = {
    startDate,
    endDate,
    calendarDays: 0,
    technicians: [],
    unassignedDays: [],
    totalScheduled: 0,
    totalVisited: 0,
    totalNotCompleted: 0,
    totalMissed: 0,
    totalEmergency: 0,
    totalHours: 0,
    totalTickets: 0,
  };

  const user = await getCurrentUser();
  if (!user?.storeId || !['store_admin', 'store_manager'].includes(user.role)) {
    return empty;
  }

  const storeId = user.storeId;

  // Cache per store + date range; invalidated when tickets or work logs change.
  const getCached = unstable_cache(() => _fetchReportData(storeId, startDate, endDate), [`service-report:${storeId}:${startDate}:${endDate}`], {
    tags: [`${CACHE_TAGS.TICKETS}:${storeId}`, `${CACHE_TAGS.WORK_LOGS}:${storeId}`],
    revalidate: false,
  });

  return getCached();
}
