/**
 * Regression tests for `mergeMonolithPayloadsIntoProjects` — the on-demand
 * merge of Portal monolith payloads (keyed by position_instance_id) into a
 * project's items.
 *
 * Context (2026-07-10 Claude-Chrome verify): after «Aplikovat» in the
 * calculator wrote a rich payload to Portal, the Registry «Předvyplnit TOV»
 * banner never appeared. Root cause: the only merge happened on project-select
 * / Portal-link — both BEFORE the write — so `item.monolith_payload` stayed
 * empty. The fix re-runs this merge when the TOV modal opens; this helper is
 * the pure core it delegates to.
 *
 * Contract (mirrors applyInstanceMappingsToProjects):
 *   - ref-preserving: no change → same project/sheet/item reference chain
 *     (repeated TOV-opens must not churn every row and reset scroll);
 *   - key-order-insensitive payload compare (stableStringify) — a re-serialized
 *     identical payload is NOT a change;
 *   - `matched` distinguishes "already up to date" (matched>0, no change) from
 *     "stale link / id mismatch" (matched===0 with a non-empty map) so the
 *     store can log the right diagnosis.
 */

import { describe, it, expect } from 'vitest';
import { mergeMonolithPayloadsIntoProjects } from './registryStore';
import type { Project, ParsedItem, MonolithPayload } from '../types';

function makeItem(id: string, overrides: Partial<ParsedItem> = {}): ParsedItem {
  return {
    id,
    kod: '',
    popis: 'popis',
    popisDetail: [],
    popisFull: 'popis',
    mj: 'm3',
    mnozstvi: 1,
    cenaJednotkova: 100,
    cenaCelkem: 100,
    skupina: null,
    skupinaSuggested: null,
    source: {
      projectId: 'p1',
      fileName: 't.xlsx',
      sheetName: 's1',
      rowStart: 1,
      rowEnd: 1,
      cellRef: 'A1',
    },
    ...overrides,
  };
}

function makeProject(id: string, items: ParsedItem[]): Project {
  return {
    id,
    fileName: 't.xlsx',
    projectName: 'Test project ' + id,
    filePath: '',
    importedAt: new Date(),
    sheets: [{
      id: 'sheet-' + id,
      name: 'Sheet1',
      projectId: id,
      items,
      stats: { totalItems: items.length, classifiedItems: 0, totalCena: 0 },
      metadata: { projectNumber: '', projectName: '', oddil: '', stavba: '', custom: {} },
      config: {
        templateName: 't', sheetName: 'Sheet1', sheetIndex: 0, dataStartRow: 1,
        metadataCells: {},
        columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
      },
    }],
  };
}

const RICH_PAYLOAD = {
  monolit_position_id: 'mp1',
  part_name: 'Betonáž',
  subtype: 'beton',
  cost_czk: 22400,
  costs: { pour_labor_czk: 4000, formwork_labor_czk: 10000 },
  resources: { pour_shifts: 2 },
  source_tag: 'MONOLIT_LIVE',
} as unknown as MonolithPayload;

describe('mergeMonolithPayloadsIntoProjects — first-time merge (the banner fix)', () => {
  const item = makeItem('i1', { position_instance_id: 'inst_abc' });
  const project = makeProject('p1', [item]);
  const payloads = new Map<string, MonolithPayload>([['inst_abc', RICH_PAYLOAD]]);

  it('writes the payload onto the matched item and reports change', () => {
    const r = mergeMonolithPayloadsIntoProjects([project], 'p1', payloads);
    expect(r.anyChanged).toBe(true);
    expect(r.updated).toBe(1);
    expect(r.matched).toBe(1);
    expect(r.nextProjects[0].sheets[0].items[0].monolith_payload).toEqual(RICH_PAYLOAD);
  });

  it('mints a new reference chain only where it changed', () => {
    const r = mergeMonolithPayloadsIntoProjects([project], 'p1', payloads);
    expect(r.nextProjects[0]).not.toBe(project);
    expect(r.nextProjects[0].sheets[0].items[0]).not.toBe(item);
  });
});

