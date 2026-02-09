'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (firebaseUser: FirebaseUser) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const disabled = Boolean(userData.disabled);
        if (disabled) {
          await signOut(auth);
          setUser(null);
          return;
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: userData.name || '',
          role: userData.role || 'technician',
          disabled,
          createdAt: userData.createdAt || new Date(),
          updatedAt: userData.updatedAt || new Date(),
        });
      } else {
        // User authenticated but no profile in Firestore - deny access
        console.warn('User document not found in Firestore');
        setUser(null);
      }
    } catch (error: any) {
      // Handle offline and connectivity errors gracefully
      if (error?.code === 'unavailable' || error?.code === 'unauthenticated') {
        console.debug('Firestore temporarily unavailable, will retry on next check');
        // Don't set user to null on temporary errors - let them try to access
        return;
      }
      console.error('Error fetching user data:', error);
      // Firestore error - deny access
      setUser(null);
    }
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      await fetchUserData(firebaseUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setFirebaseUser(firebaseUser);

        if (firebaseUser) {
          await fetchUserData(firebaseUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, firebaseUser, loading, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
