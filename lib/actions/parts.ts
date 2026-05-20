'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createPartSchema, updatePartSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';

function storeCol(storeId: string, col: string) {
  return adminDb.collection('stores').doc(storeId).collection(col);
}

export interface Part {
  id: string;
  name: string;
  description?: string;
  quantityInStock: number;
  minQuantity: number;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export async function getParts(): Promise<Part[]> {
  const user = await getCurrentUser();
  if (!user?.storeId) return [];

  const storeId = user.storeId;
  const cached = unstable_cache(
    async () => {
      const snapshot = await storeCol(storeId, 'parts').orderBy('name', 'asc').get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Part[];
    },
    [`${CACHE_TAGS.PARTS}-${storeId}`],
    { tags: [`${CACHE_TAGS.PARTS}-${storeId}`], revalidate: false },
  );
  return cached();
}

export async function createPart(data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = createPartSchema.parse(data);

    const docRef = await storeCol(user.storeId, 'parts').add({
      ...validated,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await revalidateCache([`${CACHE_TAGS.PARTS}-${user.storeId}`, CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]);
    revalidatePath('/parts');

    return { success: true, partId: docRef.id };
  } catch (error: any) {
    console.error('Error creating part:', error);
    return { success: false, error: error.message || 'Failed to create part' };
  }
}

export async function updatePart(partId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updatePartSchema.parse(data);

    await storeCol(user.storeId, 'parts')
      .doc(partId)
      .update({
        ...validated,
        updatedAt: Timestamp.now(),
      });

    await revalidateCache([`${CACHE_TAGS.PARTS}-${user.storeId}`, CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]);
    revalidatePath('/parts');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating part:', error);
    return { success: false, error: error.message || 'Failed to update part' };
  }
}

export async function deletePart(partId: string) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    await storeCol(user.storeId, 'parts').doc(partId).delete();

    await revalidateCache([`${CACHE_TAGS.PARTS}-${user.storeId}`, CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]);
    revalidatePath('/parts');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting part:', error);
    return { success: false, error: error.message || 'Failed to delete part' };
  }
}

export async function updatePartQuantity(partId: string, quantityChange: number, operation: 'use' | 'add' = 'use') {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId) {
      return { success: false, error: 'Unauthorized' };
    }

    const partRef = storeCol(user.storeId, 'parts').doc(partId);
    const partDoc = await partRef.get();

    if (!partDoc.exists) {
      return { success: false, error: 'Part not found' };
    }

    const currentQuantity = partDoc.data()?.quantityInStock || 0;
    const adjustment = operation === 'use' ? -quantityChange : quantityChange;
    const newQuantity = currentQuantity + adjustment;

    if (newQuantity < 0) {
      return {
        success: false,
        error: `Insufficient stock. Available: ${currentQuantity}, Requested: ${quantityChange}`,
      };
    }

    await partRef.update({ quantityInStock: newQuantity, updatedAt: Timestamp.now() });

    await revalidateCache([`${CACHE_TAGS.PARTS}-${user.storeId}`, CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]);
    revalidatePath('/parts');

    return { success: true, newQuantity };
  } catch (error: any) {
    console.error('Error updating part quantity:', error);
    return { success: false, error: error.message || 'Failed to update part quantity' };
  }
}

export async function getPartsForSelection() {
  try {
    const parts = await getParts();
    return { success: true, parts };
  } catch (error: any) {
    console.error('Error fetching parts:', error);
    return { success: false, error: error.message || 'Failed to fetch parts' };
  }
}

export interface BulkPartRow {
  name: string;
  description?: string;
  category?: string;
  quantityInStock?: number;
  minQuantity?: number;
}

export interface BulkImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: string[];
  errors: string[];
  error?: string;
}

