'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createCustomerSchema, updateCustomerSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';

function storeCol(storeId: string, col: string) {
  return adminDb.collection('stores').doc(storeId).collection(col);
}

export interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  isDisabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getCustomers(): Promise<Customer[]> {
  const user = await getCurrentUser();
  if (!user?.storeId) return [];

  const storeId = user.storeId;
  const cached = unstable_cache(
    async () => {
      const snapshot = await storeCol(storeId, 'customers').get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        companyName: doc.data().companyName,
        contactPerson: doc.data().contactPerson,
        phone: doc.data().phone,
        email: doc.data().email,
        address: doc.data().address,
        isDisabled: doc.data().isDisabled || false,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Customer[];
    },
    [`${CACHE_TAGS.CUSTOMERS}-${storeId}`],
    { tags: [`${CACHE_TAGS.CUSTOMERS}-${storeId}`], revalidate: false },
  );
  return cached();
}

export async function getEnabledCustomers(): Promise<Customer[]> {
  const customers = await getCustomers();
  return customers.filter((c) => !c.isDisabled);
}

export async function createCustomer(data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = createCustomerSchema.parse(data);

    const docRef = await storeCol(user.storeId, 'customers').add({
      ...validated,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await revalidateCache([`${CACHE_TAGS.CUSTOMERS}-${user.storeId}`, CACHE_TAGS.CUSTOMERS, CACHE_TAGS.REPORTS]);
    revalidatePath('/customers');
    revalidatePath('/tickets');

    return { success: true, customerId: docRef.id };
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return { success: false, error: error.message || 'Failed to create customer' };
  }
}

export async function updateCustomer(customerId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateCustomerSchema.parse(data);

    await storeCol(user.storeId, 'customers')
      .doc(customerId)
      .update({
        ...validated,
        updatedAt: Timestamp.now(),
      });

    await revalidateCache([`${CACHE_TAGS.CUSTOMERS}-${user.storeId}`, CACHE_TAGS.CUSTOMERS, CACHE_TAGS.REPORTS]);
    revalidatePath('/customers');
    revalidatePath('/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return { success: false, error: error.message || 'Failed to update customer' };
  }
}

export async function toggleCustomerDisabled(customerId: string, isDisabled: boolean) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    await storeCol(user.storeId, 'customers').doc(customerId).update({
      isDisabled,
      updatedAt: Timestamp.now(),
    });

    await revalidateCache([`${CACHE_TAGS.CUSTOMERS}-${user.storeId}`, CACHE_TAGS.CUSTOMERS, CACHE_TAGS.REPORTS]);
    revalidatePath('/customers');

    return { success: true };
  } catch (error: any) {
    console.error('Error toggling customer disabled status:', error);
    return { success: false, error: error.message || 'Failed to update customer' };
  }
}

export async function deleteCustomer(customerId: string) {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const machines = await storeCol(user.storeId, 'machines').where('customerId', '==', customerId).get();
    if (!machines.empty) {
      return { success: false, error: 'Cannot delete customer with existing machines' };
    }

    await storeCol(user.storeId, 'customers').doc(customerId).delete();

    await revalidateCache([`${CACHE_TAGS.CUSTOMERS}-${user.storeId}`, CACHE_TAGS.CUSTOMERS, CACHE_TAGS.REPORTS]);
    revalidatePath('/customers');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return { success: false, error: error.message || 'Failed to delete customer' };
  }
}

export interface BulkCustomerRow {
  companyName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface BulkCustomerImportResult {
  success: boolean;
  created: number;
  skipped: string[];
  errors: string[];
  error?: string;
}

export async function bulkCreateCustomers(rows: BulkCustomerRow[]): Promise<BulkCustomerImportResult> {
  try {
    const user = await getCurrentUser();
    if (!user?.storeId || !['super_admin', 'store_admin', 'call_admin'].includes(user.role)) {
      return { success: false, created: 0, skipped: [], errors: [], error: 'Unauthorized' };
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, created: 0, skipped: [], errors: [], error: 'No rows provided' };
    }

    const customersCol = storeCol(user.storeId, 'customers');
    const existingSnap = await customersCol.select('companyName').get();
    const existingNames = new Set(existingSnap.docs.map((d) => (d.data().companyName as string).toLowerCase().trim()));

    const created: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    const creates: { ref: FirebaseFirestore.DocumentReference; data: object }[] = [];

    for (const row of rows) {
      const name = (row.companyName ?? '').trim();
      if (!name) {
        errors.push('Row skipped: missing company name');
        continue;
      }
      if (existingNames.has(name.toLowerCase())) {
        skipped.push(name);
        continue;
      }

      try {
        const data = {
          companyName: name,
          contactPerson: (row.contactPerson ?? '').trim() || 'Unknown',
          phone: (row.phone ?? '').trim() || '000-0000',
          email: (row.email ?? '').trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          address: (row.address ?? '').trim() || 'Unknown',
        };
        const validated = createCustomerSchema.parse(data);
        const docData = Object.fromEntries(Object.entries({ ...validated, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }).filter(([, v]) => v !== undefined));
        creates.push({ ref: customersCol.doc(), data: docData });
        existingNames.add(name.toLowerCase());
        created.push(name);
      } catch (rowError: any) {
        errors.push(`"${name}": ${rowError.message || 'Validation failed'}`);
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
      await Promise.all([
        revalidateCache([`${CACHE_TAGS.CUSTOMERS}-${user.storeId}`, CACHE_TAGS.CUSTOMERS, CACHE_TAGS.REPORTS]),
        Promise.resolve(revalidatePath('/customers')),
        Promise.resolve(revalidatePath('/tickets')),
      ]);
    }
    return { success: true, created: created.length, skipped, errors };
  } catch (error: any) {
    console.error('Error bulk creating customers:', error);
    return { success: false, created: 0, skipped: [], errors: [], error: error.message || 'Bulk import failed' };
  }
}
