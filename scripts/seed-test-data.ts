import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

// Test data arrays
const testTechnicians = [
  { name: 'John Martinez', email: 'john.martinez@company.com', internalPayRate: 35, chargeoutRate: 125 },
  { name: 'Sarah Thompson', email: 'sarah.thompson@company.com', internalPayRate: 38, chargeoutRate: 130 },
  { name: 'Mike Anderson', email: 'mike.anderson@company.com', internalPayRate: 32, chargeoutRate: 120 },
  { name: 'Lisa Chen', email: 'lisa.chen@company.com', internalPayRate: 40, chargeoutRate: 135 },
];

const testCallAdmins = [
  { name: 'Emma Wilson', email: 'emma.wilson@company.com' },
  { name: 'David Brown', email: 'david.brown@company.com' },
  { name: 'Rachel Green', email: 'rachel.green@company.com' },
];

const testCustomers = [
  {
    companyName: 'Sunrise Cafe & Bakery',
    contactPerson: 'Maria Rodriguez',
    phone: '555-0101',
    email: 'maria@sunrisecafe.com',
    address: '123 Main Street, Downtown, CA 90210',
  },
  {
    companyName: "Joe's Coffee House",
    contactPerson: 'Joseph Chen',
    phone: '555-0102',
    email: 'joe@joescoffee.com',
    address: '456 Oak Avenue, Midtown, CA 90211',
  },
  {
    companyName: 'Bean There Done That',
    contactPerson: 'Sarah Mitchell',
    phone: '555-0103',
    email: 'sarah@beanthere.com',
    address: '789 Elm Drive, Uptown, CA 90212',
  },
  {
    companyName: 'The Daily Grind',
    contactPerson: 'Michael Thompson',
    phone: '555-0104',
    email: 'michael@dailygrind.com',
    address: '321 Pine Road, Westside, CA 90213',
  },
  {
    companyName: 'Espresso Yourself Cafe',
    contactPerson: 'Emily Davis',
    phone: '555-0105',
    email: 'emily@espressoyourself.com',
    address: '654 Maple Lane, Eastside, CA 90214',
  },
  {
    companyName: 'Brew Masters Cafe',
    contactPerson: 'Robert Johnson',
    phone: '555-0106',
    email: 'robert@brewmasters.com',
    address: '987 Cedar Street, Southside, CA 90215',
  },
  {
    companyName: 'Latte Art Studio',
    contactPerson: 'Jennifer Lee',
    phone: '555-0107',
    email: 'jennifer@latteart.com',
    address: '246 Birch Avenue, Northside, CA 90216',
  },
];

const testParts = [
  {
    name: 'Portafilter Gasket',
    description: 'Replacement silicone gasket for espresso portafilter',
    category: 'Gaskets & Seals',
    quantityInStock: 45,
    minQuantity: 10,
  },
  {
    name: 'Water Pump',
    description: 'High-pressure water pump for espresso machines',
    category: 'Pumps',
    quantityInStock: 8,
    minQuantity: 3,
  },
  {
    name: 'Heating Element',
    description: 'Boiler heating element - 1200W',
    category: 'Heating',
    quantityInStock: 12,
    minQuantity: 5,
  },
  {
    name: 'Pressure Gauge',
    description: 'Analog pressure gauge 0-15 bar',
    category: 'Gauges',
    quantityInStock: 25,
    minQuantity: 8,
  },
  {
    name: 'Steam Wand Tip',
    description: 'Stainless steel steam wand tip',
    category: 'Steam System',
    quantityInStock: 30,
    minQuantity: 10,
  },
  {
    name: 'Brew Group Seal',
    description: 'Rubber seal for brew group assembly',
    category: 'Gaskets & Seals',
    quantityInStock: 50,
    minQuantity: 15,
  },
  {
    name: 'Grinder Burr Set',
    description: 'Ceramic burr set for coffee grinder',
    category: 'Grinder Parts',
    quantityInStock: 6,
    minQuantity: 4,
  },
  {
    name: 'Solenoid Valve',
    description: '3-way solenoid valve for espresso machine',
    category: 'Valves',
    quantityInStock: 15,
    minQuantity: 5,
  },
  {
    name: 'Water Filter',
    description: 'Replacement water filter cartridge',
    category: 'Filters',
    quantityInStock: 100,
    minQuantity: 20,
  },
  {
    name: 'Drip Tray',
    description: 'Stainless steel drip tray with grate',
    category: 'Accessories',
    quantityInStock: 20,
    minQuantity: 5,
  },
  {
    name: 'Temperature Probe',
    description: 'Boiler temperature sensor probe',
    category: 'Sensors',
    quantityInStock: 18,
    minQuantity: 6,
  },
  {
    name: 'Power Switch',
    description: 'Main power rocker switch',
    category: 'Electrical',
    quantityInStock: 35,
    minQuantity: 12,
  },
];

