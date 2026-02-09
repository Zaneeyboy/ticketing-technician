import { cookies } from 'next/headers';
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
export async function getSession() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    console.log('[getSession] Session cookie exists:', !!sessionCookie);

    if (!sessionCookie) {
      console.log('[getSession] No session cookie found');
      return null;
    }

    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    console.log('[getSession] Session verified for user:', decodedClaims.uid);
    return decodedClaims;
  } catch (error) {
    console.error('[getSession] Error verifying session:', error);
    return null;
  }
}

/**
 * Get the current user with their profile data
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await getSession();

    if (!session) {
      console.log('[getCurrentUser] No session found');
      return null;
    }

    console.log('[getCurrentUser] Session found for uid:', session.uid);

    const userDoc = await adminDb.collection('users').doc(session.uid).get();

    if (!userDoc.exists) {
      console.log('[getCurrentUser] User document does not exist for uid:', session.uid);
      return null;
    }

    const userData = userDoc.data();
    console.log('[getCurrentUser] User data:', { uid: session.uid, email: userData?.email, role: userData?.role, disabled: userData?.disabled });

    if (userData?.disabled) {
      console.log('[getCurrentUser] User is disabled');
      return null;
    }

    return {
      uid: session.uid,
      email: session.email || '',
      name: userData?.name || '',
      role: userData?.role || 'technician',
      disabled: userData?.disabled || false,
      createdAt: userData?.createdAt || new Date(),
      updatedAt: userData?.updatedAt || new Date(),
    } as User;
  } catch (error) {
    console.error('[getCurrentUser] Error getting current user:', error);
    return null;
  }
}

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
 * Destroy the current session
 */
export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
