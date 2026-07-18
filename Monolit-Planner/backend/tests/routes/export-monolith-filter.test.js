/**
 * Bug monolit-jen-monolity-predicate (verdict 2026-07-18) — the export-side
 * «Jen monolity» filter must use THE shared group predicate (manual
 * designation = truth) instead of re-classifying the ORIGINAL import
 * text/code. Live symptom: a row the user manually re-designated as beton
 * showed in the table under «Jen monolity» but vanished from the export
 * until the toggle was turned off.
 *
 * Hermetic: db/calculator/exporter/logger/auth are mocked — only the pure
 * filter is exercised.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/db/init.js', () => ({
  default: { prepare: jest.fn() },
}));
jest.unstable_mockModule('../../src/services/calculator.js', () => ({
  calculatePositions: jest.fn(),
  calculateKPI: jest.fn(),
}));
jest.unstable_mockModule('../../src/services/exporter.js', () => ({
  exportToXLSX: jest.fn(),
  getExportsList: jest.fn(),
  getExportFile: jest.fn(),
  deleteExportFile: jest.fn(),
}));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  optionalAuth: (req, res, next) => next(),
}));

const { filterMonolithicPositions } = await import('../../src/routes/export.js');

describe('filterMonolithicPositions — shared predicate, manual designation = truth', () => {
  it('LIVE BUG PIN: manually-designated beton with aggregate import text is KEPT', () => {
    // Old code re-ran isMonolithicElement on item_name «kamenivo…» → dropped
    // the whole part despite subtype='beton'. subtype is the truth now.
    const positions = [
      { part_name: 'PODKLAD', subtype: 'beton', item_name: 'VÝPLŇ Z KAMENIVA DRCENÉHO', otskp_code: '451', metadata: null },
      { part_name: 'PODKLAD', subtype: 'bednění', item_name: 'BEDNĚNÍ', otskp_code: null, metadata: null },
    ];
    const kept = filterMonolithicPositions(positions);
    expect(kept.map(p => p.part_name)).toEqual(['PODKLAD', 'PODKLAD']);
  });

  it('override=true promotes a beton-less part (✓ toggle on a non-m³ rep row) — whole part exported', () => {
    const positions = [
      { part_name: 'OPĚRA', subtype: 'jiné', item_name: 'X', metadata: { is_monolith_override: true } },
      { part_name: 'OPĚRA', subtype: 'výztuž', item_name: 'VÝZTUŽ', metadata: null },
    ];
    expect(filterMonolithicPositions(positions)).toHaveLength(2);
  });

  it('override=false vetoes a beton part; unmarked non-beton parts drop', () => {
    const positions = [
      { part_name: 'DEMOTED', subtype: 'beton', item_name: 'BETON C30/37', metadata: { is_monolith_override: false } },
      { part_name: 'VOLNÁ VÝZTUŽ', subtype: 'výztuž', item_name: 'VÝZTUŽ 10505', metadata: null },
      { part_name: 'ZÁKLAD', subtype: 'beton', item_name: 'ZÁKLADY ŽB', metadata: null },
      { part_name: 'ZÁKLAD', subtype: 'výztuž', item_name: 'VÝZTUŽ', metadata: null },
    ];
    const kept = filterMonolithicPositions(positions);
    expect([...new Set(kept.map(p => p.part_name))]).toEqual(['ZÁKLAD']);
    expect(kept).toHaveLength(2); // siblings ride along
  });

  it('metadata arrives as a JSON string from the DB — override still honoured', () => {
    const positions = [
      { part_name: 'P', subtype: 'jiné', item_name: 'X', metadata: '{"is_monolith_override": true}' },
    ];
    expect(filterMonolithicPositions(positions)).toHaveLength(1);
  });
});
