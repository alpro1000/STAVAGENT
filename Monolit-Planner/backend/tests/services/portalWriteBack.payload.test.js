/**
 * buildMonolithPayload — calculator TOV forwarding (2026-07-08).
 * Aplikovat persists {costs, resources, formwork_info, tov_entries} into
 * positions.metadata; the write-back payload must carry them so Registry's
 * TOV modal can pre-fill from the real calculation. Corrupt metadata must
 * never break the (non-blocking) write-back.
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const { buildMonolithPayload } = await import('../../src/services/portalWriteBack.js');

const BASE_POS = {
  id: 'pos-1',
  bridge_id: 'PRT_x_1',
  part_name: 'ZÁKLADY',
  subtype: 'beton',
  crew_size: 4,
  wage_czk_ph: 398,
  shift_hours: 10,
  days: 2,
  labor_hours: 80,
  cost_czk: 31840,
};

const META = {
  calculated_at: '2026-07-08T10:00:00Z',
  costs: { pour_labor_czk: 31840, formwork_labor_czk: 0 },
  resources: { wage_pour_czk_h: 398, pour_shifts: 1 },
  formwork_info: { system_name: 'Framax Xlife', formwork_area_m2: 547.4 },
  tov_entries: {
    labor: [{ id: 'tov-1', profession: 'Betonář', professionCode: 'BET', count: 4, hours: 80, normHours: 64, hourlyRate: 398, totalCost: 31840, source: 'calculator' }],
    materials: [],
    source: 'calculator',
    calculated_at: '2026-07-08T10:00:00Z',
  },
};

describe('buildMonolithPayload metadata forwarding', () => {
  test('attaches costs/resources/formwork_info/tov_entries from stringified metadata', () => {
    const payload = buildMonolithPayload({ ...BASE_POS, metadata: JSON.stringify(META) }, 'PRT_x_1');
    expect(payload.tov_entries.labor[0].profession).toBe('Betonář');
    expect(payload.costs.pour_labor_czk).toBe(31840);
    expect(payload.resources.pour_shifts).toBe(1);
    expect(payload.formwork_info.system_name).toBe('Framax Xlife');
    // calculated_at comes from the Aplikovat run, not "now"
    expect(payload.calculated_at).toBe('2026-07-08T10:00:00Z');
  });

  test('accepts metadata already parsed as an object', () => {
    const payload = buildMonolithPayload({ ...BASE_POS, metadata: META }, 'PRT_x_1');
    expect(payload.tov_entries.labor).toHaveLength(1);
  });

  test('basic payload without metadata — no calc fields, no throw', () => {
    const payload = buildMonolithPayload(BASE_POS, 'PRT_x_1');
    expect(payload.tov_entries).toBeUndefined();
    expect(payload.costs).toBeUndefined();
    expect(payload.monolit_position_id).toBe('pos-1');
  });

  test('corrupt metadata JSON degrades to the basic payload', () => {
    const payload = buildMonolithPayload({ ...BASE_POS, metadata: '{broken' }, 'PRT_x_1');
    expect(payload.tov_entries).toBeUndefined();
    expect(payload.cost_czk).toBe(31840);
  });
});
