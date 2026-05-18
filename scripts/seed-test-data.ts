/**
 * Multi-tenant seed script for Caribbean Roasters Field Service Platform.
 *
 * Creates ONE test store with full staff, customers, machines, parts, tickets,
 * and machine work logs â€” all under the correct multi-tenant Firestore paths.
 *
 * Prerequisites: Run /signup first to create the Super Admin account.
 * Usage: npm run seed
 */

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

// â”€â”€ Store definition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TEST_STORE = {
  name: 'Port of Spain - Test Store',
  island: 'Trinidad',
  address: '15 Frederick Street, Port of Spain',
  contactEmail: 'pos-store@caribbeanroasters.com',
  contactPhone: '1-868-222-0001',
  status: 'active' as const,
  modules: { tickets: true, customers: true, machines: true, parts: true, reports: true },
  settings: { timezone: 'America/Port_of_Spain', currency: 'TTD', locale: 'en-TT' },
};

const TEST_ADMIN = { name: 'Sandra Baptiste', email: 'sandra.baptiste@caribbeanroasters.com', password: 'Password123!' };

const TEST_TECHNICIANS = [
  { name: 'Marcus Williams', email: 'marcus.williams@caribbeanroasters.com', password: 'Password123!', internalPayRate: 35, chargeoutRate: 120 },
  { name: 'Priya Ramkhelawan', email: 'priya.ramkhelawan@caribbeanroasters.com', password: 'Password123!', internalPayRate: 38, chargeoutRate: 130 },
  { name: 'Derek Joseph', email: 'derek.joseph@caribbeanroasters.com', password: 'Password123!', internalPayRate: 32, chargeoutRate: 110 },
];

const TEST_CALL_ADMINS = [
  { name: 'Lisa Rampersad', email: 'lisa.rampersad@caribbeanroasters.com', password: 'Password123!' },
  { name: 'Andre Gonzales', email: 'andre.gonzales@caribbeanroasters.com', password: 'Password123!' },
];

// â”€â”€ Machine types (mirrors MACHINE_TYPES in lib/types/index.ts) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MACHINE_TYPES = [
  'iPilot Machine',
  'Brewer Machine',
  'Crescendo Machine',
  'Water Machine',
  'EGRO Machine',
  'Rancilio Espresso Machine',
  'Silvia Espresso Machine',
  'BUNN Grinder',
  'BUNN Kyro Grinder',
  'Samremo Grinder',
  'Nitron RMV',
  'BUNN Server',
  'Smartwave Brewer Machine',
  'Barista Tools',
] as const;

// â”€â”€ Customers and their machines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type MachineDef = { type: string; serial: string; location: string; notes: string };

