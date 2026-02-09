'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createTicketSchema, updateTicketSchema, technicianUpdateSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';
import { updateCallAdminAggregatesOnCreate, updateCallAdminAggregatesOnStatusChange } from './aggregates';

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

// Cached function to get customers for tickets
const getCachedCustomersForTickets = unstable_cache(
  async () => {
    try {
      const snapshot = await adminDb.collection('customers').get();
      const customers = snapshot.docs
        .filter((doc) => !doc.data().isDisabled) // Filter out disabled customers
        .map((doc) => ({
          id: doc.id,
          companyName: doc.data().companyName,
          contactPerson: doc.data().contactPerson,
        }));

      console.log(`[Cache] Fetched ${customers.length} customers for tickets from Firestore`);
      return customers;
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      return [];
    }
  },
  [CACHE_TAGS.CUSTOMERS],
  { tags: [CACHE_TAGS.CUSTOMERS], revalidate: false },
);

// Cached function to get technicians for assignment
const getCachedTechniciansForAssignment = unstable_cache(
  async () => {
    try {
      const snapshot = await adminDb.collection('users').where('role', '==', 'technician').get();
      const technicians = snapshot.docs
        .filter((doc) => !doc.data().disabled) // Filter out disabled technicians
        .map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        }));

      console.log(`[Cache] Fetched ${technicians.length} active technicians from Firestore`);
      return technicians;
    } catch (error: any) {
      console.error('Error fetching technicians:', error);
      return [];
    }
  },
  [CACHE_TAGS.TECHNICIANS],
  { tags: [CACHE_TAGS.TECHNICIANS], revalidate: false },
);

export async function getCustomersForTickets(): Promise<CustomerForTicket[]> {
  return getCachedCustomersForTickets();
}

export async function getMachinesForCustomer(customerId: string): Promise<MachineForTicket[]> {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) {
      return [];
    }

    const snapshot = await adminDb.collection('machines').where('customerId', '==', customerId).get();
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
  return getCachedTechniciansForAssignment();
}

export async function createTicket(data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate data against new schema
    const validated = createTicketSchema.parse(data);

    // Validate machines array
    if (!validated.machines || validated.machines.length === 0) {
      return { success: false, error: 'At least one machine is required' };
    }

    // Generate ticket number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const startOfDay = new Date(year, now.getMonth(), now.getDate());
    const endOfDay = new Date(year, now.getMonth(), now.getDate() + 1);

    const todayTickets = await adminDb.collection('tickets').where('createdAt', '>=', Timestamp.fromDate(startOfDay)).where('createdAt', '<', Timestamp.fromDate(endOfDay)).get();

    const count = String(todayTickets.size + 1).padStart(3, '0');
    const ticketNumber = `TKT-${year}${month}${day}-${count}`;

    // Get assigned user name if technician is assigned
    let assignedToName = null;
    if (validated.assignedTo) {
      const assignedUserDoc = await adminDb.collection('users').doc(validated.assignedTo).get();
      assignedToName = assignedUserDoc.exists ? assignedUserDoc.data()?.name : null;
    }

    // Create ticket with multi-machine support
    const ticketData = {
      ticketNumber,
      machines: validated.machines, // Array of machines being serviced
      issueDescription: validated.issueDescription,
      contactPerson: validated.contactPerson,
      assignedTo: validated.assignedTo || null,
      assignedToName: assignedToName,
      status: validated.assignedTo ? 'Assigned' : 'Open', // Open if no technician, Assigned if technician is set
      scheduledVisitDate: validated.scheduledVisitDate ? Timestamp.fromDate(validated.scheduledVisitDate) : null,
      additionalNotes: validated.additionalNotes || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: user.uid,
    };

    const docRef = await adminDb.collection('tickets').add(ticketData);

    // Update call admin aggregates if creator is a call admin
    const creatorDoc = await adminDb.collection('users').doc(user.uid).get();
    if (creatorDoc.exists && creatorDoc.data()?.role === 'call_admin') {
      await updateCallAdminAggregatesOnCreate(user.uid, ticketData);
    }

    // Invalidate cache for tickets and technicians
    await revalidateCache([CACHE_TAGS.TICKETS]);
    await revalidateCache([CACHE_TAGS.TECHNICIANS]);
    await revalidateCache([CACHE_TAGS.REPORTS]);
    await revalidateCache([`${CACHE_TAGS.CALL_ADMINS}-${user.uid}`]);
    revalidatePath('/tickets');
    revalidatePath('/dashboard');
    revalidatePath('/(protected)/(admin)/tickets');
    revalidatePath('/(protected)/(admin)/call-admin');

    return { success: true, ticketId: docRef.id, ticketNumber };
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    return { success: false, error: error.message || 'Failed to create ticket' };
  }
}

