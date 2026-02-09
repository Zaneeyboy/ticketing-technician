'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache';

export interface TechnicianMetrics {
  uid: string;
  name: string;
  totalAssigned: number;
  totalClosed: number;
  openCount: number;
  avgResolutionHours: number;
  lastTicketDate?: Date;
}

export interface TicketMetrics {
  totalTickets: number;
  openTickets: number;
  assignedTickets: number;
  closedTickets: number;
  avgResolutionHours: number;
  avgResponseTimeHours: number;
  priorityBreakdown: {
    Urgent: number;
    High: number;
    Medium: number;
    Low: number;
  };
  agingTickets: Array<{ ticketNumber: string; daysOpen: number; priority: string }>;
}

export interface CustomerMetrics {
  customerId: string;
  companyName: string;
  totalTickets: number;
  totalMachines: number;
  avgResolutionHours: number;
  repeatIssueCount: number;
  lastServiceDate?: Date;
}

export interface EquipmentMetrics {
  machineId: string;
  type: string;
  serialNumber: string;
  customerName: string;
  totalIncidents: number;
  lastServiceDate?: Date;
  partsUsedCount: number;
  partsUsed: Array<{ partName: string; quantity: number }>;
}

export interface RevenueMetrics {
  technicianId: string;
  technicianName: string;
  totalTickets: number;
  estimatedRevenue: number;
  internalCost: number;
  estimatedProfit: number;
  profitMargin: number;
}

export interface ServiceQualityMetrics {
  totalTickets: number;
  closedTickets: number;
  firstTimeFixRate: number;
  repeatTicketRate: number;
  avgResolutionHours: number;
  topIssueTypes: Array<{ issue: string; count: number }>;
  machinesWithRepeatIssues: Array<{ serialNumber: string; issue: string; count: number }>;
}

export async function getTechnicianMetrics(): Promise<TechnicianMetrics[]> {
  const cachedFn = unstable_cache(
    async () => {
      const user = await getCurrentUser();
      if (!user || !['admin', 'management'].includes(user.role)) {
        return [];
      }

      const technicians = await adminDb.collection('users').where('role', '==', 'technician').get();
      const tickets = await adminDb.collection('tickets').get();

      const metricsMap = new Map<string, TechnicianMetrics>();

      technicians.docs.forEach((doc) => {
        metricsMap.set(doc.id, {
          uid: doc.id,
          name: doc.data().name,
          totalAssigned: 0,
          totalClosed: 0,
          openCount: 0,
          avgResolutionHours: 0,
        });
      });

      const resolutionTimes = new Map<string, { totalHours: number; count: number }>();

      tickets.docs.forEach((doc) => {
        const ticket = doc.data();
        if (!ticket.assignedTo) return;

        const tech = metricsMap.get(ticket.assignedTo);
        if (!tech) return;

        tech.totalAssigned++;

        if (ticket.status === 'Closed') {
          tech.totalClosed++;
          if (ticket.closedAt && ticket.createdAt) {
            const createdTime = new Date(ticket.createdAt.toString()).getTime();
            const closedTime = new Date(ticket.closedAt.toString()).getTime();
            const hours = (closedTime - createdTime) / (1000 * 60 * 60);

            if (!resolutionTimes.has(ticket.assignedTo)) {
              resolutionTimes.set(ticket.assignedTo, { totalHours: 0, count: 0 });
            }
            const bucket = resolutionTimes.get(ticket.assignedTo);
            if (bucket) {
              bucket.totalHours += hours;
              bucket.count++;
            }
          }
        } else {
          tech.openCount++;
        }

        if (ticket.createdAt) {
          const ticketDate = new Date(ticket.createdAt.toString());
          if (!tech.lastTicketDate || ticketDate > tech.lastTicketDate) {
            tech.lastTicketDate = ticketDate;
          }
        }
      });

      metricsMap.forEach((tech) => {
        const bucket = resolutionTimes.get(tech.uid);
        if (bucket && bucket.count > 0) {
          tech.avgResolutionHours = Math.round((bucket.totalHours / bucket.count) * 10) / 10;
        }
      });

      return Array.from(metricsMap.values()).sort((a, b) => b.totalClosed - a.totalClosed);
    },
    ['technician-metrics'],
    {
      tags: [CACHE_TAGS.REPORTS, CACHE_TAGS.TICKETS, CACHE_TAGS.TECHNICIANS],
      revalidate: false,
    },
  );

  return cachedFn();
}