const TEST_CUSTOMERS: Array<{
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  machines: MachineDef[];
}> = [
  {
    companyName: 'Rituals Coffee House - Independence Sq',
    contactPerson: 'Karen Chin',
    phone: '1-868-622-1001',
    email: 'karen@rituals-pos.com',
    address: '1 Independence Square, Port of Spain',
    machines: [
      { type: 'EGRO Machine', serial: 'EGR-2022-001', location: 'Main Bar', notes: 'Primary superautomatic â€” high volume' },
      { type: 'EGRO Machine', serial: 'EGR-2022-002', location: 'Express Counter', notes: 'Secondary superautomatic â€” busy periods' },
      { type: 'iPilot Machine', serial: 'IPL-2022-001', location: 'Main Bar', notes: 'Automated cleaning system for EGRO units' },
      { type: 'BUNN Grinder', serial: 'BGD-2022-001', location: 'Main Bar', notes: 'Paired with primary EGRO' },
      { type: 'BUNN Grinder', serial: 'BGD-2022-002', location: 'Express Counter', notes: 'Paired with secondary EGRO' },
      { type: 'Water Machine', serial: 'WTR-2022-001', location: 'Back Station', notes: 'Filtered water tower â€” feeds both machines' },
    ],
  },
  {
    companyName: 'Starbucks - Trincity Mall',
    contactPerson: 'David Ali',
    phone: '1-868-640-2002',
    email: 'david@starbucks-tml.com',
    address: 'Trincity Mall, Trincity',
    machines: [
      { type: 'Crescendo Machine', serial: 'CRS-2021-001', location: 'Main Counter', notes: 'Primary superautomatic â€” front of house' },
      { type: 'Crescendo Machine', serial: 'CRS-2021-002', location: 'Drive-Thru', notes: 'Drive-thru superautomatic' },
      { type: 'Rancilio Espresso Machine', serial: 'RAN-2021-001', location: 'Specialty Bar', notes: 'Manual espresso machine for specialty drinks' },
      { type: 'Samremo Grinder', serial: 'SMG-2021-001', location: 'Specialty Bar', notes: 'San Remo grinder for specialty bar' },
      { type: 'Smartwave Brewer Machine', serial: 'SWB-2021-001', location: 'Back of House', notes: 'Batch brewer for filter coffee' },
      { type: 'BUNN Server', serial: 'BNS-2021-001', location: 'Customer Counter', notes: 'Thermal server for brewed coffee' },
      { type: 'Water Machine', serial: 'WTR-2021-001', location: 'Customer Area', notes: 'Filtered water and ice station' },
    ],
  },
  {
    companyName: 'Cafe Mariposa',
    contactPerson: 'Camille Prescott',
    phone: '1-868-627-3003',
    email: 'camille@mariposa.tt',
    address: '45 Ariapita Avenue, Woodbrook',
    machines: [
      { type: 'Rancilio Espresso Machine', serial: 'RAN-2023-001', location: 'Bar Counter', notes: 'Main espresso machine' },
      { type: 'Silvia Espresso Machine', serial: 'SLV-2023-001', location: 'Bar Counter', notes: 'Backup â€” Rancilio Silvia' },
      { type: 'Samremo Grinder', serial: 'SMG-2023-001', location: 'Bar Counter', notes: 'San Remo grinder â€” house blend' },
      { type: 'BUNN Kyro Grinder', serial: 'BKG-2023-001', location: 'Brew Bar', notes: 'BUNN Kyro for filter grind' },
      { type: 'Brewer Machine', serial: 'BRW-2023-001', location: 'Brew Bar', notes: 'Pour-over assist brewer' },
      { type: 'Nitron RMV', serial: 'NIT-2023-001', location: 'Cold Bar', notes: 'Nitro cold brew dispensing system' },
    ],
  },
  {
    companyName: 'Bean and Brew Co.',
    contactPerson: 'Rajiv Maharaj',
    phone: '1-868-622-4004',
    email: 'rajiv@beanandbrew.tt',
    address: '8 Long Circular Rd, St. James',
    machines: [
      { type: 'EGRO Machine', serial: 'EGR-2020-001', location: 'Main Counter', notes: 'Flagship superautomatic' },
      { type: 'Rancilio Espresso Machine', serial: 'RAN-2020-001', location: 'Rear Counter', notes: 'Backup semi-auto espresso machine' },
      { type: 'BUNN Grinder', serial: 'BGD-2020-001', location: 'Main Counter', notes: 'Primary grinder â€” paired with EGRO' },
      { type: 'BUNN Kyro Grinder', serial: 'BKG-2020-001', location: 'Rear Counter', notes: 'Kyro grinder â€” paired with Rancilio' },
      { type: 'Nitron RMV', serial: 'NIT-2020-001', location: 'Cold Bar', notes: 'Cold brew keg system' },
      { type: 'Water Machine', serial: 'WTR-2020-001', location: 'Service Counter', notes: 'Hot and cold water tower' },
      { type: 'iPilot Machine', serial: 'IPL-2020-001', location: 'Main Counter', notes: 'iPilot automated maintenance unit' },
    ],
  },
  {
    companyName: 'The Coffee Lab TT',
    contactPerson: 'Simone Charles',
    phone: '1-868-627-5005',
    email: 'simone@coffeelab.tt',
    address: '22 Cipero Street, San Fernando',
    machines: [
      { type: 'Crescendo Machine', serial: 'CRS-2023-001', location: 'Lab Counter', notes: 'Superautomatic for training demos' },
      { type: 'Silvia Espresso Machine', serial: 'SLV-2023-010', location: 'Lab Counter', notes: 'Rancilio Silvia â€” manual training machine' },
      { type: 'Rancilio Espresso Machine', serial: 'RAN-2023-010', location: 'Lab Counter', notes: 'Commercial Rancilio â€” advanced training' },
      { type: 'Samremo Grinder', serial: 'SMG-2023-010', location: 'Lab Counter', notes: 'Precision grinder â€” lab use' },
      { type: 'BUNN Kyro Grinder', serial: 'BKG-2023-010', location: 'Cupping Station', notes: 'Cupping and filter grinder' },
      { type: 'Smartwave Brewer Machine', serial: 'SWB-2023-001', location: 'Brew Station', notes: 'Smartwave batch brewer for training' },
      { type: 'Barista Tools', serial: 'BAR-2023-001', location: 'All Stations', notes: 'Calibrated tamper set, dosing rings, WDT tools' },
    ],
  },
];

