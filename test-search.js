#!/usr/bin/env node
/**
 * Test OTSKP search functionality
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeForSearch } from './backend/src/utils/text.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'backend/data/monolit.db');

console.log('🔍 Testing OTSKP Search\n');

try {
  const db = new Database(dbPath);

  // Test searches
  const searches = [
    { query: 'zaklad', desc: 'Search for "zaklad" (without diacritics)' },
    { query: 'ZÁKLADY', desc: 'Search for "ZÁKLADY" (uppercase)' },
    { query: 'zaklady', desc: 'Search for "zaklady" (lowercase)' },
    { query: '27', desc: 'Search for code "27"' },
    { query: '27 211', desc: 'Search for code with space "27 211"' },
    { query: 'vykop', desc: 'Search for "vykop"' }
  ];

  searches.forEach(({ query, desc }) => {
    console.log(`\n📝 ${desc}`);
    console.log(`   Query: "${query}"`);

    const searchQueryUpper = query.toUpperCase();
    const normalizedQuery = normalizeForSearch(query);
    const normalizedPattern = `%${normalizedQuery.replace(/\s+/g, '%')}%`;

    const results = db.prepare(`
      SELECT code, name, unit, unit_price
      FROM otskp_codes
      WHERE
        UPPER(code) LIKE ?
        OR search_name LIKE ?
      LIMIT 5
    `).all(searchQueryUpper + '%', normalizedPattern);

    console.log(`   Results: ${results.length}`);
    if (results.length > 0) {
      results.forEach((r, i) => {
        console.log(`   ${i + 1}. [${r.code}] ${r.name.substring(0, 60)}...`);
      });
    } else {
      console.log(`   ❌ No results found`);
    }
  });

  console.log('\n✅ Search test complete!');
  db.close();

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