export async function getTicketMetrics(): Promise<TicketMetrics> {
  const cachedFn = unstable_cache(
    async () => {
      const user = await getCurrentUser();
      console.log('[getTicketMetrics] User:', user ? { email: user.email, role: user.role } : 'NULL');

      if (!user || !['admin', 'management'].includes(user.role)) {
        console.log('[getTicketMetrics] Access denied - user role:', user?.role);
        return {
          totalTickets: 0,
          openTickets: 0,
          assignedTickets: 0,
          closedTickets: 0,
          avgResolutionHours: 0,
          avgResponseTimeHours: 0,
          priorityBreakdown: { Urgent: 0, High: 0, Medium: 0, Low: 0 },
          agingTickets: [],
        };
      }

      const tickets = await adminDb.collection('tickets').get();
      console.log('[getTicketMetrics] Fetched tickets:', tickets.size, 'docs');

      let metrics: TicketMetrics = {
        totalTickets: tickets.size,
        openTickets: 0,
        assignedTickets: 0,
        closedTickets: 0,
        avgResolutionHours: 0,
        avgResponseTimeHours: 0,
        priorityBreakdown: { Urgent: 0, High: 0, Medium: 0, Low: 0 },
        agingTickets: [],
      };

      let totalResolutionHours = 0;
      let closedCount = 0;
      let totalResponseTime = 0;
      let assignedCount = 0;

      const now = new Date();
      const agingList: typeof metrics.agingTickets = [];

      tickets.docs.forEach((doc) => {
        const ticket = doc.data();

        if (ticket.status === 'Open') metrics.openTickets++;
        else if (ticket.status === 'Assigned') metrics.assignedTickets++;
        else if (ticket.status === 'Closed') metrics.closedTickets++;

        // Count priorities
        if (ticket.machines && ticket.machines.length > 0) {
          const priority = ticket.machines[0].priority;
          if (priority in metrics.priorityBreakdown) {
            metrics.priorityBreakdown[priority as keyof typeof metrics.priorityBreakdown]++;
          }
        }

        // Calculate resolution time for closed tickets
        if (ticket.status === 'Closed' && ticket.closedAt && ticket.createdAt) {
          const createdTime = new Date(ticket.createdAt.toString()).getTime();
          const closedTime = new Date(ticket.closedAt.toString()).getTime();
          const hours = (closedTime - createdTime) / (1000 * 60 * 60);
          totalResolutionHours += hours;
          closedCount++;
        }

        // Calculate response time (assigned to open)
        if ((ticket.status === 'Assigned' || ticket.status === 'Closed') && ticket.createdAt && ticket.assignedTo) {
          const createdTime = new Date(ticket.createdAt.toString()).getTime();
          const assignedTime = new Date(ticket.updatedAt?.toString() || ticket.createdAt.toString()).getTime();
          const hours = Math.abs(assignedTime - createdTime) / (1000 * 60 * 60);
          totalResponseTime += hours;
          assignedCount++;
        }

        // Track aging tickets
        if (ticket.status !== 'Closed' && ticket.createdAt) {
          const createdTime = new Date(ticket.createdAt.toString());
          const daysOpen = Math.floor((now.getTime() - createdTime.getTime()) / (1000 * 60 * 60 * 24));
          if (daysOpen > 3) {
            agingList.push({
              ticketNumber: ticket.ticketNumber,
              daysOpen,
              priority: ticket.machines?.[0]?.priority || 'Unknown',
            });
          }
        }
      });

      metrics.avgResolutionHours = closedCount > 0 ? Math.round((totalResolutionHours / closedCount) * 10) / 10 : 0;
      metrics.avgResponseTimeHours = assignedCount > 0 ? Math.round((totalResponseTime / assignedCount) * 10) / 10 : 0;
      metrics.agingTickets = agingList.sort((a, b) => b.daysOpen - a.daysOpen).slice(0, 10);

      return metrics;
    },
    ['ticket-metrics'],
    {
      tags: [CACHE_TAGS.REPORTS, CACHE_TAGS.TICKETS],
      revalidate: false,
    },
  );

  return cachedFn();
}

