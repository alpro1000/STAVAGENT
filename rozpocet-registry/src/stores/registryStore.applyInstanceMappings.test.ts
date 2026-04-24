/**
 * Regression tests for `applyInstanceMappingsToProjects` — guards against
 * the infinite sync-loop bug user-reported 2026-04-24.
 *
 * Loop root cause: `setInstanceMappingCallback` used to produce a new
 * `projects` array reference on every server response even when the
 * incoming mappings were already applied. Zustand's subscriber keys on
 * `state.projects !== prevState.projects`, so every response spawned a
 * follow-up sync → another response → another setState → ... burning
 * ~one request per second on a stable project.
 *
 * The fix is surgical ref-preservation at three levels (project →
 * sheet → item): wrap a new reference ONLY when something below
 * actually changed. These tests exercise that contract.
 */

import { describe, it, expect } from 'vitest';
import { applyInstanceMappingsToProjects } from './registryStore';
import type { Project, ParsedItem } from '../types';
import type { InstanceMapping } from '../services/portalAutoSync';

/** Minimal sheet + item scaffolding — only fields the helper reads.
 *  `overrides` is a proper `Partial<ParsedItem>` so callers get type
 *  checking on the fields they pass (the previous
 *  `Partial<Parameters<typeof Object>[0]>` resolved to `Partial<any>`
 *  and silently accepted nonsense). */
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

describe('applyInstanceMappingsToProjects — first-time assignment', () => {
  const item = makeItem('i1');
  const project = makeProject('p1', [item]);
  const mappings: InstanceMapping[] = [{
    registry_item_id: 'i1',
    position_instance_id: 'inst_abc',
  }];

  it('reports anyChanged=true when a new position_instance_id is assigned', () => {
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.anyChanged).toBe(true);
  });

  it('writes position_instance_id onto the matched item', () => {
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.nextProjects[0].sheets[0].items[0].position_instance_id).toBe('inst_abc');
  });

  it('produces a NEW project reference on real change', () => {
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.nextProjects[0]).not.toBe(project);
    expect(r.nextProjects[0].sheets[0]).not.toBe(project.sheets[0]);
    expect(r.nextProjects[0].sheets[0].items[0]).not.toBe(item);
  });
});

describe('applyInstanceMappingsToProjects — no-op when already applied (the regression)', () => {
  // Item already has the instance_id the server is re-sending.
  const item = makeItem('i1', { position_instance_id: 'inst_abc' });
  const project = makeProject('p1', [item]);
  const mappings: InstanceMapping[] = [{
    registry_item_id: 'i1',
    position_instance_id: 'inst_abc',
  }];

  it('reports anyChanged=false', () => {
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.anyChanged).toBe(false);
  });

  it('PRESERVES the exact project / sheet / item reference chain', () => {
    const r = applyInstanceMappingsToProjects([project], mappings);
    // Critical: without ref-preservation the Zustand subscriber keys on
    // `state.projects !== prevState.projects` and would re-fire sync.
    expect(r.nextProjects[0]).toBe(project);
    expect(r.nextProjects[0].sheets[0]).toBe(project.sheets[0]);
    expect(r.nextProjects[0].sheets[0].items[0]).toBe(item);
  });
});

