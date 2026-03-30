/**
 * Work Package Builder
 *
 * Clusters co-occurring codes into Work Packages (WP).
 * A WP = a group of BOQ items that typically appear together
 * in a construction project (e.g. "ETICS fasáda" = penetrace + lepení + kotvení + armování + omítka).
 *
 * Algorithm:
 * 1. Start from high-frequency co-occurrence pairs
 * 2. Expand clusters greedily (add items that co-occur with ≥50% of existing cluster)
 * 3. Name clusters using most common description keywords
 * 4. Attach companion packages (e.g. lešení for facade, přesuny for all)
 *
 * All WP are data-driven from co-occurrence analysis — no hardcoded packages.
 */

import { getDatabase } from '../db/init.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Schema
// ============================================================================

const WP_SCHEMA = `
CREATE TABLE IF NOT EXISTS work_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  work_type TEXT,
  source_stats TEXT,
  confidence REAL DEFAULT 0.7,
  trigger_keywords TEXT,
  items TEXT,
  companion_packages TEXT,
  alternative_variant TEXT,
  typical_mj TEXT,
  typical_dily TEXT,
  cpv_correlation TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wp_work_type ON work_packages(work_type);
CREATE INDEX IF NOT EXISTS idx_wp_name ON work_packages(name);
`;

async function ensureWPSchema() {
  const db = await getDatabase();
  await db.exec(WP_SCHEMA);
  return db;
}

// ============================================================================
// Build Work Packages from co-occurrence data
// ============================================================================

/**
 * Build work packages from co-occurrence matrix + rozpocet_polozky.
 *
 * @param {Object} opts
 * @param {number} opts.minClusterSize - Min items in a WP (default: 3)
 * @param {number} opts.minFrequency - Min co-occurrence frequency to consider (default: 0.1 = 10%)
 * @param {number} opts.expansionThreshold - Min % of cluster items that must co-occur (default: 0.5)
 * @returns {Promise<Array<WorkPackage>>}
 */
