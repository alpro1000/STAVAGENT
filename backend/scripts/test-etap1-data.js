/**
 * Direct database check - ETAP 1
 * Check if OTSKP codes exist and have proper structure
 */

import Database from 'better-sqlite3';

const db = new Database('/home/user/Monolit-Planner/backend/data/monolit.db');

console.log('\n📊 ETAP 1: ЗАГРУЗКА ДАННЫХ\n');

// Check 1: Total count
console.log('✓ Check 1: Количество кодов в таблице');
const countResult = db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();
console.log(`  → Всего кодов: ${countResult.count}`);

if (countResult.count === 0) {
  console.log('  ❌ ПРОБЛЕМА: Таблица пуста! Коды не загружены!');
  process.exit(1);
}

// Check 2: Sample codes structure
console.log('\n✓ Check 2: Структура данных (первые 3 кода)');
const samples = db.prepare('SELECT code, name, unit, unit_price FROM otskp_codes LIMIT 3').all();
samples.forEach((item, i) => {
  console.log(`\n  ${i + 1}. Code: ${item.code}`);
  console.log(`     Name: ${item.name.substring(0, 60)}...`);
  console.log(`     Unit: ${item.unit}`);
  console.log(`     Price: ${item.unit_price} CZK`);
});

// Check 3: Codes with empty names
console.log('\n✓ Check 3: Коды с пустыми названиями');
const emptyNames = db.prepare("SELECT COUNT(*) as count FROM otskp_codes WHERE name IS NULL OR name = ''").get();
console.log(`  → Кодов с пустыми названиями: ${emptyNames.count}`);

if (emptyNames.count > 0) {
  console.log('  ⚠️  ВНИМАНИЕ: Есть коды без названий!');
}

// Check 4: Sample search by name
console.log('\n✓ Check 4: Поиск по названию "ZÁKLADY"');
const searchByName = db.prepare(`
  SELECT code, name FROM otskp_codes
  WHERE name LIKE '%ZÁKLADY%'
  LIMIT 3
`).all();
console.log(`  → Найдено результатов: ${searchByName.length}`);
if (searchByName.length > 0) {
  searchByName.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.code} - ${item.name.substring(0, 50)}...`);
  });
} else {
  console.log('  ❌ Не найдено! Проблема с поиском или данными');
}

// Check 5: Sample search by code
console.log('\n✓ Check 5: Поиск по коду "113472"');
const searchByCode = db.prepare(`
  SELECT code, name FROM otskp_codes
  WHERE code LIKE '113472%'
  LIMIT 3
`).all();
console.log(`  → Найдено результатов: ${searchByCode.length}`);
if (searchByCode.length > 0) {
  searchByCode.forEach((item) => {
    console.log(`  ${item.code} - ${item.name}`);
  });
} else {
  console.log('  ❌ Не найдено код!');
}

// Check 6: Verify indexes exist
console.log('\n✓ Check 6: Индексы для быстрого поиска');
const indexes = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='index' AND name LIKE 'idx_otskp%'
`).all();
console.log(`  → Индексов найдено: ${indexes.length}`);
indexes.forEach(idx => {
  console.log(`  ✓ ${idx.name}`);
});

console.log('\n✅ ETAP 1 COMPLETE\n');

db.close();
