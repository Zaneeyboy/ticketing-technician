'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ user: null, firebaseUser: null, loading: true });

  /**
   * Fetch the Firestore user profile and return the resolved User, null (deny access),
   * or 'skip' on transient network errors (stay in loading state instead of kicking out).
   */
  const resolveUserDoc = useCallback(async (fbUser: FirebaseUser): Promise<User | null | 'skip'> => {
    try {
      const snap = await getDoc(doc(db, 'users', fbUser.uid));
      if (!snap.exists()) {
        console.warn('User document not found in Firestore');
        return null;
      }
      const data = snap.data();
      const disabled = Boolean(data.disabled);
      if (disabled) {
        await signOut(auth);
        return null;
      }
      return {
        uid: fbUser.uid,
        email: fbUser.email || '',
        name: data.name || '',
        role: data.role || 'technician',
        storeId: data.storeId ?? null,
        storeName: data.storeName || undefined,
        disabled,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
      };
    } catch (error: any) {
      if (error?.code === 'unavailable' || error?.code === 'unauthenticated') {
        console.debug('Firestore temporarily unavailable, will retry on next check');
        return 'skip';
      }
      console.error('Error fetching user data:', error);
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const fbUser = authState.firebaseUser;
    if (!fbUser) return;
    const result = await resolveUserDoc(fbUser);
    if (result !== 'skip') {
      setAuthState((prev) => ({ ...prev, user: result }));
    }
  }, [authState.firebaseUser, resolveUserDoc]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        // Single setState — one render, no intermediates
        setAuthState({ user: null, firebaseUser: null, loading: false });
        return;
      }
      const result = await resolveUserDoc(fbUser);
      if (result === 'skip') return; // transient error — leave loading:true, retry next auth tick
      // Single setState — one render that completes the whole auth sequence
      setAuthState({ user: result, firebaseUser: fbUser, loading: false });
    });

    return () => unsubscribe();
  }, [resolveUserDoc]);

  const contextValue = useMemo(() => ({ user: authState.user, firebaseUser: authState.firebaseUser, loading: authState.loading, refreshUser }), [authState, refreshUser]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
