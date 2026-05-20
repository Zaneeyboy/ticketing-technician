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
      createdByName: user.name || user.email || null,
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

    // Non-blocking: mark pending maintenance reminders for these machines as 'scheduled'
    // so the schedule page and modal know a follow-up has been booked.
    const machineIds = (validated.machines ?? []).map((m: any) => m.machineId).filter(Boolean);
    if (machineIds.length > 0) {
      Promise.all(
        machineIds.map(async (mId: string) => {
          const reminderRef = storeCol(storeId, 'maintenanceReminders').doc(mId);
          const snap = await reminderRef.get();
          if (snap.exists && snap.data()?.status === 'pending') {
            await reminderRef.update({
              status: 'scheduled',
              scheduledTicketId: docRef.id,
              scheduledTicketNumber: ticketNumber,
              updatedAt: Timestamp.now(),
            });
          }
        }),
      ).catch((e) => console.error('linkMaintenanceReminders failed:', e));
    }

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
      const oldScheduledDate = currentTicketData?.scheduledVisitDate;
      const newScheduledDate = validated.scheduledVisitDate;

      if (newScheduledDate === null) {
        updateData.scheduledVisitDate = null;
      } else if (newScheduledDate instanceof Date) {
        updateData.scheduledVisitDate = Timestamp.fromDate(newScheduledDate);
      }

      // If there was a previous date and it's different from the new one, record the change
      const hadPreviousDate = oldScheduledDate != null;
      const dateActuallyChanged =
        hadPreviousDate &&
        (() => {
          const oldMs =
            oldScheduledDate instanceof Timestamp ? oldScheduledDate.toMillis() : (oldScheduledDate as any)?.seconds != null ? oldScheduledDate.seconds * 1000 : new Date(oldScheduledDate).getTime();
          const newMs = newScheduledDate instanceof Date ? newScheduledDate.getTime() : null;
          if (newMs === null) return true; // clearing the date
          return Math.abs(oldMs - newMs) > 60_000; // > 1 min difference to avoid trivial diffs
        })();

      if (dateActuallyChanged) {
        const { FieldValue } = await import('firebase-admin/firestore');
        updateData.scheduleHistory = FieldValue.arrayUnion({
          previousDate: oldScheduledDate, // already a Timestamp from Firestore
          rescheduledAt: Timestamp.now(),
          rescheduledByUid: user.uid,
          rescheduledByName: user.name,
        });
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
      // Denormalized top-level field for efficient schedule page queries
      updateData.maintenanceDate = Timestamp.fromDate(validated.maintenanceRecommendation.date);
    } else {
      updateData.maintenanceDate = null;
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

    // Upsert maintenanceReminders — one document per machine, keyed by machineId
    if (validated.maintenanceRecommendation?.date) {
      await storeCol(storeId, 'maintenanceReminders')
        .doc(machineId)
        .set({
          machineId,
          machineType: ticketMachine.machineType,
          machineSerialNumber: ticketMachine.serialNumber,
          customerId: ticketMachine.customerId,
          customerName: ticketMachine.customerName,
          recommendedDate: Timestamp.fromDate(validated.maintenanceRecommendation.date),
          notes: validated.maintenanceRecommendation.notes || '',
          sourceTicketId: ticketId,
          sourceTicketNumber: ticketData?.ticketNumber ?? '',
          status: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
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
        // Denormalized top-level field for efficient schedule page queries
        workLogData.maintenanceDate = rec.date ? Timestamp.fromDate(rec.date) : null;
      } else {
        workLogData.maintenanceDate = null;
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

      // Upsert maintenanceReminders within the same batch — one document per machine
      if (rec?.date) {
        const reminderRef = storeCol(storeId, 'maintenanceReminders').doc(machineLog.machineId);
        batch.set(reminderRef, {
          machineId: machineLog.machineId,
          machineType: ticketMachine.machineType,
          machineSerialNumber: ticketMachine.serialNumber,
          customerId: ticketMachine.customerId,
          customerName: ticketMachine.customerName,
          recommendedDate: Timestamp.fromDate(rec.date),
          notes: rec.notes || '',
          sourceTicketId: ticketId,
          sourceTicketNumber: ticketData?.ticketNumber ?? '',
          status: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
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
    if (['Closed', 'Signed Off'].includes(ticketDoc.data()?.status)) return { success: false, error: 'Ticket is already closed' };

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

    const { FieldValue } = await import('firebase-admin/firestore');

    // Set ticket to 'Signoff Required' — work is done, awaiting customer sign-off.
    // Status advances to 'Closed' once the customer submits the sign-off form.
    await storeCol(storeId, 'tickets')
      .doc(ticketId)
      .update({
        status: 'Signoff Required',
        signOffLink: { token, createdAt: nowTs, expiresAt: expiresTs },
        updatedAt: nowTs,
        statusHistory: FieldValue.arrayUnion({
          status: 'Signoff Required',
          changedAt: nowTs,
          changedByUid: user.uid,
          changedByName: user.name,
          note: 'Sign-off link sent to customer — awaiting signature',
        }),
      });

    await revalidateCache([`${CACHE_TAGS.TICKETS}-${storeId}`, CACHE_TAGS.TICKETS, CACHE_TAGS.REPORTS]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');

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
    if (['Closed', 'Signed Off'].includes(ticketDoc.data()?.status)) return { success: false, error: 'Ticket is already closed' };

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

// ── getMachineWorkHistory ──────────────────────────────────────────────────────
// Returns all work logs for a specific machine across all tickets, ordered by
// most recent first. Used by technicians to review a machine's service history
// before performing new work.

export interface MachineWorkHistoryEntry {
  id: string;
  ticketId: string;
  ticketNumber: string;
  machineId: string;
  machineType: string;
  machineSerialNumber: string;
  arrivalTime: Date | null;
  departureTime: Date | null;
  hoursWorked: number | null;
  workPerformed: string;
  outcome: string;
  repairs: string;
  partsUsed: Array<{ partId?: string; partName: string; quantity: number }>;
  maintenanceRecommendation: { date: Date | null; notes: string } | null;
  createdAt: Date | null;
}

export async function getMachineWorkHistory(machineId: string): Promise<{ success: boolean; history?: MachineWorkHistoryEntry[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId) return { success: false, error: 'Unauthorized' };

    // Fetch all work logs for this machine in this store
    const logsSnap = await storeCol(user.storeId, 'machineWorkLogs').where('machineId', '==', machineId).orderBy('createdAt', 'desc').limit(25).get();

    if (logsSnap.empty) return { success: true, history: [] };

    // Gather ticket IDs to resolve ticket numbers
    const ticketIds: string[] = Array.from(new Set<string>(logsSnap.docs.map((d) => d.data().ticketId as string)));
    const ticketNumberMap: Record<string, string> = {};
    for (let i = 0; i < ticketIds.length; i += 30) {
      const chunk = ticketIds.slice(i, i + 30);
      await Promise.all(
        chunk.map(async (tid) => {
          const tdoc = await storeCol(user.storeId!, 'tickets').doc(tid).get();
          if (tdoc.exists) ticketNumberMap[tid] = tdoc.data()?.ticketNumber ?? tid;
        }),
      );
    }

    const history: MachineWorkHistoryEntry[] = logsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ticketId: d.ticketId,
        ticketNumber: ticketNumberMap[d.ticketId] ?? d.ticketId,
        machineId: d.machineId,
        machineType: d.machineType ?? '',
        machineSerialNumber: d.machineSerialNumber ?? '',
        arrivalTime: d.arrivalTime?.toDate() ?? null,
        departureTime: d.departureTime?.toDate() ?? null,
        hoursWorked: d.hoursWorked ?? null,
        workPerformed: d.workPerformed ?? '',
        outcome: d.outcome ?? '',
        repairs: d.repairs ?? '',
        partsUsed: d.partsUsed ?? [],
        maintenanceRecommendation: d.maintenanceRecommendation ? { date: d.maintenanceRecommendation.date?.toDate() ?? null, notes: d.maintenanceRecommendation.notes ?? '' } : null,
        createdAt: d.createdAt?.toDate() ?? null,
      };
    });

    return { success: true, history };
  } catch (error: any) {
    console.error('getMachineWorkHistory error:', error);
    return { success: false, error: error.message || 'Failed to load machine history' };
  }
}

// ── getTechnicianWeekSchedule ─────────────────────────────────────────────────
// Returns a technician's scheduled tickets for the next N days (default 7).
// Used in the create-ticket modal so call admins can check availability.

export interface TechScheduleEntry {
  id: string;
  ticketNumber: string;
  scheduledVisitDate: Date;
  customerName: string;
  machineTypes: string[];
  status: string;
}

export async function getTechnicianWeekSchedule(technicianId: string, daysAhead = 7): Promise<{ success: boolean; entries?: TechScheduleEntry[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(now.getDate() + daysAhead);
    end.setHours(23, 59, 59, 999);

    const nowTs = Timestamp.fromDate(now);
    const endTs = Timestamp.fromDate(end);

    // Query by assignedTo only (single-field index — always available).
    // Filtering by scheduledVisitDate range + orderBy on the same field would require a
    // composite index; instead we filter and sort in memory to avoid that dependency.
    const snap = await storeCol(user.storeId, 'tickets').where('assignedTo', '==', technicianId).get();

    const entries: TechScheduleEntry[] = snap.docs
      .filter((doc) => {
        const svd = doc.data().scheduledVisitDate;
        if (!svd) return false;
        const st = doc.data().status ?? '';
        if (['Closed', 'Signed Off', 'Signoff Required'].includes(st)) return false;
        return svd >= nowTs && svd <= endTs;
      })
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          ticketNumber: d.ticketNumber ?? '',
          scheduledVisitDate: d.scheduledVisitDate.toDate(),
          customerName: d.machines?.[0]?.customerName ?? 'Unknown',
          machineTypes: (d.machines ?? []).map((m: any) => m.machineType).filter(Boolean),
          status: d.status ?? '',
        };
      })
      .sort((a, b) => a.scheduledVisitDate.getTime() - b.scheduledVisitDate.getTime());

    return { success: true, entries };
  } catch (error: any) {
    console.error('getTechnicianWeekSchedule error:', error);
    return { success: false, error: error.message || 'Failed to load technician schedule' };
  }
}

// ── getTechAvailabilityForDate ────────────────────────────────────────────────
// Returns how many active tickets each technician has on a given date (YYYY-MM-DD).
// Used to auto-show availability badges next to each technician when a scheduled
// date is selected in the create-ticket modal.

export interface TechDayLoad {
  techId: string;
  scheduledCount: number;
}

export async function getTechAvailabilityForDate(dateStr: string): Promise<{ success: boolean; loads?: TechDayLoad[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

    // Single-field range query on scheduledVisitDate — no composite index needed.
    const snap = await storeCol(user.storeId, 'tickets').where('scheduledVisitDate', '>=', Timestamp.fromDate(startOfDay)).where('scheduledVisitDate', '<=', Timestamp.fromDate(endOfDay)).get();

    const countByTech = new Map<string, number>();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.assignedTo) continue;
      if (['Closed', 'Signed Off', 'Signoff Required'].includes(data.status ?? '')) continue;
      countByTech.set(data.assignedTo, (countByTech.get(data.assignedTo) ?? 0) + 1);
    }

    const loads: TechDayLoad[] = Array.from(countByTech.entries()).map(([techId, scheduledCount]) => ({ techId, scheduledCount }));
    return { success: true, loads };
  } catch (error: any) {
    console.error('getTechAvailabilityForDate error:', error);
    return { success: false, error: error.message || 'Failed to check availability' };
  }
}

