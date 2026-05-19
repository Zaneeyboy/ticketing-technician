'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createTicketSchema, updateTicketSchema, technicianUpdateSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';
import { updateCallAdminAggregatesOnCreate, updateCallAdminAggregatesOnStatusChange } from './aggregates';
import { sendTicketCreatedEmail, sendTicketAssignedEmail } from '@/lib/email';
import { appendPartsToMachine } from './machines';

/** Returns the Firestore collection ref scoped to a store. */
function storeCol(storeId: string, col: string) {
  return adminDb.collection('stores').doc(storeId).collection(col);
}

export interface CustomerForTicket {
  id: string;
  companyName: string;
  contactPerson: string;
}

export interface MachineForTicket {
  id: string;
  customerId: string;
  type: string;
  serialNumber: string;
}

export interface TechnicianForTicket {
  id: string;
  name: string;
}

export async function getCustomersForTickets(): Promise<CustomerForTicket[]> {
  const user = await getCurrentUser();
  if (!user?.storeId) return [];

  const storeId = user.storeId;
  const cached = unstable_cache(
    async () => {
      const snapshot = await storeCol(storeId, 'customers').get();
      return snapshot.docs
        .filter((doc) => !doc.data().isDisabled)
        .map((doc) => ({
          id: doc.id,
          companyName: doc.data().companyName,
          contactPerson: doc.data().contactPerson,
        }));
    },
    [`${CACHE_TAGS.CUSTOMERS}-${storeId}`],
    { tags: [`${CACHE_TAGS.CUSTOMERS}-${storeId}`], revalidate: false },
  );
  return cached();
}

export async function getMachinesForCustomer(customerId: string): Promise<MachineForTicket[]> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role)) {
      return [];
    }

    const snapshot = await storeCol(user.storeId, 'machines').where('customerId', '==', customerId).get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      customerId: doc.data().customerId,
      type: doc.data().type,
      serialNumber: doc.data().serialNumber,
    }));
  } catch (error: any) {
    console.error('Error fetching machines:', error);
    return [];
  }
}

export async function getTechniciansForAssignment(): Promise<TechnicianForTicket[]> {
  const user = await getCurrentUser();
  if (!user?.storeId) return [];

  const storeId = user.storeId;
  const cached = unstable_cache(
    async () => {
      const snapshot = await adminDb.collection('users').where('role', '==', 'technician').where('storeId', '==', storeId).get();
      return snapshot.docs.filter((doc) => !doc.data().disabled).map((doc) => ({ id: doc.id, name: doc.data().name }));
    },
    [`${CACHE_TAGS.TECHNICIANS}-${storeId}`],
    { tags: [`${CACHE_TAGS.TECHNICIANS}-${storeId}`], revalidate: false },
  );
  return cached();
}

