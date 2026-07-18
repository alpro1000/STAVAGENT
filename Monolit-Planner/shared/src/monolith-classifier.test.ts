import { describe, it, expect } from 'vitest';
import { isMonolithicElement, isMonolithGroup, readMonolithOverride } from './monolith-classifier.js';

describe('isMonolithicElement', () => {
  describe('aggregate / kamenivo (live bug from screenshot)', () => {
    it('rejects "VÝPLŇ ZA OPĚRAMI A ZDMI Z KAMENIVA DRCENÉHO" (code 45852)', () => {
      expect(isMonolithicElement({
        item_name: 'VÝPLŇ ZA OPĚRAMI A ZDMI Z KAMENIVA DRCENÉHO',
        otskp_code: '45852',
      })).toBe(false);
    });

    it('rejects "PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z KAMENIVA TĚŽENÉHO" (code 45157)', () => {
      expect(isMonolithicElement({
        item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z KAMENIVA TĚŽENÉHO',
        otskp_code: '45157',
      })).toBe(false);
    });

    it('rejects štěrkový podsyp regardless of code', () => {
      expect(isMonolithicElement({
        item_name: 'Štěrkodrť 0–32',
        otskp_code: '45110',
      })).toBe(false);
    });
  });

  describe('genuine monolithic concrete', () => {
    it('accepts "ZÁKLADY ZE ŽELEZOBETONU DO C30/37" (code 273325)', () => {
      expect(isMonolithicElement({
        item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37',
        otskp_code: '273325',
      })).toBe(true);
    });

    it('accepts "MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU" (code 421)', () => {
      expect(isMonolithicElement({
        item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37',
        otskp_code: '421325',
      })).toBe(true);
    });

    it('accepts work-in-progress row with no code', () => {
      expect(isMonolithicElement({
        item_name: 'Beton základů',
        otskp_code: null,
      })).toBe(true);
    });
  });

  describe('manual override', () => {
    it('respects metadata.is_monolith_override = true even for kamenivo', () => {
      expect(isMonolithicElement({
        item_name: 'KAMENIVO DRCENÉ',
        otskp_code: '45852',
        metadata: { is_monolith_override: true },
      })).toBe(true);
    });

    it('respects metadata.is_monolith_override = false even for proper beton', () => {
      expect(isMonolithicElement({
        item_name: 'ZÁKLADY ZE ŽELEZOBETONU',
        otskp_code: '273325',
        metadata: { is_monolith_override: false },
      })).toBe(false);
    });

    it('parses override from JSON-string metadata', () => {
      expect(isMonolithicElement({
        item_name: 'KAMENIVO',
        metadata: JSON.stringify({ is_monolith_override: true, foo: 'bar' }),
      })).toBe(true);
    });
  });

  describe('readMonolithOverride', () => {
    it('returns null on missing/invalid metadata', () => {
      expect(readMonolithOverride(null)).toBeNull();
      expect(readMonolithOverride(undefined)).toBeNull();
      expect(readMonolithOverride('not json')).toBeNull();
      expect(readMonolithOverride('{}')).toBeNull();
      expect(readMonolithOverride({ foo: 'bar' })).toBeNull();
    });

    it('returns the boolean override when present', () => {
      expect(readMonolithOverride({ is_monolith_override: true })).toBe(true);
      expect(readMonolithOverride({ is_monolith_override: false })).toBe(false);
      expect(readMonolithOverride('{"is_monolith_override":false}')).toBe(false);
    });
  });

  describe('OTSKP code edge cases', () => {
    it('rejects 11x (zemní práce)', () => {
      expect(isMonolithicElement({ item_name: 'Odkopávka', otskp_code: '11337' })).toBe(false);
    });
    it('rejects 17x (skládka)', () => {
      expect(isMonolithicElement({ item_name: 'Vodorovné přemístění', otskp_code: '17120' })).toBe(false);
    });
    it('rejects 45x (podsypy a podkladní vrstvy)', () => {
      expect(isMonolithicElement({ item_name: 'Vrstva ze štěrkodrti', otskp_code: '45151' })).toBe(false);
    });
    it('handles whitespace in code', () => {
      expect(isMonolithicElement({ item_name: 'Beton', otskp_code: ' 273 325 ' })).toBe(true);
    });
  });
});

// ─── ADR-007 Gate 2: classifyMonolithRow (structured ladder) ────────────────
//
// Golden + negative contract for the unified classifier. The boolean wrapper
// tests above must stay green untouched — these pin the NEW surface.

