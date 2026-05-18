import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

async function main() {
  const email = 'admin@caribbeanroasters.com';
  const password = 'Admin1234!';
  const name = 'Platform Admin';

  const user = await auth.createUser({ email, password, displayName: name });
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    email,
    name,
    role: 'super_admin',
    storeId: null,
    disabled: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Super Admin created');
  console.log('   Email:   ', email);
  console.log('   Password:', password);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Failed:', e.message);
    process.exit(1);
  });
