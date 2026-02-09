import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Admin email to preserve
const ADMIN_EMAIL = 'zanemohd2025@gmail.com';

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

async function wipeUsers() {
  console.log('\n⚠️  WARNING: This script will DELETE all data from Firestore except the admin user!');
  console.log(`📧 Admin email to preserve: ${ADMIN_EMAIL}\n`);

  // Get confirmation from command line
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  if (!force) {
    console.log('❌ This is a destructive operation. Run with --force flag to proceed.');
    console.log('Example: ts-node scripts/wipe-users.ts --force\n');
    process.exit(0);
  }

  try {
    // Step 1: Get the admin user from Firestore to verify they exist
    console.log('🔍 Finding admin user...');
    const usersSnapshot = await db.collection('users').where('email', '==', ADMIN_EMAIL).get();

    if (usersSnapshot.empty) {
      console.error('❌ Admin user not found with email:', ADMIN_EMAIL);
      process.exit(1);
    }

    const adminUser = usersSnapshot.docs[0];
    const adminUid = adminUser.id;
    console.log(`✅ Found admin user: ${adminUser.data().name} (${adminUid})\n`);

    // Step 2: Delete all non-admin users from Firestore
    console.log('🗑️  Deleting non-admin users from Firestore...');
    const allUsersSnapshot = await db.collection('users').get();
    let deletedCount = 0;

    const batch = db.batch();
    allUsersSnapshot.docs.forEach((doc) => {
      if (doc.id !== adminUid) {
        console.log(`   - Deleting user: ${doc.data().name} (${doc.id})`);
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`✅ Deleted ${deletedCount} users from Firestore\n`);
    } else {
      console.log('✅ No non-admin users to delete from Firestore\n');
    }

    // Step 3: Delete all tickets
    console.log('🎫 Deleting all tickets...');
    const ticketsSnapshot = await db.collection('tickets').get();
    const ticketsDeleted = ticketsSnapshot.size;
    if (!ticketsSnapshot.empty) {
      const ticketBatch = db.batch();
      ticketsSnapshot.docs.forEach((doc) => {
        ticketBatch.delete(doc.ref);
      });
      await ticketBatch.commit();
      console.log(`✅ Deleted ${ticketsDeleted} tickets\n`);
    } else {
      console.log('✅ No tickets to delete\n');
    }

    // Step 4: Delete all machine work logs
    console.log('📝 Deleting all machine work logs...');
    const workLogsSnapshot = await db.collection('machineWorkLogs').get();
    const workLogsDeleted = workLogsSnapshot.size;
    if (!workLogsSnapshot.empty) {
      const workLogsBatch = db.batch();
      workLogsSnapshot.docs.forEach((doc) => {
        workLogsBatch.delete(doc.ref);
      });
      await workLogsBatch.commit();
      console.log(`✅ Deleted ${workLogsDeleted} work logs\n`);
    } else {
      console.log('✅ No work logs to delete\n');
    }

    // Step 5: Delete all customers
    console.log('👥 Deleting all customers...');
    const customersSnapshot = await db.collection('customers').get();
    const customersDeleted = customersSnapshot.size;
    if (!customersSnapshot.empty) {
      const customersBatch = db.batch();
      customersSnapshot.docs.forEach((doc) => {
        customersBatch.delete(doc.ref);
      });
      await customersBatch.commit();
      console.log(`✅ Deleted ${customersDeleted} customers\n`);
    } else {
      console.log('✅ No customers to delete\n');
    }

    // Step 6: Delete all machines
    console.log('⚙️  Deleting all machines...');
    const machinesSnapshot = await db.collection('machines').get();
    const machinesDeleted = machinesSnapshot.size;
    if (!machinesSnapshot.empty) {
      const machinesBatch = db.batch();
      machinesSnapshot.docs.forEach((doc) => {
        machinesBatch.delete(doc.ref);
      });
      await machinesBatch.commit();
      console.log(`✅ Deleted ${machinesDeleted} machines\n`);
    } else {
      console.log('✅ No machines to delete\n');
    }

    // Step 7: Delete all parts
    console.log('🔧 Deleting all parts...');
    const partsSnapshot = await db.collection('parts').get();
    const partsDeleted = partsSnapshot.size;
    if (!partsSnapshot.empty) {
      const partsBatch = db.batch();
      partsSnapshot.docs.forEach((doc) => {
        partsBatch.delete(doc.ref);
      });
      await partsBatch.commit();
      console.log(`✅ Deleted ${partsDeleted} parts\n`);
    } else {
      console.log('✅ No parts to delete\n');
    }

    // Step 8: Delete all non-admin users from Firebase Authentication
    console.log('🔐 Deleting non-admin users from Firebase Authentication...');
    let authDeletedCount = 0;

    try {
      let pageToken: string | undefined = undefined;
      do {
        const result = await auth.listUsers(1000, pageToken);

        for (const userRecord of result.users) {
          if (userRecord.email !== ADMIN_EMAIL) {
            console.log(`   - Deleting auth user: ${userRecord.email} (${userRecord.uid})`);
            await auth.deleteUser(userRecord.uid);
            authDeletedCount++;
          }
        }

        pageToken = result.pageToken;
      } while (pageToken);

      console.log(`✅ Deleted ${authDeletedCount} users from Firebase Authentication\n`);
    } catch (error) {
      console.error('❌ Error deleting auth users:', error);
      process.exit(1);
    }

    // Step 9: Verify admin user is still present
    console.log('✅ Verifying admin account is intact...');
    const adminCheckSnapshot = await db.collection('users').doc(adminUid).get();

    if (adminCheckSnapshot.exists) {
      console.log(`✅ Admin account verified: ${adminCheckSnapshot.data()?.name}\n`);
    } else {
      console.error('❌ Admin account was deleted unexpectedly!');
      process.exit(1);
    }

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('✅ DATABASE WIPE COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   • Users deleted from Firestore: ${deletedCount}`);
    console.log(`   • Users deleted from Auth: ${authDeletedCount}`);
    console.log(`   • Tickets deleted: ${ticketsDeleted}`);
    console.log(`   • Work logs deleted: ${workLogsDeleted}`);
    console.log(`   • Customers deleted: ${customersDeleted}`);
    console.log(`   • Machines deleted: ${machinesDeleted}`);
    console.log(`   • Parts deleted: ${partsDeleted}`);
    console.log(`   • Admin account preserved: ${ADMIN_EMAIL}`);
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during wipe operation:', error);
    process.exit(1);
  }
}

wipeUsers();