import { classifyMonolithRow } from './monolith-classifier.js';

describe('classifyMonolithRow — ADR-007 signal ladder', () => {
  describe('marka betonu (strong positive)', () => {
    it('marka alone (no code) → monolith beton, decided by marka', () => {
      const r = classifyMonolithRow({ item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C25/30' });
      expect(r.is_monolith).toBe(true);
      expect(r.sub_role).toBe('beton');
      expect(r.decided_by).toBe('marka');
      expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('lightweight LC and spaced grades match', () => {
      expect(classifyMonolithRow({ item_name: 'Deska LC25/28' }).decided_by).toBe('marka');
      expect(classifyMonolithRow({ item_name: 'Beton C 30 / 37' }).decided_by).toBe('marka');
    });
  });

  describe('prefab veto (beats marka — ADR-007 §1)', () => {
    it('«PATKY Z DÍLCŮ C25/30» is NOT a monolith despite the grade', () => {
      const r = classifyMonolithRow({ item_name: 'PATKY Z DÍLCŮ C25/30', unit: 'm3' });
      expect(r.is_monolith).toBe(false);
      expect(r.is_prefab).toBe(true);
      expect(r.decided_by).toBe('prefab_veto');
      expect(r.signals).toContain('marka'); // detected, but vetoed
    });

    it('prefabrikát vocabulary vetoes', () => {
      expect(classifyMonolithRow({ item_name: 'Prefabrikované schodiště C30/37' }).is_monolith).toBe(false);
    });

    it('dilatace is NEVER prefab-vetoed (dil-forms must not match dilatační)', () => {
      const r = classifyMonolithRow({ item_name: 'Dilatační závěr povrchový' });
      expect(r.is_prefab).toBe(false);
      expect(r.decided_by).not.toBe('prefab_veto');
    });
  });

  describe('sub-work text beats marka (rebar/formwork rows quote the parent grade)', () => {
    it('výztuž row with parent marka stays výztuž, not beton', () => {
      const r = classifyMonolithRow({ item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C25/30 - VÝZTUŽ B500B', unit: 't' });
      expect(r.is_monolith).toBe(false);
      expect(r.sub_role).toBe('výztuž');
      expect(r.decided_by).toBe('rebar_text');
    });

    it('bednění row → bednění', () => {
      const r = classifyMonolithRow({ item_name: 'Bednění základů rovinné', unit: 'm2' });
      expect(r.sub_role).toBe('bednění');
      expect(r.is_monolith).toBe(false);
    });

    it('odbednění → bednění (one sub-role, two phases per ADR-007 §3)', () => {
      expect(classifyMonolithRow({ item_name: 'Odbednění stěn' }).sub_role).toBe('bednění');
    });
  });

  describe('§451x prostý beton exception (interview answer 2)', () => {
    it('«Podkladní beton» under a 451x code IS a computable monolith', () => {
      const r = classifyMonolithRow({ item_name: 'Podkladní beton', otskp_code: '45123', unit: 'm3' });
      expect(r.is_monolith).toBe(true);
      expect(r.sub_role).toBe('beton');
      expect(r.decided_by).toBe('podkladni_beton_451');
    });

    it('kamenivo under 451x stays rejected (aggregate wins)', () => {
      const r = classifyMonolithRow({ item_name: 'PODKLADNÍ VRSTVY Z KAMENIVA TĚŽENÉHO', otskp_code: '45157' });
      expect(r.is_monolith).toBe(false);
      expect(r.decided_by).toBe('aggregate');
    });

    it('asphalt stays a hard reject even though «asfaltový beton» contains the keyword', () => {
      const r = classifyMonolithRow({ item_name: 'Asfaltový beton ACO 11', otskp_code: '56452', unit: 'm3' });
      expect(r.is_monolith).toBe(false);
      expect(r.decided_by).toBe('code_non_monolithic');
    });
  });

  describe('weak signal: m³ + concrete keyword (interview answer 1)', () => {
    it('«Betonáž stěn» m³, no code, no marka → monolith at reduced confidence', () => {
      const r = classifyMonolithRow({ item_name: 'Betonáž stěn suterénu', unit: 'm3' });
      expect(r.is_monolith).toBe(true);
      expect(r.decided_by).toBe('m3_concrete_keyword');
      expect(r.confidence).toBeLessThan(0.9);
      expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('m³ ALONE never classifies — neutral row falls to the low-confidence fallback', () => {
      const r = classifyMonolithRow({ item_name: 'Položka bez popisu', unit: 'm3' });
      expect(r.decided_by).toBe('fallback');
      expect(r.confidence).toBeLessThanOrEqual(0.3);
    });
  });

  describe('override is absolute (both directions)', () => {
    it('override=true wins over prefab veto', () => {
      const r = classifyMonolithRow({
        item_name: 'PATKY Z DÍLCŮ C25/30',
        metadata: { is_monolith_override: true },
      });
      expect(r.is_monolith).toBe(true);
      expect(r.decided_by).toBe('override');
      expect(r.is_prefab).toBe(true); // detection still reported
    });

    it('override=false wins over marka', () => {
      const r = classifyMonolithRow({
        item_name: 'Beton C30/37',
        metadata: { is_monolith_override: false },
      });
      expect(r.is_monolith).toBe(false);
      expect(r.decided_by).toBe('override');
    });
  });

  describe('unit is tie-break only (sub-role), never is_monolith', () => {
    it('non-mono coded row in m2 → bednění sub-role', () => {
      const r = classifyMonolithRow({ item_name: 'Úprava povrchu', otskp_code: '58910', unit: 'm2' });
      expect(r.is_monolith).toBe(false);
      expect(r.sub_role).toBe('bednění');
    });

    it('non-mono coded row in t → výztuž sub-role', () => {
      const r = classifyMonolithRow({ item_name: 'Doplňky', otskp_code: '91234', unit: 't' });
      expect(r.is_monolith).toBe(false);
      expect(r.sub_role).toBe('výztuž');
    });
  });

  describe('boolean-wrapper parity (pre-ADR contract preserved)', () => {
    it('a 9xxxx code decides false — never falls through to the fallback', () => {
      const r = classifyMonolithRow({ item_name: 'Dopravní značení', otskp_code: '91567' });
      expect(r.is_monolith).toBe(false);
      expect(r.decided_by).toBe('code_non_monolithic');
    });

    it('mono-prefix code → beton at 0.9', () => {
      const r = classifyMonolithRow({ item_name: 'ZÁKLADY ZE ŽELEZOBETONU', otskp_code: '273325' });
      expect(r.is_monolith).toBe(true);
      expect(r.decided_by).toBe('code_monolithic');
    });
  });
});

describe('isMonolithGroup — THE single predicate (bug monolit-jen-monolity-predicate)', () => {
  it('subtype=beton is TRUTH — aggregate import text never re-classifies the group out', () => {
    // The live bug: user re-designated a kamenivo-текст row to beton; the
    // export re-ran the text classifier and dropped it. subtype wins now.
    const rows = [
      { subtype: 'beton', metadata: null },      // item_name irrelevant — not consulted
      { subtype: 'bednění', metadata: null },
    ];
    expect(isMonolithGroup(rows)).toBe(true);
  });

  it('no beton row + no override → not a monolith (standalone výztuž/jiné lines)', () => {
    expect(isMonolithGroup([{ subtype: 'výztuž' }])).toBe(false);
    expect(isMonolithGroup([{ subtype: 'jiné' }, { subtype: 'bednění' }])).toBe(false);
    expect(isMonolithGroup([])).toBe(false);
  });

  it('override=true promotes a beton-less group (the ✓ toggle on a non-m³ rep row)', () => {
    const rows = [{ subtype: 'jiné', metadata: { is_monolith_override: true } }];
    expect(isMonolithGroup(rows)).toBe(true);
  });

  it('override=false vetoes a group WITH a beton row (explicit demote wins)', () => {
    const rows = [
      { subtype: 'beton', metadata: { is_monolith_override: false } },
      { subtype: 'výztuž', metadata: null },
    ];
    expect(isMonolithGroup(rows)).toBe(false);
  });

  it('veto beats promote when conflicting overrides exist on sibling rows', () => {
    const rows = [
      { subtype: 'jiné', metadata: { is_monolith_override: true } },
      { subtype: 'jiné', metadata: { is_monolith_override: false } },
    ];
    expect(isMonolithGroup(rows)).toBe(false);
  });

  it('metadata as JSON string (backend DB row shape) parses the override', () => {
    const rows = [{ subtype: 'jiné', metadata: '{"is_monolith_override": true}' }];
    expect(isMonolithGroup(rows)).toBe(true);
  });
});
