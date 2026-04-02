/**
 * VZ Metadata Enrichment Service (Stage 2.5)
 *
 * Enriches rozpocet_source records with CPV codes from VVZ metadata.
 * JOIN strategy: match by zadavatel IČO + dodavatel IČO or by název.
 *
 * Pipeline:
 *   1. Fetch VZ results (form_type=29) from vvz.nipez.cz
 *   2. For each VZ: extract IČO, CPV, název
 *   3. Match against rozpocet_source (by IČO or fuzzy name)
 *   4. Update rozpocet_source with CPV metadata
 */

import { getDatabase } from '../db/init.js';
import { logger } from '../utils/logger.js';
import VvzClient from './vvzClient.js';
import { ensureSchema } from './smlouvyCollector.js';

// ============================================================================
// Schema migration — add VZ/CPV fields
// ============================================================================

const MIGRATION_SQL = `
-- VZ metadata fields on rozpocet_source
-- Using ALTER TABLE IF NOT EXISTS pattern (SQLite doesn't support IF NOT EXISTS for columns)

-- We'll check if columns exist before adding
PRAGMA table_info(rozpocet_source);
`;

async function ensureVzFields(db) {
  try {
    // Check if cpv_hlavni column exists
    const columns = await db.all("PRAGMA table_info(rozpocet_source)");
    const columnNames = new Set(columns.map(c => c.name));

    const newColumns = [
      { name: 'cpv_hlavni', type: 'TEXT' },
      { name: 'cpv_doplnkove', type: 'TEXT' },  // JSON array
      { name: 'vz_ev_cislo', type: 'TEXT' },
      { name: 'vz_nazev', type: 'TEXT' },
      { name: 'dodavatel_ico', type: 'TEXT' },
      { name: 'dodavatel_nazev', type: 'TEXT' },
      { name: 'zadavatel_ico', type: 'TEXT' },
      { name: 'vz_enriched_at', type: 'TIMESTAMP' },
    ];

    for (const col of newColumns) {
      if (!columnNames.has(col.name)) {
        await db.run(`ALTER TABLE rozpocet_source ADD COLUMN ${col.name} ${col.type}`);
        logger.info(`[VZ-ENRICH] Added column: ${col.name}`);
      }
    }

    // Add indexes (safe — CREATE INDEX IF NOT EXISTS)
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_rozpocet_source_cpv ON rozpocet_source(cpv_hlavni);
      CREATE INDEX IF NOT EXISTS idx_rozpocet_source_zadavatel_ico ON rozpocet_source(zadavatel_ico);
      CREATE INDEX IF NOT EXISTS idx_rozpocet_source_dodavatel_ico ON rozpocet_source(dodavatel_ico);
      CREATE INDEX IF NOT EXISTS idx_rozpocet_source_vz_ev ON rozpocet_source(vz_ev_cislo);
    `);

    // Add cpv_correlation to work_packages if needed
    const wpColumns = await db.all("PRAGMA table_info(work_packages)").catch(() => []);
    const wpColNames = new Set(wpColumns.map(c => c.name));
    if (!wpColNames.has('cpv_correlation')) {
      await db.run('ALTER TABLE work_packages ADD COLUMN cpv_correlation TEXT');
      logger.info('[VZ-ENRICH] Added cpv_correlation to work_packages');
    }

    // VZ cache table for storing fetched VZ metadata
    await db.exec(`
      CREATE TABLE IF NOT EXISTS vz_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vz_id TEXT UNIQUE,
        variable_id TEXT,
        ev_cislo TEXT,
        nazev TEXT,
        cpv TEXT,
        zadavatel_ico TEXT,
        zadavatel_nazev TEXT,
        dodavatel_ico TEXT,
        dodavatel_nazev TEXT,
        datum_uverejneni TEXT,
        predpokladana_cena REAL,
        konecna_cena REAL,
        matched_source_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_vz_zadavatel ON vz_metadata(zadavatel_ico);
      CREATE INDEX IF NOT EXISTS idx_vz_dodavatel ON vz_metadata(dodavatel_ico);
      CREATE INDEX IF NOT EXISTS idx_vz_ev_cislo ON vz_metadata(ev_cislo);
      CREATE INDEX IF NOT EXISTS idx_vz_cpv ON vz_metadata(cpv);
    `);

    logger.info('[VZ-ENRICH] Schema migration complete');
  } catch (err) {
    logger.error(`[VZ-ENRICH] Schema migration error: ${err.message}`);
    throw err;
  }
}

// ============================================================================
// Fetch VZ metadata from vvz.nipez.cz
// ============================================================================

// Active enrichment state
let activeEnrichment = null;

/**
 * Start VZ metadata collection from vvz.nipez.cz.
 *
 * @param {Object} opts
 * @param {string} opts.cpv - CPV prefix (default: '45')
 * @param {number} opts.maxPages - Max pages to fetch (default: 20)
 * @returns {Promise<Object>} Run status
 */
export async function startVzCollection({ cpv = '45', maxPages = 20 } = {}) {
  if (activeEnrichment?.status === 'running') {
    throw new Error('VZ enrichment already in progress');
  }

  await ensureSchema();
  const db = await getDatabase();
  await ensureVzFields(db);

  const client = new VvzClient();

  activeEnrichment = {
    status: 'running',
    fetched: 0,
    stored: 0,
    matched: 0,
    errors: 0,
    startedAt: Date.now(),
  };

  // Run in background
  _runVzCollection(db, client, cpv, maxPages).catch(err => {
    logger.error(`[VZ-ENRICH] Fatal: ${err.message}`);
    activeEnrichment.status = 'error';
    activeEnrichment.error = err.message;
  });

  return { status: 'started', cpv };
}

async function _runVzCollection(db, client, cpv, maxPages) {
  logger.info(`[VZ-ENRICH] Fetching VZ with CPV ${cpv} (max ${maxPages} pages)`);

  const items = await client.searchAll({
    cpv,
    formType: 'result',
    maxPages,
    limit: 100,
    onPage: (page, items, total) => {
      activeEnrichment.fetched += items.length;
    },
  });

  logger.info(`[VZ-ENRICH] Fetched ${items.length} VZ items`);

  // Store in vz_metadata table
  for (const item of items) {
    try {
      await db.run(
        `INSERT OR IGNORE INTO vz_metadata
          (vz_id, variable_id, ev_cislo, nazev, cpv,
           zadavatel_ico, zadavatel_nazev, dodavatel_ico, dodavatel_nazev,
           datum_uverejneni, predpokladana_cena, konecna_cena)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.variableId,
          item.evCislo,
          item.nazev,
          item.cpv,
          item.zadavatel?.ico,
          item.zadavatel?.nazev,
          item.dodavatel?.ico,
          item.dodavatel?.nazev,
          item.datumUverejneni,
          item.predpokladanaCena,
          item.konecnaCena,
        ]
      );
      activeEnrichment.stored++;
    } catch (err) {
      logger.warn(`[VZ-ENRICH] Failed to store VZ item ${item.id}: ${err.message}`);
      activeEnrichment.errors++;
    }
  }

  // Now run the JOIN enrichment
  const matchCount = await enrichSourcesFromVz(db);
  activeEnrichment.matched = matchCount;

  activeEnrichment.status = 'completed';
  logger.info(`[VZ-ENRICH] Done: ${activeEnrichment.stored} stored, ${matchCount} matched`);
}