// â”€â”€ Parts inventory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TEST_PARTS = [
  { name: 'EGRO Brew Group Seal', description: 'OEM brew group gasket for EGRO superautomatics', category: 'Gaskets and Seals', quantityInStock: 20, minQuantity: 5 },
  { name: 'EGRO Water Pump', description: '15-bar vibration pump for EGRO espresso machines', category: 'Pumps', quantityInStock: 6, minQuantity: 2 },
  { name: 'Rancilio Portafilter Gasket', description: 'Silicone group gasket for Rancilio machines', category: 'Gaskets and Seals', quantityInStock: 30, minQuantity: 8 },
  { name: 'BUNN Burr Set', description: 'Ceramic flat burr set for BUNN Grinder series', category: 'Grinder Parts', quantityInStock: 8, minQuantity: 3 },
  { name: 'BUNN Kyro Burr Set', description: 'Steel burr set for BUNN Kyro Grinder', category: 'Grinder Parts', quantityInStock: 6, minQuantity: 2 },
  { name: 'Samremo Burr Set', description: 'Precision burr set for San Remo grinder models', category: 'Grinder Parts', quantityInStock: 4, minQuantity: 2 },
  { name: 'Water Filter Cartridge', description: 'Universal scale-reduction filter cartridge', category: 'Filters', quantityInStock: 60, minQuantity: 15 },
  { name: 'Solenoid Valve 3-way', description: '3-way solenoid valve â€” espresso machine group head', category: 'Valves', quantityInStock: 12, minQuantity: 4 },
  { name: 'Boiler Heating Element', description: '1200W heating element for espresso machine boilers', category: 'Heating', quantityInStock: 10, minQuantity: 3 },
  { name: 'Pressure Gauge 0-15 bar', description: 'Analog pressure gauge for espresso machine', category: 'Gauges', quantityInStock: 18, minQuantity: 5 },
  { name: 'NTC Temperature Probe', description: 'Boiler NTC temperature sensor â€” fits most models', category: 'Sensors', quantityInStock: 14, minQuantity: 4 },
  { name: 'Steam Wand Tip', description: 'Stainless steam wand tip â€” single hole', category: 'Steam System', quantityInStock: 25, minQuantity: 8 },
  { name: 'EGRO Bean Hopper', description: 'Replacement bean hopper lid and collar for EGRO', category: 'EGRO Parts', quantityInStock: 5, minQuantity: 2 },
  { name: 'iPilot Cleaning Tablet', description: 'Branded cleaning tablet for iPilot automated cycle', category: 'Chemicals', quantityInStock: 200, minQuantity: 50 },
  { name: 'Crescendo Brew Unit', description: 'Complete brew unit assembly for Crescendo machines', category: 'Brew System', quantityInStock: 3, minQuantity: 1 },
  { name: 'BUNN Server Carafe', description: 'Stainless 1.9L thermal carafe for BUNN Server', category: 'Servers', quantityInStock: 10, minQuantity: 3 },
  { name: 'Nitro Keg Coupler', description: 'Keg coupler/connector for Nitron RMV system', category: 'Cold Brew Parts', quantityInStock: 6, minQuantity: 2 },
  { name: 'Water Machine Membrane', description: 'RO membrane cartridge for water tower machines', category: 'Filters', quantityInStock: 8, minQuantity: 2 },
  { name: 'Descaling Solution 1L', description: 'Citric acid descaler for espresso machines', category: 'Chemicals', quantityInStock: 40, minQuantity: 10 },
  { name: 'O-Ring Kit (Assorted)', description: 'Assorted O-ring kit for espresso machine servicing', category: 'Gaskets and Seals', quantityInStock: 50, minQuantity: 10 },
];

