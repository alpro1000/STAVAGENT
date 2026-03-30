/**
 * Smlouvy Collector Service
 *
 * Orchestrates: search → fetch → parse → store.
 * Manages batch collection from Hlídač státu API into SQLite.
 *
 * Usage:
 *   - Via API: POST /api/smlouvy/collect
 *   - Via CLI: node scripts/collect_smlouvy.mjs
 */

import { getDatabase } from '../db/init.js';
import { logger } from '../utils/logger.js';
import HlidacSmlouvyClient from './hlidacSmlouvyClient.js';
import { parseSmlouva } from './smlouvyParser.js';
import { processPrilohyXlsx } from './prilohaDownloader.js';

// ============================================================================
// DB Schema bootstrap (migration-safe)
// ============================================================================

const SCHEMA_SQL = `
-- Rozpočet sources (smlouvy)
CREATE TABLE IF NOT EXISTS rozpocet_source (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL DEFAULT 'hlidac_smlouva',
  hlidac_id TEXT UNIQUE,
  document_url TEXT,
  nazev TEXT,
  predmet TEXT,
  cpv TEXT,
  typ_objektu TEXT,
  typ_prace_hlavni TEXT,
  hodnota_czk REAL,
  rok INTEGER,
  zadavatel TEXT,
  format TEXT,
  prilohy_count INTEGER DEFAULT 0,
  prilohy_with_text INTEGER DEFAULT 0,
  download_status TEXT DEFAULT 'pending',
  parse_status TEXT DEFAULT 'pending',
  polozek_count INTEGER DEFAULT 0,
  parse_error TEXT,
  format_hints TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  parsed_at TIMESTAMP
);

-- Rozpočet položky (extracted positions)
CREATE TABLE IF NOT EXISTS rozpocet_polozky (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES rozpocet_source(id),
  kod_raw TEXT,
  popis TEXT,
  popis_detail TEXT,
  mj TEXT,
  mnozstvi REAL,
  jednotkova_cena REAL,
  kod_norm TEXT,
  kod_prefix TEXT,
  kod_system TEXT,
  kod_system_conf REAL,
  dil_3 TEXT,
  dil_6 TEXT,
  typ_prace TEXT,
  poradi INTEGER,
  nadrazeny_dil TEXT,
  source_file TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rozpocet_source_hlidac ON rozpocet_source(hlidac_id);
CREATE INDEX IF NOT EXISTS idx_rozpocet_source_status ON rozpocet_source(parse_status);
CREATE INDEX IF NOT EXISTS idx_rozpocet_source_rok ON rozpocet_source(rok);
CREATE INDEX IF NOT EXISTS idx_rozpocet_polozky_source ON rozpocet_polozky(source_id);
CREATE INDEX IF NOT EXISTS idx_rozpocet_polozky_kod ON rozpocet_polozky(kod_norm);
CREATE INDEX IF NOT EXISTS idx_rozpocet_polozky_system ON rozpocet_polozky(kod_system);
CREATE INDEX IF NOT EXISTS idx_rozpocet_polozky_typ ON rozpocet_polozky(typ_prace);
CREATE INDEX IF NOT EXISTS idx_rozpocet_polozky_dil3 ON rozpocet_polozky(dil_3);

-- Collection runs (track progress)
CREATE TABLE IF NOT EXISTS collection_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  total_found INTEGER DEFAULT 0,
  pages_fetched INTEGER DEFAULT 0,
  smlouvy_processed INTEGER DEFAULT 0,
  smlouvy_with_data INTEGER DEFAULT 0,
  positions_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
`;

async function ensureSchema() {
  const db = await getDatabase();
  await db.exec(SCHEMA_SQL);
  logger.info('[COLLECTOR] Schema ensured');
  return db;
}

// ============================================================================
// Collection orchestrator
// ============================================================================

// Active collection state (in-memory, single instance)
let activeCollection = null;

/**
 * Start a collection run.
 *
 * @param {Object} opts
 * @param {string} opts.query - Search query (default: "KRYCÍ LIST SOUPISU")
 * @param {number} opts.maxPages - Max pages to fetch (default: 10)
 * @param {boolean} opts.skipExisting - Skip smlouvy already in DB (default: true)
 * @returns {Promise<CollectionResult>}
 */
