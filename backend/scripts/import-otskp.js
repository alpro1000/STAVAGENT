/**
 * Import OTSKP codes from XML file into database
 * Usage: node scripts/import-otskp.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { db, initDatabase } from '../src/db/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to OTSKP XML file (in project root)
const OTSKP_XML_PATH = path.join(__dirname, '../../2025_03 OTSKP.xml');

/**
 * Parse OTSKP XML file using regex
 * @param {string} xmlContent
 * @returns {Array} Array of OTSKP items
 */
function parseOtskpXml(xmlContent) {
  const items = [];

  // Remove BOM if present
  xmlContent = xmlContent.replace(/^\uFEFF/, '');

  // Match all <Polozka> elements
  const polozkaRegex = /<Polozka>([\s\S]*?)<\/Polozka>/g;
  const matches = xmlContent.matchAll(polozkaRegex);

  for (const match of matches) {
    const polozkaContent = match[1];

    // Extract fields
    const codeMatch = polozkaContent.match(/<znacka>(.*?)<\/znacka>/);
    const nameMatch = polozkaContent.match(/<nazev>(.*?)<\/nazev>/);
    const unitMatch = polozkaContent.match(/<MJ>(.*?)<\/MJ>/);
    const priceMatch = polozkaContent.match(/<jedn_cena>(.*?)<\/jedn_cena>/);
    const specMatch = polozkaContent.match(/<technicka_specifikace>([\s\S]*?)<\/technicka_specifikace>/);

    if (codeMatch && nameMatch && unitMatch && priceMatch) {
      items.push({
        code: codeMatch[1].trim(),
        name: nameMatch[1].trim(),
        unit: unitMatch[1].trim(),
        unit_price: parseFloat(priceMatch[1].trim()),
        specification: specMatch ? specMatch[1].trim() : null
      });
    }
  }

  return items;
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
    process.exit(1);
  }

  console.log(`📄 Reading XML file: ${OTSKP_XML_PATH}`);
  const xmlContent = fs.readFileSync(OTSKP_XML_PATH, 'utf-8');

  console.log('🔍 Parsing XML...');
  const items = parseOtskpXml(xmlContent);
  console.log(`✅ Found ${items.length} OTSKP items\n`);

  // Clear existing data
  console.log('🗑️  Clearing existing OTSKP codes...');
  db.prepare('DELETE FROM otskp_codes').run();

  // Insert items
  console.log('💾 Inserting OTSKP codes into database...');
  const insertStmt = db.prepare(`
    INSERT INTO otskp_codes (code, name, unit, unit_price, specification)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertStmt.run(
        item.code,
        item.name,
        item.unit,
        item.unit_price,
        item.specification
      );
    }
  });

  try {
    insertMany(items);
    console.log(`✅ Successfully imported ${items.length} OTSKP codes!\n`);

    // Show sample
    console.log('📊 Sample OTSKP codes:');
    const samples = db.prepare('SELECT * FROM otskp_codes LIMIT 5').all();
    samples.forEach((item, i) => {
      console.log(`\n${i + 1}. Code: ${item.code}`);
      console.log(`   Name: ${item.name}`);
      console.log(`   Unit: ${item.unit}, Price: ${item.unit_price} CZK`);
    });

    // Statistics
    console.log('\n📈 Statistics:');
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT unit) as units_count
      FROM otskp_codes
    `).get();
    console.log(`   Total codes: ${stats.total}`);
    console.log(`   Unique units: ${stats.units_count}`);

    const unitStats = db.prepare(`
      SELECT unit, COUNT(*) as count
      FROM otskp_codes
      GROUP BY unit
      ORDER BY count DESC
      LIMIT 10
    `).all();
    console.log('\n   Top units:');
    unitStats.forEach(stat => {
      console.log(`   - ${stat.unit}: ${stat.count} codes`);
    });

  } catch (error) {
    console.error('❌ Error inserting data:', error);
    process.exit(1);
  }

  console.log('\n✅ OTSKP import completed successfully!');
}

// Run import
importOtskpCodes().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
