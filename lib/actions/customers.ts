'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { createCustomerSchema, updateCustomerSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, revalidateCache } from '@/lib/cache';

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

// Cached function to get all customers
const getCachedCustomers = unstable_cache(
  async () => {
    try {
      const snapshot = await adminDb.collection('customers').get();

      const customers = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            companyName: doc.data().companyName,
            contactPerson: doc.data().contactPerson,
            phone: doc.data().phone,
            email: doc.data().email,
            address: doc.data().address,
            isDisabled: doc.data().isDisabled || false,
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          }) as Customer,
      );

      console.log(`[Cache] Fetched ${customers.length} customers from Firestore`);
      return customers;
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      return [];
    }
  },
  [CACHE_TAGS.CUSTOMERS],
  { tags: [CACHE_TAGS.CUSTOMERS], revalidate: false },
);

export async function getCustomers(): Promise<Customer[]> {
  return getCachedCustomers();
}

// Get only enabled customers (for dropdown selections in tickets/machines)
export async function getEnabledCustomers(): Promise<Customer[]> {
  const customers = await getCachedCustomers();
  return customers.filter((c) => !c.isDisabled);
}

export async function createCustomer(data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = createCustomerSchema.parse(data);

    const customerData = {
      ...validated,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection('customers').add(customerData);

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.CUSTOMERS]);
    revalidatePath('/customers');
    revalidatePath('/(protected)/(admin)/customers');
    revalidatePath('/tickets');
    revalidatePath('/(protected)/tickets');

    return { success: true, customerId: docRef.id };
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return { success: false, error: error.message || 'Failed to create customer' };
  }
}

export async function updateCustomer(customerId: string, data: any) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const validated = updateCustomerSchema.parse(data);

    await adminDb
      .collection('customers')
      .doc(customerId)
      .update({
        ...validated,
        updatedAt: Timestamp.now(),
      });

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.CUSTOMERS]);
    revalidatePath('/customers');
    revalidatePath('/(protected)/(admin)/customers');
    revalidatePath('/tickets');
    revalidatePath('/(protected)/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return { success: false, error: error.message || 'Failed to update customer' };
  }
}

export async function toggleCustomerDisabled(customerId: string, isDisabled: boolean) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    await adminDb.collection('customers').doc(customerId).update({
      isDisabled,
      updatedAt: Timestamp.now(),
    });

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.CUSTOMERS]);
    revalidatePath('/customers');
    revalidatePath('/(protected)/(admin)/customers');

    return { success: true };
  } catch (error: any) {
    console.error('Error toggling customer disabled status:', error);
    return { success: false, error: error.message || 'Failed to update customer disabled status' };
  }
}

export async function deleteCustomer(customerId: string) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if customer has machines
    const machines = await adminDb.collection('machines').where('customerId', '==', customerId).get();

    if (!machines.empty) {
      return { success: false, error: 'Cannot delete customer with existing machines' };
    }

    await adminDb.collection('customers').doc(customerId).delete();

    // Invalidate cache and revalidate paths
    await revalidateCache([CACHE_TAGS.CUSTOMERS]);
    revalidatePath('/customers');
    revalidatePath('/(protected)/(admin)/customers');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return { success: false, error: error.message || 'Failed to delete customer' };
  }
}
