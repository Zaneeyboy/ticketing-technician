/**
 * Generates three test Excel files for bulk-upload testing:
 *   test-data/customers-test.xlsx  — 20 Caribbean Roasters customers
 *   test-data/machines-test.xlsx   — 20 machines (reference the customer names above)
 *   test-data/parts-test.xlsx      — 30 coffee-machine parts
 *
 * Run:  npx tsx scripts/generate-seed-files.ts
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(process.cwd(), 'test-data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ─── Customers ────────────────────────────────────────────────────────────────

const customers: string[][] = [
  ['Company Name', 'Contact Person', 'Phone', 'Email', 'Address'],
  ['Blue Waters Hotels & Resorts', 'John Baptiste', '868-621-1234', 'john.baptiste@bluewaters.tt', '5 Marine Rd, Tobago'],
  ['Carib Coffee Co', 'Maria Ali', '868-627-5678', 'maria@caribcoffee.com', '12 Frederick St, Port of Spain'],
  ['Trini Roast Ltd', 'Sandra Williams', '868-662-9012', 'info@triniroast.com', '20 Mission Rd, San Fernando'],
  ['Island Brew Café', 'Kevin Charles', '868-636-3456', 'kevin@islandbrew.tt', '3 Harris Promenade, San Fernando'],
  ['Coffee Republic', 'Priya Ramkissoon', '868-676-7890', 'priya@coffeerepublic.tt', '45 Cipero St, San Fernando'],
  ['Savana Grande Hotel', 'Clive Henderson', '868-652-1234', 'frontdesk@savanagrande.tt', '100 Main Rd, Princes Town'],
  ['Tobago Plantation Café', 'Angela Cox', '868-639-2345', 'angela@tobagoplantation.tt', '7 Signal Hill Rd, Scarborough, Tobago'],
  ['Maracas Bay Resort', 'Mark Thomas', '868-664-5678', 'info@maracasresort.tt', 'Maracas Bay Rd, Blanchisseuse'],
  ['Pan Espresso Bar', 'Tracy Niles', '868-622-9012', 'tracy@panespresso.tt', '18 Hart St, Port of Spain'],
  ['Chaguanas Trade Centre', 'Victor Maharaj', '868-671-3456', 'victor@chaguanastc.tt', 'Montrose Rd, Chaguanas'],
  ['Gulf City Mall Food Court', 'Denise Edwards', '868-657-7890', 'denise@gulfcitymall.tt', 'Gulf City, La Romaine'],
  ['Hyatt Regency Trinidad', 'Paul Gomez', '868-623-2222', 'paul.gomez@hyatt.tt', '1 Wrightson Rd, Port of Spain'],
  ['Starlite Hotel', 'Grace Singh', '868-645-0987', 'info@starlitehotel.tt', 'Churchill Roosevelt Hwy, Arima'],
  ['Meridian Coffee House', 'Akeel Khan', '868-665-1234', 'akeel@meridiancoffee.tt', '22 Coffee St, San Fernando'],
  ['Cocoa Lounge Bar', 'Natasha Francis', '868-628-5678', 'natasha@cocoalounge.tt', '69 Ariapita Ave, Woodbrook'],
  ['Port of Spain Marriott', 'James Alexander', '868-625-9012', 'james.a@marriott.tt', 'Wrightson Rd, Port of Spain'],
  ['Arima Roasters', 'Diana Baird', '868-667-3456', 'diana@arimaroasters.tt', '5 Arima New Rd, Arima'],
  ['River Estate Café', 'Nelson Moore', '868-695-7890', 'info@riverestate.tt', 'River Estate Rd, St Joseph'],
  ['Airport Lounge TT', 'Susan Pierre', '868-669-1234', 'susan@airportlounge.tt', 'Piarco International Airport, Piarco'],
  ['Couva Central Mall', 'Tony Ramsaran', '868-636-4567', 'tony@couvacentral.tt', 'Southern Main Rd, Couva'],
];

const wsCustomers = XLSX.utils.aoa_to_sheet(customers);
wsCustomers['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 16 }, { wch: 36 }, { wch: 42 }];
const wbCustomers = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbCustomers, wsCustomers, 'Customers');
XLSX.writeFile(wbCustomers, path.join(OUT_DIR, 'customers-test.xlsx'));
console.log('✓  customers-test.xlsx  (20 rows)');

// ─── Machines ─────────────────────────────────────────────────────────────────
// NOTE: Customer Name values must match company names uploaded from customers-test.xlsx first.
// Each customer has 2–4 machines of different types.

const machines: string[][] = [
  ['Serial Number', 'Machine Type', 'Customer Name', 'Location', 'Notes'],

  // Blue Waters Hotels & Resorts (3)
  ['IPL-2022-0001', 'iPilot Machine', 'Blue Waters Hotels & Resorts', 'Main Lobby', 'Annual service due Aug 2026'],
  ['EGR-2021-0002', 'EGRO Machine', 'Blue Waters Hotels & Resorts', 'Restaurant Bar', ''],
  ['WTR-2023-0003', 'Water Machine', 'Blue Waters Hotels & Resorts', 'Back Kitchen', 'Filter replaced Jan 2026'],

  // Carib Coffee Co (3)
  ['CRS-2020-0004', 'Crescendo Machine', 'Carib Coffee Co', 'Counter 1', ''],
  ['RAN-2019-0005', 'Rancilio Espresso Machine', 'Carib Coffee Co', 'Counter 2', 'Pump seal replaced Sep 2025'],
  ['BGD-2021-0006', 'BUNN Grinder', 'Carib Coffee Co', 'Counter 1', 'Burr replaced Mar 2025'],

  // Trini Roast Ltd (3)
  ['IPL-2022-0007', 'iPilot Machine', 'Trini Roast Ltd', 'Front Counter', ''],
  ['CRS-2022-0008', 'Crescendo Machine', 'Trini Roast Ltd', 'Back Counter', ''],
  ['SMW-2023-0009', 'Smartwave Brewer Machine', 'Trini Roast Ltd', 'Staff Break Room', 'New install Mar 2023'],

  // Island Brew Café (3)
  ['RAN-2021-0010', 'Rancilio Espresso Machine', 'Island Brew Café', 'Bar Area', ''],
  ['BKY-2022-0011', 'BUNN Kyro Grinder', 'Island Brew Café', 'Bar Area', ''],
  ['WTR-2021-0012', 'Water Machine', 'Island Brew Café', 'Kitchen', ''],

  // Coffee Republic (3)
  ['CRS-2020-0013', 'Crescendo Machine', 'Coffee Republic', 'Main Floor', 'Older unit — monitor closely'],
  ['SIL-2021-0014', 'Silvia Espresso Machine', 'Coffee Republic', 'Brew Station', ''],
  ['BGD-2022-0015', 'BUNN Grinder', 'Coffee Republic', 'Brew Station', ''],

  // Savana Grande Hotel (3)
  ['EGR-2023-0016', 'EGRO Machine', 'Savana Grande Hotel', 'Restaurant', 'New install Jan 2023'],
  ['IPL-2021-0017', 'iPilot Machine', 'Savana Grande Hotel', 'Lobby Café', ''],
  ['BSV-2022-0018', 'BUNN Server', 'Savana Grande Hotel', 'Conference Room', ''],

  // Tobago Plantation Café (2)
  ['CRS-2018-0019', 'Crescendo Machine', 'Tobago Plantation Café', 'Counter', 'Due for descale'],
  ['RAN-2020-0020', 'Rancilio Espresso Machine', 'Tobago Plantation Café', 'Counter', ''],

  // Maracas Bay Resort (3)
  ['SIL-2022-0021', 'Silvia Espresso Machine', 'Maracas Bay Resort', 'Pool Bar', ''],
  ['BGD-2022-0022', 'BUNN Grinder', 'Maracas Bay Resort', 'Pool Bar', ''],
  ['WTR-2020-0023', 'Water Machine', 'Maracas Bay Resort', 'Kitchen', 'Scale build-up noted'],

  // Pan Espresso Bar (3)
  ['RAN-2021-0024', 'Rancilio Espresso Machine', 'Pan Espresso Bar', 'Station 1', ''],
  ['BKY-2021-0025', 'BUNN Kyro Grinder', 'Pan Espresso Bar', 'Station 1', ''],
  ['IPL-2022-0026', 'iPilot Machine', 'Pan Espresso Bar', 'Station 2', ''],

  // Chaguanas Trade Centre (2)
  ['CRS-2021-0027', 'Crescendo Machine', 'Chaguanas Trade Centre', 'Food Court', ''],
  ['BRW-2022-0028', 'Brewer Machine', 'Chaguanas Trade Centre', 'Food Court', ''],

  // Gulf City Mall Food Court (3)
  ['CRS-2019-0029', 'Crescendo Machine', 'Gulf City Mall Food Court', 'Unit A', ''],
  ['SAM-2021-0030', 'Samremo Grinder', 'Gulf City Mall Food Court', 'Unit A', ''],
  ['WTR-2022-0031', 'Water Machine', 'Gulf City Mall Food Court', 'Unit B', ''],

  // Hyatt Regency Trinidad (4)
  ['EGR-2020-0032', 'EGRO Machine', 'Hyatt Regency Trinidad', 'Restaurant', ''],
  ['BGD-2020-0033', 'BUNN Grinder', 'Hyatt Regency Trinidad', 'Restaurant', ''],
  ['IPL-2021-0034', 'iPilot Machine', 'Hyatt Regency Trinidad', 'Lobby Lounge', ''],
  ['BRW-2022-0035', 'Brewer Machine', 'Hyatt Regency Trinidad', 'Conference Suite', ''],

  // Starlite Hotel (2)
  ['CRS-2022-0036', 'Crescendo Machine', 'Starlite Hotel', 'Breakfast Area', ''],
  ['RAN-2021-0037', 'Rancilio Espresso Machine', 'Starlite Hotel', 'Breakfast Area', ''],

  // Meridian Coffee House (3)
  ['IPL-2023-0038', 'iPilot Machine', 'Meridian Coffee House', 'Main Bar', 'New install'],
  ['SIL-2022-0039', 'Silvia Espresso Machine', 'Meridian Coffee House', 'Main Bar', ''],
  ['BKY-2022-0040', 'BUNN Kyro Grinder', 'Meridian Coffee House', 'Main Bar', ''],

  // Cocoa Lounge Bar (2)
  ['NIT-2021-0041', 'Nitron RMV', 'Cocoa Lounge Bar', 'VIP Area', 'Cold brew system'],
  ['WTR-2021-0042', 'Water Machine', 'Cocoa Lounge Bar', 'Back Bar', ''],

  // Port of Spain Marriott (3)
  ['EGR-2022-0043', 'EGRO Machine', 'Port of Spain Marriott', 'Lobby Café', ''],
  ['IPL-2022-0044', 'iPilot Machine', 'Port of Spain Marriott', 'Executive Lounge', ''],
  ['BSV-2021-0045', 'BUNN Server', 'Port of Spain Marriott', 'Meeting Rooms', ''],

  // Arima Roasters (3)
  ['CRS-2021-0046', 'Crescendo Machine', 'Arima Roasters', 'Shop Floor', ''],
  ['BRW-2020-0047', 'Brewer Machine', 'Arima Roasters', 'Shop Floor', ''],
  ['SAM-2022-0048', 'Samremo Grinder', 'Arima Roasters', 'Shop Floor', ''],

  // River Estate Café (2)
  ['RAN-2022-0049', 'Rancilio Espresso Machine', 'River Estate Café', 'Counter', ''],
  ['BGD-2021-0050', 'BUNN Grinder', 'River Estate Café', 'Counter', ''],

  // Airport Lounge TT (3)
  ['IPL-2023-0051', 'iPilot Machine', 'Airport Lounge TT', 'Terminal 2', ''],
  ['EGR-2022-0052', 'EGRO Machine', 'Airport Lounge TT', 'Terminal 1', ''],
  ['CRS-2021-0053', 'Crescendo Machine', 'Airport Lounge TT', 'VIP Lounge', ''],

  // Couva Central Mall (3)
  ['SMW-2022-0054', 'Smartwave Brewer Machine', 'Couva Central Mall', 'Food Court A', ''],
  ['BGD-2023-0055', 'BUNN Grinder', 'Couva Central Mall', 'Food Court A', ''],
  ['WTR-2022-0056', 'Water Machine', 'Couva Central Mall', 'Food Court B', ''],
];

const wsMachines = XLSX.utils.aoa_to_sheet(machines);
wsMachines['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 34 }, { wch: 22 }, { wch: 36 }];
const wbMachines = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbMachines, wsMachines, 'Machines');
XLSX.writeFile(wbMachines, path.join(OUT_DIR, 'machines-test.xlsx'));
console.log('✓  machines-test.xlsx   (56 rows — 2-4 machines per customer)');

// ─── Parts ────────────────────────────────────────────────────────────────────

const parts: (string | number)[][] = [
  ['Part Number', 'Description', 'Qty', 'Unit', 'Category / Machine Type'],
  ['MACH BREWER 38200.0017', 'BTX-B(D) Hi-Alt Brewer Kit 2PK', 14, 'ea', 'Brewer machine'],
  ['FILTER PAPER A4', 'Standard A4 Filter Paper Pack', 200, 'pk', 'Filter'],
  ['GASKET BREW HEAD', 'Brew Head Silicone Gasket', 45, 'ea', 'Brewer machine'],
  ['SEAL PUMP 8MM', 'Pump Seal 8mm Diameter', 30, 'ea', 'Brewer machine'],
  ['PORTAFILTER BASKET 58', '58mm Double Portafilter Basket', 20, 'ea', 'Espresso'],
  ['GRINDER BURR 64MM', '64mm Flat Burr Set (pair)', 8, 'set', 'Grinder'],
  ['ELEMENT HEAT 1200W', '1200W Heating Element 230V', 12, 'ea', 'Brewer machine'],
  ['STEAM WAND TIP 2H', '2-Hole Stainless Steam Wand Tip', 25, 'ea', 'Espresso'],
  ['WATER FILTER CART', 'Water Filter Cartridge 3-Month', 60, 'ea', 'Maintenance'],
  ['GROUP HEAD GASKET 8.5', 'Group Head Gasket 8.5mm', 50, 'ea', 'Espresso'],
  ['DESCALING TABLET 6PK', 'Descaling Tablet Pack of 6', 100, 'pk', 'Maintenance'],
  ['VALVE SOLENOID 3W', '3-Way Solenoid Valve 24V', 6, 'ea', 'Brewer machine'],
  ['PUMP VIBE 48W', 'Vibratory Pump 48W ULKA', 10, 'ea', 'Espresso'],
  ['BOILER ELEMENT 1450W', 'Boiler Heating Element 1450W', 7, 'ea', 'Espresso'],
  ['GREASE SILICONE 150G', 'Food Grade Silicone Grease 150g', 35, 'ea', 'Maintenance'],
  ['BRUSH GRP HEAD', 'Group Head Cleaning Brush Nylon', 40, 'ea', 'Maintenance'],
  ['SHOWER SCREEN 58MM', '58mm Shower Screen Stainless', 22, 'ea', 'Espresso'],
  ['O-RING SET 10PC', 'O-Ring Assortment Kit 10-piece', 55, 'set', 'Brewer machine'],
  ['THERMO PROBE NTC', 'NTC Thermometer Probe 10K', 15, 'ea', 'Brewer machine'],
  ['DISPLAY BOARD V2', 'Control Display PCB v2.1', 3, 'ea', 'Brewer machine'],
  ['CABLE HARNESS MAIN', 'Main Cable Harness Assembly', 4, 'ea', 'Brewer machine'],
  ['HANDLE PORTAFILTER', '58mm Portafilter Handle Walnut', 18, 'ea', 'Espresso'],
  ['DRIP TRAY GRATE SS', 'Drip Tray Stainless Steel Grate', 28, 'ea', 'Espresso'],
  ['LID WATER TANK', 'Replacement Water Tank Lid', 20, 'ea', 'Brewer machine'],
  ['FUSE THERMAL 6.3A', '6.3A Thermal Fuse 192°C', 30, 'ea', 'Brewer machine'],
  ['GAUGE PRESSURE ESP', 'Espresso Pressure Gauge 0-16 Bar', 9, 'ea', 'Espresso'],
  ['BURR GRINDER FLAT 75', 'Flat Burr Set 75mm (pair)', 5, 'set', 'Grinder'],
  ['DIAL SHOT TIMER', 'Analog Shot Timer 60s', 16, 'ea', 'Espresso'],
  ['TUBE STEAM COPPER 30', 'Copper Steam Tube 30cm', 12, 'ea', 'Espresso'],
  ['PAD FILTER 58MM 100PK', '58mm Filter Pad Pack of 100', 3, 'pk', 'Filter'],
];

const wsParts = XLSX.utils.aoa_to_sheet(parts);
wsParts['!cols'] = [{ wch: 26 }, { wch: 40 }, { wch: 6 }, { wch: 6 }, { wch: 22 }];
const wbParts = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbParts, wsParts, 'Parts');
XLSX.writeFile(wbParts, path.join(OUT_DIR, 'parts-test.xlsx'));
console.log('✓  parts-test.xlsx      (30 rows)');

console.log('\nFiles written to:', OUT_DIR);
console.log('\nUpload order matters:');
console.log('  1. customers-test.xlsx  — create customers first');
console.log('  2. machines-test.xlsx   — machines reference customer names');
console.log('  3. parts-test.xlsx      — independent, upload any time');