export async function getCustomerMetrics(): Promise<CustomerMetrics[]> {
  const cachedFn = unstable_cache(
    async () => {
      const user = await getCurrentUser();
      if (!user || !['admin', 'management'].includes(user.role)) {
        return [];
      }

      // Fetch all customers and filter in-memory to avoid Firestore != query issues
      const allCustomers = await adminDb.collection('customers').get();
      const customers = allCustomers.docs.filter((doc) => doc.data().isDisabled !== true);

      const tickets = await adminDb.collection('tickets').get();
      const machines = await adminDb.collection('machines').get();

      const metricsMap = new Map<string, CustomerMetrics>();

      customers.forEach((doc) => {
        metricsMap.set(doc.id, {
          customerId: doc.id,
          companyName: doc.data().companyName,
          totalTickets: 0,
          totalMachines: 0,
          avgResolutionHours: 0,
          repeatIssueCount: 0,
        });
      });

      // Count machines per customer
      machines.docs.forEach((doc) => {
        const customerId = doc.data().customerId;
        const metric = metricsMap.get(customerId);
        if (metric) metric.totalMachines++;
      });

      // Process tickets
      const resolutionTimes = new Map<string, { totalHours: number; count: number }>();
      const issueMap = new Map<string, Set<string>>();

      tickets.docs.forEach((doc) => {
        const ticket = doc.data();
        const customerId = ticket.machines?.[0]?.customerId;
        if (!customerId) return;

        const metric = metricsMap.get(customerId);
        if (!metric) return;

        metric.totalTickets++;

        // Track resolution time
        if (ticket.status === 'Closed' && ticket.closedAt && ticket.createdAt) {
          const createdTime = new Date(ticket.createdAt.toString()).getTime();
          const closedTime = new Date(ticket.closedAt.toString()).getTime();
          const hours = (closedTime - createdTime) / (1000 * 60 * 60);

          if (!resolutionTimes.has(customerId)) {
            resolutionTimes.set(customerId, { totalHours: 0, count: 0 });
          }
          const bucket = resolutionTimes.get(customerId);
          if (bucket) {
            bucket.totalHours += hours;
            bucket.count++;
          }
        }

        // Track issue types
        const issueKey = `${customerId}-${ticket.issueDescription?.substring(0, 50)}`;
        if (!issueMap.has(issueKey)) {
          issueMap.set(issueKey, new Set());
        }
        issueMap.get(issueKey)?.add(ticket.id);

        if (ticket.createdAt) {
          const ticketDate = new Date(ticket.createdAt.toString());
          if (!metric.lastServiceDate || ticketDate > metric.lastServiceDate) {
            metric.lastServiceDate = ticketDate;
          }
        }
      });

      metricsMap.forEach((metric) => {
        const bucket = resolutionTimes.get(metric.customerId);
        if (bucket && bucket.count > 0) {
          metric.avgResolutionHours = Math.round((bucket.totalHours / bucket.count) * 10) / 10;
        }

        // Count repeat issues
        let repeatCount = 0;
        issueMap.forEach((ticketSet, key) => {
          if (key.startsWith(metric.customerId) && ticketSet.size > 1) {
            repeatCount += ticketSet.size - 1;
          }
        });
        metric.repeatIssueCount = repeatCount;
      });

      return Array.from(metricsMap.values()).sort((a, b) => b.totalTickets - a.totalTickets);
    },
    ['customer-metrics'],
    {
      tags: [CACHE_TAGS.REPORTS, CACHE_TAGS.CUSTOMERS, CACHE_TAGS.TICKETS, CACHE_TAGS.MACHINES],
      revalidate: false,
    },
  );

  return cachedFn();
}