describe('applyInstanceMappingsToProjects — monolith_payload deep equality', () => {
  const payload = {
    monolit_position_id: 'mp1',
    monolit_project_id: 'mpr1',
    part_name: 'Betonáž',
    subtype: 'beton',
    crew_size: 4,
    wage_czk_ph: 350,
    shift_hours: 8,
    days: 2,
    labor_hours: 64,
    cost_czk: 22400,
    source_tag: 'test',
    confidence: 0.9,
    calculated_at: '2026-04-24T10:00:00Z',
  };

  it('no-op when server returns an equivalent monolith_payload as a fresh object', () => {
    const item = makeItem('i1', { position_instance_id: 'inst_abc', monolith_payload: payload });
    const project = makeProject('p1', [item]);
    // Fresh object with same contents — reference-different, value-equal.
    const freshPayload = JSON.parse(JSON.stringify(payload));
    const mappings: InstanceMapping[] = [{
      registry_item_id: 'i1',
      position_instance_id: 'inst_abc',
      monolith_payload: freshPayload,
    }];
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.anyChanged).toBe(false);
    expect(r.monolithCount).toBe(0);
    expect(r.nextProjects[0]).toBe(project);
  });

  it('updates when server payload content differs', () => {
    const item = makeItem('i1', { position_instance_id: 'inst_abc', monolith_payload: payload });
    const project = makeProject('p1', [item]);
    const updatedPayload = { ...payload, cost_czk: 25000 };
    const mappings: InstanceMapping[] = [{
      registry_item_id: 'i1',
      position_instance_id: 'inst_abc',
      monolith_payload: updatedPayload,
    }];
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.anyChanged).toBe(true);
    expect(r.monolithCount).toBe(1);
    expect(r.nextProjects[0].sheets[0].items[0].monolith_payload?.cost_czk).toBe(25000);
  });

  it('updates first-time when item has no previous monolith_payload', () => {
    const item = makeItem('i1', { position_instance_id: 'inst_abc' });
    const project = makeProject('p1', [item]);
    const mappings: InstanceMapping[] = [{
      registry_item_id: 'i1',
      position_instance_id: 'inst_abc',
      monolith_payload: payload,
    }];
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.anyChanged).toBe(true);
    expect(r.monolithCount).toBe(1);
  });

  it('no-op when server returns the same payload with a different key order', () => {
    // Amazon Q review flag on PR #1019: naïve `JSON.stringify(a) !==
    // JSON.stringify(b)` produces false-positive "changed" when a server
    // serializes the same content with a different insertion order (e.g.
    // a deploy switching from alphabetical to schema-defined order, or
    // a JSON library that doesn't guarantee stable key order).
    // Verify the stable-stringify comparison handles it.
    const item = makeItem('i1', { position_instance_id: 'inst_abc', monolith_payload: payload });
    const project = makeProject('p1', [item]);

    // Manually build an equivalent payload with keys inserted in a
    // different order. Same values, same keys, reshuffled.
    const shuffledPayload = {
      calculated_at: payload.calculated_at,
      confidence: payload.confidence,
      source_tag: payload.source_tag,
      cost_czk: payload.cost_czk,
      labor_hours: payload.labor_hours,
      days: payload.days,
      shift_hours: payload.shift_hours,
      wage_czk_ph: payload.wage_czk_ph,
      crew_size: payload.crew_size,
      subtype: payload.subtype,
      part_name: payload.part_name,
      monolit_project_id: payload.monolit_project_id,
      monolit_position_id: payload.monolit_position_id,
    };

    const mappings: InstanceMapping[] = [{
      registry_item_id: 'i1',
      position_instance_id: 'inst_abc',
      monolith_payload: shuffledPayload,
    }];
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.anyChanged).toBe(false);
    expect(r.monolithCount).toBe(0);
    // Full ref chain must be preserved — that's the whole point of the
    // stable compare. A false-positive here would leak into the
    // Zustand subscriber and reopen the infinite-sync loop.
    expect(r.nextProjects[0]).toBe(project);
  });

  it('no-op when nested-object properties (e.g. costs) differ only in key order', () => {
    const nestedPayload = {
      ...payload,
      costs: {
        formwork_labor_czk: 10000,
        rebar_labor_czk: 8000,
        pour_labor_czk: 4000,
        pour_night_premium_czk: 500,
        total_labor_czk: 22500,
        formwork_rental_czk: 5000,
        props_labor_czk: 2000,
        props_rental_czk: 1500,
      },
    };
    const item = makeItem('i1', {
      position_instance_id: 'inst_abc',
      monolith_payload: nestedPayload,
    });
    const project = makeProject('p1', [item]);

    const shuffledNested = {
      // Top-level fields in different order:
      calculated_at: payload.calculated_at,
      monolit_position_id: payload.monolit_position_id,
      cost_czk: payload.cost_czk,
      monolit_project_id: payload.monolit_project_id,
      part_name: payload.part_name,
      subtype: payload.subtype,
      crew_size: payload.crew_size,
      wage_czk_ph: payload.wage_czk_ph,
      shift_hours: payload.shift_hours,
      days: payload.days,
      labor_hours: payload.labor_hours,
      source_tag: payload.source_tag,
      confidence: payload.confidence,
      // Nested `costs` object ALSO in different key order:
      costs: {
        total_labor_czk: 22500,
        props_rental_czk: 1500,
        props_labor_czk: 2000,
        formwork_rental_czk: 5000,
        pour_night_premium_czk: 500,
        pour_labor_czk: 4000,
        rebar_labor_czk: 8000,
        formwork_labor_czk: 10000,
      },
    };

    const mappings: InstanceMapping[] = [{
      registry_item_id: 'i1',
      position_instance_id: 'inst_abc',
      monolith_payload: shuffledNested,
    }];
    const r = applyInstanceMappingsToProjects([project], mappings);
    expect(r.anyChanged).toBe(false);
    expect(r.nextProjects[0]).toBe(project);
  });
});