// â”€â”€ Ticket / work log helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ISSUE_DESCRIPTIONS = [
  'Machine not heating properly â€” customers reporting lukewarm coffee',
  'Steam wand producing weak pressure, poor milk texturing',
  'Grinder making grinding/rattling noise during operation',
  'Water leaking from bottom of machine â€” possible group seal',
  'Pressure gauge reading inconsistently â€” possible blockage',
  'Machine not powering on â€” complete electrical failure',
  'Coffee extraction too slow â€” suspected group head blockage',
  'Temperature fluctuating â€” NTC probe issue suspected',
  'Scheduled quarterly maintenance and deep cleaning',
  'Water filter replacement overdue â€” reduced flow rate observed',
  'Bean hopper jammed â€” grinder not dispensing',
  'Nitro system not dispensing â€” coupler or gas line issue',
  'Machine displaying error code â€” requires diagnostics',
  'Cleaning cycle failure on iPilot system',
];

const WORK_PERFORMED_SAMPLES = [
  'Replaced brew group seal and back-flushed group head. Calibrated extraction pressure.',
  'Descaled boiler and heat exchanger. Replaced water filter cartridge. Machine performing within spec.',
  'Replaced faulty NTC temperature probe. Recalibrated boiler temperature to 93Â°C.',
  'Cleaned and calibrated burr set. Adjusted grind size and dosage.',
  'Replaced 3-way solenoid valve. Tested at full pressure â€” no leaks.',
  'Replaced worn portafilter gasket. Lubricated group head cam. Full test pass.',
  'Full service: descale, group head service, steam wand tip replacement, filter change.',
  'Replaced vibration pump. Tested at 9 bar â€” extraction normal.',
  'Ran full iPilot automated cleaning cycle. Replaced cleaning tablets and checked nozzles.',
  'Replaced burr set. Re-calibrated grind time. Checked dosage uniformity.',
  'Replaced keg coupler on Nitron RMV. Tested nitro flow â€” normal.',
  'Replaced heating element. Full heat-up test performed â€” boiler reaching temp within spec.',
];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPastDate(maxDaysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * maxDaysAgo));
  date.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);
  return date;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function makeTicketNumber(index: number): string {
  const now = new Date();
  return 'TKT-' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(index).padStart(4, '0');
}

async function createAuthUser(email: string, password: string, displayName: string): Promise<string> {
  try {
    const record = await auth.createUser({ email, password, displayName });
    return record.uid;
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(email);
      console.log('      (Auth user already exists, reusing)');
      return existing.uid;
    }
    throw err;
  }
}