// Helper to generate random past dates
function randomPastDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
  return date;
}

// Helper to calculate ticket number
function generateTicketNumber(index: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `TKT-${year}${month}-${String(index).padStart(4, '0')}`;
}

async function seedTestData() {
  console.log('🌱 Starting comprehensive test data seeding...\n');

  try {
    const createdTechnicians: Array<{ uid: string; name: string; email: string }> = [];
    const createdCallAdmins: Array<{ uid: string; name: string; email: string }> = [];
    const createdCustomers: Array<{ id: string; companyName: string; contactPerson: string }> = [];
    const createdMachines: Array<{ id: string; customerId: string; customerName: string; type: string; serialNumber: string }> = [];
    const createdParts: Array<{ id: string; name: string }> = [];

    // 1. Create Technicians
    console.log('👨‍🔧 Creating technicians...');
    for (const tech of testTechnicians) {
      try {
        const userRecord = await auth.createUser({
          email: tech.email,
          password: 'Password123!', // Default password for testing
          displayName: tech.name,
        });

        await db.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          email: tech.email,
          name: tech.name,
          role: 'technician',
          disabled: false,
          internalPayRate: tech.internalPayRate,
          chargeoutRate: tech.chargeoutRate,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        createdTechnicians.push({ uid: userRecord.uid, name: tech.name, email: tech.email });
        console.log(`✓ Created technician: ${tech.name} (${tech.email})`);
      } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
          console.log(`⚠ Technician ${tech.email} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    // 2. Create Call Admins
    console.log('\n📞 Creating call admins...');
    for (const admin of testCallAdmins) {
      try {
        const userRecord = await auth.createUser({
          email: admin.email,
          password: 'Password123!', // Default password for testing
          displayName: admin.name,
        });

        await db
          .collection('users')
          .doc(userRecord.uid)
          .set({
            uid: userRecord.uid,
            email: admin.email,
            name: admin.name,
            role: 'call_admin',
            disabled: false,
            stats: {
              totalTickets: 0,
              openTickets: 0,
              assignedTickets: 0,
              closedTickets: 0,
              activeTickets: 0,
              urgentPriority: 0,
              highPriority: 0,
              mediumPriority: 0,
              lowPriority: 0,
              firstTicketDate: null,
              lastTicketDate: null,
              updatedAt: Timestamp.now(),
            },
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

        createdCallAdmins.push({ uid: userRecord.uid, name: admin.name, email: admin.email });
        console.log(`✓ Created call admin: ${admin.name} (${admin.email})`);
      } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
          console.log(`⚠ Call admin ${admin.email} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    // 3. Create Customers and Machines
    console.log('\n📋 Creating customers and machines...');
    for (const customer of testCustomers) {
      const customerRef = await db.collection('customers').add({
        ...customer,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      createdCustomers.push({
        id: customerRef.id,
        companyName: customer.companyName,
        contactPerson: customer.contactPerson,
      });
      console.log(`✓ Created customer: ${customer.companyName}`);

      // Create 2-4 machines for each customer
      const machineCount = Math.floor(Math.random() * 3) + 2;
      const machineTypes = ['Crescendo', 'Espresso', 'Grinder', 'Other'] as const;

      for (let i = 0; i < machineCount; i++) {
        const machineType = machineTypes[Math.floor(Math.random() * machineTypes.length)];
        const serialNumber = `SN${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

        const machineRef = await db.collection('machines').add({
          customerId: customerRef.id,
          serialNumber: serialNumber,
          type: machineType,
          location: i === 0 ? 'Main Counter' : i === 1 ? 'Back Room' : `Station ${i + 1}`,
          installationDate: Timestamp.fromDate(new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)),
          notes: `${machineType} machine installed at ${customer.companyName}`,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        createdMachines.push({
          id: machineRef.id,
          customerId: customerRef.id,
          customerName: customer.companyName,
          type: machineType,
          serialNumber: serialNumber,
        });
        console.log(`  ✓ Added ${machineType} machine: ${serialNumber}`);
      }
    }

    // 4. Create Parts
    console.log('\n🔧 Creating parts inventory...');
    for (const part of testParts) {
      const partRef = await db.collection('parts').add({
        ...part,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      createdParts.push({ id: partRef.id, name: part.name });
      console.log(`✓ Created part: ${part.name}`);
    }

    // 5. Create Tickets with proper relationships
    console.log('\n🎫 Creating tickets with assignments...');

    const statuses = ['Open', 'Assigned', 'Closed'] as const;
    const priorities = ['Low', 'Medium', 'High', 'Urgent'] as const;

    const issueDescriptions = [
      'Machine not heating properly, customers complaining about cold coffee',
      'Steam wand producing weak steam pressure',
      'Grinder making unusual grinding noise',
      'Water leaking from bottom of machine',
      'Pressure gauge showing inconsistent readings',
      'Machine not turning on, complete power failure',
      'Coffee extraction too slow, possible blockage',
      'Drip tray overflowing frequently',
      'Temperature fluctuating during operation',
      'Group head seal leaking during extraction',
      'Pump making loud noise during operation',
      'Scheduled maintenance and cleaning',
      'New machine installation and setup',
      'Water filter replacement needed',
      'Machine producing burnt taste in coffee',
    ];

    let ticketCounter = 1;
    const callAdminStats = new Map(
      createdCallAdmins.map((admin) => [
        admin.uid,
        {
          totalTickets: 0,
          openTickets: 0,
          assignedTickets: 0,
          closedTickets: 0,
          urgentPriority: 0,
          highPriority: 0,
          mediumPriority: 0,
          lowPriority: 0,
          firstTicketDate: null as Timestamp | null,
          lastTicketDate: null as Timestamp | null,
        },
      ]),
    );

    // Create 25-30 tickets with varied scenarios
    const ticketCount = 25 + Math.floor(Math.random() * 6);

    for (let i = 0; i < ticketCount; i++) {
      // Random selections
      const callAdmin = createdCallAdmins[Math.floor(Math.random() * createdCallAdmins.length)];
      const technician = Math.random() > 0.2 ? createdTechnicians[Math.floor(Math.random() * createdTechnicians.length)] : null; // 80% assigned
      // More realistic status distribution: mostly Closed, more Assigned than before, some Open
      // But only set status to Assigned if there's actually a technician assigned
      const baseRand = Math.random();
      let status: 'Open' | 'Assigned' | 'Closed';
      if (technician) {
        // If we have a technician: 10% Open, 55% Assigned, 35% Closed
        // This shows tickets at various stages: not yet started, in progress, completed
        status = baseRand < 0.1 ? 'Open' : baseRand < 0.65 ? 'Assigned' : 'Closed';
      } else {
        // If no technician, 70% Open, 30% Closed
        status = baseRand < 0.7 ? 'Open' : 'Closed';
      }
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const createdDate = randomPastDate(60); // Within last 60 days

      // Select 1-2 machines from same customer
      const customer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
      const customerMachines = createdMachines.filter((m) => m.customerId === customer.id);
      const numMachines = Math.random() > 0.7 ? 2 : 1; // 30% chance of 2 machines
      const selectedMachines = customerMachines.slice(0, Math.min(numMachines, customerMachines.length));

      if (selectedMachines.length === 0) continue; // Skip if no machines

      const ticketMachines = selectedMachines.map((machine) => ({
        machineId: machine.id,
        machineType: machine.type,
        serialNumber: machine.serialNumber,
        customerId: machine.customerId,
        customerName: machine.customerName,
        priority: priority,
      }));

      const ticketNumber = generateTicketNumber(ticketCounter++);
      const issueDescription = issueDescriptions[Math.floor(Math.random() * issueDescriptions.length)];

      // Generate scheduled visit dates for realistic testing
      // 70% of tickets get a scheduled visit date
      let scheduledVisitDate: Timestamp | null = null;
      if (Math.random() < 0.7) {
        const daysOffset = Math.floor(Math.random() * 60) - 30; // Range: -30 to +30 days from creation
        const scheduledDate = new Date(createdDate);
        scheduledDate.setDate(scheduledDate.getDate() + daysOffset);
        // Set time between 8 AM and 5 PM
        scheduledDate.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
        scheduledVisitDate = Timestamp.fromDate(scheduledDate);
      }

      const ticketData: any = {
        ticketNumber: ticketNumber,
        machines: ticketMachines,
        issueDescription: issueDescription,
        contactPerson: customer.contactPerson,
        assignedTo: technician?.uid || null,
        assignedToName: technician?.name || null,
        status: status,
        createdAt: Timestamp.fromDate(createdDate),
        updatedAt: Timestamp.now(),
        createdBy: callAdmin.uid,
      };

      // Add scheduledVisitDate if it was generated
      if (scheduledVisitDate) {
        ticketData.scheduledVisitDate = scheduledVisitDate;
      }

      if (status === 'Closed') {
        const closedDate = new Date(createdDate);
        closedDate.setDate(closedDate.getDate() + Math.floor(Math.random() * 7) + 1); // Closed 1-7 days after creation
        ticketData.closedAt = Timestamp.fromDate(closedDate);
      }

      const ticketRef = await db.collection('tickets').add(ticketData);

      // Update call admin stats
      const stats = callAdminStats.get(callAdmin.uid)!;
      stats.totalTickets++;
      if (status === 'Open') stats.openTickets++;
      else if (status === 'Assigned') stats.assignedTickets++;
      else if (status === 'Closed') stats.closedTickets++;

      // Track priority counts
      ticketMachines.forEach((machine) => {
        switch (machine.priority) {
          case 'Urgent':
            stats.urgentPriority++;
            break;
          case 'High':
            stats.highPriority++;
            break;
          case 'Medium':
            stats.mediumPriority++;
            break;
          case 'Low':
            stats.lowPriority++;
            break;
        }
      });

      // Track first and last ticket dates
      const ticketTimestamp = Timestamp.fromDate(createdDate);
      if (!stats.firstTicketDate || ticketTimestamp.toMillis() < stats.firstTicketDate.toMillis()) {
        stats.firstTicketDate = ticketTimestamp;
      }
      if (!stats.lastTicketDate || ticketTimestamp.toMillis() > stats.lastTicketDate.toMillis()) {
        stats.lastTicketDate = ticketTimestamp;
      }

      console.log(`✓ Ticket ${ticketNumber}: ${status} - ${customer.companyName} (${selectedMachines.length} machine(s)) - Assigned to: ${technician?.name || 'Unassigned'}`);

      // Work log seeding strategy for realistic workflow:
      let hasWorkLogs = false;
      if (status === 'Closed') {
        // For closed tickets: ALL must have work logs (100%)
        hasWorkLogs = true;
        const assignedTech = technician || createdTechnicians[0]; // Use first tech if unassigned

        for (const machine of selectedMachines) {
          const usedParts = Math.random() > 0.5 ? createdParts.slice(0, Math.floor(Math.random() * 3) + 1) : [];

          await db.collection('machineWorkLogs').add({
            ticketId: ticketRef.id,
            machineId: machine.id,
            machineType: machine.type,
            machineSerialNumber: machine.serialNumber,
            recordedBy: assignedTech.uid,
            arrivalTime: Timestamp.fromDate(createdDate),
            departureTime: ticketData.closedAt,
            hoursWorked: Math.random() * 2 + 1.5, // 1.5-3.5 hours for completed repairs
            workPerformed: 'Inspected machine, performed necessary repairs and replacements',
            outcome: 'Issue resolved, machine operating normally',
            partsUsed: usedParts.map((part) => ({
              partId: part.id,
              partName: part.name,
              quantity: Math.floor(Math.random() * 2) + 1,
            })),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
      } else if (status === 'Assigned' && technician) {
        // For assigned tickets: simulate different work log states
        const workLogRand = Math.random();
        if (workLogRand < 0.4) {
          // 40% - No work logs yet (technician hasn't started)
          hasWorkLogs = false;
        } else if (workLogRand < 0.8) {
          // 40% - Partial work logs (only first machine)
          hasWorkLogs = true;
          const firstMachine = selectedMachines[0];
          const usedParts = Math.random() > 0.5 ? createdParts.slice(0, Math.floor(Math.random() * 2) + 1) : [];
          const inProgressDate = new Date(createdDate);
          inProgressDate.setDate(inProgressDate.getDate() + Math.floor(Math.random() * 3) + 1);

          await db.collection('machineWorkLogs').add({
            ticketId: ticketRef.id,
            machineId: firstMachine.id,
            machineType: firstMachine.type,
            machineSerialNumber: firstMachine.serialNumber,
            recordedBy: technician.uid,
            arrivalTime: Timestamp.fromDate(inProgressDate),
            hoursWorked: Math.random() * 1.5 + 0.5, // 0.5-2 hours for initial inspection
            workPerformed: 'Initial inspection completed, identified issues',
            outcome: 'Awaiting parts or further action',
            partsUsed: usedParts.map((part) => ({
              partId: part.id,
              partName: part.name,
              quantity: Math.floor(Math.random() * 2) + 1,
            })),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          // Note: Other machines don't get work logs until technician logs work on them
        } else {
          // 20% - All work logs completed (ready to close)
          hasWorkLogs = true;
          const completedDate = new Date(createdDate);
          completedDate.setDate(completedDate.getDate() + Math.floor(Math.random() * 5) + 1);

          for (const machine of selectedMachines) {
            const usedParts = Math.random() > 0.5 ? createdParts.slice(0, Math.floor(Math.random() * 3) + 1) : [];

            await db.collection('machineWorkLogs').add({
              ticketId: ticketRef.id,
              machineId: machine.id,
              machineType: machine.type,
              machineSerialNumber: machine.serialNumber,
              recordedBy: technician.uid,
              arrivalTime: Timestamp.fromDate(new Date(createdDate)),
              departureTime: Timestamp.fromDate(completedDate),
              hoursWorked: Math.random() * 2.5 + 1.5, // 1.5-4 hours for full service
              workPerformed: 'Services completed, all issues resolved',
              outcome: 'Machine working normally, customer satisfied',
              partsUsed: usedParts.map((part) => ({
                partId: part.id,
                partName: part.name,
                quantity: Math.floor(Math.random() * 2) + 1,
              })),
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });
          }
        }
      }
      // Note: Open tickets don't get work logs until technician logs work
    }

    // 6. Update call admin aggregate stats
    console.log('\n📊 Updating call admin statistics...');
    for (const [uid, stats] of callAdminStats.entries()) {
      await db
        .collection('users')
        .doc(uid)
        .update({
          stats: {
            totalTickets: stats.totalTickets,
            openTickets: stats.openTickets,
            assignedTickets: stats.assignedTickets,
            closedTickets: stats.closedTickets,
            activeTickets: stats.openTickets + stats.assignedTickets,
            urgentPriority: stats.urgentPriority,
            highPriority: stats.highPriority,
            mediumPriority: stats.mediumPriority,
            lowPriority: stats.lowPriority,
            firstTicketDate: stats.firstTicketDate,
            lastTicketDate: stats.lastTicketDate,
            updatedAt: Timestamp.now(),
          },
          updatedAt: Timestamp.now(),
        });
      const admin = createdCallAdmins.find((a) => a.uid === uid);
      console.log(`✓ Updated stats for ${admin?.name}: ${stats.totalTickets} total tickets`);
    }

    // Summary
    console.log('\n🎉 Test data seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - ${createdTechnicians.length} Technicians`);
    console.log(`   - ${createdCallAdmins.length} Call Admins`);
    console.log(`   - ${createdCustomers.length} Customers`);
    console.log(`   - ${createdMachines.length} Machines`);
    console.log(`   - ${createdParts.length} Parts`);
    console.log(`   - ${ticketCounter - 1} Tickets`);
    console.log('\n🔑 Login Credentials (all use password: Password123!):');
    console.log('\nTechnicians:');
    createdTechnicians.forEach((tech) => console.log(`   - ${tech.email}`));
    console.log('\nCall Admins:');
    createdCallAdmins.forEach((admin) => console.log(`   - ${admin.email}`));
    console.log('\n💡 Next steps:');
    console.log('   1. Login with any of the above credentials');
    console.log('   2. Explore tickets, customers, and machines');
    console.log('   3. Test ticket assignment and status updates');
    console.log('   4. View call admin statistics and reports\n');
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  }
}

// Run the seed function
seedTestData()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed data:', error);
    process.exit(1);
  });