export async function getEquipmentMetrics(): Promise<EquipmentMetrics[]> {
  const cachedFn = unstable_cache(
    async () => {
      const user = await getCurrentUser();
      if (!user || !['admin', 'management'].includes(user.role)) {
        return [];
      }

      const machines = await adminDb.collection('machines').get();
      const tickets = await adminDb.collection('tickets').get();
      const workLogs = await adminDb.collection('machineWorkLogs').get();
      const customers = await adminDb.collection('customers').get();

      const customerMap = new Map(customers.docs.map((doc) => [doc.id, doc.data().companyName]));
      const metricsMap = new Map<string, EquipmentMetrics>();

      machines.docs.forEach((doc) => {
        const data = doc.data();
        const customerName = (customerMap.get(data.customerId) as string) ?? 'Unknown';
        metricsMap.set(doc.id, {
          machineId: doc.id,
          type: data.type,
          serialNumber: data.serialNumber,
          customerName: customerName,
          totalIncidents: 0,
          partsUsedCount: 0,
          partsUsed: [],
        });
      });

      // Count incidents per machine
      tickets.docs.forEach((doc) => {
        const machines = doc.data().machines || [];
        machines.forEach((machine: any) => {
          const metric = metricsMap.get(machine.machineId);
          if (metric) {
            metric.totalIncidents++;
            if (doc.data().createdAt) {
              const ticketDate = new Date(doc.data().createdAt.toString());
              if (!metric.lastServiceDate || ticketDate > metric.lastServiceDate) {
                metric.lastServiceDate = ticketDate;
              }
            }
          }
        });
      });

      // Track parts usage
      const partsMap = new Map<string, Map<string, number>>();

      workLogs.docs.forEach((doc) => {
        const log = doc.data();
        const machineId = log.machineId;

        if (!partsMap.has(machineId)) {
          partsMap.set(machineId, new Map());
        }

        if (log.partsUsed && Array.isArray(log.partsUsed)) {
          log.partsUsed.forEach((part: any) => {
            const partMap = partsMap.get(machineId);
            if (partMap) {
              partMap.set(part.partName, (partMap.get(part.partName) || 0) + (part.quantity || 1));
            }
          });
        }
      });

      // Update metrics with parts data
      metricsMap.forEach((metric) => {
        const parts = partsMap.get(metric.machineId);
        if (parts) {
          metric.partsUsedCount = parts.size;
          metric.partsUsed = Array.from(parts.entries())
            .map(([name, qty]) => ({ partName: name, quantity: qty }))
            .sort((a, b) => b.quantity - a.quantity);
        }
      });

      return Array.from(metricsMap.values())
        .filter((m) => m.totalIncidents > 0)
        .sort((a, b) => b.totalIncidents - a.totalIncidents);
    },
    ['equipment-metrics'],
    {
      tags: [CACHE_TAGS.REPORTS, CACHE_TAGS.MACHINES, CACHE_TAGS.TICKETS, CACHE_TAGS.WORK_LOGS],
      revalidate: false,
    },
  );

  return cachedFn();
}

export async function getRevenueMetrics(): Promise<RevenueMetrics[]> {
  const cachedFn = unstable_cache(
    async () => {
      const user = await getCurrentUser();
      if (!user || !['admin', 'management'].includes(user.role)) {
        return [];
      }

      const technicians = await adminDb.collection('users').where('role', '==', 'technician').get();
      const workLogs = await adminDb.collection('machineWorkLogs').get();

      const metricsMap = new Map<string, RevenueMetrics>();

      technicians.docs.forEach((doc) => {
        const techData = doc.data();
        metricsMap.set(doc.id, {
          technicianId: doc.id,
          technicianName: techData.name,
          totalTickets: 0,
          estimatedRevenue: 0,
          internalCost: 0,
          estimatedProfit: 0,
          profitMargin: 0,
        });
      });

      const processedTickets = new Set<string>();

      workLogs.docs.forEach((doc) => {
        const workLog = doc.data();
        if (!workLog.recordedBy || !workLog.hoursWorked) return;

        const metric = metricsMap.get(workLog.recordedBy);
        if (!metric) return;

        const techData = technicians.docs.find((d) => d.id === workLog.recordedBy)?.data();
        if (!techData) return;

        // Count unique tickets
        if (workLog.ticketId && !processedTickets.has(workLog.ticketId)) {
          metric.totalTickets++;
          processedTickets.add(workLog.ticketId);
        }

        const chargeoutRate = techData.chargeoutRate || 120;
        const payRate = techData.internalPayRate || 35;

        const revenue = workLog.hoursWorked * chargeoutRate;
        const cost = workLog.hoursWorked * payRate;

        metric.estimatedRevenue += revenue;
        metric.internalCost += cost;
        metric.estimatedProfit += revenue - cost;
      });

      metricsMap.forEach((metric) => {
        if (metric.estimatedRevenue > 0) {
          metric.profitMargin = Math.round((metric.estimatedProfit / metric.estimatedRevenue) * 100);
        }
      });

      return Array.from(metricsMap.values())
        .filter((m) => m.totalTickets > 0)
        .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);
    },
    ['revenue-metrics'],
    {
      tags: [CACHE_TAGS.REPORTS, CACHE_TAGS.WORK_LOGS, CACHE_TAGS.TECHNICIANS],
      revalidate: false,
    },
  );

  return cachedFn();
}