export async function createTicket(data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const validated = createTicketSchema.parse(data);

    if (!validated.machines || validated.machines.length === 0) {
      return { success: false, error: 'At least one machine is required' };
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const startOfDay = new Date(year, now.getMonth(), now.getDate());
    const endOfDay = new Date(year, now.getMonth(), now.getDate() + 1);

    const todayTickets = await storeCol(storeId, 'tickets').where('createdAt', '>=', Timestamp.fromDate(startOfDay)).where('createdAt', '<', Timestamp.fromDate(endOfDay)).get();

    const count = String(todayTickets.size + 1).padStart(3, '0');
    const ticketNumber = `TKT-${year}${month}${day}-${count}`;

    let assignedToName: string | null = null;
    let assignedTechEmail: string | undefined;
    if (validated.assignedTo) {
      const assignedUserDoc = await adminDb.collection('users').doc(validated.assignedTo).get();
      if (assignedUserDoc.exists) {
        const d = assignedUserDoc.data();
        assignedToName = d?.name ?? null;
        assignedTechEmail = d?.email;
      }
    }

    const ticketData = {
      ticketNumber,
      machines: validated.machines,
      briefDescription: validated.briefDescription || null,
      issueDescription: validated.issueDescription,
      internalNotes: validated.internalNotes || null,
      contactPerson: validated.contactPerson,
      assignedTo: validated.assignedTo || null,
      assignedToName: assignedToName,
      status: validated.assignedTo ? 'Assigned' : 'Open',
      scheduledVisitDate: validated.scheduledVisitDate ? Timestamp.fromDate(validated.scheduledVisitDate) : null,
      additionalNotes: validated.additionalNotes || null,
      storeId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: user.uid,
      createdByName: user.name ?? null,
      statusHistory: [
        {
          status: validated.assignedTo ? 'Assigned' : 'Open',
          changedAt: Timestamp.now(),
          changedByUid: user.uid,
          changedByName: user.name,
        },
      ],
    };

    const docRef = await storeCol(storeId, 'tickets').add(ticketData);

    // One-time auto-activate: promote store from 'onboarding' → 'active' on first ticket
    const storeDoc = await adminDb.collection('stores').doc(storeId).get();
    if (storeDoc.exists && storeDoc.data()?.status === 'onboarding') {
      await adminDb.collection('stores').doc(storeId).update({ status: 'active', updatedAt: Timestamp.now() });
      await revalidateCache([CACHE_TAGS.STORES]);
    }

    const creatorDoc = await adminDb.collection('users').doc(user.uid).get();
    if (creatorDoc.exists && creatorDoc.data()?.role === 'call_admin') {
      await updateCallAdminAggregatesOnCreate(user.uid, ticketData);
    }

    await revalidateCache([`${CACHE_TAGS.TICKETS}-${storeId}`, CACHE_TAGS.TICKETS]);
    await revalidateCache([`${CACHE_TAGS.TECHNICIANS}-${storeId}`]);
    await revalidateCache([CACHE_TAGS.REPORTS]);
    await revalidateCache([`${CACHE_TAGS.CALL_ADMINS}-${user.uid}`]);
    revalidatePath('/tickets');
    revalidatePath('/dashboard');

    // Send ticket notification emails — non-blocking
    const storeName = user.storeName ?? storeId;
    const machineSummary = validated.machines.map((m: any) => ({
      customerName: m.customerName,
      machineType: m.machineType,
      serialNumber: m.serialNumber,
      priority: m.priority,
    }));
    const scheduledDate = validated.scheduledVisitDate ?? null;

    // Confirmation to the creator
    if (user.email) {
      sendTicketCreatedEmail({
        to: user.email,
        creatorName: user.name,
        ticketNumber,
        ticketId: docRef.id,
        storeName,
        machines: machineSummary,
        issueDescription: validated.issueDescription,
        assignedToName,
        scheduledDate,
      }).catch((e) => console.error('sendTicketCreatedEmail failed:', e));
    }

    // Assignment notification to the technician
    if (validated.assignedTo && assignedTechEmail) {
      sendTicketAssignedEmail({
        to: assignedTechEmail,
        technicianName: assignedToName ?? 'Technician',
        ticketNumber,
        ticketId: docRef.id,
        storeName,
        machines: machineSummary,
        issueDescription: validated.issueDescription,
        createdByName: user.name,
        scheduledDate,
      }).catch((e) => console.error('sendTicketAssignedEmail failed:', e));
    }

    return { success: true, ticketId: docRef.id, ticketNumber };
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    return { success: false, error: error.message || 'Failed to create ticket' };
  }
}

export async function updateTicket(ticketId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const ticketDoc = await storeCol(storeId, 'tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { success: false, error: 'Ticket not found' };
    }

    const currentTicketData = ticketDoc.data();
    const oldStatus = currentTicketData?.status;

    const validated = updateTicketSchema.parse(data);

    const updateData: any = {
      ...validated,
      updatedAt: Timestamp.now(),
    };

    if (validated.scheduledVisitDate !== undefined) {
      if (validated.scheduledVisitDate === null) {
        updateData.scheduledVisitDate = null;
      } else if (validated.scheduledVisitDate instanceof Date) {
        updateData.scheduledVisitDate = Timestamp.fromDate(validated.scheduledVisitDate);
      }
    }

    if (validated.assignedTo) {
      const assignedUserDoc = await adminDb.collection('users').doc(validated.assignedTo).get();
      if (assignedUserDoc.exists) {
        updateData.assignedToName = assignedUserDoc.data()?.name;
      }
      if (!validated.status) {
        updateData.status = 'Assigned';
      }
    }

    const newStatus = updateData.status || oldStatus;
    if (oldStatus && newStatus !== oldStatus && currentTicketData?.createdBy) {
      const creatorDoc = await adminDb.collection('users').doc(currentTicketData.createdBy).get();
      if (creatorDoc.exists && creatorDoc.data()?.role === 'call_admin') {
        await updateCallAdminAggregatesOnStatusChange(currentTicketData.createdBy, oldStatus, newStatus);
      }
    }

    // Append to status history whenever status actually changes
    if (oldStatus && newStatus !== oldStatus) {
      const { FieldValue } = await import('firebase-admin/firestore');
      updateData.statusHistory = FieldValue.arrayUnion({
        status: newStatus,
        changedAt: Timestamp.now(),
        changedByUid: user.uid,
        changedByName: user.name,
      });
    }

    await storeCol(storeId, 'tickets').doc(ticketId).update(updateData);

    await revalidateCache([`${CACHE_TAGS.TICKETS}-${storeId}`, CACHE_TAGS.TICKETS]);
    await revalidateCache([`${CACHE_TAGS.TECHNICIANS}-${storeId}`]);
    await revalidateCache([CACHE_TAGS.REPORTS]);
    if (currentTicketData?.createdBy) {
      await revalidateCache([`${CACHE_TAGS.CALL_ADMINS}-${currentTicketData.createdBy}`]);
    }
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    return { success: false, error: error.message || 'Failed to update ticket' };
  }
}

