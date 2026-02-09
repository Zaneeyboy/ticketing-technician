'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache';
import type { ReportBaseData, ReportCustomer, ReportMachine, ReportPart, ReportTechnician, ReportTicket, ReportTicketMachine, ReportWorkLog } from '@/lib/types/reporting';

const toIsoString = (value: any) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  return null;
};

const getCachedReportBaseData = unstable_cache(
  async (): Promise<ReportBaseData> => {
    const [ticketsSnap, workLogsSnap, customersSnap, machinesSnap, techniciansSnap, partsSnap] = await Promise.all([
      adminDb.collection('tickets').get(),
      adminDb.collection('machineWorkLogs').get(),
      adminDb.collection('customers').get(),
      adminDb.collection('machines').get(),
      adminDb.collection('users').where('role', '==', 'technician').get(),
      adminDb.collection('parts').get(),
    ]);

    const tickets: ReportTicket[] = ticketsSnap.docs.map((doc) => {
      const data = doc.data();
      const machines = Array.isArray(data.machines) ? data.machines : [];
      const ticketMachines: ReportTicketMachine[] = machines.map((machine: any) => ({
        machineId: machine.machineId,
        customerId: machine.customerId,
        customerName: machine.customerName || 'Unknown',
        machineType: machine.machineType || 'Unknown',
        serialNumber: machine.serialNumber || 'Unknown',
        priority: machine.priority,
      }));

      return {
        id: doc.id,
        ticketNumber: data.ticketNumber || '',
        status: data.status || 'Open',
        createdAt: toIsoString(data.createdAt),
        closedAt: toIsoString(data.closedAt),
        assignedTo: data.assignedTo || null,
        assignedToName: data.assignedToName || null,
        issueDescription: data.issueDescription || null,
        machines: ticketMachines,
      };
    });

    const workLogs: ReportWorkLog[] = workLogsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ticketId: data.ticketId,
        machineId: data.machineId,
        recordedBy: data.recordedBy || null,
        arrivalTime: toIsoString(data.arrivalTime),
        departureTime: toIsoString(data.departureTime),
        hoursWorked: typeof data.hoursWorked === 'number' ? data.hoursWorked : null,
        workPerformed: data.workPerformed || null,
        outcome: data.outcome || null,
        repairs: data.repairs || null,
        partsUsed: Array.isArray(data.partsUsed) ? data.partsUsed : [],
      };
    });

    const customers: ReportCustomer[] = customersSnap.docs
      .filter((doc) => doc.data().isDisabled !== true)
      .map((doc) => ({
        id: doc.id,
        companyName: doc.data().companyName || 'Unknown',
      }));

    const machines: ReportMachine[] = machinesSnap.docs.map((doc) => ({
      id: doc.id,
      customerId: doc.data().customerId,
      type: doc.data().type || 'Unknown',
      serialNumber: doc.data().serialNumber || 'Unknown',
    }));

    const technicians: ReportTechnician[] = techniciansSnap.docs
      .filter((doc) => doc.data().disabled !== true)
      .map((doc) => ({
        id: doc.id,
        name: doc.data().name || 'Unknown',
      }));

    const parts: ReportPart[] = partsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || 'Unknown',
      category: doc.data().category || null,
    }));

    return { tickets, workLogs, customers, machines, technicians, parts };
  },
  ['report-base-data'],
  {
    tags: [CACHE_TAGS.REPORTS, CACHE_TAGS.TICKETS, CACHE_TAGS.WORK_LOGS, CACHE_TAGS.CUSTOMERS, CACHE_TAGS.MACHINES, CACHE_TAGS.TECHNICIANS, CACHE_TAGS.PARTS],
    revalidate: false,
  },
);

export async function getReportBaseData(): Promise<ReportBaseData> {
  const user = await getCurrentUser();
  if (!user || !['admin', 'management'].includes(user.role)) {
    return { tickets: [], workLogs: [], customers: [], machines: [], technicians: [], parts: [] };
  }

  return getCachedReportBaseData();
}
