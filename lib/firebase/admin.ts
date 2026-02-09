import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;

// Initialize Firebase Admin SDK only if credentials are available
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  console.log('[Firebase Admin] Initializing with credentials...');
  if (!getApps().length) {
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('[Firebase Admin] ✓ Initialized successfully');
  } else {
    adminApp = getApps()[0];
    console.log('[Firebase Admin] ✓ Using existing app');
  }
} else {
  console.error('[Firebase Admin] ✗ Missing environment variables! Using dummy implementation.');
  console.error('[Firebase Admin] Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
}

// Dummy implementations if admin SDK isn't initialized
const dummyAuth = {
  verifySessionCookie: async () => null,
  createSessionCookie: async () => '',
  getUser: async () => null,
} as any;

const dummyDb = {
  collection: () => ({
    doc: () => ({
      get: async () => ({ exists: false, data: () => null }),
      update: async () => {},
      delete: async () => {},
    }),
    add: async () => ({ id: '' }),
    get: async () => ({ empty: true, docs: [], size: 0 }),
    where: () => ({
      where: () => ({ get: async () => ({ empty: true, docs: [], size: 0 }) }),
      get: async () => ({ empty: true, docs: [], size: 0 }),
    }),
  }),
} as any;

export const adminAuth = adminApp ? getAuth(adminApp) : dummyAuth;
export const adminDb = adminApp ? getFirestore(adminApp) : dummyDb;
