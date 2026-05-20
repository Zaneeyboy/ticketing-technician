/**
 * Visit status utilities
 *
 * Determines whether a scheduled visit was attended on time, rescheduled, completed late,
 * or missed, based on ticket data and corresponding work log arrival times.
 */

import type { ReportTicket } from '@/lib/types/reporting';

/**
 * Possible outcomes for a ticket's scheduled visit:
 *
 * - on_time        — Work was logged (arrivalTime) on the same calendar day as scheduledVisitDate.
 * - rescheduled    — The scheduledVisitDate was changed at least once (scheduleHistory exists).
 *                    The *current* visit may still be upcoming, on_time, or overdue.
 * - completed_late — Ticket is closed/signed-off but work was logged on a different day than scheduled.
 * - overdue        — Past the scheduled date, ticket is still open, and no work was logged on that day.
 * - upcoming       — The scheduled date is today or in the future.
 * - no_schedule    — No scheduledVisitDate set on the ticket (e.g. emergency/ad-hoc calls).
 */
export type VisitStatus = 'on_time' | 'rescheduled' | 'completed_late' | 'overdue' | 'upcoming' | 'no_schedule';

/**
 * Labels and colours for display in UI/reports.
 */
export const VISIT_STATUS_META: Record<VisitStatus, { label: string; colour: string }> = {
  on_time: { label: 'On Time', colour: 'text-green-600 dark:text-green-400' },
  rescheduled: { label: 'Rescheduled', colour: 'text-blue-600 dark:text-blue-400' },
  completed_late: { label: 'Completed Late', colour: 'text-amber-600 dark:text-amber-400' },
  overdue: { label: 'Overdue / Missed', colour: 'text-red-600 dark:text-red-400' },
  upcoming: { label: 'Upcoming', colour: 'text-muted-foreground' },
  no_schedule: { label: 'No Schedule', colour: 'text-muted-foreground' },
};

function toDateStr(isoOrNull: string | null | undefined): string | null {
  if (!isoOrNull) return null;
  return isoOrNull.slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Calculate the visit status for a single ticket.
 *
 * @param ticket         - The ReportTicket (must include scheduledVisitDate and scheduleHistory).
 * @param arrivalTimes   - All work log arrivalTime ISO strings for this ticket.
 */
export function calculateVisitStatus(ticket: Pick<ReportTicket, 'scheduledVisitDate' | 'status' | 'scheduleHistory'>, arrivalTimes: (string | null | undefined)[]): VisitStatus {
  const scheduledStr = toDateStr(ticket.scheduledVisitDate);

  if (!scheduledStr) return 'no_schedule';

  const todayStr = new Date().toISOString().slice(0, 10);
  const isClosed = ticket.status === 'Closed' || ticket.status === 'Signed Off';

  // Was the scheduled date ever changed?
  const wasRescheduled = (ticket.scheduleHistory?.length ?? 0) > 0;

  // Arrival dates from all work logs on this ticket
  const arrivalDateStrs = arrivalTimes.map(toDateStr).filter(Boolean) as string[];

  // Was there work logged on the original scheduled day?
  const workedOnScheduledDay = arrivalDateStrs.includes(scheduledStr);

  if (workedOnScheduledDay) {
    // Work happened on the scheduled date — on time (even if it was previously rescheduled)
    return 'on_time';
  }

  if (wasRescheduled) {
    // The date was changed at some point; report it as rescheduled regardless of new outcome
    return 'rescheduled';
  }

  if (scheduledStr > todayStr) {
    // Still in the future
    return 'upcoming';
  }

  // Past the scheduled date, no work on that day
  if (isClosed) {
    // Ticket is closed — work was done, but on a different day
    return 'completed_late';
  }

  // Open ticket, past scheduled date, no work logged on scheduled day → overdue/missed
  return 'overdue';
}

/**
 * Aggregate visit statuses across a collection of tickets.
 *
 * @param tickets      - Filtered list of ReportTickets.
 * @param workLogsByTicketId - Map of ticketId → array of arrival time ISO strings.
 */
export function aggregateVisitStatuses(tickets: ReportTicket[], workLogsByTicketId: Map<string, (string | null | undefined)[]>): Record<VisitStatus, number> {
  const counts: Record<VisitStatus, number> = {
    on_time: 0,
    rescheduled: 0,
    completed_late: 0,
    overdue: 0,
    upcoming: 0,
    no_schedule: 0,
  };

  for (const ticket of tickets) {
    const arrivalTimes = workLogsByTicketId.get(ticket.id) ?? [];
    const status = calculateVisitStatus(ticket, arrivalTimes);
    counts[status]++;
  }

  return counts;
}