// â”€â”€ Main seed function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function seedTestData() {
  console.log('\n Seeding multi-tenant test data...\n');

  // Guard: require at least one super_admin to exist
  const adminSnap = await db.collection('users').where('role', '==', 'super_admin').limit(1).get();
  if (adminSnap.empty) {
    console.error('ERROR: No super_admin found. Visit /signup first to create the platform admin, then run: npm run seed');
    process.exit(1);
  }
  console.log('Super Admin account detected - proceeding\n');

  // 1. Create the test store
  console.log('Creating test store...');
  const storeRef = await db.collection('stores').add({
    ...TEST_STORE,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  const storeId = storeRef.id;
  console.log('   Store "' + TEST_STORE.name + '" created (' + storeId + ')\n');

  // 2. Seed machine types config for the store
  await db
    .collection('stores')
    .doc(storeId)
    .collection('config')
    .doc('machineTypes')
    .set({
      types: [...MACHINE_TYPES],
    });
  console.log('   Machine types config seeded (' + MACHINE_TYPES.length + ' types)\n');

  // 3. Create store admin
  console.log('Creating store admin...');
  const adminUid = await createAuthUser(TEST_ADMIN.email, TEST_ADMIN.password, TEST_ADMIN.name);
  await db.collection('users').doc(adminUid).set({
    uid: adminUid,
    email: TEST_ADMIN.email,
    name: TEST_ADMIN.name,
    role: 'store_admin',
    storeId: storeId,
    storeName: TEST_STORE.name,
    isProtected: true,
    disabled: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log('   Store Admin: ' + TEST_ADMIN.name + ' (' + TEST_ADMIN.email + ')\n');

  // 4. Create technicians
  console.log('Creating technicians...');
  const technicians: Array<{ uid: string; name: string }> = [];
  for (const tech of TEST_TECHNICIANS) {
    const uid = await createAuthUser(tech.email, tech.password, tech.name);
    await db.collection('users').doc(uid).set({
      uid,
      email: tech.email,
      name: tech.name,
      role: 'technician',
      storeId,
      storeName: TEST_STORE.name,
      disabled: false,
      internalPayRate: tech.internalPayRate,
      chargeoutRate: tech.chargeoutRate,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    technicians.push({ uid, name: tech.name });
    console.log('   Technician: ' + tech.name);
  }

  // 5. Create call admins
  console.log('\nCreating call admins...');
  const callAdmins: Array<{ uid: string; name: string }> = [];
  for (const ca of TEST_CALL_ADMINS) {
    const uid = await createAuthUser(ca.email, ca.password, ca.name);
    await db.collection('users').doc(uid).set({
      uid,
      email: ca.email,
      name: ca.name,
      role: 'call_admin',
      storeId,
      storeName: TEST_STORE.name,
      disabled: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    callAdmins.push({ uid, name: ca.name });
    console.log('   Call Admin: ' + ca.name);
  }

  // 6. Create customers + machines
  console.log('\nCreating customers and machines...');
  const customers: Array<{ id: string; companyName: string; contactPerson: string }> = [];
  const machines: Array<{ id: string; customerId: string; customerName: string; type: string; serialNumber: string }> = [];

  for (const customerDef of TEST_CUSTOMERS) {
    const custRef = await db.collection('stores').doc(storeId).collection('customers').add({
      companyName: customerDef.companyName,
      contactPerson: customerDef.contactPerson,
      phone: customerDef.phone,
      email: customerDef.email,
      address: customerDef.address,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    customers.push({ id: custRef.id, companyName: customerDef.companyName, contactPerson: customerDef.contactPerson });
    console.log('   Customer: ' + customerDef.companyName + ' (' + customerDef.machines.length + ' machines)');

    for (const machDef of customerDef.machines) {
      const machRef = await db
        .collection('stores')
        .doc(storeId)
        .collection('machines')
        .add({
          customerId: custRef.id,
          serialNumber: machDef.serial,
          type: machDef.type,
          location: machDef.location,
          notes: machDef.notes,
          installationDate: Timestamp.fromDate(randomPastDate(365 * 2)),
          associatedParts: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      machines.push({ id: machRef.id, customerId: custRef.id, customerName: customerDef.companyName, type: machDef.type, serialNumber: machDef.serial });
      console.log('     + ' + machDef.type + ' [' + machDef.serial + ']');
    }
  }

  // 7. Create parts inventory
  console.log('\nCreating parts inventory...');
  const partDocs: Array<{ id: string; name: string }> = [];
  for (const part of TEST_PARTS) {
    const partRef = await db
      .collection('stores')
      .doc(storeId)
      .collection('parts')
      .add({
        ...part,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    partDocs.push({ id: partRef.id, name: part.name });
    console.log('   Part: ' + part.name);
  }

  // 7.5 Associate standard parts with machines by machine type
  const MACHINE_TYPE_PARTS: Record<string, string[]> = {
    'iPilot Machine': ['iPilot Cleaning Tablet', 'Solenoid Valve 3-way', 'NTC Temperature Probe'],
    'EGRO Machine': ['EGRO Brew Group Seal', 'EGRO Water Pump', 'EGRO Bean Hopper', 'iPilot Cleaning Tablet'],
    'Crescendo Machine': ['Crescendo Brew Unit', 'NTC Temperature Probe', 'Boiler Heating Element'],
    'Rancilio Espresso Machine': ['Rancilio Portafilter Gasket', 'Solenoid Valve 3-way', 'Boiler Heating Element', 'Steam Wand Tip'],
    'Silvia Espresso Machine': ['Rancilio Portafilter Gasket', 'Steam Wand Tip', 'Boiler Heating Element', 'NTC Temperature Probe'],
    'Samremo Grinder': ['Samremo Burr Set'],
    'BUNN Grinder': ['BUNN Burr Set'],
    'BUNN Kyro Grinder': ['BUNN Kyro Burr Set'],
    'Smartwave Brewer Machine': ['Water Filter Cartridge'],
    'Brewer Machine': ['Water Filter Cartridge'],
    'BUNN Server': ['BUNN Server Carafe'],
    'Nitron RMV': ['Nitro Keg Coupler'],
    'Water Machine': ['Water Filter Cartridge', 'Water Machine Membrane'],
    'Barista Tools': ['O-Ring Kit (Assorted)'],
  };
  const partsByName = new Map(partDocs.map((p) => [p.name.toLowerCase(), p]));
  console.log('\nAssociating standard parts with machines...');
  for (const machine of machines) {
    const standardNames = MACHINE_TYPE_PARTS[machine.type] ?? [];
    if (standardNames.length === 0) continue;
    const associated = standardNames
      .map((n) => partsByName.get(n.toLowerCase()))
      .filter((p): p is { id: string; name: string } => !!p)
      .map((p) => ({ partId: p.id, partName: p.name, addedAt: Timestamp.now() }));
    if (associated.length > 0) {
      await db.collection('stores').doc(storeId).collection('machines').doc(machine.id).update({
        associatedParts: associated,
        updatedAt: Timestamp.now(),
      });
      console.log('   ' + machine.type + ' [' + machine.serialNumber + '] → ' + associated.length + ' part(s)');
    }
  }

  // 8. Create tickets with work logs
  console.log('\nCreating tickets and work logs...');
  const TICKET_COUNT = 30;

  for (let i = 0; i < TICKET_COUNT; i++) {
    const callAdmin = randomItem(callAdmins);
    const tech = Math.random() > 0.15 ? randomItem(technicians) : null;

    // Determine status
    const r = Math.random();
    let status: string;
    if (tech) {
      status = r < 0.1 ? 'Open' : r < 0.3 ? 'In Progress' : r < 0.4 ? 'Pending Parts' : 'Closed';
    } else {
      status = r < 0.8 ? 'Open' : 'Closed';
    }

    const customer = randomItem(customers);
    const customerMachines = machines.filter((m) => m.customerId === customer.id);
    if (customerMachines.length === 0) continue;
    const machine = randomItem(customerMachines);
    const createdDate = randomPastDate(90);

    // ~40% of assigned tickets have a scheduled visit date
    const hasScheduled = tech && Math.random() < 0.4;
    const scheduledVisitDate = hasScheduled ? Timestamp.fromDate(new Date(createdDate.getTime() + (1 + Math.floor(Math.random() * 5)) * 86400000)) : null;

    const ticketData: Record<string, any> = {
      ticketNumber: makeTicketNumber(i + 1),
      machines: [
        {
          machineId: machine.id,
          machineType: machine.type,
          serialNumber: machine.serialNumber,
          customerId: machine.customerId,
          customerName: machine.customerName,
          priority: randomItem(['Low', 'Medium', 'High']),
        },
      ],
      issueDescription: randomItem(ISSUE_DESCRIPTIONS),
      contactPerson: customer.contactPerson,
      assignedTo: tech ? tech.uid : null,
      assignedToName: tech ? tech.name : null,
      status,
      scheduledVisitDate,
      createdAt: Timestamp.fromDate(createdDate),
      updatedAt: Timestamp.now(),
      createdBy: callAdmin.uid,
      storeId,
    };

    if (status === 'Closed') {
      const closed = new Date(createdDate);
      closed.setDate(closed.getDate() + Math.floor(Math.random() * 7) + 1);
      ticketData.closedAt = Timestamp.fromDate(closed);
    }

    const ticketRef = await db.collection('stores').doc(storeId).collection('tickets').add(ticketData);
    console.log('   Ticket ' + ticketData.ticketNumber + ' [' + status + '] ' + customer.companyName + (tech ? ' â†’ ' + tech.name : ' (unassigned)'));

    // Create 1â€“2 work logs for tickets with a technician that are In Progress, Pending Parts, or Closed
    if (tech && ['In Progress', 'Pending Parts', 'Closed'].includes(status)) {
      const logCount = Math.random() > 0.5 ? 2 : 1;
      for (let j = 0; j < logCount; j++) {
        const arrival = new Date(createdDate.getTime() + (j + 1) * 86400000);
        arrival.setHours(8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), 0, 0);
        const hours = 0.5 + Math.random() * 3;
        const departure = addHours(arrival, hours);

        // Randomly pick 0â€“2 parts used
        const partsUsedCount = Math.floor(Math.random() * 3);
        const partsUsed: Array<{ partId: string; partName: string; quantity: number }> = [];
        const shuffled = [...partDocs].sort(() => Math.random() - 0.5).slice(0, partsUsedCount);
        for (const p of shuffled) {
          partsUsed.push({ partId: p.id, partName: p.name, quantity: 1 + Math.floor(Math.random() * 2) });
        }

        await db
          .collection('stores')
          .doc(storeId)
          .collection('machineWorkLogs')
          .add({
            ticketId: ticketRef.id,
            machineId: machine.id,
            recordedBy: tech.uid,
            recordedByName: tech.name,
            arrivalTime: Timestamp.fromDate(arrival),
            departureTime: Timestamp.fromDate(departure),
            hoursWorked: parseFloat(hours.toFixed(2)),
            workPerformed: randomItem(WORK_PERFORMED_SAMPLES),
            outcome: j === logCount - 1 && status === 'Closed' ? 'Machine returned to service' : 'Follow-up required',
            repairs: '',
            partsUsed,
            createdAt: Timestamp.fromDate(arrival),
            updatedAt: Timestamp.fromDate(arrival),
          });

        // Auto-associate parts with the machine (mirrors appendPartsToMachine)
        if (partsUsed.length > 0) {
          const machineRef = db.collection('stores').doc(storeId).collection('machines').doc(machine.id);
          const machSnap = await machineRef.get();
          const existing: Array<{ partId?: string; partName: string; addedAt: any }> = machSnap.exists ? (machSnap.data()?.associatedParts ?? []) : [];
          for (const p of partsUsed) {
            const alreadyLinked = existing.some((e) => (p.partId && e.partId === p.partId) || e.partName.toLowerCase() === p.partName.toLowerCase());
            if (!alreadyLinked) {
              existing.push({ partId: p.partId, partName: p.partName, addedAt: Timestamp.fromDate(arrival) });
            }
          }
          await machineRef.update({ associatedParts: existing, updatedAt: Timestamp.now() });
        }
      }
    }
  }

  // 9. Summary
  console.log('\n\u2714 Seed complete!');
  console.log('   Store:       ' + TEST_STORE.name + ' (' + storeId + ')');
  console.log('   Store Admin: ' + TEST_ADMIN.email + ' / Password123!');
  console.log('   Technicians: ' + TEST_TECHNICIANS.map((t) => t.email).join(', '));
  console.log('   Call Admins: ' + TEST_CALL_ADMINS.map((c) => c.email).join(', '));
  console.log('\n   All passwords: Password123!\n');
}

seedTestData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed failed:', err);
    process.exit(1);
  });
