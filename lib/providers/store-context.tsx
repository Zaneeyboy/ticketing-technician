'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Store } from '@/lib/types';

interface StoreContextValue {
  storeId: string | null;
  store: Store | null;
  isPlatformAdmin: boolean; // true for super_admin and manager (no store assignment)
  selectedStoreId: string | null;
  selectedStore: Store | null;
  setSelectedStore: (id: string | null) => void;
  effectiveStoreId: string | null; // selectedStoreId when drilling in, else storeId
}

const StoreContext = createContext<StoreContextValue>({
  storeId: null,
  store: null,
  isPlatformAdmin: false,
  selectedStoreId: null,
  selectedStore: null,
  setSelectedStore: () => {},
  effectiveStoreId: null,
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedStore, setSelectedStoreData] = useState<Store | null>(null);

  const isPlatformAdmin = user?.role === 'super_admin' || user?.role === 'manager';
  const storeId = user?.storeId ?? null;

  // Fetch the user's own store
  useEffect(() => {
    if (!storeId) {
      setStore(null);
      return;
    }

    getDoc(doc(db, 'stores', storeId))
      .then((snap) => {
        if (snap.exists()) {
          setStore({ id: snap.id, ...snap.data() } as Store);
        }
      })
      .catch(console.error);
  }, [storeId]);

  // Fetch the selected store when HQ drills in
  useEffect(() => {
    if (!selectedStoreId) {
      setSelectedStoreData(null);
      return;
    }

    getDoc(doc(db, 'stores', selectedStoreId))
      .then((snap) => {
        if (snap.exists()) {
          setSelectedStoreData({ id: snap.id, ...snap.data() } as Store);
        }
      })
      .catch(console.error);
  }, [selectedStoreId]);

  const handleSetSelectedStore = useCallback((id: string | null) => {
    setSelectedStoreId(id);
  }, []);

  const effectiveStoreId = isPlatformAdmin ? selectedStoreId : storeId;

  const contextValue = useMemo(
    () => ({
      storeId,
      store,
      isPlatformAdmin,
      selectedStoreId,
      selectedStore,
      setSelectedStore: handleSetSelectedStore,
      effectiveStoreId,
    }),
    [storeId, store, isPlatformAdmin, selectedStoreId, selectedStore, handleSetSelectedStore, effectiveStoreId],
  );

  return <StoreContext.Provider value={contextValue}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
