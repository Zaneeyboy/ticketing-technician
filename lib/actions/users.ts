'use server';

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { Timestamp } from 'firebase-admin/firestore';
import { UserRole } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { revalidateCache, CACHE_TAGS } from '@/lib/cache';

const USER_ADMIN_ROLES: UserRole[] = ['admin', 'call_admin'];

const isUserAdmin = (role?: UserRole) => (role ? USER_ADMIN_ROLES.includes(role) : false);

export interface UserRecordSummary {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  disabled: boolean;
  internalPayRate?: number;
  chargeoutRate?: number;
  createdAt?: number;
  lastSignInTime?: number;
}

export async function listUsersAction() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isUserAdmin(currentUser.role)) {
    return { success: false, error: 'Unauthorized', users: [] as UserRecordSummary[] };
  }

  try {
    const [authUsers, profileSnapshot] = await Promise.all([adminAuth.listUsers(1000), adminDb.collection('users').get()]);

    const profileMap = new Map<string, any>();
    profileSnapshot.docs.forEach((doc) => profileMap.set(doc.id, doc.data()));

    const users = authUsers.users.map((user) => {
      const profile = profileMap.get(user.uid);
      return {
        uid: user.uid,
        email: user.email || profile?.email || '',
        name: profile?.name || user.displayName || '',
        role: (profile?.role || 'technician') as UserRole,
        disabled: Boolean(profile?.disabled ?? user.disabled ?? false),
        internalPayRate: typeof profile?.internalPayRate === 'number' ? profile.internalPayRate : undefined,
        chargeoutRate: typeof profile?.chargeoutRate === 'number' ? profile.chargeoutRate : undefined,
        createdAt: user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : undefined,
        lastSignInTime: user.metadata.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : undefined,
      };
    });

    return { success: true, users };
  } catch (error: any) {
    console.error('Error listing users:', error);
    return { success: false, error: error.message || 'Failed to list users', users: [] as UserRecordSummary[] };
  }
}

export async function createUserAction(data: { name: string; email: string; role: UserRole; password: string }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isUserAdmin(currentUser.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
      disabled: false,
    });

    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: data.email,
      name: data.name,
      role: data.role,
      disabled: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Invalidate cache - especially important for technician assignments
    await revalidateCache([CACHE_TAGS.TECHNICIANS, CACHE_TAGS.REPORTS]);
    revalidatePath('/users');
    revalidatePath('/(protected)/users');
    revalidatePath('/tickets');
    revalidatePath('/(protected)/tickets');

    return { success: true, userId: userRecord.uid };
  } catch (error: any) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message || 'Failed to create user' };
  }
}

export async function updateUserAction(uid: string, data: { name?: string; email?: string; role?: UserRole; internalPayRate?: number; chargeoutRate?: number }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isUserAdmin(currentUser.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const updateAuthData: { displayName?: string; email?: string } = {};
    if (data.name) updateAuthData.displayName = data.name;
    if (data.email) updateAuthData.email = data.email;

    if (Object.keys(updateAuthData).length > 0) {
      await adminAuth.updateUser(uid, updateAuthData);
    }

    const updateDoc: Record<string, any> = {
      updatedAt: Timestamp.now(),
    };
    if (data.name !== undefined) updateDoc.name = data.name;
    if (data.email !== undefined) updateDoc.email = data.email;
    if (data.role !== undefined) updateDoc.role = data.role;
    if (data.internalPayRate !== undefined) updateDoc.internalPayRate = data.internalPayRate;
    if (data.chargeoutRate !== undefined) updateDoc.chargeoutRate = data.chargeoutRate;

    await adminDb.collection('users').doc(uid).set(updateDoc, { merge: true });

    // Invalidate cache - role changes affect technician assignments
    await revalidateCache([CACHE_TAGS.TECHNICIANS, CACHE_TAGS.REPORTS]);
    revalidatePath('/users');
    revalidatePath('/(protected)/users');
    revalidatePath('/tickets');
    revalidatePath('/(protected)/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message || 'Failed to update user' };
  }
}

export async function setUserDisabledAction(uid: string, disabled: boolean) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isUserAdmin(currentUser.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await adminAuth.updateUser(uid, { disabled });
    await adminDb.collection('users').doc(uid).set(
      {
        disabled,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    // Invalidate cache - disabled users shouldn't appear in technician lists
    await revalidateCache([CACHE_TAGS.TECHNICIANS, CACHE_TAGS.REPORTS]);
    revalidatePath('/users');
    revalidatePath('/(protected)/users');
    revalidatePath('/tickets');
    revalidatePath('/(protected)/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user disabled state:', error);
    return { success: false, error: error.message || 'Failed to update user status' };
  }
}

export async function updateUserPasswordAction(uid: string, password: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isUserAdmin(currentUser.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await adminAuth.updateUser(uid, { password });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating user password:', error);
    return { success: false, error: error.message || 'Failed to update password' };
  }
}

async function countAdmins(): Promise<number> {
  const adminsSnapshot = await adminDb.collection('users').where('role', '==', 'admin').get();
  return adminsSnapshot.size;
}

export async function deleteUserAction(uid: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isUserAdmin(currentUser.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const isAdminUser = userData?.role === 'admin';

    if (isAdminUser) {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        return { success: false, error: 'At least one admin must remain in the system' };
      }
      if (uid === currentUser.uid && adminCount <= 1) {
        return { success: false, error: 'You cannot delete your own account unless another admin exists' };
      }
    }

    await adminAuth.deleteUser(uid);
    await adminDb.collection('users').doc(uid).delete();

    // Invalidate cache - removed user shouldn't appear anywhere
    await revalidateCache([CACHE_TAGS.TECHNICIANS, CACHE_TAGS.REPORTS]);
    revalidatePath('/users');
    revalidatePath('/(protected)/users');
    revalidatePath('/tickets');
    revalidatePath('/(protected)/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return { success: false, error: error.message || 'Failed to delete user' };
  }
}
