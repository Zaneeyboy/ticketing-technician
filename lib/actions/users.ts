'use server';

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { Timestamp } from 'firebase-admin/firestore';
import { UserRole } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { revalidateCache, CACHE_TAGS } from '@/lib/cache';

const ADMIN_ROLES: UserRole[] = ['super_admin', 'store_admin'];
const isUserAdmin = (role?: UserRole) => (role ? ADMIN_ROLES.includes(role) : false);

export interface UserRecordSummary {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  storeId: string | null;
  storeName?: string;
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

    let users = authUsers.users.map((user) => {
      const profile = profileMap.get(user.uid);
      return {
        uid: user.uid,
        email: user.email || profile?.email || '',
        name: profile?.name || user.displayName || '',
        role: (profile?.role || 'technician') as UserRole,
        storeId: profile?.storeId ?? null,
        storeName: profile?.storeName,
        disabled: Boolean(profile?.disabled ?? user.disabled ?? false),
        internalPayRate: typeof profile?.internalPayRate === 'number' ? profile.internalPayRate : undefined,
        chargeoutRate: typeof profile?.chargeoutRate === 'number' ? profile.chargeoutRate : undefined,
        createdAt: user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : undefined,
        lastSignInTime: user.metadata.lastSignInTime ? Date.parse(user.metadata.lastSignInTime) : undefined,
      };
    });

    if (currentUser.role === 'store_admin' && currentUser.storeId) {
      users = users.filter((u) => u.storeId === currentUser.storeId);
    }

    return { success: true, users };
  } catch (error: any) {
    console.error('Error listing users:', error);
    return { success: false, error: error.message || 'Failed to list users', users: [] as UserRecordSummary[] };
  }
}

