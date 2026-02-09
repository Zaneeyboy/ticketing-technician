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

// Helper function to delete all documents in a collection
async function deleteCollection(collectionName: string) {
  const collectionRef = db.collection(collectionName);
  const query = collectionRef.limit(BATCH_SIZE);

  return new Promise<number>((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject, 0);
  });
}

async function deleteQueryBatch(query: FirebaseFirestore.Query, resolve: (count: number) => void, reject: (error: any) => void, deletedCount: number) {
  try {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
      resolve(deletedCount);
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    const newDeletedCount = deletedCount + snapshot.size;

    // Recurse on the next process tick to avoid exploding the stack
    process.nextTick(() => {
      deleteQueryBatch(query, resolve, reject, newDeletedCount);
    });
  } catch (error) {
    reject(error);
  }
}

// Helper function to delete all users from Firebase Auth
async function deleteAllUsers() {
  let deletedCount = 0;
  let pageToken: string | undefined;

  try {
    do {
      const listUsersResult = await auth.listUsers(1000, pageToken);

      // Filter out users to keep (admin users and zanemohd2025 account)
      const usersToDelete = listUsersResult.users.filter(
        (user) =>
          !user.email?.includes('admin@') && // Keep admin users
          !user.email?.startsWith('zanemohd2025'), // Keep zanemohd2025 account
      );

      // Delete users in batches
      for (const user of usersToDelete) {
        await auth.deleteUser(user.uid);
        deletedCount++;
      }

      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    return deletedCount;
  } catch (error) {
    console.error('Error deleting users:', error);
    throw error;
  }
}

// Prompt user for confirmation
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function wipeDatabaseAndUsers() {
  try {
    console.log('\n⚠️  WARNING: DATABASE WIPE OPERATION ⚠️\n');
    console.log('This will DELETE ALL DATA from:');
    console.log('  - Firestore collections (tickets, customers, machines, parts, machineWorkLogs)');
    console.log('  - Firebase Authentication users (except admin users and zanemohd2025 account)');
    console.log('\nThis operation CANNOT be undone!\n');

    const confirmed = await askConfirmation('Are you absolutely sure you want to continue?');

    if (!confirmed) {
      console.log('\n❌ Operation cancelled by user');
      process.exit(0);
    }

    console.log('\n🗑️  Starting database wipe...\n');

    // Collections to delete
    const collections = ['tickets', 'customers', 'machines', 'parts', 'machineWorkLogs', 'users'];

    // Delete Firestore collections
    for (const collection of collections) {
      console.log(`   Deleting ${collection} collection...`);
      const count = await deleteCollection(collection);
      console.log(`   ✓ Deleted ${count} documents from ${collection}`);
    }

    // Delete Firebase Auth users
    console.log('\n   Deleting Firebase Auth users...');
    const userCount = await deleteAllUsers();
    console.log(`   ✓ Deleted ${userCount} users from Firebase Auth`);

    console.log('\n✅ Database wipe completed successfully!\n');
    console.log('💡 Next steps:');
    console.log('   Run: npm run seed\n');
  } catch (error) {
    console.error('\n❌ Error wiping database:', error);
    throw error;
  }
}

// Run the wipe function
wipeDatabaseAndUsers()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to wipe database:', error);
    process.exit(1);
  });