describe('mergeMonolithPayloadsIntoProjects — no-op when already applied', () => {
  it('preserves the exact reference chain (no scroll churn on re-open)', () => {
    const item = makeItem('i1', { position_instance_id: 'inst_abc', monolith_payload: RICH_PAYLOAD });
    const project = makeProject('p1', [item]);
    // Fresh object, same content, keys reshuffled — must read as equal.
    const shuffled = {
      source_tag: 'MONOLIT_LIVE',
      resources: { pour_shifts: 2 },
      costs: { formwork_labor_czk: 10000, pour_labor_czk: 4000 },
      cost_czk: 22400,
      subtype: 'beton',
      part_name: 'Betonáž',
      monolit_position_id: 'mp1',
    } as unknown as MonolithPayload;
    const payloads = new Map<string, MonolithPayload>([['inst_abc', shuffled]]);

    const r = mergeMonolithPayloadsIntoProjects([project], 'p1', payloads);
    expect(r.anyChanged).toBe(false);
    expect(r.updated).toBe(0);
    expect(r.matched).toBe(1); // matched but unchanged = up to date
    expect(r.nextProjects[0]).toBe(project);
    expect(r.nextProjects[0].sheets[0]).toBe(project.sheets[0]);
    expect(r.nextProjects[0].sheets[0].items[0]).toBe(item);
  });

  it('updates when payload content genuinely differs', () => {
    const item = makeItem('i1', { position_instance_id: 'inst_abc', monolith_payload: RICH_PAYLOAD });
    const project = makeProject('p1', [item]);
    const next = { ...(RICH_PAYLOAD as object), cost_czk: 30000 } as unknown as MonolithPayload;
    const payloads = new Map<string, MonolithPayload>([['inst_abc', next]]);
    const r = mergeMonolithPayloadsIntoProjects([project], 'p1', payloads);
    expect(r.anyChanged).toBe(true);
    expect(r.nextProjects[0].sheets[0].items[0].monolith_payload?.cost_czk).toBe(30000);
  });
});

describe('mergeMonolithPayloadsIntoProjects — stale link diagnosis', () => {
  it('matched===0 when payload ids do not overlap local instance ids', () => {
    const item = makeItem('i1', { position_instance_id: 'inst_LOCAL' });
    const project = makeProject('p1', [item]);
    const payloads = new Map<string, MonolithPayload>([['inst_PORTAL', RICH_PAYLOAD]]);
    const r = mergeMonolithPayloadsIntoProjects([project], 'p1', payloads);
    expect(r.matched).toBe(0);
    expect(r.anyChanged).toBe(false);
    expect(r.nextProjects[0]).toBe(project); // untouched
  });

  it('skips items with no position_instance_id (never matches)', () => {
    const item = makeItem('i1'); // no instance id
    const project = makeProject('p1', [item]);
    const payloads = new Map<string, MonolithPayload>([['inst_abc', RICH_PAYLOAD]]);
    const r = mergeMonolithPayloadsIntoProjects([project], 'p1', payloads);
    expect(r.matched).toBe(0);
    expect(r.anyChanged).toBe(false);
  });
});

describe('mergeMonolithPayloadsIntoProjects — isolation & partial updates', () => {
  it('only walks the target project; others keep their reference', () => {
    const p1 = makeProject('p1', [makeItem('i1', { position_instance_id: 'inst_abc' })]);
    const p2 = makeProject('p2', [makeItem('i2', { position_instance_id: 'inst_xyz' })]);
    const payloads = new Map<string, MonolithPayload>([['inst_abc', RICH_PAYLOAD]]);
    const r = mergeMonolithPayloadsIntoProjects([p1, p2], 'p1', payloads);
    expect(r.nextProjects[1]).toBe(p2); // untouched project keeps ref
    expect(r.nextProjects[0]).not.toBe(p1);
  });

  it('preserves sibling item refs within the changed sheet', () => {
    const changed = makeItem('i1', { position_instance_id: 'inst_abc' });
    const sibling = makeItem('i2', { position_instance_id: 'inst_other' });
    const project = makeProject('p1', [changed, sibling]);
    const payloads = new Map<string, MonolithPayload>([['inst_abc', RICH_PAYLOAD]]);
    const r = mergeMonolithPayloadsIntoProjects([project], 'p1', payloads);
    const items = r.nextProjects[0].sheets[0].items;
    expect(items[0]).not.toBe(changed);
    expect(items[1]).toBe(sibling); // untouched sibling keeps ref
  });
});
