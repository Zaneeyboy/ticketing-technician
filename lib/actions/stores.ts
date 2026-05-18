'use server';

import { randomBytes } from 'crypto';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createStoreSchema, updateStoreSchema, onboardStoreSchema, storeSettingsSchema } from '@/lib/schemas';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath, unstable_cache } from 'next/cache';
import { Store, StoreStatus, UserRole } from '@/lib/types';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';
import { sendStoreAdminInviteEmail } from '@/lib/email';

function assertSuperAdmin(role?: string) {
  if (role !== 'super_admin') throw new Error('Unauthorized: super_admin required');
}

/** Serialize a Firestore doc into a plain JSON-safe object for unstable_cache */
function toStoreSafe(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: data.name ?? '',
    island: data.island ?? '',
    address: data.address ?? '',
    contactEmail: data.contactEmail ?? '',
    contactPhone: data.contactPhone ?? '',
    status: (data.status ?? 'active') as StoreStatus,
    modules: data.modules ?? {},
    settings: data.settings ?? {},
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

/** Hydrate dates back from ISO strings returned by unstable_cache */
function hydrateStore(s: ReturnType<typeof toStoreSafe>): Store {
  return { ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) };
}

// ─── Private cached Firestore fetchers ───────────────────────────────────────
// Auth is checked in the exported wrappers; these do pure data reads.

const _listStoresCached = unstable_cache(
  async () => {
    const snap = await adminDb.collection('stores').orderBy('name', 'asc').get();
    return snap.docs.map((doc) => toStoreSafe(doc.id, doc.data()));
  },
  ['stores-list'],
  { tags: [CACHE_TAGS.STORES], revalidate: false },
);

const _getStoreCached = unstable_cache(
  async (storeId: string) => {
    const doc = await adminDb.collection('stores').doc(storeId).get();
    if (!doc.exists) return null;
    return toStoreSafe(doc.id, doc.data()!);
  },
  ['store-by-id'],
  { tags: [CACHE_TAGS.STORES], revalidate: false },
);

const _getHQStatsCached = unstable_cache(
  async () => {
    const storesSnap = await adminDb.collection('stores').where('status', 'in', ['active', 'onboarding']).get();
    const storeBreakdown: { storeId: string; storeName: string; open: number; assigned: number; closed: number; overdue: number }[] = [];
    let totalOpen = 0,
      totalAssigned = 0,
      totalClosed = 0,
      totalOverdue = 0;

    await Promise.all(
      storesSnap.docs.map(async (storeDoc) => {
        const ticketsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('tickets').get();
        let open = 0,
          assigned = 0,
          closed = 0,
          overdue = 0;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        ticketsSnap.docs.forEach((t) => {
          const data = t.data();
          const s = data.status;
          if (s === 'Open') {
            open++;
            const createdAt = data.createdAt?.toDate?.();
            if (createdAt && createdAt < sevenDaysAgo) overdue++;
          } else if (s === 'Assigned') assigned++;
          else if (s === 'Closed') closed++;
        });
        totalOpen += open;
        totalAssigned += assigned;
        totalClosed += closed;
        totalOverdue += overdue;
        storeBreakdown.push({ storeId: storeDoc.id, storeName: storeDoc.data().name, open, assigned, closed, overdue });
      }),
    );

    // Top store by close rate (minimum 3 total tickets to qualify)
    const topStore =
      storeBreakdown
        .filter((s) => s.open + s.assigned + s.closed >= 3)
        .sort((a, b) => {
          const rateA = a.closed / (a.open + a.assigned + a.closed);
          const rateB = b.closed / (b.open + b.assigned + b.closed);
          return rateB - rateA;
        })[0] ?? null;

    return { totalOpen, totalAssigned, totalClosed, totalOverdue, storeCount: storesSnap.size, storeBreakdown, topStore };
  },
  ['hq-stats'],
  { tags: [CACHE_TAGS.STORES, CACHE_TAGS.HQ_STATS, CACHE_TAGS.TICKETS], revalidate: false },
);

