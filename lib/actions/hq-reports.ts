'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';

// ─── Shared auth guard ────────────────────────────────────────────────────────

async function assertHQUser() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
    throw new Error('Unauthorized');
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HQStoreFilter {
  storeId: string;
  storeName: string;
  island: string;
  status: string;
}

export interface HQTicketRow {
  ticketId: string;
  ticketNumber: string;
  storeId: string;
  storeName: string;
  island: string;
  customerName: string;
  machineType: string;
  serialNumber: string;
  status: string;
  priority: string;
  assignedToName: string | null;
  createdAt: string;
  closedAt: string | null;
  daysToClose: number | null;
}

export interface HQTechRow {
  techUid: string;
  techName: string;
  storeId: string;
  storeName: string;
  island: string;
  totalHours: number;
  totalVisits: number;
  avgHoursPerVisit: number;
  ticketsClosed: number;
  internalPayRate: number | null;
  chargeoutRate: number | null;
}

export interface HQPartsRow {
  partName: string;
  category: string;
  storeId: string;
  storeName: string;
  island: string;
  totalQuantityUsed: number;
  timesUsed: number;
}

export interface HQMachineRow {
  machineId: string;
  machineType: string;
  serialNumber: string;
  location: string;
  customerName: string;
  storeId: string;
  storeName: string;
  island: string;
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  lastTicketDate: string | null;
}

export interface HQStoreComparisonRow {
  storeId: string;
  storeName: string;
  island: string;
  status: string;
  totalTickets: number;
  openTickets: number;
  assignedTickets: number;
  closedTickets: number;
  resolutionRate: number;
  avgDaysToClose: number | null;
  techCount: number;
  customerCount: number;
  machineCount: number;
}

export interface HQResolutionRow {
  ticketId: string;
  ticketNumber: string;
  storeId: string;
  storeName: string;
  island: string;
  assignedToName: string | null;
  customerName: string;
  machineType: string;
  createdAt: string;
  closedAt: string;
  daysToClose: number;
  priority: string;
}

// ─── Store list (used for filter dropdowns in every report) ───────────────────

export async function getHQStoreList(): Promise<{ success: boolean; stores?: HQStoreFilter[]; error?: string }> {
  try {
    await assertHQUser();
    const snap = await adminDb.collection('stores').orderBy('name').get();
    const stores: HQStoreFilter[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        storeId: d.id,
        storeName: data.name ?? d.id,
        island: data.island ?? '',
        status: data.status ?? 'active',
      };
    });
    return { success: true, stores };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── 1. Ticket Analysis ───────────────────────────────────────────────────────
// Returns every ticket across all stores; client filters by store/status/date.

