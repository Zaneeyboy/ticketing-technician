'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache';

export interface WorkLogEntry {
  id: string;
  ticketId: string;
  machineId: string;
  machineType?: string;
  machineSerialNumber?: string;
  arrivalTime?: string | null;
  departureTime?: string | null;
  hoursWorked?: number;
  workPerformed?: string;
  outcome?: string;
  repairs?: string;
  partsUsed?: Array<{
    partId: string;
    partName: string;
    quantity: number;
  }>;
  maintenanceRecommendation?: {
    date?: string | null;
    notes?: string;
  };
}

const toIsoString = (value: any) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  return null;
};

const getCachedWorkLogsForTicket = (ticketId: string) =>
  unstable_cache(
    async () => {
      const snapshot = await adminDb.collection('machineWorkLogs').where('ticketId', '==', ticketId).get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ticketId: data.ticketId,
          machineId: data.machineId,
          machineType: data.machineType,
          machineSerialNumber: data.machineSerialNumber,
          arrivalTime: toIsoString(data.arrivalTime),
          departureTime: toIsoString(data.departureTime),
          hoursWorked: data.hoursWorked,
          workPerformed: data.workPerformed,
          outcome: data.outcome,
          repairs: data.repairs,
          partsUsed: data.partsUsed || [],
          maintenanceRecommendation: data.maintenanceRecommendation
            ? {
                date: toIsoString(data.maintenanceRecommendation.date),
                notes: data.maintenanceRecommendation.notes || '',
              }
            : undefined,
        } as WorkLogEntry;
      });
    },
    [`${CACHE_TAGS.WORK_LOGS}-${ticketId}`],
    { tags: [`${CACHE_TAGS.WORK_LOGS}-${ticketId}`], revalidate: 60 },
  );

export async function getWorkLogsForTicket(ticketId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'call_admin', 'management', 'technician'].includes(user.role)) {
      return { success: false, error: 'Unauthorized', logs: [] as WorkLogEntry[] };
    }

    const logs = await getCachedWorkLogsForTicket(ticketId)();
    return { success: true, logs };
  } catch (error: any) {
    console.error('Error fetching work logs:', error);
    return { success: false, error: error.message || 'Failed to load work logs', logs: [] as WorkLogEntry[] };
  }
}