export async function startCollection({
  query = 'KRYCÍ LIST SOUPISU',
  maxPages = 10,
  skipExisting = true,
} = {}) {
  if (activeCollection?.status === 'running') {
    throw new Error('Collection already in progress');
  }

  const db = await ensureSchema();
  const client = new HlidacSmlouvyClient();

  if (!client.apiToken) {
    throw new Error('HLIDAC_API_TOKEN not set');
  }

  // Create run record
  const run = await db.run(
    'INSERT INTO collection_runs (query, status) VALUES (?, ?)',
    [query, 'running']
  );
  const runId = run.lastID;

  activeCollection = {
    runId,
    status: 'running',
    query,
    total: 0,
    processed: 0,
    withData: 0,
    positions: 0,
    errors: [],
    startedAt: Date.now(),
  };

  // Run collection in background
  _runCollection(db, client, runId, query, maxPages, skipExisting)
    .catch(err => {
      logger.error(`[COLLECTOR] Fatal error: ${err.message}`);
      activeCollection.status = 'error';
      activeCollection.error = err.message;
      db.run(
        'UPDATE collection_runs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['error', err.message, runId]
      ).catch(() => {});
    });

  return { runId, status: 'started', query };
}

async function _runCollection(db, client, runId, query, maxPages, skipExisting) {
  logger.info(`[COLLECTOR] Starting collection: "${query}" (max ${maxPages} pages)`);

  let totalFound = 0;

  const allResults = await client.searchAll(query, {
    maxPages,
    onPage: (page, results, total) => {
      totalFound = total;
      activeCollection.total = total;
      db.run(
        'UPDATE collection_runs SET total_found = ?, pages_fetched = ? WHERE id = ?',
        [total, page, runId]
      ).catch(() => {});
    },
  });

  logger.info(`[COLLECTOR] Fetched ${allResults.length} smlouvy (total available: ${totalFound})`);

  // Process each smlouva
  for (const smlouva of allResults) {
    if (activeCollection.status === 'cancelled') {
      logger.info('[COLLECTOR] Collection cancelled');
      break;
    }

    try {
      await processSmlouva(db, smlouva, skipExisting);
      activeCollection.processed++;
    } catch (err) {
      logger.warn(`[COLLECTOR] Error processing smlouva ${smlouva.Id || smlouva.id}: ${err.message}`);
      activeCollection.errors.push({ id: smlouva.Id || smlouva.id, error: err.message });
    }

    // Update run progress every 10 smlouvy
    if (activeCollection.processed % 10 === 0) {
      await db.run(
        'UPDATE collection_runs SET smlouvy_processed = ?, smlouvy_with_data = ?, positions_extracted = ? WHERE id = ?',
        [activeCollection.processed, activeCollection.withData, activeCollection.positions, runId]
      );
    }
  }

  // Finalize
  activeCollection.status = 'completed';
  await db.run(
    `UPDATE collection_runs SET
      status = 'completed',
      smlouvy_processed = ?,
      smlouvy_with_data = ?,
      positions_extracted = ?,
      completed_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [activeCollection.processed, activeCollection.withData, activeCollection.positions, runId]
  );

  logger.info(`[COLLECTOR] Completed: ${activeCollection.processed} smlouvy, ${activeCollection.withData} with data, ${activeCollection.positions} positions`);
  return activeCollection;
}

// ============================================================================
// Process single smlouva
// ============================================================================

async function processSmlouva(db, smlouva, skipExisting) {
  const hlidacId = smlouva.Id || smlouva.id;
  if (!hlidacId) return;

  // Skip if already processed
  if (skipExisting) {
    const existing = await db.get('SELECT id FROM rozpocet_source WHERE hlidac_id = ?', [hlidacId]);
    if (existing) return;
  }

  // Parse
  const parsed = parseSmlouva(smlouva);

  // Extract year from datum
  let rok = null;
  if (parsed.datum) {
    const yearMatch = String(parsed.datum).match(/(\d{4})/);
    if (yearMatch) rok = parseInt(yearMatch[1]);
  }

  // Determine primary work type
  const workTypes = {};
  for (const pos of parsed.all_positions) {
    if (pos.work_type) {
      workTypes[pos.work_type] = (workTypes[pos.work_type] || 0) + 1;
    }
  }
  const typPraceHlavni = Object.entries(workTypes)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Insert source
  const sourceResult = await db.run(
    `INSERT INTO rozpocet_source
      (source_type, hlidac_id, predmet, nazev, hodnota_czk, rok, prilohy_count, prilohy_with_text,
       parse_status, polozek_count, format_hints, typ_prace_hlavni)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'hlidac_smlouva',
      hlidacId,
      parsed.predmet,
      parsed.predmet, // nazev = predmet for now
      parsed.hodnota_czk,
      rok,
      parsed.prilohy_count,
      parsed.prilohy_with_text,
      parsed.total_codes > 0 ? 'parsed' : 'empty',
      parsed.total_codes,
      JSON.stringify(parsed.format_hints),
      typPraceHlavni,
    ]
  );
  const sourceId = sourceResult.lastID;

  // Collect all positions: PlainTextContent + xlsx download fallback
  let allPositions = parsed.all_positions;

  // If PlainTextContent yielded few results, try downloading xlsx přílohy
  if (allPositions.length < 5) {
    const prilohy = smlouva.prilohy || smlouva.Prilohy || [];
    try {
      const xlsxPositions = await processPrilohyXlsx(prilohy, 3);
      if (xlsxPositions.length > 0) {
        allPositions = [...allPositions, ...xlsxPositions];
        logger.info(`[COLLECTOR] xlsx download added ${xlsxPositions.length} positions for ${hlidacId}`);
      }
    } catch (err) {
      logger.debug(`[COLLECTOR] xlsx download failed for ${hlidacId}: ${err.message}`);
    }
  }

  // Update source with final position count
  const finalFormat = allPositions.some(p => p.parseMethod === 'xlsx_download')
    ? [...parsed.format_hints, 'xlsx_download']
    : parsed.format_hints;
  await db.run(
    'UPDATE rozpocet_source SET parse_status = ?, polozek_count = ?, format_hints = ? WHERE id = ?',
    [allPositions.length > 0 ? 'parsed' : 'empty', allPositions.length, JSON.stringify(finalFormat), sourceId]
  );

  // Insert positions
  if (allPositions.length > 0) {
    activeCollection.withData++;

    // Batch insert positions (200 per batch)
    const BATCH_SIZE = 200;
    for (let i = 0; i < allPositions.length; i += BATCH_SIZE) {
      const batch = allPositions.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const values = batch.flatMap((pos) => [
        sourceId,
        pos.code_raw,
        pos.description,
        pos.mj,
        pos.quantity,
        pos.unit_price,
        pos.code,
        pos.code?.substring(0, 3) || null,
        pos.code_system,
        pos.code_confidence,
        pos.code?.substring(0, 6) || null,
        pos.work_type,
        pos.source_file || null,
      ]);

      await db.run(
        `INSERT INTO rozpocet_polozky
          (source_id, kod_raw, popis, mj, mnozstvi, jednotkova_cena, kod_norm, kod_prefix, kod_system, kod_system_conf, dil_6, typ_prace, source_file)
        VALUES ${placeholders}`,
        values
      );
    }

    activeCollection.positions += allPositions.length;
  }
}

