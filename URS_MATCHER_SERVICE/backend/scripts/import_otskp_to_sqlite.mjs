#!/usr/bin/env node
/**
 * Import OTSKP XML catalog (17,904 items) into SQLite urs_items table.
 *
 * Usage:
 *   node scripts/import_otskp_to_sqlite.mjs
 *   node scripts/import_otskp_to_sqlite.mjs --truncate   # clear existing items first
 *
 * Source: concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml
 */

import { parseStringPromise } from 'xml2js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths to OTSKP XML
// __dirname = URS_MATCHER_SERVICE/backend/scripts
// Monorepo root = 3 dirs up from scripts (scripts → backend → URS_MATCHER_SERVICE → STAVAGENT)
const MONOREPO_ROOT = path.resolve(__dirname, '../../..');
const KB_SUBPATH = 'concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml';

const DOCKER_PATH = `/app/${KB_SUBPATH}`;
const LOCAL_PATH = path.join(MONOREPO_ROOT, KB_SUBPATH);

const OTSKP_PATH = [DOCKER_PATH, LOCAL_PATH].find(p => fs.existsSync(p));

// DB path
const DB_PATH = path.join(__dirname, '../data/urs_matcher.db');

const TRUNCATE = process.argv.includes('--truncate');
const BATCH_SIZE = 500;

async function main() {
  console.log('=== OTSKP → SQLite Import ===');
  console.log(`XML path: ${OTSKP_PATH}`);
  console.log(`DB path:  ${DB_PATH}`);
  console.log(`Truncate: ${TRUNCATE}`);
  console.log();

  // Check XML exists
  if (!OTSKP_PATH) {
    console.error(`ERROR: OTSKP XML not found. Searched:\n  ${DOCKER_PATH}\n  ${LOCAL_PATH}`);
    process.exit(1);
  }

  // Ensure data dir
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Open DB
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // Create table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS urs_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      urs_code TEXT UNIQUE NOT NULL,
      urs_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      description TEXT,
      section_code TEXT,
      category_path TEXT,
      price REAL,
      is_imported INTEGER DEFAULT 1,
      source TEXT DEFAULT 'otskp',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_urs_code ON urs_items(urs_code);
    CREATE INDEX IF NOT EXISTS idx_urs_name ON urs_items(urs_name);
    CREATE INDEX IF NOT EXISTS idx_urs_section_code ON urs_items(section_code);
  `);

  // Add price column if missing (migration for existing DBs)
  try {
    await db.exec('ALTER TABLE urs_items ADD COLUMN price REAL');
  } catch { /* column already exists */ }
  try {
    await db.exec('ALTER TABLE urs_items ADD COLUMN source TEXT DEFAULT "otskp"');
  } catch { /* column already exists */ }

  if (TRUNCATE) {
    console.log('Truncating urs_items...');
    await db.exec('DELETE FROM urs_items');
  }

  // Parse XML
  console.log('Parsing OTSKP XML (17 MB)...');
  const xmlContent = fs.readFileSync(OTSKP_PATH, 'utf-8');
  const parsed = await parseStringPromise(xmlContent, {
    explicitArray: false,
    mergeAttrs: true,
    trim: true
  });

  const polozky = parsed?.XC4?.CenoveSoustavy?.Polozky?.Polozka;
  if (!polozky) {
    console.error('ERROR: Invalid XML structure');
    process.exit(1);
  }

  const items = Array.isArray(polozky) ? polozky : [polozky];
  console.log(`Found ${items.length} items in XML`);

  // TSKP section mapping for category_path
  const TSKP_SECTIONS = {
    '0': 'Vedlejší rozpočtové náklady',
    '1': 'Zemní práce',
    '2': 'Zakládání',
    '3': 'Svislé a kompletní konstrukce',
    '4': 'Vodorovné konstrukce',
    '5': 'Komunikace',
    '6': 'Úpravy povrchů, podlahy, osazování',
    '8': 'Trubní vedení',
    '9': 'Ostatní konstrukce a práce',
    '71': 'Izolace',
    '72': 'Zdravotechnika',
    '73': 'Ústřední vytápění',
    '74': 'Silnoproud',
    '75': 'Slaboproud',
    '76': 'Konstrukce',
    '77': 'Podlahy',
    '78': 'Dokončovací práce',
  };

  function getSectionInfo(code) {
    const c = String(code);
    // Try 2-char prefix first (PSV: 71-78)
    const p2 = c.substring(0, 2);
    if (TSKP_SECTIONS[p2]) {
      return { section: p2, path: `PSV > ${p2} > ${TSKP_SECTIONS[p2]}` };
    }
    // Then 1-char prefix (HSV: 0-9)
    const p1 = c.substring(0, 1);
    if (TSKP_SECTIONS[p1]) {
      return { section: p1, path: `HSV > ${p1} > ${TSKP_SECTIONS[p1]}` };
    }
    return { section: c.substring(0, 2), path: null };
  }

  // Batch insert
  const startTime = Date.now();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const sectionCounts = {};

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    await db.exec('BEGIN TRANSACTION');

    for (const p of batch) {
      if (!p.znacka) { skipped++; continue; }

      const code = String(p.znacka).trim();
      const name = String(p.nazev || '').trim();
      const unit = String(p.MJ || '').trim();
      const price = parseFloat(p.jedn_cena) || 0;
      const spec = String(p.technicka_specifikace || '').trim();
      const { section, path: categoryPath } = getSectionInfo(code);

      // Track section counts
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;

      try {
        await db.run(
          `INSERT INTO urs_items (urs_code, urs_name, unit, description, section_code, category_path, price, is_imported, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'otskp', datetime('now'))
           ON CONFLICT(urs_code) DO UPDATE SET
             urs_name = excluded.urs_name,
             unit = excluded.unit,
             description = excluded.description,
             section_code = excluded.section_code,
             category_path = excluded.category_path,
             price = excluded.price,
             is_imported = 1,
             source = 'otskp',
             updated_at = datetime('now')`,
          [code, name, unit, spec || null, section, categoryPath, price]
        );
        inserted++;
      } catch (err) {
        console.error(`  Error inserting ${code}: ${err.message}`);
        skipped++;
      }
    }

    await db.exec('COMMIT');

    const pct = Math.round(((i + batch.length) / items.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${items.length} (${pct}%)`);
  }

  console.log('\n');

  // Stats
  const totalCount = await db.get('SELECT COUNT(*) as count FROM urs_items');
  const importedCount = await db.get('SELECT COUNT(*) as count FROM urs_items WHERE is_imported = 1');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('=== Import Complete ===');
  console.log(`  Time:     ${elapsed}s`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Total DB: ${totalCount.count} items (${importedCount.count} imported)`);
  console.log();
  console.log('Section breakdown:');

  const sortedSections = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1]);
  for (const [section, count] of sortedSections) {
    const label = TSKP_SECTIONS[section] || '?';
    console.log(`  ${section.padEnd(4)} ${label.padEnd(45)} ${count}`);
  }

  await db.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
