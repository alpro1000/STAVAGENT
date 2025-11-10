/**
 * Verify OTSKP codes import
 */

import { db } from '../src/db/init.js';

console.log('\n📊 Database Verification:\n');

const totalCount = db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();
console.log(`✅ Total codes: ${totalCount.count}`);

const withNames = db.prepare('SELECT COUNT(*) as count FROM otskp_codes WHERE name IS NOT NULL AND name != ""').get();
console.log(`✅ Codes with names: ${withNames.count}`);

const uniqueUnits = db.prepare('SELECT COUNT(DISTINCT unit) as count FROM otskp_codes').get();
console.log(`✅ Unique units: ${uniqueUnits.count}`);

console.log('\n📝 Sample codes:');
const sampleCodes = db.prepare('SELECT code, name, unit FROM otskp_codes LIMIT 5').all();
sampleCodes.forEach((code, idx) => {
  console.log(`${idx + 1}. ${code.code} - ${code.name.substring(0, 50)}... [${code.unit}]`);
});

console.log('\n✅ Database verification complete!\n');
