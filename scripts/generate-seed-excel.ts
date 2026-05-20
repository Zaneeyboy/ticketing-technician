/**
 * Generates three seed Excel files your partner can use to test the bulk upload
 * features in the admin portal.
 *
 * Output files (created in seed-data/ relative to project root):
 *   seed-data/customers-seed.xlsx
 *   seed-data/machines-seed.xlsx
 *   seed-data/parts-seed.xlsx
 *
 * Usage:
 *   npx tsx scripts/generate-seed-excel.ts
 *   -- or --
 *   npm run seed:excel
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(process.cwd(), 'seed-data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ── helpers ──────────────────────────────────────────────────────────────────

function writeFile(wb: XLSX.WorkBook, filename: string) {
  const filePath = path.join(OUT_DIR, filename);
  XLSX.writeFile(wb, filePath);
  console.log(`  ✓  ${filePath}`);
}

// ── 1. CUSTOMERS ─────────────────────────────────────────────────────────────
// Columns: Company Name | Contact Person | Phone | Email | Address

const CUSTOMERS: (string | number)[][] = [
  ['Company Name', 'Contact Person', 'Phone', 'Email', 'Address'],
  ['Island Grind Coffee Co.', 'Marcia Williams', '868-622-1001', 'marcia@islandgrind.com', '12 Frederick St, Port of Spain, Trinidad'],
  ['Blue Mountain Café', 'Devon Clarke', '876-933-2045', 'devon@bluemountaincafe.com', '45 Half-Way Tree Rd, Kingston, Jamaica'],
  ['Spice Isle Roasters', 'Anisa Thomas', '473-440-3322', 'anisa@spiceileroasters.com', '7 Grand Anse Dr, St George, Grenada'],
  ['SunBreak Espresso Bar', 'Rajesh Ramkissoon', '868-225-4400', 'rajesh@sunbreakespresso.com', '33 Queen St, San Fernando, Trinidad'],
  ['The Rum & Bean', 'Celeste Holder', '246-436-5500', 'celeste@rumandbeanbb.com', '19 Broad St, Bridgetown, Barbados'],
  ['Caribbean Brew House', 'Marcus Joseph', '868-657-6611', 'marcus@caribbrewhse.com', '88 Churchill-Roosevelt Hwy, Chaguanas, Trinidad'],
  ['Antilles Artisan Coffee', 'Sophie Beaubrun', '590-590-7712', 'sophie@antillescoffee.com', '3 Rue Victor Hugo, Fort-de-France, Martinique'],
  ['Coral Bay Café', 'Damien Regis', '758-456-8823', 'damien@coralbay.lc', '2 Laborie Bay Rd, Vieux Fort, St Lucia'],
  ['Trinibago Specialty Roasters', 'Priya Ragbir', '868-794-9934', 'priya@trinibago.com', '5 Cipriani Blvd, Port of Spain, Trinidad'],
  ['Turquoise Blend', 'Nathaniel Simmons', '649-946-0045', 'nat@turquoiseblend.com', '14 Airport Rd, Providenciales, Turks and Caicos'],
  ['Paradise Percolator', 'Joelle Burnett', '268-460-1156', 'joelle@paradiseperc.com', '27 St Mary St, St John, Antigua'],
  ['Windward Roast', 'Terence Bobb', '784-457-2267', 'terence@windwardroast.com', '9 Grenville St, Kingstown, St Vincent'],
  ['Savanna Sip', 'Claudette Edwards', '868-671-3378', 'claudette@savannasip.com', '61 Eastern Main Rd, Arima, Trinidad'],
  ['Plantation Brew', 'Kevin Jardine', '592-226-4489', 'kevin@plantationbrew.gy', '40 Main St, Georgetown, Guyana'],
  ['Sol & Bean Café', 'Michelle Cheddie', '868-372-5500', 'michelle@solbean.com', '22 Naparima Mayaro Rd, Princes Town, Trinidad'],
];

const wsCustomers = XLSX.utils.aoa_to_sheet(CUSTOMERS);
wsCustomers['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 16 }, { wch: 32 }, { wch: 44 }];
const wbCustomers = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbCustomers, wsCustomers, 'Customers');

// ── 2. MACHINES ───────────────────────────────────────────────────────────────
// Columns: Serial Number | Machine Type | Customer Name | Location | Notes
// Customer Name must match a name that already exists (or will be bulk-imported first)

const MACHINES: (string | number)[][] = [
  ['Serial Number', 'Machine Type', 'Customer Name', 'Location', 'Notes'],
  // Island Grind Coffee Co.
  ['IG-ES-00101', 'Crescendo', 'Island Grind Coffee Co.', 'Front Counter', 'Flagship location — high volume'],
  ['IG-GR-00102', 'Grinder Pro 64', 'Island Grind Coffee Co.', 'Front Counter', 'Paired with Crescendo #00101'],
  ['IG-BW-00103', 'Filter Brewer X5', 'Island Grind Coffee Co.', 'Back Bar', 'Decaf setup'],
  // Blue Mountain Café
  ['BM-ES-00201', 'Allegra 2', 'Blue Mountain Café', 'Main Bar', 'Just installed — no issues yet'],
  ['BM-ES-00202', 'Crescendo', 'Blue Mountain Café', 'Drive-Through Station', 'Requires descale reminder'],
  // Spice Isle Roasters
  ['SI-ES-00301', 'Prestige V2', 'Spice Isle Roasters', 'Roasting Floor Bar', 'Annual PM due October'],
  // SunBreak Espresso Bar
  ['SB-ES-00401', 'Allegra 2', 'SunBreak Espresso Bar', 'Main Counter', ''],
  ['SB-GR-00402', 'Grinder Pro 64', 'SunBreak Espresso Bar', 'Main Counter', 'Calibration needed'],
  ['SB-BW-00403', 'Filter Brewer X5', 'SunBreak Espresso Bar', 'Prep Kitchen', ''],
  // The Rum & Bean
  ['RB-ES-00501', 'Crescendo', 'The Rum & Bean', 'Bar Top', ''],
  ['RB-ES-00502', 'Prestige V2', 'The Rum & Bean', 'VIP Lounge', 'Light use'],
  // Caribbean Brew House
  ['CB-ES-00601', 'Allegra 2', 'Caribbean Brew House', 'Counter 1', ''],
  ['CB-ES-00602', 'Crescendo', 'Caribbean Brew House', 'Counter 2', ''],
  ['CB-GR-00603', 'Grinder Pro 64', 'Caribbean Brew House', 'Counter 1', ''],
  // Antilles Artisan Coffee
  ['AN-ES-00701', 'Prestige V2', 'Antilles Artisan Coffee', 'Espresso Station', 'French market — 220V unit'],
  // Coral Bay Café
  ['CO-ES-00801', 'Crescendo', 'Coral Bay Café', 'Open Terrace Bar', 'Salt air environment — inspect seals'],
  // Trinibago Specialty Roasters
  ['TN-ES-00901', 'Allegra 2', 'Trinibago Specialty Roasters', 'Showroom Bar', ''],
  ['TN-GR-00902', 'Grinder Pro 64', 'Trinibago Specialty Roasters', 'Showroom Bar', ''],
  ['TN-BW-00903', 'Filter Brewer X5', 'Trinibago Specialty Roasters', 'Training Room', 'Used for barista training'],
  // Turquoise Blend
  ['TQ-ES-01001', 'Crescendo', 'Turquoise Blend', 'Main Counter', 'Resort café — seasonal peaks'],
  // Paradise Percolator
  ['PP-ES-01101', 'Prestige V2', 'Paradise Percolator', 'Main Bar', ''],
  // Windward Roast
  ['WR-ES-01201', 'Allegra 2', 'Windward Roast', 'Counter', ''],
  // Savanna Sip
  ['SS-ES-01301', 'Crescendo', 'Savanna Sip', 'Front Counter', ''],
  ['SS-BW-01302', 'Filter Brewer X5', 'Savanna Sip', 'Back Counter', 'High mineral water — descale frequently'],
  // Plantation Brew
  ['PB-ES-01401', 'Prestige V2', 'Plantation Brew', 'Main Bar', 'Hard water area'],
  // Sol & Bean Café
  ['SL-ES-01501', 'Allegra 2', 'Sol & Bean Café', 'Counter', ''],
];

const wsMachines = XLSX.utils.aoa_to_sheet(MACHINES);
wsMachines['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 24 }, { wch: 36 }];
const wbMachines = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbMachines, wsMachines, 'Machines');

// ── 3. PARTS ─────────────────────────────────────────────────────────────────
// Columns: Part Number | Description | Qty | Unit | Category / Machine Type
// Note: "Unit" column is displayed only — not imported into the system

const PARTS: (string | number)[][] = [
  ['Part Number', 'Description', 'Qty', 'Unit', 'Category / Machine Type'],
  // Brewing & Espresso Consumables
  ['ESQ-GRPKT-01', 'Group Head Gasket (58mm)', 20, 'ea', 'Crescendo'],
  ['ESQ-SHRSH-02', 'Shower Screen (58mm)', 15, 'ea', 'Crescendo'],
  ['ESQ-GRPKT-03', 'Group Head Gasket (57mm)', 10, 'ea', 'Allegra 2'],
  ['ESQ-BLVLV-04', 'Boiler Safety Valve', 6, 'ea', 'Prestige V2'],
  ['ESQ-STEAM-05', 'Steam Wand Tip (3-hole)', 12, 'ea', 'Espresso General'],
  ['ESQ-STEAM-06', 'Steam Arm O-Ring Kit', 18, 'ea', 'Espresso General'],
  // Filters
  ['FLT-PAPER-A4-07', 'Filter Paper A4 (500pk)', 30, 'pk', 'Filter Brewer X5'],
  ['FLT-PAPER-A5-08', 'Filter Paper A5 (500pk)', 20, 'pk', 'Filter Brewer X5'],
  ['FLT-WTRFLTR-09', 'Inline Water Filter Cartridge (6 month)', 24, 'ea', 'Filter'],
  ['FLT-WTRFLTR-10', 'Inline Water Filter Cartridge (12 month)', 12, 'ea', 'Filter'],
  // Descaling & Cleaning
  ['CLN-DSCAL-11', 'Descaler Solution 1L', 36, 'btl', 'Cleaning'],
  ['CLN-GRPCLNR-12', 'Group Head Cleaner Tablets (100pk)', 10, 'pk', 'Cleaning'],
  ['CLN-MKLNK-13', 'Milk System Cleaning Liquid 500ml', 24, 'btl', 'Cleaning'],
  ['CLN-BLIND-14', 'Blind Filter Basket (58mm) for Backflushing', 8, 'ea', 'Cleaning'],
  // Grinder Parts
  ['GRD-BURR-15', 'Grinder Burr Set (64mm flat)', 5, 'ea', 'Grinder Pro 64'],
  ['GRD-BURR-16', 'Grinder Burr Set (60mm conical)', 4, 'ea', 'Grinder General'],
  ['GRD-BELT-17', 'Grinder Drive Belt', 8, 'ea', 'Grinder Pro 64'],
  ['GRD-MTRBRSH-18', 'Grinder Motor Brush Set', 6, 'ea', 'Grinder General'],
  // Pump & Boiler
  ['PMP-VBPMP-19', 'Vibration Pump 230V/50Hz', 4, 'ea', 'Espresso General'],
  ['PMP-VBPMP-20', 'Vibration Pump 110V/60Hz', 4, 'ea', 'Espresso General'],
  ['BLR-ELMT-21', 'Boiler Heating Element 1200W', 3, 'ea', 'Prestige V2'],
  ['BLR-ELMT-22', 'Boiler Heating Element 1400W', 3, 'ea', 'Crescendo'],
  ['BLR-PRBT-23', 'Boiler Pressure Stat', 6, 'ea', 'Espresso General'],
  ['BLR-TSTAT-24', 'Boiler Safety Thermostat', 8, 'ea', 'Espresso General'],
  // Solenoid & Valves
  ['VLV-SOLND-25', '3-Way Solenoid Valve 24V', 5, 'ea', 'Espresso General'],
  ['VLV-EXVAL-26', 'Expansion (OPV) Valve', 6, 'ea', 'Crescendo'],
  ['VLV-EXVAL-27', 'Expansion (OPV) Valve', 4, 'ea', 'Allegra 2'],
  // Seals & O-Rings
  ['SLR-ORING-28', 'O-Ring Assortment Kit (200pc)', 10, 'kt', 'General'],
  ['SLR-BOILR-29', 'Boiler Seal Kit', 8, 'kt', 'Espresso General'],
  // Electrical
  ['ELC-FUSE-30', 'Fuse 6.3A 250V (5pk)', 15, 'pk', 'Electrical'],
  ['ELC-FUSE-31', 'Fuse 10A 250V (5pk)', 15, 'pk', 'Electrical'],
  ['ELC-PWRBD-32', 'Power Board / PCB Allegra 2', 2, 'ea', 'Allegra 2'],
  ['ELC-DSPBD-33', 'Display Board Prestige V2', 2, 'ea', 'Prestige V2'],
  // Tools & Accessories
  ['TOOL-TMPR-34', 'Calibrated Tamper 58mm', 6, 'ea', 'Accessory'],
  ['TOOL-PRFLT-35', 'Precision Portafilter Basket 18g (VST)', 8, 'ea', 'Accessory'],
  ['TOOL-BRUSH-36', 'Machine Cleaning Brush Set', 10, 'ea', 'Accessory'],
  ['TOOL-SCRWD-37', 'Service Screwdriver Set (Torx/Phillips)', 4, 'set', 'Accessory'],
  // Lubricants
  ['LUB-GRSE-38', 'Food-Grade Machine Grease 100g', 12, 'tb', 'Maintenance'],
  ['LUB-SILIC-39', 'Food-Grade Silicone Lubricant Spray 400ml', 10, 'can', 'Maintenance'],
];

const wsParts = XLSX.utils.aoa_to_sheet(PARTS);
wsParts['!cols'] = [{ wch: 22 }, { wch: 46 }, { wch: 6 }, { wch: 7 }, { wch: 24 }];
const wbParts = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbParts, wsParts, 'Parts');

// ── Write all files ───────────────────────────────────────────────────────────

console.log('\nGenerating seed Excel files...\n');
writeFile(wbCustomers, 'customers-seed.xlsx');
writeFile(wbMachines, 'machines-seed.xlsx');
writeFile(wbParts, 'parts-seed.xlsx');
console.log('\nDone! Files written to seed-data/');
console.log('\nImport order:');
console.log('  1. customers-seed.xlsx  (required first — machines reference customer names)');
console.log('  2. machines-seed.xlsx   (after customers are imported)');
console.log('  3. parts-seed.xlsx      (independent — import any time)');
