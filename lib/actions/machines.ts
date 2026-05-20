'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createMachineSchema, updateMachineSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';
import { MACHINE_TYPES } from '@/lib/types';

function storeCol(storeId: string, col: string) {
  return adminDb.collection('stores').doc(storeId).collection(col);
}

export interface Machine {
  id: string;
  customerId: string;
  type: string;
  serialNumber: string;
  brand?: string;
  model?: string;
  installationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Machine Types (dynamic, Firestore-backed) ────────────────────────────────

/**
 * Returns the full list of machine types: the built-in base list merged with any
 * custom types that admins have added via the UI (stored per store in Firestore).
 */
export async function getMachineTypes(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user?.storeId) return [...MACHINE_TYPES];

  const storeId = user.storeId;
  const cached = unstable_cache(
    async () => {
      const configDoc = await storeCol(storeId, 'config').doc('machineTypes').get();
      const customTypes: string[] = configDoc.exists ? (configDoc.data()?.types ?? []) : [];
      const merged: string[] = [...MACHINE_TYPES];
      for (const t of customTypes) {
        if (!merged.includes(t)) merged.push(t);
      }
      return merged;
    },
    [`machine-types-${storeId}`],
    { tags: [`machine-types-${storeId}`, CACHE_TAGS.MACHINE_TYPES], revalidate: false },
  );
  return cached();
}

/**
 * Saves a new machine type to this store's Firestore config document so it
 * appears in all machine-type dropdowns going forward.
 * No-ops if the type is already in the base list or already saved.
 */
export async function addMachineType(type: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const trimmed = type.trim();
    if (!trimmed) return { success: false, error: 'Type cannot be empty' };
    if ((MACHINE_TYPES as readonly string[]).includes(trimmed)) return { success: true }; // already in base list

    const configRef = storeCol(user.storeId, 'config').doc('machineTypes');
    const doc = await configRef.get();
    const existing: string[] = doc.exists ? (doc.data()?.types ?? []) : [];
    if (existing.includes(trimmed)) return { success: true }; // already saved

    await configRef.set({ types: [...existing, trimmed] }, { merge: true });
    await revalidateCache([`machine-types-${user.storeId}`, CACHE_TAGS.MACHINE_TYPES]);

    return { success: true };
  } catch (error: any) {
    console.error('Error adding machine type:', error);
    return { success: false, error: error.message || 'Failed to add machine type' };
  }
}

// ── Machine CRUD ──────────────────────────────────────────────────────────────

export async function getMachines(): Promise<Machine[]> {
  const user = await getCurrentUser();
  if (!user?.storeId) return [];

  const storeId = user.storeId;
  const cached = unstable_cache(
    async () => {
      const snapshot = await storeCol(storeId, 'machines').get();
      return snapshot.docs.map((doc) => {
        const d = doc.data();
        const associatedParts = Array.isArray(d.associatedParts)
          ? d.associatedParts.map((p: any) => ({
              partId: p.partId,
              partName: p.partName,
              addedAt: typeof p.addedAt?.toDate === 'function' ? p.addedAt.toDate() : new Date(),
            }))
          : [];
        return {
          id: doc.id,
          ...d,
          associatedParts,
          installationDate: d.installationDate?.toDate(),
          createdAt: d.createdAt?.toDate() || new Date(),
          updatedAt: d.updatedAt?.toDate() || new Date(),
        };
      }) as Machine[];
    },
    [`${CACHE_TAGS.MACHINES}-${storeId}`],
    { tags: [`${CACHE_TAGS.MACHINES}-${storeId}`], revalidate: false },
  );
  return cached();
}

export async function createMachine(data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = createMachineSchema.parse(data);

    const machineData: any = {
      ...validated,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    if (validated.installationDate) {
      machineData.installationDate = Timestamp.fromDate(validated.installationDate);
    }

    const docRef = await storeCol(user.storeId, 'machines').add(machineData);

    // Auto-register new machine type if not in the built-in list
    if (validated.type && !(MACHINE_TYPES as readonly string[]).includes(validated.type)) {
      await addMachineType(validated.type);
    }

    await revalidateCache([`${CACHE_TAGS.MACHINES}-${user.storeId}`, CACHE_TAGS.MACHINES, CACHE_TAGS.REPORTS]);
    revalidatePath('/machines');

    return { success: true, machineId: docRef.id };
  } catch (error: any) {
    console.error('Error creating machine:', error);
    return { success: false, error: error.message || 'Failed to create machine' };
  }
}

