#!/usr/bin/env node

/**
 * Import KROS URS Catalog from CSV files exported from KROS 2026/I.
 *
 * KROS CSV format (no headers, semicolon-delimited):
 *   Column 1: URS code (8-9 digits)
 *   Column 2: Type (K = HSV/kapitola, M = PSV/montáž, S = specifikace)
 *   Column 3: Abbreviated search keywords
 *
 * This script:
 *   1. Loads URS201801.csv (39,742 URS codes with keywords)
 *   2. Cross-references with OTSKP XML (17,904 items with FULL descriptions + prices)
 *   3. Imports everything into SQLite urs_items table
 *   4. Builds word index for fuzzy search
 *
 * Usage:
 *   node scripts/import_kros_urs.mjs [--truncate]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');

// ============================================================================
// CONFIG
// ============================================================================

const URS_CSV = path.join(DATA_DIR, 'URS201801.csv');
const CENEKON_CSV = path.join(DATA_DIR, 'CENEKON201801.csv');
const TSP_CSV = path.join(DATA_DIR, 'TSP201801.csv');
const TSKP_FULL_CSV = path.join(DATA_DIR, 'TSKP_KROS_full.csv');
const OTSKP_XML = (() => {
  // Docker path (copied at build time)
  const dockerPath = '/app/concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml';
  // Local dev path (monorepo)
  const localPath = path.resolve(__dirname, '../../../concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml');
  // Fallback: data dir
  const dataPath = path.join(DATA_DIR, '2025_03_otskp.xml');

  if (fs.existsSync(dockerPath)) return dockerPath;
  if (fs.existsSync(localPath)) return localPath;
  return dataPath;
})();
const DB_PATH = path.join(DATA_DIR, 'urs_matcher.db');

// KROS type mapping
const TYPE_MAP = {
  'K': 'HSV',   // Hlavní stavební výroba
  'M': 'PSV',   // Přidružená stavební výroba
  'S': 'SPEC',  // Specifikace
};

// TSKP section names (first 1-2 digits → category)
const SECTION_NAMES = {
  '0': 'Vedlejší rozpočtové náklady',
  '1': 'Zemní práce',
  '2': 'Zakládání',
  '3': 'Svislé konstrukce',
  '4': 'Vodorovné konstrukce',
  '5': 'Komunikace',
  '6': 'Úpravy povrchů',
  '7': 'Podlahy, podlahové konstrukce',
  '8': 'Trubní vedení',
  '9': 'Ostatní konstrukce',
  '71': 'Izolace',
  '72': 'Zdravotechnika',
  '73': 'Ústřední vytápění',
  '74': 'Silnoproud',
  '75': 'Slaboproud',
  '76': 'Konstrukce',
  '77': 'Podlahy',
  '78': 'Obklady',
};

// ============================================================================
// UTILITIES
// ============================================================================

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function parseSemicolonCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim().replace(/\r$/, '');
    if (!trimmed) continue;

    const parts = trimmed.split(';');
    if (parts.length < 3) continue;

    const code = parts[0].trim();
    const type = parts[1].trim();
    const keywords = parts.slice(2).join(';').trim();

    // Skip scientific notation codes (Excel corruption)
    if (code.includes('E+') || code.includes('e+')) continue;
    // Skip non-numeric codes
    if (!/^\d+$/.test(code)) continue;

    items.push({ code, type, keywords });
  }

  return items;
}

function getSectionCode(code) {
  return code.substring(0, 2);
}

function getSectionName(code) {
  const s2 = code.substring(0, 2);
  const s1 = code.substring(0, 1);
  return SECTION_NAMES[s2] || SECTION_NAMES[s1] || 'Ostatní';
}

function getUnitFromType(type) {
  // Default units by type — will be overridden by OTSKP if available
  return type === 'K' ? '' : '';
}

// ============================================================================
// LOAD TSKP HIERARCHY (full Czech descriptions from KROS.MDB export)
// ============================================================================

function loadTSKPHierarchy() {
  if (!fs.existsSync(TSKP_FULL_CSV)) {
    log(`⚠ TSKP_KROS_full.csv not found — run: mdb-export KROS.MDB TSKP > TSKP_KROS_full.csv`);
    return new Map();
  }

  log(`Loading TSKP hierarchy from KROS.MDB export...`);
  const content = fs.readFileSync(TSKP_FULL_CSV, 'utf-8');
  const lines = content.split('\n');

  // Parse CSV header
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const kodIdx = header.indexOf('Kod');
  const popisIdx = header.indexOf('PopisSkrateny'); // Full hierarchical description
  const popisShortIdx = header.indexOf('Popis');     // Short name
  const urovenIdx = header.indexOf('Uroven');

  if (kodIdx === -1 || popisIdx === -1) {
    log(`⚠ TSKP CSV missing Kod or PopisSkrateny columns`);
    return new Map();
  }

  const tskpMap = new Map(); // code prefix → full description

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (TSKP has no commas in values, so split works)
    // But values may be quoted
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    parts.push(current.trim());

    const kod = parts[kodIdx] || '';
    const popisFull = parts[popisIdx] || '';
    const popisShort = parts[popisShortIdx] || '';

    if (kod && popisFull) {
      tskpMap.set(kod, popisFull);
    }
  }

  log(`✓ Loaded ${tskpMap.size} TSKP entries with full descriptions`);
  return tskpMap;
}

/**
 * Build a human-readable description for a URS code using TSKP hierarchy.
 * E.g., code 274313811 → tries 27431, 2743, 274, 27 → finds best TSKP match.
 */
