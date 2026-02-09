import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAmnBXucFWTvHgxohiG7KPiIMd2fRDVkI0',
  authDomain: 'technician-ticketing.firebaseapp.com',
  projectId: 'technician-ticketing',
  storageBucket: 'technician-ticketing.firebasestorage.app',
  messagingSenderId: '1090277643501',
  appId: '1:1090277643501:web:7b6b6c2fbe159252f9a8e4',
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize services
export const auth = getAuth(app);
export const db = (() => {
  if (typeof window === 'undefined') {
    return getFirestore(app);
  }

  try {
    return initializeFirestore(app, {
      cache: persistentLocalCache({
        tabManager: persistentSingleTabManager(),
      }),
    } as any);
  } catch (error) {
    // Fallback if Firestore was already initialized in this session.
    return getFirestore(app);
  }
})();
export const storage = getStorage(app);