const _getHQReportsCached = unstable_cache(
  async () => {
    const storesSnap = await adminDb.collection('stores').get();
    const ticketsByStore: { storeName: string; open: number; assigned: number; closed: number }[] = [];
    const monthCounts: Record<string, number> = {};

    await Promise.all(
      storesSnap.docs.map(async (storeDoc) => {
        const ticketsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('tickets').get();
        let open = 0,
          assigned = 0,
          closed = 0;
        ticketsSnap.docs.forEach((t) => {
          const data = t.data();
          const s = data.status;
          if (s === 'Open') open++;
          else if (s === 'Assigned') assigned++;
          else if (s === 'Closed') closed++;
          const createdAt = data.createdAt?.toDate?.();
          if (createdAt) {
            const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[key] = (monthCounts[key] || 0) + 1;
          }
        });
        ticketsByStore.push({ storeName: storeDoc.data().name, open, assigned, closed });
      }),
    );

    const ticketsByMonth = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    return { ticketsByStore, ticketsByMonth };
  },
  ['hq-reports'],
  { tags: [CACHE_TAGS.STORES, CACHE_TAGS.HQ_REPORTS, CACHE_TAGS.TICKETS], revalidate: false },
);

const _getHQDetailedReportsCached = unstable_cache(
  async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [storesSnap] = await Promise.all([adminDb.collection('stores').get()]);

    const techMap: Record<string, { name: string; storeName: string; assigned: number; closed: number }> = {};
    const machineTypeMap: Record<string, number> = {};
    const monthCounts: Record<string, number> = {};
    const customerMap: Record<string, { name: string; storeName: string; total: number; open: number }> = {};

    const branchRaw = await Promise.all(
      storesSnap.docs.map(async (storeDoc) => {
        const storeName: string = storeDoc.data().name ?? storeDoc.id;
        const [ticketsSnap, usersSnap] = await Promise.all([
          adminDb.collection('stores').doc(storeDoc.id).collection('tickets').get(),
          adminDb.collection('users').where('storeId', '==', storeDoc.id).where('role', '==', 'technician').get(),
        ]);

        // Pre-register technicians
        usersSnap.docs.forEach((u) => {
          if (!techMap[u.id]) techMap[u.id] = { name: u.data().name ?? u.id, storeName, assigned: 0, closed: 0 };
        });

        let open = 0,
          assigned = 0,
          closed = 0,
          overdue = 0;
        let totalDaysToClose = 0,
          closedCount = 0;

        ticketsSnap.docs.forEach((t) => {
          const data = t.data();
          const status: string = data.status ?? '';
          const createdAt: Date | undefined = data.createdAt?.toDate?.();
          const closedAt: Date | undefined = data.closedAt?.toDate?.();

          if (status === 'Open') {
            open++;
            if (createdAt && createdAt < sevenDaysAgo) overdue++;
          } else if (status === 'Assigned') {
            assigned++;
          } else if (status === 'Closed') {
            closed++;
            if (createdAt && closedAt) {
              totalDaysToClose += (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
              closedCount++;
            }
          }

          // Monthly volume (last 12 months)
          if (createdAt && createdAt >= twelveMonthsAgo) {
            const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[key] = (monthCounts[key] || 0) + 1;
          }

          // Machine type breakdown
          const machines: { machineType?: string; type?: string; customerName?: string }[] = data.machines ?? [];
          machines.forEach((m) => {
            const type = m.machineType ?? m.type ?? 'Unknown';
            machineTypeMap[type] = (machineTypeMap[type] || 0) + 1;

            // Customer aggregates
            const cName = m.customerName ?? 'Unknown';
            const cKey = `${storeDoc.id}::${cName}`;
            if (!customerMap[cKey]) customerMap[cKey] = { name: cName, storeName, total: 0, open: 0 };
            customerMap[cKey].total++;
            if (status === 'Open' || status === 'Assigned') customerMap[cKey].open++;
          });

          // Technician stats
          const assignedTo: string | undefined = data.assignedTo;
          if (assignedTo && techMap[assignedTo]) {
            if (status === 'Closed') techMap[assignedTo].closed++;
            else if (status === 'Assigned') techMap[assignedTo].assigned++;
          }
        });

        return { storeId: storeDoc.id, storeName, open, assigned, closed, overdue, totalDaysToClose, closedCount };
      }),
    );

    // Build full 12-month array (fill gaps with 0)
    const monthlyVolume: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyVolume.push({ month: key, count: monthCounts[key] ?? 0 });
    }

    const branches = branchRaw
      .map((b) => ({
        storeId: b.storeId,
        storeName: b.storeName,
        open: b.open,
        assigned: b.assigned,
        closed: b.closed,
        total: b.open + b.assigned + b.closed,
        overdue: b.overdue,
        resolutionRate: b.open + b.assigned + b.closed > 0 ? Math.round((b.closed / (b.open + b.assigned + b.closed)) * 100) : 0,
        avgDaysToClose: b.closedCount > 0 ? Math.round((b.totalDaysToClose / b.closedCount) * 10) / 10 : null,
      }))
      .sort((a, b) => b.total - a.total);

    const allTotal = branchRaw.reduce(
      (acc, b) => ({
        open: acc.open + b.open,
        assigned: acc.assigned + b.assigned,
        closed: acc.closed + b.closed,
        total: acc.total + b.open + b.assigned + b.closed,
        overdue: acc.overdue + b.overdue,
        totalDaysToClose: acc.totalDaysToClose + b.totalDaysToClose,
        closedCount: acc.closedCount + b.closedCount,
      }),
      { open: 0, assigned: 0, closed: 0, total: 0, overdue: 0, totalDaysToClose: 0, closedCount: 0 },
    );

    return {
      branches,
      technicians: Object.values(techMap)
        .sort((a, b) => b.closed + b.assigned - (a.closed + a.assigned))
        .slice(0, 15),
      machineTypes: Object.entries(machineTypeMap)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => ({ type, count })),
      monthlyVolume,
      customers: Object.values(customerMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      totals: {
        open: allTotal.open,
        assigned: allTotal.assigned,
        closed: allTotal.closed,
        total: allTotal.total,
        overdue: allTotal.overdue,
        resolutionRate: allTotal.total > 0 ? Math.round((allTotal.closed / allTotal.total) * 100) : 0,
        avgDaysToClose: allTotal.closedCount > 0 ? Math.round((allTotal.totalDaysToClose / allTotal.closedCount) * 10) / 10 : null,
      },
    };
  },
  ['hq-detailed-reports'],
  { tags: [CACHE_TAGS.STORES, CACHE_TAGS.HQ_REPORTS, CACHE_TAGS.TICKETS, CACHE_TAGS.USERS], revalidate: false },
);