export async function createUserAction(data: { name: string; email: string; role: UserRole; password: string; storeId?: string | null }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isUserAdmin(currentUser.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const targetStoreId = currentUser.role === 'super_admin' ? (data.storeId ?? null) : currentUser.storeId;
  if (currentUser.role === 'store_admin' && data.role === 'super_admin') {
    return { success: false, error: 'Unauthorized: cannot create super_admin' };
  }
  if (currentUser.role === 'store_admin' && data.role === 'store_admin') {
    return { success: false, error: 'Unauthorized: only super_admin can create store admins' };
  }

  // Store-scoped roles must be assigned to a store
  const STORE_SCOPED_ROLES: UserRole[] = ['store_admin', 'call_admin', 'technician'];
  if (STORE_SCOPED_ROLES.includes(data.role) && !targetStoreId) {
    return { success: false, error: `Role "${data.role}" requires a store assignment. Select a store before creating this user.` };
  }
  // Platform-only roles must NOT be assigned to a store
  const PLATFORM_ROLES: UserRole[] = ['super_admin', 'manager'];
  if (PLATFORM_ROLES.includes(data.role) && targetStoreId) {
    return { success: false, error: `Role "${data.role}" is a platform-level role and cannot be assigned to a store.` };
  }

  try {
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
      disabled: false,
    });

    let storeName: string | undefined;
    if (targetStoreId) {
      const storeDoc = await adminDb.collection('stores').doc(targetStoreId).get();
      storeName = storeDoc.exists ? storeDoc.data()?.name : undefined;
    }

    await adminDb
      .collection('users')
      .doc(userRecord.uid)
      .set({
        uid: userRecord.uid,
        email: data.email,
        name: data.name,
        role: data.role,
        storeId: targetStoreId,
        storeName: storeName || null,
        disabled: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

    await revalidateCache([CACHE_TAGS.TECHNICIANS, CACHE_TAGS.REPORTS, CACHE_TAGS.USERS]);
    if (targetStoreId) await revalidateCache([`${CACHE_TAGS.TECHNICIANS}-${targetStoreId}`]);
    revalidatePath('/users');
    revalidatePath('/hq/users');
    revalidatePath('/tickets');

    return { success: true, userId: userRecord.uid };
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error.code === 'auth/email-already-exists') {
      return { success: false, error: 'That email is already taken. Check if this person already has an account, or use a different address.' };
    }
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

    const updateDoc: Record<string, any> = { updatedAt: Timestamp.now() };
    if (data.name !== undefined) updateDoc.name = data.name;
    if (data.email !== undefined) updateDoc.email = data.email;
    if (data.role !== undefined) updateDoc.role = data.role;
    if (data.internalPayRate !== undefined) updateDoc.internalPayRate = data.internalPayRate;
    if (data.chargeoutRate !== undefined) updateDoc.chargeoutRate = data.chargeoutRate;

    await adminDb.collection('users').doc(uid).set(updateDoc, { merge: true });

    await revalidateCache([CACHE_TAGS.TECHNICIANS, CACHE_TAGS.REPORTS, CACHE_TAGS.USERS]);
    revalidatePath('/users');
    revalidatePath('/hq/users');
    revalidatePath('/tickets');

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

  // Protected store admin accounts can only be disabled by super_admin
  const targetDoc = await adminDb.collection('users').doc(uid).get();
  if (!targetDoc.exists) return { success: false, error: 'User not found' };
  const target = targetDoc.data()!;
  if (target.isProtected && currentUser.role !== 'super_admin') {
    return { success: false, error: 'This is a protected store admin account. Only a Super Admin can change their status.' };
  }

  try {
    await adminAuth.updateUser(uid, { disabled });
    await adminDb.collection('users').doc(uid).set({ disabled, updatedAt: Timestamp.now() }, { merge: true });

    await revalidateCache([CACHE_TAGS.TECHNICIANS, CACHE_TAGS.REPORTS, CACHE_TAGS.USERS]);
    revalidatePath('/users');
    revalidatePath('/hq/users');
    revalidatePath('/tickets');

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

export async function deleteUserAction(uid: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isUserAdmin(currentUser.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  // Protected store admin accounts can only be deleted by super_admin
  const targetDoc = await adminDb.collection('users').doc(uid).get();
  if (!targetDoc.exists) return { success: false, error: 'User not found' };
  const target = targetDoc.data()!;
  if (target.isProtected && currentUser.role !== 'super_admin') {
    return { success: false, error: 'This is a protected store admin account. Only a Super Admin can remove them.' };
  }
  // Prevent removing the last store_admin for a store
  if (target.isProtected && target.storeId) {
    const adminCount = await adminDb.collection('users').where('storeId', '==', target.storeId).where('role', '==', 'store_admin').get();
    if (adminCount.size <= 1) {
      return { success: false, error: `${target.name || 'This user'} is the only Store Admin for this store. Assign a replacement first.` };
    }
  }

  try {
    await adminAuth.deleteUser(uid);
    await adminDb.collection('users').doc(uid).delete();

    await revalidateCache([CACHE_TAGS.TECHNICIANS, CACHE_TAGS.REPORTS, CACHE_TAGS.USERS]);
    revalidatePath('/users');
    revalidatePath('/hq/users');
    revalidatePath('/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return { success: false, error: error.message || 'Failed to delete user' };
  }
}

export async function exportUsersCSVAction(): Promise<{ success: boolean; csv?: string; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'manager')) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const result = await listUsersAction();
    if (!result.success) return { success: false, error: result.error };

    const ROLE_LABELS: Record<string, string> = {
      super_admin: 'Super Admin',
      manager: 'Manager',
      store_admin: 'Store Admin',
      call_admin: 'Call Admin',
      technician: 'Technician',
    };

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = ['Name', 'Email', 'Role', 'Store', 'Status', 'Created'].join(',');
    const rows = result.users.map((u) =>
      [
        escape(u.name),
        escape(u.email),
        escape(ROLE_LABELS[u.role] ?? u.role),
        escape(u.storeName ?? ''),
        escape(u.disabled ? 'Disabled' : 'Active'),
        escape(u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : ''),
      ].join(','),
    );

    const csv = [headers, ...rows].join('\n');
    return { success: true, csv };
  } catch (error: any) {
    console.error('Error exporting users:', error);
    return { success: false, error: error.message || 'Failed to export users' };
  }
}

export async function getUserDetailAction(uid: string): Promise<{ success: boolean; user?: UserRecordSummary & { isProtected?: boolean }; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'manager')) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const [authUser, profileDoc] = await Promise.all([adminAuth.getUser(uid), adminDb.collection('users').doc(uid).get()]);

    const profile = profileDoc.data() ?? {};
    const user: UserRecordSummary & { isProtected?: boolean } = {
      uid: authUser.uid,
      email: authUser.email || profile.email || '',
      name: profile.name || authUser.displayName || '',
      role: (profile.role || 'technician') as UserRole,
      storeId: profile.storeId ?? null,
      storeName: profile.storeName,
      disabled: Boolean(profile.disabled ?? authUser.disabled ?? false),
      isProtected: Boolean(profile.isProtected),
      internalPayRate: typeof profile.internalPayRate === 'number' ? profile.internalPayRate : undefined,
      chargeoutRate: typeof profile.chargeoutRate === 'number' ? profile.chargeoutRate : undefined,
      createdAt: authUser.metadata.creationTime ? Date.parse(authUser.metadata.creationTime) : undefined,
      lastSignInTime: authUser.metadata.lastSignInTime ? Date.parse(authUser.metadata.lastSignInTime) : undefined,
    };
    return { success: true, user };
  } catch (error: any) {
    console.error('Error fetching user detail:', error);
    return { success: false, error: error.message || 'User not found' };
  }
}