function buildDescriptionFromTSKP(code, tskpMap) {
  // Try longest prefix first (most specific)
  for (let len = Math.min(code.length, 6); len >= 2; len--) {
    const prefix = code.substring(0, len);
    const desc = tskpMap.get(prefix);
    if (desc) return desc;
  }
  return null;
}

// ============================================================================
// LOAD OTSKP XML (for full descriptions + prices)
// ============================================================================

function loadOTSKPXml() {
  if (!fs.existsSync(OTSKP_XML)) {
    log(`⚠ OTSKP XML not found: ${OTSKP_XML}`);
    return new Map();
  }

  log(`Loading OTSKP XML for cross-reference...`);
  const content = fs.readFileSync(OTSKP_XML, 'utf-8');

  const items = new Map();
  // Parse Polozka elements: <Polozka><znacka>...</znacka><nazev>...</nazev>...
  const regex = /<Polozka>([\s\S]*?)<\/Polozka>/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const block = match[1];
    const getField = (name) => {
      const m = block.match(new RegExp(`<${name}>([^<]*)</${name}>`));
      return m ? m[1].trim() : '';
    };

    const code = getField('znacka');
    const name = getField('nazev');
    const unit = getField('MJ');
    const price = parseFloat(getField('jedn_cena')) || 0;
    const spec = getField('technicka_specifikace');

    if (code && name) {
      items.set(code, { name, unit, price, spec });
    }
  }

  log(`✓ Loaded ${items.size} OTSKP items with full descriptions`);
  return items;
}

// ============================================================================
// IMPORT
// ============================================================================

