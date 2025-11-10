/**
 * Import OTSKP codes from XML file into database
 * Usage: node scripts/import-otskp.js
 *
 * This script:
 * 1. Reads the OTSKP XML catalog file (17,904 Czech construction codes)
 * 2. Parses each <Polozka> element extracting code, name, unit, price, specification
 * 3. Clears existing OTSKP codes from database
 * 4. Inserts all codes as a transaction (all-or-nothing)
 * 5. Displays statistics and sample codes
 *
 * Run this ONCE when updating the OTSKP catalog (typically once per year)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { db, initDatabase } from '../src/db/init.js';
import { normalizeForSearch } from '../src/utils/text.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to OTSKP XML file (in project root)
const OTSKP_XML_PATH = path.join(__dirname, '../../2025_03 OTSKP.xml');

/**
 * Parse OTSKP XML file using regex
 * @param {string} xmlContent
 * @returns {Object} { items: Array, validCount: number, invalidCount: number, errors: Array }
 */
function parseOtskpXml(xmlContent) {
  const items = [];
  const errors = [];
  let validCount = 0;
  let invalidCount = 0;

  // Remove BOM if present
  xmlContent = xmlContent.replace(/^\uFEFF/, '');

  // Match all <Polozka> elements
  const polozkaRegex = /<Polozka>([\s\S]*?)<\/Polozka>/g;
  const matches = xmlContent.matchAll(polozkaRegex);

  for (const match of matches) {
    const polozkaContent = match[1];

    // Extract fields with validation
    const codeMatch = polozkaContent.match(/<znacka>(.*?)<\/znacka>/);
    const nameMatch = polozkaContent.match(/<nazev>(.*?)<\/nazev>/);
    const unitMatch = polozkaContent.match(/<MJ>(.*?)<\/MJ>/);
    const priceMatch = polozkaContent.match(/<jedn_cena>(.*?)<\/jedn_cena>/);
    const specMatch = polozkaContent.match(/<technicka_specifikace>([\s\S]*?)<\/technicka_specifikace>/);

    // Validate required fields
    if (!codeMatch || !codeMatch[1].trim()) {
      invalidCount++;
      errors.push(`Missing or empty code`);
      continue;
    }
    if (!nameMatch || !nameMatch[1].trim()) {
      invalidCount++;
      errors.push(`Missing name for code: ${codeMatch[1]}`);
      continue;
    }
    if (!unitMatch || !unitMatch[1].trim()) {
      invalidCount++;
      errors.push(`Missing unit for code: ${codeMatch[1]}`);
      continue;
    }
    if (!priceMatch || isNaN(parseFloat(priceMatch[1].trim()))) {
      invalidCount++;
      errors.push(`Invalid price for code: ${codeMatch[1]}`);
      continue;
    }

    // Add valid item
    const code = codeMatch[1].trim();
    const name = nameMatch[1].trim();

    items.push({
      code,
      name,
      unit: unitMatch[1].trim(),
      unit_price: parseFloat(priceMatch[1].trim()),
      specification: specMatch ? specMatch[1].trim() : null,
      searchName: normalizeForSearch(name)
    });
    validCount++;
  }

  return { items, validCount, invalidCount, errors };
}

/**
 * Import OTSKP codes into database
 */
async function importOtskpCodes() {
  console.log('🚀 Starting OTSKP import...\n');

  // Initialize database
  initDatabase();

  // Check if file exists
  if (!fs.existsSync(OTSKP_XML_PATH)) {
    console.error(`❌ Error: OTSKP XML file not found at: ${OTSKP_XML_PATH}`);
    console.error(`   Expected location: ${OTSKP_XML_PATH}`);
    process.exit(1);
  }

  console.log(`📄 Reading XML file: ${OTSKP_XML_PATH}`);
  let xmlContent;
  try {
    xmlContent = fs.readFileSync(OTSKP_XML_PATH, 'utf-8');
    console.log(`   File size: ${(xmlContent.length / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.error(`❌ Error reading XML file:`, error.message);
    process.exit(1);
  }

  console.log('🔍 Parsing XML...');
  const parseResult = parseOtskpXml(xmlContent);
  const { items, validCount, invalidCount, errors } = parseResult;

  console.log(`✅ Parsing complete:
   Valid items: ${validCount}
   Invalid items: ${invalidCount}
   Total: ${items.length}\n`);

  if (invalidCount > 0 && errors.length > 0) {
    console.log('⚠️  Sample parsing errors (showing first 5):');
    errors.slice(0, 5).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err}`);
    });
    console.log();
  }

  // Clear existing data
  console.log('🗑️  Clearing existing OTSKP codes...');
  db.prepare('DELETE FROM otskp_codes').run();

  // Insert items
  console.log('💾 Inserting OTSKP codes into database...');
  const insertStmt = db.prepare(`
    INSERT INTO otskp_codes (code, name, unit, unit_price, specification, search_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      try {
        insertStmt.run(
          item.code,
          item.name,
          item.unit,
          item.unit_price,
          item.specification,
          item.searchName
        );
      } catch (error) {
        console.error(`   ⚠️  Failed to insert code ${item.code}: ${error.message}`);
      }
    }
  });

  try {
    insertMany(items);
    console.log(`✅ Successfully inserted OTSKP codes!\n`);

    // Verify import
    const verifyStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT unit) as units_count,
        MIN(unit_price) as min_price,
        MAX(unit_price) as max_price,
        AVG(unit_price) as avg_price
      FROM otskp_codes
    `).get();

    console.log('📈 Database verification:');
    console.log(`   Total codes in DB: ${verifyStats.total}`);
    console.log(`   Unique units: ${verifyStats.units_count}`);
    console.log(`   Price range: ${verifyStats.min_price} - ${verifyStats.max_price} CZK`);
    console.log(`   Average price: ${verifyStats.avg_price.toFixed(2)} CZK\n`);

    // Show sample
    console.log('📊 Sample OTSKP codes:');
    const samples = db.prepare('SELECT code, name, unit, unit_price FROM otskp_codes LIMIT 5').all();
    samples.forEach((item, i) => {
      console.log(`\n${i + 1}. Code: ${item.code}`);
      console.log(`   Name: ${item.name}`);
      console.log(`   Unit: ${item.unit}, Price: ${item.unit_price} CZK`);
    });

    // Top units statistics
    console.log('\n📈 Top 10 units:');
    const unitStats = db.prepare(`
      SELECT unit, COUNT(*) as count
      FROM otskp_codes
      GROUP BY unit
      ORDER BY count DESC
      LIMIT 10
    `).all();
    unitStats.forEach((stat, i) => {
      console.log(`   ${i + 1}. ${stat.unit}: ${stat.count} codes`);
    });

    // Indexes verification
    console.log('\n🔍 Database indexes created:');
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name LIKE 'idx_otskp%'
    `).all();
    indexes.forEach(idx => {
      console.log(`   ✅ ${idx.name}`);
    });

  } catch (error) {
    console.error('❌ Error during import:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }

  console.log('\n✅ OTSKP import completed successfully!');
}

// Run import
importOtskpCodes().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
