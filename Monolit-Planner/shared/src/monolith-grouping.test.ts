/**
 * Golden tests for the shared grouping layer (Gate 3, ADR-007 §4) —
 * one describe block per catalog layout, plus the failure-mode negatives
 * from design §6 (never force-attach) and the classifier-interplay guard
 * (inclusion mentions must not hijack beton parents).
 */
import { describe, it, expect } from 'vitest';
import { groupMonolithRows } from './monolith-grouping.js';
import { classifyMonolithRow } from './monolith-classifier.js';

describe('classifier interplay — inclusion mentions (prerequisite for OTSKP layout)', () => {
  it('«ZÁKLADY … VČETNĚ BEDNĚNÍ» stays a beton row, not a formwork sub-work', () => {
    const r = classifyMonolithRow({
      item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C25/30 VČETNĚ BEDNĚNÍ',
      otskp_code: '273325',
    });
    expect(r.sub_role).toBe('beton');
    expect(r.is_monolith).toBe(true);
  });

  it('«vč. výztuže» does not make the row a rebar sub-work', () => {
    const r = classifyMonolithRow({ item_name: 'Deska C30/37 vč. výztuže' });
    expect(r.sub_role).toBe('beton');
  });

  it('a genuine formwork row still classifies as bednění', () => {
    expect(classifyMonolithRow({ item_name: 'Bednění základů rovinné' }).sub_role).toBe('bednění');
    expect(classifyMonolithRow({ item_name: 'Zřízení bednění stěn' }).sub_role).toBe('bednění');
  });
});

