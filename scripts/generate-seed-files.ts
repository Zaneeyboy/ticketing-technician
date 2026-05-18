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

const machines: string[][] = [
  ['Serial Number', 'Machine Type', 'Customer Name', 'Location', 'Notes'],
  ['CRS-2021-0001', 'Crescendo', 'Blue Waters Hotels & Resorts', 'Main Lobby', 'Annual service due Aug 2026'],
  ['ESP-2019-0042', 'Espresso', 'Carib Coffee Co', 'Counter 1', ''],
  ['GRD-2020-0015', 'Grinder', 'Carib Coffee Co', 'Counter 1', 'Burr replaced Mar 2025'],
  ['CRS-2022-0018', 'Crescendo', 'Trini Roast Ltd', 'Front Counter', ''],
  ['ESP-2021-0033', 'Espresso', 'Island Brew Café', 'Bar Area', ''],
  ['GRD-2021-0009', 'Grinder', 'Island Brew Café', 'Bar Area', ''],
  ['CRS-2020-0027', 'Crescendo', 'Coffee Republic', 'Main Floor', 'Older unit, monitor closely'],
  ['ESP-2023-0005', 'Espresso', 'Savana Grande Hotel', 'Restaurant', 'New install Jan 2023'],
  ['CRS-2018-0044', 'Crescendo', 'Tobago Plantation Café', 'Counter', 'Due for descale'],
  ['ESP-2022-0011', 'Espresso', 'Maracas Bay Resort', 'Pool Bar', ''],
  ['GRD-2022-0003', 'Grinder', 'Maracas Bay Resort', 'Pool Bar', ''],
  ['CRS-2021-0059', 'Crescendo', 'Pan Espresso Bar', 'Station 1', ''],
  ['ESP-2021-0060', 'Espresso', 'Pan Espresso Bar', 'Station 2', ''],
  ['CRS-2019-0031', 'Crescendo', 'Gulf City Mall Food Court', 'Unit A', ''],
  ['ESP-2020-0022', 'Espresso', 'Hyatt Regency Trinidad', 'Restaurant', ''],
  ['GRD-2020-0016', 'Grinder', 'Hyatt Regency Trinidad', 'Restaurant', ''],
  ['CRS-2023-0008', 'Crescendo', 'Meridian Coffee House', 'Main Bar', 'New install'],
  ['OTH-2021-0037', 'Other', 'Cocoa Lounge Bar', 'VIP Area', 'Cold brew tower'],
  ['CRS-2022-0013', 'Crescendo', 'Port of Spain Marriott', 'Lobby Café', ''],
  ['ESP-2023-0002', 'Espresso', 'Airport Lounge TT', 'Terminal 2', ''],
];

const wsMachines = XLSX.utils.aoa_to_sheet(machines);
wsMachines['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 32 }, { wch: 22 }, { wch: 36 }];
const wbMachines = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbMachines, wsMachines, 'Machines');
XLSX.writeFile(wbMachines, path.join(OUT_DIR, 'machines-test.xlsx'));
console.log('✓  machines-test.xlsx   (20 rows)');

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