export async function addWorkLogEntry(ticketId: string, machineId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || user.role !== 'technician') {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const ticketDoc = await storeCol(storeId, 'tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { success: false, error: 'Ticket not found' };
    }

    const ticketData = ticketDoc.data();
    if (ticketData?.assignedTo !== user.uid) {
      return { success: false, error: 'This ticket is not assigned to you' };
    }

    const validated = technicianUpdateSchema.parse(data);

    const ticketMachine = ticketData?.machines?.find((m: any) => m.machineId === machineId);
    if (!ticketMachine) {
      return { success: false, error: 'Machine not found in ticket' };
    }

    const workLogsQuery = await storeCol(storeId, 'machineWorkLogs').where('ticketId', '==', ticketId).where('machineId', '==', machineId).get();

    const updateData: any = {
      ...validated,
      recordedBy: user.uid,
      updatedAt: Timestamp.now(),
    };

    if (validated.arrivalTime) updateData.arrivalTime = Timestamp.fromDate(validated.arrivalTime);
    if (validated.departureTime) updateData.departureTime = Timestamp.fromDate(validated.departureTime);
    if (validated.maintenanceRecommendation?.date) {
      updateData.maintenanceRecommendation = {
        ...validated.maintenanceRecommendation,
        date: Timestamp.fromDate(validated.maintenanceRecommendation.date),
      };
    }

    if (workLogsQuery.empty) {
      await storeCol(storeId, 'machineWorkLogs').add({
        ticketId,
        machineId,
        machineType: ticketMachine.machineType,
        machineSerialNumber: ticketMachine.serialNumber,
        ...updateData,
        createdAt: Timestamp.now(),
      });
    } else {
      await workLogsQuery.docs[0].ref.update(updateData);
    }

    await revalidateCache([CACHE_TAGS.WORK_LOGS, CACHE_TAGS.REPORTS, `${CACHE_TAGS.WORK_LOGS}-${ticketId}`]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error adding work log entry:', error);
    return { success: false, error: error.message || 'Failed to add work log entry' };
  }
}

