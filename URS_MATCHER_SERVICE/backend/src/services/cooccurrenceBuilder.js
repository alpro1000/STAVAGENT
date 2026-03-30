/**
 * Co-occurrence Matrix Builder
 *
 * Analyzes collected rozpocet_polozky to build a co-occurrence matrix
 * showing which codes/work types frequently appear together in the same
 * smlouva (rozpočet). Used to generate Work Packages.
 *
 * Three granularity levels:
 *   - dil_3:  first 3 digits of code (e.g. "631" = beton základů)
 *   - dil_6:  first 6 digits (OTSKP-level)
 *   - full:   full normalized code
 *
 * Also builds work_type co-occurrence (BETON ↔ BEDNĚNÍ ↔ VYZTUŽ etc.)
 */

import { getDatabase } from '../db/init.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Schema
// ============================================================================

const COOCCURRENCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS cooccurrence (
  kod_a TEXT NOT NULL,
  kod_b TEXT NOT NULL,
  level TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  frequency REAL DEFAULT 0,
  PRIMARY KEY (kod_a, kod_b, level)
);

CREATE INDEX IF NOT EXISTS idx_cooccurrence_a ON cooccurrence(kod_a);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_b ON cooccurrence(kod_b);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_level ON cooccurrence(level);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_count ON cooccurrence(count DESC);