export async function getHQTicketReport(): Promise<{
  success: boolean;
  data?: HQTicketRow[];
  stores?: HQStoreFilter[];
  error?: string;
}> {
  try {
    await assertHQUser();

    const storesSnap = await adminDb.collection('stores').get();
    const rows: HQTicketRow[] = [];
    const storeFilters: HQStoreFilter[] = [];

    for (const storeDoc of storesSnap.docs) {
      const sd = storeDoc.data();
      const storeName: string = sd.name ?? storeDoc.id;
      const island: string = sd.island ?? '';
      storeFilters.push({ storeId: storeDoc.id, storeName, island, status: sd.status ?? 'active' });

      const ticketsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('tickets').orderBy('createdAt', 'desc').get();

      for (const ticketDoc of ticketsSnap.docs) {
        const td = ticketDoc.data();
        const createdAt: Date | null = td.createdAt?.toDate?.() ?? null;
        const closedAt: Date | null = td.closedAt?.toDate?.() ?? null;
        const daysToClose = createdAt && closedAt ? Math.round(((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10 : null;
        const machine = td.machines?.[0] ?? {};

        rows.push({
          ticketId: ticketDoc.id,
          ticketNumber: td.ticketNumber ?? '',
          storeId: storeDoc.id,
          storeName,
          island,
          customerName: machine.customerName ?? td.contactPerson ?? '',
          machineType: machine.machineType ?? '',
          serialNumber: machine.serialNumber ?? '',
          status: td.status ?? '',
          priority: machine.priority ?? 'Medium',
          assignedToName: td.assignedToName ?? null,
          createdAt: createdAt ? createdAt.toISOString() : '',
          closedAt: closedAt ? closedAt.toISOString() : null,
          daysToClose,
        });
      }
    }

    return {
      success: true,
      data: rows,
      stores: storeFilters.sort((a, b) => a.storeName.localeCompare(b.storeName)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── 2. Technician Productivity ───────────────────────────────────────────────
// Aggregates work logs by technician across all stores.

export async function getHQTechnicianPerformance(): Promise<{
  success: boolean;
  data?: HQTechRow[];
  stores?: HQStoreFilter[];
  error?: string;
}> {
  try {
    await assertHQUser();

    const storesSnap = await adminDb.collection('stores').get();
    const techMap = new Map<string, HQTechRow>();
    const storeFilters: HQStoreFilter[] = [];

    // Build tech pay-rate lookup across all stores
    const techRates = new Map<string, { internal: number | null; chargeout: number | null }>();
    const usersSnap = await adminDb.collection('users').where('role', '==', 'technician').get();
    for (const userDoc of usersSnap.docs) {
      const ud = userDoc.data();
      techRates.set(userDoc.id, {
        internal: ud.internalPayRate ?? null,
        chargeout: ud.chargeoutRate ?? null,
      });
    }

    for (const storeDoc of storesSnap.docs) {
      const sd = storeDoc.data();
      const storeName: string = sd.name ?? storeDoc.id;
      const island: string = sd.island ?? '';
      storeFilters.push({ storeId: storeDoc.id, storeName, island, status: sd.status ?? 'active' });

      // Count closed tickets per tech for this store
      const ticketsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('tickets').where('status', '==', 'Closed').get();
      const closedByTech = new Map<string, number>();
      for (const t of ticketsSnap.docs) {
        const assignedTo: string | undefined = t.data().assignedTo;
        if (assignedTo) {
          closedByTech.set(assignedTo, (closedByTech.get(assignedTo) ?? 0) + 1);
        }
      }

      const logsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('machineWorkLogs').get();

      for (const logDoc of logsSnap.docs) {
        const ld = logDoc.data();
        const techUid: string = ld.recordedBy ?? '';
        const techName: string = ld.recordedByName ?? 'Unknown';
        const hoursWorked: number = ld.hoursWorked ?? 0;
        const logDate: Date | null = ld.createdAt?.toDate?.() ?? null;

        const key = `${storeDoc.id}::${techUid}`;
        if (!techMap.has(key)) {
          const rates = techRates.get(techUid);
          techMap.set(key, {
            techUid,
            techName,
            storeId: storeDoc.id,
            storeName,
            island,
            totalHours: 0,
            totalVisits: 0,
            avgHoursPerVisit: 0,
            ticketsClosed: closedByTech.get(techUid) ?? 0,
            internalPayRate: rates?.internal ?? null,
            chargeoutRate: rates?.chargeout ?? null,
          });
        }

        const row = techMap.get(key)!;
        row.totalHours = Math.round((row.totalHours + hoursWorked) * 100) / 100;
        row.totalVisits++;
      }
    }

    const data = Array.from(techMap.values())
      .map((r) => ({
        ...r,
        avgHoursPerVisit: r.totalVisits > 0 ? Math.round((r.totalHours / r.totalVisits) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    return {
      success: true,
      data,
      stores: storeFilters.sort((a, b) => a.storeName.localeCompare(b.storeName)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── 3. Parts Consumption ─────────────────────────────────────────────────────
// Aggregates parts used in work logs across all stores.

export async function getHQPartsConsumption(): Promise<{
  success: boolean;
  data?: HQPartsRow[];
  stores?: HQStoreFilter[];
  error?: string;
}> {
  try {
    await assertHQUser();

    const storesSnap = await adminDb.collection('stores').get();
    const partsMap = new Map<string, HQPartsRow>();
    const storeFilters: HQStoreFilter[] = [];

    for (const storeDoc of storesSnap.docs) {
      const sd = storeDoc.data();
      const storeName: string = sd.name ?? storeDoc.id;
      const island: string = sd.island ?? '';
      storeFilters.push({ storeId: storeDoc.id, storeName, island, status: sd.status ?? 'active' });

      // Build part category map for this store
      const storePartsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('parts').get();
      const partCategoryMap = new Map<string, string>();
      for (const p of storePartsSnap.docs) {
        const pd = p.data();
        partCategoryMap.set((pd.name ?? '').toLowerCase(), pd.category ?? 'Uncategorized');
      }

      const logsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('machineWorkLogs').get();

      for (const logDoc of logsSnap.docs) {
        const ld = logDoc.data();
        const partsUsed: Array<{ partName: string; quantity: number }> = ld.partsUsed ?? [];

        for (const part of partsUsed) {
          if (!part.partName) continue;
          const key = `${storeDoc.id}::${part.partName.toLowerCase()}`;
          const category = partCategoryMap.get(part.partName.toLowerCase()) ?? 'Uncategorized';

          if (!partsMap.has(key)) {
            partsMap.set(key, {
              partName: part.partName,
              category,
              storeId: storeDoc.id,
              storeName,
              island,
              totalQuantityUsed: 0,
              timesUsed: 0,
            });
          }

          const row = partsMap.get(key)!;
          row.totalQuantityUsed += part.quantity ?? 1;
          row.timesUsed++;
        }
      }
    }

    const data = Array.from(partsMap.values()).sort((a, b) => b.totalQuantityUsed - a.totalQuantityUsed);

    return {
      success: true,
      data,
      stores: storeFilters.sort((a, b) => a.storeName.localeCompare(b.storeName)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── 4. Machine Reliability ───────────────────────────────────────────────────
// Returns all machines with ticket frequency data across all stores.

export async function getHQMachineReliability(): Promise<{
  success: boolean;
  data?: HQMachineRow[];
  stores?: HQStoreFilter[];
  error?: string;
}> {
  try {
    await assertHQUser();

    const storesSnap = await adminDb.collection('stores').get();
    const rows: HQMachineRow[] = [];
    const storeFilters: HQStoreFilter[] = [];

    for (const storeDoc of storesSnap.docs) {
      const sd = storeDoc.data();
      const storeName: string = sd.name ?? storeDoc.id;
      const island: string = sd.island ?? '';
      storeFilters.push({ storeId: storeDoc.id, storeName, island, status: sd.status ?? 'active' });

      const [machinesSnap, ticketsSnap, customersSnap] = await Promise.all([
        adminDb.collection('stores').doc(storeDoc.id).collection('machines').get(),
        adminDb.collection('stores').doc(storeDoc.id).collection('tickets').get(),
        adminDb.collection('stores').doc(storeDoc.id).collection('customers').get(),
      ]);

      // Build customer name lookup
      const customerNames = new Map<string, string>();
      for (const custDoc of customersSnap.docs) {
        customerNames.set(custDoc.id, custDoc.data().companyName ?? '');
      }

      // Count tickets per machine
      const machineStats = new Map<string, { total: number; open: number; closed: number; lastDate: Date | null }>();

      for (const ticketDoc of ticketsSnap.docs) {
        const td = ticketDoc.data();
        const ticketMachines: Array<{ machineId?: string }> = td.machines ?? [];
        const status: string = td.status ?? '';
        const createdAt: Date | null = td.createdAt?.toDate?.() ?? null;

        for (const tm of ticketMachines) {
          if (!tm.machineId) continue;
          if (!machineStats.has(tm.machineId)) {
            machineStats.set(tm.machineId, { total: 0, open: 0, closed: 0, lastDate: null });
          }
          const entry = machineStats.get(tm.machineId)!;
          entry.total++;
          if (status === 'Closed') entry.closed++;
          else entry.open++;
          if (createdAt && (!entry.lastDate || createdAt > entry.lastDate)) {
            entry.lastDate = createdAt;
          }
        }
      }

      for (const machineDoc of machinesSnap.docs) {
        const md = machineDoc.data();
        const stats = machineStats.get(machineDoc.id) ?? {
          total: 0,
          open: 0,
          closed: 0,
          lastDate: null,
        };
        const customerName = customerNames.get(md.customerId ?? '') ?? '';

        rows.push({
          machineId: machineDoc.id,
          machineType: md.type ?? '',
          serialNumber: md.serialNumber ?? '',
          location: md.location ?? '',
          customerName,
          storeId: storeDoc.id,
          storeName,
          island,
          totalTickets: stats.total,
          openTickets: stats.open,
          closedTickets: stats.closed,
          lastTicketDate: stats.lastDate ? stats.lastDate.toISOString() : null,
        });
      }
    }

    return {
      success: true,
      data: rows.sort((a, b) => b.totalTickets - a.totalTickets),
      stores: storeFilters.sort((a, b) => a.storeName.localeCompare(b.storeName)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── 5. Store Comparison ──────────────────────────────────────────────────────
// High-level KPI comparison across all stores.

export async function getHQStoreComparison(): Promise<{
  success: boolean;
  data?: HQStoreComparisonRow[];
  stores?: HQStoreFilter[];
  error?: string;
}> {
  try {
    await assertHQUser();

    const storesSnap = await adminDb.collection('stores').get();
    const rows: HQStoreComparisonRow[] = [];
    const storeFilters: HQStoreFilter[] = [];

    for (const storeDoc of storesSnap.docs) {
      const sd = storeDoc.data();
      const storeName: string = sd.name ?? storeDoc.id;
      const island: string = sd.island ?? '';
      storeFilters.push({ storeId: storeDoc.id, storeName, island, status: sd.status ?? 'active' });

      const [ticketsSnap, techSnap, customersSnap, machinesSnap] = await Promise.all([
        adminDb.collection('stores').doc(storeDoc.id).collection('tickets').get(),
        adminDb.collection('users').where('storeId', '==', storeDoc.id).where('role', '==', 'technician').get(),
        adminDb.collection('stores').doc(storeDoc.id).collection('customers').get(),
        adminDb.collection('stores').doc(storeDoc.id).collection('machines').get(),
      ]);

      let open = 0,
        assigned = 0,
        closed = 0;
      let totalDaysToClose = 0,
        closedCount = 0;

      for (const ticketDoc of ticketsSnap.docs) {
        const td = ticketDoc.data();
        const status: string = td.status ?? '';
        if (status === 'Closed') {
          closed++;
          const createdAt: Date | undefined = td.createdAt?.toDate?.();
          const closedAt: Date | undefined = td.closedAt?.toDate?.();
          if (createdAt && closedAt) {
            totalDaysToClose += (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            closedCount++;
          }
        } else if (status === 'Open') {
          open++;
        } else {
          assigned++;
        }
      }

      const total = open + assigned + closed;
      const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 0;
      const avgDaysToClose = closedCount > 0 ? Math.round((totalDaysToClose / closedCount) * 10) / 10 : null;

      rows.push({
        storeId: storeDoc.id,
        storeName,
        island,
        status: (sd.status ?? 'active') as string,
        totalTickets: total,
        openTickets: open,
        assignedTickets: assigned,
        closedTickets: closed,
        resolutionRate,
        avgDaysToClose,
        techCount: techSnap.size,
        customerCount: customersSnap.size,
        machineCount: machinesSnap.size,
      });
    }

    return {
      success: true,
      data: rows.sort((a, b) => b.totalTickets - a.totalTickets),
      stores: storeFilters.sort((a, b) => a.storeName.localeCompare(b.storeName)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── 6. Resolution Time Analysis ─────────────────────────────────────────────
// Returns only closed tickets with resolution time data for SLA analysis.

export async function getHQResolutionTimes(): Promise<{
  success: boolean;
  data?: HQResolutionRow[];
  stores?: HQStoreFilter[];
  error?: string;
}> {
  try {
    await assertHQUser();

    const storesSnap = await adminDb.collection('stores').get();
    const rows: HQResolutionRow[] = [];
    const storeFilters: HQStoreFilter[] = [];

    for (const storeDoc of storesSnap.docs) {
      const sd = storeDoc.data();
      const storeName: string = sd.name ?? storeDoc.id;
      const island: string = sd.island ?? '';
      storeFilters.push({ storeId: storeDoc.id, storeName, island, status: sd.status ?? 'active' });

      const ticketsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('tickets').where('status', '==', 'Closed').get();

      for (const ticketDoc of ticketsSnap.docs) {
        const td = ticketDoc.data();
        const createdAt: Date | null = td.createdAt?.toDate?.() ?? null;
        const closedAt: Date | null = td.closedAt?.toDate?.() ?? null;
        if (!createdAt || !closedAt) continue;

        const daysToClose = Math.round(((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10;

        const machine = td.machines?.[0] ?? {};

        rows.push({
          ticketId: ticketDoc.id,
          ticketNumber: td.ticketNumber ?? '',
          storeId: storeDoc.id,
          storeName,
          island,
          assignedToName: td.assignedToName ?? null,
          customerName: machine.customerName ?? td.contactPerson ?? '',
          machineType: machine.machineType ?? '',
          createdAt: createdAt.toISOString(),
          closedAt: closedAt.toISOString(),
          daysToClose,
          priority: machine.priority ?? 'Medium',
        });
      }
    }

    return {
      success: true,
      data: rows.sort((a, b) => b.daysToClose - a.daysToClose),
      stores: storeFilters.sort((a, b) => a.storeName.localeCompare(b.storeName)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
