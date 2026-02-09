'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache';

export interface CallAdminStats {
  totalTickets: number;
  activeTickets: number;
  closedTickets: number;
  openTickets: number;
  assignedTickets: number;
  inProgressTickets: number;
  urgentPriority: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  avgTicketsPerMonth: number;
  lastTicketDate: string | null;
}

export interface CallAdminTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  contactPerson: string;
  assignedToName: string | null;
  createdAt: string;
  closedAt: string | null;
  status: string;
  priority: string;
  issueDescription: string;
  additionalNotes?: string;
  machines: Array<{
    machineId: string;
    type: string;
    serialNumber: string;
    priority: string;
  }>;
}

// Cached stats fetching function
const getCachedCallAdminStats = (callAdminId: string) =>
  unstable_cache(
    async () => {
      // Get user document with aggregated stats
      const userDoc = await adminDb.collection('users').doc(callAdminId).get();

      if (!userDoc.exists) {
        throw new Error('Call admin not found');
      }

      const userData = userDoc.data();
      const savedStats = userData?.stats || {};

      // Use aggregated stats if available, otherwise calculate
      if (savedStats.updatedAt) {
        // Calculate average tickets per month
        let avgTicketsPerMonth = 0;
        if (savedStats.totalTickets > 0 && savedStats.firstTicketDate && savedStats.lastTicketDate) {
          const firstTicketDate = savedStats.firstTicketDate.toDate?.() || new Date();
          const lastTicketDate = savedStats.lastTicketDate.toDate?.() || new Date();
          const monthsDiff = Math.max(1, (lastTicketDate.getTime() - firstTicketDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          avgTicketsPerMonth = savedStats.totalTickets / monthsDiff;
        }

        return {
          totalTickets: savedStats.totalTickets || 0,
          activeTickets: savedStats.activeTickets || 0,
          closedTickets: savedStats.closedTickets || 0,
          openTickets: savedStats.openTickets || 0,
          assignedTickets: savedStats.assignedTickets || 0,
          inProgressTickets: savedStats.assignedTickets || 0,
          urgentPriority: savedStats.urgentPriority || 0,
          highPriority: savedStats.highPriority || 0,
          mediumPriority: savedStats.mediumPriority || 0,
          lowPriority: savedStats.lowPriority || 0,
          avgTicketsPerMonth,
          lastTicketDate: savedStats.lastTicketDate?.toDate?.()?.toLocaleDateString() || null,
        };
      }

      // Fallback: Calculate stats if aggregates don't exist
      const ticketsSnapshot = await adminDb.collection('tickets').where('createdBy', '==', callAdminId).get();

      const tickets = ticketsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calculate statistics
      const totalTickets = tickets.length;
      const openTickets = tickets.filter((t) => t.status === 'Open').length;
      const assignedTickets = tickets.filter((t) => t.status === 'Assigned').length;
      const closedTickets = tickets.filter((t) => t.status === 'Closed').length;
      const activeTickets = openTickets + assignedTickets;

      // Priority breakdown
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

      // Calculate average tickets per month
      let avgTicketsPerMonth = 0;
      let lastTicketDate: string | null = null;

      if (tickets.length > 0) {
        const sortedTickets = tickets.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateA.getTime() - dateB.getTime();
        });

        const firstTicketDate = sortedTickets[0].createdAt?.toDate?.() || new Date();
        const lastTicketDateObj = sortedTickets[sortedTickets.length - 1].createdAt?.toDate?.() || new Date();

        lastTicketDate = lastTicketDateObj.toLocaleDateString();

        const monthsDiff = Math.max(1, (lastTicketDateObj.getTime() - firstTicketDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
        avgTicketsPerMonth = totalTickets / monthsDiff;
      }

      return {
        totalTickets,
        activeTickets,
        closedTickets,
        openTickets,
        assignedTickets,
        inProgressTickets: assignedTickets,
        urgentPriority,
        highPriority,
        mediumPriority,
        lowPriority,
        avgTicketsPerMonth,
        lastTicketDate,
      };
    },
    [`${CACHE_TAGS.CALL_ADMINS}-${callAdminId}-stats`],
    { tags: [`${CACHE_TAGS.CALL_ADMINS}-${callAdminId}-stats`], revalidate: 60 },
  );

export async function getCallAdminStats(callAdminId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    const stats = await getCachedCallAdminStats(callAdminId)();
    return { success: true, stats };
  } catch (error: any) {
    console.error('Error getting call admin stats:', error);
    return { success: false, error: error.message || 'Failed to get stats' };
  }
}

// Cached ticket fetching function
const getCachedCallAdminTickets = (callAdminId: string) =>
  unstable_cache(
    async () => {
      const ticketsSnapshot = await adminDb
        .collection('tickets')
        .where('createdBy', '==', callAdminId)
        .orderBy('createdAt', 'desc')
        .limit(100) // Limit to 100 most recent tickets
        .get();

      const tickets: CallAdminTicket[] = ticketsSnapshot.docs.map((doc) => {
        const data = doc.data();

        // Get the highest priority from all machines
        let highestPriority = 'Low';
        if (data.machines && Array.isArray(data.machines) && data.machines.length > 0) {
          const priorities = data.machines.map((m: any) => m.priority);
          if (priorities.includes('Urgent')) highestPriority = 'Urgent';
          else if (priorities.includes('High')) highestPriority = 'High';
          else if (priorities.includes('Medium')) highestPriority = 'Medium';
        }

        // Get customer name from first machine
        const customerName = data.machines?.[0]?.customerName || 'Unknown';

        return {
          id: doc.id,
          ticketNumber: data.ticketNumber,
          customerName,
          contactPerson: data.contactPerson,
          assignedToName: data.assignedToName || null,
          createdAt: data.createdAt?.toDate?.().toLocaleDateString() || 'N/A',
          closedAt: data.closedAt?.toDate?.().toLocaleDateString() || null,
          status: data.status,
          priority: highestPriority,
          issueDescription: data.issueDescription || '',
          additionalNotes: data.additionalNotes,
          machines: (data.machines || []).map((m: any) => ({
            machineId: m.machineId,
            type: m.machineType,
            serialNumber: m.serialNumber,
            priority: m.priority,
          })),
        };
      });

      return tickets;
    },
    [`call-admin-tickets-${callAdminId}`],
    {
      tags: [CACHE_TAGS.TICKETS, `${CACHE_TAGS.CALL_ADMINS}-${callAdminId}`],
      revalidate: 60, // Revalidate every 60 seconds
    },
  )();

export async function getCallAdminTickets(callAdminId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Unauthorized', tickets: [] };
    }

    const tickets = await getCachedCallAdminTickets(callAdminId);
    return { success: true, tickets };
  } catch (error: any) {
    console.error('Error getting call admin tickets:', error);
    return { success: false, error: error.message || 'Failed to get tickets', tickets: [] };
  }
}
