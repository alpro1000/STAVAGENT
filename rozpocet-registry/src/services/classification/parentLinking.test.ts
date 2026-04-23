/**
 * Unit tests for parent-linking pass — ALGORITHM v1.1 §4 + §7.
 * Covers edge §6.1 orphan downgrade, §6.2 section reset, §6.3 two mains.
 */

import { describe, it, expect } from 'vitest';
import { assignParentLinks } from './parentLinking';
import type { ClassifiedRowBase } from './classifierTypes';

function mk(
  id: string,
  role: ClassifiedRowBase['rowRole'],
  overrides: Partial<ClassifiedRowBase> = {},
): ClassifiedRowBase {
  return {
    id,
    rowRole: role,
    originalTyp: null,
    classificationConfidence: 1.0,
    classificationSource: 'typ-column',
    por: null,
    kod: null,
    popis: `${role} ${id}`,
    mj: null,
    mnozstvi: null,
    cenaJednotkova: null,
    cenaCelkem: null,
    cenovaSoustava: null,
    varianta: null,
    sourceRowIndex: 0,
    sourceSheetName: 'S1',
    sourceFormat: null,
    ...overrides,
  };
}

describe('assignParentLinks', () => {
  it('links simple section → main → subordinate chain', () => {
    const input = [
      mk('sec1', 'section'),
      mk('main1', 'main'),
      mk('sub1', 'subordinate'),
      mk('sub2', 'subordinate'),
    ];
    const { items, orphanCount } = assignParentLinks(input);
    expect(orphanCount).toBe(0);
    expect(items[0]).toMatchObject({ rowRole: 'section', parentItemId: null, sectionId: null });
    expect(items[1]).toMatchObject({ rowRole: 'main', parentItemId: null, sectionId: 'sec1' });
    expect(items[2]).toMatchObject({ rowRole: 'subordinate', parentItemId: 'main1', sectionId: 'sec1' });
    expect(items[3]).toMatchObject({ rowRole: 'subordinate', parentItemId: 'main1', sectionId: 'sec1' });
  });

  it('edge §6.1 — orphan subordinate at file start downgraded to unknown', () => {
    const input = [
      mk('sub1', 'subordinate'),
      mk('main1', 'main'),
    ];
    const { items, orphanCount, warnings } = assignParentLinks(input);
    expect(orphanCount).toBe(1);
    expect(items[0].rowRole).toBe('unknown');
    expect(items[0].parentItemId).toBeNull();
    expect(items[0].warnings.length).toBe(1);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/Orphan subordinate/);
  });

  it('edge §6.2 — section row resets current main pointer', () => {
    const input = [
      mk('sec1', 'section'),
      mk('main1', 'main'),
      mk('sub1', 'subordinate'),
      mk('sec2', 'section'),
      mk('sub2', 'subordinate'),  // should be orphan since sec2 reset main to null
      mk('main2', 'main'),
      mk('sub3', 'subordinate'),
    ];
    const { items, orphanCount } = assignParentLinks(input);
    expect(orphanCount).toBe(1);
    expect(items[4].rowRole).toBe('unknown');       // sub2 orphan
    expect(items[6].parentItemId).toBe('main2');    // sub3 attaches to main2
    expect(items[6].sectionId).toBe('sec2');
    expect(items[1].sectionId).toBe('sec1');
    expect(items[5].sectionId).toBe('sec2');
  });

  it('edge §6.3 — two main rows in succession both get parentItemId=null', () => {
    const input = [
      mk('sec1', 'section'),
      mk('main1', 'main'),
      mk('main2', 'main'),
      mk('sub1', 'subordinate'),
    ];
    const { items, orphanCount } = assignParentLinks(input);
    expect(orphanCount).toBe(0);
    expect(items[1].parentItemId).toBeNull();
    expect(items[2].parentItemId).toBeNull();
    expect(items[3].parentItemId).toBe('main2');    // attaches to LAST main, not first
  });

  it('tags unknown rows with current section for future promote', () => {
    const input = [
      mk('sec1', 'section'),
      mk('unk1', 'unknown'),
      mk('main1', 'main'),
    ];
    const { items } = assignParentLinks(input);
    expect(items[1].sectionId).toBe('sec1');
    expect(items[1].parentItemId).toBeNull();
  });

  it('handles empty input without crash', () => {
    const { items, orphanCount, warnings } = assignParentLinks([]);
    expect(items).toEqual([]);
    expect(orphanCount).toBe(0);
    expect(warnings).toEqual([]);
  });

  it('preserves all ClassifiedRowBase fields on output items', () => {
    const input = [mk('main1', 'main', { kod: '231112', popis: 'Beton', classificationConfidence: 0.9 })];
    const { items } = assignParentLinks(input);
    expect(items[0].kod).toBe('231112');
    expect(items[0].popis).toBe('Beton');
    expect(items[0].classificationConfidence).toBe(0.9);
  });
});
