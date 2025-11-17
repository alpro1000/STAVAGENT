/**
 * ETAP 2: Test API search directly in database
 */

import Database from 'better-sqlite3';

const db = new Database('/home/user/Monolit-Planner/backend/data/monolit.db');

console.log('\n📊 ETAP 2: ПРОВЕРКА SQL ЗАПРОСОВ\n');

// Test 1: Raw SQL without parameters
console.log('✓ Test 1: Поиск "VYKOP" в БД');
const test1 = db.prepare(`
  SELECT code, name FROM otskp_codes
  WHERE name LIKE '%VYKOP%'
  LIMIT 3
`).all();
console.log(`  → Результатов: ${test1.length}`);
test1.forEach(item => console.log(`    ${item.code} - ${item.name.substring(0, 40)}...`));

// Test 2: Search with ZÁKLADY
console.log('\n✓ Test 2: Поиск "ZÁKLADY" в БД');
const test2 = db.prepare(`
  SELECT code, name FROM otskp_codes
  WHERE name LIKE '%ZÁKLADY%'
  LIMIT 3
`).all();
console.log(`  → Результатов: ${test2.length}`);
test2.forEach(item => console.log(`    ${item.code} - ${item.name.substring(0, 40)}...`));

// Test 3: Test exact SQL from API code
console.log('\n✓ Test 3: Точный SQL запрос из API');
const searchQuery = 'VYKOP';
const results = db.prepare(`
  SELECT code, name, unit, unit_price, specification
  FROM otskp_codes
  WHERE code LIKE ? OR name LIKE ?
  ORDER BY
    CASE
      WHEN code = ? THEN 0
      WHEN code LIKE ? THEN 1
      ELSE 2
    END,
    code
  LIMIT ?
`).all(
  `${searchQuery}%`,           // code prefix
  `%${searchQuery}%`,          // name contains
  searchQuery,                 // exact code match
  `${searchQuery}%`,           // code prefix (for sorting)
  20
);
console.log(`  → Результатов: ${results.length}`);
results.forEach((item, i) => {
  if (i < 3) console.log(`    ${item.code} - ${item.name.substring(0, 40)}...`);
});

// Test 4: Case sensitivity
console.log('\n✓ Test 4: Чувствительность к регистру (lowercase)');
const lowerSearch = db.prepare(`
  SELECT code, name FROM otskp_codes
  WHERE name LIKE '%vykop%'
  LIMIT 3
`).all();
console.log(`  → Результатов (lowercase): ${lowerSearch.length}`);

// Test 5: ZÁKLADY with various cases
console.log('\n✓ Test 5: ZÁKLADY (разные варианты)');
const variants = ['ZÁKLADY', 'základy', 'Základy'];
variants.forEach(variant => {
  const count = db.prepare(`SELECT COUNT(*) as c FROM otskp_codes WHERE name LIKE ?`).get(`%${variant}%`);
  console.log(`  ${variant}: ${count.c} результатов`);
});

console.log('\n✅ ETAP 2 COMPLETE\n');

db.close();