const _getAllTicketsCached = unstable_cache(
  async () => {
    const storesSnap = await adminDb.collection('stores').get();
    const storeNames: Record<string, string> = {};
    storesSnap.docs.forEach((d) => {
      storeNames[d.id] = d.data().name;
    });

    const perStoreResults = await Promise.all(
      storesSnap.docs.map(async (storeDoc) => {
        const snap = await adminDb.collection('stores').doc(storeDoc.id).collection('tickets').orderBy('createdAt', 'desc').limit(200).get();
        return snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            storeId: storeDoc.id,
            storeName: storeNames[storeDoc.id] || storeDoc.id,
            ticketNumber: data.ticketNumber ?? null,
            status: data.status ?? '',
            assignedToName: data.assignedToName ?? null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
            closedAt: data.closedAt?.toDate?.()?.toISOString() ?? null,
            machines: data.machines ?? [],
            issueDescription: data.issueDescription ?? '',
          };
        });
      }),
    );

    return perStoreResults
      .flat()
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      })
      .slice(0, 500);
  },
  ['hq-all-tickets'],
  { tags: [CACHE_TAGS.TICKETS, CACHE_TAGS.STORES], revalidate: false },
);

const _getStoreDetailCached = unstable_cache(
  async (storeId: string) => {
    const [storeDoc, usersSnap, ticketsSnap] = await Promise.all([
      adminDb.collection('stores').doc(storeId).get(),
      adminDb.collection('users').where('storeId', '==', storeId).get(),
      adminDb.collection('stores').doc(storeId).collection('tickets').get(),
    ]);

    if (!storeDoc.exists) return null;

    const store = toStoreSafe(storeDoc.id, storeDoc.data()!);

    const staff = usersSnap.docs.map((doc) => {
      const u = doc.data();
      return {
        uid: doc.id,
        name: u.name ?? '',
        email: u.email ?? '',
        role: (u.role ?? 'technician') as UserRole,
        disabled: u.disabled ?? false,
        isProtected: u.isProtected ?? false,
      };
    });

    let open = 0,
      assigned = 0,
      closed = 0;
    const allTickets: { id: string; status: string; customerName: string; technicianName: string | null; createdAt: string | null }[] = [];

    ticketsSnap.docs.forEach((t) => {
      const data = t.data();
      const s = data.status;
      if (s === 'Open') open++;
      else if (s === 'Assigned') assigned++;
      else if (s === 'Closed') closed++;
      allTickets.push({
        id: t.id,
        status: data.status ?? '',
        customerName: data.machines?.[0]?.customerName ?? data.customerName ?? '—',
        technicianName: data.assignedToName ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      });
    });

    allTickets.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });

    return {
      store,
      stats: { open, assigned, closed, total: ticketsSnap.size },
      staff,
      recentTickets: allTickets.slice(0, 5),
    };
  },
  ['store-detail'],
  { tags: [CACHE_TAGS.STORES, CACHE_TAGS.USERS, CACHE_TAGS.TICKETS], revalidate: false },
);

