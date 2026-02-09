'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createPartSchema, updatePartSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';

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

// Cached function to get all parts
const getCachedParts = unstable_cache(
  async () => {
    try {
      const snapshot = await adminDb.collection('parts').orderBy('name', 'asc').get();
      const parts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Part[];

      console.log(`[Cache] Fetched ${parts.length} parts from Firestore`);
      return parts;
    } catch (error: any) {
      console.error('Error fetching parts:', error);
      return [];
    }
  },
  [CACHE_TAGS.PARTS],
  { tags: [CACHE_TAGS.PARTS], revalidate: false },
);

export async function getParts(): Promise<Part[]> {
  return getCachedParts();
}

export async function createPart(data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = createPartSchema.parse(data);

    const partData = {
      ...validated,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection('parts').add(partData);

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]);
    revalidatePath('/parts');
    revalidatePath('/(protected)/(admin)/parts');

    return { success: true, partId: docRef.id };
  } catch (error: any) {
    console.error('Error creating part:', error);
    return { success: false, error: error.message || 'Failed to create part' };
  }
}

export async function updatePart(partId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updatePartSchema.parse(data);

    await adminDb
      .collection('parts')
      .doc(partId)
      .update({
        ...validated,
        updatedAt: Timestamp.now(),
      });

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]);
    revalidatePath('/parts');
    revalidatePath('/(protected)/(admin)/parts');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating part:', error);
    return { success: false, error: error.message || 'Failed to update part' };
  }
}

export async function deletePart(partId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if part is used in any work logs
    const workLogs = await adminDb.collection('machineWorkLogs').get();

    const isPartUsed = workLogs.docs.some((doc) => {
      const partsUsed = doc.data().partsUsed || [];
      return Array.isArray(partsUsed) && partsUsed.some((part: any) => part?.partId === partId);
    });

    if (isPartUsed) {
      return { success: false, error: 'Cannot delete part that has been used in work logs. Archive or rename the part instead.' };
    }

    await adminDb.collection('parts').doc(partId).delete();

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]);
    revalidatePath('/parts');
    revalidatePath('/(protected)/(admin)/parts');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting part:', error);
    return { success: false, error: error.message || 'Failed to delete part' };
  }
}

export async function updatePartQuantity(partId: string, quantityChange: number, operation: 'use' | 'add' = 'use') {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const partRef = adminDb.collection('parts').doc(partId);
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

    await partRef.update({
      quantityInStock: newQuantity,
      updatedAt: Timestamp.now(),
    });

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.PARTS, CACHE_TAGS.REPORTS]);
    revalidatePath('/parts');
    revalidatePath('/(protected)/(admin)/parts');

    return { success: true, newQuantity };
  } catch (error: any) {
    console.error('Error updating part quantity:', error);
    return { success: false, error: error.message || 'Failed to update part quantity' };
  }
}

export async function getPartsForSelection() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Use cached getParts function instead of direct query
    const parts = await getParts();
    return { success: true, parts };
  } catch (error: any) {
    console.error('Error fetching parts:', error);
    return { success: false, error: error.message || 'Failed to fetch parts' };
  }
}
