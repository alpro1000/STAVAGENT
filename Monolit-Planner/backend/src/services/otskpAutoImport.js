/**
 * OTSKP Auto-Import Service
 * Automatically imports OTSKP catalog from XML at startup if the table is empty.
 * Handles both SQLite (sync) and PostgreSQL (async) modes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import db from '../db/init.js';
import { normalizeForSearch } from '../utils/text.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const XML_SEARCH_PATHS = [
  path.join(__dirname, '../../../2025_03 OTSKP.xml'),          // Monolit-Planner/2025_03 OTSKP.xml
  path.join(__dirname, '../../../../2025_03 OTSKP.xml'),        // repo root fallback
  '/app/2025_03 OTSKP.xml',                                     // Render absolute
  path.join(process.cwd(), '2025_03 OTSKP.xml'),                // cwd
];

function parseOtskpXml(xmlContent) {
  const items = [];
  let validCount = 0;
  let invalidCount = 0;

  xmlContent = xmlContent.replace(/^\uFEFF/, '');
  const polozkaRegex = /<Polozka>([\s\S]*?)<\/Polozka>/g;

  for (const match of xmlContent.matchAll(polozkaRegex)) {
    const c = match[1];
    const codeMatch = c.match(/<znacka>(.*?)<\/znacka>/);
    const nameMatch = c.match(/<nazev>(.*?)<\/nazev>/);
    const unitMatch = c.match(/<MJ>(.*?)<\/MJ>/);
    const priceMatch = c.match(/<jedn_cena>(.*?)<\/jedn_cena>/);
    const specMatch = c.match(/<technicka_specifikace>([\s\S]*?)<\/technicka_specifikace>/);

    if (!codeMatch?.[1]?.trim() || !nameMatch?.[1]?.trim() ||
        !unitMatch?.[1]?.trim() || !priceMatch || isNaN(parseFloat(priceMatch[1].trim()))) {
      invalidCount++;
      continue;
    }

    const name = nameMatch[1].trim();
    items.push({
      code: codeMatch[1].trim(),
      name,
      unit: unitMatch[1].trim(),
      unit_price: parseFloat(priceMatch[1].trim()),
      specification: specMatch ? specMatch[1].trim() : null,
      searchName: normalizeForSearch(name),
    });
    validCount++;
  }

  return { items, validCount, invalidCount };
}

export async function autoImportOtskpIfNeeded() {
  try {
    // Check if already loaded
    const countRow = await db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();
    if (countRow && countRow.count > 0) {
      logger.info(`[OTSKP AutoImport] Already loaded: ${countRow.count} codes — skipping`);
      return;
    }

    // Find XML file
    let xmlContent = null;
    let foundPath = null;
    for (const p of XML_SEARCH_PATHS) {
      if (fs.existsSync(p)) {
        foundPath = p;
        xmlContent = fs.readFileSync(p, 'utf-8');
        logger.info(`[OTSKP AutoImport] Found XML at: ${p} (${(xmlContent.length / 1024 / 1024).toFixed(1)} MB)`);
        break;
      }
    }

    if (!xmlContent) {
      logger.warn('[OTSKP AutoImport] XML file not found — OTSKP codes will not be available');
      logger.warn('[OTSKP AutoImport] Searched:', XML_SEARCH_PATHS);
      return;
    }

    // Parse
    logger.info('[OTSKP AutoImport] Parsing XML...');
    const { items, validCount, invalidCount } = parseOtskpXml(xmlContent);
    logger.info(`[OTSKP AutoImport] Parsed: ${validCount} valid, ${invalidCount} invalid`);

    if (items.length === 0) {
      logger.error('[OTSKP AutoImport] No valid items found in XML');
      return;
    }

    // Insert — use async/await safe approach for both SQLite and PostgreSQL
    logger.info(`[OTSKP AutoImport] Inserting ${items.length} items...`);
    await db.prepare('DELETE FROM otskp_codes').run();

    const sql = `INSERT INTO otskp_codes (code, name, unit, unit_price, specification, search_name)
                 VALUES (?, ?, ?, ?, ?, ?)`;

    if (db.isSqlite) {
      // SQLite: synchronous transaction
      const insertMany = db.transaction((rows) => {
        const stmt = db.prepare(sql);
        for (const item of rows) {
          stmt.run(item.code, item.name, item.unit, item.unit_price, item.specification, item.searchName);
        }
      });
      insertMany(items);
    } else {
      // PostgreSQL: async transaction
      const insertMany = db.transaction(async (client, rows) => {
        const stmt = client.prepare(sql);
        for (const item of rows) {
          await stmt.run(item.code, item.name, item.unit, item.unit_price, item.specification, item.searchName);
        }
      });
      await insertMany(items);
    }

    const verify = await db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();
    logger.info(`[OTSKP AutoImport] ✅ Import complete: ${verify.count} codes in DB`);

  } catch (err) {
    // Non-fatal: server starts fine, OTSKP search just returns empty
    logger.error('[OTSKP AutoImport] Import failed (non-fatal):', err.message);
  }
}