// ── getMaintenanceRemindersForCustomer ────────────────────────────────────────
// Returns all pending maintenance reminders for a customer's machines.
// Used in the create-ticket modal so call admins can see which machines are due
// for service when selecting a customer, and pre-prioritize their ticket.

export interface CustomerMaintenanceReminder {
  machineId: string;
  machineType: string;
  machineSerialNumber: string;
  recommendedDate: Date;
  notes: string;
  sourceTicketId: string;
  sourceTicketNumber: string;
}

export async function getMaintenanceRemindersForCustomer(customerId: string): Promise<{ success: boolean; reminders?: CustomerMaintenanceReminder[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId) return { success: false, error: 'Unauthorized' };

    const snap = await storeCol(user.storeId, 'maintenanceReminders').where('customerId', '==', customerId).where('status', '==', 'pending').get();

    const reminders: CustomerMaintenanceReminder[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        machineId: d.machineId,
        machineType: d.machineType ?? '',
        machineSerialNumber: d.machineSerialNumber ?? '',
        recommendedDate: d.recommendedDate.toDate(),
        notes: d.notes ?? '',
        sourceTicketId: d.sourceTicketId ?? '',
        sourceTicketNumber: d.sourceTicketNumber ?? '',
      };
    });

    return { success: true, reminders };
  } catch (error: any) {
    console.error('getMaintenanceRemindersForCustomer error:', error);
    return { success: false, error: error.message || 'Failed to load maintenance reminders' };
  }
}

