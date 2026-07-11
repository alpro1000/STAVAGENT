/**
 * buildPositionInsertChunks — bulk-INSERT builder for Registry→Monolit import.
 *
 * A per-row awaited INSERT over ~9.5k positions timed out the import on the
 * shared Cloud SQL instance. The builder batches rows into multi-VALUES
 * inserts; these tests pin the parameter/placeholder math and the chunk
 * boundaries (Postgres' 65535-param cap must never be exceeded).
 */

import { jest } from '@jest/globals';

// The route module imports these at load time — mock so the named export loads.
const mockDb = { prepare: jest.fn(() => ({ run: jest.fn(), get: jest.fn(), all: jest.fn(() => []) })), isPostgres: false };
jest.unstable_mockModule('../../src/db/init.js', () => ({ default: mockDb }));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('@stavagent/monolit-shared', () => ({
  classifyMonolithRow: jest.fn(() => ({ is_monolith: true, is_prefab: false, sub_role: 'beton', confidence: 0.9, decided_by: 'code_monolithic', signals: [] })),
  groupMonolithRows: jest.fn(() => ({ groups: [], ungrouped: [] })),
}));

const { buildPositionInsertChunks, POSITION_INSERT_COLUMNS } =
  await import('../../src/routes/import-from-registry.js');

const NCOLS = POSITION_INSERT_COLUMNS.length; // 17 (Gate 4 added metadata)

const makePositions = (n) =>
  Array.from({ length: n }, (_, i) => ({
    part_name: `P${i}`, item_name: `Item ${i}`, subtype: 'beton', unit: 'M3',
    qty: i + 1, otskp_code: null, concrete_m3: i + 1, total_price: 10, unit_price: 2,
    position_instance_id: null,
  }));

const OPTS = { crewSize: 4, wageDefault: 398, shiftDefault: 10, days: 0 };

describe('buildPositionInsertChunks', () => {
  it('emits one chunk with correct params for a small batch', () => {
    const chunks = buildPositionInsertChunks(makePositions(3), 'BR1', OPTS);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].values).toHaveLength(3 * NCOLS);
    // 3 value-groups, last placeholder = 3*16 = 48
    expect(chunks[0].text).toContain(`$${3 * NCOLS}`);
    expect(chunks[0].text).not.toContain(`$${3 * NCOLS + 1}`);
    // ids are unique + index-based within the batch
    expect(chunks[0].values[0]).toBe('BR1_0');
    expect(chunks[0].values[NCOLS]).toBe('BR1_1');
  });

  it('splits into ≤500-row chunks and never exceeds the 65535 param cap', () => {
    const chunks = buildPositionInsertChunks(makePositions(9523), 'BR9K', OPTS);
    expect(chunks).toHaveLength(Math.ceil(9523 / 500)); // 20
    for (const c of chunks) {
      expect(c.values.length).toBeLessThanOrEqual(500 * NCOLS); // 8000 ≤ 65535
      expect(c.values.length % NCOLS).toBe(0);
    }
    // total rows preserved
    const totalRows = chunks.reduce((s, c) => s + c.values.length / NCOLS, 0);
    expect(totalRows).toBe(9523);
    // ids stay unique across chunk boundaries
    expect(chunks[0].values[0]).toBe('BR9K_0');
    expect(chunks[1].values[0]).toBe('BR9K_500');
  });

  it('honors a custom chunk size', () => {
    const chunks = buildPositionInsertChunks(makePositions(5), 'BR', OPTS, 2);
    expect(chunks.map(c => c.values.length / NCOLS)).toEqual([2, 2, 1]);
  });

  it('returns no chunks for an empty position list', () => {
    expect(buildPositionInsertChunks([], 'BR', OPTS)).toEqual([]);
  });
});