// ============================================================================
// Status & cancel
// ============================================================================

export function getCollectionStatus() {
  if (!activeCollection) return { status: 'idle' };
  return {
    runId: activeCollection.runId,
    status: activeCollection.status,
    query: activeCollection.query,
    total: activeCollection.total,
    processed: activeCollection.processed,
    withData: activeCollection.withData,
    positions: activeCollection.positions,
    errors: activeCollection.errors.length,
    elapsed: activeCollection.startedAt
      ? Math.round((Date.now() - activeCollection.startedAt) / 1000)
      : 0,
  };
}

export function cancelCollection() {
  if (activeCollection?.status === 'running') {
    activeCollection.status = 'cancelled';
    return true;
  }
  return false;
}

// ============================================================================
// Stats queries
// ============================================================================

export async function getCollectionStats() {
  const db = await ensureSchema();

  const [sources, positions, runs] = await Promise.all([
    db.get('SELECT COUNT(*) as count, SUM(polozek_count) as total_positions FROM rozpocet_source'),
    db.get(`SELECT COUNT(*) as count,
            COUNT(DISTINCT kod_norm) as unique_codes,
            COUNT(DISTINCT typ_prace) as work_types,
            COUNT(DISTINCT kod_system) as code_systems
            FROM rozpocet_polozky`),
    db.all('SELECT * FROM collection_runs ORDER BY started_at DESC LIMIT 5'),
  ]);

  // Code system breakdown
  const codeSystems = await db.all(
    'SELECT kod_system, COUNT(*) as count FROM rozpocet_polozky GROUP BY kod_system ORDER BY count DESC'
  );

  // Work type breakdown
  const workTypes = await db.all(
    'SELECT typ_prace, COUNT(*) as count FROM rozpocet_polozky WHERE typ_prace IS NOT NULL GROUP BY typ_prace ORDER BY count DESC LIMIT 30'
  );

  // Year breakdown
  const years = await db.all(
    'SELECT rok, COUNT(*) as count FROM rozpocet_source WHERE rok IS NOT NULL GROUP BY rok ORDER BY rok DESC LIMIT 10'
  );

  return {
    sources: { total: sources.count, total_positions: sources.total_positions },
    positions: {
      total: positions.count,
      unique_codes: positions.unique_codes,
      work_types: positions.work_types,
      code_systems: positions.code_systems,
    },
    code_system_breakdown: codeSystems,
    work_type_breakdown: workTypes,
    year_breakdown: years,
    recent_runs: runs,
  };
}

export { ensureSchema };