// ── getUpcomingMaintenanceReminders ─────────────────────────────────────────
// Returns all pending maintenance reminders from today onwards for the current
// user's store. Used by the schedule page to avoid a client-side Firestore
// query that requires a composite index and is subject to security-rule checks.
// Uses the Admin SDK so it bypasses both rules and index requirements.

export interface UpcomingMaintenanceReminder {
  id: string;
  ticketId: string;
  ticketNumber: string;
  machineId: string;
  machineType: string;
  machineSerialNumber: string;
  customerName: string;
  date: string; // ISO string — serializable across server/client boundary
  notes: string;
}

export async function getUpcomingMaintenanceReminders(): Promise<{ success: boolean; reminders: UpcomingMaintenanceReminder[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId) return { success: false, reminders: [], error: 'Unauthorized' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snap = await storeCol(user.storeId, 'maintenanceReminders')
      .where('status', '==', 'pending')
      .where('recommendedDate', '>=', Timestamp.fromDate(today))
      .orderBy('recommendedDate', 'asc')
      .get();

    const reminders: UpcomingMaintenanceReminder[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ticketId: d.sourceTicketId ?? '',
        ticketNumber: d.sourceTicketNumber ?? '',
        machineId: d.machineId ?? '',
        machineType: d.machineType ?? '',
        machineSerialNumber: d.machineSerialNumber ?? '',
        customerName: d.customerName ?? 'Unknown Customer',
        date: d.recommendedDate.toDate().toISOString(),
        notes: d.notes ?? '',
      };
    });

    return { success: true, reminders };
  } catch (error: any) {
    console.error('getUpcomingMaintenanceReminders error:', error);
    return { success: false, reminders: [], error: error.message || 'Failed to load maintenance reminders' };
  }
}