-- Work type co-occurrence (aggregated)
CREATE TABLE IF NOT EXISTS work_type_cooccurrence (
  type_a TEXT NOT NULL,
  type_b TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  frequency REAL DEFAULT 0,
  avg_position_distance REAL,
  PRIMARY KEY (type_a, type_b)
);
`;

async function ensureCooccurrenceSchema() {
  const db = await getDatabase();
  await db.exec(COOCCURRENCE_SCHEMA);
  return db;
}

// ============================================================================
// Build co-occurrence from collected data
// ============================================================================

/**
 * Build co-occurrence matrix from rozpocet_polozky.
 *
 * For each source (smlouva), find all pairs of codes that appear together
 * and increment their co-occurrence count.
 *
 * @param {Object} opts
 * @param {string} opts.level - Granularity: 'dil_3', 'dil_6', 'full', 'work_type', 'all'
 * @param {number} opts.minCount - Minimum co-occurrence count to keep (default: 2)
 * @returns {Promise<BuildResult>}
 */
export async function buildCooccurrence({ level = 'all', minCount = 2 } = {}) {
  const db = await ensureCooccurrenceSchema();
  const startTime = Date.now();

  logger.info(`[COOCCURRENCE] Building matrix (level=${level}, minCount=${minCount})`);

  // Get all sources that have positions
  const sources = await db.all(
    'SELECT DISTINCT source_id FROM rozpocet_polozky'
  );

  if (sources.length === 0) {
    logger.warn('[COOCCURRENCE] No data to build from');
    return { sources: 0, pairs: 0, elapsed: 0 };
  }

  const totalSources = sources.length;
  logger.info(`[COOCCURRENCE] Processing ${totalSources} sources`);

  // Counters for each level
  const counters = {
    dil_3: new Map(),
    dil_6: new Map(),
    full: new Map(),
    work_type: new Map(),
  };

  // Process each source
  for (const { source_id } of sources) {
    const positions = await db.all(
      'SELECT kod_norm, kod_prefix, dil_6, typ_prace, poradi FROM rozpocet_polozky WHERE source_id = ?',
      [source_id]
    );

    if (positions.length < 2) continue;

    // Build sets for this source
    const dil3Set = new Set();
    const dil6Set = new Set();
    const fullSet = new Set();
    const workTypeSet = new Set();

    for (const pos of positions) {
      if (pos.kod_prefix) dil3Set.add(pos.kod_prefix);
      if (pos.dil_6) dil6Set.add(pos.dil_6);
      if (pos.kod_norm) fullSet.add(pos.kod_norm);
      if (pos.typ_prace) workTypeSet.add(pos.typ_prace);
    }

    // Count pairs (order-independent: always a < b)
    if (level === 'all' || level === 'dil_3') {
      countPairs(dil3Set, counters.dil_3);
    }
    if (level === 'all' || level === 'dil_6') {
      countPairs(dil6Set, counters.dil_6);
    }
    if (level === 'all' || level === 'full') {
      countPairs(fullSet, counters.full);
    }
    if (level === 'all' || level === 'work_type') {
      countPairs(workTypeSet, counters.work_type);
    }
  }

  // Write to DB
  await db.run('DELETE FROM cooccurrence');
  await db.run('DELETE FROM work_type_cooccurrence');

  let totalPairs = 0;

  for (const [lvl, counter] of Object.entries(counters)) {
    if (lvl === 'work_type') {
      // Write to separate table
      for (const [key, count] of counter) {
        if (count < minCount) continue;
        const [a, b] = key.split('|');
        const freq = count / totalSources;
        await db.run(
          'INSERT OR REPLACE INTO work_type_cooccurrence (type_a, type_b, count, frequency) VALUES (?, ?, ?, ?)',
          [a, b, count, freq]
        );
        totalPairs++;
      }
    } else {
      // Batch insert to cooccurrence table
      const entries = [];
      for (const [key, count] of counter) {
        if (count < minCount) continue;
        const [a, b] = key.split('|');
        entries.push([a, b, lvl, count, count / totalSources]);
      }

      // Insert in batches
      for (let i = 0; i < entries.length; i += 100) {
        const batch = entries.slice(i, i + 100);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(',');
        const values = batch.flat();
        await db.run(
          `INSERT OR REPLACE INTO cooccurrence (kod_a, kod_b, level, count, frequency) VALUES ${placeholders}`,
          values
        );
      }
      totalPairs += entries.length;
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logger.info(`[COOCCURRENCE] Built: ${totalPairs} pairs from ${totalSources} sources in ${elapsed}s`);

  return { sources: totalSources, pairs: totalPairs, elapsed };
}

/**
 * Count all pairs in a set. For items a, b where a < b, increment counter[a|b].
 */
function countPairs(itemSet, counter) {
  const items = [...itemSet].sort();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const key = `${items[i]}|${items[j]}`;
      counter.set(key, (counter.get(key) || 0) + 1);
    }
  }
}

// ============================================================================
// Query co-occurrence
// ============================================================================

/**
 * Get items that frequently co-occur with a given code.
 *
 * @param {string} code - Code or work type
 * @param {string} level - 'dil_3', 'dil_6', 'full', 'work_type'
 * @param {number} limit - Max results
 * @returns {Promise<Array<{partner: string, count: number, frequency: number}>>}
 */
export async function getCooccurring(code, level = 'dil_3', limit = 20) {
  const db = await ensureCooccurrenceSchema();

  if (level === 'work_type') {
    return db.all(
      `SELECT
        CASE WHEN type_a = ? THEN type_b ELSE type_a END as partner,
        count, frequency
       FROM work_type_cooccurrence
       WHERE type_a = ? OR type_b = ?
       ORDER BY count DESC
       LIMIT ?`,
      [code, code, code, limit]
    );
  }

  return db.all(
    `SELECT
      CASE WHEN kod_a = ? THEN kod_b ELSE kod_a END as partner,
      count, frequency
     FROM cooccurrence
     WHERE level = ? AND (kod_a = ? OR kod_b = ?)
     ORDER BY count DESC
     LIMIT ?`,
    [code, level, code, code, limit]
  );
}

/**
 * Get co-occurrence stats.
 */
export async function getCooccurrenceStats() {
  const db = await ensureCooccurrenceSchema();

  const [total, byLevel, topWorkType] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM cooccurrence'),
    db.all('SELECT level, COUNT(*) as count, AVG(count) as avg_count, MAX(count) as max_count FROM cooccurrence GROUP BY level'),
    db.all('SELECT type_a, type_b, count, frequency FROM work_type_cooccurrence ORDER BY count DESC LIMIT 20'),
  ]);

  return {
    total_pairs: total.count,
    by_level: byLevel,
    top_work_type_pairs: topWorkType,
  };
}

export { ensureCooccurrenceSchema };