export async function updateTicket(ticketId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get current ticket to check for status changes
    const ticketDoc = await adminDb.collection('tickets').doc(ticketId).get();
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

    // Handle scheduledVisitDate conversion
    if (validated.scheduledVisitDate !== undefined) {
      if (validated.scheduledVisitDate === null) {
        // Explicitly clear the field
        updateData.scheduledVisitDate = null;
      } else if (validated.scheduledVisitDate instanceof Date) {
        updateData.scheduledVisitDate = Timestamp.fromDate(validated.scheduledVisitDate);
      }
    }

    // If assigning, update assignedToName
    if (validated.assignedTo) {
      const assignedUserDoc = await adminDb.collection('users').doc(validated.assignedTo).get();
      if (assignedUserDoc.exists) {
        updateData.assignedToName = assignedUserDoc.data()?.name;
      }
      if (!validated.status) {
        updateData.status = 'Assigned';
      }
    }

    // If status changed and ticket was created by call admin, update aggregates
    const newStatus = updateData.status || oldStatus;
    if (oldStatus && newStatus !== oldStatus && currentTicketData?.createdBy) {
      const creatorDoc = await adminDb.collection('users').doc(currentTicketData.createdBy).get();
      if (creatorDoc.exists && creatorDoc.data()?.role === 'call_admin') {
        await updateCallAdminAggregatesOnStatusChange(currentTicketData.createdBy, oldStatus, newStatus);
      }
    }

    await adminDb.collection('tickets').doc(ticketId).update(updateData);

    // Invalidate cache for tickets and technicians
    await revalidateCache([CACHE_TAGS.TICKETS]);
    await revalidateCache([CACHE_TAGS.TECHNICIANS]);
    await revalidateCache([CACHE_TAGS.REPORTS]);
    if (currentTicketData?.createdBy) {
      await revalidateCache([`${CACHE_TAGS.CALL_ADMINS}-${currentTicketData.createdBy}`]);
    }
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');
    revalidatePath('/(protected)/(admin)/tickets');
    revalidatePath('/(protected)/(admin)/call-admin');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    return { success: false, error: error.message || 'Failed to update ticket' };
  }
}

