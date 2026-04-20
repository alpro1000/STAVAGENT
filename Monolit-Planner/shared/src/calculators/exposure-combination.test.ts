/**
 * Exposure-class combination tests — ČSN EN 206+A2 + ČSN P 73 2404.
 *
 * Task 2 (2026-04-20). Covers the 8 typical combinations from real ŘSD
 * practice (task spec AC 17) plus edge cases and the SO 204 golden test.
 */
import { describe, it, expect } from 'vitest';
import {
  EXPOSURE_CLASSES,
  EXPOSURE_CLASS_REQUIREMENTS,
  combineExposure,
  validateExposureCombination,
  getMostRestrictive,
  getExposurePriority,
  getExposureCategory,
  isValidExposureClass,
  formatCombinedSummary,
  compareConcreteClass,
} from './exposure-combination.js';

describe('Exposure class combination', () => {
  // ─── Catalog sanity ────────────────────────────────────────────────────

  describe('EXPOSURE_CLASS_REQUIREMENTS catalog', () => {
    it('has an entry for every declared class', () => {
      for (const c of EXPOSURE_CLASSES) {
        expect(EXPOSURE_CLASS_REQUIREMENTS).toHaveProperty(c);
      }
    });

    it('XF2/XF3/XF4 all require air entrainment ≥ 4 %', () => {
      expect(EXPOSURE_CLASS_REQUIREMENTS.XF2.min_air_content_pct).toBe(4.0);
      expect(EXPOSURE_CLASS_REQUIREMENTS.XF3.min_air_content_pct).toBe(4.0);
      expect(EXPOSURE_CLASS_REQUIREMENTS.XF4.min_air_content_pct).toBe(4.0);
    });

    it('XF1 does NOT require air entrainment', () => {
      expect(EXPOSURE_CLASS_REQUIREMENTS.XF1.min_air_content_pct).toBeNull();
    });

    it('XA2 + XA3 require sulfate-resistant cement, XA1 does not', () => {
      expect(EXPOSURE_CLASS_REQUIREMENTS.XA1.requires_sulfate_resistant).toBe(false);
      expect(EXPOSURE_CLASS_REQUIREMENTS.XA2.requires_sulfate_resistant).toBe(true);
      expect(EXPOSURE_CLASS_REQUIREMENTS.XA3.requires_sulfate_resistant).toBe(true);
    });

    it('X0 has no quantitative requirements', () => {
      const r = EXPOSURE_CLASS_REQUIREMENTS.X0;
      expect(r.max_wc).toBeNull();
      expect(r.min_cement_kg_m3).toBeNull();
      expect(r.min_C_class).toBe('C12/15');
    });

    it('XD3 / XF4 / XA3 / XM3 are the strictest within each family', () => {
      expect(EXPOSURE_CLASS_REQUIREMENTS.XD3.max_wc).toBe(0.45);
      expect(EXPOSURE_CLASS_REQUIREMENTS.XF4.min_cement_kg_m3).toBe(340);
      expect(EXPOSURE_CLASS_REQUIREMENTS.XA3.min_cement_kg_m3).toBe(360);
      expect(EXPOSURE_CLASS_REQUIREMENTS.XM3.min_cement_kg_m3).toBe(360);
    });
  });

  describe('isValidExposureClass()', () => {
    it('accepts all 20 catalog entries', () => {
      for (const c of EXPOSURE_CLASSES) expect(isValidExposureClass(c)).toBe(true);
    });
    it('rejects invented strings', () => {
      expect(isValidExposureClass('XF5')).toBe(false);
      expect(isValidExposureClass('xc2')).toBe(false); // case-sensitive by design
      expect(isValidExposureClass('XB1')).toBe(false);
      expect(isValidExposureClass('')).toBe(false);
    });
  });

  describe('getExposurePriority()', () => {
    it('XF > XD > XA > XM > XC > X0', () => {
      expect(getExposurePriority('XF4')).toBeGreaterThan(getExposurePriority('XD3'));
      expect(getExposurePriority('XD3')).toBeGreaterThan(getExposurePriority('XA3'));
      expect(getExposurePriority('XA3')).toBeGreaterThan(getExposurePriority('XM3'));
      expect(getExposurePriority('XM3')).toBeGreaterThan(getExposurePriority('XC4'));
      expect(getExposurePriority('XC4')).toBeGreaterThan(getExposurePriority('X0'));
    });
    it('within category, numeric suffix breaks ties', () => {
      expect(getExposurePriority('XF4')).toBeGreaterThan(getExposurePriority('XF2'));
      expect(getExposurePriority('XC4')).toBeGreaterThan(getExposurePriority('XC1'));
    });
    it('returns -1 for unknown class', () => {
      expect(getExposurePriority('FOO')).toBe(-1);
    });
  });

  describe('getMostRestrictive()', () => {
    it('single input returns itself', () => {
      expect(getMostRestrictive(['XF2'])).toBe('XF2');
    });
    it('XF4 > XD1 > XC4 → picks XF4', () => {
      expect(getMostRestrictive(['XC4', 'XD1', 'XF4'])).toBe('XF4');
    });
    it('ignores invalid strings', () => {
      expect(getMostRestrictive(['invalid', 'XC2'])).toBe('XC2');
    });
    it('empty input → null', () => {
      expect(getMostRestrictive([])).toBeNull();
      expect(getMostRestrictive(['garbage'])).toBeNull();
    });
  });

  describe('getExposureCategory()', () => {
    it('classifies X0, XC, XD, XF, XA, XM correctly', () => {
      expect(getExposureCategory('X0')).toBe('zero');
      expect(getExposureCategory('XC2')).toBe('karbonatace');
      expect(getExposureCategory('XD3')).toBe('chloridy');
      expect(getExposureCategory('XS1')).toBe('chloridy');
      expect(getExposureCategory('XF4')).toBe('mraz');
      expect(getExposureCategory('XA2')).toBe('chemie');
      expect(getExposureCategory('XM3')).toBe('obrus');
      expect(getExposureCategory('XYZ')).toBeNull();
    });
  });

  describe('compareConcreteClass()', () => {
    it('orders by cylinder strength', () => {
      expect(compareConcreteClass('C25/30', 'C30/37')).toBeLessThan(0);
      expect(compareConcreteClass('C35/45', 'C30/37')).toBeGreaterThan(0);
      expect(compareConcreteClass('C30/37', 'C30/37')).toBe(0);
    });
  });

  // ─── Core combination engine ───────────────────────────────────────────

  describe('combineExposure() — max/min rules', () => {
    it('empty selection → neutral record (C12/15, null w/c)', () => {
      const r = combineExposure([]);
      expect(r.classes).toEqual([]);
      expect(r.min_C_class).toBe('C12/15');
      expect(r.max_wc).toBeNull();
      expect(r.min_cement_kg_m3).toBeNull();
      expect(r.min_air_content_pct).toBeNull();
      expect(r.requires_sulfate_resistant).toBe(false);
    });

    it('single XC2 → just echoes XC2 requirements', () => {
      const r = combineExposure(['XC2']);
      expect(r.min_C_class).toBe('C25/30');
      expect(r.max_wc).toBe(0.60);
      expect(r.min_cement_kg_m3).toBe(280);
      expect(r.min_air_content_pct).toBeNull();
      expect(r.requires_sulfate_resistant).toBe(false);
    });

    it('deduplicates repeated classes', () => {
      const r = combineExposure(['XC4', 'XC4', 'XC4']);
      expect(r.classes).toEqual(['XC4']);
      expect(r.min_C_class).toBe('C30/37');
    });

    it('silently drops invalid strings', () => {
      const r = combineExposure(['XF2', 'garbage', 'XD1']);
      expect(r.classes).toEqual(['XF2', 'XD1']);
    });

    it('buckets selection by category', () => {
      const r = combineExposure(['XC4', 'XD1', 'XF2']);
      expect(r.by_category.karbonatace).toEqual(['XC4']);
      expect(r.by_category.chloridy).toEqual(['XD1']);
      expect(r.by_category.mraz).toEqual(['XF2']);
    });
  });

  // ─── 8 typical real-practice combos (AC 17) ────────────────────────────

  describe('8 real ŘSD practice combinations (AC 17)', () => {
    it('Mostovka: XF2 + XD1 + XC4 → C30/37, w/c 0.50, cement 300, air 4.0', () => {
      // Task spec table says "cement 320", but the ČSN EN 206+A2 Tab. F.1
      // baseline values for this trio are all 300 kg/m³ (XF2, XD1, XC4).
      // The 320 figure likely came from a practical bridge-mix increment or
      // conflation with XD2 (which has 320). We stick to the norm — callers
      // can bump up manually for engineering margin.
      const r = combineExposure(['XF2', 'XD1', 'XC4']);
      expect(r.min_C_class).toBe('C30/37');
      expect(r.max_wc).toBe(0.50); // XC4 drives
      expect(r.min_cement_kg_m3).toBe(300);
      expect(r.min_air_content_pct).toBe(4.0); // XF2 triggers LP
      expect(r.requires_sulfate_resistant).toBe(false);
    });

    it('Opěra v zemi: XC2 + XA1 → C30/37, w/c 0.55, cement 300, no sulfate required', () => {
      const r = combineExposure(['XC2', 'XA1']);
      expect(r.min_C_class).toBe('C30/37'); // XA1 drives upward from C25/30
      expect(r.max_wc).toBe(0.55); // XA1 0.55 < XC2 0.60
      expect(r.min_cement_kg_m3).toBe(300);
      expect(r.min_air_content_pct).toBeNull();
      expect(r.requires_sulfate_resistant).toBe(false);
    });

    it('Pilíř v řece se solemi: XF2 + XD1 + XA1 → C30/37 + air 4.0 + no sulfate (XA1 is not severe enough)', () => {
      const r = combineExposure(['XF2', 'XD1', 'XA1']);
      expect(r.min_C_class).toBe('C30/37');
      expect(r.max_wc).toBe(0.55);
      expect(r.min_cement_kg_m3).toBe(300);
      expect(r.min_air_content_pct).toBe(4.0);
      // Task spec says "síranovzdorný" but the ČSN norm only triggers it at
      // XA2+, so XA1 alone doesn't mandate it. Spec likely assumed XA2.
      expect(r.requires_sulfate_resistant).toBe(false);
    });

    it('Římsa: XF4 + XD3 → C35/45, w/c 0.45, cement 340, air 4.0', () => {
      const r = combineExposure(['XF4', 'XD3']);
      expect(r.min_C_class).toBe('C35/45'); // XD3 drives
      expect(r.max_wc).toBe(0.45); // both 0.45
      expect(r.min_cement_kg_m3).toBe(340); // XF4 drives (XD3=320)
      expect(r.min_air_content_pct).toBe(4.0); // XF4 triggers LP
      expect(r.requires_sulfate_resistant).toBe(false);
    });

    it('Základy: XC2 → C25/30', () => {
      const r = combineExposure(['XC2']);
      expect(r.min_C_class).toBe('C25/30');
      expect(r.max_wc).toBe(0.60);
      expect(r.min_cement_kg_m3).toBe(280);
    });

    it('Podkladní beton: X0 → C12/15, žádné požadavky', () => {
      const r = combineExposure(['X0']);
      expect(r.min_C_class).toBe('C12/15');
      expect(r.max_wc).toBeNull();
      expect(r.min_cement_kg_m3).toBeNull();
      expect(r.min_air_content_pct).toBeNull();
    });

    it('Základy v agresivní vodě: XC2 + XA2 → C30/37 + síranovzdorný', () => {
      const r = combineExposure(['XC2', 'XA2']);
      expect(r.min_C_class).toBe('C30/37'); // XA2 drives
      expect(r.max_wc).toBe(0.50); // XA2 0.50 < XC2 0.60
      expect(r.min_cement_kg_m3).toBe(320);
      expect(r.requires_sulfate_resistant).toBe(true);
    });

    it('Mostovka letní lázně: XF2 + XC4 → C30/37 + w/c 0.50 + air 4.0', () => {
      const r = combineExposure(['XF2', 'XC4']);
      expect(r.min_C_class).toBe('C30/37'); // XC4 drives up from XF2's C25/30
      expect(r.max_wc).toBe(0.50); // XC4 drives down from XF2's 0.55
      expect(r.min_cement_kg_m3).toBe(300);
      expect(r.min_air_content_pct).toBe(4.0);
    });
  });

  // ─── SO 204 golden test (AC 18) ────────────────────────────────────────

  describe('SO 204 D6 golden combination', () => {
    it('XF2 + XD1 + XC4 (TZ: „Expozice: XF2 (mostovka), XD1, XC4 (opěry v zemi)")', () => {
      const r = combineExposure(['XF2', 'XD1', 'XC4']);
      expect(r.min_C_class).toBe('C30/37');
      expect(r.max_wc).toBe(0.50);
      expect(r.min_air_content_pct).toBe(4.0);
      const summary = formatCombinedSummary(r);
      expect(summary).toContain('XF2');
      expect(summary).toContain('XD1');
      expect(summary).toContain('XC4');
      expect(summary).toContain('C30/37');
      expect(summary).toContain('w/c ≤ 0.50');
      expect(summary).toContain('vzduch ≥ 4.0');
    });
  });

  // ─── Validation warnings ───────────────────────────────────────────────

  describe('validateExposureCombination() — advisory warnings', () => {
    it('empty selection → info "vyberte alespoň X0"', () => {
      const w = validateExposureCombination([]);
      expect(w).toHaveLength(1);
      expect(w[0].code).toBe('empty_selection');
      expect(w[0].severity).toBe('info');
    });

    it('XF2/XF4 without any XD → warning "typicky kombinuje s XD"', () => {
      const w = validateExposureCombination(['XF2', 'XC4']);
      const xfw = w.find(x => x.code === 'xf_without_xd');
      expect(xfw).toBeDefined();
      expect(xfw!.message_cs).toContain('chloridů');
    });

    it('XF3 (no salts) without XD → NO warning (XF3 is mráz bez solí)', () => {
      const w = validateExposureCombination(['XF3']);
      expect(w.find(x => x.code === 'xf_without_xd')).toBeUndefined();
    });

    it('XA2 without sulfate-resistant cement confirmation → warning', () => {
      const w = validateExposureCombination(['XA2']);
      expect(w.find(x => x.code === 'xa_missing_sulfate_cement')).toBeDefined();
    });

    it('XA2 with sulfate-resistant cement confirmed → no warning', () => {
      const w = validateExposureCombination(['XA2'],
        { cement_type_is_sulfate_resistant: true });
      expect(w.find(x => x.code === 'xa_missing_sulfate_cement')).toBeUndefined();
    });

    it('multiple classes in same category → warning "nejhorší scénář"', () => {
      const w = validateExposureCombination(['XC1', 'XC4']);
      const mw = w.find(x => x.code === 'multiple_in_category');
      expect(mw).toBeDefined();
      expect(mw!.subject).toBe('karbonatace');
    });

    it('unknown string → warning with suggestion list', () => {
      const w = validateExposureCombination(['XQ9']);
      const uw = w.find(x => x.code === 'unknown_class');
      expect(uw).toBeDefined();
      expect(uw!.message_cs).toContain('Neznámá');
    });

    it('SO 204 healthy selection (XF2+XD1+XC4) → only "xf_without_xd" absent, no other warnings', () => {
      const w = validateExposureCombination(['XF2', 'XD1', 'XC4']);
      expect(w.find(x => x.code === 'xf_without_xd')).toBeUndefined(); // XD1 present
      expect(w.find(x => x.code === 'xa_missing_sulfate_cement')).toBeUndefined();
      expect(w.find(x => x.code === 'multiple_in_category')).toBeUndefined();
    });
  });

  // ─── Performance ──────────────────────────────────────────────────────

  describe('Performance (AC 20)', () => {
    it('combineExposure() of 5 classes runs in < 10 ms', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i += 1) {
        combineExposure(['XF2', 'XD1', 'XC4', 'XA1', 'XM1']);
      }
      // 1000 runs in 10 ms threshold would mean ≤ 10 µs each — generous
      expect(Date.now() - start).toBeLessThan(200);
    });
  });
});
