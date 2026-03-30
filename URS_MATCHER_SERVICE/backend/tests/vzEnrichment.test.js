/**
 * Tests for VVZ Client + VZ Enrichment Service
 *
 * Tests: VvzClient normalization, CPV constants, schema migration,
 * match logic, enrichment stats.
 * All tests are offline (no real API calls).
 */

import VvzClient, { CPV_CONSTRUCTION, FORM_TYPES } from '../src/services/vvzClient.js';
import { getDatabase, initializeDatabase } from '../src/db/init.js';
import { ensureVzFields, getVzStats } from '../src/services/vzEnrichment.js';
import { ensureSchema } from '../src/services/smlouvyCollector.js';

// ============================================================================
// VvzClient unit tests
// ============================================================================

describe('VvzClient', () => {
  test('creates client', () => {
    const client = new VvzClient();
    expect(client.requestCount).toBe(0);
    expect(client.errorCount).toBe(0);
  });

  test('getStats returns metrics', () => {
    const client = new VvzClient();
    const stats = client.getStats();
    expect(stats.requestCount).toBe(0);
    expect(stats.lastRequestTime).toBeNull();
  });

  test('normalizes VZ item', () => {
    const client = new VvzClient();
    const raw = {
      id: 'test-123',
      variableId: 'F2026-001',
      data: {
        evCisloZakazkyVvz: 'Z2026-001',
        nazevZakazky: 'Oprava chodníků',
        druhFormulare: '29',
        zadavatele: [{ ico: '00123456', nazev: 'Město Brno' }],
        dodavatele: [{ ico: '12345678', nazev: 'Stavba s.r.o.' }],
        datumUverejneniVvz: '2026-03-30',
        konecnaCena: 5000000,
      },
    };

    const normalized = client._normalizeVzItem(raw);
    expect(normalized.id).toBe('test-123');
    expect(normalized.evCislo).toBe('Z2026-001');
    expect(normalized.nazev).toBe('Oprava chodníků');
    expect(normalized.zadavatel.ico).toBe('00123456');
    expect(normalized.dodavatel.ico).toBe('12345678');
    expect(normalized.konecnaCena).toBe(5000000);
  });

  test('normalizes item with empty data', () => {
    const client = new VvzClient();
    const normalized = client._normalizeVzItem({ data: {} });
    expect(normalized.evCislo).toBeNull();
    expect(normalized.zadavatel).toBeNull();
    expect(normalized.dodavatel).toBeNull();
  });

  test('extracts CPV from data', () => {
    const client = new VvzClient();
    expect(client._extractCpv({ cpvKod: '45210000' })).toBe('45210000');
    expect(client._extractCpv({ cpvVzACasti: 4521 })).toBe('4521');
    expect(client._extractCpv({ hlavniCpv: '45' })).toBe('45');
    expect(client._extractCpv({})).toBeNull();
  });
});

// ============================================================================
// CPV constants
// ============================================================================

describe('CPV_CONSTRUCTION', () => {
  test('has main category 45', () => {
    expect(CPV_CONSTRUCTION['45']).toBeDefined();
    expect(CPV_CONSTRUCTION['45']).toContain('Stavební');
  });

  test('has pozemní stavby', () => {
    expect(CPV_CONSTRUCTION['4521']).toContain('Pozemní');
  });

  test('has inženýrské stavby', () => {
    expect(CPV_CONSTRUCTION['4522']).toContain('Inženýrské');
  });

  test('has ETICS (izolační práce)', () => {
    expect(CPV_CONSTRUCTION['4532']).toContain('Izolační');
  });
});

describe('FORM_TYPES', () => {
  test('has announcement and result', () => {
    expect(FORM_TYPES.ANNOUNCEMENT).toBe('16');
    expect(FORM_TYPES.RESULT).toBe('29');
  });
});

// ============================================================================
// DB schema migration
// ============================================================================

describe('ensureVzFields', () => {
  beforeAll(async () => {
    await initializeDatabase();
    await ensureSchema();
  });

  test('adds VZ columns to rozpocet_source', async () => {
    const db = await getDatabase();
    await ensureVzFields(db);

    const columns = await db.all("PRAGMA table_info(rozpocet_source)");
    const names = columns.map(c => c.name);

    expect(names).toContain('cpv_hlavni');
    expect(names).toContain('vz_ev_cislo');
    expect(names).toContain('dodavatel_ico');
    expect(names).toContain('zadavatel_ico');
    expect(names).toContain('vz_enriched_at');
  });

  test('creates vz_metadata table', async () => {
    const db = await getDatabase();
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vz_metadata'"
    );
    expect(tables.length).toBe(1);
  });

  test('is idempotent', async () => {
    const db = await getDatabase();
    // Should not throw on second call
    await ensureVzFields(db);
    await ensureVzFields(db);
  });
});

// ============================================================================
// Stats (empty DB)
// ============================================================================

describe('getVzStats', () => {
  test('returns stats for empty DB', async () => {
    const stats = await getVzStats();
    expect(stats).toHaveProperty('vz_metadata_count');
    expect(stats).toHaveProperty('sources_total');
    expect(stats).toHaveProperty('sources_enriched');
    expect(stats).toHaveProperty('enrichment_rate');
    expect(stats).toHaveProperty('cpv_breakdown');
  });
});
