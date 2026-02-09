'use server';

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Update call admin statistics aggregates when a ticket is created
 */
export async function updateCallAdminAggregatesOnCreate(callAdminId: string, ticketData: any) {
  try {
    const userRef = adminDb.collection('users').doc(callAdminId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.warn(`User ${callAdminId} not found for aggregate update`);
      return;
    }

    const currentStats = userDoc.data()?.stats || {};

    // Count priorities in the new ticket
    let urgentCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    if (ticketData.machines && Array.isArray(ticketData.machines)) {
      ticketData.machines.forEach((machine: any) => {
        switch (machine.priority) {
          case 'Urgent':
            urgentCount++;
            break;
          case 'High':
            highCount++;
            break;
          case 'Medium':
            mediumCount++;
            break;
          case 'Low':
            lowCount++;
            break;
        }
      });
    }

    // Update aggregates
    const updates: any = {
      'stats.totalTickets': (currentStats.totalTickets || 0) + 1,
      'stats.openTickets': (currentStats.openTickets || 0) + 1,
      'stats.assignedTickets': currentStats.assignedTickets || 0,
      'stats.closedTickets': currentStats.closedTickets || 0,
      'stats.activeTickets': (currentStats.openTickets || 0) + (currentStats.assignedTickets || 0) + 1,
      'stats.urgentPriority': (currentStats.urgentPriority || 0) + urgentCount,
      'stats.highPriority': (currentStats.highPriority || 0) + highCount,
      'stats.mediumPriority': (currentStats.mediumPriority || 0) + mediumCount,
      'stats.lowPriority': (currentStats.lowPriority || 0) + lowCount,
      'stats.lastTicketDate': ticketData.createdAt || Timestamp.now(),
      'stats.updatedAt': Timestamp.now(),
    };

    // Set firstTicketDate if this is the first ticket or if this ticket is earlier
    if (!currentStats.firstTicketDate) {
      updates['stats.firstTicketDate'] = ticketData.createdAt || Timestamp.now();
    }

    await userRef.update(updates);
  } catch (error) {
    console.error('Error updating call admin aggregates on create:', error);
  }
}

/**
 * Update call admin statistics aggregates when a ticket status changes
 */
export async function updateCallAdminAggregatesOnStatusChange(callAdminId: string, oldStatus: string, newStatus: string) {
  try {
    const userRef = adminDb.collection('users').doc(callAdminId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return;

    const currentStats = userDoc.data()?.stats || {};
    const updates: any = {
      'stats.updatedAt': Timestamp.now(),
    };

    // Decrement old status
    if (oldStatus === 'Open') {
      updates['stats.openTickets'] = Math.max(0, (currentStats.openTickets || 0) - 1);
    } else if (oldStatus === 'Assigned') {
      updates['stats.assignedTickets'] = Math.max(0, (currentStats.assignedTickets || 0) - 1);
    } else if (oldStatus === 'Closed') {
      updates['stats.closedTickets'] = Math.max(0, (currentStats.closedTickets || 0) - 1);
    }

    // Increment new status
    if (newStatus === 'Open') {
      updates['stats.openTickets'] = (currentStats.openTickets || 0) + 1;
    } else if (newStatus === 'Assigned') {
      updates['stats.assignedTickets'] = (currentStats.assignedTickets || 0) + 1;
    } else if (newStatus === 'Closed') {
      updates['stats.closedTickets'] = (currentStats.closedTickets || 0) + 1;
    }

    // Update active tickets count
    const newOpen = updates['stats.openTickets'] ?? currentStats.openTickets ?? 0;
    const newAssigned = updates['stats.assignedTickets'] ?? currentStats.assignedTickets ?? 0;
    updates['stats.activeTickets'] = newOpen + newAssigned;

    await userRef.update(updates);
  } catch (error) {
    console.error('Error updating call admin aggregates on status change:', error);
  }
}

/**
 * Recalculate all aggregates for a call admin (use when data is inconsistent)
 */
export async function recalculateCallAdminAggregates(callAdminId: string) {
  try {
    const ticketsSnapshot = await adminDb.collection('tickets').where('createdBy', '==', callAdminId).get();

    const tickets = ticketsSnapshot.docs.map((doc) => doc.data());

    // Calculate stats
    const totalTickets = tickets.length;
    const openTickets = tickets.filter((t) => t.status === 'Open').length;
    const assignedTickets = tickets.filter((t) => t.status === 'Assigned').length;
    const closedTickets = tickets.filter((t) => t.status === 'Closed').length;
    const activeTickets = openTickets + assignedTickets;

    let urgentPriority = 0;
    let highPriority = 0;
    let mediumPriority = 0;
    let lowPriority = 0;

    tickets.forEach((ticket) => {
      if (ticket.machines && Array.isArray(ticket.machines)) {
        ticket.machines.forEach((machine: any) => {
          switch (machine.priority) {
            case 'Urgent':
              urgentPriority++;
              break;
            case 'High':
              highPriority++;
              break;
            case 'Medium':
              mediumPriority++;
              break;
            case 'Low':
              lowPriority++;
              break;
          }
        });
      }
    });

    // Get last ticket date
    let lastTicketDate = null;
    if (tickets.length > 0) {
      const sortedTickets = tickets.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      lastTicketDate = sortedTickets[0].createdAt || Timestamp.now();
    }

    // Update user document with aggregates
    await adminDb
      .collection('users')
      .doc(callAdminId)
      .update({
        stats: {
          totalTickets,
          openTickets,
          assignedTickets,
          closedTickets,
          activeTickets,
          urgentPriority,
          highPriority,
          mediumPriority,
          lowPriority,
          lastTicketDate,
          updatedAt: Timestamp.now(),
        },
      });

    return { success: true };
  } catch (error: any) {
    console.error('Error recalculating call admin aggregates:', error);
    return { success: false, error: error.message };
  }
}