describe('layout 1 — OTSKP (beton incl. formwork, výztuž separate)', () => {
  const rows = [
    { id: 'b', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C25/30 VČETNĚ BEDNĚNÍ', otskp_code: '273325', unit: 'm3' },
    { id: 'r', item_name: 'VÝZTUŽ ZÁKLADŮ Z OCELI B500B', otskp_code: '273366', unit: 't' },
  ];

  it('groups výztuž under the beton parent by code prefix (automatic)', () => {
    const { groups, ungrouped } = groupMonolithRows(rows);
    expect(groups).toHaveLength(1);
    expect(ungrouped).toHaveLength(0);
    expect(groups[0].parent.id).toBe('b');
    expect(groups[0].children).toHaveLength(1);
    expect(groups[0].children[0].row.id).toBe('r');
    expect(groups[0].children[0].pairing).toBe('code_prefix');
    expect(groups[0].children[0].classification.sub_role).toBe('výztuž');
  });

  it('parent carries formwork_included=true from the VČETNĚ BEDNĚNÍ mention', () => {
    const { groups } = groupMonolithRows(rows);
    expect(groups[0].formwork_included).toBe(true);
    expect(groups[0].rebar_included).toBe(true);
  });
});

describe('layout 2 — ÚRS (all separate, formwork as montáž+demontáž pair)', () => {
  const rows = [
    { id: 'b', item_name: 'Základy z betonu železového C25/30', otskp_code: '274313611', unit: 'm3' },
    { id: 'fm', item_name: 'Bednění základů - zřízení', otskp_code: '274351215', unit: 'm2' },
    { id: 'fd', item_name: 'Bednění základů - odstranění', otskp_code: '274351216', unit: 'm2' },
    { id: 'r', item_name: 'Výztuž základů B500B', otskp_code: '274361821', unit: 't' },
  ];

  it('all three children attach by code prefix; the formwork pair carries phases', () => {
    const { groups, ungrouped } = groupMonolithRows(rows);
    expect(groups).toHaveLength(1);
    expect(ungrouped).toHaveLength(0);
    const children = groups[0].children;
    expect(children).toHaveLength(3);

    const montaz = children.find(c => c.row.id === 'fm');
    const demontaz = children.find(c => c.row.id === 'fd');
    const rebar = children.find(c => c.row.id === 'r');
    expect(montaz?.classification.sub_role).toBe('bednění');
    expect(montaz?.formwork_phase).toBe('montáž');
    expect(demontaz?.formwork_phase).toBe('demontáž');
    expect(rebar?.classification.sub_role).toBe('výztuž');
    expect(rebar?.formwork_phase).toBeUndefined();
  });

  it('ÚRS parent without inclusion mentions has formwork_included=false', () => {
    const { groups } = groupMonolithRows(rows);
    expect(groups[0].formwork_included).toBe(false);
    expect(groups[0].rebar_included).toBe(true);
  });
});

describe('layout 3 — all-in-one (single row, price includes sub-works)', () => {
  it('a lone beton row forms a childless group with inclusion flags', () => {
    const { groups, ungrouped } = groupMonolithRows([
      {
        id: 'x',
        item_name: 'Opěrná stěna C30/37 včetně bednění a výztuže',
        otskp_code: '327324',
        unit: 'm3',
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(ungrouped).toHaveLength(0);
    expect(groups[0].children).toHaveLength(0);
    expect(groups[0].classification.sub_role).toBe('beton');
    expect(groups[0].formwork_included).toBe(true);
  });

  it('«nezahrnuje … výztuž» flips rebar_included to false', () => {
    const { groups } = groupMonolithRows([
      { id: 'x', item_name: 'Deska C30/37 — položka nezahrnuje dodání výztuže', unit: 'm3' },
    ]);
    expect(groups[0].rebar_included).toBe(false);
  });
});

describe('layout 4 — all-separate without codes (name-overlap suggestion)', () => {
  const rows = [
    { id: 'b', item_name: 'Opěrná stěna suterénu beton C30/37', unit: 'm3' },
    { id: 'f', item_name: 'Opěrná stěna suterénu — bednění oboustranné', unit: 'm2' },
    { id: 'r', item_name: 'Opěrná stěna suterénu — výztuž B500B', unit: 't' },
  ];

  it('children attach as SUGGESTIONS (name_overlap), not automatic', () => {
    const { groups, ungrouped } = groupMonolithRows(rows);
    expect(groups).toHaveLength(1);
    expect(ungrouped).toHaveLength(0);
    expect(groups[0].children).toHaveLength(2);
    for (const child of groups[0].children) {
      expect(child.pairing).toBe('name_overlap');
    }
  });
});

describe('disambiguation and failure modes (design §6)', () => {
  it('a child code-prefix-matches the RIGHT parent among several', () => {
    const { groups } = groupMonolithRows([
      { id: 'b1', item_name: 'Základy opěr C25/30', otskp_code: '272325', unit: 'm3' },
      { id: 'b2', item_name: 'Dřík pilíře C30/37', otskp_code: '336325', unit: 'm3' },
      { id: 'r2', item_name: 'Výztuž dříku B500B', otskp_code: '336366', unit: 't' },
    ]);
    const withChild = groups.find(g => g.children.length > 0);
    expect(withChild?.parent.id).toBe('b2');
    expect(withChild?.children[0].pairing).toBe('code_prefix');
  });

  it('an unpairable child is NEVER force-attached — it stays ungrouped', () => {
    const { groups, ungrouped } = groupMonolithRows([
      { id: 'b', item_name: 'Základy opěr C25/30', otskp_code: '272325', unit: 'm3' },
      { id: 'orphan', item_name: 'Výztuž říms mostního svršku B500B', otskp_code: '422366', unit: 't' },
    ]);
    expect(groups[0].children).toHaveLength(0);
    expect(ungrouped.map(u => u.row.id)).toContain('orphan');
  });

  it('kamenivo and prefab rows pass through as ungrouped, never as parents', () => {
    const { groups, ungrouped } = groupMonolithRows([
      { id: 'agg', item_name: 'Výplň z kameniva drceného', otskp_code: '45852', unit: 'm3' },
      { id: 'pre', item_name: 'PATKY Z DÍLCŮ C25/30', unit: 'm3' },
    ]);
    expect(groups).toHaveLength(0);
    expect(ungrouped).toHaveLength(2);
  });

  it('one-word overlap is not enough for a suggestion (≥2 significant words)', () => {
    const { groups, ungrouped } = groupMonolithRows([
      { id: 'b', item_name: 'Základy mostních opěr C25/30', unit: 'm3' },
      { id: 'f', item_name: 'Bednění říms — použití systémové', unit: 'm2' },
    ]);
    expect(groups[0].children).toHaveLength(0);
    expect(ungrouped.map(u => u.row.id)).toContain('f');
  });
});