export async function updateMachine(machineId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateMachineSchema.parse(data);

    const updateData: any = { ...validated, updatedAt: Timestamp.now() };
    if (validated.installationDate) {
      updateData.installationDate = Timestamp.fromDate(validated.installationDate);
    }

    await storeCol(user.storeId, 'machines').doc(machineId).update(updateData);

    await revalidateCache([`${CACHE_TAGS.MACHINES}-${user.storeId}`, CACHE_TAGS.MACHINES, CACHE_TAGS.REPORTS]);
    revalidatePath('/machines');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating machine:', error);
    return { success: false, error: error.message || 'Failed to update machine' };
  }
}

export async function deleteMachine(machineId: string) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    await storeCol(user.storeId, 'machines').doc(machineId).delete();

    await revalidateCache([`${CACHE_TAGS.MACHINES}-${user.storeId}`, CACHE_TAGS.MACHINES, CACHE_TAGS.REPORTS]);
    revalidatePath('/machines');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting machine:', error);
    return { success: false, error: error.message || 'Failed to delete machine' };
  }
}

export interface BulkMachineRow {
  serialNumber: string;
  type?: string;
  customerId?: string;
  customerName?: string;
  location?: string;
  notes?: string;
}

export interface BulkMachineImportResult {
  success: boolean;
  created: number;
  skipped: string[];
  errors: string[];
  error?: string;
}

export async function bulkCreateMachines(rows: BulkMachineRow[]): Promise<BulkMachineImportResult> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, created: 0, skipped: [], errors: [], error: 'Unauthorized' };
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, created: 0, skipped: [], errors: [], error: 'No rows provided' };
    }

    const existingSnap = await storeCol(user.storeId, 'machines').get();
    const machinesCol = storeCol(user.storeId, 'machines');
    const existingSerials = new Set(existingSnap.docs.map((d) => (d.data().serialNumber as string).toLowerCase().trim()));

    // Build customer name → id map for lookup
    const customersSnap = await storeCol(user.storeId, 'customers').get();
    const customerNameMap = new Map<string, string>();
    customersSnap.docs.forEach((d) => {
      customerNameMap.set((d.data().companyName as string).toLowerCase().trim(), d.id);
    });

    const created: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    const creates: { ref: FirebaseFirestore.DocumentReference; data: object }[] = [];

    for (const row of rows) {
      const serial = (row.serialNumber ?? '').trim();
      if (!serial) {
        errors.push('Row skipped: missing serial number');
        continue;
      }
      if (existingSerials.has(serial.toLowerCase())) {
        skipped.push(serial);
        continue;
      }

      // Resolve customer
      let customerId = row.customerId?.trim() || '';
      if (!customerId && row.customerName) {
        customerId = customerNameMap.get(row.customerName.toLowerCase().trim()) ?? '';
      }

      // Normalize type — capitalise first letter, fall back to 'Other'
      const rawType = (row.type ?? '').trim();
      const type = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : 'Other';

      try {
        const data = {
          serialNumber: serial,
          type,
          customerId: customerId || 'unknown',
          location: row.location?.trim() || undefined,
          notes: row.notes?.trim() || undefined,
        };
        const validated = createMachineSchema.parse(data);
        const docData = Object.fromEntries(Object.entries({ ...validated, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }).filter(([, v]) => v !== undefined));
        creates.push({ ref: machinesCol.doc(), data: docData });
        existingSerials.add(serial.toLowerCase());
        created.push(serial);
      } catch (rowError: any) {
        errors.push(`"${serial}": ${rowError.message || 'Validation failed'}`);
      }
    }

    const BATCH_LIMIT = 450;
    const batchPromises: Promise<FirebaseFirestore.WriteResult[]>[] = [];
    for (let i = 0; i < creates.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      for (const { ref, data } of creates.slice(i, i + BATCH_LIMIT)) {
        batch.set(ref, data);
      }
      batchPromises.push(batch.commit());
    }
    await Promise.all(batchPromises);

    if (created.length > 0) {
      await Promise.all([revalidateCache([`${CACHE_TAGS.MACHINES}-${user.storeId}`, CACHE_TAGS.MACHINES, CACHE_TAGS.REPORTS]), Promise.resolve(revalidatePath('/machines'))]);
    }
    return { success: true, created: created.length, skipped, errors };
  } catch (error: any) {
    return { success: false, created: 0, skipped: [], errors: [], error: error.message || 'Bulk import failed' };
  }
}

// ── Associated Parts ──────────────────────────────────────────────────────────

