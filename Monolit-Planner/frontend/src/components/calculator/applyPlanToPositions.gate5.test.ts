/**
 * Gate 5 (ADR-007): calculator output → smeta position mapping.
 *
 * Pins the three contract points from the spec:
 *   1. sub-work labor lands on the CORRECT position (explicit row wins);
 *   2. formwork_included collapses bednění into the beton position («v ceně
 *      betonové položky») instead of AUTO-CREATING a sibling that would
 *      double-count work already priced inside the OTSKP beton item;
 *   3. days never double — the main bucket's dominant trio stays the
 *      betonář's even when tesař entries collapse in (element duration is
 *      the critical-path schedule persisted in metadata.schedule_info, not
 *      a sum of operation days).
 */
import { describe, it, expect } from 'vitest';
import {
  routeDraftsToBuckets,
  readFormworkIncluded,
  addDraftToBucket,
} from './applyPlanToPositions';
import type { WorkType, TOVLaborEntry } from '@stavagent/monolit-shared';

const entry = (over: Partial<TOVLaborEntry> = {}): TOVLaborEntry => ({
  id: 'tov-x', profession: 'X', professionCode: 'X',
  count: 4, hours: 100, normHours: 80, hourlyRate: 400, totalCost: 40000,
  source: 'calculator',
  ...over,
});

const draft = (workType: WorkType, days: number, over: Partial<TOVLaborEntry> = {}) => ({
  workType, days, crew: 4, wage: 400, entry: entry(over),
});

const CTX = {};      // no URL sibling ids
// findLinkedPositions result shape with no matches
const LINKED = { related: [] } as never;
const noTemplate = () => null;
const tpl = () => ({ subtype: 'bednění', unit: 'm2', qty: 100, item_name: 'X — bednění' });
let seq = 0;
const genId = () => `new-${++seq}`;

describe('readFormworkIncluded', () => {
  it('reads true from object and JSON-string metadata', () => {
    expect(readFormworkIncluded({ formwork_included: true })).toBe(true);
    expect(readFormworkIncluded(JSON.stringify({ formwork_included: true, linked_positions: [] }))).toBe(true);
  });

  it('false / absent / malformed → false', () => {
    expect(readFormworkIncluded({ formwork_included: false })).toBe(false);
    expect(readFormworkIncluded({})).toBe(false);
    expect(readFormworkIncluded(null)).toBe(false);
    expect(readFormworkIncluded('not json')).toBe(false);
  });
});

describe('routeDraftsToBuckets — formwork_included collapse (contract point 2)', () => {
  it('WITHOUT the flag, bednění auto-creates a sibling position', () => {
    const { buckets, newSpecs } = routeDraftsToBuckets(
      [draft('beton', 5), draft('bednění_zřízení', 3, { note: 'montáž bednění' })],
      'main-1', CTX, LINKED,
      { formworkIncluded: false, templateFor: tpl, genId },
    );
    expect(newSpecs.size).toBe(1);
    expect(buckets.size).toBe(2);
    expect(buckets.get('main-1')!.entries).toHaveLength(1); // beton only
  });

  it('WITH the flag, bednění collapses into the beton position, labeled «v ceně»', () => {
    const { buckets, newSpecs } = routeDraftsToBuckets(
      [
        draft('beton', 5),
        draft('bednění_zřízení', 3, { note: 'montáž bednění' }),
        draft('bednění_odstranění', 2, { note: 'demontáž bednění' }),
      ],
      'main-1', CTX, LINKED,
      { formworkIncluded: true, templateFor: tpl, genId },
    );
    expect(newSpecs.size).toBe(0);              // nothing auto-created
    expect(buckets.size).toBe(1);               // everything on main
    const main = buckets.get('main-1')!;
    expect(main.entries).toHaveLength(3);
    expect(main.entries[1].note).toBe('montáž bednění — v ceně betonové položky');
    expect(main.entries[2].note).toBe('demontáž bednění — v ceně betonové položky');
  });

  it('an EXPLICIT bednění row still wins over the flag (smeta structure beats it)', () => {
    const { buckets, newSpecs } = routeDraftsToBuckets(
      [draft('beton', 5), draft('bednění_zřízení', 3)],
      'main-1',
      { bedneni_position_id: 'row-bedneni' },
      LINKED,
      { formworkIncluded: true, templateFor: tpl, genId },
    );
    expect(newSpecs.size).toBe(0);
    expect(buckets.get('row-bedneni')!.entries).toHaveLength(1);
    expect(buckets.get('main-1')!.entries).toHaveLength(1);
    // No «v ceně» label when routed to the explicit row
    expect(buckets.get('row-bedneni')!.entries[0].note).toBeUndefined();
  });

  it('the flag never collapses výztuž — only formwork types', () => {
    const { buckets, newSpecs } = routeDraftsToBuckets(
      [draft('beton', 5), draft('výztuž', 4)],
      'main-1', CTX, LINKED,
      { formworkIncluded: true, templateFor: () => ({ subtype: 'výztuž', unit: 't', qty: 2, item_name: 'X — výztuž' }), genId },
    );
    expect(newSpecs.size).toBe(1); // výztuž still auto-creates its own row
    expect(buckets.get('main-1')!.entries).toHaveLength(1);
  });
});

describe('days never double (contract point 3)', () => {
  it('collapsed tesař drafts do NOT overwrite the betonář trio on main', () => {
    const { buckets } = routeDraftsToBuckets(
      [
        { workType: 'beton' as WorkType, days: 5, crew: 6, wage: 450, entry: entry() },
        { workType: 'bednění_zřízení' as WorkType, days: 12, crew: 4, wage: 400, entry: entry() },
      ],
      'main-1', CTX, LINKED,
      { formworkIncluded: true, templateFor: tpl, genId },
    );
    const main = buckets.get('main-1')!;
    expect(main.days).toBe(5);   // betonář days, NOT 5+12 and NOT 12
    expect(main.crew).toBe(6);
    expect(main.wage).toBe(450);
  });

  it('addDraftToBucket seeds once and never sums days', () => {
    const buckets = new Map();
    addDraftToBucket(buckets, 'p1', { workType: 'beton' as WorkType, days: 5, crew: 6, wage: 450, entry: entry() }, true);
    addDraftToBucket(buckets, 'p1', { workType: 'zrání' as WorkType, days: 9, crew: 1, wage: 320, entry: entry() }, true);
    expect(buckets.get('p1').days).toBe(5);
    expect(buckets.get('p1').entries).toHaveLength(2);
  });
});

describe('sub-work lands on the correct position (contract point 1)', () => {
  it('URL sibling ids route each work type to its own row', () => {
    const { buckets, newSpecs } = routeDraftsToBuckets(
      [draft('beton', 5), draft('výztuž', 4), draft('bednění_zřízení', 3)],
      'main-1',
      { vyzuz_position_id: 'row-vyztuz', bedneni_position_id: 'row-bedneni' },
      LINKED,
      { formworkIncluded: false, templateFor: noTemplate, genId },
    );
    expect(newSpecs.size).toBe(0);
    expect(buckets.get('row-vyztuz')!.entries).toHaveLength(1);
    expect(buckets.get('row-bedneni')!.entries).toHaveLength(1);
    expect(buckets.get('main-1')!.entries).toHaveLength(1);
  });
});