export async function addBulkWorkLogEntries(ticketId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || user.role !== 'technician') {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const ticketDoc = await storeCol(storeId, 'tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { success: false, error: 'Ticket not found' };
    }

    const ticketData = ticketDoc.data();
    if (ticketData?.assignedTo !== user.uid) {
      return { success: false, error: 'This ticket is not assigned to you' };
    }

    const { bulkWorkLogSchema } = await import('@/lib/schemas');
    let validated;
    try {
      validated = bulkWorkLogSchema.parse(data);
    } catch (zodErr: any) {
      // Surface the first human-readable Zod issue instead of raw JSON
      const firstIssue = zodErr?.errors?.[0];
      const message = firstIssue ? `${firstIssue.path.at(-1) ? `${firstIssue.path.at(-1)}: ` : ''}${firstIssue.message}` : 'Invalid work log data';
      return { success: false, error: message };
    }

    const arrivalTimestamp = Timestamp.fromDate(validated.arrivalTime);
    const departureTimestamp = validated.departureTime ? Timestamp.fromDate(validated.departureTime) : undefined;

    const batch = adminDb.batch();
    let processedCount = 0;

    for (const machineLog of validated.machineWorkLogs) {
      const ticketMachine = ticketData?.machines?.find((m: any) => m.machineId === machineLog.machineId);
      if (!ticketMachine) continue;

      const workLogsQuery = await storeCol(storeId, 'machineWorkLogs').where('ticketId', '==', ticketId).where('machineId', '==', machineLog.machineId).get();

      const workLogData: any = {
        arrivalTime: arrivalTimestamp,
        departureTime: departureTimestamp,
        hoursWorked: validated.hoursWorked,
        checklistItems: validated.checklistItems ?? [],
        workPerformed: machineLog.workPerformed,
        outcome: machineLog.outcome,
        repairs: machineLog.repairs,
        partsUsed: machineLog.partsUsed || [],
        recordedBy: user.uid,
        updatedAt: Timestamp.now(),
      };

      const rec = machineLog.maintenanceRecommendation;
      if (rec?.date || rec?.notes) {
        workLogData.maintenanceRecommendation = {
          ...(rec.date ? { date: Timestamp.fromDate(rec.date) } : {}),
          notes: rec.notes || '',
        };
      }

      if (workLogsQuery.empty) {
        const newDocRef = storeCol(storeId, 'machineWorkLogs').doc();
        batch.set(newDocRef, {
          ticketId,
          machineId: machineLog.machineId,
          machineType: ticketMachine.machineType,
          machineSerialNumber: ticketMachine.serialNumber,
          ...workLogData,
          createdAt: Timestamp.now(),
        });
      } else {
        batch.update(workLogsQuery.docs[0].ref, workLogData);
      }

      processedCount++;
    }

    await batch.commit();

    // Auto-associate parts with each machine (non-blocking, best-effort)
    for (const machineLog of validated.machineWorkLogs) {
      const parts = (machineLog.partsUsed ?? []).filter((p: any) => p.partName?.trim());
      if (parts.length > 0 && machineLog.machineId) {
        appendPartsToMachine(
          machineLog.machineId,
          parts.map((p: any) => ({ partId: p.partId, partName: p.partName })),
        ).catch((e) => console.error('appendPartsToMachine failed:', e));
      }
    }

    await revalidateCache([CACHE_TAGS.WORK_LOGS, CACHE_TAGS.REPORTS, `${CACHE_TAGS.WORK_LOGS}-${ticketId}`]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');

    return { success: true, count: processedCount };
  } catch (error: any) {
    console.error('Error adding bulk work log entries:', error);
    return { success: false, error: error.message || 'Failed to add work log entries' };
  }
}

export async function closeTicket(ticketId: string) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || user.role !== 'technician') {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const ticketDoc = await storeCol(storeId, 'tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { success: false, error: 'Ticket not found' };
    }

    const ticketData = ticketDoc.data();
    if (ticketData?.assignedTo !== user.uid) {
      return { success: false, error: 'This ticket is not assigned to you' };
    }

    const workLogs = await storeCol(storeId, 'machineWorkLogs').where('ticketId', '==', ticketId).get();
    const ticketMachineIds = (ticketData?.machines || []).map((m: any) => m.machineId);

    const workLogsByMachine = new Map();
    workLogs.docs.forEach((doc) => workLogsByMachine.set(doc.data().machineId, doc.data()));

    for (const machineId of ticketMachineIds) {
      const logData = workLogsByMachine.get(machineId);
      if (!logData || !logData.workPerformed || !logData.outcome) {
        return { success: false, error: 'All machines must have work details logged before closing' };
      }
    }

    await storeCol(storeId, 'tickets')
      .doc(ticketId)
      .update({
        status: 'Closed',
        closedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        statusHistory: (await import('firebase-admin/firestore')).FieldValue.arrayUnion({
          status: 'Closed',
          changedAt: Timestamp.now(),
          changedByUid: user.uid,
          changedByName: user.name,
        }),
      });

    await revalidateCache([`${CACHE_TAGS.TICKETS}-${storeId}`, CACHE_TAGS.TICKETS, CACHE_TAGS.WORK_LOGS, CACHE_TAGS.REPORTS]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error closing ticket:', error);
    return { success: false, error: error.message || 'Failed to close ticket' };
  }
}

export async function technicianUpdateTicket(ticketId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || user.role !== 'technician') {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const ticketDoc = await storeCol(storeId, 'tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { success: false, error: 'Ticket not found' };
    }

    const ticketData = ticketDoc.data();
    if (ticketData?.assignedTo !== user.uid) {
      return { success: false, error: 'This ticket is not assigned to you' };
    }

    const validated = technicianUpdateSchema.parse(data);

    const updateData: any = {
      ...validated,
      updatedAt: Timestamp.now(),
    };

    if (validated.arrivalTime) updateData.arrivalTime = Timestamp.fromDate(validated.arrivalTime);
    if (validated.departureTime) {
      updateData.departureTime = Timestamp.fromDate(validated.departureTime);
      updateData.status = 'Closed';
      updateData.closedAt = Timestamp.now();
    }
    if (validated.maintenanceRecommendation?.date) {
      updateData.maintenanceRecommendation = {
        ...validated.maintenanceRecommendation,
        date: Timestamp.fromDate(validated.maintenanceRecommendation.date),
      };
    }

    await storeCol(storeId, 'tickets').doc(ticketId).update(updateData);

    await revalidateCache([`${CACHE_TAGS.TICKETS}-${storeId}`, CACHE_TAGS.TICKETS, CACHE_TAGS.REPORTS]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    return { success: false, error: error.message || 'Failed to update ticket' };
  }
}

