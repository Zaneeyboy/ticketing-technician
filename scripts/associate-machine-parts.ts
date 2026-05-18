/**
 * associate-machine-parts.ts
 *
 * Finds all machines in every store and pre-associates the standard parts
 * for each machine type. Safe to run multiple times (won't duplicate parts
 * that are already linked).
 *
 * Usage: npx tsx scripts/associate-machine-parts.ts
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

// ── Part name → machine types that use it ───────────────────────────────────
// Keyed by the exact part name stored in Firestore.
const MACHINE_TYPE_PARTS: Record<string, string[]> = {
  'iPilot Machine':              ['iPilot Cleaning Tablet', 'Solenoid Valve 3-way', 'NTC Temperature Probe'],
  'EGRO Machine':                ['EGRO Brew Group Seal', 'EGRO Water Pump', 'EGRO Bean Hopper', 'iPilot Cleaning Tablet'],
  'Crescendo Machine':           ['Crescendo Brew Unit', 'NTC Temperature Probe', 'Boiler Heating Element'],
  'Rancilio Espresso Machine':   ['Rancilio Portafilter Gasket', 'Solenoid Valve 3-way', 'Boiler Heating Element', 'Steam Wand Tip'],
  'Silvia Espresso Machine':     ['Rancilio Portafilter Gasket', 'Steam Wand Tip', 'Boiler Heating Element', 'NTC Temperature Probe'],
  'Samremo Grinder':             ['Samremo Burr Set'],
  'BUNN Grinder':                ['BUNN Burr Set'],
  'BUNN Kyro Grinder':           ['BUNN Kyro Burr Set'],
  'Smartwave Brewer Machine':    ['Water Filter Cartridge'],
  'Brewer Machine':              ['Water Filter Cartridge'],
  'BUNN Server':                 ['BUNN Server Carafe'],
  'Nitron RMV':                  ['Nitro Keg Coupler'],
  'Water Machine':               ['Water Filter Cartridge', 'Water Machine Membrane'],
  'Barista Tools':               ['O-Ring Kit (Assorted)'],
};

async function run() {
  console.log('\n🔧 Associating standard parts with machines...\n');

  const storesSnap = await db.collection('stores').get();
  let totalUpdated = 0;

  for (const storeDoc of storesSnap.docs) {
    const storeId = storeDoc.id;
    const storeName = storeDoc.data().name ?? storeId;
    console.log(`  Store: ${storeName}`);

    // Build a name → {id, name} map from this store's parts
    const partsSnap = await db.collection('stores').doc(storeId).collection('parts').get();
    const partsByName = new Map<string, { id: string; name: string }>();
    partsSnap.docs.forEach((d) => {
      const name: string = d.data().name ?? '';
      if (name) partsByName.set(name.toLowerCase(), { id: d.id, name });
    });

    // Fetch all machines in the store
    const machinesSnap = await db.collection('stores').doc(storeId).collection('machines').get();

    for (const machineDoc of machinesSnap.docs) {
      const data = machineDoc.data();
      const machineType: string = data.type ?? '';
      const standardPartNames: string[] = MACHINE_TYPE_PARTS[machineType] ?? [];

      if (standardPartNames.length === 0) continue;

      const existing: Array<{ partId?: string; partName: string; addedAt: any }> =
        Array.isArray(data.associatedParts) ? data.associatedParts : [];

      let changed = false;
      const updated = [...existing];

      for (const partName of standardPartNames) {
        const partDoc = partsByName.get(partName.toLowerCase());
        if (!partDoc) continue; // part not stocked in this store

        const alreadyLinked = updated.some(
          (e) => (partDoc.id && e.partId === partDoc.id) || e.partName.toLowerCase() === partName.toLowerCase(),
        );

        if (!alreadyLinked) {
          updated.push({ partId: partDoc.id, partName: partDoc.name, addedAt: Timestamp.now() });
          changed = true;
        }
      }

      if (changed) {
        await machineDoc.ref.update({ associatedParts: updated, updatedAt: Timestamp.now() });
        console.log(`    ✓ ${machineType} [${data.serialNumber}] → ${updated.length} parts`);
        totalUpdated++;
      }
    }
  }

  console.log(`\n✅ Done — updated ${totalUpdated} machine(s).\n`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