async function main() {
  const truncate = process.argv.includes('--truncate');

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('KROS URS Catalog Import');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Load reference data
  const otskp = loadOTSKPXml();
  const tskpMap = loadTSKPHierarchy();

  // 2. Parse KROS CSV files
  log('');
  log('Parsing URS201801.csv...');
  const ursItems = parseSemicolonCSV(URS_CSV);
  log(`✓ Parsed ${ursItems.length} URS codes`);

  log('Parsing CENEKON201801.csv...');
  const cenekonItems = parseSemicolonCSV(CENEKON_CSV);
  log(`✓ Parsed ${cenekonItems.length} CENEKON entries`);

  // Build CENEKON lookup (code → keywords for supplementary data)
  const cenekonMap = new Map();
  for (const item of cenekonItems) {
    if (!cenekonMap.has(item.code)) {
      cenekonMap.set(item.code, item.keywords);
    }
  }

  // 3. Merge: URS codes + OTSKP descriptions + CENEKON keywords
  log('');
  log('Merging data sources...');

  const merged = [];
  let otskpMatches = 0;
  let tskpMatches = 0;
  let keywordsOnly = 0;

  for (const urs of ursItems) {
    const otskpItem = otskp.get(urs.code);

    let name, unit, price, description;

    if (otskpItem) {
      // Full OTSKP data available (best quality)
      name = otskpItem.name;
      unit = otskpItem.unit || '';
      price = otskpItem.price;
      description = otskpItem.spec || null;
      otskpMatches++;
    } else {
      // Try TSKP hierarchy for a meaningful description
      const tskpDesc = buildDescriptionFromTSKP(urs.code, tskpMap);
      if (tskpDesc) {
        name = tskpDesc;
        tskpMatches++;
      } else {
        // Fallback: KROS search keywords
        name = urs.keywords;
        keywordsOnly++;
      }
      unit = '';
      price = 0;
      description = null;
    }

    // Add CENEKON keywords as extra search terms
    const cenekonKw = cenekonMap.get(urs.code);

    merged.push({
      code: urs.code,
      name,
      unit,
      price,
      type: TYPE_MAP[urs.type] || urs.type,
      section_code: getSectionCode(urs.code),
      category_path: `${getSectionName(urs.code)} > ${TYPE_MAP[urs.type] || urs.type}`,
      description: description || (cenekonKw ? cenekonKw : null),
    });
  }

  log(`✓ ${otskpMatches} items with full OTSKP descriptions + prices`);
  log(`✓ ${tskpMatches} items with TSKP hierarchy descriptions`);
  log(`✓ ${keywordsOnly} items with KROS keywords only`);
  log(`✓ ${merged.length} total items ready for import`);

  // 4. Import into SQLite
  log('');
  log(`Connecting to database: ${DB_PATH}`);

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  // Ensure table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS urs_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      urs_code TEXT UNIQUE NOT NULL,
      urs_name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      description TEXT,
      section_code TEXT,
      category_path TEXT,
      is_imported INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add price column if missing
  try {
    await db.exec('ALTER TABLE urs_items ADD COLUMN price REAL DEFAULT 0');
    log('Added price column');
  } catch (e) {
    // Column exists
  }

  // Add source column if missing
  try {
    await db.exec("ALTER TABLE urs_items ADD COLUMN source TEXT DEFAULT 'kros'");
    log('Added source column');
  } catch (e) {
    // Column exists
  }

  if (truncate) {
    log('⚠ Truncating existing imported items...');
    await db.run('DELETE FROM urs_items WHERE is_imported = 1');
  }

  // Batch insert
  const BATCH_SIZE = 500;
  let imported = 0;
  let skipped = 0;

  log('');
  log('Importing into SQLite...');

  for (let i = 0; i < merged.length; i += BATCH_SIZE) {
    const batch = merged.slice(i, i + BATCH_SIZE);

    await db.run('BEGIN TRANSACTION');
    try {
      for (const item of batch) {
        try {
          await db.run(
            `INSERT INTO urs_items
             (urs_code, urs_name, unit, description, section_code, category_path, is_imported, price, source, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'kros', datetime('now'))
             ON CONFLICT(urs_code) DO UPDATE SET
               urs_name = CASE WHEN excluded.urs_name != '' AND length(excluded.urs_name) > length(urs_items.urs_name) THEN excluded.urs_name ELSE urs_items.urs_name END,
               unit = CASE WHEN excluded.unit != '' THEN excluded.unit ELSE urs_items.unit END,
               description = COALESCE(excluded.description, urs_items.description),
               section_code = COALESCE(excluded.section_code, urs_items.section_code),
               category_path = COALESCE(excluded.category_path, urs_items.category_path),
               price = CASE WHEN excluded.price > 0 THEN excluded.price ELSE urs_items.price END,
               is_imported = 1,
               updated_at = datetime('now')`,
            [item.code, item.name, item.unit, item.description,
             item.section_code, item.category_path, item.price]
          );
          imported++;
        } catch (e) {
          skipped++;
        }
      }
      await db.run('COMMIT');

      // Progress
      const pct = Math.round((i + batch.length) / merged.length * 100);
      if (pct % 10 === 0 || i + batch.length >= merged.length) {
        log(`  ${pct}% — ${imported} imported, ${skipped} skipped`);
      }
    } catch (e) {
      await db.run('ROLLBACK');
      log(`✗ Batch error: ${e.message}`);
    }
  }

  // 5. Create indexes
  log('');
  log('Creating indexes...');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_urs_code ON urs_items(urs_code)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_urs_name ON urs_items(urs_name)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_urs_section_code ON urs_items(section_code)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_urs_is_imported ON urs_items(is_imported)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_urs_price ON urs_items(price)');

  // 6. Verify
  const total = await db.get('SELECT COUNT(*) as cnt FROM urs_items');
  const withPrice = await db.get('SELECT COUNT(*) as cnt FROM urs_items WHERE price > 0');
  const withDesc = await db.get('SELECT COUNT(*) as cnt FROM urs_items WHERE length(urs_name) > 20');
  const sections = await db.all(
    'SELECT section_code, COUNT(*) as cnt FROM urs_items GROUP BY section_code ORDER BY cnt DESC LIMIT 15'
  );

  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('IMPORT COMPLETE');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`Total in database:     ${total.cnt}`);
  log(`With full description: ${withDesc.cnt}`);
  log(`With price:            ${withPrice.cnt}`);
  log('');
  log('Top sections:');
  for (const s of sections) {
    const name = SECTION_NAMES[s.section_code] || '';
    log(`  ${s.section_code}: ${s.cnt} items ${name ? '(' + name + ')' : ''}`);
  }

  await db.close();
  log('');
  log('✓ Done!');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