export async function addWorkLogEntry(ticketId: string, machineId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'technician') {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify ticket is assigned to this technician
    const ticketDoc = await adminDb.collection('tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { success: false, error: 'Ticket not found' };
    }

    const ticketData = ticketDoc.data();
    if (ticketData?.assignedTo !== user.uid) {
      return { success: false, error: 'This ticket is not assigned to you' };
    }

    const validated = technicianUpdateSchema.parse(data);

    // Find the machine details from the ticket
    const ticketMachine = ticketData?.machines?.find((m: any) => m.machineId === machineId);
    if (!ticketMachine) {
      return { success: false, error: 'Machine not found in ticket' };
    }

    // Find or create the work log entry for this machine
    const workLogsQuery = await adminDb.collection('machineWorkLogs').where('ticketId', '==', ticketId).where('machineId', '==', machineId).get();

    const updateData: any = {
      ...validated,
      recordedBy: user.uid,
      updatedAt: Timestamp.now(),
    };

    // Convert dates to timestamps
    if (validated.arrivalTime) {
      updateData.arrivalTime = Timestamp.fromDate(validated.arrivalTime);
    }
    if (validated.departureTime) {
      updateData.departureTime = Timestamp.fromDate(validated.departureTime);
    }
    if (validated.maintenanceRecommendation?.date) {
      updateData.maintenanceRecommendation = {
        ...validated.maintenanceRecommendation,
        date: Timestamp.fromDate(validated.maintenanceRecommendation.date),
      };
    }

    if (workLogsQuery.empty) {
      // Create new work log if it doesn't exist
      await adminDb.collection('machineWorkLogs').add({
        ticketId,
        machineId,
        machineType: ticketMachine.machineType,
        machineSerialNumber: ticketMachine.serialNumber,
        ...updateData,
        createdAt: Timestamp.now(),
      });
    } else {
      // Update existing work log
      const workLogDoc = workLogsQuery.docs[0];
      await workLogDoc.ref.update(updateData);
    }

    // Invalidate work logs cache
    await revalidateCache([CACHE_TAGS.WORK_LOGS]);
    await revalidateCache([CACHE_TAGS.REPORTS]);
    await revalidateCache([`${CACHE_TAGS.WORK_LOGS}-${ticketId}`]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');
    revalidatePath('/(protected)/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('Error adding work log entry:', error);
    return { success: false, error: error.message || 'Failed to add work log entry' };
  }
}

// Bulk work log entry for multiple machines with shared visit data
export async function addBulkWorkLogEntries(ticketId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'technician') {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify ticket is assigned to this technician
    const ticketDoc = await adminDb.collection('tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { success: false, error: 'Ticket not found' };
    }

    const ticketData = ticketDoc.data();
    if (ticketData?.assignedTo !== user.uid) {
      return { success: false, error: 'This ticket is not assigned to you' };
    }

    const { bulkWorkLogSchema } = await import('@/lib/schemas');
    const validated = bulkWorkLogSchema.parse(data);

    // Visit-level timestamps (shared across all machines)
    const arrivalTimestamp = Timestamp.fromDate(validated.arrivalTime);
    const departureTimestamp = validated.departureTime ? Timestamp.fromDate(validated.departureTime) : undefined;

    // Process each machine's work log
    const batch = adminDb.batch();
    let processedCount = 0;

    for (const machineLog of validated.machineWorkLogs) {
      // Find the machine details from the ticket
      const ticketMachine = ticketData?.machines?.find((m: any) => m.machineId === machineLog.machineId);
      if (!ticketMachine) {
        continue; // Skip if machine not found
      }

      // Check if work log already exists
      const workLogsQuery = await adminDb.collection('machineWorkLogs').where('ticketId', '==', ticketId).where('machineId', '==', machineLog.machineId).get();

      const workLogData: any = {
        // Visit-level data (same for all machines)
        arrivalTime: arrivalTimestamp,
        departureTime: departureTimestamp,
        hoursWorked: validated.hoursWorked,

        // Machine-specific data
        workPerformed: machineLog.workPerformed,
        outcome: machineLog.outcome,
        repairs: machineLog.repairs,
        partsUsed: machineLog.partsUsed || [],

        // Metadata
        recordedBy: user.uid,
        updatedAt: Timestamp.now(),
      };

      // Handle maintenance recommendation
      if (machineLog.maintenanceRecommendation?.date && machineLog.maintenanceRecommendation?.notes) {
        workLogData.maintenanceRecommendation = {
          date: Timestamp.fromDate(machineLog.maintenanceRecommendation.date),
          notes: machineLog.maintenanceRecommendation.notes,
        };
      }

      if (workLogsQuery.empty) {
        // Create new work log
        const newDocRef = adminDb.collection('machineWorkLogs').doc();
        batch.set(newDocRef, {
          ticketId,
          machineId: machineLog.machineId,
          machineType: ticketMachine.machineType,
          machineSerialNumber: ticketMachine.serialNumber,
          ...workLogData,
          createdAt: Timestamp.now(),
        });
      } else {
        // Update existing work log
        const workLogDoc = workLogsQuery.docs[0];
        batch.update(workLogDoc.ref, workLogData);
      }

      processedCount++;
    }

    // Commit all changes in a single batch
    await batch.commit();

    // Invalidate caches
    await revalidateCache([CACHE_TAGS.WORK_LOGS]);
    await revalidateCache([CACHE_TAGS.REPORTS]);
    await revalidateCache([`${CACHE_TAGS.WORK_LOGS}-${ticketId}`]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');
    revalidatePath('/(protected)/tickets');

    return { success: true, count: processedCount };
  } catch (error: any) {
    console.error('Error adding bulk work log entries:', error);
    return { success: false, error: error.message || 'Failed to add work log entries' };
  }
}

export async function closeTicket(ticketId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'technician') {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify ticket is assigned to this technician
    const ticketDoc = await adminDb.collection('tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return { success: false, error: 'Ticket not found' };
    }

    const ticketData = ticketDoc.data();
    if (ticketData?.assignedTo !== user.uid) {
      return { success: false, error: 'This ticket is not assigned to you' };
    }

    // Check that all machines have work logs with work performed
    const workLogs = await adminDb.collection('machineWorkLogs').where('ticketId', '==', ticketId).get();

    // Get all machine IDs from the ticket
    const ticketMachineIds = (ticketData?.machines || []).map((m: any) => m.machineId);

    // Create a map of machine IDs to work logs
    const workLogsByMachine = new Map();
    workLogs.docs.forEach((doc) => {
      workLogsByMachine.set(doc.data().machineId, doc.data());
    });

    // Verify each machine has a work log with required fields
    for (const machineId of ticketMachineIds) {
      const logData = workLogsByMachine.get(machineId);
      if (!logData || !logData.workPerformed || !logData.outcome) {
        return { success: false, error: 'All machines must have work details logged before closing' };
      }
    }

    // Close the ticket
    await adminDb.collection('tickets').doc(ticketId).update({
      status: 'Closed',
      closedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Invalidate caches
    await revalidateCache([CACHE_TAGS.TICKETS]);
    await revalidateCache([CACHE_TAGS.WORK_LOGS]);
    await revalidateCache([CACHE_TAGS.REPORTS]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');
    revalidatePath('/(protected)/tickets');
    revalidatePath('/(protected)/(admin)/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('Error closing ticket:', error);
    return { success: false, error: error.message || 'Failed to close ticket' };
  }
}

export async function technicianUpdateTicket(ticketId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'technician') {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify ticket is assigned to this technician
    const ticketDoc = await adminDb.collection('tickets').doc(ticketId).get();
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

    // Convert dates to timestamps
    if (validated.arrivalTime) {
      updateData.arrivalTime = Timestamp.fromDate(validated.arrivalTime);
    }
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

    await adminDb.collection('tickets').doc(ticketId).update(updateData);

    // Invalidate cache for tickets
    await revalidateCache([CACHE_TAGS.TICKETS]);
    await revalidateCache([CACHE_TAGS.REPORTS]);
    revalidatePath('/tickets');
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/dashboard');
    revalidatePath('/(protected)/tickets');
    revalidatePath('/(protected)/(admin)/tickets');
    revalidatePath('/(protected)/(admin)/call-admin');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    return { success: false, error: error.message || 'Failed to update ticket' };
  }
}

export async function getWorkLogsForTicket(ticketId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const workLogsSnapshot = await adminDb.collection('machineWorkLogs').where('ticketId', '==', ticketId).get();

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
