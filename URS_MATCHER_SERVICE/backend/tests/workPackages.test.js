/**
 * Tests for Co-occurrence Builder + Work Package Builder
 */

import { getDatabase, initializeDatabase } from '../src/db/init.js';
import { buildCooccurrence, getCooccurring, getCooccurrenceStats, ensureCooccurrenceSchema } from '../src/services/cooccurrenceBuilder.js';
import { buildWorkPackages, searchWorkPackages, getAllWorkPackages, getWorkPackage, ensureWPSchema } from '../src/services/workPackageBuilder.js';
import { ensureSchema } from '../src/services/smlouvyCollector.js';

// ============================================================================
// Seed test data
// ============================================================================

async function seedTestData() {
  await initializeDatabase();
  await ensureSchema();
  await ensureCooccurrenceSchema();
  await ensureWPSchema();

  const db = await getDatabase();

  // Clean
  await db.run('DELETE FROM rozpocet_polozky');
  await db.run('DELETE FROM rozpocet_source');
  await db.run('DELETE FROM cooccurrence');
  await db.run('DELETE FROM work_type_cooccurrence');
  await db.run('DELETE FROM work_packages');

  // Insert 3 fake smlouvy (sources) with realistic positions
  // Source 1: Residential building (beton + bednění + výztuž + zdění + omítky + přesuny)
  const s1 = await db.run(
    `INSERT INTO rozpocet_source (source_type, hlidac_id, predmet, rok, parse_status, polozek_count)
     VALUES ('test', 'test-001', 'Bytový dům Brno', 2024, 'parsed', 6)`
  );
  const positions1 = [
    [s1.lastID, '274313611', 'Beton základových pasů C 25/30', 'm3', 28, '274', '274313', 'BETON', 'URS'],
    [s1.lastID, '274361215', 'Výztuž základových pasů B500B', 't', 2.8, '274', '274361', 'VYZTUŽ', 'URS'],
    [s1.lastID, '273362021', 'Bednění stěn základových pasů', 'm2', 42, '273', '273362', 'BEDNĚNÍ', 'URS'],
    [s1.lastID, '311238218', 'Zdivo nosné Porotherm 44', 'm2', 185, '311', '311238', 'ZDĚNÍ', 'URS'],
    [s1.lastID, '612321141', 'Omítka vápenocementová', 'm2', 420, '612', '612321', 'OMÍTKY', 'URS'],
    [s1.lastID, '998011002', 'Přesun hmot', 't', 125, '998', '998011', 'PŘESUNY', 'URS'],
  ];

  // Source 2: Same type — beton + bednění + výztuž + omítky + zateplení + lešení + přesuny
  const s2 = await db.run(
    `INSERT INTO rozpocet_source (source_type, hlidac_id, predmet, rok, parse_status, polozek_count)
     VALUES ('test', 'test-002', 'Rekonstrukce fasády', 2024, 'parsed', 7)`
  );
  const positions2 = [
    [s2.lastID, '274313611', 'Beton základových desek C 25/30', 'm3', 45, '274', '274313', 'BETON', 'URS'],
    [s2.lastID, '274361215', 'Výztuž B500B', 't', 3.5, '274', '274361', 'VYZTUŽ', 'URS'],
    [s2.lastID, '273362021', 'Bednění základových desek', 'm2', 60, '273', '273362', 'BEDNĚNÍ', 'URS'],
    [s2.lastID, '612321141', 'Omítka vnitřní', 'm2', 300, '612', '612321', 'OMÍTKY', 'URS'],
    [s2.lastID, '622311521', 'Zateplení ETICS 160mm', 'm2', 310, '622', '622311', 'ZATEPLENÍ', 'URS'],
    [s2.lastID, '941941031', 'Montáž lešení', 'm2', 650, '941', '941941', 'LEŠENÍ', 'URS'],
    [s2.lastID, '998011002', 'Přesun hmot', 't', 80, '998', '998011', 'PŘESUNY', 'URS'],
  ];

  // Source 3: beton + bednění + výztuž + zemní + přesuny
  const s3 = await db.run(
    `INSERT INTO rozpocet_source (source_type, hlidac_id, predmet, rok, parse_status, polozek_count)
     VALUES ('test', 'test-003', 'Základy RD', 2025, 'parsed', 5)`
  );
  const positions3 = [
    [s3.lastID, '274313611', 'Beton C 30/37', 'm3', 15, '274', '274313', 'BETON', 'URS'],
    [s3.lastID, '274361215', 'Výztuž B500B', 't', 1.2, '274', '274361', 'VYZTUŽ', 'URS'],
    [s3.lastID, '273362021', 'Bednění', 'm2', 30, '273', '273362', 'BEDNĚNÍ', 'URS'],
    [s3.lastID, '131201102', 'Hloubení rýh', 'm3', 45, '131', '131201', 'ZEMNÍ_PRÁCE', 'URS'],
    [s3.lastID, '998011002', 'Přesun hmot', 't', 60, '998', '998011', 'PŘESUNY', 'URS'],
  ];

  // Insert all positions
  for (const batch of [positions1, positions2, positions3]) {
    for (const [sourceId, kodRaw, popis, mj, mnozstvi, kodPrefix, dil6, typPrace, kodSystem] of batch) {
      await db.run(
        `INSERT INTO rozpocet_polozky
          (source_id, kod_raw, popis, mj, mnozstvi, kod_norm, kod_prefix, dil_6, typ_prace, kod_system, kod_system_conf)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.95)`,
        [sourceId, kodRaw, popis, mj, mnozstvi, kodRaw, kodPrefix, dil6, typPrace, kodSystem]
      );
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

beforeAll(async () => {
  await seedTestData();
});

describe('buildCooccurrence', () => {
  test('builds co-occurrence matrix from test data', async () => {
    const result = await buildCooccurrence({ level: 'all', minCount: 2 });
    expect(result.sources).toBe(3);
    expect(result.pairs).toBeGreaterThan(0);
  });

  test('beton + bednění + výztuž co-occur in all 3 sources', async () => {
    const db = await getDatabase();
    const pair = await db.get(
      "SELECT * FROM cooccurrence WHERE level = 'dil_3' AND kod_a = '273' AND kod_b = '274'"
    );
    // Both appear in all 3 sources
    expect(pair).toBeDefined();
    expect(pair.count).toBe(3);
  });

  test('work_type co-occurrence built', async () => {
    const db = await getDatabase();
    const pair = await db.get(
      "SELECT * FROM work_type_cooccurrence WHERE type_a = 'BEDNĚNÍ' AND type_b = 'BETON'"
    );
    expect(pair).toBeDefined();
    expect(pair.count).toBe(3);
  });

  test('přesuny co-occurs with everything', async () => {
    const results = await getCooccurring('998', 'dil_3', 20);
    // Přesuny (998) appears in all 3 sources with beton(274), bednění(273), výztuž(274)
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('getCooccurring', () => {
  test('returns co-occurring codes for dil_3', async () => {
    const results = await getCooccurring('274', 'dil_3', 20);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('partner');
    expect(results[0]).toHaveProperty('count');
    expect(results[0]).toHaveProperty('frequency');
  });

  test('returns co-occurring work types', async () => {
    const results = await getCooccurring('BETON', 'work_type', 20);
    expect(results.length).toBeGreaterThan(0);
    const partners = results.map(r => r.partner);
    expect(partners).toContain('BEDNĚNÍ');
    expect(partners).toContain('VYZTUŽ');
  });
});

describe('getCooccurrenceStats', () => {
  test('returns stats', async () => {
    const stats = await getCooccurrenceStats();
    expect(stats.total_pairs).toBeGreaterThan(0);
    expect(stats.by_level.length).toBeGreaterThan(0);
    expect(stats.top_work_type_pairs.length).toBeGreaterThan(0);
  });
});

describe('buildWorkPackages', () => {
  test('builds work packages from co-occurrence data', async () => {
    const packages = await buildWorkPackages({
      minClusterSize: 2, // Lower threshold for test data
      minFrequency: 0.3,
      expansionThreshold: 0.3,
    });
    expect(packages.length).toBeGreaterThan(0);
  });

  test('work packages have required fields', async () => {
    const packages = await getAllWorkPackages();
    if (packages.length === 0) return; // Skip if no packages built

    const wp = packages[0];
    expect(wp).toHaveProperty('package_id');
    expect(wp).toHaveProperty('name');
    expect(wp).toHaveProperty('confidence');
    expect(wp).toHaveProperty('items');
    expect(wp).toHaveProperty('companion_packages');
    expect(wp).toHaveProperty('trigger_keywords');
  });

  test('companion packages include přesuny', async () => {
    const packages = await getAllWorkPackages();
    if (packages.length === 0) return;

    const hasPresuny = packages.some(wp =>
      wp.companion_packages?.some(c => c.type === 'PŘESUNY')
    );
    expect(hasPresuny).toBe(true);
  });
});

describe('searchWorkPackages', () => {
  test('search by keyword returns results', async () => {
    const packages = await getAllWorkPackages();
    if (packages.length === 0) return;

    // Search for whatever work type exists
    const workType = packages[0].work_type;
    if (workType) {
      const results = await searchWorkPackages(workType);
      expect(results.length).toBeGreaterThan(0);
    }
  });
});

describe('getWorkPackage', () => {
  test('get by ID returns package', async () => {
    const packages = await getAllWorkPackages();
    if (packages.length === 0) return;

    const wp = await getWorkPackage(packages[0].package_id);
    expect(wp).not.toBeNull();
    expect(wp.package_id).toBe(packages[0].package_id);
  });

  test('returns null for non-existent ID', async () => {
    const wp = await getWorkPackage('non_existent_wp');
    expect(wp).toBeNull();
  });
});
