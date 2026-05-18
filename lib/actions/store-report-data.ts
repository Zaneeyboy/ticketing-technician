'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoreTicketRow = {
  id: string;
  ticketNumber: string;
  status: string;
  customerName: string;
  customerId: string | null;
  machineType: string | null;
  serialNumber: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string | null;
  closedAt: string | null;
};

export type StoreTechRow = {
  uid: string;
  name: string;
  email: string;
  disabled: boolean;
};

export type StorePartRow = {
  id: string;
  name: string;
  category: string;
  quantityInStock: number;
  minQuantity: number;
};

export type StoreCustomerRow = {
  id: string;
  companyName: string;
  isDisabled: boolean;
};

export type StoreModularReportData = {
  storeId: string;
  storeName: string;
  tickets: StoreTicketRow[];
  technicians: StoreTechRow[];
  parts: StorePartRow[];
  customers: StoreCustomerRow[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toIso(val: unknown): string | null {
  if (!val) return null;
  if (typeof (val as any)?.toDate === 'function') {
    const d = (val as any).toDate() as Date;
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
  if (typeof val === 'string') return val;
  return null;
}

// ─── Cached fetcher (per storeId) ────────────────────────────────────────────

const _getStoreModularReportCached = (storeId: string) =>
  unstable_cache(
    async (): Promise<StoreModularReportData> => {
      const storeRef = adminDb.collection('stores').doc(storeId);

      const [storeDoc, ticketsSnap, partsSnap, customersSnap, usersSnap] = await Promise.all([
        storeRef.get(),
        storeRef.collection('tickets').orderBy('createdAt', 'desc').get(),
        storeRef.collection('parts').get(),
        storeRef.collection('customers').get(),
        adminDb.collection('users').where('storeId', '==', storeId).get(),
      ]);

      const storeName: string = storeDoc.data()?.name ?? storeId;

      const tickets: StoreTicketRow[] = ticketsSnap.docs.map((doc) => {
        const d = doc.data();
        const firstMachine = Array.isArray(d.machines) && d.machines.length > 0 ? d.machines[0] : null;
        return {
          id: doc.id,
          ticketNumber: d.ticketNumber ?? '',
          status: d.status ?? 'Open',
          customerName: d.customerName ?? firstMachine?.customerName ?? 'Unknown',
          customerId: d.customerId ?? firstMachine?.customerId ?? null,
          machineType: firstMachine?.machineType ?? null,
          serialNumber: firstMachine?.serialNumber ?? null,
          assignedTo: d.assignedTo ?? null,
          assignedToName: d.assignedToName ?? null,
          createdAt: toIso(d.createdAt),
          closedAt: toIso(d.closedAt),
        };
      });

      const parts: StorePartRow[] = partsSnap.docs
        .map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.name ?? '',
            category: d.category ?? 'Uncategorised',
            quantityInStock: typeof d.quantityInStock === 'number' ? d.quantityInStock : 0,
            minQuantity: typeof d.minQuantity === 'number' ? d.minQuantity : 0,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const customers: StoreCustomerRow[] = customersSnap.docs
        .map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            companyName: d.companyName ?? 'Unknown',
            isDisabled: d.isDisabled ?? false,
          };
        })
        .sort((a, b) => a.companyName.localeCompare(b.companyName));

      const technicians: StoreTechRow[] = usersSnap.docs
        .filter((doc) => !['super_admin', 'manager'].includes(doc.data().role ?? ''))
        .map((doc) => {
          const d = doc.data();
          return {
            uid: doc.id,
            name: d.name ?? '',
            email: d.email ?? '',
            disabled: d.disabled ?? false,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return { storeId, storeName, tickets, technicians, parts, customers };
    },
    [`store-modular-report-${storeId}`],
    {
      tags: [CACHE_TAGS.TICKETS, CACHE_TAGS.PARTS, CACHE_TAGS.CUSTOMERS, CACHE_TAGS.USERS, CACHE_TAGS.REPORTS],
      revalidate: 60,
    },
  );

// ─── Exported action ──────────────────────────────────────────────────────────

export async function getStoreModularReportData(): Promise<{
  success: boolean;
  data?: StoreModularReportData;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user?.storeId) {
    return { success: false, error: 'No store is associated with your account.' };
  }
  if (!['store_admin', 'store_manager', 'call_admin'].includes(user.role)) {
    return { success: false, error: 'Unauthorized' };
  }
  try {
    const data = await _getStoreModularReportCached(user.storeId)();
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getStoreModularReportData]', msg);
    return { success: false, error: msg };
  }
}