/**
 * Merges a list of parts into a machine's `associatedParts` array.
 * Called automatically after bulk work-log submission, and can be called manually.
 * Parts that are already associated (matched by partId or partName) are not duplicated.
 */
export async function appendPartsToMachine(machineId: string, parts: Array<{ partId?: string; partName: string }>): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId) return { success: false, error: 'Unauthorized' };

    const machineRef = storeCol(user.storeId, 'machines').doc(machineId);
    const machineSnap = await machineRef.get();
    if (!machineSnap.exists) return { success: false, error: 'Machine not found' };

    const existing: Array<{ partId?: string; partName: string; addedAt: any }> = machineSnap.data()?.associatedParts ?? [];

    const existingKeys = new Set(existing.map((p) => (p.partId ? `id:${p.partId}` : `name:${p.partName.toLowerCase().trim()}`)));

    const toAdd = parts.filter((p) => {
      const key = p.partId ? `id:${p.partId}` : `name:${p.partName.toLowerCase().trim()}`;
      return !existingKeys.has(key);
    });

    if (toAdd.length === 0) return { success: true };

    const newEntries = toAdd.map((p) => ({
      partId: p.partId ?? null,
      partName: p.partName,
      addedAt: Timestamp.now(),
    }));

    await machineRef.update({
      associatedParts: [...existing, ...newEntries],
      updatedAt: Timestamp.now(),
    });

    await revalidateCache([`${CACHE_TAGS.MACHINES}-${user.storeId}`, CACHE_TAGS.MACHINES]);

    return { success: true };
  } catch (error: any) {
    console.error('Error appending parts to machine:', error);
    return { success: false, error: error.message || 'Failed to update machine parts' };
  }
}

/**
 * Replaces the full associatedParts list on a machine.
 * Used when the admin manually edits the parts list in the machine form.
 */
// ── HQ cross-store view ────────────────────────────────────────────────────

export interface HQMachineRow {
  storeId: string;
  storeName: string;
  machineId: string;
  customerId: string;
  customerName: string;
  type: string;
  serialNumber: string;
  location: string;
  associatedPartsCount: number;
}

export async function getHQMachines(): Promise<{ success: boolean; rows: HQMachineRow[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
      return { success: false, rows: [], error: 'Unauthorized' };
    }

    const storesSnap = await adminDb.collection('stores').where('status', 'in', ['active', 'onboarding']).get();

    const perStore = await Promise.all(
      storesSnap.docs.map(async (storeDoc) => {
        const storeName: string = storeDoc.data().name ?? storeDoc.id;
        const storeId = storeDoc.id;

        // Fetch customers for this store to resolve names
        const customersSnap = await adminDb.collection('stores').doc(storeId).collection('customers').get();
        const customerMap = new Map<string, string>();
        customersSnap.docs.forEach((c) => customerMap.set(c.id, c.data().companyName ?? 'Unknown'));

        const machinesSnap = await adminDb.collection('stores').doc(storeId).collection('machines').orderBy('type', 'asc').get();
        return machinesSnap.docs.map((m) => {
          const d = m.data();
          return {
            storeId,
            storeName,
            machineId: m.id,
            customerId: d.customerId ?? '',
            customerName: customerMap.get(d.customerId) ?? 'Unknown',
            type: d.type ?? '',
            serialNumber: d.serialNumber ?? '',
            location: d.location ?? '',
            associatedPartsCount: Array.isArray(d.associatedParts) ? d.associatedParts.length : 0,
          } satisfies HQMachineRow;
        });
      }),
    );

    const rows = perStore.flat().sort((a, b) => a.storeName.localeCompare(b.storeName) || a.type.localeCompare(b.type));
    return { success: true, rows };
  } catch (error: any) {
    console.error('Error fetching HQ machines:', error);
    return { success: false, rows: [], error: error.message };
  }
}

export async function setMachineAssociatedParts(machineId: string, parts: Array<{ partId?: string; partName: string; addedAt: Date }>): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const entries = parts.map((p) => ({
      partId: p.partId ?? null,
      partName: p.partName,
      addedAt: Timestamp.fromDate(p.addedAt),
    }));

    await storeCol(user.storeId, 'machines').doc(machineId).update({
      associatedParts: entries,
      updatedAt: Timestamp.now(),
    });

    await revalidateCache([`${CACHE_TAGS.MACHINES}-${user.storeId}`, CACHE_TAGS.MACHINES]);
    revalidatePath('/machines');

    return { success: true };
  } catch (error: any) {
    console.error('Error setting machine associated parts:', error);
    return { success: false, error: error.message || 'Failed to update machine parts' };
  }
}
