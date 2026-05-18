/**
 * Multi-Tenant Migration Script
 * Caribbean Roasters Field Service Platform
 *
 * This script migrates the flat single-tenant Firestore structure to the
 * multi-store subcollection architecture defined in MULTI_STORE_BRIEF.md.
 *
 * BEFORE RUNNING:
 *   1. Take a Firestore backup (console.firebase.google.com → Firestore → Export)
 *   2. Run in a test project first to verify counts
 *   3. Schedule a maintenance window for production migration
 *
 * RUN WITH:
 *   npx ts-node --project tsconfig.json scripts/migrate-to-multitenant.ts
 *
 * SAFETY: This script is READ-FIRST. It copies data to subcollections WITHOUT
 * deleting originals. After manual verification of counts, run with --delete flag:
 *   npx ts-node scripts/migrate-to-multitenant.ts --delete
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

const HQ_STORE_ID = 'cr-hq-001';
const FLAT_COLLECTIONS = ['tickets', 'customers', 'machines', 'parts', 'machineWorkLogs'] as const;
const SHOULD_DELETE = process.argv.includes('--delete');
const DRY_RUN = process.argv.includes('--dry-run');

// Firestore max batch size
const BATCH_SIZE = 400;

async function log(msg: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

async function step1_createHQStore() {
  log('=== STEP 1: Create HQ Store Document ===');

  const storeRef = db.collection('stores').doc(HQ_STORE_ID);
  const existing = await storeRef.get();

  if (existing.exists) {
    log(`  Store document ${HQ_STORE_ID} already exists — skipping creation.`);
    return;
  }

  if (DRY_RUN) {
    log(`  [DRY RUN] Would create /stores/${HQ_STORE_ID}`);
    return;
  }

  await storeRef.set({
    name: 'Caribbean Roasters HQ',
    island: 'Trinidad',
    address: '',
    contactEmail: '',
    contactPhone: '',
    type: 'hq',
    status: 'active',
    modules: {
      tickets: true,
      customers: true,
      machines: true,
      parts: true,
      reports: true,
    },
    settings: {
      timezone: 'America/Port_of_Spain',
      currency: 'TTD',
      locale: 'en-TT',
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  log(`  ✓ Created /stores/${HQ_STORE_ID}`);
}

async function step2_copyCollections() {
  log('=== STEP 2: Copy Flat Collections to Store Subcollections ===');

  for (const colName of FLAT_COLLECTIONS) {
    log(`  Processing: ${colName}`);

    const sourceSnap = await db.collection(colName).get();
    log(`    Found ${sourceSnap.size} documents in flat /${colName}`);

    if (sourceSnap.empty) {
      log(`    Skipping — collection is empty.`);
      continue;
    }

    // Check how many already exist in target subcollection
    const targetSnap = await db.collection('stores').doc(HQ_STORE_ID).collection(colName).get();
    log(`    Already migrated: ${targetSnap.size} documents in /stores/${HQ_STORE_ID}/${colName}`);

    // Build set of already-migrated IDs to avoid duplicating
    const alreadyMigratedIds = new Set(targetSnap.docs.map((d) => d.id));
    const toMigrate = sourceSnap.docs.filter((d) => !alreadyMigratedIds.has(d.id));
    log(`    To migrate: ${toMigrate.length} new documents`);

    if (toMigrate.length === 0) {
      log(`    ✓ Already up to date.`);
      continue;
    }

    if (DRY_RUN) {
      log(`    [DRY RUN] Would copy ${toMigrate.length} documents.`);
      continue;
    }

    // Write in batches of BATCH_SIZE
    let written = 0;
    for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
      const chunk = toMigrate.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach((doc) => {
        const targetRef = db.collection('stores').doc(HQ_STORE_ID).collection(colName).doc(doc.id);
        batch.set(targetRef, doc.data());
      });
      await batch.commit();
      written += chunk.length;
      log(`    Wrote batch: ${written}/${toMigrate.length}`);
    }

    log(`    ✓ Migrated ${written} documents to /stores/${HQ_STORE_ID}/${colName}`);
  }
}

async function step3_migrateUsers() {
  log('=== STEP 3: Update User Documents (roles + storeId) ===');

  const usersSnap = await db.collection('users').get();
  log(`  Found ${usersSnap.size} user documents`);

  const roleMapping: Record<string, string> = {
    admin: 'store_admin',
    management: 'super_admin',
    call_admin: 'call_admin',
    technician: 'technician',
    // Already-migrated roles pass through unchanged
    store_admin: 'store_admin',
    super_admin: 'super_admin',
  };

  let updated = 0;
  let skipped = 0;

  const toUpdate: { id: string; newRole: string; newStoreId: string | null; currentRole: string; currentStoreId: string | undefined }[] = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const currentRole = data.role || '';
    const currentStoreId = data.storeId;

    const newRole = roleMapping[currentRole] || currentRole;
    const newStoreId = newRole === 'super_admin' ? null : currentStoreId || HQ_STORE_ID;

    // Skip if already migrated
    if (data.role === newRole && data.storeId === newStoreId) {
      skipped++;
      continue;
    }

    toUpdate.push({ id: doc.id, newRole, newStoreId, currentRole, currentStoreId });
  }

  log(`  To update: ${toUpdate.length} users, already correct: ${skipped} users`);

  for (const u of toUpdate) {
    log(`    ${u.id}: role ${u.currentRole} → ${u.newRole}, storeId: ${u.currentStoreId ?? 'none'} → ${u.newStoreId ?? 'null'}`);
  }

  if (DRY_RUN) {
    log(`  [DRY RUN] No changes written.`);
    return;
  }

  if (toUpdate.length === 0) {
    log(`  ✓ All users already up to date.`);
    return;
  }

  // Update in batches
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((u) => {
      batch.update(db.collection('users').doc(u.id), {
        role: u.newRole,
        storeId: u.newStoreId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    updated += chunk.length;
    log(`  Wrote batch: ${updated}/${toUpdate.length} users updated`);
  }

  log(`  ✓ Updated ${updated} users.`);
}

async function step4_verify() {
  log('=== STEP 4: Verification — Count Comparison ===');

  for (const colName of FLAT_COLLECTIONS) {
    const flatSnap = await db.collection(colName).get();
    const storeSnap = await db.collection('stores').doc(HQ_STORE_ID).collection(colName).get();

    const match = flatSnap.size === storeSnap.size ? '✓ MATCH' : '✗ MISMATCH';
    log(`  ${colName}: flat=${flatSnap.size}, store=${storeSnap.size} — ${match}`);
  }

  const usersSnap = await db.collection('users').get();
  const storeAdminCount = usersSnap.docs.filter((d) => d.data().role === 'store_admin').length;
  const superAdminCount = usersSnap.docs.filter((d) => d.data().role === 'super_admin').length;
  const callAdminCount = usersSnap.docs.filter((d) => d.data().role === 'call_admin').length;
  const technicianCount = usersSnap.docs.filter((d) => d.data().role === 'technician').length;
  const unknownRole = usersSnap.docs.filter((d) => !['store_admin', 'super_admin', 'call_admin', 'technician'].includes(d.data().role)).length;

  log(`  Users: total=${usersSnap.size} (store_admin=${storeAdminCount}, super_admin=${superAdminCount}, call_admin=${callAdminCount}, technician=${technicianCount}, unknown=${unknownRole})`);

  if (unknownRole > 0) {
    log('  ⚠ Some users have unrecognised roles — check them manually before proceeding.');
    usersSnap.docs.filter((d) => !['store_admin', 'super_admin', 'call_admin', 'technician'].includes(d.data().role)).forEach((d) => log(`    uid=${d.id} role=${d.data().role}`));
  }
}

async function step5_deleteOriginals() {
  if (!SHOULD_DELETE) {
    log('=== STEP 5: Delete Original Flat Collections — SKIPPED ===');
    log('  Re-run with --delete flag after verifying counts above.');
    return;
  }

  log('=== STEP 5: Delete Original Flat Collections ===');
  log('  ⚠  THIS IS DESTRUCTIVE — ensure Step 4 shows MATCH for all collections.');

  for (const colName of FLAT_COLLECTIONS) {
    const flatSnap = await db.collection(colName).get();
    const storeSnap = await db.collection('stores').doc(HQ_STORE_ID).collection(colName).get();

    if (flatSnap.size !== storeSnap.size) {
      log(`  ✗ Skipping delete of /${colName} — count mismatch (flat=${flatSnap.size}, store=${storeSnap.size}). Fix this first.`);
      continue;
    }

    log(`  Deleting ${flatSnap.size} documents from /${colName} …`);
    for (let i = 0; i < flatSnap.docs.length; i += BATCH_SIZE) {
      const chunk = flatSnap.docs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    log(`  ✓ Deleted /${colName}`);
  }
}

async function main() {
  log('Caribbean Roasters — Multi-Tenant Migration');
  log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : SHOULD_DELETE ? 'LIVE + DELETE originals' : 'LIVE (no delete)'}`);
  log(`Target HQ Store ID: ${HQ_STORE_ID}`);
  log('');

  try {
    await step1_createHQStore();
    log('');
    await step2_copyCollections();
    log('');
    await step3_migrateUsers();
    log('');
    await step4_verify();
    log('');
    await step5_deleteOriginals();
    log('');
    log('=== Migration Complete ===');
  } catch (err: any) {
    console.error('[ERROR]', err.message, err);
    process.exit(1);
  }
}

main();