export async function getWorkLogsForTicket(ticketId: string) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId) {
      return { success: false, error: 'Unauthorized' };
    }

    const workLogsSnapshot = await storeCol(user.storeId, 'machineWorkLogs').where('ticketId', '==', ticketId).get();

    const workLogs = workLogsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        machineId: data.machineId,
        machineType: data.machineType,
        machineSerialNumber: data.machineSerialNumber,
        ticketId: data.ticketId,
        workPerformed: data.workPerformed || '',
        outcome: data.outcome || '',
        repairs: data.repairs || '',
        arrivalTime: data.arrivalTime?.toDate() || null,
        departureTime: data.departureTime?.toDate() || null,
        hoursWorked: data.hoursWorked || 0,
        checklistItems: (data.checklistItems as number[]) || [],
        partsUsed: data.partsUsed || [],
        maintenanceRecommendation: data.maintenanceRecommendation
          ? {
              date: data.maintenanceRecommendation.date?.toDate() || null,
              notes: data.maintenanceRecommendation.notes || '',
            }
          : null,
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate() || null,
      };
    });

    return { success: true, workLogs };
  } catch (error: any) {
    console.error('Error fetching work logs:', error);
    return { success: false, error: error.message || 'Failed to fetch work logs' };
  }
}

// ─── getStoreTickets ──────────────────────────────────────────────────────────
// Server-side ticket fetch for the technicians page and schedule page.
// Uses admin SDK — bypasses Firestore client rules.

export interface StoreTicketRow {
  id: string;
  ticketNumber: string;
  status: string;
  issueDescription: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string;
  createdAt: Date | null;
  closedAt: Date | null;
  updatedAt: Date | null;
  scheduledVisitDate: Date | null;
  storeId: string;
  machines: any[];
  contactPerson?: string;
  additionalNotes?: string;
}

export async function getStoreTickets(): Promise<StoreTicketRow[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    let snap: FirebaseFirestore.QuerySnapshot;

    if (user.role === 'technician' && user.storeId) {
      snap = await storeCol(user.storeId, 'tickets').where('assignedTo', '==', user.uid).orderBy('createdAt', 'desc').get();
    } else if (user.storeId) {
      snap = await storeCol(user.storeId, 'tickets').orderBy('createdAt', 'desc').get();
    } else if (user.role === 'super_admin' || user.role === 'manager') {
      // HQ — use collection group to span all stores
      snap = await adminDb.collectionGroup('tickets').orderBy('createdAt', 'desc').get();
    } else {
      return [];
    }

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ticketNumber: d.ticketNumber ?? '',
        status: d.status ?? '',
        issueDescription: d.issueDescription ?? '',
        assignedTo: d.assignedTo ?? null,
        assignedToName: d.assignedToName ?? null,
        createdBy: d.createdBy ?? '',
        createdAt: d.createdAt?.toDate() ?? null,
        closedAt: d.closedAt?.toDate() ?? null,
        updatedAt: d.updatedAt?.toDate() ?? null,
        scheduledVisitDate: d.scheduledVisitDate?.toDate() ?? null,
        storeId: d.storeId ?? user.storeId ?? '',
        machines: d.machines ?? [],
        contactPerson: d.contactPerson ?? undefined,
        additionalNotes: d.additionalNotes ?? undefined,
      };
    });
  } catch (error: any) {
    console.error('getStoreTickets error:', error);
    return [];
  }
}