export async function getServiceQualityMetrics(): Promise<ServiceQualityMetrics> {
  const cachedFn = unstable_cache(
    async () => {
      const user = await getCurrentUser();
      if (!user || !['admin', 'management'].includes(user.role)) {
        return {
          totalTickets: 0,
          closedTickets: 0,
          firstTimeFixRate: 0,
          repeatTicketRate: 0,
          avgResolutionHours: 0,
          topIssueTypes: [],
          machinesWithRepeatIssues: [],
        };
      }

      const tickets = await adminDb.collection('tickets').get();
      const workLogs = await adminDb.collection('machineWorkLogs').get();

      let metrics: ServiceQualityMetrics = {
        totalTickets: tickets.size,
        closedTickets: 0,
        firstTimeFixRate: 0,
        repeatTicketRate: 0,
        avgResolutionHours: 0,
        topIssueTypes: [],
        machinesWithRepeatIssues: [],
      };

      // Count closed tickets and resolution time
      let totalResolutionHours = 0;
      let closedCount = 0;
      const issueTypesMap = new Map<string, number>();
      const machineIssuesMap = new Map<string, Map<string, number>>();

      tickets.docs.forEach((doc) => {
        const ticket = doc.data();

        if (ticket.status === 'Closed') {
          metrics.closedTickets++;

          if (ticket.closedAt && ticket.createdAt) {
            const createdTime = new Date(ticket.createdAt.toString()).getTime();
            const closedTime = new Date(ticket.closedAt.toString()).getTime();
            const hours = (closedTime - createdTime) / (1000 * 60 * 60);
            totalResolutionHours += hours;
            closedCount++;
          }
        }

        // Track issue types
        const issueType = ticket.issueDescription?.substring(0, 50) || 'Unknown';
        issueTypesMap.set(issueType, (issueTypesMap.get(issueType) || 0) + 1);

        // Track issues per machine
        if (ticket.machines) {
          ticket.machines.forEach((machine: any) => {
            if (!machineIssuesMap.has(machine.serialNumber)) {
              machineIssuesMap.set(machine.serialNumber, new Map());
            }
            const issueMap = machineIssuesMap.get(machine.serialNumber);
            if (issueMap) {
              issueMap.set(issueType, (issueMap.get(issueType) || 0) + 1);
            }
          });
        }
      });

      // Calculate first-time fix rate (tickets with complete work logs in first visit)
      let firstTimeFixes = 0;
      const machinesWithCompleteWorkLogs = new Set<string>();

      workLogs.docs.forEach((doc) => {
        const log = doc.data();
        if (log.departureTime && log.workPerformed && log.outcome) {
          machinesWithCompleteWorkLogs.add(`${log.ticketId}-${log.machineId}`);
        }
      });

      tickets.docs.forEach((doc) => {
        const ticket = doc.data();
        if (ticket.status === 'Closed' && ticket.machines) {
          let allMachinesFixed = true;
          ticket.machines.forEach((machine: any) => {
            if (!machinesWithCompleteWorkLogs.has(`${ticket.id}-${machine.machineId}`)) {
              allMachinesFixed = false;
            }
          });
          if (allMachinesFixed) firstTimeFixes++;
        }
      });

      metrics.avgResolutionHours = closedCount > 0 ? Math.round((totalResolutionHours / closedCount) * 10) / 10 : 0;
      metrics.firstTimeFixRate = metrics.closedTickets > 0 ? Math.round((firstTimeFixes / metrics.closedTickets) * 100) : 0;
      metrics.repeatTicketRate = 100 - metrics.firstTimeFixRate;

      // Top issue types
      metrics.topIssueTypes = Array.from(issueTypesMap.entries())
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Machines with repeat issues
      machineIssuesMap.forEach((issueMap, serialNumber) => {
        issueMap.forEach((count, issue) => {
          if (count > 1) {
            metrics.machinesWithRepeatIssues.push({ serialNumber, issue, count });
          }
        });
      });
      metrics.machinesWithRepeatIssues = metrics.machinesWithRepeatIssues.sort((a, b) => b.count - a.count).slice(0, 10);

      return metrics;
    },
    ['service-quality-metrics'],
    {
      tags: [CACHE_TAGS.REPORTS, CACHE_TAGS.TICKETS, CACHE_TAGS.WORK_LOGS],
      revalidate: false,
    },
  );

  return cachedFn();
}
