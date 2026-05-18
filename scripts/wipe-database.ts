import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as readline from 'readline';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
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

const BATCH_SIZE = 500;

// Delete all documents in a flat collection (no subcollections)
async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = db.collection(collectionName);
  let deletedCount = 0;

  while (true) {
    const snapshot = await collectionRef.limit(BATCH_SIZE).get();
    if (snapshot.size === 0) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedCount += snapshot.size;
  }

  return deletedCount;
}

// Delete every store document AND all its subcollections using recursiveDelete
async function deleteStoresCollection(): Promise<number> {
  const storeDocs = await db.collection('stores').listDocuments();
  let count = 0;
  for (const storeRef of storeDocs) {
    await db.recursiveDelete(storeRef);
    count++;
  }
  return count;
}

// Delete ALL Firebase Auth users
async function deleteAllAuthUsers(): Promise<number> {
  let deletedCount = 0;
  let pageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const user of result.users) {
      await auth.deleteUser(user.uid);
      deletedCount++;
    }
    pageToken = result.pageToken;
  } while (pageToken);

  return deletedCount;
}

// Prompt user for confirmation
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function wipeDatabase() {
  console.log('\n⚠️  WARNING: FULL DATABASE WIPE ⚠️\n');
  console.log('This will DELETE ALL DATA including:');
  console.log('  • Firestore: stores (+ subcollections), users, tickets, customers, machines, parts');
  console.log('  • Firebase Auth: ALL user accounts');
  console.log('\nAfter this you must go to /signup to create a fresh Super Admin.\n');
  console.log('This operation CANNOT be undone!\n');

  const confirmed = await askConfirmation('Are you absolutely sure you want to continue?');
  if (!confirmed) {
    console.log('\n❌ Cancelled');
    process.exit(0);
  }

  console.log('\n🗑️  Wiping database...\n');

  // Flat collections (legacy single-tenant paths — safe to delete even if empty)
  const flatCollections = ['users', 'tickets', 'customers', 'machines', 'parts', 'machineWorkLogs'];
  for (const col of flatCollections) {
    const count = await deleteCollection(col);
    if (count > 0) console.log(`   ✓ Deleted ${count} docs from ${col}`);
  }

  // Stores + all subcollections (tickets, customers, machines, etc. nested under each store)
  const storeCount = await deleteStoresCollection();
  console.log(`   ✓ Deleted ${storeCount} store(s) and all their subcollections`);

  // Auth users — wipe everything so the DB and Auth are in sync
  console.log('\n   Deleting Firebase Auth users...');
  const authCount = await deleteAllAuthUsers();
  console.log(`   ✓ Deleted ${authCount} Auth user(s)`);

  console.log('\n✅ Wipe complete. Database and Auth are fully clean.');
  console.log('💡 Next step: visit /signup to bootstrap your Super Admin account.\n');
}

wipeDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Wipe failed:', err);
    process.exit(1);
  });