export async function getTechnicianTickets(technicianId: string): Promise<StoreTicketRow[]> {
  try {
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'store_admin', 'manager'].includes(user.role)) return [];

    let snap: FirebaseFirestore.QuerySnapshot;
    if (user.storeId) {
      snap = await storeCol(user.storeId, 'tickets').where('assignedTo', '==', technicianId).orderBy('createdAt', 'desc').get();
    } else {
      snap = await adminDb.collectionGroup('tickets').where('assignedTo', '==', technicianId).orderBy('createdAt', 'desc').get();
    }

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ticketNumber: d.ticketNumber ?? '',
        status: d.status ?? '',
        issueDescription: d.issueDescription ?? '',
        assignedTo: d.assignedTo ?? null,
        assignedToName: d.assignedToName ?? null,
        createdBy: d.createdBy ?? '',
        createdAt: d.createdAt?.toDate() ?? null,
        closedAt: d.closedAt?.toDate() ?? null,
        updatedAt: d.updatedAt?.toDate() ?? null,
        scheduledVisitDate: d.scheduledVisitDate?.toDate() ?? null,
        storeId: d.storeId ?? '',
        machines: d.machines ?? [],
        contactPerson: d.contactPerson ?? undefined,
        additionalNotes: d.additionalNotes ?? undefined,
      };
    });
  } catch (error: any) {
    console.error('getTechnicianTickets error:', error);
    return [];
  }
}

// ── Sign-Off Token ─────────────────────────────────────────────────────────────

const SIGN_OFF_EXPIRY_HOURS = 72; // 3 days

/**
 * Generates (or regenerates) a secure sign-off token for a ticket.
 * Stores the token in a top-level `signOffTokens` collection for fast
 * public lookup, and also writes the link info to the ticket document.
 * Any previous token is superseded so only one link is valid at a time.
 */
export async function generateSignOffToken(ticketId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'store_manager', 'technician'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const ticketDoc = await storeCol(storeId, 'tickets').doc(ticketId).get();
    if (!ticketDoc.exists) return { success: false, error: 'Ticket not found' };
    if (ticketDoc.data()?.status === 'Closed') return { success: false, error: 'Ticket is already closed' };

    const { randomUUID } = await import('crypto');
    const token = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SIGN_OFF_EXPIRY_HOURS * 60 * 60 * 1000);
    const nowTs = Timestamp.fromDate(now);
    const expiresTs = Timestamp.fromDate(expiresAt);

    // Supersede any existing token so only this new link is valid
    const existingToken = ticketDoc.data()?.signOffLink?.token;
    if (existingToken) {
      await adminDb
        .collection('signOffTokens')
        .doc(existingToken)
        .update({ superseded: true })
        .catch(() => {});
    }

    // Write token to fast-lookup collection (no auth required — API route uses Admin SDK)
    await adminDb.collection('signOffTokens').doc(token).set({
      storeId,
      ticketId,
      createdAt: nowTs,
      expiresAt: expiresTs,
      used: false,
      superseded: false,
    });

    // Write link metadata to the ticket document
    await storeCol(storeId, 'tickets')
      .doc(ticketId)
      .update({
        signOffLink: { token, createdAt: nowTs, expiresAt: expiresTs },
        updatedAt: nowTs,
      });

    await revalidateCache([`${CACHE_TAGS.TICKETS}-${storeId}`, CACHE_TAGS.TICKETS]);
    revalidatePath(`/tickets/${ticketId}`);

    return { success: true, token };
  } catch (error: any) {
    console.error('Error generating sign-off token:', error);
    return { success: false, error: error.message || 'Failed to generate sign-off link' };
  }
}

/**
 * Allows store admins / managers to force-close a ticket without customer sign-off.
 * Used when the customer is unresponsive beyond an acceptable timeframe.
 */
export async function adminForceCloseTicket(ticketId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'store_manager'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const ticketDoc = await storeCol(storeId, 'tickets').doc(ticketId).get();
    if (!ticketDoc.exists) return { success: false, error: 'Ticket not found' };
    if (ticketDoc.data()?.status === 'Closed') return { success: false, error: 'Ticket is already closed' };

    const { FieldValue } = await import('firebase-admin/firestore');
    const now = Timestamp.now();

    await storeCol(storeId, 'tickets')
      .doc(ticketId)
      .update({
        status: 'Closed',
        closedAt: now,
        updatedAt: now,
        forceClosedBy: user.uid,
        forceClosedByName: user.name,
        statusHistory: FieldValue.arrayUnion({
          status: 'Closed',
          changedAt: now,
          changedByUid: user.uid,
          changedByName: user.name,
          note: 'Force closed by admin — no customer sign-off',
        }),
      });

    await revalidateCache([`${CACHE_TAGS.TICKETS}-${storeId}`, CACHE_TAGS.TICKETS, CACHE_TAGS.REPORTS]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('Error force closing ticket:', error);
    return { success: false, error: error.message || 'Failed to close ticket' };
  }
}
