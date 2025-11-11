#!/usr/bin/env node
/**
 * Debug script to check OTSKP database and API
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'backend/data/monolit.db');

console.log('🔍 OTSKP Debug Script\n');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);

  // Check OTSKP codes count
  console.log('\n📊 Database Statistics:');
  const countResult = db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();
  console.log(`  Total OTSKP codes: ${countResult?.count || 0}`);

  // Check if search_name column exists
  const columns = db.prepare("PRAGMA table_info(otskp_codes)").all();
  const hasSearchName = columns.some(col => col.name === 'search_name');
  console.log(`  Has search_name column: ${hasSearchName ? '✅' : '❌'}`);

  // Count how many have search_name filled
  if (hasSearchName) {
    const filledResult = db.prepare('SELECT COUNT(*) as count FROM otskp_codes WHERE search_name IS NOT NULL AND search_name != ""').get();
    console.log(`  search_name values filled: ${filledResult?.count || 0}`);
  }

  // Show sample records
  console.log('\n📝 Sample Records (first 3):');
  const samples = db.prepare('SELECT code, name, unit, unit_price, search_name FROM otskp_codes LIMIT 3').all();
  samples.forEach(row => {
    console.log(`\n  Code: ${row.code}`);
    console.log(`  Name: ${row.name}`);
    console.log(`  Unit: ${row.unit}`);
    console.log(`  Price: ${row.unit_price}`);
    console.log(`  Search Name: ${row.search_name || 'NULL'}`);
  });

  // Test a search query
  console.log('\n🔍 Test Searches:');
  const searches = ['zaklad', 'vykop', '27'];

  searches.forEach(query => {
    const pattern = `%${query}%`;
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM otskp_codes
      WHERE UPPER(code) LIKE ? OR search_name LIKE ?
    `).get(query.toUpperCase() + '%', pattern);
    console.log(`  Search "${query}": ${result?.count || 0} results`);
  });

  console.log('\n✅ Database check complete!');
  db.close();

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