export async function buildWorkPackages({
  minClusterSize = 3,
  minFrequency = 0.1,
  expansionThreshold = 0.5,
} = {}) {
  const db = await ensureWPSchema();
  const startTime = Date.now();

  logger.info('[WP] Building work packages from co-occurrence data');

  // Load co-occurrence at dil_3 level (most useful for clustering)
  const pairs = await db.all(
    'SELECT kod_a, kod_b, count, frequency FROM cooccurrence WHERE level = ? AND frequency >= ? ORDER BY count DESC',
    ['dil_3', minFrequency]
  );

  if (pairs.length === 0) {
    logger.warn('[WP] No co-occurrence data. Run buildCooccurrence first.');
    return [];
  }

  // Build adjacency map
  const adj = new Map(); // code → Map<partner, frequency>
  for (const { kod_a, kod_b, frequency } of pairs) {
    if (!adj.has(kod_a)) adj.set(kod_a, new Map());
    if (!adj.has(kod_b)) adj.set(kod_b, new Map());
    adj.get(kod_a).set(kod_b, frequency);
    adj.get(kod_b).set(kod_a, frequency);
  }

  // Greedy clustering
  const used = new Set();
  const clusters = [];

  // Sort nodes by degree (most connected first)
  const nodes = [...adj.keys()].sort((a, b) => adj.get(b).size - adj.get(a).size);

  for (const seed of nodes) {
    if (used.has(seed)) continue;

    const cluster = new Set([seed]);
    const candidates = [...adj.get(seed).entries()]
      .filter(([n]) => !used.has(n))
      .sort((a, b) => b[1] - a[1]);

    // Expand cluster
    for (const [candidate] of candidates) {
      if (used.has(candidate)) continue;

      // Check if candidate co-occurs with enough cluster members
      const candidateAdj = adj.get(candidate) || new Map();
      const clusterMembers = [...cluster];
      const cooccurCount = clusterMembers.filter(m => candidateAdj.has(m)).length;

      if (cooccurCount / cluster.size >= expansionThreshold) {
        cluster.add(candidate);
      }
    }

    if (cluster.size >= minClusterSize) {
      clusters.push([...cluster]);
      for (const c of cluster) used.add(c);
    }
  }

  logger.info(`[WP] Found ${clusters.length} clusters`);

  // Enrich clusters with metadata from rozpocet_polozky
  const packages = [];
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const wp = await enrichCluster(db, cluster, i + 1);
    if (wp) packages.push(wp);
  }

  // Save to DB
  await db.run('DELETE FROM work_packages');
  for (const wp of packages) {
    await db.run(
      `INSERT INTO work_packages
        (package_id, name, description, work_type, source_stats, confidence,
         trigger_keywords, items, companion_packages, typical_mj, typical_dily)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wp.package_id,
        wp.name,
        wp.description,
        wp.work_type,
        JSON.stringify(wp.source_stats),
        wp.confidence,
        JSON.stringify(wp.trigger_keywords),
        JSON.stringify(wp.items),
        JSON.stringify(wp.companion_packages),
        wp.typical_mj,
        JSON.stringify(wp.typical_dily),
      ]
    );
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logger.info(`[WP] Built ${packages.length} work packages in ${elapsed}s`);

  return packages;
}

// ============================================================================
// Cluster enrichment
// ============================================================================

async function enrichCluster(db, clusterCodes, index) {
  // Get sample positions for these code prefixes
  const placeholders = clusterCodes.map(() => '?').join(',');
  const positions = await db.all(
    `SELECT kod_norm, kod_prefix, popis, mj, typ_prace, dil_6
     FROM rozpocet_polozky
     WHERE kod_prefix IN (${placeholders})
     LIMIT 200`,
    clusterCodes
  );

  if (positions.length === 0) return null;

  // Extract keywords from descriptions
  const wordFreq = new Map();
  const mjFreq = new Map();
  const workTypes = new Map();

  for (const pos of positions) {
    if (pos.popis) {
      const words = pos.popis.toLowerCase()
        .replace(/[^\wěščřžýáíéúůďťňóÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);
      for (const w of words) {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      }
    }
    if (pos.mj) mjFreq.set(pos.mj, (mjFreq.get(pos.mj) || 0) + 1);
    if (pos.typ_prace) workTypes.set(pos.typ_prace, (workTypes.get(pos.typ_prace) || 0) + 1);
  }

  // Top keywords (for naming and trigger)
  const topKeywords = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  // Primary work type
  const primaryWorkType = [...workTypes.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Typical MJ
  const typicalMJ = [...mjFreq.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Unique full codes with descriptions
  const itemMap = new Map();
  for (const pos of positions) {
    if (pos.kod_norm && !itemMap.has(pos.kod_norm)) {
      itemMap.set(pos.kod_norm, {
        code: pos.kod_norm,
        description: pos.popis,
        mj: pos.mj,
        work_type: pos.typ_prace,
      });
    }
  }

  // Build name from top keywords
  const name = topKeywords.slice(0, 3).join(' + ') || `Balíček ${index}`;

  // Detect companion packages
  const companions = detectCompanions(primaryWorkType, clusterCodes);

  return {
    package_id: `wp_${primaryWorkType || 'mix'}_${index}`.toLowerCase(),
    name,
    description: `Automaticky generovaný balíček z ${positions.length} položek (${clusterCodes.length} skupin kódů)`,
    work_type: primaryWorkType,
    source_stats: {
      positions_count: positions.length,
      code_groups: clusterCodes.length,
      unique_codes: itemMap.size,
    },
    confidence: Math.min(0.95, 0.5 + clusterCodes.length * 0.05 + positions.length * 0.001),
    trigger_keywords: topKeywords,
    items: [...itemMap.values()].slice(0, 50),
    companion_packages: companions,
    typical_mj: typicalMJ,
    typical_dily: clusterCodes,
  };
}

// ============================================================================
// Companion detection (data-driven patterns)
// ============================================================================

function detectCompanions(workType, codes) {
  const companions = [];

  // Přesun hmot is companion for everything
  companions.push({
    type: 'PŘESUNY',
    code_prefix: '998',
    reason: 'Přesun hmot — automatický doplněk ke každé skupině prací',
    frequency: 0.95,
  });

  // Height work → lešení
  const heightTypes = ['ZATEPLENÍ', 'OMÍTKY', 'KLEMPÍŘSKÉ', 'MALBY_NÁTĚRY'];
  if (heightTypes.includes(workType)) {
    companions.push({
      type: 'LEŠENÍ',
      code_prefix: '941',
      reason: 'Práce ve výšce — lešení jako doplněk',
      frequency: 0.90,
    });
  }

  // Demolition → odvoz
  if (workType === 'BOURÁNÍ') {
    companions.push({
      type: 'LIKVIDACE',
      code_prefix: '997',
      reason: 'Demolice — odvoz suti',
      frequency: 0.85,
    });
  }

  // Concrete → formwork + rebar
  if (workType === 'BETON') {
    companions.push({
      type: 'BEDNĚNÍ',
      code_prefix: null,
      reason: 'Betonáž → bednění + výztuž (ŽB)',
      frequency: 0.80,
    });
    companions.push({
      type: 'VYZTUŽ',
      code_prefix: null,
      reason: 'Betonáž → bednění + výztuž (ŽB)',
      frequency: 0.80,
    });
  }

  // Excavation → transport + backfill
  if (workType === 'ZEMNÍ_PRÁCE') {
    companions.push({
      type: 'PŘESUNY',
      code_prefix: '162',
      reason: 'Výkopy → přemístění + uložení/odvoz výkopku',
      frequency: 0.85,
    });
  }

  return companions;
}

// ============================================================================
// Query Work Packages
// ============================================================================

/**
 * Search work packages by keyword.
 *
 * @param {string} keyword - Search keyword
 * @param {number} limit - Max results
 * @returns {Promise<Array<WorkPackage>>}
 */
export async function searchWorkPackages(keyword, limit = 10) {
  const db = await ensureWPSchema();

  const packages = await db.all(
    `SELECT * FROM work_packages
     WHERE name LIKE ? OR trigger_keywords LIKE ? OR work_type LIKE ?
     ORDER BY confidence DESC
     LIMIT ?`,
    [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, limit]
  );

  return packages.map(deserializeWP);
}

/**
 * Get all work packages.
 */
export async function getAllWorkPackages() {
  const db = await ensureWPSchema();
  const packages = await db.all('SELECT * FROM work_packages ORDER BY confidence DESC');
  return packages.map(deserializeWP);
}

/**
 * Get a work package by ID.
 */
export async function getWorkPackage(packageId) {
  const db = await ensureWPSchema();
  const wp = await db.get('SELECT * FROM work_packages WHERE package_id = ?', [packageId]);
  return wp ? deserializeWP(wp) : null;
}

function deserializeWP(row) {
  return {
    ...row,
    source_stats: safeJSON(row.source_stats),
    trigger_keywords: safeJSON(row.trigger_keywords),
    items: safeJSON(row.items),
    companion_packages: safeJSON(row.companion_packages),
    typical_dily: safeJSON(row.typical_dily),
  };
}

function safeJSON(str) {
  try { return JSON.parse(str); } catch { return str; }
}

export { ensureWPSchema };