// ─── HQ Modular Reports ───────────────────────────────────────────────────────

export type StoreReportRow = {
  storeId: string;
  storeName: string;
  island: string;
  status: string;
  tickets: {
    open: number;
    assigned: number;
    closed: number;
    overdue: number;
    total: number;
    resolutionRate: number;
    avgDaysToClose: number | null;
  };
  parts: Array<{
    id: string;
    name: string;
    quantityInStock: number;
    minQuantity: number;
    category: string;
  }>;
  technicians: Array<{
    uid: string;
    name: string;
    email: string;
    open: number;
    assigned: number;
    closed: number;
    total: number;
  }>;
};

const _getHQModularReportsCached = unstable_cache(
  async (): Promise<StoreReportRow[]> => {
    const storesSnap = await adminDb.collection('stores').get();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const storeData = await Promise.all(
      storesSnap.docs.map(async (storeDoc) => {
        const data = storeDoc.data();
        const storeName: string = data.name ?? storeDoc.id;
        const island: string = data.island ?? 'Unknown';

        const [ticketsSnap, partsSnap, usersSnap] = await Promise.all([
          adminDb.collection('stores').doc(storeDoc.id).collection('tickets').get(),
          adminDb.collection('stores').doc(storeDoc.id).collection('parts').get(),
          adminDb.collection('users').where('storeId', '==', storeDoc.id).where('role', '==', 'technician').get(),
        ]);

        let open = 0,
          assigned = 0,
          closed = 0,
          overdue = 0;
        let totalDaysToClose = 0,
          closedCount = 0;
        const techTickets: Record<string, { assigned: number; closed: number; open: number }> = {};

        ticketsSnap.docs.forEach((t) => {
          const td = t.data();
          const status: string = td.status ?? '';
          const createdAt: Date | undefined = td.createdAt?.toDate?.();
          const closedAt: Date | undefined = td.closedAt?.toDate?.();

          if (status === 'Open') {
            open++;
            if (createdAt && createdAt < sevenDaysAgo) overdue++;
          } else if (status === 'Assigned') {
            assigned++;
          } else if (status === 'Closed') {
            closed++;
            if (createdAt && closedAt) {
              totalDaysToClose += (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
              closedCount++;
            }
          }

          const assignedTo: string | undefined = td.assignedTo;
          if (assignedTo) {
            if (!techTickets[assignedTo]) techTickets[assignedTo] = { assigned: 0, closed: 0, open: 0 };
            if (status === 'Closed') techTickets[assignedTo].closed++;
            else if (status === 'Assigned') techTickets[assignedTo].assigned++;
            else if (status === 'Open') techTickets[assignedTo].open++;
          }
        });

        const total = open + assigned + closed;
        const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 0;
        const avgDaysToClose = closedCount > 0 ? Math.round((totalDaysToClose / closedCount) * 10) / 10 : null;

        const parts = partsSnap.docs
          .map((p) => {
            const pd = p.data();
            return {
              id: p.id,
              name: pd.name ?? '',
              quantityInStock: pd.quantityInStock ?? 0,
              minQuantity: pd.minQuantity ?? 0,
              category: pd.category ?? '',
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        const technicians = usersSnap.docs
          .map((u) => {
            const ud = u.data();
            const ts = techTickets[u.id] ?? { assigned: 0, closed: 0, open: 0 };
            return {
              uid: u.id,
              name: ud.name ?? '',
              email: ud.email ?? '',
              open: ts.open,
              assigned: ts.assigned,
              closed: ts.closed,
              total: ts.open + ts.assigned + ts.closed,
            };
          })
          .sort((a, b) => b.closed + b.assigned - (a.closed + a.assigned));

        return {
          storeId: storeDoc.id,
          storeName,
          island,
          status: (data.status ?? 'active') as string,
          tickets: { open, assigned, closed, overdue, total, resolutionRate, avgDaysToClose },
          parts,
          technicians,
        };
      }),
    );

    return storeData.sort((a, b) => a.storeName.localeCompare(b.storeName));
  },
  ['hq-modular-reports'],
  { tags: [CACHE_TAGS.STORES, CACHE_TAGS.TICKETS, CACHE_TAGS.PARTS, CACHE_TAGS.USERS, CACHE_TAGS.HQ_REPORTS], revalidate: false },
);

export async function getHQModularReports(): Promise<{ success: boolean; stores?: StoreReportRow[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
    return { success: false, error: 'Unauthorized' };
  }
  try {
    const stores = await _getHQModularReportsCached();
    return { success: true, stores };
  } catch (error: any) {
    console.error('Error fetching HQ modular reports:', error);
    return { success: false, error: error.message };
  }
}

// ─── Helpers to invalidate relevant caches on mutation ───────────────────────
async function invalidateStores() {
  await revalidateCache([CACHE_TAGS.STORES, CACHE_TAGS.HQ_STATS, CACHE_TAGS.HQ_REPORTS]);
}
async function invalidateTickets() {
  await revalidateCache([CACHE_TAGS.TICKETS, CACHE_TAGS.HQ_STATS, CACHE_TAGS.HQ_REPORTS]);
}

export async function listStores(): Promise<{ success: boolean; stores: Store[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
    return { success: false, stores: [], error: 'Unauthorized' };
  }

  try {
    const raw = await _listStoresCached();
    return { success: true, stores: raw.map(hydrateStore) };
  } catch (error: any) {
    console.error('Error listing stores:', error);
    return { success: false, stores: [], error: error.message };
  }
}

export async function getStore(storeId: string): Promise<{ success: boolean; store?: Store; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (user.role !== 'super_admin' && user.storeId !== storeId) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const raw = await _getStoreCached(storeId);
    if (!raw) return { success: false, error: 'Store not found' };
    return { success: true, store: hydrateStore(raw) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createStore(data: any): Promise<{ success: boolean; storeId?: string; error?: string }> {
  const user = await getCurrentUser();
  try {
    assertSuperAdmin(user?.role);
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const validated = createStoreSchema.parse(data);
    const docRef = await adminDb.collection('stores').add({
      ...validated,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await invalidateStores();
    revalidatePath('/hq/stores');
    revalidatePath('/hq/dashboard');
    return { success: true, storeId: docRef.id };
  } catch (error: any) {
    console.error('Error creating store:', error);
    return { success: false, error: error.message };
  }
}

export async function updateStore(storeId: string, data: any): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  try {
    assertSuperAdmin(user?.role);
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const validated = updateStoreSchema.parse(data);
    await adminDb
      .collection('stores')
      .doc(storeId)
      .update({
        ...validated,
        updatedAt: Timestamp.now(),
      });

    // Update storeName on all users in this store if name changed
    if (validated.name) {
      const usersSnap = await adminDb.collection('users').where('storeId', '==', storeId).get();
      const batch = adminDb.batch();
      usersSnap.docs.forEach((doc) => batch.update(doc.ref, { storeName: validated.name, updatedAt: Timestamp.now() }));
      await batch.commit();
    }

    await invalidateStores();
    revalidatePath('/hq/stores');
    revalidatePath('/hq/dashboard');
    revalidatePath(`/hq/stores/${storeId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating store:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Onboard a new store â€” creates the store document and the initial store_admin user atomically.
 */
export async function onboardStore(data: any): Promise<{ success: boolean; storeId?: string; joinUrl?: string; error?: string }> {
  const user = await getCurrentUser();
  try {
    assertSuperAdmin(user?.role);
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const validated = onboardStoreSchema.parse(data);

    // Check if a user with this email already exists
    try {
      await adminAuth.getUserByEmail(validated.adminEmail);
      return { success: false, error: `An account with ${validated.adminEmail} already exists. They can log in directly.` };
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    // Create store doc
    const storeRef = await adminDb.collection('stores').add({
      ...validated.store,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Create an invitation for the store admin instead of directly setting a password
    const token = randomBytes(32).toString('hex'); // 64-char hex
    const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + INVITATION_TTL_MS));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const joinUrl = `${appUrl}/join?token=${token}`;

    await adminDb.collection('invitations').doc(token).set({
      email: validated.adminEmail,
      name: validated.adminName,
      role: 'store_admin',
      storeId: storeRef.id,
      storeName: validated.store.name,
      invitedBy: user!.uid,
      invitedByName: user!.name,
      status: 'pending',
      isProtected: true,
      expiresAt,
      createdAt: Timestamp.now(),
    });

    await invalidateStores();
    await revalidateCache([CACHE_TAGS.USERS]);
    revalidatePath('/hq/stores');
    revalidatePath('/hq/dashboard');

    // Send onboarding email to store admin — non-blocking
    try {
      await sendStoreAdminInviteEmail({
        to: validated.adminEmail,
        name: validated.adminName,
        storeName: validated.store.name,
        storeIsland: validated.store.island,
        joinUrl,
        invitedByName: user!.name,
      });
    } catch (emailErr) {
      console.error('onboardStore: failed to send store admin invite email', emailErr);
    }

    return { success: true, storeId: storeRef.id, joinUrl };
  } catch (error: any) {
    console.error('Error onboarding store:', error);
    return { success: false, error: error.message };
  }
}

export async function setStoreStatus(storeId: string, status: 'active' | 'inactive' | 'onboarding'): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  try {
    assertSuperAdmin(user?.role);
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await adminDb.collection('stores').doc(storeId).update({ status, updatedAt: Timestamp.now() });
    await invalidateStores();
    revalidatePath('/hq/stores');
    revalidatePath('/hq/dashboard');
    revalidatePath(`/hq/stores/${storeId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all tickets across all stores (super_admin only).
 * Unfiltered requests use unstable_cache; filtered requests bypass cache.
 */
export async function getAllTickets(filters?: { status?: string; storeId?: string }): Promise<{ success: boolean; tickets: any[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'super_admin') {
    return { success: false, tickets: [], error: 'Unauthorized' };
  }

  try {
    // Unfiltered — use cache
    if (!filters?.status && !filters?.storeId) {
      const tickets = await _getAllTicketsCached();
      return { success: true, tickets };
    }

    // Filtered — bypass cache and fetch directly
    const storesSnap = await adminDb.collection('stores').get();
    const storeDocs = filters.storeId ? storesSnap.docs.filter((d) => d.id === filters.storeId) : storesSnap.docs;
    const storeNames: Record<string, string> = {};
    storesSnap.docs.forEach((d) => {
      storeNames[d.id] = d.data().name;
    });

    const perStoreResults = await Promise.all(
      storeDocs.map(async (storeDoc) => {
        let q: FirebaseFirestore.Query = adminDb.collection('stores').doc(storeDoc.id).collection('tickets').orderBy('createdAt', 'desc').limit(200);
        if (filters.status) {
          q = adminDb.collection('stores').doc(storeDoc.id).collection('tickets').where('status', '==', filters.status).orderBy('createdAt', 'desc').limit(200);
        }
        const snap = await q.get();
        return snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            storeId: storeDoc.id,
            storeName: storeNames[storeDoc.id] || storeDoc.id,
            ticketNumber: data.ticketNumber ?? null,
            status: data.status ?? '',
            assignedToName: data.assignedToName ?? null,
            createdAt: data.createdAt?.toDate?.() ?? null,
            closedAt: data.closedAt?.toDate?.() ?? null,
            machines: data.machines ?? [],
            issueDescription: data.issueDescription ?? '',
          };
        });
      }),
    );

    const tickets = perStoreResults
      .flat()
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 500);
    return { success: true, tickets };
  } catch (error: any) {
    console.error('Error fetching all tickets:', error);
    return { success: false, tickets: [], error: error.message };
  }
}

/**
 * Get aggregate reports data across all stores (super_admin only).
 */
export async function getHQReports(): Promise<{
  success: boolean;
  ticketsByStore: { storeName: string; open: number; assigned: number; closed: number }[];
  ticketsByMonth: { month: string; count: number }[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'super_admin') {
    return { success: false, ticketsByStore: [], ticketsByMonth: [], error: 'Unauthorized' };
  }

  try {
    const data = await _getHQReportsCached();
    return { success: true, ...data };
  } catch (error: any) {
    console.error('Error fetching HQ reports:', error);
    return { success: false, ticketsByStore: [], ticketsByMonth: [], error: error.message };
  }
}

export type HQDetailedReportData = {
  branches: { storeId: string; storeName: string; open: number; assigned: number; closed: number; total: number; overdue: number; resolutionRate: number; avgDaysToClose: number | null }[];
  technicians: { name: string; storeName: string; assigned: number; closed: number }[];
  machineTypes: { type: string; count: number }[];
  monthlyVolume: { month: string; count: number }[];
  customers: { name: string; storeName: string; total: number; open: number }[];
  totals: { open: number; assigned: number; closed: number; total: number; overdue: number; resolutionRate: number; avgDaysToClose: number | null };
};

export async function getHQDetailedReports(): Promise<{ success: boolean; data?: HQDetailedReportData; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
    return { success: false, error: 'Unauthorized' };
  }
  try {
    const data = await _getHQDetailedReportsCached();
    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching HQ detailed reports:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get aggregate ticket stats across all stores for the HQ dashboard.
 */
export async function getHQStats(): Promise<{
  success: boolean;
  totalOpen: number;
  totalAssigned: number;
  totalClosed: number;
  totalOverdue: number;
  storeCount: number;
  storeBreakdown: { storeId: string; storeName: string; open: number; assigned: number; closed: number; overdue: number }[];
  topStore: { storeId: string; storeName: string; open: number; assigned: number; closed: number; overdue: number } | null;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
    return { success: false, totalOpen: 0, totalAssigned: 0, totalClosed: 0, totalOverdue: 0, storeCount: 0, storeBreakdown: [], topStore: null, error: 'Unauthorized' };
  }

  try {
    const data = await _getHQStatsCached();
    return { success: true, ...data };
  } catch (error: any) {
    console.error('Error fetching HQ stats:', error);
    return { success: false, totalOpen: 0, totalAssigned: 0, totalClosed: 0, totalOverdue: 0, storeCount: 0, storeBreakdown: [], topStore: null, error: error.message };
  }
}

/**
 * Get rich store detail: ticket stats, staff roster, and recent tickets (super_admin only).
 */
export async function getStoreDetail(storeId: string): Promise<{
  success: boolean;
  store?: Store;
  stats?: { open: number; assigned: number; closed: number; total: number };
  staff?: { uid: string; name: string; email: string; role: UserRole; disabled: boolean; isProtected: boolean }[];
  recentTickets?: { id: string; status: string; customerName: string; technicianName: string | null; createdAt: string | null }[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'super_admin') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const raw = await _getStoreDetailCached(storeId);
    if (!raw) return { success: false, error: 'Store not found' };
    return { success: true, store: hydrateStore(raw.store), stats: raw.stats, staff: raw.staff, recentTickets: raw.recentTickets };
  } catch (error: any) {
    console.error('Error fetching store detail:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update store settings — callable by store_admin for their own store, or super_admin for any store.
 */
export async function updateStoreSettings(data: {
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  settings?: { timezone?: string; currency?: string; locale?: string };
}): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !['store_admin', 'super_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const storeId = user.role === 'store_admin' ? user.storeId : null;
  if (user.role === 'store_admin' && !storeId) {
    return { success: false, error: 'No store assigned' };
  }

  try {
    const updatePayload: Record<string, any> = { updatedAt: Timestamp.now() };
    if (data.contactEmail !== undefined) updatePayload.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updatePayload.contactPhone = data.contactPhone;
    if (data.address !== undefined) updatePayload.address = data.address;
    if (data.settings) {
      if (data.settings.timezone !== undefined) updatePayload['settings.timezone'] = data.settings.timezone;
      if (data.settings.currency !== undefined) updatePayload['settings.currency'] = data.settings.currency;
      if (data.settings.locale !== undefined) updatePayload['settings.locale'] = data.settings.locale;
    }

    await adminDb.collection('stores').doc(storeId!).update(updatePayload);
    revalidatePath('/settings');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating store settings:', error);
    return { success: false, error: error.message };
  }
}

export interface HQActivityItem {
  ticketId: string;
  ticketNumber: string;
  storeName: string;
  storeId: string;
  status: string;
  updatedByName: string | null;
  updatedAt: string; // ISO string
}

export async function getHQActivity(): Promise<{ success: boolean; items: HQActivityItem[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
      return { success: false, items: [], error: 'Unauthorized' };
    }

    const storesSnap = await adminDb.collection('stores').where('status', 'in', ['active', 'onboarding']).get();

    // Fan-out: fetch last 3 updated tickets per store (parallel)
    const perStoreItems = await Promise.all(
      storesSnap.docs.map(async (storeDoc) => {
        const storeName = storeDoc.data().name ?? storeDoc.id;
        const ticketsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('tickets').orderBy('updatedAt', 'desc').limit(3).get();

        return ticketsSnap.docs.map((t) => {
          const data = t.data();
          const updatedAt: Date = data.updatedAt?.toDate?.() ?? data.createdAt?.toDate?.() ?? new Date(0);
          return {
            ticketId: t.id,
            ticketNumber: data.ticketNumber ?? t.id.slice(0, 6).toUpperCase(),
            storeName,
            storeId: storeDoc.id,
            status: data.status ?? 'Unknown',
            updatedByName: data.technicianName ?? data.assignedToName ?? data.createdByName ?? null,
            updatedAt: updatedAt.toISOString(),
          } satisfies HQActivityItem;
        });
      }),
    );

    // Flatten, sort by updatedAt descending, return top 10
    const items = perStoreItems
      .flat()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    return { success: true, items };
  } catch (error: any) {
    console.error('Error fetching HQ activity:', error);
    return { success: false, items: [], error: error.message };
  }
}