export async function bulkCreateParts(rows: BulkPartRow[], updateExisting = false): Promise<BulkImportResult> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, created: 0, updated: 0, skipped: [], errors: [], error: 'Unauthorized' };
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, created: 0, updated: 0, skipped: [], errors: [], error: 'No rows provided' };
    }

    const partsCol = storeCol(user.storeId, 'parts');

    // Fetch existing parts — select only 'name' to minimise data transfer
    const existingSnap = await partsCol.select('name').get();
    const existingByName = new Map<string, string>(); // normalised name → doc id
    existingSnap.docs.forEach((d) => {
      existingByName.set((d.data().name as string).toLowerCase().trim(), d.id);
    });

    const created: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    // Validate all rows first (sync, no I/O) and build operation lists
    const creates: { ref: FirebaseFirestore.DocumentReference; data: object }[] = [];
    const updates: { ref: FirebaseFirestore.DocumentReference; data: object }[] = [];

    for (const row of rows) {
      const name = (row.name ?? '').trim();
      if (!name) {
        errors.push(`Row skipped: missing part name`);
        continue;
      }

      const existingId = existingByName.get(name.toLowerCase());

      if (existingId) {
        if (updateExisting) {
          updates.push({
            ref: partsCol.doc(existingId),
            data: {
              quantityInStock: typeof row.quantityInStock === 'number' && row.quantityInStock >= 0 ? Math.floor(row.quantityInStock) : 0,
              ...(row.category?.trim() ? { category: row.category.trim() } : {}),
              updatedAt: Timestamp.now(),
            },
          });
          updated.push(name);
        } else {
          skipped.push(name);
        }
        continue;
      }

      try {
        const partData = {
          name,
          description: (row.description ?? '').trim() || name,
          category: row.category?.trim() || undefined,
          quantityInStock: typeof row.quantityInStock === 'number' && row.quantityInStock >= 0 ? Math.floor(row.quantityInStock) : 0,
          minQuantity: typeof row.minQuantity === 'number' && row.minQuantity >= 0 ? Math.floor(row.minQuantity) : 0,
        };
        const validated = createPartSchema.parse(partData);
        // Strip undefined fields — Firestore Admin SDK rejects them in batches
        const docData = Object.fromEntries(Object.entries({ ...validated, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }).filter(([, v]) => v !== undefined));
        creates.push({
          ref: partsCol.doc(), // auto-id
          data: docData,
        });
        existingByName.set(name.toLowerCase(), 'pending'); // prevent same-batch duplicates
        created.push(name);
      } catch (rowError: any) {
        errors.push(`"${name}": ${rowError.message || 'Validation failed'}`);
      }
    }

    // Build and commit batches in parallel (Firestore limit: 500 ops per batch)
    const allOps = [...creates.map((c) => ({ type: 'set' as const, ...c })), ...updates.map((u) => ({ type: 'update' as const, ...u }))];

    const BATCH_LIMIT = 450;
    const batchPromises: Promise<FirebaseFirestore.WriteResult[]>[] = [];
    for (let i = 0; i < allOps.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      for (const op of allOps.slice(i, i + BATCH_LIMIT)) {
        if (op.type === 'set') {
          batch.set(op.ref, op.data);
        } else {
          batch.update(op.ref, op.data);
        }
      }
      batchPromises.push(batch.commit());
    }
    await Promise.all(batchPromises);

    if (created.length > 0 || updated.length > 0) {
      await Promise.all([revalidateCache([`${CACHE_TAGS.PARTS}-${user.storeId}`, CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]), Promise.resolve(revalidatePath('/parts'))]);
    }

    return { success: true, created: created.length, updated: updated.length, skipped, errors };
  } catch (error: any) {
    console.error('Error bulk creating parts:', error);
    return { success: false, created: 0, updated: 0, skipped: [], errors: [], error: error.message || 'Bulk import failed' };
  }
}

export interface HQPartRow {
  storeId: string;
  storeName: string;
  partId: string;
  name: string;
  description: string;
  category: string;
  quantityInStock: number;
  minQuantity: number;
  isLowStock: boolean;
}

export async function getHQParts(): Promise<{ success: boolean; rows: HQPartRow[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'super_admin' && user.role !== 'manager')) {
      return { success: false, rows: [], error: 'Unauthorized' };
    }

    const storesSnap = await adminDb.collection('stores').where('status', 'in', ['active', 'onboarding']).get();

    const perStore = await Promise.all(
      storesSnap.docs.map(async (storeDoc) => {
        const storeName: string = storeDoc.data().name ?? storeDoc.id;
        const partsSnap = await adminDb.collection('stores').doc(storeDoc.id).collection('parts').orderBy('name', 'asc').get();
        return partsSnap.docs.map((p) => {
          const d = p.data();
          const qty: number = d.quantityInStock ?? 0;
          const minQty: number = d.minQuantity ?? 0;
          return {
            storeId: storeDoc.id,
            storeName,
            partId: p.id,
            name: d.name ?? '',
            description: d.description ?? '',
            category: d.category ?? '',
            quantityInStock: qty,
            minQuantity: minQty,
            isLowStock: qty <= minQty,
          } satisfies HQPartRow;
        });
      }),
    );

    const rows = perStore.flat().sort((a, b) => a.storeName.localeCompare(b.storeName) || a.name.localeCompare(b.name));
    return { success: true, rows };
  } catch (error: any) {
    console.error('Error fetching HQ parts:', error);
    return { success: false, rows: [], error: error.message };
  }
}
