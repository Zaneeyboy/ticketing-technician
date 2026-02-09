'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createMachineSchema, updateMachineSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';

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

// Cached function to get all machines
const getCachedMachines = unstable_cache(
  async () => {
    try {
      const snapshot = await adminDb.collection('machines').get();
      const machines = snapshot.docs.map((doc) => ({
        id: doc.id,
        customerId: doc.data().customerId,
        type: doc.data().type,
        serialNumber: doc.data().serialNumber,
        brand: doc.data().brand,
        model: doc.data().model,
        installationDate: doc.data().installationDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Machine[];

      console.log(`[Cache] Fetched ${machines.length} machines from Firestore`);
      return machines;
    } catch (error: any) {
      console.error('Error fetching machines:', error);
      return [];
    }
  },
  [CACHE_TAGS.MACHINES],
  { tags: [CACHE_TAGS.MACHINES], revalidate: false },
);

export async function getMachines(): Promise<Machine[]> {
  return getCachedMachines();
}

export async function createMachine(data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'management'].includes(user.role)) {
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

    const docRef = await adminDb.collection('machines').add(machineData);

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.MACHINES]);
    revalidatePath('/machines');
    revalidatePath('/(protected)/(admin)/machines');

    return { success: true, machineId: docRef.id };
  } catch (error: any) {
    console.error('Error creating machine:', error);
    return { success: false, error: error.message || 'Failed to create machine' };
  }
}

export async function updateMachine(machineId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateMachineSchema.parse(data);

    const updateData: any = {
      ...validated,
      updatedAt: Timestamp.now(),
    };

    if (validated.installationDate) {
      updateData.installationDate = Timestamp.fromDate(validated.installationDate);
    }

    await adminDb.collection('machines').doc(machineId).update(updateData);

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.MACHINES]);
    revalidatePath('/machines');
    revalidatePath('/(protected)/(admin)/machines');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating machine:', error);
    return { success: false, error: error.message || 'Failed to update machine' };
  }
}

export async function deleteMachine(machineId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if machine has tickets
    const tickets = await adminDb.collection('tickets').where('machineId', '==', machineId).get();

    if (!tickets.empty) {
      return { success: false, error: 'Cannot delete machine with existing tickets' };
    }

    await adminDb.collection('machines').doc(machineId).delete();

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.MACHINES]);
    revalidatePath('/machines');
    revalidatePath('/(protected)/(admin)/machines');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting machine:', error);
    return { success: false, error: error.message || 'Failed to delete machine' };
  }
}
