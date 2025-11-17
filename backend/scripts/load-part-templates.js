/**
 * Load Part Templates into database
 * This script populates the part_templates table with predefined parts for each object type
 */

import db from '../src/db/init.js';
import { logger } from '../src/utils/logger.js';

const templates = [
  // BRIDGE templates
  { object_type: 'bridge', part_name: 'ZÁKLADY', display_order: 1, is_default: true },
  { object_type: 'bridge', part_name: 'OPĚRY', display_order: 2, is_default: true },
  { object_type: 'bridge', part_name: 'SLOUPY', display_order: 3, is_default: true },
  { object_type: 'bridge', part_name: 'PILÍŘE', display_order: 4, is_default: true },
  { object_type: 'bridge', part_name: 'LOŽISKA', display_order: 5, is_default: true },
  { object_type: 'bridge', part_name: 'NOSNÁ KONSTRUKCE', display_order: 6, is_default: true },
  { object_type: 'bridge', part_name: 'MOSTOVKA', display_order: 7, is_default: true },
  { object_type: 'bridge', part_name: 'IZOLACE', display_order: 8, is_default: true },
  { object_type: 'bridge', part_name: 'ŘÍMSY', display_order: 9, is_default: true },
  { object_type: 'bridge', part_name: 'ZÁVĚRNÉ ZÍDKY', display_order: 10, is_default: true },
  { object_type: 'bridge', part_name: 'PŘECHODY', display_order: 11, is_default: true },
  { object_type: 'bridge', part_name: 'SVODIDLA', display_order: 12, is_default: true },

  // BUILDING templates
  { object_type: 'building', part_name: 'ZÁKLADY', display_order: 1, is_default: true },
  { object_type: 'building', part_name: 'SUTERÉN', display_order: 2, is_default: true },
  { object_type: 'building', part_name: 'NOSNÉ ZÍDKY', display_order: 3, is_default: true },
  { object_type: 'building', part_name: 'SLOUPY', display_order: 4, is_default: true },
  { object_type: 'building', part_name: 'STROPY', display_order: 5, is_default: true },
  { object_type: 'building', part_name: 'SCHODIŠTĚ', display_order: 6, is_default: true },
  { object_type: 'building', part_name: 'ATIKA', display_order: 7, is_default: true },
  { object_type: 'building', part_name: 'BALKONY', display_order: 8, is_default: true },

  // PARKING templates
  { object_type: 'parking', part_name: 'ZÁKLADY', display_order: 1, is_default: true },
  { object_type: 'parking', part_name: 'PODKLADNÍ BETON', display_order: 2, is_default: true },
  { object_type: 'parking', part_name: 'RAMPY', display_order: 3, is_default: true },
  { object_type: 'parking', part_name: 'STROPNÍ DESKY', display_order: 4, is_default: true },
  { object_type: 'parking', part_name: 'SLOUPY', display_order: 5, is_default: true },
  { object_type: 'parking', part_name: 'OBVODOVÉ ZÍDKY', display_order: 6, is_default: true },

  // ROAD templates
  { object_type: 'road', part_name: 'ZEMNÍ PRÁCE', display_order: 1, is_default: true },
  { object_type: 'road', part_name: 'PODKLAD', display_order: 2, is_default: true },
  { object_type: 'road', part_name: 'ZÁKLADNÍ VRSTVA', display_order: 3, is_default: true },
  { object_type: 'road', part_name: 'LOŽNÁ VRSTVA', display_order: 4, is_default: true },
  { object_type: 'road', part_name: 'KRYT', display_order: 5, is_default: true },
  { object_type: 'road', part_name: 'KRAJNICE', display_order: 6, is_default: true },
  { object_type: 'road', part_name: 'OBRUBY', display_order: 7, is_default: true },
  { object_type: 'road', part_name: 'ODVODNĚNÍ', display_order: 8, is_default: true },
];

async function loadTemplates() {
  try {
    logger.info('Starting part templates load...');
    
    // Check if templates already exist
    const existing = await db.prepare('SELECT COUNT(*) as count FROM part_templates').get();
    
    if (existing.count > 0) {
      logger.warn(`Part templates table already has ${existing.count} records.`);
      console.log('\n⚠️  WARNING: Part templates already exist!');
      console.log('Do you want to:');
      console.log('  1) Skip loading (keep existing)');
      console.log('  2) Delete all and reload');
      console.log('\nTo reload: DELETE FROM part_templates; then run this script again.');
      process.exit(0);
    }
    
    // Insert all templates
    let inserted = 0;
    for (const template of templates) {
      const template_id = `${template.object_type}_${template.part_name}`;
      await db.prepare(`
        INSERT INTO part_templates (template_id, object_type, part_name, display_order, is_default)
        VALUES (?, ?, ?, ?, ?)
      `).run(template_id, template.object_type, template.part_name, template.display_order, template.is_default);
      inserted++;
    }
    
    logger.info(`✅ Successfully loaded ${inserted} part templates`);
    console.log(`\n✅ SUCCESS! Loaded ${inserted} part templates:`);
    
    // Show summary by object type
    const summary = await db.prepare(`
      SELECT object_type, COUNT(*) as count 
      FROM part_templates 
      GROUP BY object_type 
      ORDER BY object_type
    `).all();
    
    console.log('\nTemplates by object type:');
    summary.forEach(s => {
      console.log(`  ${s.object_type}: ${s.count} parts`);
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('Error loading part templates:', error);
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

loadTemplates();
