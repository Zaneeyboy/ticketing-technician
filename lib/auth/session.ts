import { cookies } from 'next/headers';
import { cache } from 'react';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { User, UserRole } from '@/lib/types';

const SESSION_COOKIE_NAME = 'session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 5, // 5 days
  path: '/',
};

/**
 * Create a session cookie from an ID token
 */
export async function createSession(idToken: string) {
  try {
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    (await cookies()).set(SESSION_COOKIE_NAME, sessionCookie, SESSION_COOKIE_OPTIONS);

    return { success: true };
  } catch (error) {
    console.error('Error creating session:', error);
    return { success: false, error: 'Failed to create session' };
  }
}

/**
 * Get the current user's session
 */
async function getSession() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) return null;

    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decodedClaims;
  } catch {
    return null;
  }
}

/**
 * Get the current user with their profile data.
 * Wrapped with React cache() so multiple calls within the same request
 * (e.g. layout + page) only hit Firestore once.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const session = await getSession();
    if (!session) return null;

    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    if (userData?.disabled) return null;

    // If this user belongs to a store, ensure the store is not disabled
    if (userData?.storeId) {
      const storeDoc = await adminDb.collection('stores').doc(userData.storeId).get();
      if (storeDoc.exists && storeDoc.data()?.status === 'inactive') {
        return null; // Store is disabled — block all access; layout redirects to /login
      }
    }

    return {
      uid: session.uid,
      email: session.email || '',
      name: userData?.name || '',
      role: userData?.role || 'technician',
      storeId: userData?.storeId ?? null,
      storeName: userData?.storeName || undefined,
      disabled: userData?.disabled || false,
      createdAt: userData?.createdAt?.toDate?.() ?? new Date(),
      updatedAt: userData?.updatedAt?.toDate?.() ?? new Date(),
    } as User;
  } catch (error) {
    console.error('[getCurrentUser] Error:', error);
    return null;
  }
});

/**
 * Check if user has required role
 */
export async function requireRole(roles: UserRole[]): Promise<User | null> {
  const user = await getCurrentUser();

  if (!user || !roles.includes(user.role)) {
    return null;
  }

  return user;
}

/**
 * Check if the current user can manage store-level resources.
 * super_admin can manage any store; store_admin manages their own store.
 */
export async function requireStoreAccess(storeId: string): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === 'super_admin') return user;
  if (user.storeId === storeId) return user;
  return null;
}

/**
 * Destroy the current session
 */
export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