describe('applyInstanceMappingsToProjects — partial updates preserve siblings', () => {
  it('only touches the project / sheet / item that actually changed', () => {
    const itemA = makeItem('iA', { position_instance_id: 'inst_A' });  // already mapped
    const itemB = makeItem('iB');                                       // needs mapping
    const itemC = makeItem('iC', { position_instance_id: 'inst_C' });  // already mapped
    const project = makeProject('p1', [itemA, itemB, itemC]);
    const project2 = makeProject('p2', [makeItem('iD', { position_instance_id: 'inst_D' })]);

    const mappings: InstanceMapping[] = [
      { registry_item_id: 'iA', position_instance_id: 'inst_A' },
      { registry_item_id: 'iB', position_instance_id: 'inst_B' },
      { registry_item_id: 'iC', position_instance_id: 'inst_C' },
      { registry_item_id: 'iD', position_instance_id: 'inst_D' },
    ];

    const r = applyInstanceMappingsToProjects([project, project2], mappings);
    expect(r.anyChanged).toBe(true);

    // project2 is entirely unchanged → same reference.
    expect(r.nextProjects[1]).toBe(project2);

    // project (which had iB update) gets a new reference ... but within
    // its new sheet, siblings iA and iC retain their original refs.
    expect(r.nextProjects[0]).not.toBe(project);
    const nextSheet = r.nextProjects[0].sheets[0];
    expect(nextSheet.items[0]).toBe(itemA);
    expect(nextSheet.items[1]).not.toBe(itemB);
    expect(nextSheet.items[1].position_instance_id).toBe('inst_B');
    expect(nextSheet.items[2]).toBe(itemC);
  });
});

describe('applyInstanceMappingsToProjects — degenerate inputs', () => {
  it('handles an empty mappings array as no-op', () => {
    const project = makeProject('p1', [makeItem('i1')]);
    const r = applyInstanceMappingsToProjects([project], []);
    expect(r.anyChanged).toBe(false);
    expect(r.nextProjects[0]).toBe(project);
  });

  it('handles an empty projects array', () => {
    const r = applyInstanceMappingsToProjects([], [
      { registry_item_id: 'anything', position_instance_id: 'anything' },
    ]);
    expect(r.anyChanged).toBe(false);
    expect(r.nextProjects).toEqual([]);
  });

  it('ignores mappings whose registry_item_id does not match any item', () => {
    const item = makeItem('i1', { position_instance_id: 'inst_1' });
    const project = makeProject('p1', [item]);
    const r = applyInstanceMappingsToProjects([project], [
      { registry_item_id: 'ghost', position_instance_id: 'inst_ghost' },
    ]);
    expect(r.anyChanged).toBe(false);
    expect(r.nextProjects[0]).toBe(project);
  });
});
