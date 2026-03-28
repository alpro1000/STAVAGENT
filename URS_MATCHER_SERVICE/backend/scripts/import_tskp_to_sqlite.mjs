#!/usr/bin/env node
/**
 * Import TSKP XML classification tree (11,991 items) into SQLite.
 *
 * Usage:
 *   node scripts/import_tskp_to_sqlite.mjs
 *   node scripts/import_tskp_to_sqlite.mjs --truncate
 *
 * Source: concrete-agent/.../xmk_tskp_tridnik.xml or backend/data/tridnik.xml
 */

import { parseStringPromise } from 'xml2js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '../../..');

const TSKP_PATHS = [
  path.join(__dirname, '../data/tridnik.xml'),
  path.join(MONOREPO_ROOT, 'concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/xmk_tskp_tridnik.xml'),
];
const TSKP_PATH = TSKP_PATHS.find(p => fs.existsSync(p));

const DB_PATH = path.join(__dirname, '../data/urs_matcher.db');
const TRUNCATE = process.argv.includes('--truncate');

async function main() {
  console.log('=== TSKP → SQLite Import ===');
  console.log(`XML: ${TSKP_PATH}`);
  console.log(`DB:  ${DB_PATH}`);

  if (!TSKP_PATH) {
    console.error('ERROR: TSKP XML not found');
    process.exit(1);
  }

  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  // Create tskp_items table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tskp_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      parent_code TEXT,
      level INTEGER DEFAULT 0,
      is_leaf INTEGER DEFAULT 0,
      full_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tskp_code ON tskp_items(code);
    CREATE INDEX IF NOT EXISTS idx_tskp_parent ON tskp_items(parent_code);
    CREATE INDEX IF NOT EXISTS idx_tskp_level ON tskp_items(level);
  `);

  if (TRUNCATE) {
    await db.exec('DELETE FROM tskp_items');
  }

  console.log('Parsing TSKP XML...');
  const xml = fs.readFileSync(TSKP_PATH, 'utf-8');
  const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true, trim: true });

  // Structure: BuildingInformation > Classification > System > Items > Item
  // Each Item has: ID, Name, Description, Children > Item (recursive)
  const system = parsed?.BuildingInformation?.Classification?.System;
  const rootItems = system?.Items?.Item;

  if (!rootItems) {
    console.error('ERROR: Could not find Items in XML. Keys:', Object.keys(parsed || {}));
    process.exit(1);
  }

  const items = [];

  function traverse(node, parentCode, level, pathParts) {
    if (!node) return;
    const nodes = Array.isArray(node) ? node : [node];

    for (const n of nodes) {
      const code = String(n.ID || '').trim();
      const name = String(n.Name || '').trim();
      if (!code || !name) continue;

      const currentPath = [...pathParts, `${code} ${name}`].join(' > ');
      const children = n.Children?.Item || null;
      const isLeaf = !children;

      items.push({ code, name, parentCode, level, isLeaf: isLeaf ? 1 : 0, fullPath: currentPath });

      if (children) {
        traverse(children, code, level + 1, [...pathParts, `${code} ${name}`]);
      }
    }
  }

  const rootNodes = Array.isArray(rootItems) ? rootItems : [rootItems];
  traverse(rootNodes, null, 0, []);

  console.log(`Found ${items.length} TSKP items`);

  // Batch insert
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await db.exec('BEGIN TRANSACTION');

    for (const item of batch) {
      try {
        await db.run(
          `INSERT INTO tskp_items (code, name, parent_code, level, is_leaf, full_path)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(code) DO UPDATE SET
             name = excluded.name,
             parent_code = excluded.parent_code,
             level = excluded.level,
             is_leaf = excluded.is_leaf,
             full_path = excluded.full_path`,
          [item.code, item.name, item.parentCode, item.level, item.isLeaf, item.fullPath]
        );
        inserted++;
      } catch {}
    }

    await db.exec('COMMIT');
    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }

  const total = await db.get('SELECT COUNT(*) as count FROM tskp_items');
  const levels = await db.all('SELECT level, COUNT(*) as count FROM tskp_items GROUP BY level ORDER BY level');

  console.log(`\n\n=== Import Complete ===`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Total:    ${total.count}`);
  console.log('\n  By level:');
  for (const l of levels) {
    console.log(`    Level ${l.level}: ${l.count} items`);
  }

  await db.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
