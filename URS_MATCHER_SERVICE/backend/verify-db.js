import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

(async () => {
  const db = await open({
    filename: './data/urs_matcher.db',
    driver: sqlite3.Database
  });

  // List tables
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('\n📊 Database Tables:');
  tables.forEach(t => console.log('  -', t.name));

  // Count rows in each table
  for (const table of tables) {
    const result = await db.get(`SELECT COUNT(*) as count FROM ${table.name}`);
    console.log(`\n📈 ${table.name}: ${result.count} rows`);
    
    if (table.name === 'urs_items' && result.count > 0) {
      const samples = await db.all(`SELECT * FROM ${table.name} LIMIT 3`);
      samples.forEach(row => {
        console.log(`    • ${row.urs_code} - ${row.urs_name} (${row.unit})`);
      });
    }
  }

  await db.close();
  console.log('\n✅ Database verification complete\n');
})();