// ── markVisitMissed ───────────────────────────────────────────────────────────
// Records an explicit missed visit for a specific date on a ticket.
// Both technicians (for their own tickets) and admins can call this.
// The daily-service-report also auto-detects missed visits, but explicit marking
// provides a definitive record even before the report is generated.

export async function markVisitMissed(ticketId: string, dateStr: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['technician', 'store_admin', 'store_manager', 'call_admin', 'super_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const storeId = user.storeId;
    const ticketRef = storeCol(storeId, 'tickets').doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) return { success: false, error: 'Ticket not found' };

    // Technicians can only mark their own assigned tickets
    const ticketData = ticketSnap.data()!;
    if (user.role === 'technician' && ticketData.assignedTo !== user.uid) {
      return { success: false, error: 'This ticket is not assigned to you' };
    }

    const existingMissed: string[] = Array.isArray(ticketData.missedVisits) ? (ticketData.missedVisits as string[]) : [];
    if (existingMissed.includes(dateStr)) return { success: true }; // already marked

    const { FieldValue } = await import('firebase-admin/firestore');
    await ticketRef.update({
      missedVisits: FieldValue.arrayUnion(dateStr),
      updatedAt: Timestamp.now(),
    });

    await revalidateCache([`${CACHE_TAGS.TICKETS}-${storeId}`, CACHE_TAGS.TICKETS, CACHE_TAGS.REPORTS]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);

    return { success: true };
  } catch (error: any) {
    console.error('markVisitMissed error:', error);
    return { success: false, error: error.message || 'Failed to mark visit as missed' };
  }
}
