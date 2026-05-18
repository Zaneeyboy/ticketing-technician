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
}

export type DailyVisitType = 'scheduled' | 'emergency';

export interface DailyTicketEntry {
  ticket: DailyReportTicket;
  workLogs: DailyReportWorkLog[];
  visitType: DailyVisitType;
}

export interface TechDayEntry {
  dateStr: string;
  scheduledCount: number;
  notCompletedCount: number;
  emergencyCount: number;
  hoursLogged: number;
  tickets: DailyTicketEntry[];
}

export interface TechnicianPeriodRow {
  technicianId: string;
  technicianName: string;
  totalScheduled: number;
  totalNotCompleted: number;
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
  totalNotCompleted: number;
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

/** Tickets with High or Urgent priority are always classified as emergency visits. */
function isEmergencyPriority(ticket: DailyReportTicket): boolean {
  return ticket.machines.some((m) => m.priority === 'High' || m.priority === 'Urgent');
}

// ─── Private fetcher (no auth, called via cached wrapper) ──────────────────

async function _fetchReportData(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<PeriodServiceReportData> {
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
    adminDb
      .collection('users')
      .where('role', '==', 'technician')
      .where('storeId', '==', storeId)
      .where('disabled', '==', false)
      .get(),
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
      partsUsed: Array.isArray(d.partsUsed)
        ? (d.partsUsed as Array<{ partId: string; partName: string; quantity: number }>)
        : [],
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
        scheduledCount: 0,
        notCompletedCount: 0,
        emergencyCount: 0,
        hoursLogged: 0,
        tickets: [],
      });
    }

    const dayEntry = dayMap.get(dateStr)!;
    dayEntry.tickets.push(entry);

    if (entry.visitType === 'scheduled') {
      dayEntry.scheduledCount++;
      if (entry.ticket.status !== 'Closed') dayEntry.notCompletedCount++;
    } else {
      dayEntry.emergencyCount++;
    }

    for (const wl of entry.workLogs) {
      if (wl.hoursWorked) dayEntry.hoursLogged += wl.hoursWorked;
    }
  };

  const allDates = getDatesInRange(startDate, endDate);
  const processedPairs = new Set<string>();

  for (const dateStr of allDates) {
    const scheduledTickets = scheduledByDate.get(dateStr) ?? [];
    const workedTicketIds = workLogTicketsByDate.get(dateStr) ?? new Set<string>();
    const scheduledIds = new Set(scheduledTickets.map((t) => t.id));

    for (const ticket of scheduledTickets) {
      const key = `${ticket.id}:${dateStr}`;
      if (processedPairs.has(key)) continue;
      processedPairs.add(key);
      // High/Urgent priority tickets are always emergency visits, even if scheduled.
      const visitType: DailyVisitType = isEmergencyPriority(ticket) ? 'emergency' : 'scheduled';
      addEntry(
        { ticket, workLogs: workLogsByTicketByDate.get(ticket.id)?.get(dateStr) ?? [], visitType },
        dateStr,
        ticket.assignedTo,
      );
    }

    for (const ticketId of workedTicketIds) {
      if (scheduledIds.has(ticketId)) continue;
      const key = `${ticketId}:${dateStr}`;
      if (processedPairs.has(key)) continue;
      processedPairs.add(key);
      const ticket = ticketById.get(ticketId);
      if (!ticket) continue;
      addEntry(
        { ticket, workLogs: workLogsByTicketByDate.get(ticketId)?.get(dateStr) ?? [], visitType: 'emergency' },
        dateStr,
        ticket.assignedTo,
      );
    }
  }

  const calendarDays = allDates.length;

  const techRows: TechnicianPeriodRow[] = Array.from(techDayMap.entries()).map(([techId, dayMap]) => {
    const techName = techMap.get(techId) ?? 'Unknown Technician';
    const days = Array.from(dayMap.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const totalScheduled = days.reduce((s, d) => s + d.scheduledCount, 0);
    const totalNotCompleted = days.reduce((s, d) => s + d.notCompletedCount, 0);
    const totalEmergency = days.reduce((s, d) => s + d.emergencyCount, 0);
    const totalHours = Math.round(days.reduce((s, d) => s + d.hoursLogged, 0) * 100) / 100;
    const totalTickets = days.reduce((s, d) => s + d.tickets.length, 0);
    const activeDaysCount = days.length;

    return {
      technicianId: techId,
      technicianName: techName,
      totalScheduled,
      totalNotCompleted,
      totalEmergency,
      totalHours,
      totalTickets,
      activeDaysCount,
      avgScheduledPerDay: calendarDays > 0 ? Math.round((totalScheduled / calendarDays) * 10) / 10 : 0,
      avgHoursPerDay: activeDaysCount > 0 ? Math.round((totalHours / activeDaysCount) * 10) / 10 : 0,
      days,
    };
  });

  techRows.sort((a, b) => a.technicianName.localeCompare(b.technicianName));

  const unassignedDays: UnassignedDayGroup[] = Array.from(unassignedDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, entries]) => ({ dateStr, entries }));

  const totalScheduled = techRows.reduce((s, t) => s + t.totalScheduled, 0);
  const totalNotCompleted = techRows.reduce((s, t) => s + t.totalNotCompleted, 0);
  const totalEmergency = techRows.reduce((s, t) => s + t.totalEmergency, 0);
  const totalHours = Math.round(techRows.reduce((s, t) => s + t.totalHours, 0) * 100) / 100;
  const totalTickets =
    techRows.reduce((s, t) => s + t.totalTickets, 0) +
    unassignedDays.reduce((s, d) => s + d.entries.length, 0);

  return {
    startDate,
    endDate,
    calendarDays,
    technicians: techRows,
    unassignedDays,
    totalScheduled,
    totalNotCompleted,
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
    totalNotCompleted: 0,
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
  const getCached = unstable_cache(
    () => _fetchReportData(storeId, startDate, endDate),
    [`service-report:${storeId}:${startDate}:${endDate}`],
    {
      tags: [`${CACHE_TAGS.TICKETS}:${storeId}`, `${CACHE_TAGS.WORK_LOGS}:${storeId}`],
      revalidate: false,
    },
  );

  return getCached();
}
