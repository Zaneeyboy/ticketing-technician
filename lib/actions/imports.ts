'use server';

import { adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { Timestamp } from 'firebase-admin/firestore';

// Types for import validation
export interface CustomerImportRow {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}

export interface MachineImportRow {
  serialNumber: string;
  type: 'Crescendo' | 'Espresso' | 'Grinder' | 'Other';
  companyName: string; // Will be matched to existing customer
  location?: string;
  installationDate?: string;
  notes?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
  duplicates?: string[];
}

// Validate customer data
export function validateCustomer(row: any, rowNumber: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!row.companyName || typeof row.companyName !== 'string' || row.companyName.trim() === '') {
    errors.push('companyName is required');
  }
  if (!row.contactPerson || typeof row.contactPerson !== 'string' || row.contactPerson.trim() === '') {
    errors.push('contactPerson is required');
  }
  if (!row.phone || typeof row.phone !== 'string' || !/^\+?[\d\s\-()]{10,}$/.test(row.phone.trim())) {
    errors.push('phone must be a valid phone number');
  }
  if (!row.email || typeof row.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errors.push('email must be a valid email address');
  }
  if (!row.address || typeof row.address !== 'string' || row.address.trim() === '') {
    errors.push('address is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Validate machine data
export function validateMachine(row: any, rowNumber: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!row.serialNumber || typeof row.serialNumber !== 'string' || row.serialNumber.trim() === '') {
    errors.push('serialNumber is required');
  }
  if (!row.type || !['Crescendo', 'Espresso', 'Grinder', 'Other'].includes(row.type.trim())) {
    errors.push('type must be one of: Crescendo, Espresso, Grinder, Other');
  }
  if (!row.companyName || typeof row.companyName !== 'string' || row.companyName.trim() === '') {
    errors.push('companyName is required for linking to customer');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Import customers
export async function importCustomers(rows: any[]): Promise<ImportResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'management'].includes(user.role)) {
      return { success: false, imported: 0, skipped: 0, errors: [{ row: 0, reason: 'Unauthorized' }] };
    }

    const errors: Array<{ row: number; reason: string }> = [];
    let imported = 0;
    let skipped = 0;
    const existingEmails = new Set<string>();

    // Get existing customers to check for duplicates
    const existingCustomers = await adminDb.collection('customers').get();
    existingCustomers.docs.forEach((doc) => {
      const data = doc.data();
      existingEmails.add((data.email || '').toLowerCase());
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { valid, errors: validationErrors } = validateCustomer(row, i + 2);

      if (!valid) {
        errors.push({ row: i + 2, reason: validationErrors.join('; ') });
        continue;
      }

      const emailLower = row.email.toLowerCase();

      // Check for duplicates
      if (existingEmails.has(emailLower)) {
        errors.push({ row: i + 2, reason: `Customer with email ${row.email} already exists (skipped)` });
        skipped++;
        continue;
      }

      try {
        await adminDb.collection('customers').add({
          companyName: row.companyName.trim(),
          contactPerson: row.contactPerson.trim(),
          phone: row.phone.trim(),
          email: emailLower,
          address: row.address.trim(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        existingEmails.add(emailLower);
        imported++;
      } catch (error: any) {
        errors.push({ row: i + 2, reason: error.message || 'Failed to create customer' });
      }
    }

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
    };
  } catch (error: any) {
    console.error('Error importing customers:', error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [{ row: 0, reason: error.message || 'Import failed' }],
    };
  }
}

// Import machines
export async function importMachines(rows: any[]): Promise<ImportResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'management'].includes(user.role)) {
      return { success: false, imported: 0, skipped: 0, errors: [{ row: 0, reason: 'Unauthorized' }] };
    }

    const errors: Array<{ row: number; reason: string }> = [];
    let imported = 0;
    let skipped = 0;
    const duplicates: string[] = [];
    const existingSerialNumbers = new Set<string>();

    // Get existing machines to check for duplicates
    const existingMachines = await adminDb.collection('machines').get();
    existingMachines.docs.forEach((doc) => {
      const data = doc.data();
      existingSerialNumbers.add((data.serialNumber || '').toLowerCase());
    });

    // Get all customers for lookup
    const customersSnapshot = await adminDb.collection('customers').get();
    const customerMap = new Map<string, string>(); // companyName -> customerId
    customersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      customerMap.set((data.companyName || '').toLowerCase(), doc.id);
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { valid, errors: validationErrors } = validateMachine(row, i + 2);

      if (!valid) {
        errors.push({ row: i + 2, reason: validationErrors.join('; ') });
        continue;
      }

      const serialLower = row.serialNumber.toLowerCase();

      // Check for duplicate serial number
      if (existingSerialNumbers.has(serialLower)) {
        errors.push({ row: i + 2, reason: `Machine with serial number ${row.serialNumber} already exists (skipped)` });
        duplicates.push(row.serialNumber);
        skipped++;
        continue;
      }

      // Find customer
      const companyNameLower = (row.companyName || '').toLowerCase();
      const customerId = customerMap.get(companyNameLower);

      if (!customerId) {
        errors.push({ row: i + 2, reason: `Customer "${row.companyName}" not found. Create customer first.` });
        continue;
      }

      try {
        await adminDb.collection('machines').add({
          serialNumber: row.serialNumber.trim(),
          type: row.type.trim(),
          customerId,
          location: row.location?.trim() || null,
          installationDate: row.installationDate ? new Date(row.installationDate) : null,
          notes: row.notes?.trim() || null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        existingSerialNumbers.add(serialLower);
        imported++;
      } catch (error: any) {
        errors.push({ row: i + 2, reason: error.message || 'Failed to create machine' });
      }
    }

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
    };
  } catch (error: any) {
    console.error('Error importing machines:', error);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [{ row: 0, reason: error.message || 'Import failed' }],
    };
  }
}