// ============================================================================
// JOIN: Match VZ metadata → rozpocet_source
// ============================================================================

/**
 * Enrich rozpocet_source records with CPV from vz_metadata.
 * Match strategies (in order):
 *   1. Exact IČO match: zadavatel from source matches zadavatel from VZ
 *   2. Fuzzy name match: smlouva.predmet contains VZ.nazev keywords
 *
 * @returns {Promise<number>} Number of sources enriched
 */
async function enrichSourcesFromVz(db) {
  let matched = 0;

  // Strategy 1: Match by zadavatel name (since we may not have IČO in smlouvy)
  // Get all unenriched sources
  const sources = await db.all(
    "SELECT id, predmet, nazev, zadavatel, hodnota_czk FROM rozpocet_source WHERE cpv_hlavni IS NULL"
  );

  if (sources.length === 0) {
    logger.info('[VZ-ENRICH] No unenriched sources to match');
    return 0;
  }

  // Get all VZ metadata
  const vzItems = await db.all(
    "SELECT * FROM vz_metadata WHERE cpv IS NOT NULL"
  );

  if (vzItems.length === 0) {
    logger.info('[VZ-ENRICH] No VZ metadata to match against');
    return 0;
  }

  // Build index by zadavatel name (lowercase, trimmed)
  const vzByZadavatel = new Map();
  for (const vz of vzItems) {
    if (vz.zadavatel_nazev) {
      const key = normalizeForMatch(vz.zadavatel_nazev);
      if (!vzByZadavatel.has(key)) vzByZadavatel.set(key, []);
      vzByZadavatel.get(key).push(vz);
    }
  }

  // Match each source
  for (const source of sources) {
    const bestMatch = findBestVzMatch(source, vzItems, vzByZadavatel);
    if (bestMatch) {
      await db.run(
        `UPDATE rozpocet_source SET
          cpv_hlavni = ?,
          vz_ev_cislo = ?,
          vz_nazev = ?,
          dodavatel_ico = ?,
          dodavatel_nazev = ?,
          zadavatel_ico = ?,
          vz_enriched_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          bestMatch.cpv,
          bestMatch.ev_cislo,
          bestMatch.nazev,
          bestMatch.dodavatel_ico,
          bestMatch.dodavatel_nazev,
          bestMatch.zadavatel_ico,
          source.id,
        ]
      );

      // Update vz_metadata with match
      if (bestMatch.id) {
        await db.run(
          'UPDATE vz_metadata SET matched_source_id = ? WHERE id = ?',
          [source.id, bestMatch.id]
        );
      }

      matched++;
    }
  }

  logger.info(`[VZ-ENRICH] Matched ${matched}/${sources.length} sources with VZ metadata`);
  return matched;
}

/**
 * Find best VZ match for a given source.
 */
function findBestVzMatch(source, vzItems, vzByZadavatel) {
  // Strategy 1: Match by zadavatel name
  if (source.zadavatel) {
    const key = normalizeForMatch(source.zadavatel);
    const candidates = vzByZadavatel.get(key);
    if (candidates?.length > 0) {
      // If multiple candidates, pick the one with closest value
      return pickClosestByValue(candidates, source.hodnota_czk);
    }
  }

  // Strategy 2: Fuzzy name match — extract keywords from source.predmet
  // and find VZ with matching keywords
  if (source.predmet) {
    const sourceKeywords = extractMatchKeywords(source.predmet);
    if (sourceKeywords.length < 2) return null;

    let bestScore = 0;
    let bestVz = null;

    for (const vz of vzItems) {
      if (!vz.nazev) continue;
      const vzKeywords = extractMatchKeywords(vz.nazev);
      const overlap = sourceKeywords.filter(k => vzKeywords.includes(k)).length;
      const score = overlap / Math.max(sourceKeywords.length, vzKeywords.length);

      if (score > bestScore && score >= 0.3) {
        bestScore = score;
        bestVz = vz;
      }
    }

    return bestVz;
  }

  return null;
}

function normalizeForMatch(text) {
  return (text || '').toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?"'()[\]{}]/g, '');
}

function extractMatchKeywords(text) {
  const stopwords = new Set([
    'a', 'v', 'na', 'je', 'se', 'z', 'do', 'pro', 'od', 'po', 'při',
    'ze', 'za', 'ke', 'ku', 'nebo', 'ale', 'že', 'i', 'to', 'být',
    'smlouva', 'dílo', 'zakázka', 'veřejná', 'dodávka',
  ]);
  return normalizeForMatch(text)
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
}

function pickClosestByValue(candidates, targetValue) {
  if (!targetValue || candidates.length === 1) return candidates[0];
  return candidates.reduce((best, c) => {
    const cVal = c.konecna_cena || c.predpokladana_cena || 0;
    const bestVal = best.konecna_cena || best.predpokladana_cena || 0;
    const cDiff = Math.abs(cVal - targetValue);
    const bestDiff = Math.abs(bestVal - targetValue);
    return cDiff < bestDiff ? c : best;
  });
}

// ============================================================================
// Status & stats
// ============================================================================

export function getVzEnrichmentStatus() {
  if (!activeEnrichment) return { status: 'idle' };
  return {
    ...activeEnrichment,
    elapsed: Math.round((Date.now() - activeEnrichment.startedAt) / 1000),
  };
}

export async function getVzStats() {
  await ensureSchema();
  const db = await getDatabase();
  await ensureVzFields(db);

  const [vzTotal, sourceTotal, enriched, cpvBreakdown] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM vz_metadata'),
    db.get('SELECT COUNT(*) as count FROM rozpocet_source'),
    db.get('SELECT COUNT(*) as count FROM rozpocet_source WHERE cpv_hlavni IS NOT NULL'),
    db.all(
      `SELECT cpv_hlavni as cpv, COUNT(*) as count
       FROM rozpocet_source
       WHERE cpv_hlavni IS NOT NULL
       GROUP BY cpv_hlavni
       ORDER BY count DESC
       LIMIT 20`
    ),
  ]);

  return {
    vz_metadata_count: vzTotal.count,
    sources_total: sourceTotal.count,
    sources_enriched: enriched.count,
    enrichment_rate: sourceTotal.count > 0
      ? Math.round(enriched.count / sourceTotal.count * 100)
      : 0,
    cpv_breakdown: cpvBreakdown,
  };
}

export { ensureVzFields };
